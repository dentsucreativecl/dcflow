"use client";

import { useState } from "react";
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
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getProgressColor,
  cn,
} from "@/lib/utils";

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-studio-info/20 text-studio-info",
  high: "bg-studio-warning/20 text-studio-warning",
  urgent: "bg-studio-error/20 text-studio-error",
};

export function ProjectDetailModal() {
  const {
    activeModal,
    modalData,
    closeModal,
    projects,
    tasks,
    clients,
    deleteProject,
    openModal,
  } = useAppStore();
  const { addToast } = useToast();

  const isOpen = activeModal === "project-detail";
  const project = projects.find((p) => p.id === modalData?.projectId);
  const projectTasks = tasks.filter((t) => t.projectId === project?.id);
  const client = project ? clients.find((c) => c.id === project.clientId) : null;

  if (!project) return null;

  const handleClose = () => {
    closeModal();
  };

  const handleDelete = () => {
    deleteProject(project.id);
    addToast({ title: "Project deleted", type: "success" });
    handleClose();
  };

  const handleOpenTask = (taskId: string) => {
    closeModal();
    openModal("task-detail-v2", { taskId });
  };

  const budgetUsed = Math.round((project.gastado / project.budget) * 100);

  // Task stats
  const todoTasks = projectTasks.filter((t) => t.status === "todo").length;
  const inProgressTasks = projectTasks.filter((t) => t.status === "in-progress").length;
  const reviewTasks = projectTasks.filter((t) => t.status === "review").length;
  const doneTasks = projectTasks.filter((t) => t.status === "done").length;
  const totalHoursLogged = projectTasks.reduce((acc, t) => acc + t.loggedHours, 0);
  const totalHoursEstimated = projectTasks.reduce((acc, t) => acc + t.estimatedHours, 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-xl font-semibold"
              style={{ backgroundColor: project.color }}
            >
              {project.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  {project.name}
                </h2>
                <Badge className={getStatusColor(project.status)}>
                  {project.status.replace("-", " ")}
                </Badge>
              </div>
              {client && (
                <p className="text-sm text-muted-foreground">{client.company}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${project.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Full View
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
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
                  {project.progress}%
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Budget Used</p>
                <p className="text-2xl font-semibold text-foreground">
                  {budgetUsed}%
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Hours Logged</p>
                <p className="text-2xl font-semibold text-foreground">
                  {totalHoursLogged}h
                </p>
              </div>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs text-muted-foreground">Fecha Límite</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatDate(project.dueDate)}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Project Progress</span>
                <span className="text-foreground font-medium">
                  {project.progress}%
                </span>
              </div>
              <Progress
                value={project.progress}
                className="h-2"
                indicatorClassName={getProgressColor(project.progress)}
              />
            </div>

            <Separator />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Details</h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(project.createdAt), "PPP")}
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
                        {format(new Date(project.dueDate), "PPP")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-success/20">
                      <DollarSign className="h-4 w-4 text-studio-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Presupuesto</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatCurrency(project.gastado)} / {formatCurrency(project.budget)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-info/20">
                      <Clock className="h-4 w-4 text-studio-info" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hours</p>
                      <p className="text-sm font-medium text-foreground">
                        {totalHoursLogged}h / {totalHoursEstimated}h estimated
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Team */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Team ({project.team.length})</h3>
                <div className="space-y-2">
                  {project.team.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {member.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Descripción</h3>
              <p className="text-sm text-muted-foreground">{project.description}</p>
            </div>

            <Separator />

            {/* Tasks Summary */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Tasks ({projectTasks.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closeModal();
                    openModal("new-task-v2");
                  }}
                >
                  Add Task
                </Button>
              </div>

              {/* Task Status Summary */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-semibold text-foreground">{todoTasks}</p>
                  <p className="text-xs text-muted-foreground">To Do</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-semibold text-studio-info">{inProgressTasks}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-semibold text-studio-warning">{reviewTasks}</p>
                  <p className="text-xs text-muted-foreground">Review</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-xl font-semibold text-studio-success">{doneTasks}</p>
                  <p className="text-xs text-muted-foreground">Done</p>
                </div>
              </div>

              {/* Recent Tasks List */}
              <div className="space-y-2">
                {projectTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleOpenTask(task.id)}
                  >
                    <button className="text-muted-foreground">
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-studio-success" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium text-foreground truncate",
                          task.status === "done" && "line-through opacity-60"
                        )}
                      >
                        {task.title}
                      </p>
                    </div>
                    <Badge className={priorityColors[task.priority]} variant="secondary">
                      {task.priority === "urgent" && (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {task.priority}
                    </Badge>
                    {task.assignee && (
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                          {task.assignee.avatar}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {projectTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tasks yet
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
