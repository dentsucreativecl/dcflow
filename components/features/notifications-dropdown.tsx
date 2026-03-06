"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CheckCircle2, MessageSquare, Clock, AlertTriangle, Settings, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationData {
  id: string; type: string; title: string; message: string | null;
  isRead: boolean; createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

const getIcon = (type: string) => {
  switch (type) {
    case "ASSIGNMENT": return <UserPlus className="h-4 w-4 text-studio-info" />;
    case "COMMENT": return <MessageSquare className="h-4 w-4 text-studio-info" />;
    case "STATUS_CHANGE": return <CheckCircle2 className="h-4 w-4 text-studio-success" />;
    case "DUE_DATE": return <AlertTriangle className="h-4 w-4 text-studio-warning" />;
    default: return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    async function fetchNotifications() {
      const supabase = createClient();
      const { data } = await supabase.from("Notification")
        .select("id, type, title, message, isRead, createdAt, actor:User!Notification_actorId_fkey(id, name, avatarUrl)")
        .order("createdAt", { ascending: false }).limit(20);
      if (data) setNotifications(data.map(n => ({ ...n, actor: Array.isArray(n.actor) ? n.actor[0] : n.actor })));
    }
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from("Notification").update({ isRead: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = async () => {
    const supabase = createClient();
    const ids = notifications.filter(n => !n.isRead).map(n => n.id);
    if (ids.length > 0) await supabase.from("Notification").update({ isRead: true }).in("id", ids);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-studio-error text-[10px] font-medium text-white">{unreadCount}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Notificaciones</h3>
            {unreadCount > 0 && <Badge variant="secondary" className="h-5 px-1.5">{unreadCount}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                <Check className="h-3 w-3 mr-1" /> Marcar todo leído
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7"><Settings className="h-4 w-4" /></Button>
          </div>
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <button key={n.id} onClick={() => markAsRead(n.id)}
                  className={cn("flex items-start gap-3 w-full p-4 text-left hover:bg-secondary/50 transition-colors", !n.isRead && "bg-primary/5")}>
                  {n.actor ? (
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {n.actor.name?.substring(0, 2).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary flex-shrink-0">{getIcon(n.type)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm truncate", !n.isRead ? "font-medium text-foreground" : "text-muted-foreground")}>{n.title}</p>
                      {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    {n.message && <p className="text-sm text-muted-foreground truncate">{n.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Sin notificaciones aún</p>
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full text-sm">Ver todas las notificaciones</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}