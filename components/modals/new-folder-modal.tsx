"use client";

import { useState } from "react";
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
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";

const FOLDER_COLORS = [
  { label: "Ámbar",   value: "#F59E0B" },
  { label: "Azul",    value: "#3B82F6" },
  { label: "Verde",   value: "#10B981" },
  { label: "Rojo",    value: "#EF4444" },
  { label: "Morado",  value: "#8B5CF6" },
  { label: "Rosa",    value: "#EC4899" },
  { label: "Gris",    value: "#6B7280" },
];

export function NewFolderModal() {
  const { activeModal, modalData, closeModal } = useAppStore();
  const { addToast } = useToast();

  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0].value);
  const [firstProjectName, setFirstProjectName] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOpen = activeModal === "new-folder";
  const spaceId = modalData?.spaceId;

  const handleClose = () => {
    setName("");
    setColor(FOLDER_COLORS[0].value);
    setFirstProjectName("");
    setNameError("");
    closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError("El nombre es requerido"); return; }
    if (!spaceId) {
      addToast({ title: "Error", description: "No se especificó el espacio", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create folder
      const folderRes = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), spaceId, color }),
      });

      if (!folderRes.ok) {
        const { error } = await folderRes.json();
        addToast({ title: "Error al crear folder", description: error, type: "error" });
        return;
      }

      const { folder } = await folderRes.json();

      // 2. Optionally create first project (List) inside the folder
      if (firstProjectName.trim() && folder?.id) {
        const projectRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: firstProjectName.trim(), spaceId, folderId: folder.id }),
        });
        if (!projectRes.ok) {
          // Folder was created OK; just warn about the project
          addToast({ title: "Folder creado", description: "No se pudo crear el primer proyecto", type: "success" });
          window.dispatchEvent(new Event("dcflow:spaces-refresh"));
          handleClose();
          return;
        }
      }

      addToast({ title: "Folder creado", type: "success" });
      window.dispatchEvent(new Event("dcflow:spaces-refresh"));
      handleClose();
    } catch {
      addToast({ title: "Error al crear folder", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Folder</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Folder name */}
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Nombre del folder</Label>
            <Input
              id="folder-name"
              placeholder="Ej: Campañas Q1"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              autoFocus
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c.value,
                    borderColor: color === c.value ? "white" : "transparent",
                    outline: color === c.value ? `2px solid ${c.value}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Optional first project */}
          <div className="space-y-1.5 pt-1 border-t border-border">
            <Label htmlFor="first-project">
              Primer proyecto <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
            </Label>
            <Input
              id="first-project"
              placeholder="Ej: Redes Sociales Enero"
              value={firstProjectName}
              onChange={(e) => setFirstProjectName(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Folder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
