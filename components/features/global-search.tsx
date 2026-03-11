"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FolderKanban,
  Users,
  CheckSquare,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "list" | "task" | "space" | "member";
  title: string;
  subtitle?: string;
  color?: string;
  initials?: string;
}

export function GlobalSearch({ triggerless = false }: { triggerless?: boolean }) {
  const router = useRouter();
  const { openModal, searchOpen, openSearch, closeSearch } = useAppStore();
  const open = searchOpen;
  const setOpen = (v: boolean) => { v ? openSearch() : closeSearch(); };
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Search Supabase when query changes
  useEffect(() => {
    if (!open || !query || query.length < 2) {
      setResults([]);
      return;
    }

    const supabase = createClient();
    const pattern = `%${query}%`;

    const controller = new AbortController();

    async function performSearch() {
      setLoading(true);
      try {
        const [tasksRes, listsRes, spacesRes, usersRes] = await Promise.all([
          supabase
            .from("Task")
            .select("id, title, list:List(id, name)")
            .ilike("title", pattern)
            .is("parentId", null)
            .limit(8),
          supabase
            .from("List")
            .select("id, name, space:Space(id, name, color)")
            .ilike("name", pattern)
            .limit(5),
          supabase
            .from("Space")
            .select("id, name, color")
            .ilike("name", pattern)
            .limit(5),
          supabase
            .from("User")
            .select("id, name, email")
            .or(`name.ilike.${pattern},email.ilike.${pattern}`)
            .eq("isActive", true)
            .limit(5),
        ]);

        const combined: SearchResult[] = [];

        // Tasks
        (tasksRes.data || []).forEach((t) => {
          const list = Array.isArray(t.list) ? t.list[0] : t.list;
          combined.push({
            id: t.id,
            type: "task",
            title: t.title,
            subtitle: list?.name || "Sin lista",
          });
        });

        // Lists (projects)
        const matchedListIds = new Set<string>();
        (listsRes.data || []).forEach((l) => {
          const space = Array.isArray(l.space) ? l.space[0] : l.space;
          combined.push({
            id: l.id,
            type: "list",
            title: l.name,
            subtitle: space?.name || "",
            color: space?.color,
          });
          matchedListIds.add(l.id);
        });

        // Tasks from matching projects (when no direct task title match found)
        if (matchedListIds.size > 0 && tasksRes.data && tasksRes.data.length === 0) {
          const { data: projectTasks } = await supabase
            .from("Task")
            .select("id, title, list:List(id, name)")
            .in("listId", Array.from(matchedListIds))
            .is("parentId", null)
            .limit(5);
          (projectTasks || []).forEach((t) => {
            const list = Array.isArray(t.list) ? t.list[0] : t.list;
            combined.push({
              id: t.id,
              type: "task",
              title: t.title,
              subtitle: list?.name || "Sin lista",
            });
          });
        }

        // Spaces
        (spacesRes.data || []).forEach((s) => {
          combined.push({
            id: s.id,
            type: "space",
            title: s.name,
            color: s.color,
          });
        });

        // Users
        (usersRes.data || []).forEach((u) => {
          combined.push({
            id: u.id,
            type: "member",
            title: u.name,
            subtitle: u.email,
            initials: u.name?.slice(0, 2).toUpperCase(),
          });
        });

        if (!controller.signal.aborted) {
          setResults(combined.slice(0, 15));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    const debounce = setTimeout(performSearch, 300);
    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [query, open]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");

    switch (result.type) {
      case "list":
        router.push(`/lists/${result.id}`);
        break;
      case "task":
        openModal("task-detail-v2", { taskId: result.id });
        break;
      case "space":
        router.push(`/clients/${result.id}`);
        break;
      case "member":
        router.push("/team");
        break;
    }
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "list":
        return <FolderKanban className="h-4 w-4" />;
      case "task":
        return <CheckSquare className="h-4 w-4" />;
      case "space":
        return <Layers className="h-4 w-4" />;
      case "member":
        return <Users className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "list":
        return "Proyecto";
      case "task":
        return "Tarea";
      case "space":
        return "Espacio";
      case "member":
        return "Equipo";
    }
  };

  return (
    <>
      {/* Search Trigger Button — hidden when used as layout-level singleton */}
      {!triggerless && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/80 transition-colors w-full max-w-[280px]"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      )}

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b border-border px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar proyectos, tareas, espacios, equipo..."
              className="border-0 focus-visible:ring-0 text-base h-14"
            />
          </div>

          {/* Results */}
          <ScrollArea className="max-h-[400px]">
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Buscando...
              </div>
            )}

            {query.trim() && !loading ? (
              results.length > 0 ? (
                <div className="p-2">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left transition-colors",
                        index === selectedIndex
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-secondary"
                      )}
                    >
                      {result.type === "member" ? (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                            {result.initials || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ) : result.color ? (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: result.color + "30" }}
                        >
                          <span style={{ color: result.color }}>
                            {getIcon(result.type)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                          {getIcon(result.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {getTypeLabel(result.type)}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No se encontraron resultados para &ldquo;{query}&rdquo;
                  </p>
                </div>
              )
            ) : !query.trim() ? (
              <div className="p-4">
                {/* Quick Actions */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    Acciones Rápidas
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setOpen(false);
                        openModal("new-project");
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                    >
                      <FolderKanban className="h-4 w-4 text-primary" />
                      <span className="text-sm">Nuevo Proyecto</span>
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        openModal("new-task-v2");
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-secondary transition-colors"
                    >
                      <CheckSquare className="h-4 w-4 text-studio-info" />
                      <span className="text-sm">Nueva Tarea</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">↑↓</kbd>
                Navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">↵</kbd>
                Seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">esc</kbd>
                Cerrar
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
