"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CustomFieldColumn } from "@/components/features/list-view/types";

interface CustomFieldValueData {
    textValue?: string | null;
    numberValue?: number | null;
    dateValue?: string | null;
    selectValue?: string | null;
    checkboxValue?: boolean | null;
}

interface InlineCustomFieldCellProps {
    field: CustomFieldColumn;
    value: CustomFieldValueData | null;
    taskId: string;
    onSave: (fieldId: string, taskId: string, valueColumn: string, value: string | number | boolean | null) => void;
}

export function InlineCustomFieldCell({ field, value, taskId, onSave }: InlineCustomFieldCellProps) {
    const [editing, setEditing] = useState(false);
    const [localValue, setLocalValue] = useState("");

    const handleStartEdit = (currentVal: string) => {
        setLocalValue(currentVal);
        setEditing(true);
    };

    const handleSaveText = (valueColumn: string) => {
        onSave(field.id, taskId, valueColumn, localValue || null);
        setEditing(false);
    };

    if (field.type === "TEXT" || field.type === "URL") {
        const currentVal = value?.textValue || "";
        if (editing) {
            return (
                <div onClick={(e) => e.stopPropagation()}>
                    <Input
                        autoFocus
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={() => handleSaveText("textValue")}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveText("textValue");
                            if (e.key === "Escape") setEditing(false);
                        }}
                        className="h-7 text-xs"
                        type={field.type === "URL" ? "url" : "text"}
                    />
                </div>
            );
        }
        return (
            <div
                className="text-xs truncate text-muted-foreground hover:text-foreground cursor-pointer min-h-[28px] flex items-center"
                onClick={(e) => { e.stopPropagation(); handleStartEdit(currentVal); }}
                title={currentVal || "Sin valor"}
            >
                {field.type === "URL" && currentVal ? (
                    <a
                        href={currentVal}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate">{currentVal}</span>
                    </a>
                ) : (
                    currentVal || "-"
                )}
            </div>
        );
    }

    if (field.type === "NUMBER") {
        const currentVal = value?.numberValue;
        if (editing) {
            return (
                <div onClick={(e) => e.stopPropagation()}>
                    <Input
                        autoFocus
                        type="number"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={() => {
                            onSave(field.id, taskId, "numberValue", localValue ? parseFloat(localValue) : null);
                            setEditing(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                onSave(field.id, taskId, "numberValue", localValue ? parseFloat(localValue) : null);
                                setEditing(false);
                            }
                            if (e.key === "Escape") setEditing(false);
                        }}
                        className="h-7 text-xs"
                    />
                </div>
            );
        }
        return (
            <div
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer min-h-[28px] flex items-center"
                onClick={(e) => { e.stopPropagation(); handleStartEdit(currentVal?.toString() || ""); }}
            >
                {currentVal !== null && currentVal !== undefined ? currentVal : "-"}
            </div>
        );
    }

    if (field.type === "DATE") {
        const currentDate = value?.dateValue ? new Date(value.dateValue) : null;
        return (
            <div onClick={(e) => e.stopPropagation()}>
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="text-xs text-muted-foreground hover:text-foreground min-h-[28px] flex items-center">
                            {currentDate ? format(currentDate, "d MMM", { locale: es }) : "-"}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={currentDate || undefined}
                            onSelect={(date) => onSave(field.id, taskId, "dateValue", date?.toISOString() || null)}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    if (field.type === "SELECT") {
        const currentVal = value?.selectValue || "";
        return (
            <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="text-xs min-h-[28px] flex items-center">
                            {currentVal ? (
                                <Badge variant="secondary" className="text-[10px] h-5">
                                    {currentVal}
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground">-</span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {(field.options || []).map(opt => (
                            <DropdownMenuItem
                                key={opt}
                                onClick={() => onSave(field.id, taskId, "selectValue", opt)}
                            >
                                {opt}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    }

    if (field.type === "CHECKBOX") {
        return (
            <div className="flex items-center min-h-[28px]" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={value?.checkboxValue || false}
                    onCheckedChange={(checked) => onSave(field.id, taskId, "checkboxValue", !!checked)}
                />
            </div>
        );
    }

    return <span className="text-xs text-muted-foreground">-</span>;
}
