"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  status: { id: string; name: string; color: string } | null;
  assignments: Array<{ user: { id: string; name: string; avatarUrl: string | null } }>;
  subtasks?: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    startDate?: string | null;
    status: { id: string; name: string; color: string } | null;
  }>;
}

interface CalendarItem {
  id: string;
  title: string;
  priority?: string;
  dueDate: string;
  status: { id: string; name: string; color: string } | null;
  isSubtask: boolean;
  parentTitle?: string;
}

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const priorityColors: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  NORMAL: "bg-yellow-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-blue-500",
  NONE: "bg-slate-400",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday=0, Sunday=6
}

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };
  // Build a flat list of calendar items (parent tasks + subtasks with dates)
  const allItems = useMemo(() => {
    const items: CalendarItem[] = [];
    tasks.forEach((task) => {
      if (task.dueDate) {
        items.push({
          id: task.id,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          status: task.status,
          isSubtask: false,
        });
      }
      (task.subtasks || []).forEach((sub) => {
        if (sub.dueDate) {
          items.push({
            id: sub.id,
            title: sub.title,
            dueDate: sub.dueDate,
            status: sub.status,
            isSubtask: true,
            parentTitle: task.title,
          });
        }
      });
    });
    return items;
  }, [tasks]);

  // Group items by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    allItems.forEach((item) => {
      const d = new Date(item.dueDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [allItems]);

  const tasksWithoutDate = useMemo(() => tasks.filter((t) => !t.dueDate && !(t.subtasks || []).some(s => s.dueDate)), [tasks]);

  // Build calendar cells
  const cells: Array<{ day: number | null; tasks: CalendarItem[]; isToday: boolean; isPast: boolean }> = [];

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, tasks: [], isToday: false, isPast: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${currentYear}-${currentMonth}-${d}`;
    const cellTasks = tasksByDate[key] || [];
    const isToday = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
    const cellDate = new Date(currentYear, currentMonth, d);
    const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    cells.push({ day: d, tasks: cellTasks, isToday, isPast });
  }

  // Fill remaining cells to complete the grid
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 0; i < remaining; i++) {
      cells.push({ day: null, tasks: [], isToday: false, isPast: false });
    }
  }
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold text-foreground min-w-[200px] text-center">
            {MONTHS[currentMonth]} {currentYear}
          </h3>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={goToToday}>
            Hoy
          </Button>
        </div>
        {tasksWithoutDate.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {tasksWithoutDate.length} tarea{tasksWithoutDate.length !== 1 ? "s" : ""} sin fecha
          </span>
        )}
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {cells.map((cell, idx) => (
          <div
            key={idx}
            className={cn(
              "border-b border-r border-border p-1 min-h-[80px] transition-colors",
              !cell.day && "bg-muted/20",
              cell.isToday && "bg-primary/5 ring-1 ring-inset ring-primary/30",
              cell.isPast && cell.day && "opacity-60",
              idx % 7 === 0 && "border-l",
            )}
          >
            {cell.day && (
              <>
                <div className={cn(
                  "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                  cell.isToday && "bg-primary text-primary-foreground",
                  !cell.isToday && "text-foreground"
                )}>
                  {cell.day}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {cell.tasks.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onTaskClick?.(item.id)}
                      className="w-full text-left group"
                    >
                      <div className={cn(
                        "flex items-center gap-1 px-1 py-0.5 rounded text-[11px] leading-tight hover:bg-accent truncate",
                        item.isSubtask && "pl-2.5 opacity-80"
                      )}>
                        {item.isSubtask ? (
                          <span className="h-1 w-1 rounded-full flex-shrink-0 bg-muted-foreground/50" />
                        ) : (
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", priorityColors[item.priority || "NONE"] || "bg-slate-400")}
                          />
                        )}
                        {item.status && (
                          <span
                            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.status.color }}
                          />
                        )}
                        <span className="truncate text-foreground">{item.title}</span>
                      </div>
                    </button>
                  ))}
                  {cell.tasks.length > 4 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{cell.tasks.length - 4} más
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}