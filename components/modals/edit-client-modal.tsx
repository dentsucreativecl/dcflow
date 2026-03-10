"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, Trash2 } from "lucide-react";

const PRESET_COLORS = [
  "#3498DB", "#2980B9", "#E74C3C", "#C0392B",
  "#27AE60", "#2ECC71", "#8E44AD", "#9B59B6",
  "#F39C12", "#E67E22", "#16A085", "#1ABC9C",
  "#2C3E50", "#E91E63", "#FF5722", "#607D8B",
];

const SOW_SERVICES = [
  'Estrategia', 'Cuentas', 'Creatividad', 'Dise\u00f1o',
  'Social Media', 'Producci\u00f3n', 'PR/Comunicaciones', 'Media/Pauta',
];

const SERVICE_COLORS: Record<string, string> = {
  'Estrategia': '#6366f1', 'Cuentas': '#f59e0b', 'Creatividad': '#ec4899',
  'Dise\u00f1o': '#8b5cf6', 'Social Media': '#06b6d4', 'Producci\u00f3n': '#22c55e',
  'PR/Comunicaciones': '#f97316', 'Media/Pauta': '#ef4444',
};

interface MemberRow {
  userId: string;
  role: string;
  userName: string;
  userEmail: string;
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

export function EditClientModal() {
  const { closeModal, modalData } = useAppStore();
  const { addToast } = useToast();
  const spaceId = modalData?.clientId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [services, setServices] = useState<string[]>([]);
  const [existingFolders, setExistingFolders] = useState<string[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    closeModal();
  }, [closeModal]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  // Fetch space data
  useEffect(() => {
    if (!spaceId) return;
    const fetchSpace = async () => {
      const supabase = createClient();

      const [spaceRes, foldersRes, membersRes, usersRes] = await Promise.all([
        supabase.from("Space").select("name, color").eq("id", spaceId).single(),
        supabase.from("Folder").select("id, name").eq("spaceId", spaceId),
        supabase
          .from("SpaceMember")
          .select("userId, role, User:userId(name, email)")
          .eq("spaceId", spaceId),
        supabase
          .from("User")
          .select("id, name, email")
          .neq("userType", "GUEST")
          .eq("isActive", true)
          .order("name"),
      ]);

      if (spaceRes.data) {
        setName(spaceRes.data.name);
        setColor(spaceRes.data.color || PRESET_COLORS[0]);
      }

      if (foldersRes.data) {
        const folderNames = foldersRes.data.map((f: any) => f.name);
        setExistingFolders(folderNames);
        // Pre-select services that already have folders
        setServices(folderNames.filter((n: string) => SOW_SERVICES.includes(n)));
      }

      if (membersRes.data) {
        setMembers(
          membersRes.data.map((m: any) => {
            const user = Array.isArray(m.User) ? m.User[0] : m.User;
            return {
              userId: m.userId,
              role: m.role,
              userName: user?.name || "—",
              userEmail: user?.email || "",
            };
          })
        );
      }

      if (usersRes.data) {
        setAllUsers(usersRes.data as AvailableUser[]);
      }

      setLoading(false);
    };
    fetchSpace();
  }, [spaceId]);

  const handleSave = async () => {
    if (!spaceId) return;
    setSaving(true);
    try {
      const supabase = createClient();

      // Update space name and color
      const { error } = await supabase
        .from("Space")
        .update({ name, color, updatedAt: new Date().toISOString() })
        .eq("id", spaceId);

      if (error) throw error;

      // Create new SOW folders (only those not already existing)
      for (const service of services) {
        if (!existingFolders.includes(service)) {
          await supabase.from("Folder").insert({
            id: crypto.randomUUID(),
            name: service,
            spaceId,
            color: SERVICE_COLORS[service] || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      addToast({ title: "Cliente actualizado", description: `${name} fue guardado.`, type: "success" });
      window.dispatchEvent(new CustomEvent("dcflow:clients-refresh"));
      handleClose();
    } catch (err: any) {
      addToast({ title: "Error al guardar", description: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!spaceId || !addUserId) return;
    setUpdatingMember(addUserId);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("SpaceMember").upsert({
        spaceId,
        userId: addUserId,
        role: "MEMBER",
      });
      if (error) throw error;

      const user = allUsers.find((u) => u.id === addUserId);
      setMembers((prev) => [
        ...prev,
        {
          userId: addUserId,
          role: "MEMBER",
          userName: user?.name || "—",
          userEmail: user?.email || "",
        },
      ]);
      setAddUserId("");
    } catch (err: any) {
      addToast({ title: "Error", description: err.message, type: "error" });
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!spaceId) return;
    setUpdatingMember(userId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("SpaceMember")
        .delete()
        .eq("spaceId", spaceId)
        .eq("userId", userId);
      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err: any) {
      addToast({ title: "Error", description: err.message, type: "error" });
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (!spaceId) return;
    const newRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
    setUpdatingMember(userId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("SpaceMember")
        .update({ role: newRole })
        .eq("spaceId", spaceId)
        .eq("userId", userId);
      if (error) throw error;
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      addToast({ title: "Error", description: err.message, type: "error" });
    } finally {
      setUpdatingMember(null);
    }
  };

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.userId === u.id)
  );

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre de la Empresa</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Empresa S.A."
              />
            </div>

            {/* Color selector */}
            <div className="space-y-2">
              <Label>Color de avatar</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            {/* SOW Services */}
            <div className="space-y-2">
              <Label>Servicios SOW</Label>
              <div className="grid grid-cols-2 gap-2">
                {SOW_SERVICES.map((service) => {
                  const selected = services.includes(service);
                  const alreadyExists = existingFolders.includes(service);
                  return (
                    <label
                      key={service}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border hover:bg-accent",
                        alreadyExists && !selected && "opacity-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        onChange={() => {
                          if (selected && !alreadyExists) {
                            // Can uncheck only if folder doesn't exist yet
                            setServices((prev) => prev.filter((s) => s !== service));
                          } else if (selected && alreadyExists) {
                            // Don't remove existing folders
                            return;
                          } else {
                            setServices((prev) => [...prev, service]);
                          }
                        }}
                      />
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SERVICE_COLORS[service] }}
                      />
                      {service}
                      {alreadyExists && selected && (
                        <span className="text-[10px] text-muted-foreground ml-auto">existente</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Members */}
            <div className="space-y-3">
              <Label>Miembros</Label>

              {/* Add member */}
              <div className="flex gap-2">
                <Select value={addUserId} onValueChange={setAddUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Agregar miembro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                    {availableUsers.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Todos asignados
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!addUserId || updatingMember === addUserId}
                  onClick={handleAddMember}
                >
                  {updatingMember === addUserId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Agregar"
                  )}
                </Button>
              </div>

              {/* Members list */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {members.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Sin miembros</p>
                )}
                {members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.userEmail}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        disabled={updatingMember === m.userId}
                        onClick={() => handleToggleRole(m.userId, m.role)}
                      >
                        {updatingMember === m.userId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Badge
                            variant={m.role === "ADMIN" || m.role === "OWNER" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {m.role}
                          </Badge>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        disabled={updatingMember === m.userId}
                        onClick={() => handleRemoveMember(m.userId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
