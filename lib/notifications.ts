import { createClient } from "@/lib/supabase/client";

interface TaskUpdateNotificationParams {
  taskId: string;
  taskTitle: string;
  assignedUserIds: string[];
  updatedBy: string;
  updatedByName?: string;
  updateType: "status" | "priority" | "due_date";
  oldValue?: string;
  newValue?: string;
}

interface MentionNotificationParams {
  commentText: string;
  taskId: string;
  actorId: string;
  actorName: string;
}

interface TaskAssignmentNotificationParams {
  userId: string;
  taskId: string;
  taskTitle: string;
  assignedBy: string;
}

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  taskId?: string;
  actorId?: string;
}) {
  try {
    const supabase = createClient();
    await supabase.from("Notification").insert({
      userId: params.userId,
      type: params.type as "MENTION" | "TASK_ASSIGNED" | "STATUS_CHANGED" | "COMMENT_ADDED",
      title: params.title,
      message: params.message || null,
      taskId: params.taskId || null,
      actorId: params.actorId || null,
      isRead: false,
    });
  } catch {
    // Notifications are non-critical — fail silently
  }
}

export async function createMentionNotifications(params: MentionNotificationParams) {
  try {
    // Extract @mentions from comment text (pattern: @username)
    const mentionPattern = /@(\w+)/g;
    const mentions = params.commentText.match(mentionPattern);
    if (!mentions || mentions.length === 0) return;

    const supabase = createClient();

    // Look up mentioned users by name
    const mentionNames = mentions.map(m => m.slice(1)); // remove @
    const { data: users } = await supabase
      .from("User")
      .select("id, name")
      .in("name", mentionNames);

    if (!users || users.length === 0) return;

    const notifications = users.map(user => ({
      userId: user.id,
      type: "MENTION" as const,
      title: `${params.actorName} te mencionó en un comentario`,
      message: params.commentText.slice(0, 200),
      taskId: params.taskId,
      actorId: params.actorId,
      isRead: false,
    }));

    await supabase.from("Notification").insert(notifications);
  } catch {
    // Notifications are non-critical — fail silently
  }
}

export async function createTaskAssignmentNotification(params: TaskAssignmentNotificationParams) {
  try {
    const supabase = createClient();
    await supabase.from("Notification").insert({
      userId: params.userId,
      type: "TASK_ASSIGNED" as const,
      title: `Te asignaron la tarea "${params.taskTitle}"`,
      taskId: params.taskId,
      actorId: params.assignedBy,
      isRead: false,
    });
  } catch {
    // Notifications are non-critical — fail silently
  }
}

export async function createTaskUpdateNotification(params: TaskUpdateNotificationParams) {
  try {
    if (params.assignedUserIds.length === 0) return;

    const actor = params.updatedByName || "Alguien";

    const updateTitles: Record<string, string> = {
      status: `${actor} cambió el estado de "${params.taskTitle}"`,
      priority: `${actor} cambió la prioridad de "${params.taskTitle}"`,
      due_date: `${actor} cambió la fecha de "${params.taskTitle}"`,
    };

    const updateMessages: Record<string, string | undefined> = {
      status: params.oldValue && params.newValue ? `${params.oldValue} → ${params.newValue}` : params.newValue,
      priority: params.oldValue && params.newValue ? `${params.oldValue} → ${params.newValue}` : params.newValue,
      due_date: params.newValue,
    };

    const notifType = params.updateType === "status"
      ? "STATUS_CHANGED" as const
      : params.updateType === "priority"
      ? "PRIORITY_CHANGED" as const
      : "DUE_DATE_CHANGED" as const;

    const supabase = createClient();
    const notifications = params.assignedUserIds
      .filter(id => id !== params.updatedBy) // Don't notify the person who made the change
      .map(userId => ({
        userId,
        type: notifType,
        title: updateTitles[params.updateType],
        message: updateMessages[params.updateType] || null,
        taskId: params.taskId,
        actorId: params.updatedBy,
        isRead: false,
      }));

    if (notifications.length > 0) {
      await supabase.from("Notification").insert(notifications);
    }
  } catch {
    // Notifications are non-critical — fail silently
  }
}
