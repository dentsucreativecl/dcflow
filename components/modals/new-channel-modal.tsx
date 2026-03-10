"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function NewChannelModal() {
  const { activeModal, closeModal } = useAppStore();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOpen = activeModal === "new-channel";
  const slug = generateSlug(name);

  const handleClose = () => {
    setName("");
    setDescription("");
    closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setSubmitting(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("Channel").insert({
        id: crypto.randomUUID(),
        name: name.trim(),
        slug,
        description: description.trim() || null,
        createdBy: user.id,
        updatedAt: new Date().toISOString(),
      });

      if (error) throw error;

      addToast({
        title: "Canal creado",
        description: `#${slug} creado exitosamente`,
        type: "success",
      });

      window.dispatchEvent(new CustomEvent("dcflow:channels-refresh"));
      handleClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      addToast({
        title: "Error al crear canal",
        description: msg,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Canal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Nombre *</Label>
            <Input
              id="channel-name"
              placeholder="Nombre del canal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {slug && (
              <p className="text-xs text-muted-foreground">
                Slug: #{slug}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-desc">Descripción</Label>
            <Textarea
              id="channel-desc"
              placeholder="Descripción del canal (opcional)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Canal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
