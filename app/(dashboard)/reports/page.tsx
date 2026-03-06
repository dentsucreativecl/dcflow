"use client";

import { useState, useEffect } from "react";
import {
  Clock, FolderCheck, Users,
  TrendingUp, TrendingDown, Download,
  Filter, Calendar, BarChart3, Loader2, ListChecks,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  suffix?: string;
}

function StatCard({ title, value, icon: Icon, suffix }: StatCardProps) {
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
          {typeof value === "number" ? value.toLocaleString() : value}{suffix}
        </span>
      </div>
    </Card>
  );
}

interface TeamMemberStats {
  id: string;
  name: string;
  hours: number;
  capacity: number;
  tasksCompleted: number;
}

interface ProjectStats {
  id: string;
  name: string;
  spaceName: string;
  spaceColor: string;
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

interface MonthlyHours {
  month: string;
  hours: number;
}

type ReportTab = "overview" | "projects" | "team" | "time";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalHours, setTotalHours] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);

  // Detailed data
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [monthlyHours, setMonthlyHours] = useState<MonthlyHours[]>([]);

  useEffect(() => {
    async function fetchReportData() {
      const supabase = createClient();

      // Fetch all time entries
      const { data: timeEntries } = await supabase
        .from("TimeEntry")
        .select("id, hours, userId, date");

      // Fetch all tasks with status
      const { data: tasks } = await supabase
        .from("Task")
        .select("id, listId, Status(type)")
        .is("parentId", null);

      // Fetch active members
      const { data: members } = await supabase
        .from("User")
        .select("id, name, weeklyCapacity")
        .eq("userType", "MEMBER")
        .eq("isActive", true);

      // Fetch lists with spaces
      const { data: lists } = await supabase
        .from("List")
        .select("id, name, Space(name, color)");

      // Calculate stat cards
      const hours = (timeEntries || []).reduce((sum, te) => sum + (te.hours || 0), 0);
      setTotalHours(Math.round(hours * 10) / 10);

      const allTasks = tasks || [];
      setTotalTasks(allTasks.length);
      const done = allTasks.filter((t) => {
        const status = t.Status as Record<string, unknown> | null;
        return (status?.type as string) === "DONE";
      }).length;
      setCompletedTasks(done);
      setActiveMembers((members || []).length);

      // Team performance
      const memberList = members || [];
      const timeByUser = new Map<string, number>();
      for (const te of timeEntries || []) {
        const userId = te.userId as string;
        timeByUser.set(userId, (timeByUser.get(userId) || 0) + (te.hours || 0));
      }

      // Count completed tasks per user
      const { data: assignments } = await supabase
        .from("TaskAssignment")
        .select("userId, Task(Status(type))")
        .is("Task.parentId", null);

      const completedByUser = new Map<string, number>();
      if (assignments) {
        for (const a of assignments as Array<Record<string, unknown>>) {
          const userId = a.userId as string;
          const task = a.Task as Record<string, unknown> | null;
          const status = task?.Status as Record<string, unknown> | null;
          if ((status?.type as string) === "DONE") {
            completedByUser.set(userId, (completedByUser.get(userId) || 0) + 1);
          }
        }
      }

      const tStats: TeamMemberStats[] = memberList.map((m) => ({
        id: m.id,
        name: m.name,
        hours: Math.round((timeByUser.get(m.id) || 0) * 10) / 10,
        capacity: m.weeklyCapacity || 40,
        tasksCompleted: completedByUser.get(m.id) || 0,
      }));
      tStats.sort((a, b) => b.hours - a.hours);
      setTeamStats(tStats);

      // Project stats
      const listMap = new Map<string, { name: string; spaceName: string; spaceColor: string }>();
      for (const l of (lists || []) as Array<Record<string, unknown>>) {
        const space = l.Space as Record<string, unknown> | null;
        listMap.set(l.id as string, {
          name: l.name as string,
          spaceName: (space?.name as string) || "General",
          spaceColor: (space?.color as string) || "#666",
        });
      }

      const tasksByList = new Map<string, { total: number; done: number }>();
      for (const t of allTasks as Array<Record<string, unknown>>) {
        const listId = t.listId as string;
        const status = t.Status as Record<string, unknown> | null;
        const sType = (status?.type as string) || "TODO";
        if (!tasksByList.has(listId)) tasksByList.set(listId, { total: 0, done: 0 });
        const entry = tasksByList.get(listId)!;
        entry.total++;
        if (sType === "DONE") entry.done++;
      }

      const pStats: ProjectStats[] = [];
      for (const [listId, counts] of tasksByList) {
        const info = listMap.get(listId);
        if (!info) continue;
        pStats.push({
          id: listId,
          name: info.name,
          spaceName: info.spaceName,
          spaceColor: info.spaceColor,
          totalTasks: counts.total,
          doneTasks: counts.done,
          progress: counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0,
        });
      }
      pStats.sort((a, b) => b.totalTasks - a.totalTasks);
      setProjectStats(pStats);

      // Monthly hours (last 6 months)
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const hoursByMonth = new Map<string, number>();
      for (const te of timeEntries || []) {
        if (!te.date) continue;
        const d = new Date(te.date as string);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        hoursByMonth.set(key, (hoursByMonth.get(key) || 0) + (te.hours || 0));
      }

      const now = new Date();
      const mHours: MonthlyHours[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        mHours.push({
          month: monthNames[d.getMonth()],
          hours: Math.round((hoursByMonth.get(key) || 0) * 10) / 10,
        });
      }
      setMonthlyHours(mHours);

      setLoading(false);
    }

    fetchReportData();
  }, []);

  const handleExport = () => {
    const data = JSON.stringify({
      totalHours,
      totalTasks,
      completedTasks,
      activeMembers,
      teamStats,
      projectStats,
      monthlyHours,
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte-dcflow.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: "overview" as ReportTab, label: "General", icon: BarChart3 },
    { id: "projects" as ReportTab, label: "Proyectos", icon: FolderCheck },
    { id: "team" as ReportTab, label: "Equipo", icon: Users },
    { id: "time" as ReportTab, label: "Tiempo", icon: Clock },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const maxHours = Math.max(...monthlyHours.map((m) => m.hours), 1);

  return (
    <div className="flex h-full flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground">Reportes</h1>
          <p className="text-sm text-muted-foreground">Análisis e informes de tu agencia</p>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
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

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Horas Registradas" value={totalHours} icon={Clock} suffix="h" />
        <StatCard title="Total Tareas" value={totalTasks} icon={ListChecks} />
        <StatCard title="Tareas Completadas" value={completedTasks} icon={FolderCheck} />
        <StatCard title="Miembros Activos" value={activeMembers} icon={Users} />
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid flex-1 gap-5 lg:grid-cols-2">
          {/* Hours Bar Chart */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Horas por Mes</h3>
            <div className="flex items-end gap-3 h-[200px]">
              {monthlyHours.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{m.hours}h</span>
                  <div
                    className="w-full bg-primary/80 rounded-t transition-all"
                    style={{ height: `${(m.hours / maxHours) * 160}px`, minHeight: m.hours > 0 ? "4px" : "0px" }}
                  />
                  <span className="text-xs text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Task Status Summary */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Resumen de Tareas</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
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
      )}

      {activeTab === "projects" && (
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Proyectos Activos</h3>
          <div className="space-y-3">
            {projectStats.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-3 rounded shrink-0"
                    style={{ backgroundColor: p.spaceColor }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.spaceName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {p.doneTasks}/{p.totalTasks} tareas
                  </span>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        p.progress === 100
                          ? "bg-emerald-500"
                          : p.progress > 50
                          ? "bg-blue-500"
                          : "bg-amber-500"
                      )}
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {p.progress}%
                  </span>
                </div>
              </div>
            ))}
            {projectStats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay proyectos con tareas
              </p>
            )}
          </div>
        </Card>
      )}

      {activeTab === "team" && (
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Rendimiento del Equipo</h3>
          <div className="space-y-3">
            {teamStats.map((member) => {
              const utilization = member.capacity > 0
                ? Math.round((member.hours / member.capacity) * 100)
                : 0;
              return (
                <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {member.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.tasksCompleted} tareas completadas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{member.hours}h</p>
                      <p className="text-xs text-muted-foreground">de {member.capacity}h</p>
                    </div>
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          utilization > 100
                            ? "bg-red-500"
                            : utilization > 80
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {utilization}%
                    </span>
                  </div>
                </div>
              );
            })}
            {teamStats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay miembros del equipo
              </p>
            )}
          </div>
        </Card>
      )}

      {activeTab === "time" && (
        <div className="grid flex-1 gap-5 lg:grid-cols-2">
          {/* Hours Chart */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Horas por Mes</h3>
            <div className="flex items-end gap-3 h-[200px]">
              {monthlyHours.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{m.hours}h</span>
                  <div
                    className="w-full bg-primary/80 rounded-t transition-all"
                    style={{ height: `${(m.hours / maxHours) * 160}px`, minHeight: m.hours > 0 ? "4px" : "0px" }}
                  />
                  <span className="text-xs text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary Stats */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Resumen de Horas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-blue-500/10">
                <p className="text-xs font-medium text-blue-400">Total Horas</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totalHours}h</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-500/10">
                <p className="text-xs font-medium text-emerald-400">Promedio Diario</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {activeMembers > 0 ? Math.round((totalHours / activeMembers / 20) * 10) / 10 : 0}h
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-500/10">
                <p className="text-xs font-medium text-purple-400">Miembros Activos</p>
                <p className="text-2xl font-bold text-foreground mt-1">{activeMembers}</p>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10">
                <p className="text-xs font-medium text-amber-400">Horas Este Mes</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {monthlyHours.length > 0 ? monthlyHours[monthlyHours.length - 1].hours : 0}h
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
