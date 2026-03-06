"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Clock, Video, Diamond, Flag } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const eventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().optional(),
  type: z.enum(["meeting", "milestone", "deadline"]),
  projectId: z.string().optional(),
  startDate: z.date(),
  startTime: z.string(),
  endDate: z.date(),
  endTime: z.string(),
  allDay: z.boolean(),
});

type EventFormData = z.infer<typeof eventSchema>;

export function NewEventModal() {
  const {
    activeModal,
    modalData,
    closeModal,
    projects,
    addCalendarEvent,
    addMilestone,
  } = useAppStore();
  const { addToast } = useToast();

  const selectedSlot = modalData?.selectedSlot;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "meeting",
      projectId: "",
      startDate: new Date(),
      startTime: "09:00",
      endDate: new Date(),
      endTime: "10:00",
      allDay: false,
    },
  });

  // Update form when slot is selected
  useEffect(() => {
    if (selectedSlot) {
      setValue("startDate", selectedSlot.start);
      setValue("endDate", selectedSlot.end);
      setValue("startTime", format(selectedSlot.start, "HH:mm"));
      setValue("endTime", format(selectedSlot.end, "HH:mm"));
    }
  }, [selectedSlot, setValue]);

  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const eventType = watch("type");
  const allDay = watch("allDay");

  const isOpen = activeModal === "new-event";

  const handleClose = () => {
    reset();
    closeModal();
  };

  const onSubmit = async (data: EventFormData) => {
    try {
      if (data.type === "milestone") {
        // Create milestone
        if (!data.projectId) {
          addToast({
            title: "Error",
            description: "Project is required for milestones",
            type: "error",
          });
          return;
        }

        addMilestone({
          title: data.title,
          projectId: data.projectId,
          date: format(data.startDate, "yyyy-MM-dd"),
          completed: false,
        });
      } else {
        // Create calendar event
        const startDateTime = data.allDay
          ? data.startDate.toISOString()
          : new Date(
              `${format(data.startDate, "yyyy-MM-dd")}T${data.startTime}`
            ).toISOString();

        const endDateTime = data.allDay
          ? data.endDate.toISOString()
          : new Date(
              `${format(data.endDate, "yyyy-MM-dd")}T${data.endTime}`
            ).toISOString();

        addCalendarEvent({
          title: data.title,
          description: data.description,
          type: data.type,
          projectId: data.projectId || undefined,
          start: startDateTime,
          end: endDateTime,
          allDay: data.allDay,
        });
      }

      addToast({
        title: "Evento creado",
        description: `${data.title} has been added to the calendar.`,
        type: "success",
      });

      handleClose();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        type: "error",
      });
    }
  };

  const eventTypeIcons = {
    meeting: <Video className="h-4 w-4" />,
    milestone: <Diamond className="h-4 w-4" />,
    deadline: <Flag className="h-4 w-4" />,
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Add Calendar Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Event Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Título del evento"
              {...register("title")}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Event Type & Project */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={eventType}
                onValueChange={(value: EventFormData["type"]) =>
                  setValue("type", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-blue-500" />
                      Meeting
                    </div>
                  </SelectItem>
                  <SelectItem value="milestone">
                    <div className="flex items-center gap-2">
                      <Diamond className="h-4 w-4 text-purple-500" />
                      Milestone
                    </div>
                  </SelectItem>
                  <SelectItem value="deadline">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-red-500" />
                      Deadline
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Project{" "}
                {eventType === "milestone" && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Select onValueChange={(value) => setValue("projectId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
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
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="allDay" className="cursor-pointer">
              All Day Event
            </Label>
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={(checked) => setValue("allDay", checked)}
            />
          </div>

          {/* Start Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setValue("startDate", date);
                        // Auto update end date if it's before start
                        if (endDate < date) {
                          setValue("endDate", date);
                        }
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {!allDay && (
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora de Inicio</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startTime"
                    type="time"
                    className="pl-9"
                    {...register("startTime")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* End Date/Time */}
          {eventType !== "milestone" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setValue("endDate", date)}
                      disabled={(date) => date < startDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {!allDay && (
                <div className="space-y-2">
                  <Label htmlFor="endTime">Hora de Fin</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="endTime"
                      type="time"
                      className="pl-9"
                      {...register("endTime")}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Detalles del evento..."
              rows={3}
              {...register("description")}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
