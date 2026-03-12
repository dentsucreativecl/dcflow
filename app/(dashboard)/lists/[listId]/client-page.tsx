"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    Search,
    Filter,
    LayoutList,
    LayoutGrid,
    Calendar,
    MoreHorizontal,
    ChevronDown,
    Flag,
    Clock,
    MessageSquare,
    Paperclip,
    GripVertical,
    Layers,
    BarChart3,
    Zap,
    Lock,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ListTaskKanban } from "@/components/features/list-task-kanban";
import { CalendarView } from "@/components/features/calendar-view";
import { TimelineView } from "@/components/features/timeline-view";
import { ListView } from "@/components/features/list-view/list-view";
import { ListTask, CustomFieldColumn } from "@/components/features/list-view/types";
import { useAppStore } from "@/lib/store";
import { CustomFieldManager } from "@/components/features/custom-fields/custom-field-manager";
import { Settings2 } from "lucide-react";
import { runAutomations } from "@/lib/automation-engine";
import { TaskRelationData, RelationType, isTaskBlocked, getBlockingTaskTitles } from "@/lib/dependencies";
import { AutomationManager } from "@/components/features/automation-manager";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { useSpaceAreaPermission } from "@/lib/permissions/area-permissions";
import Link from "next/link";

interface Task {
    id: string;
    title: string;
    description: string | null;
    priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NORMAL" | "NONE";
    dueDate: string | null;
    estimatedHours: number | null;
    status: {
        id: string;
        name: string;
        color: string;
    } | null;
    assignments: Array<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        };
    }>;
    attachments?: Array<{
        id: string;
        fileUrl: string;
        fileType: string;
        fileName: string;
    }>;
    subtasks?: Array<{
        id: string;
        title: string;
        dueDate?: string | null;
        startDate?: string | null;
        status: { id: string; name: string; color: string } | null;
    }>;
    _count?: {
        comments: number;
        attachments: number;
        subtasks: number;
    };
}

interface ListData {
    id: string;
    name: string;
    space: { name: string; color: string } | null;
    folder: { name: string } | null;
    spaceId: string;
}

interface StatusOption {
    id: string;
    name: string;
    color: string;
}

/** Raw shape returned by Supabase when selecting List with joined Space and Folder */
interface SupabaseListRow {
    id: string;
    name: string;
    spaceId: string;
    space: { name: string; color: string } | { name: string; color: string }[];
    folder: { name: string } | { name: string }[];
}

/** Raw shape returned by Supabase for a Task row with joined relations */
interface SupabaseTaskRow {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    dueDate: string | null;
    estimatedHours: number | null;
    status: { id: string; name: string; color: string } | { id: string; name: string; color: string }[];
    assignments: Array<{
        user: { id: string; name: string; avatarUrl: string | null } | { id: string; name: string; avatarUrl: string | null }[];
    }>;
    commentsCount: Array<{ count: number }>;
    attachmentsCount: Array<{ count: number }>;
    subtasks: Array<{ id: string; title: string; dueDate?: string | null; startDate?: string | null; status: { id: string; name: string; color: string } | { id: string; name: string; color: string }[] | null }>;
    attachments: Array<{ id: string; fileUrl: string; fileType: string; fileName: string }>;
}

const priorityConfig = {
    URGENT: { color: "bg-red-500", label: "Urgente", icon: "🔴" },
    HIGH: { color: "bg-orange-500", label: "Alta", icon: "🟠" },
    NORMAL: { color: "bg-yellow-500", label: "Normal", icon: "🟡" },
    MEDIUM: { color: "bg-yellow-500", label: "Media", icon: "🟡" },
    LOW: { color: "bg-blue-500", label: "Baja", icon: "🔵" },
    NONE: { color: "bg-slate-500", label: "Sin prioridad", icon: "⚪" },
};

function SkeletonList({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
            ))}
        </div>
    );
}

export default function ListPage() {
    const params = useParams();
    const rawListId = params.listId as string;
    // Get actual listId from URL path if params return placeholder
    const listId = rawListId === '_' ? (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '') : rawListId;
    const { openModal } = useAppStore();
    const { user, loading: authLoading } = useAuth();
    const { addToast } = useToast();

    const [list, setList] = useState<ListData | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [statuses, setStatuses] = useState<StatusOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar" | "timeline">("list");
    const [groupBy, setGroupBy] = useState<"none" | "status" | "priority">("status");
    const [searchQuery, setSearchQuery] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterPriorities, setFilterPriorities] = useState<Set<string>>(new Set());
    const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
    const [customFields, setCustomFields] = useState<CustomFieldColumn[]>([]);
    const [cfManagerOpen, setCfManagerOpen] = useState(false);
    const [taskRelations, setTaskRelations] = useState<TaskRelationData[]>([]);
    const [automationManagerOpen, setAutomationManagerOpen] = useState(false);

    const { canEdit: canEditByArea, loading: areaLoading } = useSpaceAreaPermission(list?.spaceId ?? null);

    const handleOpenTask = (taskId: string) => {
        openModal("task-detail-v2", { taskId, taskIds: tasks.map(t => t.id) });
    };

    const handleBulkStatusChange = () => {
        if (selectedTasks.size === 0) return;
        openModal("bulk-status-change", {
            taskIds: Array.from(selectedTasks),
            statuses,
        });
    };

    const handleBulkAssign = () => {
        if (selectedTasks.size === 0) return;
        openModal("bulk-assign", {
            taskIds: Array.from(selectedTasks),
        });
    };

    const handleBulkDelete = async () => {
        if (selectedTasks.size === 0) return;

        const confirmed = confirm(
            `¿Estás seguro de eliminar ${selectedTasks.size} tarea${selectedTasks.size > 1 ? "s" : ""}?`
        );
        if (!confirmed) return;

        const supabase = createClient();

        try {
            const { error } = await supabase
                .from("Task")
                .delete()
                .in("id", Array.from(selectedTasks));

            if (error) throw error;

            await fetchData();
            setSelectedTasks(new Set());
        } catch (error) {
            console.error("Error deleting tasks:", error);
            alert("Error al eliminar tareas");
        }
    };

    const handleReorderTasks = async (reorderedTasks: Task[]) => {
        const supabase = createClient();

        try {
            const updates = reorderedTasks.map((task, index) => ({
                id: task.id,
                order: index,
            }));

            for (const update of updates) {
                await supabase
                    .from("Task")
                    .update({ order: update.order })
                    .eq("id", update.id);
            }

            await fetchData();
        } catch (error) {
            console.error("Error reordering tasks:", error);
        }
    };

    const fetchData = useCallback(async () => {
        const supabase = createClient();

        try {
            const { data: listData } = await supabase
                .from("List")
                .select(`
            id, name, spaceId,
            space:Space(name, color),
            folder:Folder(name)
          `)
                .eq("id", listId)
                .single();

            if (listData) {
                const raw = listData as unknown as SupabaseListRow;
                setList({
                    id: raw.id,
                    name: raw.name,
                    spaceId: raw.spaceId,
                    space: Array.isArray(raw.space) ? raw.space[0] ?? null : raw.space,
                    folder: Array.isArray(raw.folder) ? raw.folder[0] ?? null : raw.folder,
                });

                if (listData.spaceId) {
                    const { data: statusData } = await supabase
                        .from("Status")
                        .select("id, name, color")
                        .eq("spaceId", listData.spaceId)
                        .order("order");

                    if (statusData) setStatuses(statusData);

                    // Fetch custom fields for this space
                    const { data: cfData } = await supabase
                        .from("CustomField")
                        .select("id, name, type, options")
                        .eq("spaceId", listData.spaceId)
                        .order("createdAt");

                    if (cfData) {
                        setCustomFields(cfData.map(f => ({
                            ...f,
                            type: f.type as CustomFieldColumn["type"],
                            options: f.options as string[] | null,
                        })));
                    }
                }
            }

            const { data: tasksData } = await supabase
                .from("Task")
                .select(`
                    id,
                    title,
                    description,
                    priority,
                    dueDate,
                    estimatedHours,
                    status:Status(id, name, color),
                    assignments:TaskAssignment(
                        user:User(id, name, avatarUrl)
                    ),
                    commentsCount:Comment(count),
                    attachmentsCount:Attachment(count),
                    subtasks:Task!parentId(id, title, dueDate, startDate, status:Status(id, name, color)),
                    attachments:Attachment(id, fileUrl, fileType, fileName)
                `)
                .eq("listId", listId)
                .is("parentId", null)
                .order("dueDate", { ascending: true });

            if (tasksData) {
                const transformedTasks = (tasksData as unknown as SupabaseTaskRow[]).map(task => {
                    const status = Array.isArray(task.status) ? task.status[0] : task.status;
                    const assignments = (task.assignments || []).map((a: SupabaseTaskRow["assignments"][number]) => ({
                        user: Array.isArray(a.user) ? a.user[0] : a.user
                    }));

                    const commentsCount = task.commentsCount?.[0]?.count || 0;
                    const attachmentsCount = task.attachmentsCount?.[0]?.count || 0;
                    const subtasks = (task.subtasks || []).map(s => {
                        const sStatus = Array.isArray(s.status) ? s.status[0] : s.status;
                        return { id: s.id, title: s.title, dueDate: s.dueDate || null, startDate: s.startDate || null, status: sStatus || null };
                    });

                    return {
                        ...task,
                        priority: task.priority?.toUpperCase(),
                        status: status || null,
                        assignments,
                        attachments: task.attachments || [],
                        subtasks,
                        _count: {
                            comments: commentsCount,
                            attachments: attachmentsCount,
                            subtasks: subtasks.length,
                        },
                    };
                });

                // Fetch custom field values for these tasks
                const taskIds = transformedTasks.map(t => t.id);
                if (taskIds.length > 0 && customFields.length > 0) {
                    const { data: cfValues } = await supabase
                        .from("CustomFieldValue")
                        .select("taskId, customFieldId, textValue, numberValue, dateValue, selectValue, checkboxValue")
                        .in("taskId", taskIds);

                    if (cfValues) {
                        const cfMap = new Map<string, Record<string, { textValue?: string | null; numberValue?: number | null; dateValue?: string | null; selectValue?: string | null; checkboxValue?: boolean | null }>>();
                        for (const v of cfValues) {
                            if (!cfMap.has(v.taskId)) cfMap.set(v.taskId, {});
                            cfMap.get(v.taskId)![v.customFieldId] = {
                                textValue: v.textValue,
                                numberValue: v.numberValue,
                                dateValue: v.dateValue,
                                selectValue: v.selectValue,
                                checkboxValue: v.checkboxValue,
                            };
                        }
                        for (const task of transformedTasks) {
                            (task as Task & { customFieldValues?: Record<string, unknown> }).customFieldValues = cfMap.get(task.id) || {};
                        }
                    }
                }

                // Fetch task relations for blocking indicators
                if (taskIds.length > 0) {
                    // Fetch relations where tasks are source OR target (two queries merged)
                    const [{ data: relsAsSource }, { data: relsAsTarget }] = await Promise.all([
                        supabase.from("TaskRelation").select("id, type, sourceTaskId, targetTaskId").in("sourceTaskId", taskIds),
                        supabase.from("TaskRelation").select("id, type, sourceTaskId, targetTaskId").in("targetTaskId", taskIds),
                    ]);
                    const relationsData = [
                        ...(relsAsSource || []),
                        ...(relsAsTarget || []),
                    ].filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i); // dedupe

                    if (relationsData.length > 0) {
                        // Fetch related task titles for blocked-by info
                        const allRelatedIds = new Set<string>();
                        relationsData.forEach(r => {
                            allRelatedIds.add(r.sourceTaskId);
                            allRelatedIds.add(r.targetTaskId);
                        });
                        const externalIds = Array.from(allRelatedIds).filter(id => !taskIds.includes(id));

                        let externalTaskMap = new Map<string, {title: string; status?: {name: string} | null}>();
                        if (externalIds.length > 0) {
                            const { data: extTasks } = await supabase
                                .from("Task")
                                .select("id, title, status:Status(name)")
                                .in("id", externalIds);
                            extTasks?.forEach(t => {
                                const status = Array.isArray(t.status) ? t.status[0] : t.status;
                                externalTaskMap.set(t.id, { title: t.title, status });
                            });
                        }

                        // Build full relation data with task info
                        const fullRelations: TaskRelationData[] = relationsData.map(r => {
                            const sourceInList = transformedTasks.find(t => t.id === r.sourceTaskId);
                            const targetInList = transformedTasks.find(t => t.id === r.targetTaskId);
                            const sourceExt = externalTaskMap.get(r.sourceTaskId);
                            const targetExt = externalTaskMap.get(r.targetTaskId);
                            return {
                                id: r.id,
                                type: r.type as RelationType,
                                sourceTaskId: r.sourceTaskId,
                                targetTaskId: r.targetTaskId,
                                sourceTask: sourceInList
                                    ? { id: sourceInList.id, title: sourceInList.title, status: sourceInList.status ? { name: sourceInList.status.name, color: sourceInList.status.color } : undefined }
                                    : sourceExt ? { id: r.sourceTaskId, title: sourceExt.title, status: sourceExt.status ? { name: sourceExt.status.name, color: "" } : undefined } : undefined,
                                targetTask: targetInList
                                    ? { id: targetInList.id, title: targetInList.title, status: targetInList.status ? { name: targetInList.status.name, color: targetInList.status.color } : undefined }
                                    : targetExt ? { id: r.targetTaskId, title: targetExt.title, status: targetExt.status ? { name: targetExt.status.name, color: "" } : undefined } : undefined,
                            };
                        });
                        setTaskRelations(fullRelations);

                        // Calculate isBlocked for each task
                        const completedNames = ["done", "completada", "terminada"];
                        transformedTasks.forEach(t => {
                            const taskRels = fullRelations.filter(r => r.sourceTaskId === t.id || r.targetTaskId === t.id);
                            (t as any).isBlocked = isTaskBlocked(taskRels, t.id, completedNames);
                            (t as any).blockedByTitles = getBlockingTaskTitles(taskRels, t.id, completedNames);
                        });
                    } else {
                        setTaskRelations([]);
                    }
                }

                setTasks(transformedTasks as Task[]);
            }
        } catch (error) {
            console.error("Error fetching list data:", error);
        }
    }, [listId]);

    // Last-resort safety: never stay stuck in loading state
    useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { setLoading(false); return; }
        if (!listId) return;

        let cancelled = false;
        setLoading(true);

        const timeoutId = setTimeout(() => {
            if (!cancelled) { cancelled = true; setLoading(false); }
        }, 8000);

        fetchData().finally(() => {
            clearTimeout(timeoutId);
            if (!cancelled) setLoading(false);
        });

        return () => { cancelled = true; clearTimeout(timeoutId); };
    }, [listId, fetchData, user, authLoading]);

    // Listen for data-changed events dispatched by modals (fallback for when realtime is not enabled)
    useEffect(() => {
        const handler = () => { fetchData(); };
        window.addEventListener('dcflow:refresh', handler);
        return () => window.removeEventListener('dcflow:refresh', handler);
    }, [fetchData]);

    useEffect(() => {
        if (!listId) return;

        const supabase = createClient();

        const taskChannel = supabase
            .channel(`list-${listId}-tasks`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Task',
                    filter: `listId=eq.${listId}`
                },
                () => {
                    fetchData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'TaskAssignment'
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(taskChannel);
        };
    }, [listId, fetchData]);

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTasks((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
        // Block validation for status changes
        if (updates.status) {
            const currentTask = tasks.find(t => t.id === taskId);
            if ((currentTask as any)?.isBlocked) {
                addToast({
                    title: "Tarea bloqueada",
                    description: `Bloqueada por: ${(currentTask as any)?.blockedByTitles?.join(", ") || "otra tarea"}`,
                    type: "error",
                });
                return;
            }
        }

        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

        const supabase = createClient();

        try {
            const dbUpdates: Partial<{ priority: string; statusId: string; dueDate: string | null; title: string }> = {};
            if (updates.priority) {
                dbUpdates.priority = updates.priority;
            }
            if (updates.status && updates.status.id) dbUpdates.statusId = updates.status.id;
            if ('dueDate' in updates) dbUpdates.dueDate = updates.dueDate as string | null;
            if (updates.title) dbUpdates.title = updates.title;

            if (Object.keys(dbUpdates).length > 0) {
                const { error } = await supabase.from("Task").update(dbUpdates).eq("id", taskId);
                if (error) throw error;

                // Trigger automations
                if (list?.spaceId && user) {
                    if (dbUpdates.statusId) {
                        runAutomations({ spaceId: list.spaceId, trigger: "STATUS_CHANGED", taskId, userId: user.id, context: { newValue: dbUpdates.statusId } });
                    }
                    if (dbUpdates.priority) {
                        runAutomations({ spaceId: list.spaceId, trigger: "PRIORITY_CHANGED", taskId, userId: user.id, context: { newValue: dbUpdates.priority } });
                    }
                }
            }
        } catch (error) {
            console.error("Error updating task:", error);
            fetchData();
        }
    };

    const handleAutomationTrigger = async (taskId: string, trigger: string, context: { newValue: string }) => {
        if (!list?.spaceId || !user) return;
        await runAutomations({ spaceId: list.spaceId, trigger, taskId, userId: user.id, context });
    };

    const handleSaveCustomField = async (fieldId: string, taskId: string, valueColumn: string, value: string | number | boolean | null) => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from("CustomFieldValue")
                .upsert(
                    { customFieldId: fieldId, taskId, [valueColumn]: value },
                    { onConflict: "customFieldId,taskId" }
                );
            if (error) throw error;
            // Update local state
            setTasks(prev => prev.map(t => {
                if (t.id !== taskId) return t;
                const cfv = (t as Task & { customFieldValues?: Record<string, unknown> }).customFieldValues || {};
                return { ...t, customFieldValues: { ...cfv, [fieldId]: { ...(cfv[fieldId] as Record<string, unknown> || {}), [valueColumn]: value } } } as Task;
            }));
        } catch (error) {
            console.error("Error saving custom field:", error);
        }
    };

    const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterStatuses.size > 0 && task.status && !filterStatuses.has(task.status.id)) return false;
      if (filterStatuses.size > 0 && !task.status) return false;
      if (filterPriorities.size > 0 && !filterPriorities.has(task.priority)) return false;
      return true;
    });
  }, [tasks, searchQuery, filterStatuses, filterPriorities]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-12 w-full" />
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
                        <Link href="/dashboard" className="hover:text-foreground transition-colors">Inicio</Link>
                        <span>›</span>
                        <Link href="/projects" className="hover:text-foreground transition-colors">Proyectos</Link>
                        {list?.space && (
                            <>
                                <span>›</span>
                                <span
                                    className="h-2 w-2 rounded-full inline-block flex-shrink-0"
                                    style={{ backgroundColor: list.space.color }}
                                />
                                <Link href="/projects" className="hover:text-foreground transition-colors">{list.space.name}</Link>
                            </>
                        )}
                        {list?.folder && (
                            <>
                                <span>›</span>
                                <span className="hover:text-foreground">{list.folder.name}</span>
                            </>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold">{list?.name || "Lista"}</h1>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={cn((filterStatuses.size > 0 || filterPriorities.size > 0) && "border-primary text-primary")}>
                          <Filter className="h-4 w-4 mr-2" />
                          Filtrar
                          {(filterStatuses.size + filterPriorities.size) > 0 && (
                            <Badge variant="secondary" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                              {filterStatuses.size + filterPriorities.size}
                            </Badge>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">ESTADO</div>
                        {statuses.map((s) => (
                          <DropdownMenuItem key={s.id} onClick={(e) => { e.preventDefault(); setFilterStatuses(prev => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; }); }}>
                            <span className="h-2.5 w-2.5 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="flex-1">{s.name}</span>
                            {filterStatuses.has(s.id) && <span className="text-primary ml-auto">✓</span>}
                          </DropdownMenuItem>
                        ))}
                        <div className="my-1 border-t" />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">PRIORIDAD</div>
                        {(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((p) => (
                          <DropdownMenuItem key={p} onClick={(e) => { e.preventDefault(); setFilterPriorities(prev => { const next = new Set(prev); if (next.has(p)) next.delete(p); else next.add(p); return next; }); }}>
                            <span className={cn("h-2.5 w-2.5 rounded-full mr-2 flex-shrink-0", p === "URGENT" ? "bg-red-500" : p === "HIGH" ? "bg-orange-500" : p === "NORMAL" ? "bg-yellow-500" : "bg-blue-500")} />
                            <span className="flex-1">{priorityConfig[p]?.label}</span>
                            {filterPriorities.has(p) && <span className="text-primary ml-auto">✓</span>}
                          </DropdownMenuItem>
                        ))}
                        {(filterStatuses.size > 0 || filterPriorities.size > 0) && (
                          <>
                            <div className="my-1 border-t" />
                            <DropdownMenuItem onClick={() => { setFilterStatuses(new Set()); setFilterPriorities(new Set()); }}>
                              <span className="text-muted-foreground">Limpiar filtros</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="flex items-center border rounded-lg overflow-hidden">
                        <Button
                            variant={viewMode === "list" ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-none"
                            onClick={() => setViewMode("list")}
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === "kanban" ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-none"
                            onClick={() => setViewMode("kanban")}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === "calendar" ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-none"
                            onClick={() => setViewMode("calendar")}
                        >
                            <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === "timeline" ? "secondary" : "ghost"}
                            size="sm"
                            className="rounded-none"
                            onClick={() => setViewMode("timeline")}
                        >
                            <BarChart3 className="h-4 w-4" />
                        </Button>
                    </div>
                    {canEditByArea && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCfManagerOpen(true)}
                    >
                        <Settings2 className="h-4 w-4 mr-2" />
                        Campos
                        {customFields.length > 0 && (
                            <Badge variant="secondary" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                                {customFields.length}
                            </Badge>
                        )}
                    </Button>
                    )}
                    {canEditByArea && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setAutomationManagerOpen(true)}
                    >
                        <Zap className="h-4 w-4" />
                        Reglas
                    </Button>
                    )}
                    {canEditByArea && (
                    <Button
                        size="sm"
                        className="bg-primary"
                        onClick={() => openModal("new-task-v2", { projectId: listId })}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Tarea
                    </Button>
                    )}
                </div>
            </div>

            {!areaLoading && !canEditByArea && (
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-2.5 mt-3 text-sm text-amber-800 dark:text-amber-300">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>
                        <strong>Solo lectura</strong> — este espacio pertenece a un área diferente a la tuya. Puedes ver el contenido pero no puedes editarlo.
                    </span>
                </div>
            )}

            <div className="flex items-center gap-4 py-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar tareas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "none" | "status" | "priority")}>
                        <SelectTrigger className="w-[140px] h-9">
                            <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Agrupar por" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Sin agrupar</SelectItem>
                            <SelectItem value="status">Estado</SelectItem>
                            <SelectItem value="priority">Prioridad</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {selectedTasks.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {selectedTasks.size} seleccionadas
                        </span>
                        <Button variant="outline" size="sm" onClick={handleBulkStatusChange}>
                            Cambiar estado
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleBulkAssign}>
                            Asignar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                            Eliminar
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto p-4">
                {loading ? (
                    <SkeletonList rows={8} />
                ) : viewMode === "list" ? (
                    <ListView
                        tasks={filteredTasks as unknown as ListTask[]}
                        selectedTasks={selectedTasks}
                        onToggleTaskSelection={toggleTaskSelection}
                        onOpenTask={handleOpenTask}
                        listId={listId}
                        statuses={statuses}
                        onUpdateTask={handleUpdateTask}
                        groupBy={groupBy}
                        onReorderTasks={handleReorderTasks}
                        customFields={customFields}
                        onSaveCustomField={handleSaveCustomField}
                    />
                ) : viewMode === "kanban" ? (
                    <ListTaskKanban
                        listId={listId}
                        tasks={filteredTasks}
                        onTaskClick={(task) => handleOpenTask(task.id)}
                        onTaskUpdate={(updated) => setTasks(updated as Task[])}
                        onAutomationTrigger={handleAutomationTrigger}
                    />
                ) : viewMode === "calendar" ? (
                    <CalendarView tasks={filteredTasks} onTaskClick={handleOpenTask} />
                ) : (
                    <TimelineView
                        tasks={filteredTasks}
                        onTaskClick={handleOpenTask}
                        relations={taskRelations}
                        onUpdateTask={(taskId: string, updates: { dueDate?: string }) => {
                            if (updates.dueDate !== undefined) {
                                handleUpdateTask(taskId, { dueDate: updates.dueDate } as any);
                            }
                        }}
                    />
                )}
            </div>

            {/* Custom Field Manager Sheet */}
            {list?.spaceId && (
                <CustomFieldManager
                    open={cfManagerOpen}
                    onOpenChange={setCfManagerOpen}
                    spaceId={list.spaceId}
                    onFieldsChanged={fetchData}
                />
            )}

            {/* Automation Manager Sheet */}
            {list?.spaceId && (
                <AutomationManager
                    open={automationManagerOpen}
                    onOpenChange={setAutomationManagerOpen}
                    spaceId={list.spaceId}
                />
            )}
        </div>
    );
}
