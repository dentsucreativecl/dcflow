"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import { Inbox, CheckCircle2, MessageSquare, FileText, Clock, AlertTriangle, User, Bell, ArrowRight, Paperclip, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  userName: string;
  userInitials: string;
  taskId?: string;
  listId?: string;
}

const getIcon = (type: string) => {
  switch (type) {
    case "STATUS_CHANGED": return <ArrowRight className="h-4 w-4 text-blue-500" />;
    case "COMMENT_ADDED": return <MessageSquare className="h-4 w-4 text-green-500" />;
    case "CREATED": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "ASSIGNED": return <User className="h-4 w-4 text-purple-500" />;
    case "DUE_DATE_CHANGED": return <Clock className="h-4 w-4 text-orange-500" />;
    case "PRIORITY_CHANGED": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "ATTACHMENT_ADDED": return <Paperclip className="h-4 w-4 text-gray-500" />;
    case "DESCRIPTION_UPDATED": return <Edit3 className="h-4 w-4 text-gray-500" />;
    default: return <Bell className="h-4 w-4 text-gray-400" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "STATUS_CHANGED": return "Cambio de estado";
    case "COMMENT_ADDED": return "Comentario";
    case "CREATED": return "Tarea creada";
    case "ASSIGNED": return "Asignación";
    case "UNASSIGNED": return "Sin asignar";
    case "DUE_DATE_CHANGED": return "Fecha límite";
    case "PRIORITY_CHANGED": return "Prioridad";
    case "ATTACHMENT_ADDED": return "Adjunto";
    case "DESCRIPTION_UPDATED": return "Descripción";
    default: return type;
  }
};

export default function InboxPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const router = useRouter();
  const { openModal } = useAppStore();
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    const fetchNotifications = async () => {
      try {
        const supabase = createClient();

        const { data: activities, error } = await supabase
          .from("Activity")
          .select("id, type, field, oldValue, newValue, createdAt, taskId, task:Task(id, title, listId), user:User(id, name)")
          .order("createdAt", { ascending: false })
          .limit(30);

        if (error) {
          console.error("Error fetching notifications:", error);
          return;
        }

        if (activities) {
          const mapped: NotificationItem[] = activities.map((a: Record<string, unknown>) => {
            const userObj = a.user as Record<string, unknown> | null;
            const taskObj = a.task as Record<string, unknown> | null;
            const userName = (userObj?.name as string) || "Usuario";
            const initials = userName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
            let desc = "";
            const taskTitle = (taskObj?.title as string) || "tarea";
            const aType = a.type as string;
            const aNewValue = a.newValue as string | null;
            if (aType === "STATUS_CHANGED") {
              desc = userName + " cambio el estado de " + taskTitle + (aNewValue ? " a " + aNewValue : "");
            } else if (aType === "COMMENT_ADDED") {
              desc = userName + " comento en " + taskTitle;
            } else if (aType === "CREATED") {
              desc = userName + " creo " + taskTitle;
            } else if (aType === "ASSIGNED") {
              desc = userName + " asigno " + taskTitle + (aNewValue ? " a " + aNewValue : "");
            } else if (aType === "DUE_DATE_CHANGED") {
              desc = userName + " cambio la fecha de " + taskTitle;
            } else if (aType === "PRIORITY_CHANGED") {
              desc = userName + " cambio la prioridad de " + taskTitle + (aNewValue ? " a " + aNewValue : "");
            } else if (aType === "ATTACHMENT_ADDED") {
              desc = userName + " adjunto un archivo en " + taskTitle;
            } else {
              desc = userName + " actualizo " + taskTitle;
            }

            return {
              id: a.id as string,
              type: aType,
              title: getTypeLabel(aType),
              description: desc,
              timestamp: a.createdAt as string,
              read: false,
              userName: userName,
              userInitials: initials,
              taskId: a.taskId as string | undefined,
              listId: (taskObj?.listId as string) || undefined,
            };
          });
          setItems(mapped);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [refreshKey]);

  const filteredItems = filter === "unread" ? items.filter((i) => !i.read) : items;
  const unreadCount = items.filter((i) => !i.read).length;

  const markAsRead = (id: string) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item));
  };

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Inbox className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Bandeja de Entrada</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="rounded-full">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todas
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("unread")}
            >
              No leidas
            </Button>
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Marcar todas leidas
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3" />
            Cargando notificaciones...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No hay notificaciones</p>
            <p className="text-sm">Cuando haya actividad en tus proyectos, aparecera aqui.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors hover:bg-accent",
                  !item.read && "bg-accent/50 border-l-2 border-primary"
                )}
                onClick={() => {
                  markAsRead(item.id);
                  if (item.taskId && item.listId) {
                    router.push(`/lists/${item.listId}/?task=${item.taskId}`);
                  } else if (item.taskId) {
                    openModal("task-detail-v2", { taskId: item.taskId });
                  }
                }}
              >
                <Avatar className="h-9 w-9 mt-0.5">
                  <AvatarFallback className="text-xs">{item.userInitials}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {getIcon(item.type)}
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{getTypeLabel(item.type)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: es })}
                  </p>
                </div>

                {!item.read && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}