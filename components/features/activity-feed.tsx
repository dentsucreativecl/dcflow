"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-primary", "bg-amber-500", "bg-cyan-500"];

const actionLabels: Record<string, string> = {
  CREATED: "creó",
  STATUS_CHANGE: "cambió el estado de",
  COMMENT: "comentó en",
  COMMENT_ADDED: "comentó en",
  ASSIGNMENT: "fue asignado a",
  STATUS_CHANGED: "cambió el estado de",
  PRIORITY_CHANGE: "cambió la prioridad de",
};

interface RealActivity {
  id: string;
  type: string;
  field: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<RealActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      const supabase = createClient();
      const { data } = await supabase.from("Activity")
        .select("id, type, field, createdAt, user:User(id, name), task:Task(id, title)")
        .order("createdAt", { ascending: false }).limit(10);
      if (data) {
        setActivities(data.map(a => ({
          ...a,
          user: Array.isArray(a.user) ? a.user[0] : a.user,
          task: Array.isArray(a.task) ? a.task[0] : a.task
        })));
      }
      setLoading(false);
    }
    fetchActivities();
  }, []);

  const [expanded, setExpanded] = useState(false);
  const MAX_ITEMS = 4;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
        <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
        <button className="text-sm font-medium text-primary hover:underline" onClick={() => setExpanded(e => !e)}>{expanded ? "Ver Menos" : "Ver Todo"}</button>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="p-0">
          {activities.length > 0 ? activities.slice(0, expanded ? activities.length : MAX_ITEMS).map((act, index) => (
            <div key={act.id} className="flex gap-3 px-5 py-3">
              <Avatar className={`h-9 w-9 ${avatarColors[index % avatarColors.length]}`}>
                <AvatarFallback className="text-white text-sm font-medium">
                  {act.user?.name?.substring(0, 2).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="text-sm">
                  <span className="font-medium text-foreground">{act.user?.name}</span>{" "}
                  <span className="text-muted-foreground">{actionLabels[act.type] || act.type}</span>{" "}
                  <span className="font-medium text-foreground">{act.task?.title}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true, locale: es })}
                </p>
              </div>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin actividad reciente
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
