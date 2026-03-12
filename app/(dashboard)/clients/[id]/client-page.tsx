"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Edit, Loader2, FolderKanban, Users, X, Camera, FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpaceDetail {
  id: string;
  name: string;
  color: string;
  slug: string;
  avatarUrl?: string | null;
}

interface ListItem {
  id: string;
  name: string;
  folderName: string;
  taskCount: number;
}

interface MemberItem {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarInitials: string;
}

// ── Color Preset ──────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3498DB", "#2980B9", "#E74C3C", "#C0392B",
  "#27AE60", "#2ECC71", "#8E44AD", "#9B59B6",
  "#F39C12", "#E67E22", "#16A085", "#1ABC9C",
  "#2C3E50", "#E91E63", "#FF5722", "#607D8B",
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type Tab = "projects" | "team";

export default function ClientDetailPage() {
  const params = useParams();
  const rawId = params.id as string;
  const id = rawId === "_"
    ? (typeof window !== "undefined"
        ? window.location.pathname.split("/").filter(Boolean).slice(-1)[0] || ""
        : "")
    : rawId;

  const { isAdmin, isSuperAdmin } = useAuth();
  const { addToast } = useToast();
  const { openModal } = useAppStore();

  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [lists, setLists] = useState<ListItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [accountManager, setAccountManager] = useState<MemberItem | null>(null);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !space) return;
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'png';
      const path = `logos/${space.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;
      await supabase.from('Space').update({ avatarUrl }).eq('id', space.id);
      setSpace({ ...space, avatarUrl });
      addToast({ title: 'Logo actualizado', type: 'success' });
    } catch (err) {
      console.error('Logo upload error:', err);
      addToast({ title: 'Error al subir logo', description: err instanceof Error ? err.message : String(err), type: 'error' });
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const fetchData = useCallback(async () => {
    if (!id) return;
    const supabase = createClient();

    // Fetch space
    const { data: spaceData } = await supabase
      .from("Space")
      .select("id, name, color, slug, avatarUrl")
      .eq("id", id)
      .single();

    if (!spaceData) return;
    setSpace(spaceData as SpaceDetail);

    // Fetch lists (via folders for folder name)
    const { data: listData } = await supabase
      .from("List")
      .select("id, name, folder:Folder(name)")
      .eq("spaceId", id)
      .order("name");

    // Count tasks per list
    const listIds = (listData || []).map((l: Record<string, unknown>) => l.id as string);
    let taskCounts = new Map<string, number>();
    if (listIds.length > 0) {
      const { data: tasks } = await supabase
        .from("Task")
        .select("listId")
        .in("listId", listIds);
      for (const t of tasks || []) {
        const lid = t.listId as string;
        taskCounts.set(lid, (taskCounts.get(lid) || 0) + 1);
      }
    }

    setLists(
      (listData || []).map((l: Record<string, unknown>) => {
        const folder = Array.isArray(l.folder) ? l.folder[0] : l.folder as Record<string, unknown> | null;
        return {
          id: l.id as string,
          name: l.name as string,
          folderName: (folder?.name as string) || "",
          taskCount: taskCounts.get(l.id as string) || 0,
        };
      })
    );

    // Fetch members
    const { data: memberData } = await supabase
      .from("SpaceMember")
      .select("userId, role, user:User(name, email)")
      .eq("spaceId", id);

    const mappedMembers: MemberItem[] = (memberData || []).map((m: Record<string, unknown>) => {
      const user = (Array.isArray(m.user) ? m.user[0] : m.user) as Record<string, unknown> | null;
      const name = (user?.name as string) || "Usuario";
      return {
        userId: m.userId as string,
        name,
        email: (user?.email as string) || "",
        role: m.role as string,
        avatarInitials: getInitials(name),
      };
    });

    setMembers(mappedMembers);
    setAccountManager(mappedMembers.find((m) => m.role === "OWNER") || null);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);
    fetchData().finally(() => {
      clearTimeout(timeoutId);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [fetchData]);

  // Listen for refresh events (e.g., after creating a project)
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("dcflow:clients-refresh", handler);
    window.addEventListener("dcflow:refresh", handler);
    return () => {
      window.removeEventListener("dcflow:clients-refresh", handler);
      window.removeEventListener("dcflow:refresh", handler);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Cliente no encontrado</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/clients" className="hover:text-foreground transition-colors">Clientes</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{space.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <div
                className="h-14 w-14 rounded-xl overflow-hidden flex items-center justify-center text-white text-xl font-semibold"
                style={{ backgroundColor: space.avatarUrl ? undefined : space.color }}
              >
                {space.avatarUrl
                  ? <Image src={space.avatarUrl} alt={space.name} width={56} height={56} className="object-cover w-full h-full" />
                  : getInitials(space.name)}
              </div>
              {(isAdmin || isSuperAdmin) && (
                <>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
                  </button>
                </>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{space.name}</h1>
              {accountManager && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cuenta: <span className="text-foreground">{accountManager.name}</span>
                </p>
              )}
            </div>
          </div>
          {(isAdmin || isSuperAdmin) && (
            <Button variant="outline" className="gap-2" onClick={() => openModal("edit-client", { clientId: id })}>
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("projects")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "projects"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FolderKanban className="h-4 w-4" />
            Proyectos
            <Badge variant="secondary" className="text-xs">{lists.length}</Badge>
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "team"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Equipo
            <Badge variant="secondary" className="text-xs">{members.length}</Badge>
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "projects" && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => space && openModal("new-folder", { spaceId: space.id })}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Nuevo Folder
              </Button>
            </div>
            {lists.length > 0 ? lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0"
                    style={{ backgroundColor: space.color }}
                  >
                    {list.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{list.name}</p>
                    {list.folderName && (
                      <p className="text-xs text-muted-foreground truncate">{list.folderName}</p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 ml-4">
                  {list.taskCount} tarea{list.taskCount !== 1 ? "s" : ""}
                </Badge>
              </Link>
            )) : (
              <Card className="py-12 text-center text-muted-foreground">
                Sin proyectos asociados
              </Card>
            )}
          </div>
        )}

        {activeTab === "team" && (
          <div className="space-y-2">
            {members.length > 0 ? members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {m.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                {m.role === "OWNER" && (
                  <Badge variant="outline" className="text-xs shrink-0">Cuenta</Badge>
                )}
              </div>
            )) : (
              <Card className="py-12 text-center text-muted-foreground">
                Sin miembros asignados
              </Card>
            )}
          </div>
        )}
      </div>

    </>
  );
}
