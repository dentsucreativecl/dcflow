"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
    MoreHorizontal,
    GripVertical,
    Calendar,
    MessageSquare,
    Paperclip,
    Layers,
    Lock,
    ChevronDown,
} from "lucide-react";
import { ListTask, StatusOption, CustomFieldColumn } from "./types";
import { InlineCustomFieldCell } from "@/components/features/custom-fields/inline-custom-field-cell";

interface ListRowProps {
    task: ListTask;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onClick: (id: string) => void;
    statuses?: StatusOption[];
    onUpdateTask?: (id: string, updates: Partial<ListTask>) => void;
    customFields?: CustomFieldColumn[];
    onSaveCustomField?: (fieldId: string, taskId: string, valueColumn: string, value: string | number | boolean | null) => void;
    dragHandleListeners?: React.HTMLAttributes<HTMLElement>;
    dragHandleAttributes?: React.HTMLAttributes<HTMLElement>;
}

const priorityConfig: Record<string, { color: string; label: string; icon: string }> = {
    URGENT: { color: "bg-red-500", label: "Urgente", icon: "🔴" },
    HIGH: { color: "bg-orange-500", label: "Alta", icon: "🟠" },
    NORMAL: { color: "bg-yellow-500", label: "Media", icon: "🟡" },
    MEDIUM: { color: "bg-yellow-500", label: "Media", icon: "🟡" },
    LOW: { color: "bg-blue-500", label: "Baja", icon: "🔵" },
    NONE: { color: "bg-slate-500", label: "Sin prioridad", icon: "⚪" },
};

export function ListRow({
    task,
    isSelected,
    onToggleSelection,
    onClick,
    statuses = [],
    onUpdateTask,
    customFields = [],
    onSaveCustomField,
    dragHandleListeners,
    dragHandleAttributes,
}: ListRowProps) {
    const { openModal } = useAppStore();
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState(task.title);
    const [subtasksExpanded, setSubtasksExpanded] = useState(false);
    const subtasks = task.subtasks || [];

    const priority = priorityConfig[task.priority] || priorityConfig.NONE;

    const handleStatusClick = (status: StatusOption) => {
        if (onUpdateTask) {
            onUpdateTask(task.id, { status });
        }
    };

    const handlePriorityClick = (newPriority: string) => {
        if (onUpdateTask) {
            onUpdateTask(task.id, { priority: newPriority as ListTask["priority"] });
        }
    };

    const handleTitleSave = () => {
        if (titleValue.trim() && titleValue !== task.title && onUpdateTask) {
            onUpdateTask(task.id, { title: titleValue.trim() } as Partial<ListTask>);
        }
        setEditingTitle(false);
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (onUpdateTask) {
            onUpdateTask(task.id, { dueDate: date?.toISOString() || null } as Partial<ListTask>);
        }
    };

    return (
        <>
        <div
            onClick={() => onClick(task.id)}
            style={{ gridTemplateColumns: `auto 1fr 120px 100px 100px 90px ${customFields.map(() => "120px").join(" ")} 40px`.trim() }}
            className={cn(
                "grid gap-2 px-4 py-3 border-b hover:bg-muted/30 cursor-pointer items-center group transition-colors",
                isSelected && "bg-primary/5"
            )}
        >
            {/* Checkbox */}
            <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection(task.id)}
                    className={cn(
                        "transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                />
            </div>

            {/* Name */}
            <div className="flex items-center gap-2 min-w-0">
                <span
                    className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0 touch-none"
                    onClick={(e) => e.stopPropagation()}
                    {...dragHandleListeners}
                    {...dragHandleAttributes}
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </span>
                {task.isBlocked && (
                    <span title={task.blockedByTitles?.join(", ") || "Bloqueada"}>
                        <Lock className="h-3.5 w-3.5 text-destructive shrink-0" />
                    </span>
                )}
                {editingTitle ? (
                    <Input
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        className="h-7 text-sm font-medium"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleTitleSave();
                            if (e.key === "Escape") { setTitleValue(task.title); setEditingTitle(false); }
                        }}
                        onBlur={handleTitleSave}
                    />
                ) : (
                    <span
                        className="font-medium text-sm leading-snug truncate"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
                        title="Doble click para editar"
                    >
                        {task.title}
                    </span>
                )}
                {task._count && task._count.comments > 0 && (
                    <div className="flex items-center text-xs text-muted-foreground ml-2 shrink-0">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {task._count.comments}
                    </div>
                )}
                {task._count && task._count.attachments > 0 && (
                    <div className="flex items-center text-xs text-muted-foreground ml-2 shrink-0">
                        <Paperclip className="h-3 w-3 mr-1" />
                        {task._count.attachments}
                    </div>
                )}
                {subtasks.length > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setSubtasksExpanded(v => !v); }}
                        className="flex items-center text-xs text-muted-foreground ml-2 shrink-0 hover:text-foreground transition-colors"
                        title={subtasksExpanded ? "Ocultar subtareas" : "Ver subtareas"}
                    >
                        <Layers className="h-3 w-3 mr-1" />
                        {subtasks.length}
                        <ChevronDown className={cn("h-3 w-3 ml-0.5 transition-transform", subtasksExpanded && "rotate-180")} />
                    </button>
                )}
            </div>

            {/* Status */}
            <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                            {task.status ? (
                                <Badge
                                    variant="secondary"
                                    style={{ backgroundColor: task.status.color + "20", color: task.status.color }}
                                >
                                    {task.status.name}
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                    Sin estado
                                </Badge>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {statuses.map((status) => (
                            <DropdownMenuItem
                                key={status.id}
                                onClick={() => handleStatusClick(status)}
                            >
                                <span
                                    className="h-2 w-2 rounded-full mr-2"
                                    style={{ backgroundColor: status.color }}
                                />
                                {status.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Assignees */}
            <div className="flex -space-x-2">
                {task.assignments?.slice(0, 3).map((assignment, idx) => (
                    <Avatar key={idx} className="h-7 w-7 border-2 border-background">
                        <AvatarFallback className="text-xs bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                            {assignment.user?.name?.slice(0, 2).toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                ))}
                {(task.assignments?.length || 0) > 3 && (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                        +{task.assignments.length - 3}
                    </div>
                )}
                {!task.assignments?.length && (
                    <span className="text-muted-foreground text-sm pl-2">—</span>
                )}
            </div>

            {/* Due Date - Inline Picker */}
            <div onClick={(e) => e.stopPropagation()}>
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 text-sm hover:bg-accent rounded px-1 h-7 transition-colors">
                            {task.dueDate ? (
                                <>
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>{new Date(task.dueDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                            mode="single"
                            selected={task.dueDate ? new Date(task.dueDate) : undefined}
                            onSelect={handleDateSelect}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Priority */}
            <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-xs",
                                    priority.color.includes("bg-") ? priority.color.replace("bg-", "border- text-") : ""
                                )}
                            >
                                <span className="mr-1">{priority.icon}</span> {priority.label}
                            </Badge>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {Object.entries(priorityConfig)
                            .filter(([key]) => key !== 'MEDIUM')
                            .map(([key, config]) => (
                                <DropdownMenuItem
                                    key={key}
                                    onClick={() => handlePriorityClick(key)}
                                >
                                    <span className="mr-2">{config.icon}</span> {config.label}
                                </DropdownMenuItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Custom Fields */}
            {customFields.map(cf => (
                <InlineCustomFieldCell
                    key={cf.id}
                    field={cf}
                    value={task.customFieldValues?.[cf.id] || null}
                    taskId={task.id}
                    onSave={onSaveCustomField || (() => {})}
                />
            ))}

            {/* Actions */}
            <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onClick(task.id)}>
                            Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                            Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {/* Subtask rows */}
        {subtasksExpanded && subtasks.map(subtask => (
            <div
                key={subtask.id}
                onClick={() => openModal("task-detail-v2", { taskId: subtask.id })}
                className="flex items-center gap-2 pl-12 pr-4 py-2 border-b bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
            >
                <div
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subtask.status?.color || "#94a3b8" }}
                />
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate">
                    {subtask.title}
                </span>
                {subtask.status && (
                    <span
                        className="ml-auto text-[11px] px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ backgroundColor: subtask.status.color + "20", color: subtask.status.color }}
                    >
                        {subtask.status.name}
                    </span>
                )}
            </div>
        ))}
        </>
    );
}
