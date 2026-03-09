"use client";

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

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Dirección de correo inválida"),
  role: z.string().min(1, "Selecciona un cargo"),
  department: z.string().min(1, "Selecciona un área"),
  hourlyRate: z.number().min(0, "La tarifa debe ser mayor a 0"),
  capacity: z.number().min(1).max(60, "La capacidad debe estar entre 1 y 60 horas"),
});

type FormData = z.infer<typeof formSchema>;

const roles = [
  "Project Manager",
  "Lead Designer",
  "Senior Developer",
  "UX Researcher",
  "Motion Designer",
  "Frontend Developer",
  "Backend Developer",
  "Brand Strategist",
  "Art Director",
  "Copywriter",
  "Account Manager",
];

const departments = [
  "Management",
  "Design",
  "Development",
  "Strategy",
  "Marketing",
  "Operations",
];

export function NewMemberModal() {
  const { activeModal, closeModal, addTeamMember } = useAppStore();
  const { addToast } = useToast();

  const isOpen = activeModal === "new-member";

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "",
      department: "",
      hourlyRate: 75,
      capacity: 40,
    },
  });

  const handleClose = () => {
    reset();
    closeModal();
  };

  const onSubmit = (data: FormData) => {
    // Generate initials from name
    const nameParts = data.name.split(" ");
    const avatar =
      nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        : data.name.substring(0, 2).toUpperCase();

    addTeamMember({
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department,
      hourlyRate: data.hourlyRate,
      capacity: data.capacity,
      avatar,
      hoursThisWeek: 0,
      skills: [],
      status: "available",
    });

    addToast({
      title: "Miembro agregado",
      description: `${data.name} ha sido agregado al equipo.`,
      type: "success",
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Miembro del Equipo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre Completo *</Label>
            <Input
              id="name"
              placeholder="Juan Pérez"
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico *</Label>
            <Input
              id="email"
              type="email"
              placeholder="juan@dcflow.com"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cargo *</Label>
              <Select
                value={watch("role")}
                onValueChange={(value) => setValue("role", value)}
              >
                <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar cargo" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-xs text-destructive">{errors.role.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Departamento *</Label>
              <Select
                value={watch("department")}
                onValueChange={(value) => setValue("department", value)}
              >
                <SelectTrigger className={errors.department ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar área" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && (
                <p className="text-xs text-destructive">{errors.department.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Tarifa por Hora ($) *</Label>
              <Input
                id="hourlyRate"
                type="number"
                min={0}
                {...register("hourlyRate", { valueAsNumber: true })}
                className={errors.hourlyRate ? "border-destructive" : ""}
              />
              {errors.hourlyRate && (
                <p className="text-xs text-destructive">{errors.hourlyRate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacidad Semanal (hrs) *</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                max={60}
                {...register("capacity", { valueAsNumber: true })}
                className={errors.capacity ? "border-destructive" : ""}
              />
              {errors.capacity && (
                <p className="text-xs text-destructive">{errors.capacity.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Agregar Miembro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
