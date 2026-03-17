"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationList } from "./notification-list";
import { createClient } from "@/lib/supabase/client";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string | null;
    isRead: boolean;
    data?: Record<string, unknown> | null;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
    actor: {
        id: string;
        name: string;
        avatarUrl: string | null;
    } | null;
}

interface NotificationBellProps {
    userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // Request browser notification permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        fetchNotifications();

        // Realtime subscription with reconnection on error
        const supabase = createClient();
        let retryTimer: ReturnType<typeof setTimeout>;

        const subscribe = () => supabase
            .channel(`user-${userId}-notifications-${Date.now()}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "Notification",
                    filter: `userId=eq.${userId}`,
                },
                (payload) => {
                    fetchNotifications();

                    // Show browser notification
                    if (
                        "Notification" in window &&
                        Notification.permission === "granted" &&
                        payload.eventType === "INSERT"
                    ) {
                        const newNotif = payload.new as Notification;
                        new window.Notification("DC Flow", {
                            body: newNotif.title,
                            icon: "/img/dc-ico.png"
                        });
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR') {
                    console.warn('Realtime error:', err?.message || JSON.stringify(err) || 'unknown error');
                    supabase.removeChannel(ch);
                    retryTimer = setTimeout(() => { ch = subscribe(); }, 3000);
                }
            });

        let ch = subscribe();

        // Fallback polling every 30s in case Realtime is down
        const interval = setInterval(fetchNotifications, 30000);

        // Re-fetch on visibility refresh (tab coming back from inactivity)
        const refreshHandler = () => fetchNotifications();
        window.addEventListener("dcflow:refresh", refreshHandler);

        return () => {
            clearTimeout(retryTimer);
            supabase.removeChannel(ch);
            clearInterval(interval);
            window.removeEventListener("dcflow:refresh", refreshHandler);
        };
    }, [userId]);

    const fetchNotifications = async () => {
        const supabase = createClient();

        try {
            const { data, error } = await supabase
                .from("Notification")
                .select(`
                    id, type, title, message, isRead, data, createdAt,
                    actor:User!Notification_actorId_fkey(id, name, avatarUrl)
                `)
                .eq("userId", userId)
                .order("createdAt", { ascending: false })
                .limit(20);

            if (error) {
                console.error("Error fetching notifications:", error.message, error.details, error.hint);
                return;
            }

            if (data) {
                setNotifications(data as unknown as Notification[]);
                setUnreadCount(data.filter((n) => !n.isRead).length);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const markAsRead = async (notificationId: string) => {
        const supabase = createClient();

        await supabase
            .from("Notification")
            .update({ isRead: true })
            .eq("id", notificationId);

        fetchNotifications();
    };

    const markAllAsRead = async () => {
        const supabase = createClient();

        await supabase
            .from("Notification")
            .update({ isRead: true })
            .eq("userId", userId)
            .eq("isRead", false);

        fetchNotifications();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
                <NotificationList
                    notifications={notifications}
                    onMarkAsRead={markAsRead}
                    onMarkAllAsRead={markAllAsRead}
                    onClose={() => setOpen(false)}
                />
            </PopoverContent>
        </Popover>
    );
}
