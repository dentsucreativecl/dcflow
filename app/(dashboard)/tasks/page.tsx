"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, List, Kanban, Loader2, Calendar, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterDropdown } from "@/components/features/filter-dropdown";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface TaskRow {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  statusName: string;
  statusColor: string;
  statusType: string;
  listName: string;
  spaceName: string;
  spaceColor: string;
  assignees: { id: string; name: string }[];
  estimatedHours: number | null;
}

type ViewMode = "kanban" | "list";

const priorityColors: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-blue-500/20 text-blue-500",
  HIGH: "bg-amber-500/20 text-amber-500",
  URGENT: "bg-red-500/20 text-red-500",
};

const priorityLabels: Record<string, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const statusTypeColumns = [
  { type: "TODO", title: "Por Hacer", color: "bg-muted-foreground" },
  { type: "IN_PROGRESS", title: "En Progreso", color: "bg-blue-500" },
  { type: "DONE", title: "Completado", color: "bg-emerald-500" },
];

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function isOverdue(dateStr: string | null, statusType: string): boolean {
  if (!dateStr || statusType === "DONE") return false;
  return new Date(dateStr) < new Date();
}

export default function TasksPage() {
  const { openModal } = useAppStore();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [spaceFilter, setSpaceFilter] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    async function fetchTasks() {
      const supabase = createClient();

      const { data } = await supabase
        .from("Task")
        .select(`
          id, title, priority, dueDate, estimatedHours,
          Status(name, color, type),
          List(name, Space(name, color)),
          TaskAssignment(User(id, name))
        `)
        .is("parentId", null)
        .order("createdAt", { ascending: false });

      if (data && !cancelled) {
        const mapped: TaskRow[] = data.map((t: Record<string, unknown>) => {
          const status = t.Status as Record<string, unknown> | null;
          const list = t.List as Record<string, unknown> | null;
          const space = list?.Space as Record<string, unknown> | null;
          const assignments = (t.TaskAssignment || []) as Array<Record<string, unknown>>;

          return {
            id: t.id as string,
            title: t.title as string,
            priority: t.priority as string,
            dueDate: t.dueDate as string | null,
            statusName: (status?.name as string) || "Sin estado",
            statusColor: (status?.color as string) || "#DFE1E6",
            statusType: (status?.type as string) || "TODO",
            listName: (list?.name as string) || "",
            spaceName: (space?.name as string) || "",
            spaceColor: (space?.color as string) || "#666",
            assignees: assignments.map((a) => {
              const user = a.User as Record<string, unknown>;
              return { id: user.id as string, name: user.name as string };
            }),
            estimatedHours: t.estimatedHours as number | null,
          };
        });
        setTasks(mapped);
      }
      if (!cancelled) setLoading(false);
    }

    fetchTasks().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [refreshKey]);

  const spaces = useMemo(
    () => [...new Set(tasks.map((t) => t.spaceName))].filter(Boolean),
    [tasks]
  );

  const priorities = ["URGENT", "HIGH", "NORMAL", "LOW"];

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.listName.toLowerCase().includes(q))
          return false;
      }
      if (priorityFilter.length > 0 && !priorityFilter.includes(task.priority))
        return false;
      if (spaceFilter.length > 0 && !spaceFilter.includes(task.spaceName))
        return false;
      return true;
    });
  }, [tasks, searchQuery, priorityFilter, spaceFilter]);

  const handleTaskClick = (taskId: string) => {
    openModal("task-detail-v2", { taskId });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Tareas"
        description="Gestiona y da seguimiento a todas las tareas"
        showSearch={false}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-secondary p-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 gap-2 px-3", viewMode === "kanban" && "bg-card shadow-sm")}
                onClick={() => setViewMode("kanban")}
              >
                <Kanban className="h-4 w-4" />
                Tablero
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 gap-2 px-3", viewMode === "list" && "bg-card shadow-sm")}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
                Lista
              </Button>
            </div>
            <Button className="gap-2" onClick={() => openModal("new-task-v2")}>
              <Plus className="h-4 w-4" />
              Nueva Tarea
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tareas..."
            className="w-[280px] bg-card pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <FilterDropdown
          label="Prioridad"
          options={priorities.map((p) => ({
            value: p,
            label: priorityLabels[p],
            count: tasks.filter((t) => t.priority === p).length,
          }))}
          selected={priorityFilter}
          onChange={setPriorityFilter}
        />
        <FilterDropdown
          label="Espacio"
          options={spaces.map((s) => ({
            value: s,
            label: s,
            count: tasks.filter((t) => t.spaceName === s).length,
          }))}
          selected={spaceFilter}
          onChange={setSpaceFilter}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {viewMode === "kanban" ? (
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {statusTypeColumns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.statusType === col.type);
              return (
                <div key={col.type} className="flex w-[320px] min-w-[320px] flex-col">
                  <div className="flex items-center gap-2 px-2 pb-3">
                    <div className={cn("h-2.5 w-2.5 rounded-full", col.color)} />
                    <span className="text-sm font-semibold text-foreground">{col.title}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {colTasks.length}
                    </Badge>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-2">
                      {colTasks.map((task) => (
                        <Card
                          key={task.id}
                          className="p-4 space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => handleTaskClick(task.id)}
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-medium text-foreground line-clamp-2">
                              {task.title}
                            </h4>
                            <Badge className={cn("text-xs shrink-0 ml-2", priorityColors[task.priority])}>
                              {priorityLabels[task.priority]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: task.spaceColor }}
                            />
                            <span className="truncate">{task.listName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {task.dueDate && (
                                <span className={cn("flex items-center gap-1", isOverdue(task.dueDate, task.statusType) && "text-red-500")}>
                                  <Calendar className="h-3 w-3" />
                                  {fmtDate(task.dueDate)}
                                </span>
                              )}
                              {task.estimatedHours && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {task.estimatedHours}h
                                </span>
                              )}
                            </div>
                            <div className="flex -space-x-1">
                              {task.assignees.slice(0, 2).map((a) => (
                                <Avatar key={a.id} className="h-6 w-6 border-2 border-card">
                                  <AvatarFallback className="text-[10px] bg-primary text-white">
                                    {a.name.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {task.assignees.length > 2 && (
                                <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] text-muted-foreground">
                                  +{task.assignees.length - 2}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                      {colTasks.length === 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground">Sin tareas</div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_100px_100px_80px] gap-4 px-5 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Tarea</span>
              <span>Proyecto</span>
              <span>Estado</span>
              <span>Prioridad</span>
              <span>Fecha</span>
              <span>Asignado</span>
            </div>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="divide-y divide-border/50">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[2fr_1fr_1fr_100px_100px_80px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleTaskClick(task.id)}
                  >
                    <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.spaceColor }} />
                      <span className="truncate">{task.listName}</span>
                    </div>
                    <Badge className="text-xs w-fit" style={{ backgroundColor: task.statusColor + "20", color: task.statusColor }}>
                      {task.statusName}
                    </Badge>
                    <Badge className={cn("text-xs w-fit", priorityColors[task.priority])}>
                      {priorityLabels[task.priority]}
                    </Badge>
                    <span className={cn("text-xs", isOverdue(task.dueDate, task.statusType) ? "text-red-500" : "text-muted-foreground")}>
                      {fmtDate(task.dueDate)}
                    </span>
                    <div className="flex -space-x-1">
                      {task.assignees.slice(0, 2).map((a) => (
                        <Avatar key={a.id} className="h-6 w-6 border-2 border-card">
                          <AvatarFallback className="text-[10px] bg-primary text-white">
                            {a.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
