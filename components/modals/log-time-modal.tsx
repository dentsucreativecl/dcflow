"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const logTimeSchema = z.object({
  projectId: z.string().min(1, "El proyecto es requerido"),
  taskId: z.string().optional(),
  date: z.date(),
  hours: z.number().min(0.25, "Mínimo 15 minutos").max(24, "Máximo 24 horas"),
  description: z.string().optional(),
  billable: z.boolean(),
});

type LogTimeFormData = z.infer<typeof logTimeSchema>;

export function LogTimeModal() {
  const { activeModal, closeModal, projects, tasks, updateTask } = useAppStore();
  const { addToast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

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
      projectId: "",
      taskId: "",
      date: new Date(),
      hours: 1,
      description: "",
      billable: true,
    },
  });

  const date = watch("date");
  const projectId = watch("projectId");

  // Filter tasks by selected project
  const filteredTasks = tasks.filter((task) => task.projectId === projectId);

  const isOpen = activeModal === "log-time";

  useEffect(() => {
    if (projectId !== selectedProjectId) {
      setSelectedProjectId(projectId);
      setValue("taskId", ""); // Reset task when project changes
    }
  }, [projectId, selectedProjectId, setValue]);

  const handleClose = () => {
    reset();
    setSelectedProjectId("");
    closeModal();
  };

  const onSubmit = async (data: LogTimeFormData) => {
    try {
      // If task is selected, update the task's logged hours
      if (data.taskId) {
        const task = tasks.find((t) => t.id === data.taskId);
        if (task) {
          updateTask(data.taskId, {
            loggedHours: task.loggedHours + data.hours,
          });
        }
      }

      addToast({
        title: "Tiempo registrado",
        description: `${data.hours} horas registradas exitosamente.`,
        type: "success",
      });

      handleClose();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Error al registrar tiempo. Inténtalo de nuevo.",
        type: "error",
      });
    }
  };

  // Quick time buttons
  const quickTimes = [0.5, 1, 2, 4, 8];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Registrar Tiempo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          {/* Project */}
          <div className="space-y-2">
            <Label>
              Proyecto <span className="text-destructive">*</span>
            </Label>
            <Select onValueChange={(value) => setValue("projectId", value)}>
              <SelectTrigger
                className={errors.projectId ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.projectId && (
              <p className="text-sm text-destructive">
                {errors.projectId.message}
              </p>
            )}
          </div>

          {/* Task (optional, filtered by project) */}
          <div className="space-y-2">
            <Label>Tarea (opcional)</Label>
            <Select
              disabled={!projectId || filteredTasks.length === 0}
              onValueChange={(value) => setValue("taskId", value)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !projectId
                      ? "Selecciona un proyecto primero"
                      : filteredTasks.length === 0
                      ? "No hay tareas en este proyecto"
                      : "Seleccionar tarea"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  {date ? format(date, "PPP") : "Seleccionar fecha"}
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

          {/* Billable */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="billable"
              defaultChecked
              onCheckedChange={(checked) =>
                setValue("billable", checked as boolean)
              }
            />
            <Label htmlFor="billable" className="cursor-pointer">
              Tiempo facturable
            </Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar Tiempo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
