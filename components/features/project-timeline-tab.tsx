"use client";

import { format, differenceInDays, addDays } from "date-fns";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ProjectTimelineTabProps {
  projectId: string;
}

// Mock milestones
const getMilestones = (projectId: string) => [
  {
    id: "m-1",
    title: "Project Kickoff",
    date: "2024-01-10",
    status: "completed",
    description: "Initial meeting with client to align on project goals",
  },
  {
    id: "m-2",
    title: "Discovery Phase Complete",
    date: "2024-01-24",
    status: "completed",
    description: "Research and requirements gathering finished",
  },
  {
    id: "m-3",
    title: "Design Review",
    date: "2024-02-15",
    status: "completed",
    description: "First design iteration review with stakeholders",
  },
  {
    id: "m-4",
    title: "Design Approval",
    date: "2024-03-01",
    status: "in-progress",
    description: "Final design sign-off from client",
  },
  {
    id: "m-5",
    title: "Development Complete",
    date: "2024-03-10",
    status: "upcoming",
    description: "All development work finished",
  },
  {
    id: "m-6",
    title: "Project Delivery",
    date: "2024-03-15",
    status: "upcoming",
    description: "Final delivery and handoff to client",
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-studio-success" />;
    case "in-progress":
      return <Clock className="h-5 w-5 text-studio-info" />;
    case "overdue":
      return <AlertCircle className="h-5 w-5 text-studio-error" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-studio-success/20 text-studio-success">
          Completed
        </Badge>
      );
    case "in-progress":
      return (
        <Badge className="bg-studio-info/20 text-studio-info">In Progress</Badge>
      );
    case "overdue":
      return (
        <Badge className="bg-studio-error/20 text-studio-error">Overdue</Badge>
      );
    default:
      return <Badge variant="secondary">Upcoming</Badge>;
  }
};

export function ProjectTimelineTab({ projectId }: ProjectTimelineTabProps) {
  const { tasks, projects } = useAppStore();
  const project = projects.find((p) => p.id === projectId);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const milestones = getMilestones(projectId);

  // Calculate project timeline
  const startDate = project ? new Date(project.createdAt) : new Date();
  const endDate = project ? new Date(project.dueDate) : addDays(new Date(), 30);
  const totalDays = differenceInDays(endDate, startDate);
  const daysElapsed = differenceInDays(new Date(), startDate);
  const progressPercent = Math.min(Math.round((daysElapsed / totalDays) * 100), 100);

  return (
    <div className="space-y-6">
      {/* Timeline Overview */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">Project Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">Start: </span>
              <span className="font-medium text-foreground">
                {format(startDate, "MMM d, yyyy")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Due: </span>
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
              {daysElapsed} days elapsed
            </span>
            <span className="text-muted-foreground">
              {Math.max(totalDays - daysElapsed, 0)} days remaining
            </span>
          </div>
        </div>
      </Card>

      {/* Milestones */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">Milestones</h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {milestones.map((milestone, index) => (
              <div key={milestone.id} className="relative flex gap-4">
                <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card">
                  {getStatusIcon(milestone.status)}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-foreground">
                      {milestone.title}
                    </h4>
                    {getStatusBadge(milestone.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {milestone.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(milestone.date), "MMMM d, yyyy")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Task Timeline */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">
          Task Schedule ({projectTasks.length})
        </h3>
        <div className="space-y-3">
          {projectTasks.slice(0, 6).map((task) => {
            const daysUntilDue = differenceInDays(
              new Date(task.dueDate),
              new Date()
            );
            const isOverdue = daysUntilDue < 0 && task.status !== "done";

            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-4 rounded-lg border p-3",
                  isOverdue ? "border-studio-error/50 bg-studio-error/5" : "border-border"
                )}
              >
                <div className="flex-shrink-0">
                  {task.status === "done" ? (
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
                      task.status === "done"
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                  >
                    {task.title}
                  </p>
                </div>
                {task.assignee && (
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                      {task.assignee.avatar}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.dueDate), "MMM d")}
                </div>
                {isOverdue && (
                  <Badge className="bg-studio-error/20 text-studio-error">
                    Overdue
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
