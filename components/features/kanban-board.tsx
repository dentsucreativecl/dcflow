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
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, CheckCircle2, Circle, FolderOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export type KanbanStatus = "briefing" | "in-progress" | "review" | "approved" | "delivered";

export interface KanbanProjectRow {
  id: string;
  name: string;
  spaceName: string;
  spaceColor: string;
  folderName: string | null;
  isPitch: boolean;
  totalTasks: number;
  doneTasks: number;
  progress: number;
  dueDate: string | null;
  status: KanbanStatus;
}

const columns: { id: KanbanStatus; title: string; color: string }[] = [
  { id: "briefing", title: "Briefing", color: "bg-muted-foreground" },
  { id: "in-progress", title: "En Progreso", color: "bg-blue-500" },
  { id: "review", title: "Revisión", color: "bg-amber-500" },
  { id: "approved", title: "Aprobado", color: "bg-emerald-500" },
  { id: "delivered", title: "Entregado", color: "bg-primary" },
];

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function ProjectCard({ project, isDragging }: { project: KanbanProjectRow; isDragging?: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab p-3 space-y-2.5 active:cursor-grabbing hover:border-primary/50 transition-colors select-none"
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/lists/${project.id}`);
      }}
    >
      {/* Color bar + Name */}
      <div className="flex items-start gap-2">
        <div
          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: project.spaceColor }}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight truncate" title={project.name}>{project.name}</p>
          <p className="text-xs text-muted-foreground truncate" title={project.spaceName}>{project.spaceName}</p>
          {project.folderName && (
            <p className="text-xs text-muted-foreground/70 flex items-center gap-1 truncate">
              <FolderOpen className="h-3 w-3" />
              {project.folderName}
            </p>
          )}
        </div>
        {project.isPitch && (
          <Badge variant="secondary" className="text-[10px] shrink-0 ml-auto">Pitch</Badge>
        )}
      </div>

      {/* Progress */}
      {project.totalTasks > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                project.progress === 100 ? "bg-emerald-500" : project.progress > 50 ? "bg-blue-500" : "bg-amber-500"
              )}
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-7 text-right">{project.progress}%</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span>{project.doneTasks}</span>
          <span className="text-muted-foreground/40">/</span>
          <Circle className="h-3 w-3" />
          <span>{project.totalTasks}</span>
        </div>
        {project.dueDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {fmtDate(project.dueDate)}
          </div>
        )}
      </div>
    </Card>
  );
}

function KanbanColumn({
  column,
  projects,
}: {
  column: typeof columns[0];
  projects: KanbanProjectRow[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col gap-3 h-full min-w-[260px] flex-1">
      <div className="flex items-center justify-between rounded-lg bg-card px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${column.color}`} />
          <span className="font-medium text-foreground text-sm">{column.title}</span>
        </div>
        <Badge variant="secondary" className="h-6 w-6 p-0 justify-center text-xs">
          {projects.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={cn(
              "space-y-2.5 pb-4 min-h-[120px] rounded-lg transition-colors",
              isOver && "bg-primary/5"
            )}
          >
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

export function deriveStatus(project: { progress: number; totalTasks: number }): KanbanStatus {
  if (project.totalTasks === 0) return "briefing";
  if (project.progress === 100) return "delivered";
  if (project.progress >= 75) return "review";
  if (project.progress > 0) return "in-progress";
  return "briefing";
}

export function KanbanBoard({ projects: initialProjects }: { projects: KanbanProjectRow[] }) {
  const [projects, setProjects] = useState<KanbanProjectRow[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync when parent data changes
  useState(() => {
    setProjects(initialProjects);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeProjectId = active.id as string;
    const overId = over.id as string;

    // Dropped on a column
    const overColumn = columns.find((col) => col.id === overId);
    if (overColumn) {
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? { ...p, status: overColumn.id } : p))
      );
      return;
    }

    // Dropped on another card → move to same column
    const overProject = projects.find((p) => p.id === overId);
    if (overProject) {
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? { ...p, status: overProject.status } : p))
      );
    }
  };

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            projects={projects.filter((p) => p.status === column.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeProject && <ProjectCard project={activeProject} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
