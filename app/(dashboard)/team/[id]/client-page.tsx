"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { AREAS } from "@/lib/areas";
import { useToast } from "@/components/ui/toast";
import {
  ChevronRight,
  Mail,
  Clock,
  Briefcase,
  User,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: string;
  weeklyCapacity: number;
  isActive: boolean;
  avatarUrl?: string;
  department?: string;
  userAreas?: string[];
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedHours?: number;
  project?: {
    id: string;
    name: string;
    color?: string;
  };
}

interface TimeEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
}

const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-primary",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-rose-500",
  "bg-blue-500",
  "bg-orange-500",
];

function getAvatarColor(id: string) {
  // Generate consistent color from UUID
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TeamMemberDetailPage() {
  const params = useParams();
  const rawId = params.id as string;
  // Get actual id from URL path if params return placeholder
  const id = rawId === '_' ? (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '') : rawId;
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [member, setMember] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hoursThisWeek, setHoursThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAreas, setSavingAreas] = useState(false);

  const isSuperAdmin = currentUser?.supabaseRole === 'SUPER_ADMIN';
  const isAdminUser = isSuperAdmin || currentUser?.role === 'admin';
  const [savingRole, setSavingRole] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    if (!member) return;
    const prevRole = member.role;
    setMember((prev) => prev ? { ...prev, role: newRole } : prev);
    setSavingRole(true);
    try {
      const res = await fetch(`/api/team/${member.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      addToast({ title: 'Rol actualizado correctamente', type: 'success' });
    } catch {
      addToast({ title: 'Error al cambiar el rol', type: 'error' });
      setMember((prev) => prev ? { ...prev, role: prevRole } : prev);
    } finally {
      setSavingRole(false);
    }
  };

  const handleAreaToggle = async (area: string) => {
    if (!member) return;
    const current = member.userAreas || [];
    const next = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    setSavingAreas(true);
    setMember((prev) => prev ? { ...prev, userAreas: next } : prev);
    const res = await fetch(`/api/team/${member.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAreas: next }),
    });
    setSavingAreas(false);
    if (!res.ok) {
      addToast({ title: 'Error al guardar áreas', type: 'error' });
      setMember((prev) => prev ? { ...prev, userAreas: current } : prev);
    } else {
      addToast({ title: 'Áreas de edición actualizadas', type: 'success' });
    }
  };

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      const supabase = createClient();

      try {
        // Fetch user profile
        const { data: userData, error: userError } = await supabase
          .from("User")
          .select("*")
          .eq("id", id)
          .single();

        if (userError) {
          console.error("Error fetching user:", userError);
          setError("Usuario no encontrado");
          setLoading(false);
          return;
        }

        setMember({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          userType: userData.userType,
          weeklyCapacity: userData.weeklyCapacity || 40,
          isActive: userData.isActive,
          avatarUrl: userData.avatarUrl,
          department: userData.department,
          userAreas: userData.userAreas || [],
        });

        // Fetch assigned tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from("Task")
          .select(`
            id,
            title,
            status,
            priority,
            dueDate,
            estimatedHours,
            project:Project(id, name, color)
          `)
          .eq("assigneeId", id)
          .order("dueDate", { ascending: true });

        if (!tasksError && tasksData) {
          setTasks(tasksData.map((t: any) => ({
            ...t,
            project: Array.isArray(t.project) ? t.project[0] ?? null : t.project ?? null,
          })) as Task[]);
        }

        // Fetch time entries for this week
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const { data: timeData, error: timeError } = await supabase
          .from("TimeEntry")
          .select("duration")
          .eq("userId", id)
          .gte("startTime", startOfWeek.toISOString())
          .lte("startTime", endOfWeek.toISOString())
          .not("endTime", "is", null);

        if (!timeError && timeData) {
          // Calculate total hours (duration is in seconds)
          const totalSeconds = timeData.reduce((acc, entry) => acc + (entry.duration || 0), 0);
          setHoursThisWeek(Math.round(totalSeconds / 3600));
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Error al cargar los datos");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => { /* cleanup handled by last-resort timer */ };
  }, [id, refreshKey]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <User className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">{error || "Usuario no encontrado"}</p>
        <Link href="/team">
          <Button variant="outline">Volver al equipo</Button>
        </Link>
      </div>
    );
  }

  const utilization = member.weeklyCapacity > 0
    ? Math.round((hoursThisWeek / member.weeklyCapacity) * 100)
    : 0;

  const activeTasks = tasks.filter((t) => t.status !== "DONE" && t.status !== "done");
  const uniqueProjects = [...new Set(tasks.map((t) => t.project?.id).filter(Boolean))];

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/team" className="hover:text-foreground transition-colors">
          Equipo
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{member.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className={`h-16 w-16 ${getAvatarColor(member.id)}`}>
            <AvatarFallback className="text-2xl font-semibold text-white">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                {member.name}
              </h1>
              <Badge
                variant={member.isActive ? "success" : "secondary"}
                className="capitalize"
              >
                {member.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p className="text-muted-foreground capitalize">{{ SUPER_ADMIN: "Super Admin", ADMIN: "Administrador", MEMBER: "Miembro" }[member.role] ?? member.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <a href={`mailto:${member.email}`}>
              <Mail className="h-4 w-4" />
              Mensaje
            </a>
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-4">
              Carga de Trabajo Actual
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Horas Esta Semana</span>
                <span className="font-semibold text-foreground">
                  {hoursThisWeek}h / {member.weeklyCapacity}h
                </span>
              </div>
              <Progress
                value={Math.min(utilization, 100)}
                className="h-3"
                indicatorClassName={
                  utilization > 100
                    ? "bg-studio-error"
                    : utilization > 80
                    ? "bg-studio-warning"
                    : "bg-studio-success"
                }
              />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-foreground">
                    {activeTasks.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Tareas Activas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-foreground">
                    {uniqueProjects.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Proyectos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-foreground">
                    {utilization}%
                  </p>
                  <p className="text-sm text-muted-foreground">Utilización</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-4">
              Tareas Asignadas
            </h3>
            <div className="space-y-3">
              {activeTasks.length > 0 ? (
                activeTasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-medium"
                        style={{ backgroundColor: task.project?.color || "#6366f1" }}
                      >
                        {task.project?.name?.charAt(0) || "T"}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {task.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {task.project?.name || "Sin proyecto"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        task.priority === "URGENT" || task.priority === "urgent"
                          ? "error"
                          : task.priority === "HIGH" || task.priority === "high"
                          ? "warning"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {task.priority?.toLowerCase() || "normal"}
                    </Badge>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No hay tareas activas
                </div>
              )}
              {activeTasks.length > 5 && (
                <p className="text-center text-sm text-muted-foreground">
                  +{activeTasks.length - 5} tareas más
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-4">Información</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{member.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  {member.weeklyCapacity}h capacidad/semana
                </span>
              </div>
            </div>
          </Card>

          {/* Áreas de edición */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Áreas de edición</h3>
              {savingAreas && (
                <span className="text-xs text-muted-foreground">Guardando…</span>
              )}
            </div>
            {isAdminUser ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Selecciona en qué áreas puede editar este usuario. Sin áreas = solo lectura en espacios con área asignada.
                </p>
                {AREAS.map((area) => {
                  const checked = (member.userAreas || []).includes(area);
                  return (
                    <label
                      key={area}
                      className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={checked}
                        disabled={savingAreas}
                        onChange={() => handleAreaToggle(area)}
                      />
                      <span className="text-sm">{area}</span>
                      {area === 'Cuentas' && (
                        <span className="text-xs text-muted-foreground ml-1">(acceso cruzado)</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(member.userAreas || []).length > 0 ? (
                  (member.userAreas || []).map((a) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Sin áreas asignadas</span>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Rol y Tipo</h3>
              {savingRole && (
                <span className="text-xs text-muted-foreground">Guardando…</span>
              )}
            </div>
            {isSuperAdmin ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Rol de aplicación</label>
                  <select
                    className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                    value={member.role}
                    disabled={savingRole}
                    onChange={(e) => handleRoleChange(e.target.value)}
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="MEMBER">Miembro</option>
                  </select>
                </div>
                <Badge variant="outline" className="capitalize">
                  {{ MEMBER: "Miembro", EMPLOYEE: "Empleado", FREELANCE: "Freelance", CLIENT: "Cliente", ADMIN: "Administrador", SUPER_ADMIN: "Super Admin" }[member.userType?.toUpperCase()] ?? member.userType}
                </Badge>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="capitalize">
                  {{ SUPER_ADMIN: "Super Admin", ADMIN: "Administrador", MEMBER: "Miembro" }[member.role] ?? member.role}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {{ MEMBER: "Miembro", EMPLOYEE: "Empleado", FREELANCE: "Freelance", CLIENT: "Cliente", ADMIN: "Administrador", SUPER_ADMIN: "Super Admin" }[member.userType?.toUpperCase()] ?? member.userType}
                </Badge>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
