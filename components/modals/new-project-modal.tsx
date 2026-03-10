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
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

interface SpaceOption {
  id: string;
  name: string;
  color: string;
}

export function NewProjectModal() {
  const { activeModal, closeModal } = useAppStore();
  const { addToast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [nameError, setNameError] = useState("");
  const [spaceError, setSpaceError] = useState("");

  const isOpen = activeModal === "new-project";

  // Load spaces when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function fetchSpaces() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("Space")
        .select("id, name, color")
        .order("name");
      if (data) setSpaces(data);
      setLoading(false);
    }

    fetchSpaces();
  }, [isOpen]);

  const handleClose = () => {
    setName("");
    setSpaceId("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setNameError("");
    setSpaceError("");
    closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
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
    const supabase = createClient();

    try {
      const newId = self.crypto.randomUUID();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("List")
        .insert({
          id: newId,
          name: name.trim(),
          spaceId,
          description: description.trim() || null,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
          isPitch: false,
          createdAt: now,
          updatedAt: now,
        });

      if (error) throw error;

      addToast({
        title: "Proyecto creado",
        description: `"${name.trim()}" fue creado exitosamente.`,
        type: "success",
      });

      handleClose();

      // Notify any open list/project views to refresh
      window.dispatchEvent(new CustomEvent('dcflow:refresh'));
      window.dispatchEvent(new CustomEvent('dcflow:clients-refresh'));

      router.push(`/lists/${newId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      addToast({
        title: "Error al crear proyecto",
        description: msg,
        type: "error",
      });
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
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          {/* Espacio / Cliente */}
          <div className="space-y-2">
            <Label>
              Cliente / Espacio <span className="text-destructive">*</span>
            </Label>
            <Select
              value={spaceId}
              onValueChange={(v) => { setSpaceId(v); setSpaceError(""); }}
              disabled={loading}
            >
              <SelectTrigger className={spaceError ? "border-destructive" : ""}>
                <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar espacio"} />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: space.color }}
                      />
                      {space.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {spaceError && (
              <p className="text-sm text-destructive">{spaceError}</p>
            )}
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proj-start">Fecha de inicio</Label>
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-end">Fecha de cierre</Label>
              <Input
                id="proj-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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
            <Button type="submit" disabled={submitting || loading}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Proyecto"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
