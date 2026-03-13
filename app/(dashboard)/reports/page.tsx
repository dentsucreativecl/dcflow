"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clock, FolderCheck, Users,
  Download, BarChart3, Loader2, ListChecks,
  Filter, ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

// ─── Types ───────────────────────────────────────────────────────────

type ReportTab = "overview" | "projects" | "team" | "time";
type PeriodType = "week" | "month" | "quarter" | "year";

interface TimeEntryRow {
  id: string;
  hours: number;
  date: string;
  description: string | null;
  userId: string;
  taskId: string;
}

interface TaskRow {
  id: string;
  listId: string;
  statusType: string;
  title: string;
}

interface MemberRow {
  id: string;
  name: string;
  weeklyCapacity: number;
}

interface ListRow {
  id: string;
  name: string;
  spaceName: string;
  spaceId: string;
  spaceColor: string;
}

interface SpaceOption {
  id: string;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getPeriodRange(period: PeriodType, now: Date): { start: Date; end: Date } {
  switch (period) {
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
  }
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const MONTHLY_CAPACITY = 160;

// ─── StatCard ────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, subtitle }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="mt-3">
        <span className="text-3xl font-semibold text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user: authUser, isAdmin, isSuperAdmin } = useAuth();
  const isFullAccess = isAdmin || isSuperAdmin;
  const currentUserId = authUser?.id;

  // Tab & filter state
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [period, setPeriod] = useState<PeriodType>("month");
  const [filterSpaceId, setFilterSpaceId] = useState<string>("all");
  const [filterListId, setFilterListId] = useState<string>("all");
  const [filterMemberId, setFilterMemberId] = useState<string>("all");

  // Raw data
  const [loading, setLoading] = useState(true);
  // Last-resort: never stay stuck in loading state (catches any edge case missed above)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  // For time tab: enriched entries
  const [timeEntriesEnriched, setTimeEntriesEnriched] = useState<Array<TimeEntryRow & { taskTitle: string; listName: string; spaceName: string; userName: string }>>([]);

  // ─── Fetch all data once ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!currentUserId) { setLoading(false); return; }
    setLoading(true);
    const supabase = createClient();
    try {

    // 1. Determine member's assigned task IDs (for MEMBER role)
    let memberTaskIds: string[] | null = null;
    let memberListIds: string[] | null = null;
    if (!isFullAccess) {
      const { data: myAssignments } = await supabase
        .from("TaskAssignment")
        .select("taskId, Task:taskId(listId)")
        .eq("userId", currentUserId);
      memberTaskIds = (myAssignments || []).map((a: any) => a.taskId);
      const listIdSet = new Set<string>();
      (myAssignments || []).forEach((a: any) => {
        const task = Array.isArray(a.Task) ? a.Task[0] : a.Task;
        if (task?.listId) listIdSet.add(task.listId);
      });
      memberListIds = Array.from(listIdSet);
    }

    // 2. Fetch time entries (all time, we filter by period client-side)
    let teQuery = supabase.from("TimeEntry").select("id, hours, date, description, userId, taskId");
    if (!isFullAccess) {
      teQuery = teQuery.eq("userId", currentUserId);
    }
    const { data: teData } = await teQuery;
    setTimeEntries((teData || []) as TimeEntryRow[]);

    // 3. Fetch tasks with status
    let taskQuery = supabase
      .from("Task")
      .select("id, title, listId, Status:statusId(type)")
      .is("parentId", null);
    if (!isFullAccess && memberTaskIds) {
      if (memberTaskIds.length > 0) {
        taskQuery = taskQuery.in("id", memberTaskIds);
      } else {
        taskQuery = taskQuery.eq("id", "___none___");
      }
    }
    const { data: taskData } = await taskQuery;
    const parsedTasks: TaskRow[] = (taskData || []).map((t: any) => {
      const status = Array.isArray(t.Status) ? t.Status[0] : t.Status;
      return { id: t.id, listId: t.listId, statusType: status?.type || "TODO", title: t.title };
    });
    setTasks(parsedTasks);

    // 4. Fetch members
    let membersQuery = supabase
      .from("User")
      .select("id, name, weeklyCapacity")
      .eq("userType", "MEMBER")
      .eq("isActive", true);
    if (!isFullAccess) {
      membersQuery = membersQuery.eq("id", currentUserId);
    }
    const { data: membersData } = await membersQuery;
    setMembers((membersData || []) as MemberRow[]);

    // 5. Fetch lists with spaces
    let listsQuery = supabase.from("List").select("id, name, spaceId, Space:spaceId(id, name, color)");
    if (!isFullAccess && memberListIds) {
      if (memberListIds.length > 0) {
        listsQuery = listsQuery.in("id", memberListIds);
      } else {
        listsQuery = listsQuery.eq("id", "___none___");
      }
    }
    const { data: listsData } = await listsQuery;
    const parsedLists: ListRow[] = (listsData || []).map((l: any) => {
      const space = Array.isArray(l.Space) ? l.Space[0] : l.Space;
      return {
        id: l.id,
        name: l.name,
        spaceId: l.spaceId,
        spaceName: space?.name || "General",
        spaceColor: space?.color || "#666",
      };
    });
    setLists(parsedLists);

    // 6. Unique spaces for filter
    const spaceMap = new Map<string, string>();
    parsedLists.forEach((l) => spaceMap.set(l.spaceId, l.spaceName));
    setSpaces(Array.from(spaceMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));

    // 7. Build enriched time entries for time tab
    const taskMap = new Map<string, TaskRow>();
    parsedTasks.forEach((t) => taskMap.set(t.id, t));
    const listMap = new Map<string, ListRow>();
    parsedLists.forEach((l) => listMap.set(l.id, l));
    const memberMap = new Map<string, string>();
    (membersData || []).forEach((m: any) => memberMap.set(m.id, m.name));

    // If admin, we may need all user names for time entries
    if (isFullAccess) {
      const userIds = new Set((teData || []).map((te: any) => te.userId));
      const missing = Array.from(userIds).filter((id) => !memberMap.has(id));
      if (missing.length > 0) {
        const { data: extraUsers } = await supabase.from("User").select("id, name").in("id", missing);
        (extraUsers || []).forEach((u: any) => memberMap.set(u.id, u.name));
      }
    }

    const enriched = (teData || []).map((te: any) => {
      const task = taskMap.get(te.taskId);
      const list = task ? listMap.get(task.listId) : null;
      return {
        ...te,
        taskTitle: task?.title || "Tarea eliminada",
        listName: list?.name || "—",
        spaceName: list?.spaceName || "—",
        userName: memberMap.get(te.userId) || "Usuario",
      };
    });
    setTimeEntriesEnriched(enriched);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [currentUserId, isFullAccess]);

  useEffect(() => {
    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);
    fetchData().finally(() => {
      clearTimeout(safetyTimer);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, [fetchData]);

  useEffect(() => {
    const handler = () => { fetchData(); };
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, [fetchData]);

  // ─── Period-filtered data ─────────────────────────────────────────
  const { start: periodStart, end: periodEnd } = useMemo(() => getPeriodRange(period, new Date()), [period]);

  const filteredTimeEntries = useMemo(() => {
    return timeEntries.filter((te) => {
      const d = new Date(te.date);
      if (d < periodStart || d > periodEnd) return false;
      if (filterMemberId !== "all" && te.userId !== filterMemberId) return false;
      return true;
    });
  }, [timeEntries, periodStart, periodEnd, filterMemberId]);

  // Apply space/list filters to tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterListId !== "all" && t.listId !== filterListId) return false;
      if (filterSpaceId !== "all") {
        const list = lists.find((l) => l.id === t.listId);
        if (!list || list.spaceId !== filterSpaceId) return false;
      }
      return true;
    });
  }, [tasks, filterListId, filterSpaceId, lists]);

  // Filter time entries further by space/list
  const filteredTimeEntriesFull = useMemo(() => {
    if (filterSpaceId === "all" && filterListId === "all") return filteredTimeEntries;
    const taskIdsInScope = new Set(filteredTasks.map((t) => t.id));
    return filteredTimeEntries.filter((te) => taskIdsInScope.has(te.taskId));
  }, [filteredTimeEntries, filteredTasks, filterSpaceId, filterListId]);

  // Lists filtered by space
  const filteredLists = useMemo(() => {
    if (filterSpaceId === "all") return lists;
    return lists.filter((l) => l.spaceId === filterSpaceId);
  }, [lists, filterSpaceId]);

  // ─── Computed stats ───────────────────────────────────────────────
  const totalHours = useMemo(() =>
    Math.round(filteredTimeEntriesFull.reduce((s, te) => s + te.hours, 0) * 10) / 10
  , [filteredTimeEntriesFull]);

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.statusType === "DONE").length;
  const activeMembers = members.length;
  const totalCapacity = activeMembers * MONTHLY_CAPACITY;

  // ─── Tab: Overview ────────────────────────────────────────────────
  const hoursByProject = useMemo(() => {
    const map = new Map<string, number>();
    filteredTimeEntriesFull.forEach((te) => {
      const task = tasks.find((t) => t.id === te.taskId);
      if (!task) return;
      map.set(task.listId, (map.get(task.listId) || 0) + te.hours);
    });
    return Array.from(map.entries())
      .map(([listId, hours]) => {
        const list = lists.find((l) => l.id === listId);
        return { listId, name: list?.name || "—", hours: Math.round(hours * 10) / 10 };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [filteredTimeEntriesFull, tasks, lists]);

  const hoursByClient = useMemo(() => {
    const map = new Map<string, { name: string; color: string; hours: number }>();
    filteredTimeEntriesFull.forEach((te) => {
      const task = tasks.find((t) => t.id === te.taskId);
      if (!task) return;
      const list = lists.find((l) => l.id === task.listId);
      if (!list) return;
      const existing = map.get(list.spaceId) || { name: list.spaceName, color: list.spaceColor, hours: 0 };
      existing.hours += te.hours;
      map.set(list.spaceId, existing);
    });
    return Array.from(map.values())
      .map((v) => ({ ...v, hours: Math.round(v.hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [filteredTimeEntriesFull, tasks, lists]);

  // ─── Tab: Projects ────────────────────────────────────────────────
  const projectRows = useMemo(() => {
    const tasksByList = new Map<string, { total: number; done: number }>();
    filteredTasks.forEach((t) => {
      const entry = tasksByList.get(t.listId) || { total: 0, done: 0 };
      entry.total++;
      if (t.statusType === "DONE") entry.done++;
      tasksByList.set(t.listId, entry);
    });

    const hoursByList = new Map<string, number>();
    filteredTimeEntriesFull.forEach((te) => {
      const task = tasks.find((t) => t.id === te.taskId);
      if (task) hoursByList.set(task.listId, (hoursByList.get(task.listId) || 0) + te.hours);
    });

    return Array.from(tasksByList.entries())
      .map(([listId, counts]) => {
        const list = lists.find((l) => l.id === listId);
        if (!list) return null;
        return {
          id: listId,
          name: list.name,
          spaceName: list.spaceName,
          spaceColor: list.spaceColor,
          totalTasks: counts.total,
          doneTasks: counts.done,
          progress: counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0,
          hours: Math.round((hoursByList.get(listId) || 0) * 10) / 10,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.totalTasks - a!.totalTasks) as Array<{
        id: string; name: string; spaceName: string; spaceColor: string;
        totalTasks: number; doneTasks: number; progress: number; hours: number;
      }>;
  }, [filteredTasks, filteredTimeEntriesFull, tasks, lists]);

  // ─── Tab: Team ────────────────────────────────────────────────────
  const teamRows = useMemo(() => {
    const hoursByUser = new Map<string, number>();
    filteredTimeEntriesFull.forEach((te) => {
      hoursByUser.set(te.userId, (hoursByUser.get(te.userId) || 0) + te.hours);
    });

    // Count completed tasks per user in period (using task assignments)
    const completedByUser = new Map<string, number>();
    // We approximate: tasks marked DONE that the user has assignments on
    // For simplicity, count tasks where user has time entries and task is done
    const doneTaskIds = new Set(filteredTasks.filter((t) => t.statusType === "DONE").map((t) => t.id));
    filteredTimeEntriesFull.forEach((te) => {
      if (doneTaskIds.has(te.taskId)) {
        completedByUser.set(te.userId, (completedByUser.get(te.userId) || 0));
      }
    });
    // More accurate: count unique done tasks per user
    const doneTasksByUser = new Map<string, Set<string>>();
    filteredTimeEntriesFull.forEach((te) => {
      if (doneTaskIds.has(te.taskId)) {
        if (!doneTasksByUser.has(te.userId)) doneTasksByUser.set(te.userId, new Set());
        doneTasksByUser.get(te.userId)!.add(te.taskId);
      }
    });

    return members
      .map((m) => {
        const hours = Math.round((hoursByUser.get(m.id) || 0) * 10) / 10;
        const utilization = Math.round((hours / MONTHLY_CAPACITY) * 100);
        return {
          id: m.id,
          name: m.name,
          hours,
          capacity: MONTHLY_CAPACITY,
          utilization,
          tasksCompleted: doneTasksByUser.get(m.id)?.size || 0,
        };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [filteredTimeEntriesFull, filteredTasks, members]);

  // ─── Tab: Time (enriched, filtered) ───────────────────────────────
  const timeRows = useMemo(() => {
    return timeEntriesEnriched
      .filter((te) => {
        const d = new Date(te.date);
        if (d < periodStart || d > periodEnd) return false;
        if (filterMemberId !== "all" && te.userId !== filterMemberId) return false;
        if (filterListId !== "all") {
          const task = tasks.find((t) => t.id === te.taskId);
          if (!task || task.listId !== filterListId) return false;
        }
        if (filterSpaceId !== "all") {
          const task = tasks.find((t) => t.id === te.taskId);
          if (!task) return false;
          const list = lists.find((l) => l.id === task.listId);
          if (!list || list.spaceId !== filterSpaceId) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [timeEntriesEnriched, periodStart, periodEnd, filterMemberId, filterListId, filterSpaceId, tasks, lists]);

  const timeRowsTotalHours = useMemo(() =>
    Math.round(timeRows.reduce((s, r) => s + r.hours, 0) * 10) / 10
  , [timeRows]);

  // ─── Export ───────────────────────────────────────────────────────
  const handleExport = () => {
    const periodLabel = `${format(periodStart, "yyyy-MM-dd")}_${format(periodEnd, "yyyy-MM-dd")}`;
    let csvContent = "";

    if (activeTab === "time") {
      csvContent = "Fecha,Tarea,Proyecto,Cliente,Horas,Descripción" + (isFullAccess ? ",Miembro" : "") + "\n";
      timeRows.forEach((r) => {
        const line = [
          format(new Date(r.date), "yyyy-MM-dd"),
          `"${r.taskTitle}"`,
          `"${r.listName}"`,
          `"${r.spaceName}"`,
          r.hours,
          `"${r.description || ""}"`,
          ...(isFullAccess ? [`"${r.userName}"`] : []),
        ].join(",");
        csvContent += line + "\n";
      });
    } else if (activeTab === "projects") {
      csvContent = "Proyecto,Cliente,Tareas Totales,Completadas,Avance %,Horas\n";
      projectRows.forEach((r) => {
        csvContent += `"${r.name}","${r.spaceName}",${r.totalTasks},${r.doneTasks},${r.progress},${r.hours}\n`;
      });
    } else if (activeTab === "team") {
      csvContent = "Miembro,Horas,Capacidad,Utilización %,Tareas Completadas\n";
      teamRows.forEach((r) => {
        csvContent += `"${r.name}",${r.hours},${r.capacity},${r.utilization},${r.tasksCompleted}\n`;
      });
    } else {
      csvContent = "Métrica,Valor\n";
      csvContent += `Horas Registradas,${totalHours}\nTareas Totales,${totalTasks}\nTareas Completadas,${completedTasks}\nMiembros Activos,${activeMembers}\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${activeTab}-${periodLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Tab definitions ──────────────────────────────────────────────
  const tabs: { id: ReportTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Resumen", icon: BarChart3 },
    { id: "projects", label: "Proyectos", icon: FolderCheck },
    ...(isFullAccess ? [{ id: "team" as ReportTab, label: "Equipo", icon: Users }] : []),
    { id: "time", label: "Tiempo", icon: Clock },
  ];

  const periodLabels: Record<PeriodType, string> = {
    week: "Esta semana",
    month: "Este mes",
    quarter: "Este trimestre",
    year: "Este año",
  };

  // ─── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            {format(periodStart, "d MMM", { locale: es })} – {format(periodEnd, "d MMM yyyy", { locale: es })}
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Global Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
        </div>

        {/* Period */}
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(periodLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Client (Space) — only admin */}
        {isFullAccess && (
          <Select value={filterSpaceId} onValueChange={(v) => { setFilterSpaceId(v); setFilterListId("all"); }}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Project (List) */}
        <Select value={filterListId} onValueChange={(v) => setFilterListId(v)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {filteredLists.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Member — only admin */}
        {isFullAccess && (
          <Select value={filterMemberId} onValueChange={(v) => setFilterMemberId(v)}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="Todos los miembros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los miembros</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Overview                                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Horas Registradas"
              value={totalHours}
              icon={Clock}
              subtitle={totalCapacity > 0 ? `de ${totalCapacity}h de capacidad` : undefined}
            />
            <StatCard title="Total Tareas" value={totalTasks} icon={ListChecks} />
            <StatCard
              title="Completadas"
              value={completedTasks}
              icon={FolderCheck}
              subtitle={totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}% del total` : undefined}
            />
            <StatCard title="Miembros Activos" value={activeMembers} icon={Users} />
          </div>

          {/* Capacity bar */}
          {totalCapacity > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">Capacidad del Equipo</h3>
                <span className="text-sm text-muted-foreground">
                  {Math.round((totalHours / totalCapacity) * 100)}% utilizada
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    totalHours > totalCapacity ? "bg-red-500" : totalHours > totalCapacity * 0.8 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min((totalHours / totalCapacity) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{totalHours}h registradas</span>
                <span>{totalCapacity}h capacidad ({activeMembers} × {MONTHLY_CAPACITY}h)</span>
              </div>
            </Card>
          )}

          <div className="grid flex-1 gap-5 lg:grid-cols-2">
            {/* Hours by Project */}
            <Card className="p-5">
              <h3 className="font-semibold text-foreground mb-4">Horas por Proyecto</h3>
              {hoursByProject.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos en este período</p>
              ) : (
                <div className="space-y-3">
                  {hoursByProject.map((p) => {
                    const pct = totalHours > 0 ? (p.hours / totalHours) * 100 : 0;
                    return (
                      <div key={p.listId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground font-medium truncate mr-2">{p.name}</span>
                          <span className="text-muted-foreground shrink-0">{p.hours}h</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Hours by Client */}
            <Card className="p-5">
              <h3 className="font-semibold text-foreground mb-4">Horas por Cliente</h3>
              {hoursByClient.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos en este período</p>
              ) : (
                <div className="space-y-3">
                  {hoursByClient.map((c) => {
                    const pct = totalHours > 0 ? (c.hours / totalHours) * 100 : 0;
                    return (
                      <div key={c.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="text-foreground font-medium truncate">{c.name}</span>
                          </div>
                          <span className="text-muted-foreground shrink-0">{c.hours}h</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color + "99" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Task completion */}
            <Card className="p-5 lg:col-span-2">
              <h3 className="font-semibold text-foreground mb-4">Resumen de Tareas</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold text-foreground">{totalTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-500/10 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{completedTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Completadas</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                  <p className="text-2xl font-bold text-blue-500">{totalTasks - completedTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pendientes</p>
                </div>
              </div>
              {totalTasks > 0 && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Tasa de completitud</span>
                    <span className="font-medium text-foreground">
                      {Math.round((completedTasks / totalTasks) * 100)}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Projects                                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "projects" && (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Tareas</TableHead>
                <TableHead className="text-center">Completadas</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead className="text-right pr-5">Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay proyectos con tareas en este período
                  </TableCell>
                </TableRow>
              ) : (
                projectRows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-5 font-medium">{p.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: p.spaceColor }} />
                        <span className="text-sm">{p.spaceName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{p.totalTasks}</TableCell>
                    <TableCell className="text-center">{p.doneTasks}</TableCell>
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
                    <TableCell className="text-right pr-5 tabular-nums">{p.hours}h</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {projectRows.length > 0 && (
            <div className="border-t px-5 py-3 flex justify-between text-sm">
              <span className="text-muted-foreground">{projectRows.length} proyectos</span>
              <span className="font-medium">
                Total: {Math.round(projectRows.reduce((s, p) => s + p.hours, 0) * 10) / 10}h
              </span>
            </div>
          )}
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Team (admin only, MEMBER sees self via overview)          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "team" && isFullAccess && (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Miembro</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Capacidad</TableHead>
                <TableHead>Utilización</TableHead>
                <TableHead className="text-center pr-5">Tareas Completadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay datos del equipo
                  </TableCell>
                </TableRow>
              ) : (
                teamRows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.hours}h</TableCell>
                    <TableCell className="text-right tabular-nums">{m.capacity}h</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              m.utilization > 100 ? "bg-red-500" : m.utilization > 80 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(m.utilization, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{m.utilization}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center pr-5">{m.tasksCompleted}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {teamRows.length > 0 && (
            <div className="border-t px-5 py-3 flex justify-between text-sm">
              <span className="text-muted-foreground">{teamRows.length} miembros</span>
              <span className="font-medium">
                Total: {Math.round(teamRows.reduce((s, m) => s + m.hours, 0) * 10) / 10}h / {teamRows.length * MONTHLY_CAPACITY}h capacidad
              </span>
            </div>
          )}
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Time detail                                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "time" && (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Fecha</TableHead>
                {isFullAccess && <TableHead>Miembro</TableHead>}
                <TableHead>Tarea</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="pr-5">Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isFullAccess ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    Sin registros de tiempo en este período
                  </TableCell>
                </TableRow>
              ) : (
                timeRows.slice(0, 100).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5 tabular-nums whitespace-nowrap">
                      {format(new Date(r.date), "dd/MM/yyyy")}
                    </TableCell>
                    {isFullAccess && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                              {getInitials(r.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{r.userName}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="max-w-[200px] truncate">{r.taskTitle}</TableCell>
                    <TableCell className="text-sm">{r.listName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.spaceName}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{r.hours}h</TableCell>
                    <TableCell className="pr-5 max-w-[200px] truncate text-muted-foreground text-sm">
                      {r.description || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {timeRows.length > 0 && (
            <div className="border-t px-5 py-3 flex justify-between text-sm">
              <span className="text-muted-foreground">
                {timeRows.length} registros{timeRows.length > 100 ? " (mostrando 100)" : ""}
              </span>
              <span className="font-medium">Total: {timeRowsTotalHours}h</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
