"use client";

import { useState, useEffect, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  MessageSquare,
  Upload,
  Edit,
  Plus,
  Clock,
  User,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

interface ProjectActivityTabProps {
  projectId: string;
}

interface ActivityRow {
  id: string;
  type: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { name: string; avatarUrl: string | null } | null;
  task: { title: string } | null;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case "CREATED":
      return { icon: Plus, color: "text-studio-success", bg: "bg-studio-success/20" };
    case "STATUS_CHANGED":
      return { icon: Edit, color: "text-studio-warning", bg: "bg-studio-warning/20" };
    case "ASSIGNED":
    case "UNASSIGNED":
      return { icon: User, color: "text-primary", bg: "bg-primary/20" };
    case "COMMENT_ADDED":
      return { icon: MessageSquare, color: "text-studio-info", bg: "bg-studio-info/20" };
    case "ATTACHMENT_ADDED":
      return { icon: Upload, color: "text-primary", bg: "bg-primary/20" };
    case "DUE_DATE_CHANGED":
      return { icon: Clock, color: "text-muted-foreground", bg: "bg-secondary" };
    case "PRIORITY_CHANGED":
      return { icon: Edit, color: "text-studio-error", bg: "bg-studio-error/20" };
    default:
      return { icon: Edit, color: "text-muted-foreground", bg: "bg-secondary" };
  }
};

const getActionText = (type: string, field: string | null, oldValue: string | null, newValue: string | null) => {
  switch (type) {
    case "CREATED": return "creó la tarea";
    case "STATUS_CHANGED": return `cambió estado a ${newValue || ""}`;
    case "ASSIGNED": return `asignó a ${newValue || ""}`;
    case "UNASSIGNED": return `desasignó a ${oldValue || ""}`;
    case "COMMENT_ADDED": return "comentó en";
    case "ATTACHMENT_ADDED": return "subió archivo en";
    case "DUE_DATE_CHANGED": return "cambió la fecha límite de";
    case "PRIORITY_CHANGED": return `cambió prioridad a ${newValue || ""}`;
    case "DESCRIPTION_UPDATED": return "actualizó la descripción de";
    default: return "actualizó";
  }
};

export function ProjectActivityTab({ projectId }: ProjectActivityTabProps) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    const supabase = createClient();

    // Get task IDs for this project
    const { data: taskIds } = await supabase
      .from("Task")
      .select("id")
      .eq("listId", projectId);

    if (!taskIds || taskIds.length === 0) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const ids = taskIds.map((t) => t.id);

    const { data } = await supabase
      .from("Activity")
      .select("id, type, field, oldValue, newValue, createdAt, User:userId(name, avatarUrl), Task:taskId(title)")
      .in("taskId", ids)
      .order("createdAt", { ascending: false })
      .limit(20);

    const parsed: ActivityRow[] = (data || []).map((a: any) => ({
      ...a,
      user: Array.isArray(a.User) ? a.User[0] : a.User,
      task: Array.isArray(a.Task) ? a.Task[0] : a.Task,
    }));

    setActivities(parsed);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group by date
  const grouped = activities.reduce((groups, activity) => {
    const date = format(new Date(activity.createdAt), "yyyy-MM-dd");
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityRow[]>);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-6">Actividad Reciente</h3>

        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin actividad registrada
          </p>
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {Object.entries(grouped).map(([date, dayActivities]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center relative z-10">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {format(new Date(date), "EEEE, MMMM d")}
                    </span>
                  </div>

                  {dayActivities.map((activity) => {
                    const { icon: Icon, color, bg } = getActivityIcon(activity.type);
                    const userName = activity.user?.name || "Usuario";
                    const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2);

                    return (
                      <div key={activity.id} className="relative flex gap-4 pb-6 last:pb-0">
                        <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground text-sm">{userName}</span>
                            <span className="text-sm text-muted-foreground">
                              {getActionText(activity.type, activity.field, activity.oldValue, activity.newValue)}
                            </span>
                            {activity.task && (
                              <span className="font-medium text-foreground text-sm">
                                {activity.task.title}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
