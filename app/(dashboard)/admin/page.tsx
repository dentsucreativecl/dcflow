"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Shield,
    Users,
    FolderKanban,
    Building2,
    Clock,
    Upload,
    Hash,
    Loader2,
    UserCheck,
    UserX,
    Archive,
    ArchiveRestore,
    Plus,
    Edit3,
    X,
    AlertTriangle,
    FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGendered } from "@/lib/utils/gender";

interface UserRow {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    department: string | null;
    userAreas: string[];
    gender?: string | null;
}

interface ChannelRow {
    id: string;
    name: string;
    slug: string;
    isArchived: boolean;
}

interface ActivityRow {
    id: string;
    type: string;
    field: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    user: { name: string } | null;
    task: { title: string } | null;
}

interface SpaceRow {
    id: string;
    name: string;
    color: string;
    isArchived: boolean;
    projectCount: number;
    memberCount: number;
}

interface ProjectRow {
    id: string;
    name: string;
    folderName: string | null;
    spaceName: string;
    spaceColor: string;
    taskCount: number;
    doneCount: number;
    progress: number;
}

export default function AdminPage() {
    const { user, isSuperAdmin, isAdmin, loading: authLoading } = useAuth();
    const { openModal } = useAppStore();
    const router = useRouter();
    const canAccess = isSuperAdmin || isAdmin;
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [projectCount, setProjectCount] = useState(0);
    const [clientCount, setClientCount] = useState(0);
    const [memberCount, setMemberCount] = useState(0);
    const [hoursThisMonth, setHoursThisMonth] = useState(0);
    const [activities, setActivities] = useState<ActivityRow[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [channels, setChannels] = useState<ChannelRow[]>([]);
    const [spaces, setSpaces] = useState<SpaceRow[]>([]);
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);
    const [updatingChannel, setUpdatingChannel] = useState<string | null>(null);
    const [updatingSpace, setUpdatingSpace] = useState<string | null>(null);

    // Deactivation modal state
    const [deactivateUser, setDeactivateUser] = useState<UserRow | null>(null);
    const [deactivateTaskCount, setDeactivateTaskCount] = useState(0);
    const [deactivateTransferTo, setDeactivateTransferTo] = useState<string>("");
    const [deactivateLoading, setDeactivateLoading] = useState(false);

    // Edit member modal state
    const [editUser, setEditUser] = useState<UserRow | null>(null);
    const [editName, setEditName] = useState("");
    const [editDepartment, setEditDepartment] = useState("");
    const [editUserAreas, setEditUserAreas] = useState("");
    const [editGender, setEditGender] = useState("MASCULINE");
    const [savingEdit, setSavingEdit] = useState(false);

    // Active tab
    const [activeSection, setActiveSection] = useState<"overview" | "clients" | "projects" | "members" | "channels">("overview");

    // Redirect non-admin
    useEffect(() => {
        if (!authLoading && (!user || !canAccess)) {
            router.replace("/dashboard");
        }
    }, [authLoading, user, canAccess, router]);

    const fetchData = useCallback(async () => {
        const supabase = createClient();

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString()
            .split("T")[0];

        const [
            projectsRes,
            spacesRes,
            membersRes,
            hoursRes,
            activityRes,
            usersRes,
            channelsRes,
            spacesDataRes,
        ] = await Promise.all([
            supabase.from("List").select("id", { count: "exact", head: true }),
            supabase.from("Space").select("id", { count: "exact", head: true }),
            supabase.from("User").select("id", { count: "exact", head: true }).eq("isActive", true),
            supabase.from("TimeEntry").select("hours").gte("date", monthStart),
            supabase
                .from("Activity")
                .select("id, type, field, oldValue, newValue, createdAt, user:User(name), task:Task(title)")
                .order("createdAt", { ascending: false })
                .limit(5),
            supabase.from("User").select("id, name, email, role, isActive, department, userAreas, gender").order("name"),
            supabase.from("Channel").select("id, name, slug, isArchived").order("name"),
            fetch("/api/spaces").then(r => r.json()),
        ]);

        setProjectCount(projectsRes.count ?? 0);
        setClientCount(spacesRes.count ?? 0);
        setMemberCount(membersRes.count ?? 0);

        if (hoursRes.data) {
            const total = hoursRes.data.reduce(
                (sum: number, e: { hours: number }) => sum + (e.hours || 0), 0
            );
            setHoursThisMonth(Math.round(total * 10) / 10);
        }

        if (activityRes.data) {
            setActivities(
                activityRes.data.map((a: any) => ({
                    id: a.id,
                    type: a.type,
                    field: a.field,
                    oldValue: a.oldValue,
                    newValue: a.newValue,
                    createdAt: a.createdAt,
                    user: Array.isArray(a.user) ? a.user[0] : a.user,
                    task: Array.isArray(a.task) ? a.task[0] : a.task,
                }))
            );
        }

        if (usersRes.data) setUsers(usersRes.data as UserRow[]);
        if (channelsRes.data) setChannels(channelsRes.data as ChannelRow[]);

        // Build space rows with counts
        if (spacesDataRes) {
            const spaceIds = spacesDataRes.map((s: any) => s.id);

            // Count projects per space
            const { data: listsData } = await supabase
                .from("List")
                .select("id, name, spaceId, Folder(name)")
                .in("spaceId", spaceIds);

            const projectsBySpace = new Map<string, number>();
            (listsData || []).forEach((l: any) => {
                projectsBySpace.set(l.spaceId, (projectsBySpace.get(l.spaceId) || 0) + 1);
            });

            // Count members per space
            const { data: membersData } = await supabase
                .from("SpaceMember")
                .select("spaceId, userId")
                .in("spaceId", spaceIds);

            const membersBySpace = new Map<string, number>();
            (membersData || []).forEach((m: any) => {
                membersBySpace.set(m.spaceId, (membersBySpace.get(m.spaceId) || 0) + 1);
            });

            setSpaces(
                spacesDataRes.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    color: s.color,
                    isArchived: s.isArchived || false,
                    projectCount: projectsBySpace.get(s.id) || 0,
                    memberCount: membersBySpace.get(s.id) || 0,
                }))
            );

            // Build project rows
            if (listsData) {
                const spaceMap = new Map<string, { name: string; color: string }>();
                spacesDataRes.forEach((s: any) => spaceMap.set(s.id, { name: s.name, color: s.color }));

                const listIds = listsData.map((l: any) => l.id);
                const { data: tasksData } = await supabase
                    .from("Task")
                    .select("id, listId, Status:statusId(type)")
                    .in("listId", listIds)
                    .is("parentId", null);

                const tasksByList = new Map<string, { total: number; done: number }>();
                (tasksData || []).forEach((t: any) => {
                    const status = Array.isArray(t.Status) ? t.Status[0] : t.Status;
                    const entry = tasksByList.get(t.listId) || { total: 0, done: 0 };
                    entry.total++;
                    if (status?.type === "DONE") entry.done++;
                    tasksByList.set(t.listId, entry);
                });

                setProjects(
                    listsData.map((l: any) => {
                        const space = spaceMap.get(l.spaceId);
                        const folder = Array.isArray(l.Folder) ? l.Folder[0] : l.Folder;
                        const counts = tasksByList.get(l.id) || { total: 0, done: 0 };
                        return {
                            id: l.id,
                            name: l.name || "—",
                            folderName: folder?.name || null,
                            spaceName: space?.name || "—",
                            spaceColor: space?.color || "#666",
                            taskCount: counts.total,
                            doneCount: counts.done,
                            progress: counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0,
                        };
                    })
                );
            }
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        if (canAccess) fetchData();
    }, [canAccess, fetchData]);

    useEffect(() => {
        const handler = () => fetchData();
        window.addEventListener("dcflow:channels-refresh", handler);
        window.addEventListener("dcflow:refresh", handler);
        window.addEventListener("dcflow:clients-refresh", handler);
        return () => {
            window.removeEventListener("dcflow:channels-refresh", handler);
            window.removeEventListener("dcflow:refresh", handler);
            window.removeEventListener("dcflow:clients-refresh", handler);
        };
    }, [fetchData]);

    const handleRoleChange = async (userId: string, newRole: string) => {
        setUpdatingUser(userId);
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
            addToast({ title: 'Rol actualizado correctamente', type: 'success' });
        } catch (err) {
            console.error("Error changing role:", err);
            addToast({ title: 'Error al cambiar el rol', type: 'error' });
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleGenderChange = async (userId: string, gender: string) => {
        console.log("GENDER CHANGE", userId, gender);
        // Optimistic update immediately so the UI reflects the change
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, gender } : u)));
        try {
            const res = await fetch(`/api/admin/users/${userId}/gender`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gender }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
        } catch (err) {
            console.error("Error changing gender:", err);
            addToast({ title: 'Error al cambiar género', type: 'error' });
            // Revert on failure by re-fetching
            fetchData();
        }
    };

    const openEditUser = (u: UserRow) => {
        setEditUser(u);
        setEditName(u.name);
        setEditDepartment(u.department || "");
        setEditUserAreas((u.userAreas || []).join(", "));
        setEditGender(u.gender || "MASCULINE");
    };

    const handleSaveProfile = async () => {
        if (!editUser) return;
        setSavingEdit(true);
        try {
            const areas = editUserAreas.split(",").map(a => a.trim()).filter(Boolean);
            const res = await fetch(`/api/admin/users/${editUser.id}/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName, department: editDepartment || null, userAreas: areas, gender: editGender }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setUsers((prev) => prev.map((u) => u.id === editUser.id
                ? { ...u, name: editName, department: editDepartment || null, userAreas: areas, gender: editGender }
                : u
            ));
            addToast({ title: "Miembro actualizado", type: "success" });
            setEditUser(null);
        } catch (err) {
            console.error("Error saving profile:", err);
            addToast({ title: "Error al guardar", type: "error" });
        } finally {
            setSavingEdit(false);
        }
    };

    const handleStatusToggle = async (userId: string, currentActive: boolean) => {
        setUpdatingUser(userId);
        try {
            const res = await fetch(`/api/admin/users/${userId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentActive }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u)));
        } catch (err) {
            console.error("Error toggling status:", err);
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleArchiveChannel = async (channelId: string, currentArchived: boolean) => {
        setUpdatingChannel(channelId);
        try {
            const res = await fetch(`/api/admin/channels/${channelId}/archive`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isArchived: !currentArchived }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, isArchived: !currentArchived } : c)));
            window.dispatchEvent(new CustomEvent("dcflow:channels-refresh"));
        } catch (err) {
            console.error("Error toggling archive:", err);
        } finally {
            setUpdatingChannel(null);
        }
    };

    const handleArchiveSpace = async (spaceId: string, currentArchived: boolean) => {
        setUpdatingSpace(spaceId);
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("Space")
                .update({ isArchived: !currentArchived })
                .eq("id", spaceId);
            if (error) throw error;
            setSpaces((prev) => prev.map((s) => (s.id === spaceId ? { ...s, isArchived: !currentArchived } : s)));
            window.dispatchEvent(new CustomEvent("dcflow:clients-refresh"));
        } catch (err) {
            console.error("Error toggling space archive:", err);
        } finally {
            setUpdatingSpace(null);
        }
    };

    const openDeactivateModal = async (targetUser: UserRow) => {
        setDeactivateUser(targetUser);
        setDeactivateTransferTo("");
        // Count active tasks assigned to this user
        const supabase = createClient();
        const { data: assignments } = await supabase
            .from("TaskAssignment")
            .select("taskId, Task!inner(id, Status!inner(type))")
            .eq("userId", targetUser.id);
        const activeTasks = (assignments || []).filter((a: any) => {
            const status = Array.isArray(a.Task?.Status) ? a.Task.Status[0] : a.Task?.Status;
            return status?.type !== "DONE";
        });
        setDeactivateTaskCount(activeTasks.length);
    };

    const confirmDeactivate = async () => {
        if (!deactivateUser) return;
        setDeactivateLoading(true);
        try {
            const supabase = createClient();

            // Transfer tasks if needed
            if (deactivateTaskCount > 0 && deactivateTransferTo) {
                // Get active task assignments for this user
                const { data: assignments } = await supabase
                    .from("TaskAssignment")
                    .select("id, taskId, Task!inner(id, Status!inner(type))")
                    .eq("userId", deactivateUser.id);
                const activeAssignmentIds = (assignments || [])
                    .filter((a: any) => {
                        const status = Array.isArray(a.Task?.Status) ? a.Task.Status[0] : a.Task?.Status;
                        return status?.type !== "DONE";
                    })
                    .map((a: any) => a.id);

                if (activeAssignmentIds.length > 0) {
                    await supabase
                        .from("TaskAssignment")
                        .update({ userId: deactivateTransferTo })
                        .in("id", activeAssignmentIds);
                }
            }

            // Deactivate user
            await fetch(`/api/admin/users/${deactivateUser.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: false }),
            });

            setUsers((prev) => prev.map((u) => (u.id === deactivateUser.id ? { ...u, isActive: false } : u)));
            setDeactivateUser(null);
        } catch (err) {
            console.error("Error deactivating user:", err);
        } finally {
            setDeactivateLoading(false);
        }
    };

    const activityLabel = (type: string) => {
        const map: Record<string, string> = {
            CREATED: "Tarea creada",
            STATUS_CHANGED: "Estado cambiado",
            PRIORITY_CHANGED: "Prioridad cambiada",
            ASSIGNED: "Asignación",
            COMMENTED: "Comentario",
        };
        return map[type] || type;
    };

    if (authLoading || loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!canAccess) return null;

    const stats = [
        { label: "Proyectos", value: projectCount, icon: FolderKanban, color: "text-blue-500" },
        { label: "Clientes", value: clientCount, icon: Building2, color: "text-green-500" },
        { label: "Miembros Activos", value: memberCount, icon: Users, color: "text-purple-500" },
        { label: "Horas este Mes", value: hoursThisMonth, icon: Clock, color: "text-orange-500" },
    ];

    const sections = [
        { id: "overview" as const, label: "General" },
        { id: "clients" as const, label: "Clientes" },
        { id: "projects" as const, label: "Proyectos" },
        { id: "members" as const, label: "Miembros" },
        { id: "channels" as const, label: "Canales" },
    ];

    const roleOptions = isSuperAdmin
        ? ["MEMBER", "PM", "ADMIN", "SUPER_ADMIN"]
        : ["MEMBER", "PM"];

    return (
        <div className="flex h-full flex-col gap-6 min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        Panel de Administración
                    </h2>
                    <p className="text-muted-foreground">
                        Vista general del sistema y herramientas de gestión
                    </p>
                </div>
                <Badge className="bg-primary/20 text-primary">
                    {isSuperAdmin ? "SUPER_ADMIN" : "ADMIN"}
                </Badge>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 border-b">
                {sections.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={cn(
                            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                            activeSection === s.id
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* ═══ OVERVIEW ═══ */}
            {activeSection === "overview" && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-8">
                    {/* Stats Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {stats.map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <Card key={stat.label} className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-secondary p-2">
                                            <Icon className={`h-5 w-5 ${stat.color}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                                            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Quick Actions */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-foreground mb-4">Acciones Rápidas</h3>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                            <Button variant="outline" className="justify-start gap-2" onClick={() => openModal("bulk-import")}>
                                <Upload className="h-4 w-4" />
                                Importar CSV
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => openModal("new-member")}>
                                <Users className="h-4 w-4" />
                                Invitar Miembro
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => openModal("new-channel")}>
                                <Hash className="h-4 w-4" />
                                Nuevo Canal
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => openModal("new-project")}>
                                <FolderKanban className="h-4 w-4" />
                                Nuevo Proyecto
                            </Button>
                            <Button variant="outline" className="justify-start gap-2" onClick={() => openModal("new-client")}>
                                <Building2 className="h-4 w-4" />
                                Nuevo Cliente
                            </Button>
                        </div>
                    </Card>

                    {/* Activity */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-foreground mb-4">Actividad Reciente</h3>
                        <div className="space-y-3">
                            {activities.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
                            ) : (
                                activities.map((a) => (
                                    <div key={a.id} className="flex items-start gap-3">
                                        <div className="rounded-full bg-primary/20 p-1 mt-0.5">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-foreground">
                                                <span className="font-medium">{a.user?.name || "Sistema"}</span>{" "}
                                                — {activityLabel(a.type)}
                                                {a.task && (
                                                    <span className="text-muted-foreground">
                                                        {" "}en &ldquo;{a.task.title}&rdquo;
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: es })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* ═══ CLIENTS ═══ */}
            {activeSection === "clients" && (
                <Card className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between p-5 border-b shrink-0">
                        <h3 className="font-semibold text-foreground">Clientes ({spaces.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-client")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Nuevo Cliente
                        </Button>
                    </div>
                    <div className="overflow-y-auto flex-1 pb-8">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">Cliente</TableHead>
                                    <TableHead className="text-center">Proyectos</TableHead>
                                    <TableHead className="text-center">Miembros</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-right pr-5">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {spaces.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="pl-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
                                                <span className={cn("font-medium", s.isArchived && "line-through text-muted-foreground")}>
                                                    {s.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">{s.projectCount}</TableCell>
                                        <TableCell className="text-center">{s.memberCount}</TableCell>
                                        <TableCell className="text-center">
                                            {s.isArchived ? (
                                                <Badge variant="secondary" className="text-xs">Archivado</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs text-green-600 border-green-300">Activo</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-5">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => openModal("edit-client", { clientId: s.id })}
                                                >
                                                    <Edit3 className="h-3 w-3 mr-1" />Editar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    disabled={updatingSpace === s.id}
                                                    onClick={() => handleArchiveSpace(s.id, s.isArchived)}
                                                >
                                                    {updatingSpace === s.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : s.isArchived ? (
                                                        <><ArchiveRestore className="h-3 w-3 mr-1" />Restaurar</>
                                                    ) : (
                                                        <><Archive className="h-3 w-3 mr-1" />Archivar</>
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {spaces.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No hay clientes
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* ═══ PROJECTS ═══ */}
            {activeSection === "projects" && (
                <Card className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between p-5 border-b shrink-0">
                        <h3 className="font-semibold text-foreground">Proyectos ({projects.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-project")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Nuevo Proyecto
                        </Button>
                    </div>
                    <div className="overflow-y-auto flex-1 pb-8">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">Proyecto</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead className="text-center">Tareas</TableHead>
                                    <TableHead>Avance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="pl-5">
                                            <div className="min-w-0">
                                                <span className="font-medium">{p.name}</span>
                                                {p.folderName && (
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <FolderOpen className="h-3 w-3" />
                                                        {p.folderName}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: p.spaceColor }} />
                                                <span className="text-sm">{p.spaceName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {p.doneCount}/{p.taskCount}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full",
                                                            p.progress === 100 ? "bg-emerald-500" : p.progress > 50 ? "bg-blue-500" : "bg-amber-500"
                                                        )}
                                                        style={{ width: `${p.progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-muted-foreground w-8">{p.progress}%</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {projects.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No hay proyectos
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* ═══ MEMBERS ═══ */}
            {activeSection === "members" && (
                <Card className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between p-5 border-b shrink-0">
                        <h3 className="font-semibold text-foreground">Miembros ({users.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-member")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Invitar
                        </Button>
                    </div>
                    <div className="overflow-y-auto flex-1 pb-8">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-5">Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Área</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right pr-5">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u) => {
                                    const isSelf = u.id === user?.id;
                                    const isSA = u.role === "SUPER_ADMIN";
                                    const canModify = isSuperAdmin ? !isSelf : (!isSelf && !isSA && u.role !== 'ADMIN');

                                    return (
                                        <TableRow key={u.id}>
                                            <TableCell className="pl-5 font-medium">{u.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={isSA ? "default" : u.role === "ADMIN" ? "secondary" : "outline"}
                                                    className="text-xs"
                                                >
                                                    {u.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="text-sm text-muted-foreground">
                                                        {u.department ? getGendered(u.department, u.gender || 'MASCULINE') : "—"}
                                                    </p>
                                                    {u.department && (
                                                        <Select value={u.gender || 'MASCULINE'} onValueChange={(val) => handleGenderChange(u.id, val)}>
                                                            <SelectTrigger className="h-6 w-[90px] text-[10px] px-2">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="MASCULINE">Masc.</SelectItem>
                                                                <SelectItem value="FEMININE">Fem.</SelectItem>
                                                                <SelectItem value="NEUTRAL">Neutro</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {u.userAreas && u.userAreas.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {u.userAreas.map((area) => (
                                                            <Badge key={area} variant="secondary" className="text-[10px]">
                                                                {area}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {u.isActive ? (
                                                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">Activo</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs text-red-500 border-red-300">Inactivo</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right pr-5">
                                                <div className="flex items-center justify-end gap-1">
                                                    {canModify && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => openEditUser(u)}
                                                        >
                                                            <Edit3 className="h-3 w-3 mr-1" />
                                                            Editar
                                                        </Button>
                                                    )}
                                                    {canModify && (
                                                        <>
                                                            <Select
                                                                value={u.role}
                                                                onValueChange={(val) => handleRoleChange(u.id, val)}
                                                                disabled={updatingUser === u.id}
                                                            >
                                                                <SelectTrigger className="h-7 w-[100px] text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="MEMBER">Miembro</SelectItem>
                                                                    <SelectItem value="PM">PM</SelectItem>
                                                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            {u.isActive ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 text-xs text-red-500 hover:text-red-600"
                                                                    disabled={updatingUser === u.id}
                                                                    onClick={() => openDeactivateModal(u)}
                                                                >
                                                                    <UserX className="h-3.5 w-3.5 mr-1" />
                                                                    Desactivar
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 text-xs text-green-500 hover:text-green-600"
                                                                    disabled={updatingUser === u.id}
                                                                    onClick={() => handleStatusToggle(u.id, u.isActive)}
                                                                >
                                                                    {updatingUser === u.id ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <><UserCheck className="h-3.5 w-3.5 mr-1" />Activar</>
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    {isSelf && <span className="text-xs text-muted-foreground">(tú)</span>}
                                                    {isSA && !isSelf && <span className="text-xs text-muted-foreground">protegido</span>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* ═══ CHANNELS ═══ */}
            {activeSection === "channels" && (
                <Card className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between p-5 border-b shrink-0">
                        <h3 className="font-semibold text-foreground">Canales ({channels.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-channel")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Nuevo Canal
                        </Button>
                    </div>
                    <div className="overflow-y-auto flex-1 pb-8">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-5">Canal</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right pr-5">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {channels.map((ch) => (
                                <TableRow key={ch.id}>
                                    <TableCell className="pl-5">
                                        <div className="flex items-center gap-2">
                                            <Hash className="h-4 w-4 text-muted-foreground" />
                                            <span className={cn("font-medium", ch.isArchived && "line-through text-muted-foreground")}>
                                                {ch.name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">/{ch.slug}</TableCell>
                                    <TableCell>
                                        {ch.isArchived ? (
                                            <Badge variant="secondary" className="text-xs">Archivado</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">Activo</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right pr-5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            disabled={updatingChannel === ch.id}
                                            onClick={() => handleArchiveChannel(ch.id, ch.isArchived)}
                                        >
                                            {updatingChannel === ch.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : ch.isArchived ? (
                                                <><ArchiveRestore className="h-3 w-3 mr-1" />Restaurar</>
                                            ) : (
                                                <><Archive className="h-3 w-3 mr-1" />Archivar</>
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {channels.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No hay canales
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    </div>
                </Card>
            )}

            {/* ═══ DEACTIVATE MEMBER MODAL ═══ */}
            {deactivateUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => !deactivateLoading && setDeactivateUser(null)} />
                    <div className="relative bg-background rounded-xl shadow-xl border p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Desactivar Miembro
                            </h2>
                            <Button variant="ghost" size="icon" onClick={() => !deactivateLoading && setDeactivateUser(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                            ¿Desactivar a <span className="font-medium text-foreground">{deactivateUser.name}</span>?
                        </p>

                        {deactivateTaskCount > 0 ? (
                            <div className="space-y-3 mb-5">
                                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                                    <p className="text-sm text-amber-800 dark:text-amber-300">
                                        Este miembro tiene <strong>{deactivateTaskCount} tarea{deactivateTaskCount !== 1 ? "s" : ""} activa{deactivateTaskCount !== 1 ? "s" : ""}</strong> asignada{deactivateTaskCount !== 1 ? "s" : ""}.
                                        Selecciona a quién traspasar antes de desactivar.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Traspasar tareas a:</label>
                                    <Select value={deactivateTransferTo} onValueChange={setDeactivateTransferTo}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar miembro..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users
                                                .filter((u) => u.id !== deactivateUser.id && u.isActive)
                                                .map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.name} ({u.role})
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground mb-5">
                                No tiene tareas activas asignadas. Se desactivará directamente.
                            </p>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" disabled={deactivateLoading} onClick={() => setDeactivateUser(null)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={deactivateLoading || (deactivateTaskCount > 0 && !deactivateTransferTo)}
                                onClick={confirmDeactivate}
                            >
                                {deactivateLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <UserX className="h-4 w-4 mr-2" />
                                )}
                                Desactivar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* ═══ EDIT MEMBER MODAL ═══ */}
            {editUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => !savingEdit && setEditUser(null)} />
                    <div className="relative bg-background rounded-xl shadow-xl border p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold">Editar Miembro</h2>
                            <Button variant="ghost" size="icon" onClick={() => !savingEdit && setEditUser(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Nombre</Label>
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Cargo</Label>
                                <Input value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} placeholder="Ej: Director de Arte" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Áreas (separadas por coma)</Label>
                                <Input value={editUserAreas} onChange={(e) => setEditUserAreas(e.target.value)} placeholder="Ej: Diseño, Creatividad" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Género gramatical del cargo</Label>
                                <Select value={editGender} onValueChange={setEditGender}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MASCULINE">Masculino</SelectItem>
                                        <SelectItem value="FEMININE">Femenino</SelectItem>
                                        <SelectItem value="NEUTRAL">Neutro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" disabled={savingEdit} onClick={() => setEditUser(null)}>
                                Cancelar
                            </Button>
                            <Button disabled={savingEdit || !editName.trim()} onClick={handleSaveProfile}>
                                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Guardar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
