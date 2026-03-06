"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight,
  Edit,
  MoreHorizontal,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Trash2,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TaskKanban } from "@/components/features/task-kanban";
import { ProjectFilesTab } from "@/components/features/project-files-tab";
import { ProjectTimelineTab } from "@/components/features/project-timeline-tab";
import { ProjectBudgetTab } from "@/components/features/project-budget-tab";
import { ProjectActivityTab } from "@/components/features/project-activity-tab";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import {
  formatCurrency,
  formatDate,
  formatDateFull,
  getStatusColor,
  getProgressColor,
} from "@/lib/utils";

export default function ProjectDetailPage() {
  const params = useParams();
  const rawId = params.id as string;
  // Get actual id from URL path if params return placeholder
  const id = rawId === '_' ? (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '') : rawId;
  const router = useRouter();
  const { projects, tasks, clients, deleteProject, openModal } = useAppStore();
  const { addToast } = useToast();

  const project = projects.find((p) => p.id === id);
  const projectTasks = tasks.filter((t) => t.projectId === project?.id);
  const client = project ? clients.find((c) => c.id === project.clientId) : null;

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold text-foreground">Project not found</h1>
        <Button asChild>
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const handleDelete = () => {
    deleteProject(project.id);
    addToast({ title: "Project deleted", type: "success" });
    router.push("/projects");
  };

  const budgetUsed = Math.round((project.spent / project.budget) * 100);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-white text-2xl font-semibold"
            style={{ backgroundColor: project.color }}
          >
            {project.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                {project.name}
              </h1>
              <Badge className={getStatusColor(project.status)}>
                {project.status.replace("-", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">{project.client}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openModal("new-task-v2")}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
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

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Progress</p>
              <p className="text-2xl font-semibold text-foreground">
                {project.progress}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget Used</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(project.spent)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  / {formatCurrency(project.budget)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatDate(project.dueDate)}
              </p>
            </div>
          </div>
          <div className="flex -space-x-2">
            {project.team.map((member) => (
              <Avatar
                key={member.id}
                className="h-10 w-10 border-2 border-card"
              >
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {member.avatar}
                </AvatarFallback>
              </Avatar>
            ))}
            <button className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-secondary text-sm font-medium text-muted-foreground hover:bg-accent">
              +
            </button>
          </div>
        </div>
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
      </Card>

      <Tabs defaultValue="tasks" className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="font-semibold text-foreground mb-4">
                Project Details
              </h3>
              <p className="text-muted-foreground">{project.description}</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="font-medium text-foreground">
                      {formatDateFull(project.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-error/20">
                    <Calendar className="h-5 w-5 text-studio-error" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="font-medium text-foreground">
                      {formatDateFull(project.dueDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-success/20">
                    <DollarSign className="h-5 w-5 text-studio-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="font-medium text-foreground">
                      {formatCurrency(project.budget)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-info/20">
                    <Users className="h-5 w-5 text-studio-info" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Team Size</p>
                    <p className="font-medium text-foreground">
                      {project.team.length} members
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Team</h3>
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {project.team.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
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
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 mt-6 overflow-hidden">
          <TaskKanban projectId={project.id} />
        </TabsContent>

        <TabsContent value="files" className="flex-1 mt-6">
          <ProjectFilesTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 mt-6">
          <ProjectTimelineTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="budget" className="flex-1 mt-6">
          <ProjectBudgetTab project={project} tasks={projectTasks} />
        </TabsContent>

        <TabsContent value="activity" className="flex-1 mt-6">
          <ProjectActivityTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
