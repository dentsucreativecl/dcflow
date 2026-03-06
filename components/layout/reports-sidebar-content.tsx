"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface ReportStats {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalHours: number;
    activeMembers: number;
    tasksByStatus: Array<{ name: string; color: string; count: number }>;
}

export function ReportsSidebarContent() {
    const [stats, setStats] = useState<ReportStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            const supabase = createClient();
            try {
                const [tasksRes, timeRes, membersRes, statusesRes] = await Promise.all([
                    supabase.from("Task").select("id, statusId, dueDate, completedAt", { count: "exact" }),
                    supabase.from("TimeEntry").select("hours"),
                    supabase.from("User").select("id", { count: "exact" }).eq("isActive", true),
                    supabase.from("Status").select("id, name, color, type"),
                ]);

                const tasks = tasksRes.data || [];
                const now = new Date();
                const completedTasks = tasks.filter(t => t.completedAt).length;
                const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && !t.completedAt).length;
                const totalHours = (timeRes.data || []).reduce((sum, e) => sum + (e.hours || 0), 0);

                // Count tasks by status, grouping by name to avoid duplicates across projects
                const statusById = new Map<string, { name: string; color: string }>();
                (statusesRes.data || []).forEach(s => statusById.set(s.id, { name: s.name, color: s.color }));

                const statusByName = new Map<string, { name: string; color: string; count: number }>();
                tasks.forEach(t => {
                    const s = t.statusId ? statusById.get(t.statusId) : null;
                    if (!s) return;
                    const existing = statusByName.get(s.name);
                    if (existing) {
                        existing.count++;
                    } else {
                        statusByName.set(s.name, { name: s.name, color: s.color, count: 1 });
                    }
                });

                setStats({
                    totalTasks: tasks.length,
                    completedTasks,
                    overdueTasks,
                    totalHours: Math.round(totalHours),
                    activeMembers: membersRes.count || 0,
                    tasksByStatus: Array.from(statusByName.values()).sort((a, b) => b.count - a.count),
                });
            } catch (err) {
                console.error("Error fetching report stats:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="px-3 py-4 space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
        );
    }

    if (!stats) return <div className="px-3 py-4 text-sm text-muted-foreground text-center">Error cargando datos</div>;

    const completionRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

    return (
        <div className="px-3 py-2 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Resumen General</p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
                <StatCard icon={CheckCircle} label="Completadas" value={String(stats.completedTasks)} color="text-green-500" />
                <StatCard icon={AlertCircle} label="Vencidas" value={String(stats.overdueTasks)} color="text-red-500" />
                <StatCard icon={Clock} label="Horas" value={String(stats.totalHours) + "h"} color="text-blue-500" />
                <StatCard icon={Users} label="Miembros" value={String(stats.activeMembers)} color="text-purple-500" />
            </div>

            {/* Completion bar */}
            <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">Progreso general</span>
                    <span className="text-xs font-bold text-primary">{completionRate}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: completionRate + "%" }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{stats.completedTasks} de {stats.totalTasks} tareas</p>
            </div>

            {/* Tasks by Status */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">Por Estado</p>
                <div className="space-y-1.5">
                    {stats.tasksByStatus.map((s, i) => (
                        <div key={s.name + i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="text-sm flex-1 truncate">{s.name}</span>
                            <span className="text-sm font-medium">{s.count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
    return (
        <div className="bg-muted/50 rounded-lg p-2.5">
            <Icon className={"h-4 w-4 mb-1 " + color} />
            <p className="text-lg font-bold leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
    );
}
