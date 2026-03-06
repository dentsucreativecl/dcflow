"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { runAutomations } from "@/lib/automation-engine";

const taskSchema = z.object({
    title: z.string().min(1, "El título es requerido"),
    description: z.string().optional(),
    listId: z.string().min(1, "La lista es requerida"),
    assigneeId: z.string().optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
    dueDate: z.date().optional(),
    estimatedHours: z.number().min(0).optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface ListOption {
    id: string;
    name: string;
    spaceName: string;
    spaceId: string;
}

interface UserOption {
    id: string;
    name: string;
    avatarUrl: string | null;
}

export function NewTaskModalV2() {
    const { activeModal, closeModal, modalData } = useAppStore();
    const { user } = useAuth();
    const { addToast } = useToast();

    const [lists, setLists] = useState<ListOption[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserOption[]>([]);
    const [loadingLists, setLoadingLists] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<TaskFormData>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: "",
            description: "",
            priority: "NORMAL",
            estimatedHours: 0,
        },
    });

    const dueDate = watch("dueDate");
    const assigneeId = watch("assigneeId");
    const listId = watch("listId"); // Watch list selection to prefill status later if needed

    const isOpen = activeModal === "new-task-v2";

    // Load initial data (Lists and Users)
    useEffect(() => {
        if (!isOpen) return;

        async function fetchInitialData() {
            setLoadingLists(true);
            const supabase = createClient();

            try {
                // Fetch Lists grouped by Space
                const { data: listsData } = await supabase
                    .from("List")
                    .select("id, name, space:Space(id, name)")
                    .order("name");

                if (listsData) {
                    const formattedLists = listsData.map((l) => {
                        const space = Array.isArray(l.space) ? l.space[0] : l.space;
                        return {
                            id: l.id,
                            name: l.name,
                            spaceName: space?.name || "Sin espacio",
                            spaceId: space?.id,
                        };
                    }).sort((a, b) => a.spaceName.localeCompare(b.spaceName));
                    setLists(formattedLists);
                }

                // Fetch Users
                const { data: usersData } = await supabase
                    .from("User")
                    .select("id, name, avatarUrl")
                    .order("name");

                if (usersData) {
                    setTeamMembers(usersData);
                }

                // Pre-select list if provided in modalData
                if (modalData?.projectId) {
                    setValue("listId", modalData.projectId);
                }

            } catch (error) {
                console.error("Error fetching initial data:", error);
            } finally {
                setLoadingLists(false);
            }
        }

        fetchInitialData();
    }, [isOpen, modalData, setValue]);

    const handleClose = () => {
        reset();
        closeModal();
    };

    const onSubmit = async (data: TaskFormData) => {
        if (!user) {
            addToast({ title: "Error", description: "No autenticado", type: "error" });
            return;
        }

        const supabase = createClient();

        try {
            // 1. Get a default status for the selected list/space
            const selectedList = lists.find(l => l.id === data.listId);
            if (!selectedList) throw new Error("Lista inválida");

            // Try to find status for this List specifically first, then Space default
            // For simplicity MVP: get first status of the space
            const { data: statuses } = await supabase
                .from("Status")
                .select("id")
                .eq("spaceId", selectedList.spaceId)
                .order("order", { ascending: true })
                .limit(1);

            const defaultStatusId = statuses?.[0]?.id;

            if (!defaultStatusId) throw new Error("No se encontró un estado inicial para esta lista.");

            // 2. Create Task
            const now = new Date().toISOString();
            const { data: newTask, error: taskError } = await supabase
                .from("Task")
                .insert({
                    id: self.crypto.randomUUID(),
                    title: data.title,
                    description: data.description || null,
                    listId: data.listId,
                    statusId: defaultStatusId,
                    priority: data.priority,
                    dueDate: data.dueDate?.toISOString() || null,
                    estimatedHours: data.estimatedHours || 0,
                    createdById: user.id,
                    createdAt: now,
                    updatedAt: now,
                })
                .select()
                .single();

            if (taskError) throw taskError;

            // 3. Create Assignment (if selected)
            if (data.assigneeId) {
                await supabase
                    .from("TaskAssignment")
                    .insert({
                        taskId: newTask.id,
                        userId: data.assigneeId,
                    });
            }

            // Log task creation activity
            supabase.from("Activity").insert({
                taskId: newTask.id,
                userId: user.id,
                type: "CREATED",
                field: null,
                oldValue: null,
                newValue: data.title,
                createdAt: now,
            });

            // Run TASK_CREATED automations
            await runAutomations({
                spaceId: selectedList.spaceId,
                trigger: "TASK_CREATED",
                taskId: newTask.id,
                userId: user.id,
            });

            addToast({
                title: "Tarea creada",
                description: `"${data.title}" se creó correctamente.`,
                type: "success",
            });

            // Notify list views to refresh
            window.dispatchEvent(new CustomEvent('dcflow:refresh'));

            handleClose();

        } catch (error: unknown) {
            console.error("Error creating task:", error);
            addToast({
                title: "Error",
                description: error instanceof Error ? error.message : "Error desconocido",
                type: "error",
            });
        }
    };

    const selectedAssignee = assigneeId
        ? teamMembers.find((m) => m.id === assigneeId)
        : null;

    // Group lists by Space
    const groupedLists = lists.reduce((groups, list) => {
        const space = list.spaceName;
        if (!groups[space]) groups[space] = [];
        groups[space].push(list);
        return groups;
    }, {} as Record<string, ListOption[]>);

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                        Nueva Tarea
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
                    {/* List Selection */}
                    <div className="space-y-2">
                        <Label>
                            Lista <span className="text-destructive">*</span>
                        </Label>
                        <Select onValueChange={(value) => setValue("listId", value)} value={listId} disabled={loadingLists}>
                            <SelectTrigger className={errors.listId ? "border-destructive" : ""}>
                                <SelectValue placeholder={loadingLists ? "Cargando listas..." : "Selecciona una lista"} />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(groupedLists).map(([spaceName, spaceLists]) => (
                                    <SelectGroup key={spaceName}>
                                        <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                                            {spaceName}
                                        </SelectLabel>
                                        {spaceLists.map((list) => (
                                            <SelectItem key={list.id} value={list.id}>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                                                    {list.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.listId && (
                            <p className="text-sm text-destructive">
                                {errors.listId.message}
                            </p>
                        )}
                    </div>

                    {/* Task Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            Título <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="title"
                            placeholder="Escribe el nombre de la tarea"
                            {...register("title")}
                            className={errors.title ? "border-destructive" : ""}
                        />
                        {errors.title && (
                            <p className="text-sm text-destructive">{errors.title.message}</p>
                        )}
                    </div>

                    {/* Assignee & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Asignado a</Label>
                            <Select onValueChange={(value) => setValue("assigneeId", value)} value={assigneeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin asignar">
                                        {selectedAssignee && (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                    <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                                                        {selectedAssignee.avatarUrl ? (
                                                            <img src={selectedAssignee.avatarUrl} alt={selectedAssignee.name} />
                                                        ) : selectedAssignee.name?.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="truncate">{selectedAssignee.name}</span>
                                            </div>
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {teamMembers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                    <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                                                        {member.avatarUrl ? (
                                                            <img src={member.avatarUrl} alt={member.name} />
                                                        ) : member.name?.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {member.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Prioridad</Label>
                            <Select
                                defaultValue="NORMAL"
                                onValueChange={(value: TaskFormData["priority"]) =>
                                    setValue("priority", value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Baja</SelectItem>
                                    <SelectItem value="NORMAL">Media</SelectItem>
                                    <SelectItem value="HIGH">Alta</SelectItem>
                                    <SelectItem value="URGENT">Urgente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Due Date & Estimated Hours */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fecha límite</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !dueDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dueDate ? format(dueDate, "PPP", { locale: es }) : "Sin fecha"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dueDate}
                                        onSelect={(date) => date && setValue("dueDate", date)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="estimatedHours">Horas estimadas</Label>
                            <Input
                                id="estimatedHours"
                                type="number"
                                placeholder="0"
                                min="0"
                                {...register("estimatedHours", { valueAsNumber: true })}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                            id="description"
                            placeholder="Añade detalles sobre la tarea..."
                            rows={3}
                            {...register("description")}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                "Crear Tarea"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
