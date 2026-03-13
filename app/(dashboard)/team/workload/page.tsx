"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { cn, getProgressColor } from "@/lib/utils";

interface MemberWorkload {
  id: string;
  name: string;
  role: string;
  department: string | null;
  taskCount: number;
  activeTaskCount: number;
  completedTaskCount: number;
  weeklyCapacity: number;
  utilizationPercent: number;
  isOverloaded: boolean;
  isUnderutilized: boolean;
  projectNames: string[];
}

const WEEKLY_CAPACITY = 40; // Default hours per week

export default function WorkloadPage() {
  const [workloadData, setWorkloadData] = useState<MemberWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    async function fetchWorkload() {
      const supabase = createClient();

      // Get all active users
      const { data: users } = await supabase
        .from("User")
        .select("id, name, role, department")
        .eq("isActive", true)
        .order("name");

      if (!users) { if (!cancelled) setLoading(false); return; }

      // Get all task assignments with task status info
      const { data: assignments } = await supabase
        .from("TaskAssignment")
        .select("userId, task:Task(id, title, statusId, status:Status(name), list:List(name))")
        .not("task", "is", null);

      // Build workload per user
      const workload: MemberWorkload[] = users.map((u) => {
        const userAssignments = (assignments || []).filter((a) => a.userId === u.id);
        const userTasks = userAssignments.map((a) => {
          const t = Array.isArray(a.task) ? a.task[0] : a.task;
          return t;
        }).filter(Boolean);

        const completedTasks = userTasks.filter((t) => {
          const status = Array.isArray(t!.status) ? t!.status[0] : t!.status;
          const name = status?.name?.toLowerCase() || "";
          return name === "completado" || name === "done" || name === "completed";
        });

        const activeTasks = userTasks.filter((t) => {
          const status = Array.isArray(t!.status) ? t!.status[0] : t!.status;
          const name = status?.name?.toLowerCase() || "";
          return name !== "completado" && name !== "done" && name !== "completed";
        });

        // Unique projects
        const projectNames = [...new Set(userTasks.map((t) => {
          const list = Array.isArray(t!.list) ? t!.list[0] : t!.list;
          return list?.name || "";
        }).filter(Boolean))];

        // Utilization: 1 task ≈ 4h average; cap at WEEKLY_CAPACITY
        const estimatedHours = Math.min(activeTasks.length * 4, WEEKLY_CAPACITY * 1.5);
        const utilizationPercent = Math.round((estimatedHours / WEEKLY_CAPACITY) * 100);

        return {
          id: u.id,
          name: u.name,
          role: u.role,
          department: u.department,
          taskCount: userTasks.length,
          activeTaskCount: activeTasks.length,
          completedTaskCount: completedTasks.length,
          weeklyCapacity: WEEKLY_CAPACITY,
          utilizationPercent,
          isOverloaded: utilizationPercent > 100,
          isUnderutilized: utilizationPercent < 30 && userTasks.length === 0,
          projectNames,
        };
      });

      workload.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
      if (!cancelled) setWorkloadData(workload);
      if (!cancelled) setLoading(false);
    }

    fetchWorkload().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [refreshKey]);

  const overloadedCount = workloadData.filter((w) => w.isOverloaded).length;
  const underutilizedCount = workloadData.filter((w) => w.isUnderutilized).length;
  const averageUtilization = workloadData.length
    ? Math.round(workloadData.reduce((acc, w) => acc + w.utilizationPercent, 0) / workloadData.length)
    : 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Carga de Trabajo"
        description="Distribución real de tareas activas por miembro del equipo"
        showSearch={false}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Miembros activos</p>
              <p className="text-2xl font-semibold text-foreground">{workloadData.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Utilización Prom.</p>
              <p className="text-2xl font-semibold text-foreground">{averageUtilization}%</p>
            </Card>
            <Card className="p-4 border-destructive/30">
              <p className="text-xs text-muted-foreground">Sobrecargados</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold text-destructive">{overloadedCount}</p>
                {overloadedCount > 0 && <AlertTriangle className="h-5 w-5 text-destructive" />}
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Sin tareas asignadas</p>
              <p className="text-2xl font-semibold text-green-600">{underutilizedCount}</p>
            </Card>
          </div>

          {/* Workload List */}
          <Card className="flex-1 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Distribución de Tareas por Persona</h3>
              <p className="text-xs text-muted-foreground">Basado en tareas activas asignadas · 1 tarea ≈ 4h estimadas</p>
            </div>
            <div className="divide-y divide-border overflow-y-auto max-h-[calc(100vh-400px)]">
              {workloadData.map(({ id, name, role, department, activeTaskCount, completedTaskCount, utilizationPercent, isOverloaded, isUnderutilized, projectNames }) => (
                <div
                  key={id}
                  className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white text-xs">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{name}</p>
                      {isOverloaded && (
                        <Badge className="bg-destructive/20 text-destructive gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          Sobrecargado
                        </Badge>
                      )}
                      {isUnderutilized && (
                        <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
                          Disponible
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {department || role} · {projectNames.slice(0, 2).join(", ")}{projectNames.length > 2 ? ` +${projectNames.length - 2}` : ""}
                    </p>
                  </div>

                  {/* Task counts */}
                  <div className="text-center w-20 shrink-0">
                    <p className="text-lg font-semibold text-foreground">{activeTaskCount}</p>
                    <p className="text-xs text-muted-foreground">Activas</p>
                  </div>
                  <div className="text-center w-20 shrink-0">
                    <p className="text-lg font-semibold text-green-600">{completedTaskCount}</p>
                    <p className="text-xs text-muted-foreground">Completadas</p>
                  </div>

                  {/* Utilization Bar */}
                  <div className="w-36 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Carga est.</span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          isOverloaded ? "text-destructive" : isUnderutilized ? "text-green-600" : "text-foreground"
                        )}
                      >
                        {utilizationPercent}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(utilizationPercent, 100)}
                      className="h-2"
                      indicatorClassName={
                        isOverloaded ? "bg-destructive" : isUnderutilized ? "bg-green-500" : getProgressColor(100 - utilizationPercent)
                      }
                    />
                  </div>

                  <div className="w-6 shrink-0">
                    {utilizationPercent > 80 ? (
                      <TrendingUp className="h-4 w-4 text-destructive" />
                    ) : utilizationPercent < 30 ? (
                      <TrendingDown className="h-4 w-4 text-green-600" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
