"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ListRow } from "./list-row";
import { ListTask, StatusOption, CustomFieldColumn } from "./types";

interface SortableRowProps {
    task: ListTask;
    isSelected: boolean;
    onToggleSelection: (taskId: string) => void;
    onClick: (taskId: string) => void;
    statuses?: StatusOption[];
    onUpdateTask?: (taskId: string, updates: Partial<ListTask>) => void;
    customFields?: CustomFieldColumn[];
    onSaveCustomField?: (fieldId: string, taskId: string, valueColumn: string, value: string | number | boolean | null) => void;
}

export function SortableRow({
    task,
    isSelected,
    onToggleSelection,
    onClick,
    statuses,
    onUpdateTask,
    customFields,
    onSaveCustomField,
}: SortableRowProps) {
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
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group">
            <div className="absolute left-0 top-0 bottom-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity -ml-6 z-10">
                <button
                    className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>
            <ListRow
                task={task}
                isSelected={isSelected}
                onToggleSelection={onToggleSelection}
                onClick={onClick}
                statuses={statuses}
                onUpdateTask={onUpdateTask}
                customFields={customFields}
                onSaveCustomField={onSaveCustomField}
            />
        </div>
    );
}
