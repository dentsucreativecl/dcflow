"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./notification-item";

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

interface NotificationListProps {
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onClose?: () => void;
}

export function NotificationList({
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onClose,
}: NotificationListProps) {
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Notificaciones</h3>
                {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
                        Marcar todas como leídas
                    </Button>
                )}
            </div>

            {/* List */}
            <ScrollArea className="h-[400px]">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No tienes notificaciones
                    </div>
                ) : (
                    <div className="divide-y">
                        {notifications.map((notification) => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onMarkAsRead={onMarkAsRead}
                                onClose={onClose}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
