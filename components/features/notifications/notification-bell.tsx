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
    read: boolean;
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

        // Realtime subscription
        const supabase = createClient();

        const channel = supabase
            .channel(`user-${userId}-notifications`)
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
                        new Notification("DC Flow", {
                            body: newNotif.title,
                            icon: "/img/dc-ico.png"
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const fetchNotifications = async () => {
        const supabase = createClient();

        try {
            const { data } = await supabase
                .from("Notification")
                .select(`
                    *,
                    actor:User!actorId(id, name, avatarUrl)
                `)
                .eq("userId", userId)
                .order("createdAt", { ascending: false })
                .limit(20);

            if (data) {
                setNotifications(data as unknown as Notification[]);
                setUnreadCount(data.filter((n) => !n.read).length);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const markAsRead = async (notificationId: string) => {
        const supabase = createClient();

        await supabase
            .from("Notification")
            .update({ read: true })
            .eq("id", notificationId);

        fetchNotifications();
    };

    const markAllAsRead = async () => {
        const supabase = createClient();

        await supabase
            .from("Notification")
            .update({ read: true })
            .eq("userId", userId)
            .eq("read", false);

        fetchNotifications();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-slate-300 hover:text-white hover:bg-white/10">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold bg-red-500 border-2 border-slate-900"
                        >
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
                <NotificationList
                    notifications={notifications}
                    onMarkAsRead={markAsRead}
                    onMarkAllAsRead={markAllAsRead}
                />
            </PopoverContent>
        </Popover>
    );
}
