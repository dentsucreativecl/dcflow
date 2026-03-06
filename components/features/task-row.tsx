"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, AlertTriangle, Calendar, ChevronRight } from "lucide-react";

export interface TaskRowData {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  completedAt?: string | null;
  status: { id: string; name: string; color: string; type: string } | null;
  list: { id: string; name: string; space: { name: string; color: string } | null } | null;
}

export const priorityConfig: Record<string, { label: string; color: string; icon: string }> = {
  URGENT: { label: "Urgente", color: "text-red-500 bg-red-50 dark:bg-red-950", icon: "!!" },
  HIGH: { label: "Alta", color: "text-orange-500 bg-orange-50 dark:bg-orange-950", icon: "!" },
  NORMAL: { label: "Media", color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950", icon: "•" },
  MEDIUM: { label: "Media", color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950", icon: "•" },
  LOW: { label: "Baja", color: "text-blue-500 bg-blue-50 dark:bg-blue-950", icon: "↓" },
  NONE: { label: "Sin prioridad", color: "text-slate-400 bg-slate-50 dark:bg-slate-900", icon: "-" },
};

interface TaskRowProps {
  task: TaskRowData;
  onClick: () => void;
}

export function TaskRow({ task, onClick }: TaskRowProps) {
  const isOverdue = task.dueDate && task.status?.type?.toUpperCase() !== "DONE" && new Date(task.dueDate) < new Date();
  const prio = priorityConfig[task.priority] || priorityConfig.NONE;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
    >
      {/* Status indicator */}
      <div
        className="h-3 w-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: task.status?.color || "#94a3b8" }}
        title={task.status?.name || "Sin estado"}
      />

      {/* Task title + breadcrumb */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors" title={task.title}>
          {task.title}
        </p>
        {task.list && (
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
            {task.list.space && (
              <>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.list.space.color }} />
                <span>{task.list.space.name}</span>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span>{task.list.name}</span>
          </p>
        )}
      </div>

      {/* Priority */}
      <Badge variant="outline" className={cn("text-[10px] h-5", prio.color)}>
        {prio.label}
      </Badge>

      {/* Due date */}
      {task.dueDate && (
        <div className={cn(
          "flex items-center gap-1 text-xs",
          isOverdue ? "text-destructive" : "text-muted-foreground"
        )}>
          {isOverdue && <AlertTriangle className="h-3 w-3" />}
          <Calendar className="h-3 w-3" />
          <span>
            {new Date(task.dueDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
          </span>
        </div>
      )}

      {/* Status badge */}
      {task.status && (
        <Badge
          variant="secondary"
          className="text-[10px] h-5"
          style={{ backgroundColor: task.status.color + "20", color: task.status.color }}
        >
          {task.status.name}
        </Badge>
      )}
    </div>
  );
}
