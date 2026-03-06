"use client";

import { useState, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views, SlotInfo, View } from "react-big-calendar";
import withDragAndDrop, {
  EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, addHours, isSameDay } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Flag,
  Diamond,
  Users,
  FolderKanban,
  X,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

// date-fns localizer for react-big-calendar
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEventItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: "task" | "deadline" | "milestone" | "meeting";
  projectId?: string;
  projectColor?: string;
  assigneeId?: string;
  allDay?: boolean;
  originalId?: string;
}

type ViewType = "month" | "week" | "day" | "agenda";

// Drag and Drop Calendar
const DnDCalendar = withDragAndDrop(Calendar);

export function ProjectCalendar() {
  const {
    tasks,
    projects,
    teamMembers,
    calendarEvents,
    milestones,
    updateCalendarEvent,
    updateTask,
    openModal,
  } = useAppStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("month");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterMember, setFilterMember] = useState<string>("all");

  // Convert all data to calendar events
  const events = useMemo<CalendarEventItem[]>(() => {
    const calendarItems: CalendarEventItem[] = [];

    // Add task due dates
    tasks.forEach((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      const dueDate = new Date(task.dueDate);

      // Apply filters
      if (filterProject !== "all" && task.projectId !== filterProject) return;
      if (filterMember !== "all" && task.assignee?.id !== filterMember) return;

      calendarItems.push({
        id: `task-${task.id}`,
        originalId: task.id,
        title: task.title,
        start: dueDate,
        end: addHours(dueDate, 1),
        type: "task",
        projectId: task.projectId,
        projectColor: project?.color,
        assigneeId: task.assignee?.id,
        allDay: true,
      });
    });

    // Add project deadlines
    projects.forEach((project) => {
      if (filterProject !== "all" && project.id !== filterProject) return;

      const dueDate = new Date(project.dueDate);

      calendarItems.push({
        id: `deadline-${project.id}`,
        originalId: project.id,
        title: `${project.name}`,
        start: dueDate,
        end: addHours(dueDate, 1),
        type: "deadline",
        projectId: project.id,
        projectColor: project.color,
        allDay: true,
      });
    });

    // Add milestones
    milestones.forEach((milestone) => {
      const project = projects.find((p) => p.id === milestone.projectId);
      if (filterProject !== "all" && milestone.projectId !== filterProject) return;

      const date = new Date(milestone.date);

      calendarItems.push({
        id: `milestone-${milestone.id}`,
        originalId: milestone.id,
        title: milestone.title,
        start: date,
        end: addHours(date, 1),
        type: "milestone",
        projectId: milestone.projectId,
        projectColor: project?.color,
        allDay: true,
      });
    });

    // Add calendar events (meetings, etc.)
    calendarEvents.forEach((event) => {
      const project = event.projectId
        ? projects.find((p) => p.id === event.projectId)
        : null;

      if (filterProject !== "all" && event.projectId !== filterProject) return;
      if (filterMember !== "all" && event.assigneeId !== filterMember) return;

      calendarItems.push({
        id: event.id,
        originalId: event.id,
        title: event.title,
        start: new Date(event.start),
        end: new Date(event.end),
        type: event.type,
        projectId: event.projectId,
        projectColor: project?.color || event.color,
        assigneeId: event.assigneeId,
        allDay: event.allDay,
      });
    });

    return calendarItems;
  }, [tasks, projects, milestones, calendarEvents, filterProject, filterMember]);

  // Handle event selection
  const handleSelectEvent = useCallback(
    (event: CalendarEventItem) => {
      if (event.type === "task" && event.originalId) {
        openModal("task-detail-v2", { taskId: event.originalId });
      } else if (event.type === "deadline" && event.projectId) {
        openModal("project-detail", { projectId: event.projectId });
      } else if (event.type === "meeting" && event.originalId) {
        openModal("event-detail", { eventId: event.originalId });
      }
    },
    [openModal]
  );

  // Handle slot selection (click on day/time)
  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      openModal("new-event", {
        selectedSlot: { start: slotInfo.start, end: slotInfo.end },
      });
    },
    [openModal]
  );

  // Handle event drag and drop
  const handleEventDrop = useCallback(
    ({ event, start, end }: EventInteractionArgs<object>) => {
      const calEvent = event as CalendarEventItem;
      if (calEvent.type === "meeting" && calEvent.originalId) {
        updateCalendarEvent(calEvent.originalId, {
          start: (start as Date).toISOString(),
          end: (end as Date).toISOString(),
        });
      } else if (calEvent.type === "task" && calEvent.originalId) {
        updateTask(calEvent.originalId, {
          dueDate: format(start as Date, "yyyy-MM-dd"),
        });
      }
    },
    [updateCalendarEvent, updateTask]
  );

  // Handle event resize
  const handleEventResize = useCallback(
    ({ event, start, end }: EventInteractionArgs<object>) => {
      const calEvent = event as CalendarEventItem;
      if (calEvent.type === "meeting" && calEvent.originalId) {
        updateCalendarEvent(calEvent.originalId, {
          start: (start as Date).toISOString(),
          end: (end as Date).toISOString(),
        });
      }
    },
    [updateCalendarEvent]
  );

  const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
    const current = new Date(currentDate);
    switch (action) {
      case "PREV":
        if (view === "month") {
          current.setMonth(current.getMonth() - 1);
        } else if (view === "week") {
          current.setDate(current.getDate() - 7);
        } else {
          current.setDate(current.getDate() - 1);
        }
        break;
      case "NEXT":
        if (view === "month") {
          current.setMonth(current.getMonth() + 1);
        } else if (view === "week") {
          current.setDate(current.getDate() + 7);
        } else {
          current.setDate(current.getDate() + 1);
        }
        break;
      case "TODAY":
        setCurrentDate(new Date());
        return;
    }
    setCurrentDate(current);
  };

  // Custom event component with different styles per type
  const EventComponent = ({ event }: { event: CalendarEventItem }) => {
    const baseColor = event.projectColor || "hsl(var(--primary))";

    // Milestone - Diamond shape
    if (event.type === "milestone") {
      return (
        <div className="flex items-center gap-1 px-1">
          <Diamond
            className="h-3 w-3 flex-shrink-0"
            style={{ color: baseColor, fill: baseColor }}
          />
          <span
            className="text-xs font-semibold truncate"
            style={{ color: baseColor }}
          >
            {event.title}
          </span>
        </div>
      );
    }

    // Deadline - Flag
    if (event.type === "deadline") {
      return (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{
            backgroundColor: `${baseColor}20`,
            borderLeft: `3px solid ${baseColor}`,
          }}
        >
          <Flag
            className="h-3 w-3 flex-shrink-0"
            style={{ color: baseColor, fill: baseColor }}
          />
          <span
            className="text-xs font-bold truncate"
            style={{ color: baseColor }}
          >
            {event.title}
          </span>
        </div>
      );
    }

    // Meeting - Video icon
    if (event.type === "meeting") {
      return (
        <div
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{
            backgroundColor: `${baseColor}30`,
            borderLeft: `3px solid ${baseColor}`,
          }}
        >
          <Video className="h-3 w-3 flex-shrink-0" style={{ color: baseColor }} />
          <span
            className="text-xs font-medium truncate"
            style={{ color: baseColor }}
          >
            {event.title}
          </span>
        </div>
      );
    }

    // Task - Default style
    return (
      <div
        className="rounded px-2 py-1 text-xs font-medium truncate"
        style={{
          backgroundColor: `${baseColor}20`,
          color: baseColor,
          borderLeft: `3px solid ${baseColor}`,
        }}
      >
        {event.title}
      </div>
    );
  };

  // Custom toolbar
  const CustomToolbar = () => (
    <div className="flex flex-col gap-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigate("PREV")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => handleNavigate("TODAY")}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigate("NEXT")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground ml-2">
{currentDate.toLocaleDateString("es-ES", view === "day" ? { month: "long", day: "numeric", year: "numeric" } : { month: "long", year: "numeric" })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
{{ month: "Mes", week: "Semana", day: "Día" }[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos los Proyectos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Proyectos</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos los Miembros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Miembros</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(filterProject !== "all" || filterMember !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterProject("all");
              setFilterMember("all");
            }}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar filtros
          </Button>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Diamond className="h-3 w-3 fill-purple-500 text-purple-500" />
            <span>Hito</span>
          </div>
          <div className="flex items-center gap-1">
            <Flag className="h-3 w-3 fill-red-500 text-red-500" />
            <span>Fecha límite</span>
          </div>
          <div className="flex items-center gap-1">
            <Video className="h-3 w-3 text-blue-500" />
            <span>Reunión</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary/30" />
            <span>Tarea</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Custom day prop getter for styling
  const dayPropGetter = (date: Date) => {
    const isToday = isSameDay(date, new Date());
    return {
      style: {
        backgroundColor: isToday ? "hsl(var(--primary) / 0.1)" : undefined,
      },
    };
  };

  // Event prop getter for drag styles
  const eventPropGetter = () => ({
    style: {
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
    },
  });

  return (
    <div className="h-full flex flex-col">
      <CustomToolbar />
      <Card className="flex-1 p-4 overflow-hidden">
        <style>{`
          .rbc-calendar {
            height: 100%;
          }
          .rbc-header {
            padding: 12px 8px;
            font-weight: 600;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
            border-bottom: 1px solid hsl(var(--border));
          }
          .rbc-month-view, .rbc-time-view {
            border: 1px solid hsl(var(--border));
            border-radius: 8px;
            overflow: hidden;
          }
          .rbc-day-bg {
            background: hsl(var(--card));
            cursor: pointer;
          }
          .rbc-day-bg:hover {
            background: hsl(var(--muted) / 0.5);
          }
          .rbc-off-range-bg {
            background: hsl(var(--muted) / 0.3);
          }
          .rbc-today {
            background: hsl(var(--primary) / 0.1) !important;
          }
          .rbc-date-cell {
            padding: 4px 8px;
            text-align: right;
          }
          .rbc-date-cell > a {
            color: hsl(var(--foreground));
            font-size: 13px;
          }
          .rbc-off-range > a {
            color: hsl(var(--muted-foreground));
          }
          .rbc-row-segment {
            padding: 0 4px 2px;
          }
          .rbc-event {
            padding: 0;
            background: transparent !important;
            border: none !important;
          }
          .rbc-event:focus {
            outline: none;
          }
          .rbc-event-content {
            overflow: visible;
          }
          .rbc-show-more {
            color: hsl(var(--primary));
            font-size: 12px;
            font-weight: 500;
            padding: 2px 4px;
          }
          .rbc-month-row {
            border-top: 1px solid hsl(var(--border));
          }
          .rbc-day-slot .rbc-time-slot {
            border-top: 1px solid hsl(var(--border) / 0.5);
          }
          .rbc-timeslot-group {
            border-left: 1px solid hsl(var(--border));
          }
          .rbc-time-header-content {
            border-left: 1px solid hsl(var(--border));
          }
          .rbc-time-content {
            border-top: 1px solid hsl(var(--border));
          }
          .rbc-time-gutter {
            color: hsl(var(--muted-foreground));
            font-size: 11px;
          }
          .rbc-agenda-view table {
            width: 100%;
          }
          .rbc-agenda-view th, .rbc-agenda-view td {
            padding: 12px;
            border-bottom: 1px solid hsl(var(--border));
          }
          .rbc-agenda-date-cell {
            color: hsl(var(--foreground));
            font-weight: 500;
          }
          .rbc-agenda-time-cell {
            color: hsl(var(--muted-foreground));
            font-size: 13px;
          }
          .rbc-agenda-event-cell {
            color: hsl(var(--foreground));
          }
          .rbc-addons-dnd .rbc-addons-dnd-resize-ns-anchor {
            display: none;
          }
          .rbc-addons-dnd-dragged-event {
            opacity: 0.5;
          }
          .rbc-addons-dnd .rbc-addons-dnd-drag-preview {
            opacity: 0.8;
            border-radius: 4px;
          }
          .rbc-current-time-indicator {
            background-color: hsl(var(--destructive));
            height: 2px;
          }
          .rbc-current-time-indicator::before {
            content: '';
            position: absolute;
            left: -5px;
            top: -4px;
            width: 10px;
            height: 10px;
            background-color: hsl(var(--destructive));
            border-radius: 50%;
          }
        `}</style>
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor={(event: object) => (event as CalendarEventItem).start}
          endAccessor={(event: object) => (event as CalendarEventItem).end}
          date={currentDate}
          view={view}
          onView={(v: View) => setView(v as ViewType)}
          onNavigate={(date: Date) => setCurrentDate(date)}
          onSelectEvent={(event: object) => handleSelectEvent(event as CalendarEventItem)}
          onSelectSlot={handleSelectSlot}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          components={{
            event: ({ event }: { event: object }) => (
              <EventComponent event={event as CalendarEventItem} />
            ),
          }}
          dayPropGetter={dayPropGetter}
          eventPropGetter={eventPropGetter}
          views={["month", "week", "day", "agenda"]}
          toolbar={false}
          popup
          selectable
          resizable
          draggableAccessor={() => true}
        />
      </Card>
    </div>
  );
}
