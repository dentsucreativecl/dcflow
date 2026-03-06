"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, isToday, isTomorrow, isPast } from "date-fns";
import { es } from "date-fns/locale";

interface Task {
    id: string;
    title: string;
    dueDate: string;
    priority: string;
    list: {
        name: string;
        space: {
            color: string;
        };
    };
}

export function CalendarSidebarContent() {
    const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUpcomingTasks() {
            const supabase = createClient();

            try {
                const today = new Date().toISOString().split('T')[0];
                
                const { data } = await supabase
                    .from("Task")
                    .select("id, title, dueDate, priority, list:List(name, space:Space(color))")
                    .gte("dueDate", today)
                    .order("dueDate", { ascending: true })
                    .limit(10);

                if (data) {
                    setUpcomingTasks(data as unknown as Task[]);
                }
            } catch (error) {
                console.error("Error fetching upcoming tasks:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchUpcomingTasks();
    }, []);

    const getDateLabel = (dateString: string) => {
        const date = parseISO(dateString);
        if (isToday(date)) return "Hoy";
        if (isTomorrow(date)) return "Mañana";
        return format(date, "d MMM", { locale: es });
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case "URGENT": return "bg-red-500";
            case "HIGH": return "bg-orange-500";
            case "MEDIUM": case "NORMAL": return "bg-yellow-500";
            case "LOW": return "bg-blue-500";
            default: return "bg-slate-500";
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-3 space-y-3">
                <div className="text-xs font-medium text-muted-foreground">Próximos eventos</div>
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        );
    }

    if (upcomingTasks.length === 0) {
        return (
            <div className="px-4 py-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No hay eventos próximos</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="px-4 py-3">
                <div className="text-xs font-medium text-muted-foreground mb-3">
                    Próximas {upcomingTasks.length} tareas
                </div>
                <div className="space-y-2">
                    {upcomingTasks.map((task) => {
                        const spaceColor = task.list?.space?.color || "#8B5CF6";
                        const isPastDue = isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate));
                        
                        return (
                            <div
                                key={task.id}
                                className="p-2 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                                style={{
                                    borderLeftWidth: "3px",
                                    borderLeftColor: spaceColor,
                                }}
                            >
                                <div className="flex items-start gap-2">
                                    <div className={'h-2 w-2 rounded-full mt-1.5 ' + getPriorityColor(task.priority)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {task.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {task.list?.name}
                                        </p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <span className={'text-xs ' + (isPastDue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                                                {getDateLabel(task.dueDate)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ScrollArea>
    );
}
