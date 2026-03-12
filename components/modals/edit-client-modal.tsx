"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
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
import { AlertTriangle, Camera, Loader2, Trash2 } from "lucide-react";

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

interface FolderItem {
  id: string;
  name: string;
}

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [existingFolders, setExistingFolders] = useState<FolderItem[]>([]);
  const [servicesToDelete, setServicesToDelete] = useState<string[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
        supabase.from("Space").select("name, color, avatarUrl").eq("id", spaceId).single(),
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
        setAvatarUrl((spaceRes.data as any).avatarUrl || null);
      }

      if (foldersRes.data) {
        const folderItems: FolderItem[] = foldersRes.data.map((f: any) => ({ id: f.id, name: f.name }));
        setExistingFolders(folderItems);
        // Pre-select services that already have folders
        setServices(folderItems.map(f => f.name).filter((n: string) => SOW_SERVICES.includes(n)));
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !spaceId) return;
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'png';
      const path = `logos/${spaceId}.${ext}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      const url = urlData.publicUrl;
      const { error: dbErr } = await supabase.from('Space').update({ avatarUrl: url }).eq('id', spaceId);
      if (dbErr) throw dbErr;
      setAvatarUrl(url);
      addToast({ title: 'Logo actualizado', type: 'success' });
      window.dispatchEvent(new CustomEvent("dcflow:clients-refresh"));
    } catch (err) {
      console.error('Logo upload error:', err);
      addToast({ title: 'Error al subir logo', description: err instanceof Error ? err.message : String(err), type: 'error' });
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const existingFolderNames = existingFolders.map(f => f.name);

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

      // Delete deselected SOW folders (cascade deletes their projects)
      for (const serviceName of servicesToDelete) {
        const folder = existingFolders.find(f => f.name === serviceName);
        if (folder) {
          const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
          if (!res.ok) {
            const { error: delErr } = await res.json().catch(() => ({ error: "Error al eliminar" }));
            throw new Error(delErr);
          }
        }
      }

      // Create new SOW folders (only those not already existing and not being deleted)
      for (const service of services) {
        if (!existingFolderNames.includes(service)) {
          const res = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: service, spaceId, color: SERVICE_COLORS[service] || null }),
          });
          if (!res.ok) {
            const { error: createErr } = await res.json().catch(() => ({ error: "Error al crear" }));
            throw new Error(createErr);
          }
        }
      }

      addToast({ title: "Cliente actualizado", description: `${name} fue guardado.`, type: "success" });
      window.dispatchEvent(new CustomEvent("dcflow:clients-refresh"));
      window.dispatchEvent(new CustomEvent("dcflow:spaces-refresh"));
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
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo del Cliente</Label>
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 rounded-lg overflow-hidden border bg-muted flex items-center justify-center shrink-0" style={{ backgroundColor: avatarUrl ? undefined : color }}>
                  {avatarUrl
                    ? <Image src={avatarUrl} alt={name} width={64} height={64} className="object-cover w-full h-full" />
                    : <span className="text-white text-xl font-semibold">{name.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    Subir logo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG o SVG recomendado</p>
                </div>
              </div>
            </div>

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
                  const alreadyExists = existingFolderNames.includes(service);
                  const markedForDeletion = servicesToDelete.includes(service);
                  return (
                    <label
                      key={service}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                        markedForDeletion
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected && !markedForDeletion}
                        onChange={() => {
                          if (alreadyExists && selected) {
                            // Toggle mark-for-deletion for existing folders
                            setServicesToDelete((prev) =>
                              markedForDeletion
                                ? prev.filter((s) => s !== service)
                                : [...prev, service]
                            );
                          } else if (selected && !alreadyExists) {
                            setServices((prev) => prev.filter((s) => s !== service));
                          } else {
                            setServices((prev) => [...prev, service]);
                          }
                        }}
                      />
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SERVICE_COLORS[service] }}
                      />
                      <span className={cn(markedForDeletion && "line-through")}>{service}</span>
                      {markedForDeletion && (
                        <span className="text-[10px] ml-auto font-medium">eliminar</span>
                      )}
                      {alreadyExists && selected && !markedForDeletion && (
                        <span className="text-[10px] text-muted-foreground ml-auto">existente</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {servicesToDelete.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Se eliminarán los siguientes folders y todos sus proyectos:</p>
                    <p className="mt-0.5 text-destructive/80">{servicesToDelete.join(", ")}</p>
                  </div>
                </div>
              )}
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
