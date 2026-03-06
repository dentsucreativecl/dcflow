import { formatDistanceToNow, format, isToday, isYesterday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";

export function formatRelativeDate(date: string | Date): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isToday(dateObj)) {
        return "Hoy";
    }

    if (isYesterday(dateObj)) {
        return "Ayer";
    }

    if (isTomorrow(dateObj)) {
        return "Mañana";
    }

    // If within the last 7 days
    const daysDiff = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 0 && daysDiff < 7) {
        return formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
    }

    // If within the next 7 days
    if (daysDiff < 0 && daysDiff > -7) {
        return formatDistanceToNow(dateObj, { addSuffix: true, locale: es });
    }

    // Otherwise show the actual date
    return format(dateObj, "MMM d, yyyy");
}

export function formatShortDate(date: string | Date): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, "MMM d");
}

export function formatFullDate(date: string | Date): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, "MMMM d, yyyy");
}

export function formatDateTime(date: string | Date): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, "MMM d, yyyy 'at' h:mm a");
}

export function isOverdue(dueDate: string | Date): boolean {
    const dateObj = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
    return dateObj < new Date() && !isToday(dateObj);
}

export function getDaysUntil(date: string | Date): number {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateObj.setHours(0, 0, 0, 0);
    return Math.ceil((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
