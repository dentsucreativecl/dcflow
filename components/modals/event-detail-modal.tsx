"use client";

import { format } from "date-fns";
import {
  Calendar,
  Clock,
  Video,
  FolderKanban,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";

export function EventDetailModal() {
  const {
    activeModal,
    modalData,
    closeModal,
    calendarEvents,
    projects,
    deleteCalendarEvent,
    openModal,
  } = useAppStore();
  const { addToast } = useToast();

  const eventId = modalData?.eventId;
  const event = calendarEvents.find((e) => e.id === eventId);
  const project = event?.projectId
    ? projects.find((p) => p.id === event.projectId)
    : null;

  const isOpen = activeModal === "event-detail";

  const handleClose = () => {
    closeModal();
  };

  const handleDelete = () => {
    if (!eventId) return;

    openModal("confirm-delete", {
      title: "Eliminar Evento",
      message: `¿Estás seguro you want to delete "${event?.title}"? This action cannot be undone.`,
      onConfirm: () => {
        deleteCalendarEvent(eventId);
        addToast({
          title: "Event deleted",
          description: "The event has been removed from the calendar.",
          type: "success",
        });
        closeModal();
      },
    });
  };

  if (!event) return null;

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pr-8">
          <div className="flex items-start gap-3">
            <div
              className="mt-1 p-2 rounded-lg"
              style={{
                backgroundColor: project?.color
                  ? `${project.color}20`
                  : "hsl(var(--primary) / 0.1)",
              }}
            >
              <Video
                className="h-5 w-5"
                style={{
                  color: project?.color || "hsl(var(--primary))",
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold">
                {event.title}
              </DialogTitle>
              <Badge variant="outline" className="mt-1 capitalize">
                {event.type}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {format(startDate, "EEEE, MMMM d, yyyy")}
              </p>
              {!event.allDay && (
                <p className="text-sm text-muted-foreground">
                  {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                </p>
              )}
              {event.allDay && (
                <p className="text-sm text-muted-foreground">All day</p>
              )}
            </div>
          </div>

          {/* Project */}
          {project && (
            <div className="flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="font-medium">{project.name}</span>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Description
                </h4>
                <p className="text-sm">{event.description}</p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-4 mt-4 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar Evento
          </Button>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
