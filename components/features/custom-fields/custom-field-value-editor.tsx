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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/components/ui/toast";

export interface CustomFieldWithValue {
    id: string;
    name: string;
    type: string;
    isRequired: boolean;
    options: string[] | null;
    value: {
        id?: string;
        textValue?: string | null;
        numberValue?: number | null;
        dateValue?: string | null;
        selectValue?: string | null;
        checkboxValue?: boolean | null;
    } | null;
}

interface CustomFieldValueEditorProps {
    field: CustomFieldWithValue;
    taskId: string;
    onValueChange?: (fieldId: string, newValue: CustomFieldWithValue["value"]) => void;
}

export function CustomFieldValueEditor({ field, taskId, onValueChange }: CustomFieldValueEditorProps) {
    const { addToast } = useToast();
    const [localText, setLocalText] = useState(field.value?.textValue || "");
    const [localNumber, setLocalNumber] = useState(field.value?.numberValue?.toString() || "");

    const saveValue = async (valueColumn: string, value: string | number | boolean | null) => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from("CustomFieldValue")
                .upsert(
                    {
                        customFieldId: field.id,
                        taskId,
                        [valueColumn]: value,
                    },
                    { onConflict: "customFieldId,taskId" }
                );
            if (error) throw error;

            // Update parent state
            onValueChange?.(field.id, {
                ...field.value,
                [valueColumn]: value,
            });
        } catch {
            addToast({ title: "Error al guardar campo", type: "error" });
        }
    };

    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                {field.name}
                {field.isRequired && <span className="text-destructive">*</span>}
            </label>

            {field.type === "TEXT" && (
                <Input
                    value={localText}
                    onChange={(e) => setLocalText(e.target.value)}
                    onBlur={() => saveValue("textValue", localText || null)}
                    placeholder="Escribe..."
                    className="h-8 text-sm"
                />
            )}

            {field.type === "NUMBER" && (
                <Input
                    type="number"
                    value={localNumber}
                    onChange={(e) => setLocalNumber(e.target.value)}
                    onBlur={() => saveValue("numberValue", localNumber ? parseFloat(localNumber) : null)}
                    placeholder="0"
                    className="h-8 text-sm"
                />
            )}

            {field.type === "DATE" && (
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 h-8 px-3 text-sm border rounded-md w-full hover:bg-accent/50 transition-colors text-left">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {field.value?.dateValue
                                ? format(new Date(field.value.dateValue), "d MMM yyyy", { locale: es })
                                : <span className="text-muted-foreground">Seleccionar fecha</span>
                            }
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value?.dateValue ? new Date(field.value.dateValue) : undefined}
                            onSelect={(date) => saveValue("dateValue", date?.toISOString() || null)}
                        />
                    </PopoverContent>
                </Popover>
            )}

            {field.type === "SELECT" && (
                <Select
                    value={field.value?.selectValue || ""}
                    onValueChange={(v) => saveValue("selectValue", v || null)}
                >
                    <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                        {(field.options || []).map(opt => (
                            <SelectItem key={opt} value={opt}>
                                {opt}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {field.type === "CHECKBOX" && (
                <div className="flex items-center gap-2 h-8">
                    <Checkbox
                        checked={field.value?.checkboxValue || false}
                        onCheckedChange={(checked) => saveValue("checkboxValue", !!checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                        {field.value?.checkboxValue ? "Si" : "No"}
                    </span>
                </div>
            )}

            {field.type === "URL" && (
                <div className="flex items-center gap-1">
                    <Input
                        type="url"
                        value={localText}
                        onChange={(e) => setLocalText(e.target.value)}
                        onBlur={() => saveValue("textValue", localText || null)}
                        placeholder="https://..."
                        className="h-8 text-sm"
                    />
                    {localText && (
                        <a
                            href={localText}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1.5 hover:bg-accent rounded"
                        >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
