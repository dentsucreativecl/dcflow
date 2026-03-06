"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ListTask, StatusOption, CustomFieldColumn } from "./types";
import { ListRow } from "./list-row";
import { ListGroup } from "./list-group";
import { SortableRow } from "./sortable-row";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface ListViewProps {
    tasks: ListTask[];
    selectedTasks: Set<string>;
    onToggleTaskSelection: (taskId: string) => void;
    onOpenTask: (taskId: string) => void;
    listId?: string;
    statuses?: StatusOption[];
    onUpdateTask?: (taskId: string, updates: Partial<ListTask>) => void;
    groupBy?: "none" | "status" | "priority";
    onReorderTasks?: (tasks: ListTask[]) => void;
    customFields?: CustomFieldColumn[];
    onSaveCustomField?: (fieldId: string, taskId: string, valueColumn: string, value: string | number | boolean | null) => void;
}

export function ListView({
    tasks: initialTasks,
    selectedTasks,
    onToggleTaskSelection,
    onOpenTask,
    listId,
    statuses = [],
    onUpdateTask,
    groupBy = "none",
    onReorderTasks,
    customFields = [],
    onSaveCustomField,
}: ListViewProps) {
    const [tasks, setTasks] = useState(initialTasks);

    // Update tasks when initialTasks change (from server refresh)
    useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const { openModal } = useAppStore();

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = tasks.findIndex((task) => task.id === active.id);
        const newIndex = tasks.findIndex((task) => task.id === over.id);

        const newTasks = arrayMove(tasks, oldIndex, newIndex);
        setTasks(newTasks);

        // Call parent handler if provided
        if (onReorderTasks) {
            onReorderTasks(newTasks);
        }
    };

    if (tasks.length === 0) {
        return (
            <div className="px-4 py-12 text-center text-muted-foreground">
                <p>No hay tareas en esta lista</p>
                <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => listId && openModal("new-task-v2", { projectId: listId })}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primera tarea
                </Button>
            </div>
        );
    }

    const renderContent = () => {
        if (groupBy === "status") {
            // Group tasks by status
            const groupedTasks: Record<string, ListTask[]> = {};
            // Initialize groups with empty arrays for all statuses
            statuses.forEach((status) => {
                groupedTasks[status.id] = [];
            });
            groupedTasks["uncategorized"] = [];

            tasks.forEach((task) => {
                if (task.status && task.status.id) {
                    if (!groupedTasks[task.status.id]) {
                        // Handle case where task has a status not in the fetched list
                        groupedTasks[task.status.id] = [];
                    }
                    groupedTasks[task.status.id].push(task);
                } else {
                    groupedTasks["uncategorized"].push(task);
                }
            });

            return (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="space-y-4 pt-2">
                    {statuses.map((status) => {
                        const groupTasks = groupedTasks[status.id] || [];
                        return (
                            <ListGroup
                                key={status.id}
                                title={status.name}
                                color={status.color}
                                tasks={groupTasks}
                                selectedTasks={selectedTasks}
                                onToggleTaskSelection={onToggleTaskSelection}
                                onClickTask={onOpenTask}
                                statuses={statuses}
                                onUpdateTask={onUpdateTask}
                                customFields={customFields}
                                onSaveCustomField={onSaveCustomField}
                            />
                        );
                    })}
                    {/* Render uncategorized if any */}
                    {groupedTasks["uncategorized"].length > 0 && (
                        <ListGroup
                            title="Sin Estado"
                            tasks={groupedTasks["uncategorized"]}
                            selectedTasks={selectedTasks}
                            onToggleTaskSelection={onToggleTaskSelection}
                            onClickTask={onOpenTask}
                            statuses={statuses}
                            onUpdateTask={onUpdateTask}
                            customFields={customFields}
                            onSaveCustomField={onSaveCustomField}
                        />
                    )}
                </div>
                </DndContext>
            );
        }

        if (groupBy === "priority") {
            // Group tasks by priority
            const priorityOrder = ["URGENT", "HIGH", "NORMAL", "MEDIUM", "LOW", "NONE"];
            const priorityConfig: Record<string, { color: string; label: string }> = {
                URGENT: { color: "#ef4444", label: "Urgente" },
                HIGH: { color: "#f97316", label: "Alta" },
                NORMAL: { color: "#eab308", label: "Media" },
                MEDIUM: { color: "#eab308", label: "Media" },
                LOW: { color: "#3b82f6", label: "Baja" },
                NONE: { color: "#64748b", label: "Sin prioridad" },
            };

            const groupedTasks: Record<string, ListTask[]> = {};
            priorityOrder.forEach((priority) => {
                groupedTasks[priority] = [];
            });

            tasks.forEach((task) => {
                const priority = task.priority || "NONE";
                if (!groupedTasks[priority]) {
                    groupedTasks[priority] = [];
                }
                groupedTasks[priority].push(task);
            });

            return (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="space-y-4 pt-2">
                    {priorityOrder.map((priority) => {
                        const groupTasks = groupedTasks[priority] || [];
                        if (groupTasks.length === 0) return null;

                        return (
                            <ListGroup
                                key={priority}
                                title={priorityConfig[priority].label}
                                color={priorityConfig[priority].color}
                                tasks={groupTasks}
                                selectedTasks={selectedTasks}
                                onToggleTaskSelection={onToggleTaskSelection}
                                onClickTask={onOpenTask}
                                statuses={statuses}
                                onUpdateTask={onUpdateTask}
                                customFields={customFields}
                                onSaveCustomField={onSaveCustomField}
                            />
                        );
                    })}
                </div>
                </DndContext>
            );
        }

        // Default flat list with drag and drop
        return (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div>
                        {tasks.map((task) => (
                            <SortableRow
                                key={task.id}
                                task={task}
                                isSelected={selectedTasks.has(task.id)}
                                onToggleSelection={onToggleTaskSelection}
                                onClick={onOpenTask}
                                statuses={statuses}
                                onUpdateTask={onUpdateTask}
                                customFields={customFields}
                                onSaveCustomField={onSaveCustomField}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        );
    };

    return (
        <div className="bg-card rounded-lg border border-border">
            {groupBy === "none" && (
                <div
                    style={{ gridTemplateColumns: `auto 1fr 120px 100px 100px 90px ${customFields.map(() => "120px").join(" ")} 40px`.trim() }}
                    className="grid gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground"
                >
                    <div className="w-4"></div> {/* Checkbox placeholder */}
                    <div>Nombre</div>
                    <div>Estado</div>
                    <div>Asignados</div>
                    <div>Fecha</div>
                    <div>Prioridad</div>
                    {customFields.map(cf => (
                        <div key={cf.id} className="truncate" title={cf.name}>{cf.name}</div>
                    ))}
                    <div></div> {/* Actions placeholder */}
                </div>
            )}

            {renderContent()}
        </div>
    );
}
