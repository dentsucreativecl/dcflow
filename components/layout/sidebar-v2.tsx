"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/contexts/auth-context";
import {
    Home,
    CheckSquare,
    Briefcase,
    Hash,
    Users,
    BarChart2,
    Settings,
    ShieldCheck,
    ChevronRight,
    ChevronDown,
    ChevronLeft,
    FolderOpen,
    Folder,
    List,
    Plus,
    MessageCircle,
    PanelLeftClose,
    PanelLeft,
} from "lucide-react";

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

interface SidebarV2Props {
    className?: string;
}

const navItems = [
    { label: "Inicio", icon: Home, href: "/dashboard" },
    { label: "Mis Tareas", icon: CheckSquare, href: "/my-tasks" },
    { label: "Proyectos", icon: Briefcase, href: "/projects" },
    { label: "Canales", icon: Hash, href: "/channels" },
    { label: "Equipo", icon: Users, href: "/team" },
];

export function SidebarV2({ className }: SidebarV2Props) {
    const pathname = usePathname();
    const { user, isAdmin } = useAuth();
    const { openModal } = useAppStore();
    const [collapsed, setCollapsed] = useState(false);

    // Data state
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [folders, setFolders] = useState<FolderType[]>([]);
    const [lists, setLists] = useState<ListType[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [clientsExpanded, setClientsExpanded] = useState(true);
    const [channels, setChannels] = useState<Array<{ id: string; name: string; slug: string }>>([]);
    const [dmContacts, setDmContacts] = useState<Array<{ id: string; name: string }>>([]);

    // Fetch spaces, folders, lists
    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            const supabase = createClient();

            try {
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

                if (filteredSpaces.length > 0) {
                    setExpandedSpaces(new Set([filteredSpaces[0].id]));
                }
            } catch {
                // silently fail
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user, isAdmin]);

    // Fetch channels
    const fetchChannels = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from("Channel")
            .select("id, name, slug")
            .eq("isArchived", false)
            .order("name");
        if (data) setChannels(data);
    }, []);

    useEffect(() => { fetchChannels(); }, [fetchChannels]);

    useEffect(() => {
        const handler = () => { fetchChannels(); };
        window.addEventListener("dcflow:channels-refresh", handler);
        return () => window.removeEventListener("dcflow:channels-refresh", handler);
    }, [fetchChannels]);

    // Fetch DM contacts
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

    const toggleSpace = (spaceId: string) => {
        setExpandedSpaces(prev => {
            const next = new Set(prev);
            next.has(spaceId) ? next.delete(spaceId) : next.add(spaceId);
            return next;
        });
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            next.has(folderId) ? next.delete(folderId) : next.add(folderId);
            return next;
        });
    };

    if (collapsed) {
        return (
            <div className={cn("flex flex-col h-full w-12 border-r border-border bg-card shrink-0", className)}>
                <div className="flex items-center justify-center h-14 border-b border-border">
                    <button
                        onClick={() => setCollapsed(false)}
                        className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
                        title="Expandir sidebar"
                    >
                        <PanelLeft className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
                <nav className="flex flex-col items-center gap-1 py-2">
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center justify-center h-9 w-9 rounded-md transition-colors",
                                (pathname === item.href || pathname.startsWith(item.href + "/"))
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                            title={item.label}
                        >
                            <item.icon className="h-5 w-5" />
                        </Link>
                    ))}
                </nav>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full w-60 border-r border-border bg-card shrink-0", className)}>
            {/* Sidebar Header */}
            <div className="flex items-center justify-between h-14 border-b border-border px-3">
                <span className="font-semibold text-sm text-foreground">Navegación</span>
                <button
                    onClick={() => setCollapsed(true)}
                    className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent transition-colors"
                    title="Colapsar sidebar"
                >
                    <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            <ScrollArea className="flex-1">
                {/* Main Nav */}
                <nav className="px-2 py-2 space-y-0.5">
                    {navItems.map(item => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                                    isActive
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mx-3 border-b border-border" />

                {/* CLIENTES Section */}
                <div className="py-2">
                    <button
                        onClick={() => setClientsExpanded(!clientsExpanded)}
                        className="flex items-center gap-1 w-full px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {clientsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Clientes
                    </button>

                    {clientsExpanded && (
                        <nav className="px-2 mt-1">
                            {loading ? (
                                <div className="space-y-2 p-2">
                                    <Skeleton className="h-7 w-full" />
                                    <Skeleton className="h-5 w-3/4 ml-4" />
                                    <Skeleton className="h-5 w-3/4 ml-4" />
                                    <Skeleton className="h-7 w-full" />
                                </div>
                            ) : spaces.length === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    <p>No hay espacios</p>
                                    <Button size="sm" className="mt-2">
                                        <Plus className="h-4 w-4 mr-1" />
                                        Crear espacio
                                    </Button>
                                </div>
                            ) : (
                                spaces.map(space => {
                                    const isExpanded = expandedSpaces.has(space.id);
                                    const spaceFolders = folders.filter(f => f.spaceId === space.id);
                                    const spaceListsWithoutFolder = lists.filter(
                                        l => l.spaceId === space.id && !l.folderId
                                    );

                                    return (
                                        <div key={space.id} className="mb-0.5">
                                            <button
                                                onClick={() => toggleSpace(space.id)}
                                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-foreground"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                ) : (
                                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                )}
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: space.color || "#8B5CF6" }}
                                                />
                                                <span className="flex-1 truncate text-left" title={space.name}>
                                                    {space.name}
                                                </span>
                                            </button>

                                            {isExpanded && (
                                                <div className="ml-5 mt-0.5 space-y-0.5">
                                                    {spaceFolders.map(folder => {
                                                        const isFolderExpanded = expandedFolders.has(folder.id);
                                                        const folderLists = lists.filter(l => l.folderId === folder.id);

                                                        return (
                                                            <div key={folder.id}>
                                                                <button
                                                                    onClick={() => toggleFolder(folder.id)}
                                                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                                >
                                                                    {isFolderExpanded ? (
                                                                        <ChevronDown className="h-3 w-3 shrink-0" />
                                                                    ) : (
                                                                        <ChevronRight className="h-3 w-3 shrink-0" />
                                                                    )}
                                                                    {isFolderExpanded ? (
                                                                        <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                                    ) : (
                                                                        <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                                    )}
                                                                    <span className="flex-1 truncate text-left" title={folder.name}>
                                                                        {folder.name}
                                                                    </span>
                                                                </button>

                                                                {isFolderExpanded && (
                                                                    <div className="ml-5 mt-0.5 space-y-0.5">
                                                                        {folderLists.map(list => (
                                                                            <Link
                                                                                key={list.id}
                                                                                href={`/lists/${list.id}`}
                                                                                className={cn(
                                                                                    "flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                                                                    pathname === `/lists/${list.id}` && "bg-accent text-accent-foreground"
                                                                                )}
                                                                            >
                                                                                <List className="h-3.5 w-3.5 shrink-0" />
                                                                                <span className="truncate" title={list.name}>{list.name}</span>
                                                                            </Link>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {spaceListsWithoutFolder.map(list => (
                                                        <Link
                                                            key={list.id}
                                                            href={`/lists/${list.id}`}
                                                            className={cn(
                                                                "flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                                                pathname === `/lists/${list.id}` && "bg-accent text-accent-foreground"
                                                            )}
                                                        >
                                                            <List className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                            <span className="truncate" title={list.name}>{list.name}</span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </nav>
                    )}
                </div>

                <div className="mx-3 border-b border-border" />

                {/* Channels */}
                <div className="px-2 py-2">
                    <div className="flex items-center justify-between mb-1 px-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Canales</p>
                        {isAdmin && (
                            <button
                                onClick={() => openModal("new-channel")}
                                className="text-muted-foreground hover:text-foreground"
                                title="Nuevo canal"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {channels.map(ch => (
                        <Link
                            key={ch.id}
                            href={`/channels/${ch.slug}`}
                            className={cn(
                                "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
                                pathname === `/channels/${ch.slug}` && "bg-accent font-medium"
                            )}
                        >
                            <Hash className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            {ch.name.toLowerCase()}
                        </Link>
                    ))}
                </div>

                <div className="mx-3 border-b border-border" />

                {/* DM */}
                <div className="px-2 py-2">
                    <div className="flex items-center justify-between mb-1 px-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mensajes directos</p>
                    </div>
                    {dmContacts.map(contact => {
                        const initials = contact.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                        return (
                            <Link
                                key={contact.id}
                                href={`/dm/${contact.id}`}
                                className={cn(
                                    "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
                                    pathname === `/dm/${contact.id}` && "bg-accent font-medium"
                                )}
                            >
                                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground shrink-0">
                                    {initials}
                                </span>
                                {contact.name}
                            </Link>
                        );
                    })}
                    <Link
                        href="/dm"
                        className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mt-0.5"
                    >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                        Ver todos
                    </Link>
                </div>

                <div className="mx-3 border-b border-border" />

                {/* Reports */}
                <div className="px-2 py-2">
                    <Link
                        href="/reports"
                        className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                            pathname === "/reports" || pathname.startsWith("/reports/")
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <BarChart2 className="h-4 w-4 shrink-0" />
                        Reports
                    </Link>
                </div>
            </ScrollArea>

            {/* Bottom: Settings & Admin */}
            <div className="border-t border-border px-2 py-2 space-y-0.5">
                <Link
                    href="/settings"
                    className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                        pathname === "/settings"
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                >
                    <Settings className="h-4 w-4 shrink-0" />
                    Settings
                </Link>
                {(user?.supabaseRole === "SUPER_ADMIN" || user?.supabaseRole === "ADMIN") && (
                    <Link
                        href="/admin"
                        className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                            pathname === "/admin" || pathname.startsWith("/admin/")
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Admin
                    </Link>
                )}
            </div>
        </div>
    );
}
