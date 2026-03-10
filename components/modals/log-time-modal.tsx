"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const logTimeSchema = z.object({
  taskId: z.string().min(1, "La tarea es requerida"),
  date: z.date(),
  hours: z.number().min(0.25, "Mínimo 15 minutos").max(24, "Máximo 24 horas"),
  description: z.string().optional(),
});

type LogTimeFormData = z.infer<typeof logTimeSchema>;

interface TaskOption {
  id: string;
  title: string;
  listName: string;
  spaceName: string;
}

export function LogTimeModal() {
  const { activeModal, closeModal, modalData } = useAppStore();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LogTimeFormData>({
    resolver: zodResolver(logTimeSchema),
    defaultValues: {
      taskId: "",
      date: new Date(),
      hours: 1,
      description: "",
    },
  });

  const date = watch("date");
  const taskId = watch("taskId");
  const isOpen = activeModal === "log-time";

  // Load tasks when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function fetchTasks() {
      setLoadingTasks(true);
      const supabase = createClient();

      const { data } = await supabase
        .from("Task")
        .select("id, title, list:List(name, space:Space(name))")
        .is("parentId", null)
        .order("title");

      if (data) {
        setTasks(data.map((t: any) => {
          const list = Array.isArray(t.list) ? t.list[0] : t.list;
          const space = list ? (Array.isArray(list.space) ? list.space[0] : list.space) : null;
          return {
            id: t.id,
            title: t.title,
            listName: list?.name || "Sin lista",
            spaceName: space?.name || "Sin espacio",
          };
        }));
      }

      // Pre-select task if provided in modalData
      if (modalData?.taskId) {
        setValue("taskId", modalData.taskId);
      }

      setLoadingTasks(false);
    }

    fetchTasks();
  }, [isOpen, modalData, setValue]);

  const handleClose = () => {
    reset();
    closeModal();
  };

  const onSubmit = async (data: LogTimeFormData) => {
    if (!user) {
      addToast({ title: "Error", description: "No autenticado", type: "error" });
      return;
    }

    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("TimeEntry")
        .insert({
          id: crypto.randomUUID(),
          taskId: data.taskId,
          userId: user.id,
          hours: data.hours,
          date: data.date.toISOString().split("T")[0],
          description: data.description || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      if (error) throw error;

      addToast({
        title: "Tiempo registrado",
        description: `${data.hours} horas registradas exitosamente.`,
        type: "success",
      });

      window.dispatchEvent(new CustomEvent('dcflow:refresh'));
      handleClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error desconocido";
      addToast({
        title: "Error al registrar tiempo",
        description: msg,
        type: "error",
      });
    }
  };

  // Quick time buttons
  const quickTimes = [0.5, 1, 2, 4, 8];

  // Group tasks by space
  const groupedTasks = tasks.reduce((groups, task) => {
    const key = task.spaceName;
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
    return groups;
  }, {} as Record<string, TaskOption[]>);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Registrar Tiempo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          {/* Task */}
          <div className="space-y-2">
            <Label>
              Tarea <span className="text-destructive">*</span>
            </Label>
            <Select
              onValueChange={(value) => setValue("taskId", value)}
              value={taskId}
              disabled={loadingTasks}
            >
              <SelectTrigger className={errors.taskId ? "border-destructive" : ""}>
                <SelectValue placeholder={loadingTasks ? "Cargando tareas..." : "Seleccionar tarea"} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedTasks).map(([spaceName, spaceTasks]) => (
                  <SelectGroup key={spaceName}>
                    <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                      {spaceName}
                    </SelectLabel>
                    {spaceTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        <div className="flex flex-col">
                          <span>{task.title}</span>
                          <span className="text-xs text-muted-foreground">{task.listName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {errors.taskId && (
              <p className="text-sm text-destructive">{errors.taskId.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(date) => date && setValue("date", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Hours */}
          <div className="space-y-2">
            <Label htmlFor="hours">
              Horas <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="hours"
                type="number"
                step="0.25"
                placeholder="0"
                {...register("hours", { valueAsNumber: true })}
                className={cn(
                  "flex-1",
                  errors.hours ? "border-destructive" : ""
                )}
              />
            </div>
            {/* Quick time buttons */}
            <div className="flex gap-2 mt-2">
              {quickTimes.map((time) => (
                <Button
                  key={time}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setValue("hours", time)}
                >
                  {time}h
                </Button>
              ))}
            </div>
            {errors.hours && (
              <p className="text-sm text-destructive">{errors.hours.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="¿En qué trabajaste?"
              rows={2}
              {...register("description")}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar Tiempo"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
