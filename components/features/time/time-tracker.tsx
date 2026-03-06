"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { StopCircle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stopTimer, getActiveTimer } from "@/lib/time-tracking";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export function TimeTracker() {
    const { user } = useAuth();
    const { activeTimer, setActiveTimer, openModal } = useAppStore();
    const { addToast } = useToast();
    const [elapsed, setElapsed] = useState(0);

    // Initial check for active timer on mount
    useEffect(() => {
        if (!user) return;

        const checkActiveTimer = async () => {
            try {
                const timer = await getActiveTimer(user.id);
                if (timer) {
                    const elapsedSeconds = Math.floor(
                        (Date.now() - new Date(timer.startTime).getTime()) / 1000
                    );
                    if (elapsedSeconds > 86400) {
                        // Corrupted timer(s): silently delete ALL open entries for this user
                        const supabase = createClient();
                        await supabase
                            .from("TimeEntry")
                            .delete()
                            .eq("userId", user.id)
                            .is("endTime", null);
                        return; // Don't show the widget
                    }
                    setActiveTimer({
                        entryId: timer.id,
                        startTime: new Date(timer.startTime),
                        taskId: timer.taskId,
                        taskTitle: timer.task?.title || "Tarea desconocida"
                    });
                }
            } catch (error) {
                console.error("Error checking active timer:", error);
            }
        };

        checkActiveTimer();
    }, [user, setActiveTimer]);

    // Timer tick
    useEffect(() => {
        if (!activeTimer) {
            setElapsed(0);
            return;
        }

        const start = activeTimer.startTime.getTime();
        setElapsed(Math.floor((Date.now() - start) / 1000));

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [activeTimer]);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleStop = async () => {
        if (!activeTimer?.entryId) return;

        try {
            await stopTimer(activeTimer.entryId);
            setActiveTimer(null);
            addToast({ title: "Timer detenido", type: "success" });
        } catch (error) {
            console.error("Error stopping timer:", error);
            addToast({ title: "Error al detener timer", type: "error" });
        }
    };

    const handleOpenTask = () => {
        if (activeTimer) {
            openModal("task-detail-v2", { taskId: activeTimer.taskId });
        }
    };

    if (!activeTimer) return null;

    // Guard: if elapsed > 24h, the timer entry is likely corrupted — show dismiss option
    const isCorrupted = elapsed > 86400;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-background border shadow-lg rounded-full p-1 pl-4 animate-in slide-in-from-bottom-5">
            <div className="flex flex-col cursor-pointer" onClick={!isCorrupted ? handleOpenTask : undefined}>
                <span className="text-[10px] text-muted-foreground font-medium max-w-[150px] truncate">
                    {isCorrupted ? "Timer inválido" : activeTimer.taskTitle}
                </span>
                <span className={`text-sm font-mono font-bold flex items-center gap-1 ${isCorrupted ? "text-destructive" : "text-primary"}`}>
                    <Clock className="h-3 w-3 animate-pulse" />
                    {isCorrupted ? "—" : formatDuration(elapsed)}
                </span>
            </div>
            {!isCorrupted && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                    onClick={handleStop}
                    title="Detener timer"
                >
                    <StopCircle className="h-5 w-5" />
                </Button>
            )}
            <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={async () => {
                    // If corrupted, delete the DB entry so it doesn't reappear on reload
                    if (isCorrupted && activeTimer?.entryId) {
                        const supabase = createClient();
                        await supabase.from("TimeEntry").delete().eq("id", activeTimer.entryId);
                    }
                    setActiveTimer(null);
                }}
                title="Descartar"
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}
