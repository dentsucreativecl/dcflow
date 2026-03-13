"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface CalendarTask {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  statusType: string;
  statusColor: string;
  listName: string;
  spaceColor: string;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const priorityDot: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-amber-500",
  NORMAL: "bg-blue-500",
  LOW: "bg-gray-400",
};

export default function CalendarPage() {
  const { openModal } = useAppStore();
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [currentDate, setCurrentDate] = useState(new Date());
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

    async function fetchTasks() {
      const supabase = createClient();

      const { data } = await supabase
        .from("Task")
        .select(`
          id, title, dueDate, priority,
          Status(color, type),
          List(name, Space(color))
        `)
        .not("dueDate", "is", null)
        .order("dueDate");

      if (data && !cancelled) {
        const mapped: CalendarTask[] = data.map((t: Record<string, unknown>) => {
          const status = t.Status as Record<string, unknown> | null;
          const list = t.List as Record<string, unknown> | null;
          const space = list?.Space as Record<string, unknown> | null;
          return {
            id: t.id as string,
            title: t.title as string,
            dueDate: t.dueDate as string,
            priority: t.priority as string,
            statusType: (status?.type as string) || "TODO",
            statusColor: (status?.color as string) || "#DFE1E6",
            listName: (list?.name as string) || "",
            spaceColor: (space?.color as string) || "#666",
          };
        });
        setTasks(mapped);
      }
      if (!cancelled) setLoading(false);
    }

    fetchTasks().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [refreshKey]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    // Next month padding
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
    }
    return days;
  }, [year, month]);

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return tasks.filter((t) => t.dueDate.startsWith(dateStr));
  };

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const goToPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleTaskClick = (taskId: string) => {
    openModal("task-detail-v2", { taskId });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Calendario"
        description="Fechas límite y cronogramas de proyectos"
        showSearch={false}
        actions={
          <Button className="gap-2" onClick={() => openModal("new-task-v2")}>
            <Plus className="h-4 w-4" />
            Nueva Tarea
          </Button>
        }
      />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground min-w-[200px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <Button variant="outline" size="sm" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Urgente</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Alta</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Normal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Baja</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 border rounded-xl bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {DAYS.map((day) => (
            <div key={day} className="px-3 py-2 text-xs font-medium text-muted-foreground text-center bg-muted/30">
              {day}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 auto-rows-[1fr]" style={{ minHeight: "calc(100% - 36px)" }}>
          {calendarDays.map((day, idx) => {
            const dateStr = day.date.toISOString().split("T")[0];
            const dayTasks = getTasksForDate(day.date);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={idx}
                className={cn(
                  "border-b border-r p-1.5 min-h-[100px] overflow-hidden",
                  !day.isCurrentMonth && "bg-muted/20"
                )}
              >
                <div className={cn(
                  "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                  isToday && "bg-primary text-white",
                  !isToday && day.isCurrentMonth && "text-foreground",
                  !isToday && !day.isCurrentMonth && "text-muted-foreground/50"
                )}>
                  {day.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      className="w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate hover:bg-muted transition-colors text-left"
                      style={{ backgroundColor: task.spaceColor + "15" }}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityDot[task.priority])} />
                      <span className={cn(
                        "truncate",
                        task.statusType === "DONE" ? "text-muted-foreground line-through" : "text-foreground"
                      )}>
                        {task.title}
                      </span>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1.5">
                      +{dayTasks.length - 3} más
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
