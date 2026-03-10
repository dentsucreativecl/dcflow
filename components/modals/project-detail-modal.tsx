"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  X,
  ExternalLink,
  Edit,
  Trash2,
  Calendar,
  Clock,
  DollarSign,
  Users,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getProgressColor,
  cn,
} from "@/lib/utils";

const priorityColors: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-studio-info/20 text-studio-info",
  HIGH: "bg-studio-warning/20 text-studio-warning",
  URGENT: "bg-studio-error/20 text-studio-error",
};

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  space: { id: string; name: string; color: string } | null;
}

interface TaskRow {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  status: { id: string; name: string; type: string } | null;
  assignments: { user: { id: string; name: string; avatarUrl: string | null } }[];
}

interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function ProjectDetailModal() {
  const {
    activeModal,
    modalData,
    closeModal,
    openModal,
  } = useAppStore();
  const { addToast } = useToast();

  const isOpen = activeModal === "project-detail";
  const projectId = modalData?.projectId;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [totalHoursLogged, setTotalHoursLogged] = useState(0);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const supabase = createClient();

    // Fetch project (List) with Space
    const { data: listData } = await supabase
      .from("List")
      .select("id, name, description, startDate, endDate, createdAt, Space:spaceId(id, name, color)")
      .eq("id", projectId)
      .single();

    if (!listData) {
      setLoading(false);
      return;
    }

    const spaceRaw = listData.Space;
    const space = Array.isArray(spaceRaw) ? spaceRaw[0] : spaceRaw;
    setProject({ ...listData, space } as ProjectData);

    // Fetch tasks with status and assignments
    const { data: taskData } = await supabase
      .from("Task")
      .select("id, title, priority, dueDate, completedAt, estimatedHours, Status:statusId(id, name, type), TaskAssignment(User:userId(id, name, avatarUrl))")
      .eq("listId", projectId)
      .order("createdAt", { ascending: false });

    const parsedTasks: TaskRow[] = (taskData || []).map((t: any) => {
      const status = Array.isArray(t.Status) ? t.Status[0] : t.Status;
      const assignments = (t.TaskAssignment || []).map((a: any) => {
        const user = Array.isArray(a.User) ? a.User[0] : a.User;
        return { user };
      });
      return { ...t, status, assignments };
    });
    setTasks(parsedTasks);

    // Extract unique team members
    const memberMap = new Map<string, TeamMember>();
    parsedTasks.forEach((t) => {
      t.assignments.forEach((a) => {
        if (a.user && !memberMap.has(a.user.id)) {
          memberMap.set(a.user.id, a.user);
        }
      });
    });
    setTeam(Array.from(memberMap.values()));

    // Fetch total hours logged
    const { data: timeData } = await supabase
      .from("TimeEntry")
      .select("hours")
      .in("taskId", (taskData || []).map((t: any) => t.id));

    const totalHours = (timeData || []).reduce((acc: number, te: any) => acc + (te.hours || 0), 0);
    setTotalHoursLogged(Math.round(totalHours * 10) / 10);

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchProject();
    }
  }, [isOpen, projectId, fetchProject]);

  const handleClose = () => {
    closeModal();
    setProject(null);
    setTasks([]);
    setTeam([]);
  };

  const handleDelete = async () => {
    if (!projectId) return;
    const supabase = createClient();
    const { error } = await supabase.from("List").delete().eq("id", projectId);
    if (!error) {
      addToast({ title: "Proyecto eliminado", type: "success" });
      window.dispatchEvent(new CustomEvent("dcflow:refresh"));
      handleClose();
    } else {
      addToast({ title: "Error al eliminar", type: "error" });
    }
  };

  const handleOpenTask = (taskId: string) => {
    closeModal();
    openModal("task-detail-v2", { taskId });
  };

  if (!isOpen) return null;

  if (loading || !project) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex items-center justify-center p-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate stats from real tasks
  const doneTasks = tasks.filter((t) => t.status?.type === "DONE").length;
  const inProgressTasks = tasks.filter((t) => t.status?.type === "IN_PROGRESS").length;
  const todoTasks = tasks.filter((t) => t.status?.type === "TODO").length;
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
  const totalEstimated = tasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);

  const color = project.space?.color || "#6366f1";
  const derivedStatus = doneTasks === tasks.length && tasks.length > 0
    ? "completed"
    : inProgressTasks > 0
    ? "in-progress"
    : "planning";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-xl font-semibold"
              style={{ backgroundColor: color }}
            >
              {project.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  {project.name}
                </h2>
                <Badge className={getStatusColor(derivedStatus)}>
                  {derivedStatus.replace("-", " ")}
                </Badge>
              </div>
              {project.space && (
                <p className="text-sm text-muted-foreground">{project.space.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Proyecto
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Proyecto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-5 space-y-6">
            {/* Progress Overview */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Progreso</p>
                <p className="text-2xl font-semibold text-foreground">
                  {progress}%
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Tareas</p>
                <p className="text-2xl font-semibold text-foreground">
                  {tasks.length}
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Horas Registradas</p>
                <p className="text-2xl font-semibold text-foreground">
                  {totalHoursLogged}h
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Fecha Límite</p>
                <p className="text-lg font-semibold text-foreground">
                  {project.endDate ? formatDate(project.endDate) : "—"}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progreso del Proyecto</span>
                <span className="text-foreground font-medium">
                  {progress}%
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2"
                indicatorClassName={getProgressColor(progress)}
              />
            </div>

            <Separator />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Detalles</h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                      <p className="text-sm font-medium text-foreground">
                        {project.startDate
                          ? format(new Date(project.startDate), "PPP")
                          : format(new Date(project.createdAt), "PPP")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-error/20">
                      <Calendar className="h-4 w-4 text-studio-error" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha Límite</p>
                      <p className="text-sm font-medium text-foreground">
                        {project.endDate
                          ? format(new Date(project.endDate), "PPP")
                          : "Sin fecha límite"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-info/20">
                      <Clock className="h-4 w-4 text-studio-info" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horas</p>
                      <p className="text-sm font-medium text-foreground">
                        {totalHoursLogged}h / {totalEstimated}h estimadas
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Team */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Equipo ({team.length})</h3>
                <div className="space-y-2">
                  {team.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                        </p>
                      </div>
                    </div>
                  ))}
                  {team.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin miembros asignados</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Description */}
            {project.description && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Descripción</h3>
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Tasks Summary */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Tareas ({tasks.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closeModal();
                    openModal("new-task-v2");
                  }}
                >
                  Agregar Tarea
                </Button>
              </div>

              {/* Task Status Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-semibold text-foreground">{todoTasks}</p>
                  <p className="text-xs text-muted-foreground">Por Hacer</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-semibold text-studio-info">{inProgressTasks}</p>
                  <p className="text-xs text-muted-foreground">En Progreso</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-semibold text-studio-success">{doneTasks}</p>
                  <p className="text-xs text-muted-foreground">Completadas</p>
                </div>
              </div>

              {/* Recent Tasks List */}
              <div className="space-y-2">
                {tasks.slice(0, 5).map((task) => {
                  const assignee = task.assignments[0]?.user;
                  const isDone = task.status?.type === "DONE";

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => handleOpenTask(task.id)}
                    >
                      <button className="text-muted-foreground">
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-studio-success" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium text-foreground truncate",
                            isDone && "line-through opacity-60"
                          )}
                        >
                          {task.title}
                        </p>
                      </div>
                      <Badge className={priorityColors[task.priority] || priorityColors.NORMAL} variant="secondary">
                        {task.priority === "URGENT" && (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {task.priority.toLowerCase()}
                      </Badge>
                      {assignee && (
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                            {assignee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin tareas aún
                  </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
