"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock, Play, Square, Plus, Calendar, Download, Filter,
  Trash2, BarChart3, Timer, TrendingUp, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

interface TimeEntryRow {
  id: string;
  taskId: string;
  taskName: string;
  listName: string;
  spaceColor: string;
  date: string;
  hours: number;
  description: string;
  userName: string;
}

interface TaskOption {
  id: string;
  title: string;
  listName: string;
}

interface MemberOption {
  id: string;
  name: string;
}

const colorMap: Record<string, string> = {
  "#E67E22": "bg-orange-500",
  "#9B59B6": "bg-purple-500",
  "#F2A6A6": "bg-pink-400",
  "#17385C": "bg-blue-700",
  "#0F4036": "bg-emerald-800",
};

function getColorClass(hex: string | null): string {
  if (!hex) return "bg-gray-500";
  return colorMap[hex] || "bg-gray-500";
}

export default function TimePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTaskId, setTimerTaskId] = useState("");
  const [timerDescription, setTimerDescription] = useState("");
  const [filterList, setFilterList] = useState("all");
  const [filterMember, setFilterMember] = useState("me");

  const fetchEntries = useCallback(async (memberId?: string) => {
    if (!user) return;
    const supabase = createClient();

    const targetId = memberId ?? filterMember;
    let query = supabase
      .from("TimeEntry")
      .select(`
        id, taskId, hours, date, description,
        Task(title, List(name, Space(color))),
        User(name)
      `)
      .order("date", { ascending: false })
      .limit(100);

    if (targetId !== "all") {
      query = query.eq("userId", targetId === "me" ? user.id : targetId);
    }

    const { data } = await query;

    if (data) {
      const mapped: TimeEntryRow[] = data.map((e: Record<string, unknown>) => {
        const task = e.Task as Record<string, unknown> | null;
        const list = task?.List as Record<string, unknown> | null;
        const space = list?.Space as Record<string, unknown> | null;
        const entryUser = e.User as Record<string, unknown> | null;
        return {
          id: e.id as string,
          taskId: e.taskId as string,
          taskName: (task?.title as string) || "Sin tarea",
          listName: (list?.name as string) || "Sin proyecto",
          spaceColor: getColorClass((space?.color as string) || null),
          date: e.date as string,
          hours: e.hours as number,
          description: (e.description as string) || "",
          userName: (entryUser?.name as string) || user.name,
        };
      });
      setEntries(mapped);
    }
    setLoading(false);
  }, [user, filterMember]);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    // Get tasks assigned to user or created by user
    const { data: assignments } = await supabase
      .from("TaskAssignment")
      .select("taskId")
      .eq("userId", user.id);

    const taskIds = assignments?.map((a) => a.taskId) || [];

    if (taskIds.length === 0) return;

    const { data: taskData } = await supabase
      .from("Task")
      .select("id, title, List(name)")
      .in("id", taskIds)
      .order("title");

    if (taskData) {
      setTasks(
        taskData.map((t: Record<string, unknown>) => {
          const list = t.List as Record<string, unknown> | null;
          return {
            id: t.id as string,
            title: t.title as string,
            listName: (list?.name as string) || "",
          };
        })
      );
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
    fetchTasks();

    // Load team members for filter dropdown
    const loadMembers = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("User")
        .select("id, name")
        .eq("isActive", true)
        .order("name");
      if (data) setMembers(data);
    };
    loadMembers();
  }, [fetchEntries, fetchTasks]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  };

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    setTimerSeconds(0);
  };

  const handleStopTimer = async () => {
    setIsTimerRunning(false);
    if (timerSeconds > 0 && timerTaskId && user) {
      const hours = Math.round((timerSeconds / 3600) * 100) / 100;
      const supabase = createClient();

      const { error } = await supabase.from("TimeEntry").insert({
        taskId: timerTaskId,
        userId: user.id,
        hours,
        date: new Date().toISOString().split("T")[0],
        description: timerDescription || "Registrado con timer",
      });

      if (!error) {
        await fetchEntries();
      }
    }
    setTimerSeconds(0);
    setTimerTaskId("");
    setTimerDescription("");
  };

  const handleDeleteEntry = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("TimeEntry").delete().eq("id", id);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  };

  // Computed stats
  const todayStr = new Date().toISOString().split("T")[0];
  const todayHours = entries
    .filter((e) => e.date === todayStr)
    .reduce((sum, e) => sum + e.hours, 0);
  const weekHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const avgDaily = entries.length > 0 ? weekHours / 5 : 0;

  const uniqueLists = Array.from(new Set(entries.map((e) => e.listName)));

  const filtered =
    filterList === "all"
      ? entries
      : entries.filter((e) => e.listName === filterList);

  // Group by date
  const grouped = filtered.reduce<Record<string, TimeEntryRow[]>>(
    (acc, entry) => {
      if (!acc[entry.date]) acc[entry.date] = [];
      acc[entry.date].push(entry);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const days = [
      "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
    ];
    const months = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];
    return (
      days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear()
    );
  };

  const getDayTotal = (dateStr: string) => {
    return grouped[dateStr].reduce((sum, e) => sum + e.hours, 0);
  };

  const listHours = uniqueLists
    .map((name) => ({
      name,
      hours: entries
        .filter((e) => e.listName === name)
        .reduce((s, e) => s + e.hours, 0),
      color: entries.find((e) => e.listName === name)?.spaceColor || "bg-gray-500",
    }))
    .sort((a, b) => b.hours - a.hours);

  const maxListHours = Math.max(...listHours.map((p) => p.hours), 1);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Registro de Tiempo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registra y gestiona las horas dedicadas a cada tarea
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            if (entries.length === 0) return;
            const header = "Fecha,Tarea,Proyecto,Horas,Descripción\n";
            const rows = entries.map(e =>
              `"${e.date}","${e.taskName.replace(/"/g, '""')}","${e.listName.replace(/"/g, '""')}",${e.hours},"${e.description.replace(/"/g, '""')}"`
            ).join("\n");
            const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `dc-flow-tiempo-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Hoy</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {todayHours.toFixed(1)}h
          </p>
          <p className="text-xs text-muted-foreground mt-1">de 8h objetivo</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-sm text-muted-foreground">Esta Semana</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {weekHours.toFixed(1)}h
          </p>
          <p className="text-xs text-muted-foreground mt-1">de 40h objetivo</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">
              Promedio Diario
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {avgDaily.toFixed(1)}h
          </p>
          <p className="text-xs text-muted-foreground mt-1">últimos 5 días</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Timer className="h-5 w-5 text-violet-500" />
            </div>
            <span className="text-sm text-muted-foreground">Entradas</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{entries.length}</p>
          <p className="text-xs text-muted-foreground mt-1">registradas</p>
        </div>
      </div>

      {/* Timer Section */}
      <div className="rounded-xl border bg-card p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <select
              value={timerTaskId}
              onChange={(e) => setTimerTaskId(e.target.value)}
              className="flex-1 text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Seleccionar tarea...</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} — {t.listName}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Descripción (opcional)"
              value={timerDescription}
              onChange={(e) => setTimerDescription(e.target.value)}
              className="w-[200px] text-sm border border-border rounded-lg px-3 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-foreground min-w-[100px] text-center">
              {formatTimer(timerSeconds)}
            </span>
            {!isTimerRunning && !timerTaskId && (
              <span className="text-xs text-muted-foreground">Selecciona una tarea</span>
            )}
            {isTimerRunning ? (
              <button
                onClick={handleStopTimer}
                className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleStartTimer}
                disabled={!timerTaskId}
                title={!timerTaskId ? "Selecciona una tarea primero" : "Iniciar timer"}
                className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
              >
                <Play className="h-4 w-4 fill-current ml-0.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Time entries list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Historial de Entradas
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterMember}
                onChange={(e) => {
                  setFilterMember(e.target.value);
                  fetchEntries(e.target.value);
                }}
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground"
              >
                <option value="me">Mis entradas</option>
                <option value="all">Todo el equipo</option>
                {members
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <select
                value={filterList}
                onChange={(e) => setFilterList(e.target.value)}
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground"
              >
                <option value="all">Todos los proyectos</option>
                {uniqueLists.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sortedDates.length === 0 && (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                No hay entradas de tiempo registradas
              </p>
            </div>
          )}

          <div className="space-y-4">
            {sortedDates.map((dateStr) => (
              <div
                key={dateStr}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-3 bg-muted/50 border-b">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {formatDate(dateStr)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {getDayTotal(dateStr).toFixed(1)}h
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {grouped[dateStr].map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                    >
                      <div
                        className={"w-2 h-2 rounded-full mr-3 " + entry.spaceColor}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {entry.taskName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.listName}
                          {filterMember !== "me" && <span className="ml-2 text-primary/70">· {entry.userName}</span>}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0 px-4">
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-foreground min-w-[50px] text-right">
                          {entry.hours.toFixed(1)}h
                        </span>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Project Breakdown */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Horas por Proyecto
            </h3>
            <div className="space-y-3">
              {listHours.map((p) => (
                <div key={p.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground truncate mr-2">
                      {p.name}
                    </span>
                    <span className="font-semibold text-foreground">
                      {p.hours.toFixed(1)}h
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={"h-full rounded-full transition-all " + p.color}
                      style={{
                        width: Math.round((p.hours / maxListHours) * 100) + "%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Resumen Semanal
            </h3>
            <div className="space-y-2">
              {sortedDates.map((dateStr) => {
                const dayTotal = getDayTotal(dateStr);
                const pct = Math.min(Math.round((dayTotal / 8) * 100), 100);
                const d = new Date(dateStr + "T12:00:00");
                const dayNames = [
                  "Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb",
                ];
                return (
                  <div key={dateStr} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-8">
                      {dayNames[d.getDay()]}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={
                          pct >= 100
                            ? "h-full rounded-full bg-emerald-500"
                            : "h-full rounded-full bg-primary"
                        }
                        style={{ width: pct + "%" }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground w-10 text-right">
                      {dayTotal.toFixed(1)}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
