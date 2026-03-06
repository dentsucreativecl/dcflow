"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus, Search, Star, Archive, MoreHorizontal, Clock } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Document {
    id: string;
    title: string;
    emoji: string | null;
    isPublic: boolean;
    isFavorite: boolean;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
    createdById: string | null;
    spaceId: string | null;
    listId: string | null;
}

export function DocsSidebarContent() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "favorites" | "archived">("all");
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();

    useEffect(() => {
        async function fetchDocs() {
            const supabase = createClient();
            try {
                let query = supabase
                    .from("Document")
                    .select("id, title, emoji, isPublic, isFavorite, isArchived, createdAt, updatedAt, createdById, spaceId, listId")
                    .order("updatedAt", { ascending: false });

                if (filter === "favorites") query = query.eq("isFavorite", true);
                if (filter === "archived") query = query.eq("isArchived", true);
                else query = query.eq("isArchived", false);

                const { data, error } = await query;
                if (error) console.error("Error fetching documents:", error);
                if (data) setDocuments(data as Document[]);
            } catch (err) {
                console.error("Error:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchDocs();
    }, [filter]);

    const filteredDocs = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleFavorite = async (docId: string, current: boolean) => {
        const supabase = createClient();
        await supabase.from("Document").update({ isFavorite: !current }).eq("id", docId);
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isFavorite: !current } : d));
    };

    const createDocument = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("Document").insert({
        id: self.crypto.randomUUID(),
        title: "Documento sin titulo",
        content: "",
        emoji: null,
        isPublic: false,
        isFavorite: false,
        isArchived: false,
        createdById: user.id,
        updatedAt: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      if (data) {
        setDocuments(prev => [data as Document, ...prev]);
        addToast({ title: "Documento creado", description: "Se creo un nuevo documento.", type: "success" });
      }
    } catch (err: unknown) {
      console.warn("Error creating document:", err);
      addToast({ title: "Error", description: err instanceof Error ? err.message : "Error desconocido", type: "error" });
    } finally {
      setCreating(false);
    }
  };

  return (
        <div className="px-3 py-2">
            {/* Search */}
            <div className="relative mb-3">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Buscar documentos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                />
            </div>

            
      {/* New Document button */}
      <Button
        onClick={createDocument}
        disabled={creating}
        className="w-full mb-3 h-8 text-xs bg-[var(--peach)] hover:bg-[var(--peach)]/90 text-foreground"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {creating ? "Creando..." : "Nuevo documento"}
      </Button>

      {/* Filter tabs */}
            <div className="flex gap-1 mb-3">
                <Button variant={filter === "all" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setFilter("all")}>Todos</Button>
                <Button variant={filter === "favorites" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setFilter("favorites")}>
                    <Star className="h-3 w-3 mr-1" /> Favoritos
                </Button>
                <Button variant={filter === "archived" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setFilter("archived")}>
                    <Archive className="h-3 w-3 mr-1" /> Archivados
                </Button>
            </div>

            {/* Documents list */}
            {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No hay documentos</p>
                    <p className="text-xs text-muted-foreground mt-1">Crea tu primer documento</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {filteredDocs.map(doc => (
                        <div key={doc.id} className="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer">
                            <span className="text-lg shrink-0">{doc.emoji || ""}</span>
                            <FileText className={cn("h-4 w-4 shrink-0", !doc.emoji && "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{doc.title}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    Documento

                                </p>
                            </div>
                            <Button
                                variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(doc.id, doc.isFavorite); }}
                            >
                                <Star className={cn("h-3 w-3", doc.isFavorite && "fill-amber-400 text-amber-400")} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
