"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit3, X, Zap } from "lucide-react";
import { useToast } from "@/components/ui/toast";

// ── Types ──────────────────────────────────────────────────────────

type TriggerType = "STATUS_CHANGED" | "TASK_CREATED" | "ASSIGNEE_ADDED" | "PRIORITY_CHANGED";
type ActionType = "CHANGE_STATUS" | "CHANGE_PRIORITY" | "ADD_ASSIGNEE" | "SEND_NOTIFICATION" | "ADD_COMMENT" | "MOVE_TO_LIST";
type PriorityValue = "URGENT" | "HIGH" | "NORMAL" | "LOW";

interface Automation {
    id: string;
    name: string;
    trigger: TriggerType;
    triggerValue: string | null;
    action: ActionType;
    actionValue: string | null;
    isActive: boolean;
    spaceId: string;
    createdAt: string;
}

interface StatusOption {
    id: string;
    name: string;
    color: string | null;
}

interface MemberOption {
    id: string;
    name: string;
}

interface ListOption {
    id: string;
    name: string;
}

interface AutomationManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spaceId: string;
}

// ── Labels ─────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
    STATUS_CHANGED: "Cambio de estado",
    TASK_CREATED: "Tarea creada",
    ASSIGNEE_ADDED: "Asignado",
    PRIORITY_CHANGED: "Cambio de prioridad",
};

const ACTION_LABELS: Record<ActionType, string> = {
    CHANGE_STATUS: "Cambiar estado",
    CHANGE_PRIORITY: "Cambiar prioridad",
    ADD_ASSIGNEE: "Agregar asignado",
    SEND_NOTIFICATION: "Enviar notificación",
    ADD_COMMENT: "Agregar comentario",
    MOVE_TO_LIST: "Mover a lista",
};

const TRIGGER_OPTIONS: TriggerType[] = ["STATUS_CHANGED", "TASK_CREATED", "ASSIGNEE_ADDED", "PRIORITY_CHANGED"];
const ACTION_OPTIONS: ActionType[] = ["CHANGE_STATUS", "CHANGE_PRIORITY", "ADD_ASSIGNEE", "SEND_NOTIFICATION", "ADD_COMMENT", "MOVE_TO_LIST"];

const PRIORITY_OPTIONS: { value: PriorityValue; label: string }[] = [
    { value: "URGENT", label: "Urgente" },
    { value: "HIGH", label: "Alta" },
    { value: "NORMAL", label: "Media" },
    { value: "LOW", label: "Baja" },
];

// ── Helpers ────────────────────────────────────────────────────────

function triggerNeedsValue(trigger: TriggerType): boolean {
    return trigger === "STATUS_CHANGED" || trigger === "PRIORITY_CHANGED";
}

function actionNeedsValue(action: ActionType): boolean {
    return true; // all actions need a value
}

// ── Component ──────────────────────────────────────────────────────

export function AutomationManager({ open, onOpenChange, spaceId }: AutomationManagerProps) {
    const { addToast } = useToast();

    // Data
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);

    // Related data for selects
    const [statuses, setStatuses] = useState<StatusOption[]>([]);
    const [members, setMembers] = useState<MemberOption[]>([]);
    const [lists, setLists] = useState<ListOption[]>([]);

    // Create form state
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newTrigger, setNewTrigger] = useState<TriggerType>("STATUS_CHANGED");
    const [newTriggerValue, setNewTriggerValue] = useState<string>("");
    const [newAction, setNewAction] = useState<ActionType>("CHANGE_STATUS");
    const [newActionValue, setNewActionValue] = useState<string>("");

    // Edit (rename)
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");

    // Delete confirmation
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // ── Fetch automations ──────────────────────────────────────────

    const fetchAutomations = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
            .from("Automation")
            .select("*")
            .eq("spaceId", spaceId)
            .order("createdAt");

        if (!error && data) {
            setAutomations(data as Automation[]);
        }
        setLoading(false);
    }, [spaceId]);

    // ── Fetch related data for form selects ────────────────────────

    const fetchRelatedData = useCallback(async () => {
        const supabase = createClient();

        const [statusRes, memberRes, listRes] = await Promise.all([
            supabase
                .from("Status")
                .select("id, name, color")
                .eq("spaceId", spaceId)
                .order("order"),
            supabase
                .from("SpaceMember")
                .select("user:User(id, name)")
                .eq("spaceId", spaceId),
            supabase
                .from("List")
                .select("id, name")
                .eq("spaceId", spaceId)
                .order("name"),
        ]);

        if (!statusRes.error && statusRes.data) {
            setStatuses(statusRes.data as StatusOption[]);
        }
        if (!memberRes.error && memberRes.data) {
            const mapped = memberRes.data
                .map((m: Record<string, unknown>) => {
                    const user = m.user as { id: string; name: string } | null;
                    return user ? { id: user.id, name: user.name } : null;
                })
                .filter(Boolean) as MemberOption[];
            setMembers(mapped);
        }
        if (!listRes.error && listRes.data) {
            setLists(listRes.data as ListOption[]);
        }
    }, [spaceId]);

    // ── Effects ────────────────────────────────────────────────────

    useEffect(() => {
        if (open && spaceId) {
            fetchAutomations();
            fetchRelatedData();
        }
    }, [open, spaceId, fetchAutomations, fetchRelatedData]);

    // ── CRUD handlers ──────────────────────────────────────────────

    const handleCreate = async () => {
        if (!newName.trim()) return;

        const supabase = createClient();

        const triggerValue = triggerNeedsValue(newTrigger) && newTriggerValue
            ? newTriggerValue
            : null;

        const actionValue = newActionValue || null;

        try {
            const { data, error } = await supabase
                .from("Automation")
                .insert({
                    name: newName.trim(),
                    trigger: newTrigger,
                    triggerValue,
                    action: newAction,
                    actionValue,
                    spaceId,
                })
                .select("*")
                .single();

            if (error) throw error;

            setAutomations(prev => [...prev, data as Automation]);
            resetCreateForm();
            addToast({ title: "Automatización creada", type: "success" });
        } catch {
            addToast({ title: "Error al crear automatización", type: "error" });
        }
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        const supabase = createClient();

        // Optimistic update
        setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive } : a));

        try {
            const { error } = await supabase
                .from("Automation")
                .update({ isActive })
                .eq("id", id);
            if (error) throw error;
        } catch {
            // Revert
            setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !isActive } : a));
            addToast({ title: "Error al actualizar estado", type: "error" });
        }
    };

    const handleRename = async (automationId: string) => {
        if (!editingName.trim()) return;
        const supabase = createClient();

        const oldName = automations.find(a => a.id === automationId)?.name || "";
        setAutomations(prev => prev.map(a => a.id === automationId ? { ...a, name: editingName.trim() } : a));
        setEditingId(null);

        try {
            const { error } = await supabase
                .from("Automation")
                .update({ name: editingName.trim() })
                .eq("id", automationId);
            if (error) throw error;
        } catch {
            setAutomations(prev => prev.map(a => a.id === automationId ? { ...a, name: oldName } : a));
            addToast({ title: "Error al renombrar", type: "error" });
        }
    };

    const handleDelete = async (automationId: string) => {
        const supabase = createClient();
        const removed = automations.find(a => a.id === automationId);

        setAutomations(prev => prev.filter(a => a.id !== automationId));
        setConfirmDeleteId(null);

        try {
            const { error } = await supabase
                .from("Automation")
                .delete()
                .eq("id", automationId);
            if (error) throw error;
            addToast({ title: "Automatización eliminada", type: "success" });
        } catch {
            if (removed) setAutomations(prev => [...prev, removed]);
            addToast({ title: "Error al eliminar", type: "error" });
        }
    };

    const resetCreateForm = () => {
        setCreating(false);
        setNewName("");
        setNewTrigger("STATUS_CHANGED");
        setNewTriggerValue("");
        setNewAction("CHANGE_STATUS");
        setNewActionValue("");
    };

    // ── Render helpers for trigger/action value selects ─────────────

    const renderTriggerValueSelect = () => {
        if (newTrigger === "STATUS_CHANGED") {
            return (
                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Cuando cambie a:
                    </label>
                    <Select value={newTriggerValue} onValueChange={setNewTriggerValue}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Seleccionar estado..." />
                        </SelectTrigger>
                        <SelectContent>
                            {statuses.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                    <span className="flex items-center gap-2">
                                        {s.color && (
                                            <span
                                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: s.color }}
                                            />
                                        )}
                                        {s.name}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            );
        }

        if (newTrigger === "PRIORITY_CHANGED") {
            return (
                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Cuando cambie a:
                    </label>
                    <Select value={newTriggerValue} onValueChange={setNewTriggerValue}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Seleccionar prioridad..." />
                        </SelectTrigger>
                        <SelectContent>
                            {PRIORITY_OPTIONS.map(p => (
                                <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            );
        }

        return null;
    };

    const renderActionValueSelect = () => {
        switch (newAction) {
            case "CHANGE_STATUS":
                return (
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Cambiar a estado:
                        </label>
                        <Select value={newActionValue} onValueChange={setNewActionValue}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Seleccionar estado..." />
                            </SelectTrigger>
                            <SelectContent>
                                {statuses.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                        <span className="flex items-center gap-2">
                                            {s.color && (
                                                <span
                                                    className="inline-block w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: s.color }}
                                                />
                                            )}
                                            {s.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );

            case "CHANGE_PRIORITY":
                return (
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Cambiar a prioridad:
                        </label>
                        <Select value={newActionValue} onValueChange={setNewActionValue}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Seleccionar prioridad..." />
                            </SelectTrigger>
                            <SelectContent>
                                {PRIORITY_OPTIONS.map(p => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );

            case "ADD_ASSIGNEE":
                return (
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Asignar a:
                        </label>
                        <Select value={newActionValue} onValueChange={setNewActionValue}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Seleccionar miembro..." />
                            </SelectTrigger>
                            <SelectContent>
                                {members.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );

            case "SEND_NOTIFICATION":
                return (
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Notificar a:
                        </label>
                        <Select value={newActionValue} onValueChange={setNewActionValue}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Seleccionar miembro..." />
                            </SelectTrigger>
                            <SelectContent>
                                {members.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );

            case "ADD_COMMENT":
                return (
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Contenido del comentario:
                        </label>
                        <Input
                            value={newActionValue}
                            onChange={(e) => setNewActionValue(e.target.value)}
                            placeholder="Escribir comentario..."
                            className="h-8 text-sm"
                        />
                    </div>
                );

            case "MOVE_TO_LIST":
                return (
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Mover a lista:
                        </label>
                        <Select value={newActionValue} onValueChange={setNewActionValue}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Seleccionar lista..." />
                            </SelectTrigger>
                            <SelectContent>
                                {lists.map(l => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );

            default:
                return null;
        }
    };

    // ── Render ─────────────────────────────────────────────────────

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Automatizaciones
                    </SheetTitle>
                    <SheetDescription>
                        Administra las reglas de automatización de este espacio
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                    {/* ── Existing automations list ── */}
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : automations.length === 0 && !creating ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No hay automatizaciones configuradas
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {automations.map(automation => (
                                <div
                                    key={automation.id}
                                    className="flex items-start gap-2 p-3 border rounded-lg group"
                                >
                                    <div className="flex-1 min-w-0 space-y-1">
                                        {editingId === automation.id ? (
                                            <Input
                                                autoFocus
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleRename(automation.id);
                                                    if (e.key === "Escape") setEditingId(null);
                                                }}
                                                onBlur={() => handleRename(automation.id)}
                                                className="h-7 text-sm"
                                            />
                                        ) : (
                                            <span className="text-sm font-semibold block truncate">
                                                {automation.name}
                                            </span>
                                        )}
                                        <div className="flex flex-wrap items-center gap-1">
                                            <Badge variant="secondary" className="text-[10px] h-5">
                                                {TRIGGER_LABELS[automation.trigger]}
                                            </Badge>
                                            <span className="text-muted-foreground text-[10px]">&rarr;</span>
                                            <Badge variant="outline" className="text-[10px] h-5">
                                                {ACTION_LABELS[automation.action]}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                        <Switch
                                            checked={automation.isActive}
                                            onCheckedChange={(checked) =>
                                                handleToggleActive(automation.id, checked)
                                            }
                                        />

                                        {confirmDeleteId === automation.id ? (
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="h-6 text-xs"
                                                    onClick={() => handleDelete(automation.id)}
                                                >
                                                    Si
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 text-xs"
                                                    onClick={() => setConfirmDeleteId(null)}
                                                >
                                                    No
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => {
                                                        setEditingId(automation.id);
                                                        setEditingName(automation.name);
                                                    }}
                                                >
                                                    <Edit3 className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                                    onClick={() => setConfirmDeleteId(automation.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Create form (collapsible) ── */}
                    {creating ? (
                        <div className="border rounded-lg p-4 space-y-3">
                            {/* Name */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Nombre
                                </label>
                                <Input
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Nombre de la automatización..."
                                    className="h-8 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") resetCreateForm();
                                    }}
                                />
                            </div>

                            {/* Trigger */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Disparador
                                </label>
                                <Select
                                    value={newTrigger}
                                    onValueChange={(v) => {
                                        setNewTrigger(v as TriggerType);
                                        setNewTriggerValue("");
                                    }}
                                >
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TRIGGER_OPTIONS.map(t => (
                                            <SelectItem key={t} value={t}>
                                                {TRIGGER_LABELS[t]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Trigger value (conditional) */}
                            {triggerNeedsValue(newTrigger) && renderTriggerValueSelect()}

                            {/* Action */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Acción
                                </label>
                                <Select
                                    value={newAction}
                                    onValueChange={(v) => {
                                        setNewAction(v as ActionType);
                                        setNewActionValue("");
                                    }}
                                >
                                    <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACTION_OPTIONS.map(a => (
                                            <SelectItem key={a} value={a}>
                                                {ACTION_LABELS[a]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Action value (conditional) */}
                            {renderActionValueSelect()}

                            {/* Submit / Cancel */}
                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    size="sm"
                                    onClick={handleCreate}
                                    disabled={!newName.trim()}
                                >
                                    Crear automatización
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
                            Agregar automatización
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
