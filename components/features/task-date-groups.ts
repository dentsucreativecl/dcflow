import {
  startOfToday,
  endOfToday,
  endOfWeek,
  addWeeks,
  isAfter,
  isBefore,
  isSameDay,
} from "date-fns";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarClock,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";

export type DateGroup = "OVERDUE" | "TODAY" | "THIS_WEEK" | "NEXT_WEEK" | "NO_DATE";

export interface DateGroupConfig {
  key: DateGroup;
  label: string;
  icon: LucideIcon;
  color: string;
  badgeColor: string;
}

export const DATE_GROUP_ORDER: DateGroup[] = [
  "OVERDUE",
  "TODAY",
  "THIS_WEEK",
  "NEXT_WEEK",
  "NO_DATE",
];

export const DATE_GROUP_CONFIG: Record<DateGroup, DateGroupConfig> = {
  OVERDUE: {
    key: "OVERDUE",
    label: "Atrasadas",
    icon: AlertTriangle,
    color: "text-red-500",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  TODAY: {
    key: "TODAY",
    label: "Hoy",
    icon: CalendarCheck,
    color: "text-blue-500",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  THIS_WEEK: {
    key: "THIS_WEEK",
    label: "Esta Semana",
    icon: CalendarDays,
    color: "text-amber-500",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  NEXT_WEEK: {
    key: "NEXT_WEEK",
    label: "Próxima Semana",
    icon: CalendarClock,
    color: "text-emerald-500",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  NO_DATE: {
    key: "NO_DATE",
    label: "Sin Fecha",
    icon: CircleDashed,
    color: "text-muted-foreground",
    badgeColor: "bg-muted text-muted-foreground",
  },
};

export function groupTasksByDate<
  T extends {
    dueDate: string | null;
    status?: { type?: string } | null;
    completedAt?: string | null;
  }
>(tasks: T[]): Record<DateGroup, T[]> {
  const groups: Record<DateGroup, T[]> = {
    OVERDUE: [],
    TODAY: [],
    THIS_WEEK: [],
    NEXT_WEEK: [],
    NO_DATE: [],
  };

  const now = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

  for (const task of tasks) {
    // Skip completed tasks
    const statusType = task.status?.type?.toUpperCase();
    if (statusType === "DONE" || task.completedAt) continue;

    if (!task.dueDate) {
      groups.NO_DATE.push(task);
      continue;
    }

    const due = new Date(task.dueDate);

    if (isBefore(due, todayStart)) {
      groups.OVERDUE.push(task);
    } else if (isSameDay(due, todayStart) || (isAfter(due, todayStart) && isBefore(due, todayEnd))) {
      groups.TODAY.push(task);
    } else if (isAfter(due, todayEnd) && (isBefore(due, weekEnd) || isSameDay(due, weekEnd))) {
      groups.THIS_WEEK.push(task);
    } else if (isAfter(due, weekEnd) && (isBefore(due, nextWeekEnd) || isSameDay(due, nextWeekEnd))) {
      groups.NEXT_WEEK.push(task);
    }
    // Tasks beyond next week are not shown on the home page
  }

  return groups;
}
