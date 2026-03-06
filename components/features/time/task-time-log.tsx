"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Play,
    Square,
    Clock,
    Plus,
    Calendar as CalendarIcon,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    getTimeEntries,
    startTimer,
    stopTimer,
    logManualTime,
    deleteTimeEntry,
    TimeEntry
} from "@/lib/time-tracking";
import { useAuth } from "@/contexts/auth-context";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface TaskTimeLogProps {
    taskId: string;
    taskTitle: string;
}

export function TaskTimeLog({ taskId, taskTitle }: TaskTimeLogProps) {
    const { user } = useAuth();
    const { activeTimer, setActiveTimer } = useAppStore();
    const { addToast } = useToast();
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Manual entry state
    const [manualOpen, setManualOpen] = useState(false);
    const [manualHours, setManualHours] = useState("");
    const [manualMinutes, setManualMinutes] = useState("");
    const [manualDate, setManualDate] = useState<Date>(new Date());
    const [manualDesc, setManualDesc] = useState("");

    const isTimerActive = activeTimer?.taskId === taskId;

    useEffect(() => {
        loadEntries();
    }, [taskId]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerActive && activeTimer) {
            const start = new Date(activeTimer.startTime).getTime();
            setElapsedTime(Math.floor((Date.now() - start) / 1000));

            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - start) / 1000));
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [isTimerActive, activeTimer]);

    const loadEntries = async () => {
        try {
            const data = await getTimeEntries(taskId);
            setEntries(data || []);
        } catch (error) {
            console.error("Error loading time entries:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTimer = async () => {
        if (!user) return;

        try {
            if (isTimerActive && activeTimer?.entryId) {
                // Stop timer
                await stopTimer(activeTimer.entryId);
                setActiveTimer(null);
                addToast({ title: "Timer detenido", type: "success" });
            } else {
                // Start timer
                const newEntry = await startTimer(taskId, user.id);
                setActiveTimer({
                    entryId: newEntry.id,
                    startTime: new Date(newEntry.startTime),
                    taskId,
                    taskTitle
                });
                addToast({ title: "Timer iniciado", type: "success" });
            }
            loadEntries();
        } catch (error) {
            console.error("Error toggling timer:", error);
            addToast({ title: "Error", type: "error" });
        }
    };

    const handleSaveManual = async () => {
        if (!user || (!manualHours && !manualMinutes)) return;

        try {
            const hours = parseInt(manualHours || "0");
            const minutes = parseInt(manualMinutes || "0");
            const totalSeconds = (hours * 3600) + (minutes * 60);

            if (totalSeconds <= 0) return;

            await logManualTime(taskId, user.id, totalSeconds, manualDate || new Date(), manualDesc);

            setManualOpen(false);
            setManualHours("");
            setManualMinutes("");
            setManualDesc("");
            addToast({ title: "Tiempo registrado", type: "success" });
            loadEntries();
        } catch (error) {
            console.error("Error logging manual time:", error);
            addToast({ title: "Error", type: "error" });
        }
    };

    const handleDelete = async (entryId: string) => {
        try {
            await deleteTimeEntry(entryId);
            addToast({ title: "Registro eliminado", type: "success" });
            loadEntries();
        } catch (error) {
            console.error("Error deleting entry:", error);
            addToast({ title: "Error al eliminar", type: "error" });
        }
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatDurationShort = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.round((seconds % 3600) / 60);
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    // Only count completed entries
    const completedEntries = entries.filter(e => e.endTime !== null);
    const totalDuration = completedEntries.reduce((acc, curr) => acc + (curr.duration || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-4">
                    <Button
                        size="icon"
                        className={cn(
                            "h-12 w-12 rounded-full transition-all",
                            isTimerActive
                                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                                : "bg-green-600 hover:bg-green-700"
                        )}
                        onClick={handleToggleTimer}
                    >
                        {isTimerActive ? (
                            <Square className="h-5 w-5 fill-current" />
                        ) : (
                            <Play className="h-5 w-5 fill-current ml-1" />
                        )}
                    </Button>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">
                            {isTimerActive ? "Timer activo" : "Total registrado"}
                        </p>
                        <p className="text-2xl font-mono font-bold tracking-wider">
                            {isTimerActive ? formatDuration(elapsedTime) : formatDuration(totalDuration)}
                        </p>
                    </div>
                </div>

                <Popover open={manualOpen} onOpenChange={setManualOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Manual
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                            <h4 className="font-medium leading-none">Registrar tiempo</h4>
                            <div className="flex gap-2">
                                <div className="space-y-1 flex-1">
                                    <label className="text-xs">Horas</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={manualHours}
                                        onChange={(e) => setManualHours(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <label className="text-xs">Minutos</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="59"
                                        placeholder="0"
                                        value={manualMinutes}
                                        onChange={(e) => setManualMinutes(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs">Fecha</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {manualDate ? format(manualDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={manualDate}
                                            onSelect={(d) => d && setManualDate(d)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs">Descripción (opcional)</label>
                                <Input
                                    placeholder="¿Qué hiciste?"
                                    value={manualDesc}
                                    onChange={(e) => setManualDesc(e.target.value)}
                                />
                            </div>
                            <Button className="w-full" onClick={handleSaveManual}>
                                Guardar registro
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-medium">Historial</h3>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Duración</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Nota</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Cargando...
                                    </TableCell>
                                </TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No hay registros de tiempo
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="text-xs">
                                            {format(new Date(entry.startTime), "d MMM yyyy, HH:mm", { locale: es })}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {entry.endTime ? formatDurationShort(entry.duration) : (
                                                <span className="text-green-600 font-bold animate-pulse">En curso</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {entry.isManual ? "Manual" : "Timer"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                            {entry.description || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {entry.userId === user?.id && entry.endTime && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDelete(entry.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
