"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Lock, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TaskRelationData, isTaskBlocked, getEffectiveType } from "@/lib/dependencies";

interface Task {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  status: { id: string; name: string; color: string } | null;
  assignments: Array<{ user: { id: string; name: string; avatarUrl: string | null } }>;
  isBlocked?: boolean;
  blockedByTitles?: string[];
  subtasks?: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    startDate?: string | null;
    status: { id: string; name: string; color: string } | null;
  }>;
}

interface TimelineItem {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  taskStart: Date;
  taskEnd: Date;
  durationDays: number;
  status: { id: string; name: string; color: string } | null;
  isBlocked?: boolean;
  blockedByTitles?: string[];
  isSubtask: boolean;
  parentId?: string;
}

interface TimelineViewProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  relations?: TaskRelationData[];
  onUpdateTask?: (taskId: string, updates: { dueDate?: string }) => void;
}

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Parse ISO date string using local date components to avoid UTC-offset issues
function parseIsoDate(isoStr: string): Date {
  const [y, m, d] = isoStr.substring(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
}

const priorityColors: Record<string, string> = {
  URGENT: "#ef4444",
  HIGH: "#f97316",
  NORMAL: "#eab308",
  MEDIUM: "#eab308",
  LOW: "#3b82f6",
  NONE: "#94a3b8",
};

function getContrastText(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}
type ZoomLevel = "day" | "week" | "month";

export function TimelineView({ tasks, onTaskClick, relations = [], onUpdateTask }: TimelineViewProps) {
  const today = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const totalDays = zoom === "day" ? 14 : zoom === "week" ? 28 : 90;

  // Drag resize state
  const [resizingTask, setResizingTask] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeOriginalDue, setResizeOriginalDue] = useState<Date | null>(null);

  // Generate dates starting from current offset based on zoom level
  const dates = useMemo(() => {
    const result: Date[] = [];
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() + 1 + weekOffset * 7); // Start from Monday
    start.setHours(0, 0, 0, 0); // Normalize to local midnight
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      result.push(d);
    }
    return result;
  }, [weekOffset, totalDays]);

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  // Filter tasks that have due dates within the visible range
  // or have due dates at all (we show them on their due date with a bar going left)
  const timelineTasks = useMemo(() => {
    const items: TimelineItem[] = [];
    tasks
      .filter((t) => t.dueDate)
      .forEach((t) => {
        const due = parseIsoDate(t.dueDate!);
        const durationDays = t.estimatedHours ? Math.max(1, Math.ceil(t.estimatedHours / 8)) : 3;
        const taskStart = new Date(due);
        taskStart.setDate(due.getDate() - durationDays);
        if (due >= startDate && taskStart <= endDate) {
          items.push({
            id: t.id,
            title: t.title,
            priority: t.priority,
            dueDate: t.dueDate!,
            taskStart,
            taskEnd: due,
            durationDays,
            status: t.status,
            isBlocked: t.isBlocked,
            blockedByTitles: t.blockedByTitles,
            isSubtask: false,
          });
          // Add subtasks right after their parent
          (t.subtasks || []).filter(s => s.dueDate).forEach(s => {
            const sDue = parseIsoDate(s.dueDate!);
            const sStart = s.startDate ? parseIsoDate(s.startDate) : (() => {
              const d = new Date(sDue); d.setDate(sDue.getDate() - 1); return d;
            })();
            if (sDue >= startDate && sStart <= endDate) {
              items.push({
                id: s.id,
                title: s.title,
                priority: "NONE",
                dueDate: s.dueDate!,
                taskStart: sStart,
                taskEnd: sDue,
                durationDays: Math.max(1, Math.round((sDue.getTime() - sStart.getTime()) / (1000 * 60 * 60 * 24))),
                status: s.status,
                isSubtask: true,
                parentId: t.id,
              });
            }
          });
        }
      });
    return items;
  }, [tasks, startDate, endDate]);

  const tasksWithoutDate = tasks.filter((t) => !t.dueDate && !(t.subtasks || []).some(s => s.dueDate));

  // Calculate position and width for a task bar
  const getBarStyle = (taskStart: Date, taskEnd: Date) => {
    const startDiff = Math.max(0, (taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const endDiff = Math.min(totalDays, (taskEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1);
    const left = (startDiff / totalDays) * 100;
    const width = Math.max(2, ((endDiff - startDiff) / totalDays) * 100);
    return { left: `${left}%`, width: `${width}%` };
  };
  // Check if a date is today
  const isToday = (d: Date) => {
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  // Drag resize handlers
  const handleResizeStart = (e: React.MouseEvent, taskId: string, currentDueDate: Date) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingTask(taskId);
    setResizeStartX(e.clientX);
    setResizeOriginalDue(new Date(currentDueDate));
  };

  useEffect(() => {
    if (!resizingTask) return;

    const handleMouseMove = (_e: MouseEvent) => {
      // Visual feedback could be added here in the future
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (resizingTask && resizeOriginalDue) {
        const containerEl = document.querySelector(".timeline-container");
        const containerWidth = containerEl?.clientWidth || 800;
        const dayWidth = containerWidth / totalDays;
        const dayOffset = Math.round((e.clientX - resizeStartX) / dayWidth);
        if (dayOffset !== 0) {
          const newDue = new Date(resizeOriginalDue);
          newDue.setDate(newDue.getDate() + dayOffset);
          onUpdateTask?.(resizingTask, { dueDate: newDue.toISOString() });
        }
      }
      setResizingTask(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingTask, resizeStartX, resizeOriginalDue, totalDays, onUpdateTask]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset - 4)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold text-foreground min-w-[280px] text-center">
            {startDate.getDate()} {MONTHS_SHORT[startDate.getMonth()]} - {endDate.getDate()} {MONTHS_SHORT[endDate.getMonth()]} {endDate.getFullYear()}
          </h3>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(weekOffset + 4)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>
            Hoy
          </Button>
          <div className="flex items-center gap-0.5 ml-2 border rounded-md">
            <Button
              variant={zoom === "day" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2 rounded-r-none"
              onClick={() => setZoom("day")}
            >
              D
            </Button>
            <Button
              variant={zoom === "week" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2 rounded-none border-x"
              onClick={() => setZoom("week")}
            >
              S
            </Button>
            <Button
              variant={zoom === "month" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2 rounded-l-none"
              onClick={() => setZoom("month")}
            >
              M
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{timelineTasks.length} tarea{timelineTasks.length !== 1 ? "s" : ""} en rango</span>
          {tasksWithoutDate.length > 0 && (
            <span>{tasksWithoutDate.length} sin fecha</span>
          )}
        </div>
      </div>
      {/* Timeline Header - Date columns */}
      <div className="border border-border rounded-t-lg overflow-hidden">
        <div className="flex bg-muted/30">
          {/* Task name column */}
          <div className="w-[220px] min-w-[220px] px-3 py-2 border-r border-border text-xs font-medium text-muted-foreground">
            Tarea
          </div>
          {/* Date columns */}
          <div className="flex-1 flex">
            {dates.map((d, i) => {
              const showMonth = i === 0 || d.getDate() === 1;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 text-center py-1 border-r border-border/50 text-[10px]",
                    isWeekend && "bg-muted/30",
                    isToday(d) && "bg-primary/10"
                  )}
                >
                  {showMonth && (
                    <div className="font-semibold text-foreground">{MONTHS_SHORT[d.getMonth()]}</div>
                  )}
                  <div className={cn(
                    "text-muted-foreground",
                    isToday(d) && "font-bold text-primary"
                  )}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Task Rows */}
        <div className="relative">
          <div className="divide-y divide-border">
            {timelineTasks.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>No hay tareas con fecha en este rango</p>
                  <p className="text-xs mt-1">Ajusta el rango o agrega fechas a tus tareas</p>
                </div>
              </div>
            ) : (
              timelineTasks.map((task) => {
                const barStyle = getBarStyle(task.taskStart, task.taskEnd);
                const isOverdue = task.taskEnd < today;
                const statusColor = task.status?.color || "#94a3b8";
                return (
                  <div key={task.id} className={cn("flex hover:bg-muted/20 transition-colors group", task.isSubtask && "bg-muted/10")}>
                    {/* Task Info */}
                    <div
                      className={cn(
                        "w-[220px] min-w-[220px] px-3 py-2 border-r border-border flex items-center gap-2 cursor-pointer",
                        task.isSubtask && "pl-6"
                      )}
                      onClick={() => onTaskClick?.(task.id)}
                    >
                      <span
                        className={cn("rounded-full flex-shrink-0", task.isSubtask ? "h-1.5 w-1.5" : "h-2 w-2")}
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className={cn("text-foreground truncate group-hover:text-primary transition-colors", task.isSubtask ? "text-xs text-muted-foreground" : "text-sm")}>
                        {task.title}
                      </span>
                    </div>

                    {/* Timeline Bar */}
                    <div className="flex-1 relative py-2 timeline-container">
                      {/* Background grid lines */}
                      <div className="absolute inset-0 flex">
                        {dates.map((d, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex-1 border-r border-border/30",
                              (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/20",
                              isToday(d) && "bg-primary/5"
                            )}
                          />
                        ))}
                      </div>

                      {/* Task Bar */}
                      <div
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 rounded-md cursor-pointer group/bar",
                          "hover:shadow-md transition-shadow flex items-center px-2 overflow-hidden",
                          task.isSubtask ? "h-4 opacity-75" : "h-6",
                          isOverdue && "opacity-60",
                          task.isBlocked && "opacity-70"
                        )}
                        style={{
                          left: barStyle.left,
                          width: barStyle.width,
                          backgroundColor: statusColor,
                          background: task.isBlocked
                            ? `repeating-linear-gradient(45deg, ${statusColor}cc, ${statusColor}cc 4px, ${statusColor}88 4px, ${statusColor}88 8px)`
                            : statusColor,
                          borderColor: task.isBlocked ? statusColor : undefined,
                          borderWidth: task.isBlocked ? "1px" : undefined,
                          borderStyle: task.isBlocked ? "solid" : undefined,
                          minWidth: "20px",
                        }}
                        onClick={() => onTaskClick?.(task.id)}
                        title={task.isBlocked
                          ? `${task.title} - Bloqueada por: ${task.blockedByTitles?.join(", ") || "otra tarea"}`
                          : `${task.title} (${task.durationDays}d)`
                        }
                      >
                        <span
                          className="text-[10px] font-medium truncate flex items-center gap-0.5"
                          style={{ color: getContrastText(statusColor.startsWith("#") ? statusColor : "#94a3b8") }}
                        >
                          {task.isBlocked && <Lock className="h-2.5 w-2.5 flex-shrink-0" />}
                          {task.title}
                        </span>
                        {onUpdateTask && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/40 rounded-r-md transition-opacity"
                            onMouseDown={(e) => handleResizeStart(e, task.id, task.taskEnd)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dependency Arrows SVG Overlay */}
          {relations && relations.length > 0 && timelineTasks.length > 0 && (
            <svg
              className="absolute top-0 left-[220px] right-0 pointer-events-none"
              style={{ height: `${timelineTasks.length * 41}px` }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="currentColor" className="text-destructive" />
                </marker>
              </defs>
              {relations
                .filter(r => r.type === "BLOCKS")
                .map(rel => {
                  const sourceIdx = timelineTasks.findIndex(t => t.id === rel.sourceTaskId);
                  const targetIdx = timelineTasks.findIndex(t => t.id === rel.targetTaskId);
                  if (sourceIdx === -1 || targetIdx === -1) return null;

                  const sourceTask = timelineTasks[sourceIdx];
                  const targetTask = timelineTasks[targetIdx];
                  const sourceBar = getBarStyle(sourceTask.taskStart, sourceTask.taskEnd);
                  const targetBar = getBarStyle(targetTask.taskStart, targetTask.taskEnd);

                  const ROW_HEIGHT = 41;
                  const y1 = sourceIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const y2 = targetIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                  // Parse percentage to get x positions
                  const x1 = parseFloat(sourceBar.left) + parseFloat(sourceBar.width);
                  const x2 = parseFloat(targetBar.left);

                  // Convert percentages to SVG coordinates
                  const svgX1 = `${x1}%`;
                  const svgX2 = `${x2}%`;
                  const midX = `${(x1 + x2) / 2}%`;

                  return (
                    <path
                      key={rel.id}
                      d={`M ${svgX1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${svgX2} ${y2}`}
                      fill="none"
                      stroke="hsl(var(--destructive))"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                      markerEnd="url(#arrowhead)"
                      opacity="0.6"
                    />
                  );
                })}
            </svg>
          )}
        </div>
      </div>

      {/* Today marker legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-primary/20 border border-primary/30" />
          <span>Hoy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-muted/40" />
          <span>Fin de semana</span>
        </div>
      </div>
    </div>
  );
}