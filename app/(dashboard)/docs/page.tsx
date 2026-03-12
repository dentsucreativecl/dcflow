"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, FolderOpen, Search, Plus, Star, Clock,
  File, Grid, List, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";

interface Doc {
  id: string;
  title: string;
  emoji: string | null;
  spaceName: string;
  listName: string | null;
  updatedAt: string;
  createdBy: string;
  isFavorite: boolean;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return "Justo ahora";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? "s" : ""}`;
  return `hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? "es" : ""}`;
}

export default function DocsPage() {
  const router = useRouter();
  const { openModal } = useAppStore();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpace, setFilterSpace] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    async function fetchDocs() {
      const supabase = createClient();
      const { data } = await supabase
        .from("Document")
        .select(`
          id, title, emoji, isFavorite, updatedAt, isArchived,
          Space(name),
          List(name),
          createdBy:User!Document_createdById_fkey(name)
        `)
        .eq("isArchived", false)
        .order("updatedAt", { ascending: false });

      if (data && !cancelled) {
        const mapped: Doc[] = data.map((d: Record<string, unknown>) => {
          const space = d.Space as Record<string, unknown> | null;
          const list = d.List as Record<string, unknown> | null;
          const author = d.createdBy as Record<string, unknown> | null;
          return {
            id: d.id as string,
            title: d.title as string,
            emoji: d.emoji as string | null,
            spaceName: (space?.name as string) || "General",
            listName: (list?.name as string) || null,
            updatedAt: d.updatedAt as string,
            createdBy: (author?.name as string) || "Desconocido",
            isFavorite: d.isFavorite as boolean,
          };
        });
        setDocs(mapped);
      }
      if (!cancelled) setLoading(false);
    }

    fetchDocs().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, []);

  const toggleFavorite = async (id: string) => {
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;

    const supabase = createClient();
    await supabase
      .from("Document")
      .update({ isFavorite: !doc.isFavorite })
      .eq("id", id);

    setDocs((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, isFavorite: !d.isFavorite } : d
      )
    );
  };

  const spaces = Array.from(new Set(docs.map((d) => d.spaceName)));

  const filtered = docs.filter((d) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.title.toLowerCase().includes(q)) return false;
    }
    if (filterSpace !== "all" && d.spaceName !== filterSpace) return false;
    if (showStarredOnly && !d.isFavorite) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {docs.length} documentos · {spaces.length} espacios
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => openModal("new-document")}>
          <Plus className="h-4 w-4" />
          Nuevo Documento
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="rounded-xl border bg-card p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={filterSpace}
            onChange={(e) => setFilterSpace(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
          >
            <option value="all">Todos los espacios</option>
            {spaces.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className={
              showStarredOnly
                ? "p-2 rounded-lg bg-amber-500/10 text-amber-500"
                : "p-2 rounded-lg text-muted-foreground hover:bg-muted"
            }
          >
            <Star
              className="h-4 w-4"
              fill={showStarredOnly ? "currentColor" : "none"}
            />
          </button>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={
                viewMode === "grid"
                  ? "p-2 bg-muted text-foreground"
                  : "p-2 text-muted-foreground hover:bg-muted/50"
              }
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={
                viewMode === "list"
                  ? "p-2 bg-muted text-foreground"
                  : "p-2 text-muted-foreground hover:bg-muted/50"
              }
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border bg-card p-5 hover:border-primary/50 transition-all group cursor-pointer"
              onClick={() => router.push(`/docs/${doc.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-lg">
                  {doc.emoji || "📄"}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(doc.id);
                  }}
                  className="p-1 rounded hover:bg-muted"
                >
                  <Star
                    className="h-4 w-4"
                    fill={doc.isFavorite ? "#f59e0b" : "none"}
                    stroke={doc.isFavorite ? "#f59e0b" : "currentColor"}
                  />
                </button>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1 truncate">
                {doc.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <FolderOpen className="h-3 w-3" />
                <span>{doc.spaceName}</span>
                {doc.listName && (
                  <>
                    <span>·</span>
                    <span>{doc.listName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo(doc.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{doc.createdBy}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_120px] gap-4 px-5 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Nombre</span>
            <span>Espacio</span>
            <span>Autor</span>
            <span>Modificado</span>
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="grid grid-cols-[2fr_1fr_1fr_120px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => router.push(`/docs/${doc.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{doc.emoji || "📄"}</span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {doc.title}
                  </span>
                  {doc.isFavorite && (
                    <Star
                      className="h-3 w-3 text-amber-400 shrink-0"
                      fill="currentColor"
                    />
                  )}
                </div>
                <span className="text-sm text-muted-foreground truncate">
                  {doc.spaceName}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {doc.createdBy}
                </span>
                <span className="text-sm text-muted-foreground">
                  {timeAgo(doc.updatedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            No se encontraron documentos
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Intenta con otros filtros de búsqueda
          </p>
        </div>
      )}
    </div>
  );
}
