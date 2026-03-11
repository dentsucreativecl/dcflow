"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React from "react";
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
        <div ref={setNodeRef} style={style}>
            <ListRow
                task={task}
                isSelected={isSelected}
                onToggleSelection={onToggleSelection}
                onClick={onClick}
                statuses={statuses}
                onUpdateTask={onUpdateTask}
                customFields={customFields}
                onSaveCustomField={onSaveCustomField}
                dragHandleListeners={listeners as React.HTMLAttributes<HTMLElement>}
                dragHandleAttributes={attributes as React.HTMLAttributes<HTMLElement>}
            />
        </div>
    );
}
