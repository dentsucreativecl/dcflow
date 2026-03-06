"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListTask, StatusOption, CustomFieldColumn } from "./types";
import { SortableRow } from "./sortable-row";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface ListGroupProps {
    title: string;
    color?: string;
    tasks: ListTask[];
    selectedTasks: Set<string>;
    onToggleTaskSelection: (id: string) => void;
    onClickTask: (id: string) => void;
    statuses?: StatusOption[];
    onUpdateTask?: (id: string, updates: Partial<ListTask>) => void;
    customFields?: CustomFieldColumn[];
    onSaveCustomField?: (fieldId: string, taskId: string, valueColumn: string, value: string | number | boolean | null) => void;
}

export function ListGroup({
    title, color, tasks, selectedTasks, onToggleTaskSelection, onClickTask, statuses, onUpdateTask,
    customFields, onSaveCustomField,
}: ListGroupProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-2 group">
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-muted text-muted-foreground"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <div className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => setIsCollapsed(!isCollapsed)}>
                    <Badge variant="secondary" className="px-2 py-0.5 h-6 text-sm font-medium border"
                        style={color ? { backgroundColor: `${color}20`, color: color, borderColor: `${color}40` } : undefined}>
                        {title}
                        <span className="ml-2 opacity-60 text-xs">{tasks.length}</span>
                    </Badge>
                </div>
            </div>

            {!isCollapsed && (
                <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0">
                        {tasks.map((task) => (
                            <SortableRow
                                key={task.id}
                                task={task}
                                isSelected={selectedTasks.has(task.id)}
                                onToggleSelection={onToggleTaskSelection}
                                onClick={onClickTask}
                                statuses={statuses}
                                onUpdateTask={onUpdateTask}
                                customFields={customFields}
                                onSaveCustomField={onSaveCustomField}
                            />
                        ))}
                    </div>
                </SortableContext>
            )}
        </div>
    );
}
