import { createClient } from "@/lib/supabase/client";

/**
 * TimeEntry — matches Prisma schema:
 *   id, taskId, userId, hours (Float), date (Date), description, createdAt, updatedAt
 */
export interface TimeEntry {
    id: string;
    taskId: string;
    userId: string;
    hours: number;
    date: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    task?: {
        id: string;
        title: string;
    };
    user?: {
        id: string;
        name: string;
        avatarUrl: string | null;
    };
}

function getSupabase() {
    return createClient();
}

/** Log a manual time entry */
export async function logManualTime(
    taskId: string,
    userId: string,
    hours: number,
    date: Date,
    description?: string
): Promise<TimeEntry> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from("TimeEntry")
        .insert({
            id: crypto.randomUUID(),
            taskId,
            userId,
            hours,
            date: date.toISOString().split("T")[0],
            description: description || null,
            createdAt: now,
            updatedAt: now,
        })
        .select()
        .single();

    if (error) throw error;
    return data as TimeEntry;
}

/** Delete a time entry */
export async function deleteTimeEntry(entryId: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
        .from("TimeEntry")
        .delete()
        .eq("id", entryId);

    if (error) throw error;
}

/** Get time entries for a task */
export async function getTimeEntries(taskId: string): Promise<TimeEntry[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("TimeEntry")
        .select(`
            *,
            user:User(id, name, avatarUrl)
        `)
        .eq("taskId", taskId)
        .order("date", { ascending: false });

    if (error) throw error;
    return (data || []) as TimeEntry[];
}

/** Get time entries for a user in a date range */
export async function getUserTimeEntries(
    userId: string,
    startDate?: Date,
    endDate?: Date
): Promise<TimeEntry[]> {
    const supabase = getSupabase();

    let query = supabase
        .from("TimeEntry")
        .select(`
            *,
            task:Task(id, title)
        `)
        .eq("userId", userId)
        .order("date", { ascending: false });

    if (startDate) {
        query = query.gte("date", startDate.toISOString().split("T")[0]);
    }
    if (endDate) {
        query = query.lte("date", endDate.toISOString().split("T")[0]);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as TimeEntry[];
}

/** Get total hours for a user in a date range */
export async function getUserTotalHours(
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("TimeEntry")
        .select("hours")
        .eq("userId", userId)
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

    if (error) throw error;

    return (data || []).reduce((acc, entry) => acc + (entry.hours || 0), 0);
}

/** Get weekly hours for a user (current week) */
export async function getUserWeeklyHours(userId: string): Promise<number> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return getUserTotalHours(userId, startOfWeek, endOfWeek);
}
