"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ChevronRight,
    ChevronDown,
    FolderOpen,
    Folder,
    List,
    Plus,
    Search,
    MoreHorizontal,
    Inbox,
    CheckCircle,
    Star,
    Hash,
    MessageCircle,
    Briefcase,
    Building2,
    ListTodo,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useFavoritesStore } from "@/lib/favorites-store";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { CalendarSidebarContent } from "./calendar-sidebar-content";
import { TeamSidebarContent } from "./team-sidebar-content";
import { PlaceholderSection } from "./placeholder-section";
import { DocsSidebarContent } from "./docs-sidebar-content";
import { ReportsSidebarContent } from "./reports-sidebar-content";
// TimeSidebarContent eliminado — timer en tiempo real removido
import { useAuth } from "@/contexts/auth-context";

interface Space {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
}

interface FolderType {
    id: string;
    name: string;
    spaceId: string;
}

interface ListType {
    id: string;
    name: string;
    folderId: string | null;
    spaceId: string;
}

interface ContextPanelProps {
    isOpen: boolean;
    activeSection: string;
}

/**
 * ContextPanel - Expandable 240px panel showing Space hierarchy
 */
export function ContextPanel({ isOpen, activeSection }: ContextPanelProps) {
  const pathname = usePathname();
    const [notifCount, setNotifCount] = useState(0);
    useEffect(() => {
      async function fetchCount() {
        const supabase = createClient();
        const { count } = await supabase.from("Notification").select("id", { count: "exact", head: true }).eq("isRead", false);
        if (count !== null) setNotifCount(count);
      }
      fetchCount();
    }, []);
    const { openModal } = useAppStore();
    const { user, isAdmin } = useAuth();
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [folders, setFolders] = useState<FolderType[]>([]);
    const [lists, setLists] = useState<ListType[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showFavorites, setShowFavorites] = useState(false);
    const { favorites } = useFavoritesStore();
    const [dmContacts, setDmContacts] = useState<Array<{ id: string; name: string }>>([]);

    useEffect(() => {
        async function fetchDmContacts() {
            if (!user) return;
            const supabase = createClient();
            const { data } = await supabase
                .from("User")
                .select("id, name")
                .neq("id", user.id)
                .eq("isActive", true)
                .order("name")
                .limit(5);
            if (data) setDmContacts(data);
        }
        fetchDmContacts();
    }, [user]);

    // Fetch spaces, folders, and lists
    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            const supabase = createClient();

            try {
                // For non-admin users, get allowed spaces
                let allowedSpaceIds: string[] | null = null;
                if (!isAdmin) {
                    const { data: memberships } = await supabase
                        .from("SpaceMember")
                        .select("spaceId")
                        .eq("userId", user.id);
                    if (memberships) {
                        allowedSpaceIds = memberships.map(m => m.spaceId);
                    }
                }

                const [spacesRes, foldersRes, listsRes] = await Promise.all([
                    supabase.from("Space").select("id, name, color, icon").order("name"),
                    supabase.from("Folder").select("id, name, spaceId").order("name"),
                    supabase.from("List").select("id, name, folderId, spaceId").order("name"),
                ]);

                // Filter by allowed spaces for non-admin users
                let filteredSpaces = spacesRes.data || [];
                let filteredFolders = foldersRes.data || [];
                let filteredLists = listsRes.data || [];

                if (allowedSpaceIds !== null) {
                    const spaceSet = new Set(allowedSpaceIds);
                    filteredSpaces = filteredSpaces.filter(s => spaceSet.has(s.id));
                    filteredFolders = filteredFolders.filter(f => spaceSet.has(f.spaceId));
                    filteredLists = filteredLists.filter(l => spaceSet.has(l.spaceId));
                }

                setSpaces(filteredSpaces);
                setFolders(filteredFolders);
                setLists(filteredLists);

                // Auto-expand first space
                if (filteredSpaces.length > 0) {
                    setExpandedSpaces(new Set([filteredSpaces[0].id]));
                }
            } catch (error) {
                console.error("Error fetching navigation data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [user, isAdmin]);

    const toggleSpace = (spaceId: string) => {
        setExpandedSpaces((prev) => {
            const next = new Set(prev);
            if (next.has(spaceId)) {
                next.delete(spaceId);
            } else {
                next.add(spaceId);
            }
            return next;
        });
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    // Get section title based on active section
    const getSectionTitle = () => {
        switch (activeSection) {
            case "home":
                return "Inicio";
            case "calendar":
                return "Agenda";
            case "team":
                return "Equipos";
            case "docs":
                return "Documentos";
            case "reports":
                return "Reportes";
            case "time":
                return "Tiempo";
            default:
                return "Espacios";
        }
    };

    if (!isOpen) return null;

    return (
        <div className="flex h-full w-full flex-col border-r border-border bg-card">
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <h2 className="font-semibold text-foreground">{getSectionTitle()}</h2>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <Search className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openModal("new-task-v2")}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 py-2">
                {activeSection === "home" && (
                    <>
                    <div className="px-3 py-2 space-y-0.5 mb-2">
                      <Link href="/inbox" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/inbox" ? "text-primary font-medium bg-accent" : "text-primary font-medium")}>
                        <Inbox className="h-4 w-4" />
                        Bandeja de entrada
                        {notifCount > 0 && <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{notifCount}</span>}
                      </Link>
                      <Link href="/my-tasks" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/my-tasks" && "bg-accent font-medium")}>
                        <CheckCircle className="h-4 w-4" />
                        Mis tareas
                      </Link>
                      <Link href="/projects" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/projects" && "bg-accent font-medium")}>
                        <Briefcase className="h-4 w-4" />
                        Proyectos
                      </Link>
                      <Link href="/clients" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/clients" && "bg-accent font-medium")}>
                        <Building2 className="h-4 w-4" />
                        Clientes
                      </Link>
                      <Link href="/tasks" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/tasks" && "bg-accent font-medium")}>
                        <ListTodo className="h-4 w-4" />
                        Tareas
                      </Link>
                      <button onClick={() => setShowFavorites(!showFavorites)} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent">
                <Star className={favorites.length > 0 ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4"} />
                Favoritos
                {favorites.length > 0 && <span className="ml-auto bg-muted text-[10px] px-1.5 py-0.5 rounded-full">{favorites.length}</span>}
              </button>
              {showFavorites && favorites.length > 0 && (
                <div className="ml-6 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                  {favorites.map((fav) => (
                    <Link
                      key={fav.id}
                      href={fav.type === "list" ? `/lists/${fav.id}` : "#"}
                      className="flex items-center gap-2 px-2 py-1 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground group"
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: fav.color || "#8B5CF6" }} />
                      <span className="truncate flex-1" title={fav.name}>{fav.name}</span>
                      <FavoriteStar item={fav} className="opacity-0 group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
              )}
                    </div>
                    <div className="mx-3 border-b border-border mb-2" />
                    <nav className="px-2">
                        {loading ? (
                            <div className="space-y-2 p-2">
                                <Skeleton className="h-8 w-full" />
                                <Skeleton className="h-6 w-3/4 ml-4" />
                                <Skeleton className="h-6 w-3/4 ml-4" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ) : spaces.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                <p>No hay espacios</p>
                                <Button size="sm" className="mt-2">
                                    <Plus className="h-4 w-4 mr-1" />
                                    Crear espacio
                                </Button>
                            </div>
                        ) : (
                            spaces.map((space) => {
                                const isExpanded = expandedSpaces.has(space.id);
                                const spaceFolders = folders.filter((f) => f.spaceId === space.id);
                                const spaceListsWithoutFolder = lists.filter(
                                    (l) => l.spaceId === space.id && !l.folderId
                                );

                                return (
                                    <div key={space.id} className="mb-1">
                                        {/* Space */}
                                        <button
                                            onClick={() => toggleSpace(space.id)}
                                            className={cn(
                                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                                "text-foreground"
                                            )}
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: space.color || "#8B5CF6" }}
                                            />
                                            <span className="flex-1 truncate text-left" title={space.name}>{space.name}</span>
                                        </button>

                                        {/* Folders and Lists inside Space */}
                                        {isExpanded && (
                                            <div className="ml-4 mt-1 space-y-0.5">
                                                {/* Folders */}
                                                {spaceFolders.map((folder) => {
                                                    const isFolderExpanded = expandedFolders.has(folder.id);
                                                    const folderLists = lists.filter((l) => l.folderId === folder.id);

                                                    return (
                                                        <div key={folder.id}>
                                                            <button
                                                                onClick={() => toggleFolder(folder.id)}
                                                                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground group"
                                                            >
                                                                {isFolderExpanded ? (
                                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                                ) : (
                                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                                )}
                                                                {isFolderExpanded ? (
                                                                    <FolderOpen className="h-4 w-4 text-amber-500" />
                                                                ) : (
                                                                    <Folder className="h-4 w-4 text-amber-500" />
                                                                )}
                                                                <span className="flex-1 truncate text-left" title={folder.name}>{folder.name}</span>
                                                            </button>

                                                            {/* Lists inside Folder */}
                                                            {isFolderExpanded && (
                                                                <div className="ml-6 mt-0.5 space-y-0.5">
                                                                    {folderLists.map((list) => (
                                                                        <Link
                                                                            key={list.id}
                                                                            href={`/lists/${list.id}`}
                                                                            className={cn(
                                                                                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground group",
                                                                                pathname === `/lists/${list.id}` &&
                                                                                "bg-accent text-accent-foreground"
                                                                            )}
                                                                        >
                                                                            <List className="h-3.5 w-3.5" />
                                                                            <span className="truncate flex-1" title={list.name}>{list.name}</span>
                                                                            <FavoriteStar item={{ id: list.id, type: "list", name: list.name, color: space.color || undefined, parentName: folder.name }} className="opacity-0 group-hover:opacity-100" />
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Lists without Folder (directly in Space) */}
                                                {spaceListsWithoutFolder.map((list) => (
                                                    <Link
                                                        key={list.id}
                                                        href={`/lists/${list.id}`}
                                                        className={cn(
                                                            "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground group",
                                                            pathname === `/lists/${list.id}` &&
                                                            "bg-accent text-accent-foreground"
                                                        )}
                                                    >
                                                        <List className="h-4 w-4 text-blue-500" />
                                                        <span className="truncate flex-1" title={list.name}>{list.name}</span>
                        <FavoriteStar item={{ id: list.id, type: "list", name: list.name, color: space.color || undefined }} className="opacity-0 group-hover:opacity-100" />
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </nav>
                    <div className="mx-3 border-b border-border my-2" />
                    <div className="px-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">Canales</p>
                      <Link href="/channels/general" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/channels/general" && "bg-accent font-medium")}><Hash className="h-3 w-3 text-green-700" /> general</Link>
                      <Link href="/channels/creatividad" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/channels/creatividad" && "bg-accent font-medium")}><Hash className="h-3 w-3 text-green-700" /> creatividad</Link>
                      <Link href="/channels/produccion" className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === "/channels/produccion" && "bg-accent font-medium")}><Hash className="h-3 w-3 text-green-700" /> produccion</Link>
                    </div>
                    <div className="mx-3 border-b border-border my-2" />
                    <div className="px-3 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">Mensajes directos</p>
                      {dmContacts.map((contact) => {
                        const initials = contact.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                        return (
                          <Link key={contact.id} href={`/dm/${contact.id}`} className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === `/dm/${contact.id}` && "bg-accent font-medium")}>
                            <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground">{initials}</span> {contact.name}
                          </Link>
                        );
                      })}
                    </div>
                    </>
                )}

                {activeSection === "calendar" && (
                    <CalendarSidebarContent />
                )}

                {activeSection === "team" && (
                    <TeamSidebarContent />
                )}

                {activeSection === "docs" && <DocsSidebarContent />}
            {activeSection === "reports" && <ReportsSidebarContent />}
            {activeSection === "time" && <div className="px-3 py-8 text-center text-sm text-muted-foreground">Timer deshabilitado</div>}
            </ScrollArea>
        </div>
    );
}
