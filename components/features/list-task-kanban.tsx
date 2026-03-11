"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Plus,
    MoreHorizontal,
    Calendar,
  MessageSquare,
  Flag,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Lock,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    closestCorners,
    pointerWithin,
    PointerSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";

interface Task {
    id: string;
    title: string;
    description: string | null;
    priority: "URGENT" | "HIGH" | "MEDIUM" | "NORMAL" | "LOW" | "NONE";
    dueDate: string | null;
    order?: number;
    status: {
        id: string;
        name: string;
        color: string;
    } | null;
    assignments: Array<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        };
    }>;
    attachments?: Array<{
        id: string;
        fileUrl: string;
        fileType: string;
        fileName: string;
    }>;
    subtasks?: Array<{
        id: string;
        title: string;
        dueDate?: string | null;
        startDate?: string | null;
        status: { id: string; name: string; color: string } | null;
    }>;
    _count?: {
        comments: number;
        attachments: number;
        subtasks: number;
    };
    isBlocked?: boolean;
    blockedByTitles?: string[];
}

const WIP_LIMIT = 10;

interface Status {
    id: string;
    name: string;
    color: string;
}

interface ListTaskKanbanProps {
    listId: string;
    tasks: Task[];
    onTaskClick?: (task: Task) => void;
    onTaskUpdate?: (updatedTasks: Task[]) => void;
    onAutomationTrigger?: (taskId: string, trigger: string, context: { newValue: string }) => void;
}

const priorityColors = {
    URGENT: "border-l-red-500",
    HIGH: "border-l-orange-500",
    MEDIUM: "border-l-yellow-500",
    LOW: "border-l-blue-500",
    NORMAL: "border-l-yellow-500",
  NONE: "border-l-transparent",
};

const priorityLabels: Record<string, string> = {
  URGENT: "Urgente",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  NORMAL: "Media",
  NONE: "",
};

const priorityBadgeColors: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-blue-100 text-blue-700",
  NORMAL: "bg-yellow-100 text-yellow-700",
  NONE: "",
};

export function ListTaskKanban({ listId, tasks, onTaskClick, onTaskUpdate, onAutomationTrigger }: ListTaskKanbanProps) {
    const { addToast } = useToast();
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const dragStartStatusId = useRef<string | null>(null);
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
    const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; name: string }>>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const openLightbox = (images: Array<{ url: string; name: string }>, index: number) => {
        setLightboxImages(images);
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    const { openModal } = useAppStore();
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(MouseSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 5 },
        })
    );

    // Fetch statuses for this list
    useEffect(() => {
        async function fetchStatuses() {
            const supabase = createClient();

            try {
                // First get the list to find its spaceId
                    const { data: listData } = await supabase
                        .from("List")
                        .select("spaceId")
                        .eq("id", listId)
                        .single();
                    if (listData?.spaceId) {
                        const { data } = await supabase
                            .from("Status")
                            .select("id, name, color")
                            .eq("spaceId", listData.spaceId)
                            .order("order");
                        if (data) setStatuses(data);
                    }
                } catch (error) {
                console.error("Error fetching statuses:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchStatuses();
    }, [listId]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!focusedTaskId) return;

            const task = tasks.find(t => t.id === focusedTaskId);
            if (!task) return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    moveToPreviousColumn(task);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    moveToNextColumn(task);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    moveTaskUp(task);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    moveTaskDown(task);
                    break;
                case 'Enter':
                    e.preventDefault();
                    onTaskClick?.(task);
                    break;
                case 'Escape':
                    e.preventDefault();
                    setFocusedTaskId(null);
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [focusedTaskId, tasks, statuses]);

    const moveToPreviousColumn = (task: Task) => {
        const currentIndex = statuses.findIndex(s => s.id === task.status?.id);
        if (currentIndex <= 0) return;

        const previousStatus = statuses[currentIndex - 1];
        const newStatus = previousStatus;

        // Optimistic update
        const optimisticTasks = tasks.map(t =>
            t.id === task.id ? { ...t, status: newStatus } : t
        );
        onTaskUpdate?.(optimisticTasks);

        updateTaskStatus(task.id, previousStatus.id).catch(() => {
            onTaskUpdate?.(tasks); // Revert on error
        });
    };

    const moveToNextColumn = (task: Task) => {
        const currentIndex = statuses.findIndex(s => s.id === task.status?.id);
        if (currentIndex >= statuses.length - 1) return;

        const nextStatus = statuses[currentIndex + 1];

        // Optimistic update
        const optimisticTasks = tasks.map(t =>
            t.id === task.id ? { ...t, status: nextStatus } : t
        );
        onTaskUpdate?.(optimisticTasks);

        updateTaskStatus(task.id, nextStatus.id).catch(() => {
            onTaskUpdate?.(tasks); // Revert on error
        });
    };

    const moveTaskUp = (task: Task) => {
        const tasksInColumn = tasks
            .filter(t => t.status?.id === task.status?.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const index = tasksInColumn.findIndex(t => t.id === task.id);
        if (index <= 0) return;

        handleReorder(task.id, tasksInColumn[index - 1].id);
    };

    const moveTaskDown = (task: Task) => {
        const tasksInColumn = tasks
            .filter(t => t.status?.id === task.status?.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const index = tasksInColumn.findIndex(t => t.id === task.id);
        if (index >= tasksInColumn.length - 1) return;

        handleReorder(task.id, tasksInColumn[index + 1].id);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const id = event.active.id as string;
        setActiveId(id);
        const task = tasks.find(t => t.id === id);
        dragStartStatusId.current = task?.status?.id ?? null;
        console.log("[KANBAN] dragStart — taskId:", id, "statusId original:", dragStartStatusId.current);
    };

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || !active) return;

        const activeTaskId = active.id as string;
        const overId = over.id as string;

        const activeTask = tasks.find(t => t.id === activeTaskId);
        if (!activeTask) return;

        // Determine target column (status)
        let targetStatusId: string | null = null;

        // Check if dropping on a status column directly
        const isOverStatus = statuses.some(s => s.id === overId);
        if (isOverStatus) {
            targetStatusId = overId;
        } else {
            // Dropping on another task - find its status
            const overTask = tasks.find(t => t.id === overId);
            if (overTask) targetStatusId = overTask.status?.id || null;
        }

        if (!targetStatusId || activeTask.status?.id === targetStatusId) return;

        // Move task to new column optimistically during drag
        const newStatus = statuses.find(s => s.id === targetStatusId);
        if (!newStatus) return;

        const optimisticTasks = tasks.map(t =>
            t.id === activeTaskId ? { ...t, status: newStatus } : t
        );
        onTaskUpdate?.(optimisticTasks);
    }, [tasks, statuses, onTaskUpdate]);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        console.log("KANBAN HANDLER EJECUTADO", { active: active?.id, over: over?.id });
        setActiveId(null);

        if (!over || !active) {
            console.log("KANBAN: sin over o active, abortando");
            dragStartStatusId.current = null;
            return;
        }

        const taskId = active.id as string;
        const overId = over.id as string;

        // task ya tiene el status optimista (actualizado por handleDragOver)
        // usar dragStartStatusId para comparar con el estado original
        const originalStatusId = dragStartStatusId.current;
        dragStartStatusId.current = null;

        const task = tasks.find(t => t.id === taskId);
        if (!task) {
            console.log("KANBAN: tarea no encontrada para id:", taskId);
            return;
        }

        // El status actual de la tarea es el destino (ya fue actualizado por handleDragOver)
        const targetStatusId = task.status?.id;

        console.log("[KANBAN] dragEnd — originalStatusId:", originalStatusId, "targetStatusId:", targetStatusId);

        // Persist status change to database
        if (targetStatusId && targetStatusId !== originalStatusId) {
            // Block validation
            if (task.isBlocked) {
                addToast({
                    title: "Tarea bloqueada",
                    description: `Bloqueada por: ${task.blockedByTitles?.join(", ") || "otra tarea"}`,
                    type: "error",
                });
                // Revert optimistic update
                onTaskUpdate?.(tasks);
                return;
            }

            try {
                await updateTaskStatus(taskId, targetStatusId);
                onAutomationTrigger?.(taskId, "STATUS_CHANGED", { newValue: targetStatusId });
            } catch (error) {
                console.error('Failed to update task status:', error);
                // onDragOver already did optimistic update,
                // handleDragEnd just persists it
            }
        }

        // Handle reorder within same column (dropped on another task with same status)
        const isOverTask = tasks.some(t => t.id === overId);
        if (isOverTask && !targetStatusId || (isOverTask && targetStatusId === originalStatusId)) {
            const overTask = tasks.find(t => t.id === overId);
            if (overTask && overId !== taskId) {
                await handleReorder(taskId, overId);
            }
        }
    };

    const handleReorder = async (taskId: string, overTaskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        const overTask = tasks.find(t => t.id === overTaskId);

        if (!task || !overTask) return;
        if (task.status?.id !== overTask.status?.id) return;

        // Get tasks in column sorted by order
        const tasksInColumn = tasks
            .filter(t => t.status?.id === task.status?.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const oldIndex = tasksInColumn.findIndex(t => t.id === taskId);
        const newIndex = tasksInColumn.findIndex(t => t.id === overTaskId);

        if (oldIndex === newIndex) return;

        // Reorder
        const reorderedTasks = [...tasksInColumn];
        const [movedTask] = reorderedTasks.splice(oldIndex, 1);
        reorderedTasks.splice(newIndex, 0, movedTask);

        // Assign new order values with gaps
        const tasksWithNewOrder = reorderedTasks.map((t, index) => ({
            ...t,
            order: index * 1000,
        }));

        // OPTIMISTIC UPDATE
        const optimisticTasks = tasks.map(t => {
            const updated = tasksWithNewOrder.find(tw => tw.id === t.id);
            return updated || t;
        });
        onTaskUpdate?.(optimisticTasks);

        // PERSIST TO DATABASE
        try {
            await Promise.all(
                tasksWithNewOrder.map(t =>
                    updateTaskOrder(t.id, t.order || 0)
                )
            );
        } catch (error) {
            console.error('Failed to reorder tasks:', error);
            // REVERT
            onTaskUpdate?.(tasks);
        }
    };

    const updateTaskStatus = async (taskId: string, statusId: string) => {
        const supabase = createClient();

        // DEBUG
        console.log("[KANBAN STATUS] taskId:", taskId);
        console.log("[KANBAN STATUS] nuevo statusId:", statusId);
        console.log("[KANBAN STATUS] statuses disponibles:", statuses);

        const result = await supabase
            .from('Task')
            .update({ statusId })
            .eq('id', taskId)
            .select("id, statusId");

        console.log("[KANBAN STATUS] resultado UPDATE completo:", JSON.stringify(result, null, 2));

        if (result.error) throw result.error;
        if (!result.data || result.data.length === 0) {
            console.warn("[KANBAN STATUS] UPDATE afectó 0 filas — posible bloqueo RLS");
        }

        // Verificar valor en DB tras UPDATE
        const { data: dbCheck, error: dbCheckError } = await supabase
            .from('Task')
            .select("id, statusId")
            .eq('id', taskId)
            .single();
        console.log("[KANBAN STATUS] SELECT post-UPDATE:", JSON.stringify({ dbCheck, dbCheckError }, null, 2));
    };

    const updateTaskOrder = async (taskId: string, order: number) => {
        const supabase = createClient();

        const { error } = await supabase
            .from('Task')
            .update({ order })
            .eq('id', taskId);

        if (error) throw error;
    };

    // Group tasks by status
    const tasksByStatus = statuses.reduce((acc, status) => {
        acc[status.id] = tasks.filter((task) => task.status?.id === status.id);
        return acc;
    }, {} as Record<string, Task[]>);

    // Tasks without status
    const unassignedTasks = tasks.filter((task) => !task.status);

    if (loading) {
        return (
            <div className="flex gap-4 h-full">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="w-72 flex-shrink-0">
                        <Skeleton className="h-12 w-full mb-2" />
                        <Skeleton className="h-32 w-full mb-2" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
                {/* Unassigned column */}
                {unassignedTasks.length > 0 && (
                    <KanbanStatusColumn
                        status={{ id: "none", name: "Sin estado", color: "#6B7280" }}
                        tasks={unassignedTasks}
                        onTaskClick={onTaskClick}
                        focusedTaskId={focusedTaskId}
                        onTaskFocus={setFocusedTaskId}
                        onImageClick={openLightbox}
                    />
                )}

                {/* Status columns */}
                {statuses.map((status) => (
                    <KanbanStatusColumn
                        key={status.id}
                        status={status}
                        tasks={tasksByStatus[status.id] || []}
                        onTaskClick={onTaskClick}
                        focusedTaskId={focusedTaskId}
                        onTaskFocus={setFocusedTaskId}
                        onAddTask={() => openModal("new-task-v2", { projectId: listId, statusId: status.id })}
                        onImageClick={openLightbox}
                    />
                ))}

                {/* Add column button */}
                <div className="flex-shrink-0 w-72">
                    <Button
                        variant="ghost"
                        className="w-full h-12 border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar estado
                    </Button>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
                {activeId ? (
                    <div className="rotate-3 scale-105 cursor-grabbing shadow-xl opacity-90">
                        <TaskKanbanCard
                            task={tasks.find(t => t.id === activeId)!}
                        />
                    </div>
                ) : null}
            </DragOverlay>

            {/* Image Lightbox */}
            <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
                    <div className="relative flex items-center justify-center min-h-[400px]">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                            onClick={() => setLightboxOpen(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                        {lightboxImages.length > 1 && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-2 z-10 text-white hover:bg-white/20"
                                    onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 z-10 text-white hover:bg-white/20"
                                    onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            </>
                        )}
                        {lightboxImages[lightboxIndex] && (
                            <img
                                src={lightboxImages[lightboxIndex].url}
                                alt={lightboxImages[lightboxIndex].name}
                                className="max-h-[80vh] max-w-full object-contain"
                            />
                        )}
                        {lightboxImages.length > 1 && (
                            <div className="absolute bottom-3 text-white/70 text-xs">
                                {lightboxIndex + 1} / {lightboxImages.length}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </DndContext>
    );
}

interface KanbanStatusColumnProps {
    status: Status;
    tasks: Task[];
    onTaskClick?: (task: Task) => void;
    focusedTaskId?: string | null;
    onTaskFocus?: (taskId: string) => void;
    onAddTask?: () => void;
    onImageClick?: (images: Array<{ url: string; name: string }>, index: number) => void;
}

function KanbanStatusColumn({ status, tasks, onTaskClick, focusedTaskId, onTaskFocus, onAddTask, onImageClick }: KanbanStatusColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: status.id,
    });

    const isOverWip = tasks.length > WIP_LIMIT;

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-shrink-0 w-72 flex flex-col rounded-lg max-h-full transition-colors",
                isOver && "ring-2 ring-primary bg-primary/5",
                isOverWip && "bg-red-50/50 dark:bg-red-950/20"
            )}
            style={!isOver && !isOverWip ? { backgroundColor: status.color + '18' } : undefined}
        >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: status.color }}
                    />
                    <span className="font-medium text-foreground">{status.name}</span>
                    <Badge variant="secondary" className="ml-1 text-xs">
                        {tasks.length}
                    </Badge>
                    {isOverWip && (
                        <Badge variant="destructive" className="text-[10px] h-5">
                            WIP: {tasks.length}/{WIP_LIMIT}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddTask}>
                        <Plus className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Renombrar</DropdownMenuItem>
                            <DropdownMenuItem>Cambiar color</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Task Cards */}
            <ScrollArea className="flex-1 p-2">
                <SortableContext
                    items={tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-2">
                        {tasks.map((task) => (
                            <SortableTaskCard
                                key={task.id}
                                task={task}
                                onClick={() => onTaskClick?.(task)}
                                focused={focusedTaskId === task.id}
                                onFocus={() => onTaskFocus?.(task.id)}
                                onImageClick={onImageClick}
                            />
                        ))}

                        {tasks.length === 0 && (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                No hay tareas
                            </div>
                        )}
                    </div>
                </SortableContext>
            </ScrollArea>

            {/* Add Task */}
            <div className="p-2 border-t border-border">
                <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={onAddTask}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar tarea
                </Button>
            </div>
        </div>
    );
}

interface SortableTaskCardProps {
    task: Task;
    onClick?: () => void;
    focused?: boolean;
    onFocus?: () => void;
    onImageClick?: (images: Array<{ url: string; name: string }>, index: number) => void;
}

function SortableTaskCard({ task, onClick, focused, onFocus, onImageClick }: SortableTaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onFocus}
            tabIndex={0}
            role="button"
            aria-label={`Tarea: ${task.title}. Usa flechas para mover, Enter para abrir`}
            className={cn(
                focused && "ring-2 ring-primary ring-offset-2"
            )}
        >
            <TaskKanbanCard task={task} onClick={onClick} onImageClick={onImageClick} />
        </div>
    );
}

interface TaskKanbanCardProps {
    task: Task;
    onClick?: () => void;
    onImageClick?: (images: Array<{ url: string; name: string }>, index: number) => void;
}

function TaskKanbanCard({ task, onClick, onImageClick }: TaskKanbanCardProps) {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
    const imageAttachments = (task.attachments || []).filter(a => a.fileType?.startsWith("image/"));
    const [subtasksExpanded, setSubtasksExpanded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const { openModal } = useAppStore();
    const subtasks = task.subtasks || [];

    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group",
                "border-l-4",
                priorityColors[task.priority]
            )}
        >
            {/* Image Thumbnail */}
            {imageAttachments.length > 0 && !imgError && (
                <div
                    className="relative -mx-3 -mt-3 mb-2 rounded-t-lg overflow-hidden cursor-zoom-in"
                    onClick={(e) => {
                        e.stopPropagation();
                        onImageClick?.(
                            imageAttachments.map(a => ({ url: a.fileUrl, name: a.fileName })),
                            0
                        );
                    }}
                >
                    <img
                        src={imageAttachments[imageAttachments.length - 1].fileUrl}
                        alt={imageAttachments[imageAttachments.length - 1].fileName}
                        className="w-full h-28 object-cover"
                        onError={() => setImgError(true)}
                    />
                    {imageAttachments.length > 1 && (
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            <ImageIcon className="h-2.5 w-2.5" />
                            {imageAttachments.length}
                        </div>
                    )}
                </div>
            )}

            {/* Blocked indicator */}
            {task.isBlocked && (
                <div className="flex items-center gap-1 text-destructive text-[10px] font-medium mb-1.5">
                    <Lock className="h-3 w-3" />
                    <span>Bloqueada</span>
                </div>
            )}

            {/* Task Name */}
            <p className={cn("font-medium text-sm text-foreground line-clamp-2 mb-2", task.isBlocked && "opacity-60")}>
                {task.title}
            </p>

            {/* Description preview */}
            {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {task.description}
                </p>
            )}


      {/* Tags Row */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {task.priority && task.priority !== "NONE" && task.priority !== "NORMAL" && task.priority !== "MEDIUM" && (
          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", priorityBadgeColors[task.priority])}>
            <Flag className="h-2.5 w-2.5" />
            {priorityLabels[task.priority]}
          </span>
        )}
        {(task._count?.comments || 0) > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground bg-muted">
            <MessageSquare className="h-2.5 w-2.5" />
            {task._count?.comments}
          </span>
        )}
      </div>

      {/* Subtasks collapsible list */}
      {subtasks.length > 0 && (
        <div className="mt-2 mb-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSubtasksExpanded(v => !v); }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", subtasksExpanded && "rotate-180")} />
            <span>{subtasks.length} subtarea{subtasks.length > 1 ? "s" : ""}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {subtasks.filter(s => s.status?.name?.toLowerCase().includes("completa") || s.status?.name?.toLowerCase().includes("done")).length}/{subtasks.length}
            </span>
          </button>
          {subtasksExpanded && (
            <div className="mt-1.5 space-y-1 pl-1">
              {subtasks.map(subtask => (
                <div
                  key={subtask.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal("task-detail-v2", { taskId: subtask.id });
                  }}
                  className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-accent/50 cursor-pointer group/sub"
                >
                  <div
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subtask.status?.color || "#94a3b8" }}
                  />
                  <span className="text-[11px] text-muted-foreground group-hover/sub:text-foreground truncate transition-colors">
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
            <div className="flex items-center justify-between">
                {/* Assignees */}
                <div className="flex -space-x-1">
                    {task.assignments?.slice(0, 3).map((assignment, idx) => (
                        <Avatar key={idx} className="h-6 w-6 border-2 border-card">
                            <AvatarFallback className="text-[10px] bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                                {assignment.user?.name?.slice(0, 2).toUpperCase() || "?"}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                    {(task.assignments?.length || 0) > 3 && (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-card">
                            +{task.assignments.length - 3}
                        </div>
                    )}
                </div>

                {/* Due date */}
                {task.dueDate && (
                    <div
                        className={cn(
                            "flex items-center gap-1 text-xs",
                            isOverdue ? "text-red-500" : "text-muted-foreground"
                        )}
                    >
                        <Calendar className="h-3 w-3" />
                        <span>
                            {new Date(task.dueDate).toLocaleDateString("es-CL", {
                                day: "numeric",
                                month: "short",
                            })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
