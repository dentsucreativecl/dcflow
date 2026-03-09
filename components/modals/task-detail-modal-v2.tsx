"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Calendar as CalendarIcon,
    Clock,
    Users,
    Flag,
    Paperclip,
    MessageSquare,
    MoreHorizontal,
    X,
    CheckSquare,
    Plus,
    Send,
    Activity,
    Trash2,
    Edit3,
    ChevronLeft,
    ChevronRight,
    Share2,
    Download,
    File,
    Link2,
    Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import {
    createMentionNotifications,
    createTaskAssignmentNotification,
    createTaskUpdateNotification,
} from "@/lib/notifications";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TaskTimeLog } from "@/components/features/time/task-time-log";
import { FileUploadZone } from "@/components/features/file-upload-zone";
import { CustomFieldValueEditor, CustomFieldWithValue } from "@/components/features/custom-fields/custom-field-value-editor";
import { TaskRelationData, RelationType, getRelationLabel, getRelatedTask, getEffectiveType, getInverseType, isTaskBlocked, groupRelationsByType } from "@/lib/dependencies";
import { useSpaceAreaPermission } from "@/lib/permissions/area-permissions";


interface TaskData {
    id: string;
    title: string;
    description: string | null;
    priority: "URGENT" | "HIGH" | "NORMAL" | "LOW";
    startDate: string | null;
    dueDate: string | null;
    createdAt: string | null;
    estimatedHours: number | null;
    completedAt: string | null;
    status: {
        id: string;
        name: string;
        color: string;
    } | null;
    list: {
        id: string;
        name: string;
        space: { id: string; name: string; color: string } | null;
        folder: { name: string } | null;
    } | null;
    createdBy: {
        id: string;
        name: string;
    } | null;
    assignments: Array<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        };
    }>;
    checklists: Array<{
        id: string;
        name: string;
        items: Array<{
            id: string;
            content: string;
            isCompleted: boolean;
        }>;
    }>;
    attachments: Array<{
        id: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
        uploadedBy: {
            id: string;
            name: string;
        };
        createdAt: string;
    }>;
    subtasks: Array<{
        id: string;
        title: string;
        startDate: string | null;
        dueDate: string | null;
        status: { id: string; name: string; color: string } | null;
        assignments: Array<{ user: { id: string; name: string } }>;
    }>;
    customFields?: CustomFieldWithValue[];
}

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    user: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
}

interface StatusOption {
    id: string;
    name: string;
    color: string;
}

const priorityConfig = {
    URGENT: { color: "bg-red-500", label: "Urgente" },
    HIGH: { color: "bg-orange-500", label: "Alta" },
    NORMAL: { color: "bg-yellow-500", label: "Media" },
    LOW: { color: "bg-slate-500", label: "Baja" },
};

export function TaskDetailModalV2() {
    const { activeModal, modalData, closeModal, openModal } = useAppStore();
    const { user } = useAuth();
    const { addToast } = useToast();

    const isOpen = activeModal === "task-detail-v2";
    const taskId = modalData?.taskId as string | undefined;

    const [task, setTask] = useState<TaskData | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [activities, setActivities] = useState<Array<{id: string; type: string; field: string | null; oldValue: string | null; newValue: string | null; createdAt: string; user: {id: string; name: string} | null}>>([]);
    const [statuses, setStatuses] = useState<StatusOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState("");
    const [descriptionValue, setDescriptionValue] = useState("");
    const [newComment, setNewComment] = useState("");
    const [activeTab, setActiveTab] = useState("details");
    const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; avatarUrl: string | null }>>([]);
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignSearch, setAssignSearch] = useState("");
    const [addingSubtask, setAddingSubtask] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [newSubtaskStartDate, setNewSubtaskStartDate] = useState<Date | undefined>(undefined);
    const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<Date | undefined>(undefined);
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [newChecklistName, setNewChecklistName] = useState("");
    const [taskCustomFields, setTaskCustomFields] = useState<CustomFieldWithValue[]>([]);
    const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
    const [editingChecklistName, setEditingChecklistName] = useState("");
    const [addingItemToChecklistId, setAddingItemToChecklistId] = useState<string | null>(null);
    const [newItemContent, setNewItemContent] = useState("");
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingItemContent, setEditingItemContent] = useState("");
    const [confirmDeleteChecklistId, setConfirmDeleteChecklistId] = useState<string | null>(null);

    // Area-based permission check
    const { canEdit: canEditByArea } = useSpaceAreaPermission(task?.list?.space?.id ?? null);

    // Dependencies state
    const [taskRelations, setTaskRelations] = useState<TaskRelationData[]>([]);
    const [addingRelation, setAddingRelation] = useState(false);
    const [relationSearch, setRelationSearch] = useState("");
    const [relationSearchResults, setRelationSearchResults] = useState<Array<{id: string; title: string; status?: {name: string; color: string} | null}>>([]);
    const [selectedRelationType, setSelectedRelationType] = useState<RelationType>("BLOCKS");

    // Fetch task data
    useEffect(() => {
        if (!isOpen || !taskId) return;

        // Reset state when navigating to a different task
        setTask(null);
        setComments([]);
        setActivities([]);
        setStatuses([]);
        setTaskRelations([]);
        setAssignOpen(false);
        setAssignSearch("");

        async function fetchTask() {
            setLoading(true);
            const supabase = createClient();

            try {
                // Fetch task with related data
                const { data: taskData, error } = await supabase
                    .from("Task")
                    .select(`
            id, title, description, priority, startDate, dueDate, createdAt,
            estimatedHours, completedAt,
            status:Status(id, name, color),
            list:List(id, name, space:Space(id, name, color), folder:Folder(name)),
            createdBy:User!Task_createdById_fkey(id, name)
          `)
                    .eq("id", taskId)
                    .single();

                if (error) throw error;

                // Handle nested data
                const listData = Array.isArray(taskData.list) ? taskData.list[0] : taskData.list;
                const processedTask = {
                    ...taskData,
                    status: Array.isArray(taskData.status) ? taskData.status[0] : taskData.status,
                    list: listData ? {
                        ...listData,
                        space: Array.isArray(listData.space) ? listData.space[0] : listData.space,
                        folder: Array.isArray(listData.folder) ? listData.folder[0] : listData.folder,
                    } : null,
                    createdBy: Array.isArray(taskData.createdBy) ? taskData.createdBy[0] : taskData.createdBy,
                    assignments: [],
                    checklists: [],
                    attachments: [],
                    subtasks: [],
                };

                // Fetch assignments
                const { data: assignments } = await supabase
                    .from("TaskAssignment")
                    .select("user:User(id, name, avatarUrl)")
                    .eq("taskId", taskId);

                if (assignments) {
                    processedTask.assignments = assignments.map(a => ({
                        user: Array.isArray(a.user) ? a.user[0] : a.user
                    })) as TaskData["assignments"];
                }

                // Fetch checklists with items
                const { data: checklists } = await supabase
                    .from("Checklist")
                    .select("id, name, items:ChecklistItem(id, content, isCompleted)")
                    .eq("taskId", taskId)
                    .order("order");

                if (checklists) {
                    processedTask.checklists = checklists as TaskData["checklists"];
                }

                // Fetch attachments
                const { data: attachmentsData } = await supabase
                    .from("Attachment")
                    .select("id, fileName, fileUrl, fileType, fileSize, createdAt, uploadedBy:User!Attachment_uploadedById_fkey(id, name)")
                    .eq("taskId", taskId)
                    .order("createdAt", { ascending: false });

                if (attachmentsData) {
                    processedTask.attachments = attachmentsData.map(a => ({
                        ...a,
                        uploadedBy: Array.isArray(a.uploadedBy) ? a.uploadedBy[0] : a.uploadedBy
                    })) as TaskData["attachments"];
                }

                // Fetch subtasks
                const { data: subtasksData } = await supabase
                    .from("Task")
                    .select(`
                        id, title, startDate, dueDate,
                        status:Status(id, name, color),
                        assignments:TaskAssignment(user:User(id, name))
                    `)
                    .eq("parentId", taskId)
                    .order("createdAt");

                if (subtasksData) {
                    processedTask.subtasks = subtasksData.map(s => ({
                        ...s,
                        status: Array.isArray(s.status) ? s.status[0] : s.status,
                        assignments: (s.assignments || []).map((a: any) => ({
                            user: Array.isArray(a.user) ? a.user[0] : a.user
                        }))
                    })) as TaskData["subtasks"];
                } else {
                    processedTask.subtasks = [];
                }

                // Fetch comments
                const { data: commentsData } = await supabase
                    .from("Comment")
                    .select("id, content, createdAt, user:User(id, name, avatarUrl)")
                    .eq("taskId", taskId)
                    .order("createdAt", { ascending: false });

                if (commentsData) {
                    setComments(commentsData.map(c => ({
                        ...c,
                        user: Array.isArray(c.user) ? c.user[0] : c.user
                    })));
                }

                // Fetch activities
                const { data: activitiesData } = await supabase
                    .from("Activity")
                    .select("id, type, field, oldValue, newValue, createdAt, user:User(id, name)")
                    .eq("taskId", taskId)
                    .order("createdAt", { ascending: false });

                if (activitiesData) {
                    setActivities(activitiesData.map(a => ({
                        ...a,
                        user: Array.isArray(a.user) ? a.user[0] : a.user
                    })));
                }

                // Fetch statuses for this list
                if (processedTask.list?.id) {
                    const { data: statusData } = await supabase
                        .from("Status")
                        .select("id, name, color")
                        .eq("spaceId", processedTask.list.space?.id || "")
                        .order("order");

                    if (statusData) {
                        setStatuses(statusData);
                    }
                }

                // Fetch custom fields for this task's space
                let fetchedCustomFields: CustomFieldWithValue[] = [];
                const spaceId = processedTask.list?.space?.id;
                if (spaceId) {
                    const { data: customFieldsData } = await supabase
                        .from("CustomField")
                        .select("id, name, type, isRequired, options")
                        .eq("spaceId", spaceId)
                        .order("createdAt");

                    if (customFieldsData && customFieldsData.length > 0) {
                        const fieldIds = customFieldsData.map(f => f.id);
                        const { data: valuesData } = await supabase
                            .from("CustomFieldValue")
                            .select("customFieldId, textValue, numberValue, dateValue, selectValue, checkboxValue")
                            .eq("taskId", taskId)
                            .in("customFieldId", fieldIds);

                        const valuesMap = new Map(valuesData?.map(v => [v.customFieldId, v]) || []);

                        fetchedCustomFields = customFieldsData.map(f => ({
                            id: f.id,
                            name: f.name,
                            type: f.type as string,
                            isRequired: f.isRequired,
                            options: f.options as string[] | null,
                            value: valuesMap.get(f.id) || null,
                        }));
                    }
                }
                processedTask.customFields = fetchedCustomFields;

                // Fetch task relations
                const { data: relsData } = await supabase
                    .from("TaskRelation")
                    .select("id, type, sourceTaskId, targetTaskId")
                    .or(`sourceTaskId.eq.${taskId},targetTaskId.eq.${taskId}`);

                if (relsData && relsData.length > 0) {
                    // Fetch related task details
                    const relatedTaskIds = new Set<string>();
                    relsData.forEach(r => {
                        if (r.sourceTaskId !== taskId) relatedTaskIds.add(r.sourceTaskId);
                        if (r.targetTaskId !== taskId) relatedTaskIds.add(r.targetTaskId);
                    });

                    const { data: relatedTasks } = await supabase
                        .from("Task")
                        .select("id, title, status:Status(name, color)")
                        .in("id", Array.from(relatedTaskIds));

                    const taskMap = new Map<string, {id: string; title: string; status?: {name: string; color: string} | null}>();
                    relatedTasks?.forEach(t => {
                        const status = Array.isArray(t.status) ? t.status[0] : t.status;
                        taskMap.set(t.id, { id: t.id, title: t.title, status });
                    });

                    const relations: TaskRelationData[] = relsData.map(r => ({
                        id: r.id,
                        type: r.type as RelationType,
                        sourceTaskId: r.sourceTaskId,
                        targetTaskId: r.targetTaskId,
                        sourceTask: taskMap.get(r.sourceTaskId) || undefined,
                        targetTask: taskMap.get(r.targetTaskId) || undefined,
                    }));
                    setTaskRelations(relations);
                } else {
                    setTaskRelations([]);
                }

                setTask(processedTask as TaskData);
                setTaskCustomFields(fetchedCustomFields);
                setTitleValue(processedTask.title);
                setDescriptionValue(processedTask.description || "");
            } catch (error) {
                const supaErr = error as { code?: string; message?: string; details?: string };
                console.error("Error fetching task:", {
                    code: supaErr?.code,
                    message: supaErr?.message,
                    details: supaErr?.details,
                    raw: error,
                });
                addToast({
                    title: "Error al cargar la tarea",
                    description: supaErr?.message || "No se pudo cargar la tarea",
                    type: "error",
                });
            } finally {
                setLoading(false);
            }
        }

        async function fetchUsers() {
            const supabase = createClient();
            const { data } = await supabase
                .from("User")
                .select("id, name, avatarUrl")
                .order("name");
            if (data) setAvailableUsers(data);
        }

        if (isOpen && taskId) {
            fetchTask();
            fetchUsers();
        }
    }, [isOpen, taskId]);

    const refreshAttachments = async () => {
        if (!taskId) return;
        const supabase = createClient();
        const { data: attachmentsData } = await supabase
            .from("Attachment")
            .select("id, fileName, fileUrl, fileType, fileSize, createdAt, uploadedBy:User!Attachment_uploadedById_fkey(id, name)")
            .eq("taskId", taskId)
            .order("createdAt", { ascending: false });
        if (attachmentsData && task) {
            setTask({
                ...task,
                attachments: attachmentsData.map(a => ({
                    ...a,
                    uploadedBy: Array.isArray(a.uploadedBy) ? a.uploadedBy[0] : a.uploadedBy
                })) as TaskData["attachments"],
            });
            // Notify kanban/list to re-fetch tasks so thumbnails update immediately
            window.dispatchEvent(new CustomEvent('dcflow:refresh'));
        }
    };

    const refreshSubtasks = async () => {
        if (!taskId || !task) return;
        const supabase = createClient();
        const { data: subtasksData } = await supabase
            .from("Task")
            .select(`
                id, title, startDate, dueDate,
                status:Status(id, name, color),
                assignments:TaskAssignment(user:User(id, name))
            `)
            .eq("parentId", taskId)
            .order("createdAt");
        if (subtasksData) {
            setTask({
                ...task,
                subtasks: subtasksData.map(s => ({
                    ...s,
                    status: Array.isArray(s.status) ? s.status[0] : s.status,
                    assignments: (s.assignments || []).map((a: any) => ({
                        user: Array.isArray(a.user) ? a.user[0] : a.user
                    }))
                })) as TaskData["subtasks"],
            });
        }
    };

    const handleAddSubtask = async () => {
        if (!task || !newSubtaskTitle.trim() || !user) return;
        const supabase = createClient();

        const statusId = statuses[0]?.id || task.status?.id;
        if (!statusId) {
            addToast({ title: "No hay estados disponibles para asignar a la subtarea", type: "error" });
            return;
        }

        const listId = task.list?.id;
        if (!listId) {
            addToast({ title: "Error: la tarea no tiene una lista asignada", type: "error" });
            return;
        }

        try {
            const now = new Date().toISOString();
            const { data: insertedData, error } = await supabase.from("Task").insert({
                id: crypto.randomUUID(),
                title: newSubtaskTitle.trim(),
                parentId: task.id,
                listId,
                statusId,
                createdById: user.id,
                priority: "NORMAL",
                createdAt: now,
                updatedAt: now,
                ...(newSubtaskStartDate ? { startDate: newSubtaskStartDate.toISOString() } : {}),
                ...(newSubtaskDueDate ? { dueDate: newSubtaskDueDate.toISOString() } : {}),
            }).select("id");

            if (error) throw error;

            // Log activity on the parent task
            await supabase.from("Activity").insert({
                id: crypto.randomUUID(),
                taskId: task.id,
                userId: user.id,
                type: "CREATED",
                field: "subtask",
                newValue: newSubtaskTitle.trim(),
                createdAt: new Date().toISOString(),
            });

            setNewSubtaskTitle("");
            setNewSubtaskStartDate(undefined);
            setNewSubtaskDueDate(undefined);
            setAddingSubtask(false);
            await refreshSubtasks();
            // Reload activities to show the new entry
            const supabaseClient = createClient();
            const { data: newActivities } = await supabaseClient
                .from("Activity")
                .select("id, type, field, oldValue, newValue, createdAt, user:User(id, name)")
                .eq("taskId", task.id)
                .order("createdAt", { ascending: false });
            if (newActivities) {
                setActivities(newActivities.map(a => ({ ...a, user: Array.isArray(a.user) ? a.user[0] : a.user })));
            }
            addToast({ title: "Subtarea creada", type: "success" });
        } catch (error) {
            const supaErr = error as { code?: string; message?: string };
            console.error("Error creating subtask:", { code: supaErr?.code, message: supaErr?.message, raw: error });
            addToast({ title: "Error al crear subtarea", description: supaErr?.message, type: "error" });
        }
    };

    const handleCustomFieldChange = (fieldId: string, newValue: CustomFieldWithValue["value"]) => {
        setTaskCustomFields(prev => prev.map(f => f.id === fieldId ? { ...f, value: newValue } : f));
    };

    const handleSearchRelationTasks = async (query: string) => {
        setRelationSearch(query);
        if (query.length < 2 || !task?.list?.space?.id) {
            setRelationSearchResults([]);
            return;
        }
        const supabase = createClient();
        // Get lists in the same space, then search tasks
        const { data: spaceLists } = await supabase
            .from("List")
            .select("id")
            .eq("spaceId", task.list.space.id);
        const listIds = spaceLists?.map(l => l.id) || [];
        if (listIds.length === 0) { setRelationSearchResults([]); return; }
        const { data } = await supabase
            .from("Task")
            .select("id, title, status:Status(name, color)")
            .in("listId", listIds)
            .ilike("title", `%${query}%`)
            .neq("id", task.id)
            .is("parentId", null)
            .limit(10);

        if (data) {
            setRelationSearchResults(data.map(t => ({
                id: t.id,
                title: t.title,
                status: Array.isArray(t.status) ? t.status[0] : t.status,
            })));
        }
    };

    const handleAddRelation = async (targetTaskId: string) => {
        if (!task || !user) return;
        const supabase = createClient();

        // Optimistic update
        const tempId = crypto.randomUUID();
        const targetTask = relationSearchResults.find(t => t.id === targetTaskId);
        const newRel: TaskRelationData = {
            id: tempId,
            type: selectedRelationType,
            sourceTaskId: task.id,
            targetTaskId,
            sourceTask: { id: task.id, title: task.title, status: task.status || undefined },
            targetTask: targetTask ? { id: targetTask.id, title: targetTask.title, status: targetTask.status || undefined } : undefined,
        };
        setTaskRelations(prev => [...prev, newRel]);
        setAddingRelation(false);
        setRelationSearch("");
        setRelationSearchResults([]);

        try {
            // Insert main relation
            const { data, error } = await supabase
                .from("TaskRelation")
                .insert({
                    type: selectedRelationType,
                    sourceTaskId: task.id,
                    targetTaskId,
                    createdById: user.id,
                })
                .select("id")
                .single();
            if (error) throw error;

            // Update temp ID with real ID
            setTaskRelations(prev => prev.map(r => r.id === tempId ? { ...r, id: data.id } : r));

            // Insert inverse relation
            const inverseType = getInverseType(selectedRelationType);
            await supabase
                .from("TaskRelation")
                .insert({
                    type: inverseType,
                    sourceTaskId: targetTaskId,
                    targetTaskId: task.id,
                    createdById: user.id,
                });

            addToast({ title: "Dependencia agregada", type: "success" });
        } catch {
            setTaskRelations(prev => prev.filter(r => r.id !== tempId));
            addToast({ title: "Error al agregar dependencia", type: "error" });
        }
    };

    const handleRemoveRelation = async (relationId: string) => {
        if (!task) return;
        const supabase = createClient();
        const removed = taskRelations.find(r => r.id === relationId);
        setTaskRelations(prev => prev.filter(r => r.id !== relationId));

        try {
            // Delete the relation
            const { error } = await supabase
                .from("TaskRelation")
                .delete()
                .eq("id", relationId);
            if (error) throw error;

            // Also delete the inverse relation
            if (removed) {
                const inverseType = getInverseType(removed.type as RelationType);
                await supabase
                    .from("TaskRelation")
                    .delete()
                    .eq("sourceTaskId", removed.targetTaskId)
                    .eq("targetTaskId", removed.sourceTaskId)
                    .eq("type", inverseType);
            }
        } catch {
            if (removed) setTaskRelations(prev => [...prev, removed]);
            addToast({ title: "Error al eliminar dependencia", type: "error" });
        }
    };

    const handleClose = () => {
        closeModal();
        setTask(null);
        setComments([]);
        setActivities([]);
        setTaskCustomFields([]);
        setTaskRelations([]);
        setActiveTab("details");
    };

    const handleSaveTitle = async () => {
        if (!task || !titleValue.trim()) return;

        setSaving(true);
        const supabase = createClient();

        try {
            const oldTitle = task.title;
            await supabase
                .from("Task")
                .update({ title: titleValue.trim() })
                .eq("id", task.id);

            setTask({ ...task, title: titleValue.trim() });
            setEditingTitle(false);

            if (user && oldTitle !== titleValue.trim()) {
                supabase.from("Activity").insert({
                    id: crypto.randomUUID(),
                    taskId: task.id,
                    userId: user.id,
                    type: "DESCRIPTION_UPDATED",
                    field: "title",
                    oldValue: oldTitle,
                    newValue: titleValue.trim(),
                    createdAt: new Date().toISOString(),
                }).then(() => reloadActivities(task.id));
            }
        } catch (error) {
            console.error("Error updating title:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDescription = async () => {
        if (!task) return;

        setSaving(true);
        const supabase = createClient();

        try {
            await supabase
                .from("Task")
                .update({ description: descriptionValue || null })
                .eq("id", task.id);

            setTask({ ...task, description: descriptionValue || null });
            addToast({ title: "Descripción guardada", type: "success" });

            if (user) {
                supabase.from("Activity").insert({
                    id: crypto.randomUUID(),
                    taskId: task.id,
                    userId: user.id,
                    type: "DESCRIPTION_UPDATED",
                    field: "description",
                    createdAt: new Date().toISOString(),
                }).then(() => reloadActivities(task.id));
            }
        } catch (error) {
            console.error("Error updating description:", error);
        } finally {
            setSaving(false);
        }
    };

    const reloadActivities = async (taskId: string) => {
        const supabase = createClient();
        const { data } = await supabase
            .from("Activity")
            .select("id, type, field, oldValue, newValue, createdAt, user:User(id, name)")
            .eq("taskId", taskId)
            .order("createdAt", { ascending: false });
        if (data) {
            setActivities(data.map(a => ({ ...a, user: Array.isArray(a.user) ? a.user[0] : a.user })));
        }
    };

    const handleStatusChange = async (statusId: string) => {
        if (!task) return;

        const supabase = createClient();

        try {
            await supabase
                .from("Task")
                .update({ statusId })
                .eq("id", task.id);

            const newStatus = statuses.find(s => s.id === statusId);
            if (newStatus) {
                const oldStatusName = task.status?.name || null;
                setTask({ ...task, status: newStatus });

                // Notify list views to refresh
                window.dispatchEvent(new CustomEvent('dcflow:refresh'));

                // Log activity
                if (user) {
                    supabase.from("Activity").insert({
                        id: crypto.randomUUID(),
                        taskId: task.id,
                        userId: user.id,
                        type: "STATUS_CHANGED",
                        field: "status",
                        oldValue: oldStatusName,
                        newValue: newStatus.name,
                        createdAt: new Date().toISOString(),
                    }).then(() => reloadActivities(task.id));
                }

                // Notify assigned users
                const assignedUserIds = task.assignments.map(a => a.user.id);
                if (assignedUserIds.length > 0 && user) {
                    createTaskUpdateNotification({
                        taskId: task.id,
                        taskTitle: task.title,
                        assignedUserIds,
                        updatedBy: user.id,
                        updatedByName: user.name,
                        updateType: "status",
                        oldValue: oldStatusName || undefined,
                        newValue: newStatus.name,
                    });
                }
            }
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const handlePriorityChange = async (priority: string) => {
        if (!task) return;

        const supabase = createClient();

        try {
            await supabase
                .from("Task")
                .update({ priority })
                .eq("id", task.id);

            const oldPriority = task.priority;
            setTask({ ...task, priority: priority as TaskData["priority"] });

            // Notify list views to refresh
            window.dispatchEvent(new CustomEvent('dcflow:refresh'));

            // Log activity
            if (user) {
                supabase.from("Activity").insert({
                    id: crypto.randomUUID(),
                    taskId: task.id,
                    userId: user.id,
                    type: "PRIORITY_CHANGED",
                    field: "priority",
                    oldValue: oldPriority,
                    newValue: priority,
                    createdAt: new Date().toISOString(),
                }).then(() => reloadActivities(task.id));
            }

            // Notify assigned users
            const assignedUserIds = task.assignments.map(a => a.user.id);
            if (assignedUserIds.length > 0 && user) {
                createTaskUpdateNotification({
                    taskId: task.id,
                    taskTitle: task.title,
                    assignedUserIds,
                    updatedBy: user.id,
                    updatedByName: user.name,
                    updateType: "priority",
                    oldValue: oldPriority || undefined,
                    newValue: priority,
                });
            }
        } catch (error) {
            console.error("Error updating priority:", error);
        }
    };

    const handleDueDateChange = async (date: Date | undefined) => {
        if (!task) return;

        const supabase = createClient();

        try {
            const newDateIso = date ? date.toISOString() : null;
            await supabase
                .from("Task")
                .update({ dueDate: newDateIso })
                .eq("id", task.id);

            const oldDate = task.dueDate;
            setTask({ ...task, dueDate: newDateIso });

            // Notify list views to refresh
            window.dispatchEvent(new CustomEvent('dcflow:refresh'));

            // Log activity
            if (user) {
                supabase.from("Activity").insert({
                    id: crypto.randomUUID(),
                    taskId: task.id,
                    userId: user.id,
                    type: "DUE_DATE_CHANGED",
                    field: "dueDate",
                    oldValue: oldDate,
                    newValue: newDateIso,
                    createdAt: new Date().toISOString(),
                }).then(() => reloadActivities(task.id));
            }

            // Notify assigned users
            const assignedUserIds = task.assignments.map(a => a.user.id);
            if (assignedUserIds.length > 0 && user) {
                createTaskUpdateNotification({
                    taskId: task.id,
                    taskTitle: task.title,
                    assignedUserIds,
                    updatedBy: user.id,
                    updatedByName: user.name,
                    updateType: "due_date",
                    newValue: newDateIso || undefined,
                });
            }
        } catch (error) {
            console.error("Error updating due date:", error);
        }
    };

    const handleAddComment = async () => {
        if (!task || !newComment.trim() || !user) return;

        const supabase = createClient();

        try {
            const { data, error } = await supabase
                .from("Comment")
                .insert({
                    id: self.crypto.randomUUID(),
                    taskId: task.id,
                    userId: user.id,
                    content: newComment.trim(),
                    updatedAt: new Date().toISOString(),
                })
                .select("id, content, createdAt")
                .single();

            if (error) throw error;

            setComments([
                {
                    ...data,
                    user: { id: user.id, name: user.name, avatarUrl: user.avatar || null },
                },
                ...comments,
            ]);
            setNewComment("");

            // Notify mentions
            createMentionNotifications({
                commentText: newComment.trim(),
                taskId: task.id,
                actorId: user.id,
                actorName: user.name || "Usuario",
            });
        } catch (error) {
            console.error("Error adding comment:", error);
        }
    };

    const handleToggleChecklistItem = async (checklistId: string, itemId: string, isCompleted: boolean) => {
        if (!task) return;

        const supabase = createClient();

        try {
            await supabase
                .from("ChecklistItem")
                .update({
                    isCompleted: !isCompleted,
                    completedAt: !isCompleted ? new Date().toISOString() : null,
                })
                .eq("id", itemId);

            // Update local state
            setTask({
                ...task,
                checklists: task.checklists.map(cl =>
                    cl.id === checklistId
                        ? {
                            ...cl,
                            items: cl.items.map(item =>
                                item.id === itemId ? { ...item, isCompleted: !isCompleted } : item
                            ),
                        }
                        : cl
                ),
            });
        } catch (error) {
            console.error("Error toggling checklist item:", error);
        }
    };

    const handleAddChecklist = async () => {
        if (!task || !newChecklistName.trim()) return;
        const supabase = createClient();
        const tempId = crypto.randomUUID();
        const newChecklist = { id: tempId, name: newChecklistName.trim(), items: [] };
        setTask({ ...task, checklists: [...task.checklists, newChecklist] });
        setNewChecklistName("");
        setAddingChecklist(false);
        try {
            const { data, error } = await supabase
                .from("Checklist")
                .insert({ name: newChecklistName.trim(), taskId: task.id, order: task.checklists.length })
                .select("id")
                .single();
            if (error) throw error;
            setTask(prev => prev ? {
                ...prev,
                checklists: prev.checklists.map(cl => cl.id === tempId ? { ...cl, id: data.id } : cl)
            } : null);
        } catch {
            setTask(prev => prev ? { ...prev, checklists: prev.checklists.filter(cl => cl.id !== tempId) } : null);
            addToast({ title: "Error al crear checklist", type: "error" });
        }
    };

    const handleRenameChecklist = async (checklistId: string) => {
        if (!task || !editingChecklistName.trim()) return;
        const supabase = createClient();
        const oldName = task.checklists.find(cl => cl.id === checklistId)?.name || "";
        setTask({ ...task, checklists: task.checklists.map(cl => cl.id === checklistId ? { ...cl, name: editingChecklistName.trim() } : cl) });
        setEditingChecklistId(null);
        try {
            const { error } = await supabase.from("Checklist").update({ name: editingChecklistName.trim() }).eq("id", checklistId);
            if (error) throw error;
        } catch {
            setTask(prev => prev ? { ...prev, checklists: prev.checklists.map(cl => cl.id === checklistId ? { ...cl, name: oldName } : cl) } : null);
            addToast({ title: "Error al renombrar", type: "error" });
        }
    };

    const handleDeleteChecklist = async (checklistId: string) => {
        if (!task) return;
        const supabase = createClient();
        const removed = task.checklists.find(cl => cl.id === checklistId);
        setTask({ ...task, checklists: task.checklists.filter(cl => cl.id !== checklistId) });
        setConfirmDeleteChecklistId(null);
        try {
            const { error } = await supabase.from("Checklist").delete().eq("id", checklistId);
            if (error) throw error;
            addToast({ title: "Checklist eliminado", type: "success" });
        } catch {
            if (removed) setTask(prev => prev ? { ...prev, checklists: [...prev.checklists, removed] } : null);
            addToast({ title: "Error al eliminar", type: "error" });
        }
    };

    const handleAddChecklistItem = async (checklistId: string) => {
        if (!task || !newItemContent.trim()) return;
        const supabase = createClient();
        const checklist = task.checklists.find(cl => cl.id === checklistId);
        const tempId = crypto.randomUUID();
        const newItem = { id: tempId, content: newItemContent.trim(), isCompleted: false };
        setTask({
            ...task,
            checklists: task.checklists.map(cl => cl.id === checklistId
                ? { ...cl, items: [...cl.items, newItem] } : cl)
        });
        setNewItemContent("");
        try {
            const { data, error } = await supabase
                .from("ChecklistItem")
                .insert({ content: newItemContent.trim(), checklistId, order: checklist?.items.length || 0, isCompleted: false })
                .select("id")
                .single();
            if (error) throw error;
            setTask(prev => prev ? {
                ...prev,
                checklists: prev.checklists.map(cl => cl.id === checklistId
                    ? { ...cl, items: cl.items.map(item => item.id === tempId ? { ...item, id: data.id } : item) }
                    : cl)
            } : null);
        } catch {
            setTask(prev => prev ? {
                ...prev,
                checklists: prev.checklists.map(cl => cl.id === checklistId
                    ? { ...cl, items: cl.items.filter(item => item.id !== tempId) }
                    : cl)
            } : null);
            addToast({ title: "Error al crear item", type: "error" });
        }
    };

    const handleEditChecklistItem = async (checklistId: string, itemId: string) => {
        if (!task || !editingItemContent.trim()) return;
        const supabase = createClient();
        setTask({
            ...task,
            checklists: task.checklists.map(cl => cl.id === checklistId
                ? { ...cl, items: cl.items.map(item => item.id === itemId ? { ...item, content: editingItemContent.trim() } : item) }
                : cl)
        });
        setEditingItemId(null);
        try {
            const { error } = await supabase.from("ChecklistItem").update({ content: editingItemContent.trim() }).eq("id", itemId);
            if (error) throw error;
        } catch {
            addToast({ title: "Error al editar item", type: "error" });
        }
    };

    const handleDeleteChecklistItem = async (checklistId: string, itemId: string) => {
        if (!task) return;
        const supabase = createClient();
        const removed = task.checklists.find(cl => cl.id === checklistId)?.items.find(i => i.id === itemId);
        setTask({
            ...task,
            checklists: task.checklists.map(cl => cl.id === checklistId
                ? { ...cl, items: cl.items.filter(item => item.id !== itemId) } : cl)
        });
        try {
            const { error } = await supabase.from("ChecklistItem").delete().eq("id", itemId);
            if (error) throw error;
        } catch {
            if (removed) {
                setTask(prev => prev ? {
                    ...prev,
                    checklists: prev.checklists.map(cl => cl.id === checklistId
                        ? { ...cl, items: [...cl.items, removed] } : cl)
                } : null);
            }
        }
    };

    const handleAssignUser = async (userId: string) => {
        if (!task || !user) return;

        // Toggle: unassign if already assigned
        if (task.assignments.some(a => a.user.id === userId)) {
            const supabase = createClient();
            try {
                await supabase.from("TaskAssignment").delete().eq("taskId", task.id).eq("userId", userId);
                const removedUser = availableUsers.find(u => u.id === userId);
                setTask({ ...task, assignments: task.assignments.filter(a => a.user.id !== userId) });
                supabase.from("Activity").insert({
                    id: crypto.randomUUID(),
                    taskId: task.id, userId: user.id, type: "UNASSIGNED", oldValue: removedUser?.name || userId,
                    createdAt: new Date().toISOString(),
                }).then(() => reloadActivities(task.id));
                window.dispatchEvent(new CustomEvent('dcflow:refresh'));
                addToast({ title: "Usuario desasignado", type: "success" });
            } catch (err) {
                addToast({ title: "Error al desasignar", type: "error" });
            }
            return;
        }

        const supabase = createClient();

        try {
            const { error: assignError } = await supabase.from("TaskAssignment").insert({
                id: crypto.randomUUID(),
                taskId: task.id,
                userId,
                assignedAt: new Date().toISOString(),
            });
            if (assignError) throw assignError;

            // Update local state — use found user or fetch from DB as fallback
            const assignedUser = availableUsers.find(u => u.id === userId);
            const userName = assignedUser?.name || userId;
            const userAvatar = assignedUser?.avatarUrl || null;

            setTask({
                ...task,
                assignments: [
                    ...task.assignments,
                    { user: { id: userId, name: userName, avatarUrl: userAvatar } },
                ],
            });

            // Log activity (non-blocking)
            supabase.from("Activity").insert({
                id: crypto.randomUUID(),
                taskId: task.id,
                userId: user.id,
                type: "ASSIGNED",
                newValue: userName,
                createdAt: new Date().toISOString(),
            }).then(({ error: actError }) => {
                if (actError) console.warn("Activity log failed:", actError.message);
                else reloadActivities(task.id);
            });

            // Notify user (fire-and-forget)
            createTaskAssignmentNotification({
                userId,
                taskId: task.id,
                taskTitle: task.title,
                assignedBy: user.id,
            });

            addToast({ title: "Usuario asignado", type: "success" });
            setAssignOpen(false);
            setAssignSearch("");
        } catch (error) {
            const supaErr = error as { code?: string; message?: string };
            console.error("Error assigning user:", { code: supaErr?.code, message: supaErr?.message });
            addToast({ title: "Error al asignar usuario", description: supaErr?.message, type: "error" });
        }
    };



    if (!isOpen) return null;

    
    // Navigation between tasks
    const navTaskIds = (modalData?.taskIds as string[]) || [];
    const currentNavIndex = navTaskIds.indexOf(taskId || "");
    const canGoPrev = currentNavIndex > 0;
    const canGoNext = currentNavIndex < navTaskIds.length - 1 && currentNavIndex !== -1;
    const goToPrevTask = () => { if (canGoPrev) openModal("task-detail-v2", { taskId: navTaskIds[currentNavIndex - 1], taskIds: navTaskIds }); };
    const goToNextTask = () => { if (canGoNext) openModal("task-detail-v2", { taskId: navTaskIds[currentNavIndex + 1], taskIds: navTaskIds }); };
    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-[80vw] w-[80vw] max-h-[85vh] p-0 overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton className="h-8 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                ) : task ? (
                    <div className="flex h-full max-h-[85vh]">
                        {/* Main Content */}
                        <div className="w-[70%] flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="p-6 border-b border-border">
                                {/* Breadcrumb */}
                                {/* Navigation + Actions */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className={cn("h-7 w-7", !canGoPrev && "opacity-30 cursor-not-allowed")} title="Tarea anterior" onClick={goToPrevTask} disabled={!canGoPrev}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className={cn("h-7 w-7", !canGoNext && "opacity-30 cursor-not-allowed")} title="Siguiente tarea" onClick={goToNextTask} disabled={!canGoNext}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                                            <Share2 className="h-3.5 w-3.5" /> Compartir
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                    {task.list?.space && (
                                        <>
                                            <span
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: task.list.space.color }}
                                            />
                                            <span>{task.list.space.name}</span>
                                            <ChevronRight className="h-3 w-3" />
                                        </>
                                    )}
                                    {task.list?.folder && (
                                        <>
                                            <span>{task.list.folder.name}</span>
                                            <ChevronRight className="h-3 w-3" />
                                        </>
                                    )}
                                    <span>{task.list?.name}</span>
                                </div>

                                {/* Title */}
                                {editingTitle ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={titleValue}
                                            onChange={(e) => setTitleValue(e.target.value)}
                                            className="text-xl font-semibold"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveTitle();
                                                if (e.key === "Escape") {
                                                    setTitleValue(task.title);
                                                    setEditingTitle(false);
                                                }
                                            }}
                                        />
                                        <Button size="sm" onClick={handleSaveTitle} disabled={saving}>
                                            Guardar
                                        </Button>
                                    </div>
                                ) : (
                                    <h2
                                        className={cn("text-xl font-semibold", canEditByArea && "cursor-pointer hover:text-[#17385C]")}
                                        onClick={() => canEditByArea && setEditingTitle(true)}
                                    >
                                        {task.title}
                                    </h2>
                                )}
                            </div>

                            {/* Metadata Grid */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3 border-b border-border bg-muted/20">
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Estado</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild disabled={!canEditByArea}>
                                    <button className={cn("flex items-center gap-1.5 mt-1 text-sm hover:bg-accent rounded px-1 -ml-1 h-7 w-full", !canEditByArea && "opacity-60 cursor-default pointer-events-none")}>
                                      {task.status && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: task.status.color }} />}
                                      <span className="font-medium truncate">{task.status?.name || "Sin estado"}</span>
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    {statuses.map(s => (
                                      <DropdownMenuItem key={s.id} onClick={() => handleStatusChange(s.id)} className="gap-2">
                                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                        {s.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Prioridad</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild disabled={!canEditByArea}>
                                    <button className={cn("flex items-center gap-1.5 mt-1 text-sm hover:bg-accent rounded px-1 -ml-1 h-7", !canEditByArea && "opacity-60 cursor-default pointer-events-none")}>
                                      <Flag className="h-3.5 w-3.5" />
                                      <span className="font-medium">{task.priority === "URGENT" ? "Urgente" : task.priority === "HIGH" ? "Alta" : task.priority === "LOW" ? "Baja" : "Media"}</span>
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => handlePriorityChange("URGENT")} className="gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> Urgente</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePriorityChange("HIGH")} className="gap-2"><span className="h-2 w-2 rounded-full bg-orange-500" /> Alta</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePriorityChange("NORMAL")} className="gap-2"><span className="h-2 w-2 rounded-full bg-yellow-500" /> Media</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handlePriorityChange("LOW")} className="gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" /> Baja</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Fecha límite</span>
                                <Popover>
                                  <PopoverTrigger asChild disabled={!canEditByArea}>
                                    <button className={cn("flex items-center gap-1.5 mt-1 text-sm hover:bg-accent rounded px-1 -ml-1 h-7", !canEditByArea && "opacity-60 cursor-default pointer-events-none")}>
                                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha"}</span>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={task.dueDate ? new Date(task.dueDate) : undefined} onSelect={handleDueDateChange} initialFocus />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Asignados</span>
                                <div className="flex items-center gap-1 mt-1">
                                  {task.assignments && task.assignments.length > 0 ? (
                                    task.assignments.slice(0, 3).map((a: TaskData["assignments"][number], i: number) => (
                                      <span key={i} className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">{a.user?.name?.substring(0,2) || "?"}</span>
                                    ))
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Sin asignar</span>
                                  )}
                                  {canEditByArea && (
                                  <Popover open={assignOpen} onOpenChange={(open) => { setAssignOpen(open); if (!open) setAssignSearch(""); }}>
                                    <PopoverTrigger asChild>
                                      <button className="h-6 w-6 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center hover:bg-accent">
                                        <Plus className="h-3 w-3 text-muted-foreground" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-[220px] p-0"
                                      align="start"
                                      onInteractOutside={(e) => e.preventDefault()}
                                    >
                                      <div className="p-2 border-b">
                                        <input
                                          className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                                          placeholder="Buscar usuario..."
                                          value={assignSearch}
                                          onChange={(e) => setAssignSearch(e.target.value)}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="max-h-[200px] overflow-y-auto py-1">
                                        {availableUsers
                                          .filter(u => u.name?.toLowerCase().includes(assignSearch.toLowerCase()))
                                          .map(u => {
                                            const isAssigned = task.assignments.some(a => a.user.id === u.id);
                                            return (
                                              <button
                                                key={u.id}
                                                type="button"
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer text-left"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  handleAssignUser(u.id);
                                                }}
                                              >
                                                <span className="h-5 w-5 rounded-full bg-primary/80 text-primary-foreground text-[9px] flex items-center justify-center flex-shrink-0">
                                                  {u.name?.substring(0, 2)}
                                                </span>
                                                <span className="flex-1">{u.name}</span>
                                                {isAssigned && (
                                                  <span className="text-primary text-xs font-medium">✓</span>
                                                )}
                                              </button>
                                            );
                                          })
                                        }
                                        {availableUsers.filter(u => u.name?.toLowerCase().includes(assignSearch.toLowerCase())).length === 0 && (
                                          <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Read-only banner */}
                            {!canEditByArea && (
                                <div className="mx-6 mt-3 flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                                    <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>Estás en modo solo lectura en este espacio. Contacta a tu administrador para solicitar acceso.</span>
                                </div>
                            )}

                            {/* Tabs */}
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                                <TabsList className="mx-6 mt-4 w-fit">
                                    <TabsTrigger value="details" className="gap-2">
                                        <Edit3 className="h-4 w-4" />
                                        Detalles
                                    </TabsTrigger>
                                    <TabsTrigger value="attachments" className="gap-2">
                                        <Paperclip className="h-4 w-4" />
                                        Adjuntos
                                    </TabsTrigger>
                                    <TabsTrigger value="comments" className="gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Comentarios
                                    </TabsTrigger>
                                    <TabsTrigger value="activity" className="gap-2">
                                        <Clock className="h-4 w-4" />
                                        Actividad
                                    </TabsTrigger>
                                </TabsList>

                                <ScrollArea className="flex-1">
                                    {/* Details Tab */}
                                    <TabsContent value="details" className="p-6 pt-4 space-y-6">
                                        {/* Description */}
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground mb-2 block">
                                                Descripción
                                            </label>
                                            <RichTextEditor
                                                content={descriptionValue}
                                                onChange={(html) => setDescriptionValue(html)}
                                                onBlur={handleSaveDescription}
                                                placeholder="Añade una descripción..."
                                            />
                                        </div>

                                        {/* Checklists */}
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground mb-3 block">
                                                <CheckSquare className="h-4 w-4 inline mr-2" />
                                                Checklists
                                            </label>
                                            <div className="space-y-4">
                                                {task.checklists.map((checklist) => {
                                                    const completedCount = checklist.items.filter(i => i.isCompleted).length;
                                                    const totalCount = checklist.items.length;
                                                    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                                                    return (
                                                        <div key={checklist.id} className="border rounded-lg p-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                {editingChecklistId === checklist.id ? (
                                                                    <Input
                                                                        autoFocus
                                                                        value={editingChecklistName}
                                                                        onChange={(e) => setEditingChecklistName(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Enter") handleRenameChecklist(checklist.id);
                                                                            if (e.key === "Escape") setEditingChecklistId(null);
                                                                        }}
                                                                        onBlur={() => handleRenameChecklist(checklist.id)}
                                                                        className="h-7 text-sm font-medium"
                                                                    />
                                                                ) : (
                                                                    <span className="font-medium">{checklist.name}</span>
                                                                )}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm text-muted-foreground">
                                                                        {completedCount}/{totalCount}
                                                                    </span>
                                                                    {confirmDeleteChecklistId === checklist.id ? (
                                                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                                            <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => handleDeleteChecklist(checklist.id)}>
                                                                                Eliminar
                                                                            </Button>
                                                                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setConfirmDeleteChecklistId(null)}>
                                                                                Cancelar
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                <DropdownMenuItem onClick={() => {
                                                                                    setEditingChecklistId(checklist.id);
                                                                                    setEditingChecklistName(checklist.name);
                                                                                }}>
                                                                                    <Edit3 className="h-3.5 w-3.5 mr-2" />
                                                                                    Renombrar
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDeleteChecklistId(checklist.id)}>
                                                                                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                                                    Eliminar
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="h-1.5 bg-muted rounded-full mb-3">
                                                                <div
                                                                    className="h-full bg-primary rounded-full transition-all"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                {checklist.items.map((item) => (
                                                                    <div key={item.id} className="flex items-center gap-3 py-1.5 group/item">
                                                                        <div onClick={(e) => e.stopPropagation()}>
                                                                            <Checkbox
                                                                                checked={item.isCompleted}
                                                                                onCheckedChange={() => handleToggleChecklistItem(checklist.id, item.id, item.isCompleted)}
                                                                            />
                                                                        </div>
                                                                        {editingItemId === item.id ? (
                                                                            <Input
                                                                                autoFocus
                                                                                value={editingItemContent}
                                                                                onChange={(e) => setEditingItemContent(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === "Enter") handleEditChecklistItem(checklist.id, item.id);
                                                                                    if (e.key === "Escape") setEditingItemId(null);
                                                                                }}
                                                                                onBlur={() => handleEditChecklistItem(checklist.id, item.id)}
                                                                                className="h-7 text-sm flex-1"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            />
                                                                        ) : (
                                                                            <span
                                                                                className={cn(
                                                                                    "text-sm flex-1",
                                                                                    item.isCompleted && "line-through text-muted-foreground"
                                                                                )}
                                                                                onDoubleClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setEditingItemId(item.id);
                                                                                    setEditingItemContent(item.content);
                                                                                }}
                                                                            >
                                                                                {item.content}
                                                                            </span>
                                                                        )}
                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                                                                setEditingItemId(item.id);
                                                                                setEditingItemContent(item.content);
                                                                            }}>
                                                                                <Edit3 className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteChecklistItem(checklist.id, item.id)}>
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {/* Add item */}
                                                                {addingItemToChecklistId === checklist.id ? (
                                                                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                                                                        <Input
                                                                            autoFocus
                                                                            value={newItemContent}
                                                                            onChange={(e) => setNewItemContent(e.target.value)}
                                                                            placeholder="Nuevo item..."
                                                                            className="h-7 text-sm flex-1"
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === "Enter" && newItemContent.trim()) {
                                                                                    handleAddChecklistItem(checklist.id);
                                                                                }
                                                                                if (e.key === "Escape") {
                                                                                    setAddingItemToChecklistId(null);
                                                                                    setNewItemContent("");
                                                                                }
                                                                            }}
                                                                        />
                                                                        <Button size="sm" className="h-7 text-xs" onClick={() => handleAddChecklistItem(checklist.id)} disabled={!newItemContent.trim()}>
                                                                            Agregar
                                                                        </Button>
                                                                        <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAddingItemToChecklistId(null); setNewItemContent(""); }}>
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="w-full justify-start text-muted-foreground hover:text-foreground text-xs h-7 mt-1"
                                                                        onClick={(e) => { e.stopPropagation(); setAddingItemToChecklistId(checklist.id); }}
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                                                        Agregar item
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Add checklist button */}
                                            {addingChecklist ? (
                                                <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                                                    <Input
                                                        autoFocus
                                                        value={newChecklistName}
                                                        onChange={(e) => setNewChecklistName(e.target.value)}
                                                        placeholder="Nombre del checklist..."
                                                        className="h-8 text-sm"
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && newChecklistName.trim()) handleAddChecklist();
                                                            if (e.key === "Escape") { setAddingChecklist(false); setNewChecklistName(""); }
                                                        }}
                                                    />
                                                    <Button size="sm" className="h-8" onClick={handleAddChecklist} disabled={!newChecklistName.trim()}>
                                                        Crear
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddingChecklist(false); setNewChecklistName(""); }}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-muted-foreground hover:text-foreground mt-2"
                                                    onClick={(e) => { e.stopPropagation(); setAddingChecklist(true); }}
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Agregar checklist
                                                </Button>
                                            )}
                                        </div>

                                        {/* Subtareas */}
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
                                                Subtareas
                                                {task.subtasks.length > 0 && (
                                                    <span className="text-xs">
                                                        ({task.subtasks.filter(s => s.status?.name?.toLowerCase() === 'done' || s.status?.name?.toLowerCase() === 'completada').length}/{task.subtasks.length})
                                                    </span>
                                                )}
                                            </label>
                                            <div className="space-y-1">
                                                {task.subtasks.map((subtask) => (
                                                    <div
                                                        key={subtask.id}
                                                        onClick={() => openModal("task-detail-v2", { taskId: subtask.id })}
                                                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors group"
                                                    >
                                                        <div
                                                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: subtask.status?.color || "#94a3b8" }}
                                                        />
                                                        <span className="text-sm flex-1 truncate group-hover:text-primary transition-colors">
                                                            {subtask.title}
                                                        </span>
                                                        {subtask.assignments.length > 0 && (
                                                            <div className="flex -space-x-1">
                                                                {subtask.assignments.slice(0, 2).map((a) => (
                                                                    <Avatar key={a.user.id} className="h-5 w-5 border border-background">
                                                                        <AvatarFallback className="text-[8px] bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                                                                            {a.user.name?.slice(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {(subtask.startDate || subtask.dueDate) && (
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <CalendarIcon className="h-3 w-3" />
                                                                {subtask.startDate && subtask.dueDate
                                                                    ? `${format(new Date(subtask.startDate), "d MMM", { locale: es })} – ${format(new Date(subtask.dueDate), "d MMM", { locale: es })}`
                                                                    : subtask.dueDate
                                                                        ? format(new Date(subtask.dueDate), "d MMM", { locale: es })
                                                                        : format(new Date(subtask.startDate!), "d MMM", { locale: es })}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}

                                                {/* Inline add subtask */}
                                                {addingSubtask ? (
                                                    <div className="flex flex-col gap-2 px-3 py-2 border border-border rounded-lg bg-muted/30">
                                                        <Input
                                                            autoFocus
                                                            value={newSubtaskTitle}
                                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                            placeholder="Nombre de la subtarea..."
                                                            className="h-8 text-sm"
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && newSubtaskTitle.trim()) {
                                                                    handleAddSubtask();
                                                                }
                                                                if (e.key === "Escape") {
                                                                    setAddingSubtask(false);
                                                                    setNewSubtaskTitle("");
                                                                    setNewSubtaskStartDate(undefined);
                                                                    setNewSubtaskDueDate(undefined);
                                                                }
                                                            }}
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-normal">
                                                                        <CalendarIcon className="h-3 w-3" />
                                                                        {newSubtaskStartDate
                                                                            ? format(newSubtaskStartDate, "d MMM", { locale: es })
                                                                            : "Inicio"}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0" align="start">
                                                                    <Calendar
                                                                        mode="single"
                                                                        selected={newSubtaskStartDate}
                                                                        onSelect={setNewSubtaskStartDate}
                                                                        locale={es}
                                                                        initialFocus
                                                                    />
                                                                    {newSubtaskStartDate && (
                                                                        <div className="p-2 border-t">
                                                                            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setNewSubtaskStartDate(undefined)}>
                                                                                Quitar fecha de inicio
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </PopoverContent>
                                                            </Popover>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-normal">
                                                                        <CalendarIcon className="h-3 w-3" />
                                                                        {newSubtaskDueDate
                                                                            ? format(newSubtaskDueDate, "d MMM", { locale: es })
                                                                            : "Vencimiento"}
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0" align="start">
                                                                    <Calendar
                                                                        mode="single"
                                                                        selected={newSubtaskDueDate}
                                                                        onSelect={setNewSubtaskDueDate}
                                                                        locale={es}
                                                                        initialFocus
                                                                    />
                                                                    {newSubtaskDueDate && (
                                                                        <div className="p-2 border-t">
                                                                            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setNewSubtaskDueDate(undefined)}>
                                                                                Quitar fecha de vencimiento
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </PopoverContent>
                                                            </Popover>
                                                            <div className="flex-1" />
                                                            <Button size="sm" className="h-7 text-xs" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}>
                                                                Agregar
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(""); setNewSubtaskStartDate(undefined); setNewSubtaskDueDate(undefined); }}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full justify-start text-muted-foreground hover:text-foreground"
                                                        onClick={() => setAddingSubtask(true)}
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Agregar subtarea
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Dependencias */}
                                        <div>
                                            <label className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                                <Link2 className="h-4 w-4" />
                                                Dependencias
                                                {isTaskBlocked(taskRelations, task.id, ["done", "completada", "terminada"]) && (
                                                    <Badge variant="destructive" className="text-[10px] h-5">
                                                        <Lock className="h-3 w-3 mr-1" />
                                                        Bloqueada
                                                    </Badge>
                                                )}
                                            </label>
                                            <div className="space-y-3">
                                                {(() => {
                                                    const grouped = groupRelationsByType(taskRelations, task.id);
                                                    const hasRelations = Object.values(grouped).some(g => g.length > 0);

                                                    if (!hasRelations && !addingRelation) {
                                                        return (
                                                            <p className="text-xs text-muted-foreground">Sin dependencias</p>
                                                        );
                                                    }

                                                    return (
                                                        <>
                                                            {(["BLOCKED_BY", "BLOCKS", "RELATES_TO", "DUPLICATES"] as RelationType[]).map(type => {
                                                                const items = grouped[type];
                                                                if (items.length === 0) return null;
                                                                return (
                                                                    <div key={type}>
                                                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                                            {getRelationLabel(type)}
                                                                        </span>
                                                                        <div className="space-y-1 mt-1">
                                                                            {items.map(item => (
                                                                                <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-accent/50 group/rel">
                                                                                    <span
                                                                                        className="h-2 w-2 rounded-full flex-shrink-0"
                                                                                        style={{ backgroundColor: item.relatedTask.status?.color || "#94a3b8" }}
                                                                                    />
                                                                                    <span
                                                                                        className="text-sm flex-1 truncate cursor-pointer hover:text-primary"
                                                                                        onClick={() => openModal("task-detail-v2", { taskId: item.relatedTask.id })}
                                                                                    >
                                                                                        {item.relatedTask.title}
                                                                                    </span>
                                                                                    {item.relatedTask.status && (
                                                                                        <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                                                                                            {item.relatedTask.status.name}
                                                                                        </Badge>
                                                                                    )}
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-6 w-6 opacity-0 group-hover/rel:opacity-100 transition-opacity shrink-0"
                                                                                        onClick={() => handleRemoveRelation(item.id)}
                                                                                    >
                                                                                        <X className="h-3 w-3" />
                                                                                    </Button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}

                                                {/* Add relation form */}
                                                {addingRelation ? (
                                                    <div className="border rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2">
                                                            <Select value={selectedRelationType} onValueChange={(v) => setSelectedRelationType(v as RelationType)}>
                                                                <SelectTrigger className="h-7 text-xs w-[160px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="BLOCKS">Bloquea a</SelectItem>
                                                                    <SelectItem value="BLOCKED_BY">Bloqueada por</SelectItem>
                                                                    <SelectItem value="RELATES_TO">Relacionada con</SelectItem>
                                                                    <SelectItem value="DUPLICATES">Duplica</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAddingRelation(false); setRelationSearch(""); setRelationSearchResults([]); }}>
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                        <Command className="border rounded-md">
                                                            <CommandInput
                                                                placeholder="Buscar tarea..."
                                                                value={relationSearch}
                                                                onValueChange={handleSearchRelationTasks}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    {relationSearch.length < 2 ? "Escribe para buscar..." : "Sin resultados"}
                                                                </CommandEmpty>
                                                                <CommandGroup>
                                                                    {relationSearchResults.map(t => (
                                                                        <CommandItem
                                                                            key={t.id}
                                                                            onSelect={() => handleAddRelation(t.id)}
                                                                        >
                                                                            <span
                                                                                className="h-2 w-2 rounded-full mr-2 flex-shrink-0"
                                                                                style={{ backgroundColor: t.status?.color || "#94a3b8" }}
                                                                            />
                                                                            <span className="truncate">{t.title}</span>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full justify-start text-muted-foreground hover:text-foreground"
                                                        onClick={() => setAddingRelation(true)}
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Agregar dependencia
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Custom Fields */}
                                        {taskCustomFields.length > 0 && (
                                            <div>
                                                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                                                    <Flag className="h-4 w-4 inline mr-2" />
                                                    Campos personalizados
                                                </label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {taskCustomFields.map(field => (
                                                        <CustomFieldValueEditor
                                                            key={field.id}
                                                            field={field}
                                                            taskId={task.id}
                                                            onValueChange={handleCustomFieldChange}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Attachments */}
                                        {task.attachments && task.attachments.length > 0 && (
                                            <div>
                                                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                                                    <Paperclip className="h-4 w-4 inline mr-2" />
                                                    Archivos adjuntos ({task.attachments.length})
                                                </label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {task.attachments.map((attachment) => {
                                                        const fileSizeKB = attachment.fileSize > 0 ? (attachment.fileSize / 1024).toFixed(1) : null;
                                                        const isImage = attachment.fileType.startsWith('image/');

                                                        
                    return (
                                                            <a
                                                                key={attachment.id}
                                                                href={attachment.fileUrl}
                                                                download={attachment.fileName}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
                                                                <div className="flex-shrink-0">
                                                                    {isImage ? (
                                                                        <div className="h-10 w-10 rounded border overflow-hidden bg-muted">
                                                                            <img
                                                                                src={attachment.fileUrl}
                                                                                alt={attachment.fileName}
                                                                                className="h-full w-full object-cover"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="h-10 w-10 rounded border bg-muted/50 flex items-center justify-center">
                                                                            <File className="h-5 w-5 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium truncate">
                                                                        {attachment.fileName}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {fileSizeKB ? `${fileSizeKB} KB · ` : ""}Subido por {attachment.uploadedBy.name}
                                                                    </p>
                                                                </div>
                                                                <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>

                                    {/* Comments Tab */}
                                    {/* Attachments Tab */}
                                    <TabsContent value="attachments" className="p-6 pt-4 space-y-4">
                                        <div className="text-sm font-medium text-muted-foreground mb-2">Archivos adjuntos</div>
                                        <FileUploadZone taskId={task?.id || ""} onUploadComplete={refreshAttachments} />
                                        {task?.attachments && task.attachments.length > 0 && (
                                            <div className="space-y-2 mt-4">
                                                {task.attachments.map((att: TaskData["attachments"][number]) => (
                                                    <div key={att.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                                                        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{att.fileName}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {att.fileType} - {Math.round((att.fileSize || 0) / 1024)} KB
                                                            </p>
                                                        </div>
                                                        <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                                                           className="text-xs text-primary hover:underline">Descargar</a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {(!task?.attachments || task.attachments.length === 0) && (
                                            <p className="text-sm text-muted-foreground text-center py-4">No hay archivos adjuntos</p>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="comments" className="p-6 pt-4 space-y-4">
                                        {/* New Comment */}
                                        <div className="flex gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="text-xs bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                                                    {user?.name?.slice(0, 2).toUpperCase() || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 flex gap-2">
                                                <Input
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    placeholder="Escribe un comentario..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleAddComment();
                                                        }
                                                    }}
                                                />
                                                <Button size="icon" variant="ghost" title="Adjuntar archivo">
                                                    <Paperclip className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" onClick={handleAddComment} disabled={!newComment.trim()}>
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Comments List */}
                                        <div className="space-y-4">
                                            {comments.length === 0 ? (
                                                <p className="text-center text-muted-foreground py-8">
                                                    No hay comentarios aún
                                                </p>
                                            ) : (
                                                comments.map((comment) => (
                                                    <div key={comment.id} className="flex gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback className="text-xs bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                                                                {comment.user?.name?.slice(0, 2).toUpperCase() || "?"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm">
                                                                    {comment.user?.name}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {format(new Date(comment.createdAt), "d MMM, HH:mm", { locale: es })}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm mt-1">{comment.content}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* Activity Tab */}
                                    <TabsContent value="activity" className="p-6 pt-4">
                                        <div className="space-y-4">
                                            {/* Activity Timeline */}
                                            {task.createdBy && (
                                                <div className="flex gap-3">
                                                    <div className="flex flex-col items-center">
                                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <Plus className="h-4 w-4 text-primary" />
                                                        </div>
                                                        {comments.length > 0 && <div className="flex-1 w-px bg-border mt-2" />}
                                                    </div>
                                                    <div className="flex-1 pb-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm">
                                                                {task.createdBy.name}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                creó esta tarea
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {format(new Date(task.createdAt || task.dueDate || new Date()), "d MMM yyyy, HH:mm", { locale: es })}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* DB activities (status, priority, date changes) */}
                                            {activities.map((activity) => (
                                                <div key={activity.id} className="flex gap-3">
                                                    <div className="flex flex-col items-center">
                                                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                                                            <Activity className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 pb-4">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-medium text-sm">{activity.user?.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {activity.type === "ASSIGNED" ? `asignó a ${activity.newValue}`
                                                                    : activity.type === "UNASSIGNED" ? `quitó a ${activity.oldValue}`
                                                                    : activity.type === "COMMENT_ADDED" ? "agregó un comentario"
                                                                    : activity.type === "ATTACHMENT_ADDED" ? `adjuntó: ${activity.newValue || "un archivo"}`
                                                                    : activity.type === "CREATED" && !activity.field ? "creó esta tarea"
                                                                    : activity.field === "status" ? <>cambió estado: <span className="font-medium">{activity.oldValue}</span> → <span className="font-medium">{activity.newValue}</span></>
                                                                    : activity.field === "priority" ? <>cambió prioridad: <span className="font-medium">{activity.oldValue}</span> → <span className="font-medium">{activity.newValue}</span></>
                                                                    : activity.field === "dueDate" ? "actualizó la fecha límite"
                                                                    : activity.field === "title" ? <>renombró: <span className="font-medium">{activity.oldValue}</span> → <span className="font-medium">{activity.newValue}</span></>
                                                                    : activity.field === "description" ? "actualizó la descripción"
                                                                    : activity.field === "subtask" ? `añadió subtarea: ${activity.newValue}`
                                                                    : activity.type}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {activity.createdAt ? format(new Date(activity.createdAt), "d MMM yyyy, HH:mm", { locale: es }) : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Comments as activity */}
                                            {comments.map((comment, index) => (
                                                <div key={comment.id} className="flex gap-3">
                                                    <div className="flex flex-col items-center">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarFallback className="text-xs bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                                                                {comment.user?.name?.slice(0, 2).toUpperCase() || "?"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {index < comments.length - 1 && <div className="flex-1 w-px bg-border mt-2" />}
                                                    </div>
                                                    <div className="flex-1 pb-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm">
                                                                {comment.user?.name}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                comentó
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {format(new Date(comment.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                                                        </p>
                                                        <div className="mt-2 p-3 bg-muted/50 rounded-lg border">
                                                            <p className="text-sm">{comment.content}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Empty state */}
                                            {!task.createdBy && comments.length === 0 && (
                                                <div className="text-center py-8">
                                                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                                    <p className="text-sm text-muted-foreground">
                                                        No hay actividad registrada
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                </ScrollArea>
                            </Tabs>
                        </div>

                        {/* Sidebar */}
                        <div className="w-[30%] border-l border-border flex flex-col overflow-hidden bg-muted/30">
                            {/* Activity & Comments */}
                            <div className="flex items-center justify-between p-3 border-b border-border">
                                <h3 className="text-sm font-semibold">Actividad</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {/* Activity Timeline */}
                                {activities && activities.length > 0 ? (
                                    activities.map((activity) => (
                                        <div key={activity.id} className="flex gap-2 text-xs">
                                            <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                            <div>
                                                <span className="font-medium">{activity.user?.name}</span>
                                                {" "}<span className="text-muted-foreground">{
                                                    activity.type === "CREATED" && activity.field === "subtask"
                                                        ? `agregó la subtarea "${activity.newValue}"`
                                                        : activity.type === "CREATED"
                                                        ? "creó esta tarea"
                                                        : activity.type === "ASSIGNED"
                                                        ? `asignó a ${activity.newValue}`
                                                        : activity.type === "UNASSIGNED"
                                                        ? `quitó a ${activity.oldValue}`
                                                        : activity.type === "COMMENT_ADDED"
                                                        ? "agregó un comentario"
                                                        : activity.type === "ATTACHMENT_ADDED"
                                                        ? "adjuntó un archivo"
                                                        : activity.field === "title"
                                                        ? `renombró la tarea`
                                                        : activity.field === "description"
                                                        ? "actualizó la descripción"
                                                        : activity.field === "status" && activity.oldValue && activity.newValue
                                                        ? `cambió estado: ${activity.oldValue} → ${activity.newValue}`
                                                        : activity.field === "status"
                                                        ? "cambió el estado"
                                                        : activity.field === "priority" && activity.oldValue && activity.newValue
                                                        ? `cambió prioridad: ${activity.oldValue} → ${activity.newValue}`
                                                        : activity.field === "priority"
                                                        ? "cambió la prioridad"
                                                        : activity.field === "dueDate"
                                                        ? "actualizó la fecha límite"
                                                        : activity.field
                                                        ? `cambió ${activity.field}`
                                                        : activity.type
                                                }</span>
                                                <p className="text-muted-foreground mt-0.5">
                                                    {activity.createdAt ? new Date(activity.createdAt).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground text-center py-4">Sin actividad aún</p>
                                )}
                                {/* Comments */}
                                {comments && comments.length > 0 && (
                                    <div className="border-t border-border pt-3 mt-3 space-y-3">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Comentarios</h4>
                                        {comments.map((comment) => (
                                            <div key={comment.id} className="flex gap-2">
                                                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center shrink-0">{comment.user?.name?.substring(0,2) || "?"}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium">{comment.user?.name}</span>
                                                        <span className="text-[10px] text-muted-foreground">{comment.createdAt ? new Date(comment.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" }) : ""}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 break-words">{comment.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Comment Input */}
                            <div className="border-t border-border p-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Escribe un comentario..."
                                        className="text-xs h-8"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                                    />
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Adjuntar archivo">
                                        <Paperclip className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" className="h-8 px-2" onClick={handleAddComment} disabled={!newComment.trim()}>
                                        <Send className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center text-muted-foreground">
                        No se encontró la tarea
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
