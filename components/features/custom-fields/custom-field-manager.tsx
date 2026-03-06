"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit3, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX" | "URL";

export interface CustomField {
    id: string;
    name: string;
    type: CustomFieldType;
    isRequired: boolean;
    options: string[] | null;
}

interface CustomFieldManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId: string;
    onFieldsChanged?: () => void;
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
    TEXT: "Texto",
    NUMBER: "Numero",
    DATE: "Fecha",
    SELECT: "Seleccion",
    CHECKBOX: "Casilla",
    URL: "URL",
};

const FIELD_TYPE_OPTIONS: CustomFieldType[] = ["TEXT", "NUMBER", "DATE", "SELECT", "CHECKBOX", "URL"];

export function CustomFieldManager({
    open,
    onOpenChange,
    spaceId,
    onFieldsChanged,
}: CustomFieldManagerProps) {
    const { addToast } = useToast();
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);

    // Create form
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newType, setNewType] = useState<CustomFieldType>("TEXT");
    const [newRequired, setNewRequired] = useState(false);
    const [newOptions, setNewOptions] = useState("");

    // Edit
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");

    // Delete confirm
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (open && spaceId) fetchFields();
    }, [open, spaceId]);

    const fetchFields = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
            .from("CustomField")
            .select("id, name, type, isRequired, options")
            .eq("spaceId", spaceId)
            .order("createdAt");

        if (!error && data) {
            setFields(data.map(f => ({
                ...f,
                type: f.type as CustomFieldType,
                options: f.options as string[] | null,
            })));
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        const supabase = createClient();

        const options = newType === "SELECT" && newOptions.trim()
            ? newOptions.split(",").map(o => o.trim()).filter(Boolean)
            : null;

        try {
            const { data, error } = await supabase
                .from("CustomField")
                .insert({
                    name: newName.trim(),
                    type: newType,
                    isRequired: newRequired,
                    options,
                    spaceId,
                })
                .select("id, name, type, isRequired, options")
                .single();

            if (error) throw error;

            setFields(prev => [...prev, {
                ...data,
                type: data.type as CustomFieldType,
                options: data.options as string[] | null,
            }]);
            resetCreateForm();
            onFieldsChanged?.();
            addToast({ title: "Campo creado", type: "success" });
        } catch {
            addToast({ title: "Error al crear campo", type: "error" });
        }
    };

    const handleRename = async (fieldId: string) => {
        if (!editingName.trim()) return;
        const supabase = createClient();

        const oldName = fields.find(f => f.id === fieldId)?.name || "";
        setFields(prev => prev.map(f => f.id === fieldId ? { ...f, name: editingName.trim() } : f));
        setEditingId(null);

        try {
            const { error } = await supabase
                .from("CustomField")
                .update({ name: editingName.trim() })
                .eq("id", fieldId);
            if (error) throw error;
            onFieldsChanged?.();
        } catch {
            setFields(prev => prev.map(f => f.id === fieldId ? { ...f, name: oldName } : f));
            addToast({ title: "Error al renombrar", type: "error" });
        }
    };

    const handleDelete = async (fieldId: string) => {
        const supabase = createClient();
        const removed = fields.find(f => f.id === fieldId);

        setFields(prev => prev.filter(f => f.id !== fieldId));
        setConfirmDeleteId(null);

        try {
            const { error } = await supabase
                .from("CustomField")
                .delete()
                .eq("id", fieldId);
            if (error) throw error;
            onFieldsChanged?.();
            addToast({ title: "Campo eliminado", type: "success" });
        } catch {
            if (removed) setFields(prev => [...prev, removed]);
            addToast({ title: "Error al eliminar", type: "error" });
        }
    };

    const resetCreateForm = () => {
        setCreating(false);
        setNewName("");
        setNewType("TEXT");
        setNewRequired(false);
        setNewOptions("");
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Campos personalizados</SheetTitle>
                    <SheetDescription>
                        Administra los campos personalizados de este espacio
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                    {/* Existing fields */}
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : fields.length === 0 && !creating ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No hay campos personalizados
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {fields.map(field => (
                                <div
                                    key={field.id}
                                    className="flex items-center gap-2 p-3 border rounded-lg group"
                                >
                                    {editingId === field.id ? (
                                        <Input
                                            autoFocus
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleRename(field.id);
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                            onBlur={() => handleRename(field.id)}
                                            className="h-7 text-sm flex-1"
                                        />
                                    ) : (
                                        <span className="text-sm font-medium flex-1 truncate">
                                            {field.name}
                                        </span>
                                    )}
                                    <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                                        {FIELD_TYPE_LABELS[field.type]}
                                    </Badge>
                                    {field.isRequired && (
                                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                                            Requerido
                                        </Badge>
                                    )}
                                    {confirmDeleteId === field.id ? (
                                        <div className="flex items-center gap-1">
                                            <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => handleDelete(field.id)}>
                                                Si
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setConfirmDeleteId(null)}>
                                                No
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                                setEditingId(field.id);
                                                setEditingName(field.name);
                                            }}>
                                                <Edit3 className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(field.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create form */}
                    {creating ? (
                        <div className="border rounded-lg p-4 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre</label>
                                <Input
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Nombre del campo..."
                                    className="h-8 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newName.trim()) handleCreate();
                                        if (e.key === "Escape") resetCreateForm();
                                    }}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                                <Select value={newType} onValueChange={(v) => setNewType(v as CustomFieldType)}>
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FIELD_TYPE_OPTIONS.map(type => (
                                            <SelectItem key={type} value={type}>
                                                {FIELD_TYPE_LABELS[type]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {newType === "SELECT" && (
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                        Opciones (separadas por coma)
                                    </label>
                                    <Input
                                        value={newOptions}
                                        onChange={(e) => setNewOptions(e.target.value)}
                                        placeholder="Opcion 1, Opcion 2, Opcion 3"
                                        className="h-8 text-sm"
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="cf-required"
                                    checked={newRequired}
                                    onCheckedChange={(v) => setNewRequired(!!v)}
                                />
                                <label htmlFor="cf-required" className="text-xs text-muted-foreground">
                                    Campo requerido
                                </label>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                                    Crear campo
                                </Button>
                                <Button size="sm" variant="ghost" onClick={resetCreateForm}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setCreating(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar campo
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
