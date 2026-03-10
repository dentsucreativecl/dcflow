"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  color: z.string().min(1, "Selecciona un color"),
  accountManagerId: z.string().optional(),
  services: z.array(z.string()).optional().default([]),
});

type FormData = z.infer<typeof formSchema>;

interface InternalUser {
  id: string;
  name: string;
}

export function NewClientModal() {
  const { closeModal } = useAppStore();
  const { addToast } = useToast();
  const [users, setUsers] = useState<InternalUser[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", color: PRESET_COLORS[0], accountManagerId: "", services: [] },
  });

  const selectedColor = watch("color");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("User")
      .select("id, name")
      .neq("userType", "GUEST")
      .eq("isActive", true)
      .order("name")
      .then(({ data }) => {
        if (data) setUsers(data as InternalUser[]);
      });
  }, []);

  const handleClose = useCallback(() => {
    reset();
    closeModal();
  }, [reset, closeModal]);

  // Fix temporal: Radix absorbe el Escape cuando el <Select> está abierto.
  // Este listener garantiza que Escape siempre cierre el modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  const onSubmit = async (data: FormData) => {
    const supabase = createClient();

    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const spaceId = crypto.randomUUID();
    const { error: spaceError } = await supabase.from("Space").insert({
      id: spaceId,
      name: data.name,
      slug: `${slug}-${spaceId.slice(0, 6)}`,
      color: data.color,
      icon: "🏢",
      description: "",
      areas: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (spaceError) {
      addToast({ title: "Error al crear cliente", description: spaceError.message, type: "error" });
      return;
    }

    if (data.accountManagerId) {
      await supabase.from("SpaceMember").upsert({
        spaceId,
        userId: data.accountManagerId,
        role: "OWNER",
      });
    }

    // Create SOW folders
    for (const service of data.services || []) {
      await supabase.from("Folder").insert({
        id: crypto.randomUUID(),
        name: service,
        spaceId,
        color: SERVICE_COLORS[service] || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    addToast({ title: "Cliente creado", description: `${data.name} fue añadido.`, type: "success" });
    window.dispatchEvent(new CustomEvent("dcflow:clients-refresh"));
    handleClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Company name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Empresa *</Label>
            <Input
              id="name"
              placeholder="Empresa S.A."
              autoFocus
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Color selector */}
          <div className="space-y-2">
            <Label>Color de avatar</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue("color", color, { shouldValidate: true })}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-all",
                    selectedColor === color
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          {/* SOW Services */}
          <div className="space-y-2">
            <Label>Servicios SOW</Label>
            <div className="grid grid-cols-2 gap-2">
              {SOW_SERVICES.map((service) => {
                const selected = (watch("services") || []).includes(service);
                return (
                  <label
                    key={service}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      onChange={() => {
                        const current = watch("services") || [];
                        setValue(
                          "services",
                          selected
                            ? current.filter((s: string) => s !== service)
                            : [...current, service],
                        );
                      }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: SERVICE_COLORS[service] }}
                    />
                    {service}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Account manager */}
          <div className="space-y-2">
            <Label>Cuenta asignada</Label>
            <Select
              value={watch("accountManagerId") || ""}
              onValueChange={(value) =>
                setValue("accountManagerId", value === "none" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
