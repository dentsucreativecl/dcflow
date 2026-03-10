"use client";

import { useState, useEffect, useCallback } from "react";
import { format, differenceInDays, addDays } from "date-fns";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ProjectTimelineTabProps {
  projectId: string;
}

interface TimelineTask {
  id: string;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
  statusType: string;
  assigneeName: string | null;
  assigneeInitials: string;
}

interface ProjectDates {
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export function ProjectTimelineTab({ projectId }: ProjectTimelineTabProps) {
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [projectDates, setProjectDates] = useState<ProjectDates | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    // Fetch project dates
    const { data: listData } = await supabase
      .from("List")
      .select("startDate, endDate, createdAt")
      .eq("id", projectId)
      .single();

    if (listData) {
      setProjectDates(listData as ProjectDates);
    }

    // Fetch tasks with status and first assignee
    const { data: taskData } = await supabase
      .from("Task")
      .select("id, title, dueDate, completedAt, Status:statusId(type), TaskAssignment(User:userId(name))")
      .eq("listId", projectId)
      .order("dueDate", { ascending: true, nullsFirst: false });

    const parsed: TimelineTask[] = (taskData || []).map((t: any) => {
      const status = Array.isArray(t.Status) ? t.Status[0] : t.Status;
      const firstAssignment = (t.TaskAssignment || [])[0];
      const user = firstAssignment ? (Array.isArray(firstAssignment.User) ? firstAssignment.User[0] : firstAssignment.User) : null;
      const name = user?.name || null;
      return {
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        statusType: status?.type || "TODO",
        assigneeName: name,
        assigneeInitials: name ? name.split(" ").map((n: string) => n[0]).join("").slice(0, 2) : "",
      };
    });

    setTasks(parsed);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const startDate = projectDates?.startDate
    ? new Date(projectDates.startDate)
    : new Date(projectDates?.createdAt || new Date());
  const endDate = projectDates?.endDate
    ? new Date(projectDates.endDate)
    : addDays(new Date(), 30);
  const totalDays = Math.max(differenceInDays(endDate, startDate), 1);
  const daysElapsed = differenceInDays(new Date(), startDate);
  const progressPercent = Math.min(Math.max(Math.round((daysElapsed / totalDays) * 100), 0), 100);

  // Tasks with due dates for timeline
  const tasksWithDates = tasks.filter((t) => t.dueDate);

  return (
    <div className="space-y-6">
      {/* Timeline Overview */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">Línea de Tiempo</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">Inicio: </span>
              <span className="font-medium text-foreground">
                {format(startDate, "MMM d, yyyy")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Fin: </span>
              <span className="font-medium text-foreground">
                {format(endDate, "MMM d, yyyy")}
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div
              className="absolute top-0 h-3 w-0.5 bg-foreground"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {Math.max(daysElapsed, 0)} días transcurridos
            </span>
            <span className="text-muted-foreground">
              {Math.max(totalDays - daysElapsed, 0)} días restantes
            </span>
          </div>
        </div>
      </Card>

      {/* Task Timeline */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">
          Tareas Programadas ({tasksWithDates.length})
        </h3>
        {tasksWithDates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin tareas con fecha asignada
          </p>
        ) : (
          <div className="space-y-3">
            {tasksWithDates.map((task) => {
              const dueDate = new Date(task.dueDate!);
              const daysUntilDue = differenceInDays(dueDate, new Date());
              const isDone = task.statusType === "DONE";
              const isOverdue = daysUntilDue < 0 && !isDone;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-3",
                    isOverdue ? "border-studio-error/50 bg-studio-error/5" : "border-border"
                  )}
                >
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-studio-success" />
                    ) : isOverdue ? (
                      <AlertCircle className="h-5 w-5 text-studio-error" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        isDone
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      )}
                    >
                      {task.title}
                    </p>
                  </div>
                  {task.assigneeName && (
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                        {task.assigneeInitials}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(dueDate, "MMM d")}
                  </div>
                  {isOverdue && (
                    <Badge className="bg-studio-error/20 text-studio-error">
                      Vencida
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
