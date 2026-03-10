"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
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
            supabase.from("User").select("id, name, email, role, isActive").order("name"),
            supabase.from("Channel").select("id, name, slug, isArchived").order("name"),
            supabase.from("Space").select("id, name, color, isArchived").order("name"),
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
        if (spacesDataRes.data) {
            const spaceIds = spacesDataRes.data.map((s: any) => s.id);

            // Count projects per space
            const { data: listsData } = await supabase
                .from("List")
                .select("id, spaceId")
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
                spacesDataRes.data.map((s: any) => ({
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
                spacesDataRes.data.forEach((s: any) => spaceMap.set(s.id, { name: s.name, color: s.color }));

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
                        const counts = tasksByList.get(l.id) || { total: 0, done: 0 };
                        return {
                            id: l.id,
                            name: l.name || "—",
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
        } catch (err) {
            console.error("Error changing role:", err);
        } finally {
            setUpdatingUser(null);
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
        ? ["MEMBER", "PM", "ADMIN"]
        : ["MEMBER", "PM"];

    return (
        <div className="flex h-full flex-col gap-6 overflow-auto">
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
                <>
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
                </>
            )}

            {/* ═══ CLIENTS ═══ */}
            {activeSection === "clients" && (
                <Card className="p-0 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b">
                        <h3 className="font-semibold text-foreground">Clientes ({spaces.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-client")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Nuevo Cliente
                        </Button>
                    </div>
                    <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
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
                <Card className="p-0 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b">
                        <h3 className="font-semibold text-foreground">Proyectos ({projects.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-project")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Nuevo Proyecto
                        </Button>
                    </div>
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
                                    <TableCell className="pl-5 font-medium">{p.name}</TableCell>
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
                </Card>
            )}

            {/* ═══ MEMBERS ═══ */}
            {activeSection === "members" && (
                <Card className="p-0 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b">
                        <h3 className="font-semibold text-foreground">Miembros ({users.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-member")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Invitar
                        </Button>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-5">Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right pr-5">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((u) => {
                                const isSelf = u.id === user?.id;
                                const isSA = u.role === "SUPER_ADMIN";
                                const canModify = isSuperAdmin && !isSelf && !isSA;

                                return (
                                    <TableRow key={u.id}>
                                        <TableCell className="pl-5 font-medium">{u.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={isSA ? "default" : u.role === "ADMIN" ? "secondary" : "outline"}
                                                className="text-xs"
                                            >
                                                {u.role}
                                            </Badge>
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
                                                    <>
                                                        {roleOptions
                                                            .filter((r) => r !== u.role)
                                                            .slice(0, 1)
                                                            .map((nextRole) => (
                                                                <Button
                                                                    key={nextRole}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 text-xs"
                                                                    disabled={updatingUser === u.id}
                                                                    onClick={() => handleRoleChange(u.id, nextRole)}
                                                                >
                                                                    {updatingUser === u.id ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        `→ ${nextRole}`
                                                                    )}
                                                                </Button>
                                                            ))}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={cn(
                                                                "h-7 text-xs",
                                                                u.isActive ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600"
                                                            )}
                                                            disabled={updatingUser === u.id}
                                                            onClick={() => handleStatusToggle(u.id, u.isActive)}
                                                        >
                                                            {updatingUser === u.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : u.isActive ? (
                                                                <UserX className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <UserCheck className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
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
                </Card>
            )}

            {/* ═══ CHANNELS ═══ */}
            {activeSection === "channels" && (
                <Card className="p-0 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b">
                        <h3 className="font-semibold text-foreground">Canales ({channels.length})</h3>
                        <Button size="sm" onClick={() => openModal("new-channel")}>
                            <Plus className="h-4 w-4 mr-1" />
                            Nuevo Canal
                        </Button>
                    </div>
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
                </Card>
            )}
        </div>
    );
}
