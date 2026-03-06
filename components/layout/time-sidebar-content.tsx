"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Play, Square } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/contexts/auth-context";
import { getActiveTimer, stopTimer } from "@/lib/time-tracking";

interface TimeEntry {
  id: string;
  duration: number; // in seconds
  startTime: string;
  endTime: string | null;
  description: string | null;
  taskId: string | null;
  userId: string | null;
  task?: {
    id: string;
    title: string;
  } | null;
}

export function TimeSidebarContent() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { activeTimer, setActiveTimer, openModal } = useAppStore();
  const [elapsed, setElapsed] = useState(0);
  const { user } = useAuth();

  // Timer tick for active timer
  useEffect(() => {
    if (!activeTimer) {
      setElapsed(0);
      return;
    }
    const start = new Date(activeTimer.startTime).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Check for active timer on mount
  useEffect(() => {
    async function checkActiveTimer() {
      if (!user) return;
      try {
        const timer = await getActiveTimer(user.id);
        if (timer) {
          setActiveTimer({
            entryId: timer.id,
            startTime: new Date(timer.startTime),
            taskId: timer.taskId,
            taskTitle: timer.task?.title || "Tarea"
          });
        }
      } catch (error) {
        console.warn("Error checking active timer:", error);
      }
    }
    checkActiveTimer();
  }, [user, setActiveTimer]);

  useEffect(() => {
    async function fetchEntries() {
      if (!user) {
        setLoading(false);
        return;
      }

      const supabase = createClient();

      // Get start of current week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      try {
        const { data, error } = await supabase
          .from("TimeEntry")
          .select(`
            *,
            task:Task(id, title)
          `)
          .eq("userId", user.id)
          .gte("startTime", startOfWeek.toISOString())
          .order("startTime", { ascending: false })
          .limit(10);

        if (error) console.warn("Error fetching time entries:", error);
        if (data) setEntries(data as TimeEntry[]);
      } catch (err) {
        console.warn("Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEntries();
  }, [user]);

  const handleStopTimer = async () => {
    if (!activeTimer?.entryId) return;
    try {
      await stopTimer(activeTimer.entryId);
      setActiveTimer(null);
    } catch (error) {
      console.warn("Error stopping timer:", error);
    }
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return (h > 0 ? h + "h " : "") + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Only count completed entries
  const completedEntries = entries.filter(e => e.endTime !== null);
  const totalSeconds = completedEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const totalHours = totalSeconds / 3600;
  const capacity = 40;
  const percentage = Math.min(100, Math.round((totalHours / capacity) * 100));

  return (
    <div className="px-3 py-2">
      {/* Active Timer */}
      {activeTimer && (
        <div className="mb-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Timer activo</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate mb-2">{activeTimer.taskTitle}</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-emerald-800 dark:text-emerald-200">{formatTimer(elapsed)}</span>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleStopTimer}>
              <Square className="h-3 w-3 mr-1" />
              Detener
            </Button>
          </div>
        </div>
      )}

      {/* Weekly Summary */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Esta semana</span>
        <Button
          size="sm"
          className="h-7 text-xs bg-[var(--peach)] hover:bg-[var(--peach)]/90"
          onClick={() => openModal("log-time")}
        >
          <Plus className="h-3 w-3 mr-1" /> Registrar
        </Button>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline gap-1 mb-1.5">
          <span className="text-2xl font-bold">{totalHours.toFixed(1)}h</span>
          <span className="text-sm text-muted-foreground">/ {capacity}h</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: percentage + "%" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{percentage}% de capacidad</p>
      </div>

      {/* Entries */}
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Registros recientes
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay registros esta semana</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">
                  {entry.task?.title || entry.description || "Sin descripción"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(entry.startTime), "EEE d MMM, HH:mm", { locale: es })}
                </p>
              </div>
              <span className="text-sm font-medium shrink-0 ml-2">
                {entry.endTime ? formatDuration(entry.duration) : (
                  <span className="text-emerald-500 animate-pulse">En curso</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
