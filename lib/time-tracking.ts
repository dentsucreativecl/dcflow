import { createClient } from "@/lib/supabase/client";

export interface TimeEntry {
    id: string;
    taskId: string;
    userId: string;
    startTime: string;
    endTime: string | null;
    duration: number; // in seconds
    description: string | null;
    isManual: boolean;
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

// Start a timer for a task
export async function startTimer(taskId: string, userId: string) {
    const supabase = getSupabase();

    // Check if there's already an active timer for this user and stop it
    // Query recent entries and filter for active timer in JavaScript
    const { data: recentEntries } = await supabase
        .from("TimeEntry")
        .select("id, startTime, endTime")
        .eq("userId", userId)
        .order("startTime", { ascending: false })
        .limit(5);

    const activeEntry = (recentEntries || []).find(entry => entry.endTime === null);

    if (activeEntry) {
        await stopTimer(activeEntry.id);
    }

    // Create new timer
    const { data, error } = await supabase
        .from("TimeEntry")
        .insert({
            taskId,
            userId,
            startTime: new Date().toISOString(),
            isManual: false,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Stop an active timer
export async function stopTimer(entryId: string) {
    const supabase = getSupabase();

    // Get the entry to calculate duration
    const { data: entry } = await supabase
        .from("TimeEntry")
        .select("startTime")
        .eq("id", entryId)
        .single();

    if (!entry) throw new Error("Entry not found");

    const endTime = new Date();
    const startTime = new Date(entry.startTime);
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000); // in seconds

    const { data, error } = await supabase
        .from("TimeEntry")
        .update({
            endTime: endTime.toISOString(),
            duration,
        })
        .eq("id", entryId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Log manual time entry
export async function logManualTime(
    taskId: string,
    userId: string,
    durationSeconds: number,
    date: Date,
    description?: string
) {
    const supabase = getSupabase();

    const startTime = date;
    const endTime = new Date(date.getTime() + durationSeconds * 1000);

    const { data, error } = await supabase
        .from("TimeEntry")
        .insert({
            taskId,
            userId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: durationSeconds,
            description: description || null,
            isManual: true,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Delete a time entry
export async function deleteTimeEntry(entryId: string) {
    const supabase = getSupabase();

    const { error } = await supabase
        .from("TimeEntry")
        .delete()
        .eq("id", entryId);

    if (error) throw error;
}

// Get time entries for a task
export async function getTimeEntries(taskId: string): Promise<TimeEntry[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("TimeEntry")
        .select(`
            *,
            user:User(id, name, avatarUrl)
        `)
        .eq("taskId", taskId)
        .order("startTime", { ascending: false });

    if (error) throw error;
    return (data || []) as TimeEntry[];
}

// Get currently active timer for user
export async function getActiveTimer(userId: string): Promise<TimeEntry | null> {
    const supabase = getSupabase();

    // Query recent entries and filter for active timer (endTime is null) in JavaScript
    // This avoids issues with the .is("endTime", null) filter in some Supabase configurations
    const { data, error } = await supabase
        .from("TimeEntry")
        .select(`
            *,
            task:Task(id, title)
        `)
        .eq("userId", userId)
        .order("startTime", { ascending: false })
        .limit(10);

    if (error) throw error;

    // Find the active timer (entry without endTime)
    const activeTimer = (data || []).find(entry => entry.endTime === null);
    return activeTimer as TimeEntry | null;
}

// Get time entries for a user in a date range
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
        .order("startTime", { ascending: false });

    if (startDate) {
        query = query.gte("startTime", startDate.toISOString());
    }
    if (endDate) {
        query = query.lte("startTime", endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as TimeEntry[];
}

// Get total hours for a user in a date range (returns hours, not seconds)
export async function getUserTotalHours(
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("TimeEntry")
        .select("duration")
        .eq("userId", userId)
        .gte("startTime", startDate.toISOString())
        .lte("startTime", endDate.toISOString())
        .not("endTime", "is", null); // Only count completed entries

    if (error) throw error;

    const totalSeconds = (data || []).reduce((acc, entry) => acc + (entry.duration || 0), 0);
    return totalSeconds / 3600; // Convert seconds to hours
}

// Get weekly hours for a user (current week)
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
