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
} from "lucide-react";

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

export default function AdminPage() {
    const { user, isSuperAdmin, loading: authLoading } = useAuth();
    const { openModal } = useAppStore();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [projectCount, setProjectCount] = useState(0);
    const [clientCount, setClientCount] = useState(0);
    const [memberCount, setMemberCount] = useState(0);
    const [hoursThisMonth, setHoursThisMonth] = useState(0);
    const [activities, setActivities] = useState<ActivityRow[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [channels, setChannels] = useState<ChannelRow[]>([]);
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);
    const [updatingChannel, setUpdatingChannel] = useState<string | null>(null);

    // Redirect non-SUPER_ADMIN
    useEffect(() => {
        if (!authLoading && (!user || !isSuperAdmin)) {
            router.replace("/dashboard");
        }
    }, [authLoading, user, isSuperAdmin, router]);

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
        ] = await Promise.all([
            supabase.from("List").select("id", { count: "exact", head: true }),
            supabase.from("Space").select("id", { count: "exact", head: true }),
            supabase
                .from("User")
                .select("id", { count: "exact", head: true })
                .eq("isActive", true),
            supabase
                .from("TimeEntry")
                .select("hours")
                .gte("date", monthStart),
            supabase
                .from("Activity")
                .select(
                    "id, type, field, oldValue, newValue, createdAt, user:User(name), task:Task(title)"
                )
                .order("createdAt", { ascending: false })
                .limit(5),
            supabase
                .from("User")
                .select("id, name, email, role, isActive")
                .order("name"),
            supabase
                .from("Channel")
                .select("id, name, slug, isArchived")
                .order("name"),
        ]);

        setProjectCount(projectsRes.count ?? 0);
        setClientCount(spacesRes.count ?? 0);
        setMemberCount(membersRes.count ?? 0);

        if (hoursRes.data) {
            const total = hoursRes.data.reduce(
                (sum: number, e: { hours: number }) => sum + (e.hours || 0),
                0
            );
            setHoursThisMonth(Math.round(total * 10) / 10);
        }

        if (activityRes.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        setLoading(false);
    }, []);

    useEffect(() => {
        if (isSuperAdmin) fetchData();
    }, [isSuperAdmin, fetchData]);

    // Listen for channel refresh
    useEffect(() => {
        const handler = () => fetchData();
        window.addEventListener("dcflow:channels-refresh", handler);
        return () =>
            window.removeEventListener("dcflow:channels-refresh", handler);
    }, [fetchData]);

    const handleRoleChange = async (userId: string, newRole: string) => {
        setUpdatingUser(userId);
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === userId ? { ...u, role: newRole } : u
                )
            );
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
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === userId ? { ...u, isActive: !currentActive } : u
                )
            );
        } catch (err) {
            console.error("Error toggling status:", err);
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleArchiveToggle = async (
        channelId: string,
        currentArchived: boolean
    ) => {
        setUpdatingChannel(channelId);
        try {
            const res = await fetch(
                `/api/admin/channels/${channelId}/archive`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isArchived: !currentArchived }),
                }
            );
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }
            setChannels((prev) =>
                prev.map((c) =>
                    c.id === channelId
                        ? { ...c, isArchived: !currentArchived }
                        : c
                )
            );
            window.dispatchEvent(new CustomEvent("dcflow:channels-refresh"));
        } catch (err) {
            console.error("Error toggling archive:", err);
        } finally {
            setUpdatingChannel(null);
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

    if (!isSuperAdmin) return null;

    const stats = [
        {
            label: "Proyectos",
            value: projectCount,
            icon: FolderKanban,
            color: "text-blue-500",
        },
        {
            label: "Clientes (Spaces)",
            value: clientCount,
            icon: Building2,
            color: "text-green-500",
        },
        {
            label: "Miembros Activos",
            value: memberCount,
            icon: Users,
            color: "text-purple-500",
        },
        {
            label: "Horas este Mes",
            value: hoursThisMonth,
            icon: Clock,
            color: "text-orange-500",
        },
    ];

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
                    SUPER_ADMIN
                </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-secondary p-2">
                                    <Icon
                                        className={`h-5 w-5 ${stat.color}`}
                                    />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        {stat.label}
                                    </p>
                                    <p className="text-2xl font-bold text-foreground">
                                        {stat.value}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4">
                    Acciones Rápidas
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <Button
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => openModal("bulk-import")}
                    >
                        <Upload className="h-4 w-4" />
                        Importar CSV
                    </Button>
                    <Button
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => openModal("new-member")}
                    >
                        <Users className="h-4 w-4" />
                        Invitar Miembro
                    </Button>
                    <Button
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => openModal("new-channel")}
                    >
                        <Hash className="h-4 w-4" />
                        Nuevo Canal
                    </Button>
                    <Button
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => openModal("new-project")}
                    >
                        <FolderKanban className="h-4 w-4" />
                        Nuevo Proyecto
                    </Button>
                </div>
            </Card>

            {/* Activity + Members */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Activity */}
                <Card className="p-6">
                    <h3 className="font-semibold text-foreground mb-4">
                        Actividad Reciente
                    </h3>
                    <div className="space-y-3">
                        {activities.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Sin actividad reciente
                            </p>
                        ) : (
                            activities.map((a) => (
                                <div
                                    key={a.id}
                                    className="flex items-start gap-3"
                                >
                                    <div className="rounded-full bg-primary/20 p-1 mt-0.5">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground">
                                            <span className="font-medium">
                                                {a.user?.name || "Sistema"}
                                            </span>{" "}
                                            — {activityLabel(a.type)}
                                            {a.task && (
                                                <span className="text-muted-foreground">
                                                    {" "}
                                                    en &ldquo;{a.task.title}
                                                    &rdquo;
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(
                                                new Date(a.createdAt),
                                                { addSuffix: true, locale: es }
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Channels */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">
                            Canales
                        </h3>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openModal("new-channel")}
                        >
                            <Hash className="h-3.5 w-3.5 mr-1" />
                            Nuevo
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {channels.map((ch) => (
                            <div
                                key={ch.id}
                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span
                                        className={`text-sm truncate ${ch.isArchived ? "text-muted-foreground line-through" : "text-foreground"}`}
                                    >
                                        {ch.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        /{ch.slug}
                                    </span>
                                    {ch.isArchived && (
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] h-5"
                                        >
                                            Archivado
                                        </Badge>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={updatingChannel === ch.id}
                                    onClick={() =>
                                        handleArchiveToggle(
                                            ch.id,
                                            ch.isArchived
                                        )
                                    }
                                >
                                    {updatingChannel === ch.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : ch.isArchived ? (
                                        <>
                                            <ArchiveRestore className="h-3 w-3 mr-1" />
                                            Restaurar
                                        </>
                                    ) : (
                                        <>
                                            <Archive className="h-3 w-3 mr-1" />
                                            Archivar
                                        </>
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Members Management */}
            <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4">
                    Gestión de Miembros
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-muted-foreground">
                                <th className="pb-3 font-medium">Nombre</th>
                                <th className="pb-3 font-medium">Email</th>
                                <th className="pb-3 font-medium">Rol</th>
                                <th className="pb-3 font-medium">Estado</th>
                                <th className="pb-3 font-medium text-right">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => {
                                const isSelf = u.id === user?.id;
                                const isSA = u.role === "SUPER_ADMIN";
                                return (
                                    <tr
                                        key={u.id}
                                        className="border-b border-border/50 last:border-0"
                                    >
                                        <td className="py-3 font-medium">
                                            {u.name}
                                        </td>
                                        <td className="py-3 text-muted-foreground">
                                            {u.email}
                                        </td>
                                        <td className="py-3">
                                            <Badge
                                                variant={
                                                    isSA
                                                        ? "default"
                                                        : u.role === "ADMIN"
                                                          ? "secondary"
                                                          : "outline"
                                                }
                                                className="text-xs"
                                            >
                                                {u.role}
                                            </Badge>
                                        </td>
                                        <td className="py-3">
                                            {u.isActive ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs text-green-600 border-green-300"
                                                >
                                                    Activo
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs text-red-500 border-red-300"
                                                >
                                                    Inactivo
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {!isSelf && !isSA && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={
                                                                updatingUser ===
                                                                u.id
                                                            }
                                                            onClick={() =>
                                                                handleRoleChange(
                                                                    u.id,
                                                                    u.role ===
                                                                        "ADMIN"
                                                                        ? "MEMBER"
                                                                        : "ADMIN"
                                                                )
                                                            }
                                                        >
                                                            {updatingUser ===
                                                            u.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : u.role ===
                                                              "ADMIN" ? (
                                                                "→ MEMBER"
                                                            ) : (
                                                                "→ ADMIN"
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={`h-7 text-xs ${u.isActive ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600"}`}
                                                            disabled={
                                                                updatingUser ===
                                                                u.id
                                                            }
                                                            onClick={() =>
                                                                handleStatusToggle(
                                                                    u.id,
                                                                    u.isActive
                                                                )
                                                            }
                                                        >
                                                            {updatingUser ===
                                                            u.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : u.isActive ? (
                                                                <UserX className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <UserCheck className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                    </>
                                                )}
                                                {isSelf && (
                                                    <span className="text-xs text-muted-foreground">
                                                        (tú)
                                                    </span>
                                                )}
                                                {isSA && !isSelf && (
                                                    <span className="text-xs text-muted-foreground">
                                                        protegido
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
