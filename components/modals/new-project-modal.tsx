"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";

export function NewProjectModal() {
  const { activeModal, closeModal, sidebarSpaces, sidebarFolders } = useAppStore();
  const { addToast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [nameError, setNameError] = useState("");
  const [spaceError, setSpaceError] = useState("");

  const isOpen = activeModal === "new-project";

  // Folders for selected space
  const spaceFolders = sidebarFolders.filter(f => f.spaceId === spaceId);

  // Reset folder when space changes
  useEffect(() => { setFolderId(""); }, [spaceId]);

  const handleClose = () => {
    setName("");
    setSpaceId("");
    setFolderId("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setNameError("");
    setSpaceError("");
    closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let valid = true;
    if (!name.trim()) {
      setNameError("El nombre del proyecto es requerido");
      valid = false;
    } else {
      setNameError("");
    }
    if (!spaceId) {
      setSpaceError("El cliente/espacio es requerido");
      valid = false;
    } else {
      setSpaceError("");
    }
    if (!valid) return;

    if (!user) {
      addToast({ title: "Error", description: "No autenticado", type: "error" });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          spaceId,
          folderId: folderId || null,
          description: description.trim() || null,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(error);
      }

      const { id: newId } = await res.json();

      addToast({
        title: "Proyecto creado",
        description: `"${name.trim()}" fue creado exitosamente.`,
        type: "success",
      });

      handleClose();
      window.dispatchEvent(new CustomEvent("dcflow:spaces-refresh"));
      router.push(`/lists/${newId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      addToast({ title: "Error al crear proyecto", description: msg, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Crear Nuevo Proyecto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Nombre del Proyecto */}
          <div className="space-y-2">
            <Label htmlFor="proj-name">
              Nombre del Proyecto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="proj-name"
              placeholder="Ej: Campaña Verano 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={nameError ? "border-destructive" : ""}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>

          {/* Espacio / Cliente */}
          <div className="space-y-2">
            <Label>
              Cliente / Espacio <span className="text-destructive">*</span>
            </Label>
            <Select
              value={spaceId}
              onValueChange={(v) => { setSpaceId(v); setSpaceError(""); }}
              disabled={sidebarSpaces.length === 0}
            >
              <SelectTrigger className={spaceError ? "border-destructive" : ""}>
                <SelectValue placeholder={sidebarSpaces.length === 0 ? "Cargando..." : "Seleccionar espacio"} />
              </SelectTrigger>
              <SelectContent>
                {sidebarSpaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: space.color ?? "#8B5CF6" }}
                      />
                      {space.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {spaceError && <p className="text-sm text-destructive">{spaceError}</p>}
          </div>

          {/* Folder (opcional) */}
          {spaceId && (
            <div className="space-y-2">
              <Label>Folder (opcional)</Label>
              <Select
                value={folderId}
                onValueChange={setFolderId}
                disabled={spaceFolders.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={spaceFolders.length === 0 ? "Sin folders disponibles" : "Sin folder"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin folder</SelectItem>
                  {spaceFolders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proj-start">Fecha de inicio</Label>
              <Input id="proj-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-end">Fecha de cierre</Label>
              <Input id="proj-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="proj-description">Descripción</Label>
            <Textarea
              id="proj-description"
              placeholder="Describe brevemente el proyecto..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</>
              ) : "Crear Proyecto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
