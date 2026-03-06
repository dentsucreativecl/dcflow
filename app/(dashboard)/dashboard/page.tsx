"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Folder, CheckSquare, Users, Clock, Loader2,
  ChevronDown, ChevronRight, List as ListIcon, LayoutGrid, Search,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAccessCard } from "@/components/features/quick-access-card";
import { TaskRow, type TaskRowData } from "@/components/features/task-row";
import { HoursCard } from "@/components/features/hours-card";
import { FilterDropdown } from "@/components/features/filter-dropdown";
import {
  groupTasksByDate,
  DATE_GROUP_ORDER,
  DATE_GROUP_CONFIG,
  type DateGroup,
} from "@/components/features/task-date-groups";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";

type ViewMode = "grouped" | "list";

export default function DashboardPage() {
  const { openModal } = useAppStore();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [listCount, setListCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [allSpaces, setAllSpaces] = useState<Array<{ value: string; label: string; count: number }>>([]);
  const [collapsed, setCollapsed] = useState<Set<DateGroup>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;

    async function fetchData() {
      const supabase = createClient();

      try {
        const [assignmentsRes, listsRes, usersRes, spacesRes] = await Promise.all([
          supabase
            .from("TaskAssignment")
            .select(`
              task:Task(
                id, title, description, priority, dueDate, completedAt,
                status:Status(id, name, color, type),
                list:List(id, name, space:Space(name, color))
              )
            `)
            .eq("userId", currentUserId),
          supabase.from("List").select("id"),
          supabase.from("User").select("id").eq("isActive", true),
          supabase.from("Space").select("id, name").order("name"),
        ]);

        if (assignmentsRes.data) {
          const mapped = assignmentsRes.data
            .map((row: Record<string, unknown>) => {
              const rawTask = row.task as Record<string, unknown> | Record<string, unknown>[] | null;
              const t = Array.isArray(rawTask) ? rawTask[0] : rawTask;
              if (!t) return null;
              const rawStatus = t.status as Record<string, unknown> | Record<string, unknown>[] | null;
              const rawList = t.list as Record<string, unknown> | null;
              const rawSpace = rawList?.space as Record<string, unknown> | Record<string, unknown>[] | null;
              return {
                id: t.id as string,
                title: t.title as string,
                description: t.description as string | null,
                priority: (t.priority as string) || "NONE",
                dueDate: t.dueDate as string | null,
                completedAt: t.completedAt as string | null,
                status: Array.isArray(rawStatus) ? rawStatus[0] : rawStatus,
                list: rawList ? {
                  id: rawList.id as string,
                  name: rawList.name as string,
                  space: Array.isArray(rawSpace) ? rawSpace[0] : rawSpace,
                } : null,
              } as TaskRowData;
            })
            .filter(Boolean) as TaskRowData[];
          setTasks(mapped);
        }

        if (listsRes.data) setListCount(listsRes.data.length);
        if (usersRes.data) setTeamCount(usersRes.data.length);
        if (spacesRes.data) {
          setAllSpaces(spacesRes.data.map((s: { id: string; name: string }) => ({ value: s.name, label: s.name, count: 0 })));
        }
      } catch (err) {
        console.error("Dashboard fetchData error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  // Derive unique clients: use all spaces as base, annotate with user task count
  const clients = useMemo(() => {
    const taskCountBySpace = new Map<string, number>();
    tasks.forEach(t => {
      const name = (t.list?.space as Record<string, unknown> | null)?.name as string | undefined;
      if (name) taskCountBySpace.set(name, (taskCountBySpace.get(name) || 0) + 1);
    });
    // Use allSpaces if loaded, else fall back to task-derived list
    const base = allSpaces.length > 0
      ? allSpaces.map(s => ({ value: s.value, label: s.label, count: taskCountBySpace.get(s.value) || 0 }))
      : Array.from(taskCountBySpace.entries()).map(([name, count]) => ({ value: name, label: name, count }));
    return base.sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks, allSpaces]);

  const projects = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    tasks.forEach(t => {
      if (t.list) map.set(t.list.id, { label: t.list.name, count: (map.get(t.list.id)?.count || 0) + 1 });
    });
    return Array.from(map.entries()).map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const statusType = t.status?.type?.toUpperCase();
      if (statusType === "DONE" || t.completedAt) return false;
      if (searchQuery) {
        if (!t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      if (clientFilter.length > 0) {
        const spaceName = (t.list?.space as Record<string, unknown> | null)?.name as string | undefined;
        if (!spaceName || !clientFilter.includes(spaceName)) return false;
      }
      if (projectFilter.length > 0) {
        if (!t.list || !projectFilter.includes(t.list.id)) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, clientFilter, projectFilter]);

  const groups = useMemo(() => groupTasksByDate(filteredTasks), [filteredTasks]);

  const overdueCount = groups.OVERDUE?.length ?? 0;
  const todayCount = groups.TODAY?.length ?? 0;
  const activeTasks = tasks.filter(t => t.status?.type?.toUpperCase() !== "DONE" && !t.completedAt);

  const toggleGroup = (group: DateGroup) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const hasFilters = searchQuery || clientFilter.length > 0 || projectFilter.length > 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summaryParts: string[] = [];
  if (overdueCount > 0) summaryParts.push(`${overdueCount} atrasada${overdueCount !== 1 ? "s" : ""}`);
  if (todayCount > 0) summaryParts.push(`${todayCount} para hoy`);
  if (summaryParts.length === 0) summaryParts.push("sin tareas pendientes urgentes");
  const description = `Tienes ${summaryParts.join(" y ")}`;

  return (
    <div className="flex h-full flex-col gap-6 animate-fade-in-up">
      <PageHeader
        title={`Bienvenido, ${user?.name?.split(" ")[0] || "Usuario"}`}
        description={description}
        showNewButton
        newButtonText="Nuevo Proyecto"
        onNewClick={() => openModal("new-project")}
      />

      {/* Quick Access Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <QuickAccessCard title="Proyectos" count={listCount} icon={Folder} href="/projects" color="#6366f1" />
        <QuickAccessCard title="Mis Tareas" count={activeTasks.length} icon={CheckSquare} href="/my-tasks" color="#f59e0b" />
        <QuickAccessCard title="Tiempo" count={0} icon={Clock} href="/time" color="#10b981" />
        <QuickAccessCard title="Equipo" count={teamCount} icon={Users} href="/team" color="#8b5cf6" />
      </div>

      {/* Main content */}
      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_340px] min-h-0">
        <div className="flex flex-col gap-4 min-h-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarea..."
                  className="w-[200px] bg-card pl-9 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {/* Client filter */}
              <FilterDropdown
                label="Cliente"
                options={clients}
                selected={clientFilter}
                onChange={setClientFilter}
              />
              {/* Project filter */}
              <FilterDropdown
                label="Proyecto"
                options={projects}
                selected={projectFilter}
                onChange={setProjectFilter}
              />
              {hasFilters && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setSearchQuery(""); setClientFilter([]); setProjectFilter([]); }}
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border bg-card p-1 gap-0.5">
              <button
                title="Agrupado por fecha"
                onClick={() => setViewMode("grouped")}
                className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${viewMode === "grouped" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                title="Lista plana"
                onClick={() => setViewMode("list")}
                className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${viewMode === "list" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tasks */}
          <div className="flex-1 overflow-auto space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CheckSquare className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-lg font-medium">Sin tareas pendientes</p>
                <p className="text-sm">{hasFilters ? "Prueba con otros filtros" : "No tienes tareas asignadas"}</p>
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-1.5">
                {filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onClick={() => openModal("task-detail-v2", { taskId: task.id })}
                  />
                ))}
              </div>
            ) : (
              DATE_GROUP_ORDER.map((groupKey) => {
                const groupTasks = groups[groupKey];
                if (!groupTasks || groupTasks.length === 0) return null;
                const config = DATE_GROUP_CONFIG[groupKey];
                const isCollapsed = collapsed.has(groupKey);
                const Icon = config.icon;

                return (
                  <div key={groupKey}>
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="flex items-center gap-2 mb-2 w-full text-left hover:bg-accent/50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <span className="text-sm font-semibold text-foreground">{config.label}</span>
                      <Badge className={`text-[10px] h-5 px-1.5 ${config.badgeColor}`}>
                        {groupTasks.length}
                      </Badge>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-1.5 pl-2">
                        {groupTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onClick={() => openModal("task-detail-v2", { taskId: task.id })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right sidebar: Hours */}
        <div className="hidden lg:block">
          <HoursCard />
        </div>
      </div>
    </div>
  );
}
