"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Plus, Search, LayoutGrid, List, Loader2, Building2, Mail, FolderKanban, Edit3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterDropdown } from "@/components/features/filter-dropdown";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ClientRow {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
  listsCount: number;
  membersCount: number;
  contactName: string;
  contactEmail: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ClientsPage() {
  const { openModal } = useAppStore();
  const { isAdmin, isSuperAdmin } = useAuth();
  const router = useRouter();
  const canEdit = isAdmin || isSuperAdmin;
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Last-resort: never stay stuck in loading state (catches any edge case missed above)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchClients = useCallback(async () => {
      try {
      const supabase = createClient();

      // Fetch Spaces + Lists via API (bypasses RLS for admins)
      const apiRes = await fetch("/api/spaces?include=all").then(r => r.json());
      const spaces: Array<{ id: string; name: string; color: string }> = apiRes?.spaces || [];
      const apiLists: Array<{ id: string; spaceId: string }> = apiRes?.lists || [];

      if (!spaces || spaces.length === 0) {
        return;
      }

      // Fetch space members with user info
      const { data: members } = await supabase
        .from("SpaceMember")
        .select("spaceId, userId, User(name, email, userType)");

      // Build list count from API response
      const listCountBySpace = new Map<string, number>();
      for (const l of apiLists) {
        listCountBySpace.set(l.spaceId, (listCountBySpace.get(l.spaceId) || 0) + 1);
      }

      const membersBySpace = new Map<string, Array<{ name: string; email: string; userType: string }>>();
      if (members) {
        for (const m of members as Array<Record<string, unknown>>) {
          const spaceId = m.spaceId as string;
          const user = m.User as Record<string, unknown> | null;
          if (!membersBySpace.has(spaceId)) membersBySpace.set(spaceId, []);
          if (user) {
            membersBySpace.get(spaceId)!.push({
              name: (user.name as string) || "",
              email: (user.email as string) || "",
              userType: (user.userType as string) || "MEMBER",
            });
          }
        }
      }

      const mapped: ClientRow[] = spaces.map((s: any) => {
        const spaceMembers = membersBySpace.get(s.id) || [];
        // Prefer GUEST users as contact, otherwise first member
        const contact = spaceMembers.find(m => m.userType === "GUEST") || spaceMembers[0];
        return {
          id: s.id,
          name: s.name,
          color: s.color || "#6B7280",
          avatarUrl: s.avatarUrl || null,
          listsCount: listCountBySpace.get(s.id) || 0,
          membersCount: spaceMembers.length,
          contactName: contact?.name || "",
          contactEmail: contact?.email || "",
        };
      });

      setClients(mapped);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);
    fetchClients().finally(() => {
      clearTimeout(safetyTimer);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, [fetchClients]);

  // Refresh when a new client is created from the modal
  useEffect(() => {
    const handler = () => fetchClients();
    window.addEventListener("dcflow:clients-refresh", handler);
    return () => window.removeEventListener("dcflow:clients-refresh", handler);
  }, [fetchClients]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !client.name.toLowerCase().includes(q) &&
          !client.contactName.toLowerCase().includes(q) &&
          !client.contactEmail.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [clients, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Gestiona las cuentas de clientes de la agencia"
        showSearch={false}
        actions={
          <Button className="gap-2" onClick={() => openModal("new-client")}>
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              className="w-[280px] bg-card pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {filteredClients.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="p-5 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/clients/${client.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center text-white text-sm font-semibold shrink-0"
                    style={{ backgroundColor: client.avatarUrl ? undefined : client.color }}
                  >
                    {client.avatarUrl
                      ? <Image src={client.avatarUrl} alt={client.name} width={48} height={48} className="object-cover w-full h-full" />
                      : getInitials(client.name)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => { e.stopPropagation(); openModal("edit-client", { clientId: client.id }); }}
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {client.listsCount} proyecto{client.listsCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1 truncate">
                  {client.name}
                </h3>
                {client.contactName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Mail className="h-3 w-3" />
                    {client.contactName}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" />
                  {client.membersCount} miembro{client.membersCount !== 1 ? "s" : ""}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className={`grid ${canEdit ? "grid-cols-[2fr_1fr_1fr_100px_90px]" : "grid-cols-[2fr_1fr_1fr_100px]"} gap-4 px-5 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider`}>
              <span>Cliente</span>
              <span>Contacto</span>
              <span>Proyectos</span>
              <span>Equipo</span>
              {canEdit && <span></span>}
            </div>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="divide-y divide-border/50">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className={`grid ${canEdit ? "grid-cols-[2fr_1fr_1fr_100px_90px]" : "grid-cols-[2fr_1fr_1fr_100px]"} gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer`}
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center text-white text-xs font-semibold shrink-0"
                        style={{ backgroundColor: client.avatarUrl ? undefined : client.color }}
                      >
                        {client.avatarUrl
                          ? <Image src={client.avatarUrl} alt={client.name} width={32} height={32} className="object-cover w-full h-full" />
                          : getInitials(client.name)}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">
                        {client.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">
                      {client.contactName || "—"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {client.listsCount}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {client.membersCount}
                    </span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs w-fit"
                        onClick={(e) => { e.stopPropagation(); openModal("edit-client", { clientId: client.id }); }}
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            No se encontraron clientes
          </h3>
          <p className="text-muted-foreground mt-1 mb-4">
            {searchQuery
              ? "Intenta ajustar los filtros"
              : "Comienza añadiendo tu primer cliente"}
          </p>
          {searchQuery ? (
            <Button
              variant="outline"
              onClick={() => setSearchQuery("")}
            >
              Limpiar Filtros
            </Button>
          ) : (
            <Button onClick={() => openModal("new-client")}>
              <Plus className="h-4 w-4 mr-2" />
              Añadir Cliente
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
