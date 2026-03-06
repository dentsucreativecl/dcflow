"use client";

import { useState } from "react";
import { format, isToday, isThisWeek, isFuture } from "date-fns";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Task } from "@/lib/data";

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-studio-info/20 text-studio-info",
  high: "bg-studio-warning/20 text-studio-warning",
  urgent: "bg-studio-error/20 text-studio-error",
};

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
}

function TaskItem({ task, onToggle }: TaskItemProps) {
  const { projects } = useAppStore();
  const project = projects.find((p) => p.id === task.projectId);

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-secondary/50",
        task.status === "done" && "opacity-60"
      )}
    >
      <Checkbox
        checked={task.status === "done"}
        onCheckedChange={() => onToggle(task.id)}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-medium text-foreground",
              task.status === "done" && "line-through"
            )}
          >
            {task.title}
          </span>
          <Badge className={priorityColors[task.priority]} variant="secondary">
            {task.priority === "urgent" && (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            {task.priority}
          </Badge>
        </div>
        {project && (
          <div className="flex items-center gap-2 mt-1">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="text-sm text-muted-foreground">{project.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
              {task.assignee.avatar}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {task.estimatedHours}h
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(task.dueDate), "MMM d")}
        </div>
      </div>
    </div>
  );
}

interface TaskGroupProps {
  title: string;
  tasks: Task[];
  onToggle: (taskId: string) => void;
}

function TaskGroup({ title, tasks, onToggle }: TaskGroupProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title} ({tasks.length})
      </h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

export function MyTasksList() {
  const { tasks, updateTask } = useAppStore();

  // Filter for current user's tasks (in real app, filter by assignee)
  const myTasks = tasks.filter((t) => t.status !== "done");

  // Group tasks by date
  const todayTasks = myTasks.filter((t) =>
    isToday(new Date(t.dueDate))
  );
  const thisWeekTasks = myTasks.filter(
    (t) =>
      !isToday(new Date(t.dueDate)) &&
      isThisWeek(new Date(t.dueDate))
  );
  const laterTasks = myTasks.filter(
    (t) =>
      !isToday(new Date(t.dueDate)) &&
      !isThisWeek(new Date(t.dueDate)) &&
      isFuture(new Date(t.dueDate))
  );
  const overdueTasks = myTasks.filter(
    (t) =>
      !isToday(new Date(t.dueDate)) &&
      !isFuture(new Date(t.dueDate))
  );

  const handleToggle = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      updateTask(taskId, {
        status: task.status === "done" ? "todo" : "done",
      });
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {overdueTasks.length > 0 && (
        <Card className="border-studio-error/50 bg-studio-error/5 p-4">
          <TaskGroup
            title="Overdue"
            tasks={overdueTasks}
            onToggle={handleToggle}
          />
        </Card>
      )}

      <TaskGroup title="Today" tasks={todayTasks} onToggle={handleToggle} />
      <TaskGroup title="This Week" tasks={thisWeekTasks} onToggle={handleToggle} />
      <TaskGroup title="Later" tasks={laterTasks} onToggle={handleToggle} />

      {myTasks.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-studio-success mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            All caught up!
          </h3>
          <p className="text-muted-foreground mt-1">
            You have no pending tasks.
          </p>
        </Card>
      )}
    </div>
  );
}
