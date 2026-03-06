"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Calendar, Clock, AlertCircle, Plus, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { Task } from "@/lib/data";

type TaskStatus = "todo" | "in-progress" | "review" | "done";

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: "todo", title: "Por Hacer", color: "bg-muted-foreground" },
  { id: "in-progress", title: "En Progreso", color: "bg-studio-info" },
  { id: "review", title: "Revisión", color: "bg-studio-warning" },
  { id: "done", title: "Completado", color: "bg-studio-success" },
];

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-studio-info/20 text-studio-info",
  high: "bg-studio-warning/20 text-studio-warning",
  urgent: "bg-studio-error/20 text-studio-error",
};

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

function TaskCard({ task, isDragging }: TaskCardProps) {
  const { projects, openModal } = useAppStore();
  const project = projects.find((p) => p.id === task.projectId);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab p-4 space-y-3 active:cursor-grabbing hover:border-primary/50 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        openModal("task-detail-v2", { taskId: task.id });
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground text-sm truncate">
            {task.title}
          </h4>
          {project && (
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-xs text-muted-foreground truncate">
                {project.name}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 -mr-2 -mt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Image Thumbnail */}
      {task.attachments && task.attachments.filter(a => a.type.startsWith("image")).length > 0 && (
        <div className="relative -mx-3 -mt-1 mb-2 rounded-md overflow-hidden border border-border">
          <img
            src={task.attachments.filter(a => a.type.startsWith("image"))[0].url}
            alt={task.attachments.filter(a => a.type.startsWith("image"))[0].name}
            className="w-full h-24 object-cover"
            onError={(e) => {
                const wrapper = e.currentTarget.closest('.relative') as HTMLElement | null;
                if (wrapper) wrapper.style.display = 'none';
            }}
          />
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
            <Paperclip className="h-2.5 w-2.5" />
            {task.attachments.filter(a => a.type.startsWith("image")).length}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="flex items-center gap-2">
        <Badge className={priorityColors[task.priority]} variant="secondary">
          {task.priority === "urgent" && (
            <AlertCircle className="h-3 w-3 mr-1" />
          )}
          {task.priority}
        </Badge>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-3">
          {task.assignee && (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                {task.assignee.avatar}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.loggedHours}/{task.estimatedHours}h
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(task.dueDate)}
        </div>
      </div>
    </Card>
  );
}

interface TaskColumnProps {
  column: typeof columns[0];
  tasks: Task[];
}

function TaskColumn({ column, tasks }: TaskColumnProps) {
  const { openModal } = useAppStore();

  return (
    <div className="flex flex-col gap-3 h-full min-w-[300px] flex-1">
      {/* Column Header */}
      <div className="flex items-center justify-between rounded-lg bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${column.color}`} />
          <span className="font-medium text-foreground text-sm">
            {column.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-6 w-6 p-0 justify-center">
            {tasks.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openModal("new-task-v2")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 pb-4">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

interface TaskKanbanProps {
  projectId?: string;
}

export function TaskKanban({ projectId }: TaskKanbanProps = {}) {
  const { tasks, moveTask } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Filter tasks by project if projectId is provided
  const filteredTasks = projectId
    ? tasks.filter((t) => t.projectId === projectId)
    : tasks;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which column the task is being dragged over
    const overColumn = columns.find((col) => col.id === overId);
    if (overColumn) {
      const task = tasks.find((t) => t.id === activeId);
      if (task && task.status !== overColumn.id) {
        moveTask(activeId, overColumn.id);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const overColumn = columns.find((col) => col.id === overId);
    if (overColumn) {
      moveTask(activeId, overColumn.id);
      return;
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      moveTask(activeId, overTask.status);
    }
  };

  const getTasksByStatus = (status: TaskStatus) =>
    filteredTasks.filter((task) => task.status === status);

  const activeTask = activeId ? filteredTasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-5 h-full overflow-x-auto pb-4">
        {columns.map((column) => (
          <TaskColumn
            key={column.id}
            column={column}
            tasks={getTasksByStatus(column.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
