"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Circle, Clock,
  LayoutList, LayoutGrid,
} from "lucide-react";
import { TaskRow, type TaskRowData } from "@/components/features/task-row";

export default function MyTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const { openModal } = useAppStore();
  const [tasks, setTasks] = useState<TaskRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [filterStatus, setFilterStatus] = useState<"all" | "todo" | "in_progress" | "done">("all");

  useEffect(() => {
    // Wait for auth to resolve before fetching
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    let cancelled = false;

    // 10-second safety net — stop spinner even if fetch hangs
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 10000);

    async function fetchMyTasks() {
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("TaskAssignment")
          .select(`
            task:Task(
              id, title, description, priority, dueDate, completedAt,
              status:Status(id, name, color, type),
              list:List(id, name, space:Space(name, color))
            )
          `)
          .eq("userId", user!.id);

        if (error) throw error;

        if (data && !cancelled) {
          const mapped = data
            .map((row: Record<string, unknown>) => {
              const rawTask = row.task as Record<string, unknown> | Record<string, unknown>[] | null;
              const t = Array.isArray(rawTask) ? rawTask[0] : rawTask;
              if (!t) return null;
              const rawStatus = t.status as Record<string, unknown> | Record<string, unknown>[] | null;
              const rawList = t.list as Record<string, unknown> | null;
              const rawSpace = rawList?.space as Record<string, unknown> | Record<string, unknown>[] | null;
              return {
                id: t.id as string,
                title: t.title as string,
                description: t.description as string | null,
                priority: (t.priority as string) || "NONE",
                dueDate: t.dueDate as string | null,
                completedAt: t.completedAt as string | null,
                status: Array.isArray(rawStatus) ? rawStatus[0] : rawStatus,
                list: rawList ? {
                  id: rawList.id as string,
                  name: rawList.name as string,
                  space: Array.isArray(rawSpace) ? rawSpace[0] : rawSpace,
                } : null,
              } as TaskRowData;
            })
            .filter(Boolean) as TaskRowData[];
          setTasks(mapped);
        }
      } catch {
        // silently fail — finally will clear loading
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    }
    fetchMyTasks();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [user, authLoading]);

  const filteredTasks = useMemo(() => {
    if (filterStatus === "all") return tasks;
    return tasks.filter((t) => {
      const statusType = t.status?.type?.toUpperCase() || "TODO";
      if (filterStatus === "todo") return statusType === "TODO";
      if (filterStatus === "in_progress") return statusType === "IN_PROGRESS";
      if (filterStatus === "done") return statusType === "DONE";
      return true;
    });
  }, [tasks, filterStatus]);

  // Group by status type
  const grouped = useMemo(() => {
    const groups: Record<string, TaskRowData[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    filteredTasks.forEach((t) => {
      const type = t.status?.type?.toUpperCase() || "TODO";
      if (!groups[type]) groups[type] = [];
      groups[type].push(t);
    });
    return groups;
  }, [filteredTasks]);

  const groupLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    TODO: { label: "Por hacer", icon: Circle, color: "text-slate-500" },
    IN_PROGRESS: { label: "En Progreso", icon: Clock, color: "text-blue-500" },
    DONE: { label: "Completadas", icon: CheckCircle2, color: "text-green-500" },
  };

  const overdueTasks = tasks.filter((t) => {
    if (!t.dueDate || t.status?.type?.toUpperCase() === "DONE") return false;
    return new Date(t.dueDate) < new Date();
  });

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis Tareas</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} tarea{tasks.length !== 1 ? "s" : ""} asignada{tasks.length !== 1 ? "s" : ""}
            {overdueTasks.length > 0 && (
              <span className="text-destructive ml-2">
                · {overdueTasks.length} vencida{overdueTasks.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="sm" className="rounded-none"
              onClick={() => setViewMode("grouped")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm" className="rounded-none"
              onClick={() => setViewMode("list")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {([
          { key: "all", label: "Todas" },
          { key: "todo", label: "Por hacer" },
          { key: "in_progress", label: "En Progreso" },
          { key: "done", label: "Completadas" },
        ] as const).map((tab) => (
          <Button
            key={tab.key}
            variant={filterStatus === tab.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(tab.key)}
            className="text-xs"
          >
            {tab.label}
            {tab.key === "all" && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {tasks.length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No hay tareas</p>
            <p className="text-sm">{filterStatus === "all" ? "No tienes tareas asignadas aún" : "No hay tareas en esta categoría"}</p>
          </div>
        ) : viewMode === "grouped" ? (
          <div className="space-y-6">
            {(["TODO", "IN_PROGRESS", "DONE"] as const).map((groupKey) => {
              const groupTasks = grouped[groupKey] || [];
              if (groupTasks.length === 0) return null;
              const { label, icon: Icon, color } = groupLabels[groupKey];
              return (
                <div key={groupKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn("h-4 w-4", color)} />
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <Badge variant="secondary" className="text-xs h-5">{groupTasks.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {groupTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onClick={() => openModal("task-detail-v2", { taskId: task.id })} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} onClick={() => openModal("task-detail-v2", { taskId: task.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
