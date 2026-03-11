"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    MessageSquare,
    UserPlus,
    AlertCircle,
    CheckCircle,
    AtSign,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

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

interface NotificationItemProps {
    notification: Notification;
    onMarkAsRead: (id: string) => void;
    onClose?: () => void;
}

const iconMap: Record<string, any> = {
    MENTION: AtSign,
    TASK_ASSIGNED: UserPlus,
    TASK_UPDATED: AlertCircle,
    TASK_COMPLETED: CheckCircle,
    COMMENT_ADDED: MessageSquare,
};

import { useAppStore } from "@/lib/store";

export function NotificationItem({
    notification,
    onMarkAsRead,
    onClose,
}: NotificationItemProps) {
    const router = useRouter();
    const { openModal } = useAppStore();
    const Icon = iconMap[notification.type] || MessageSquare;

    const handleClick = () => {
        if (!notification.isRead) {
            onMarkAsRead(notification.id);
        }

        if (notification.type === "MENTION") {
            // New notifications have data.channelSlug
            const channelSlug = notification.data?.channelSlug as string | undefined;
            // Fallback: parse "#canal-name" from title like "X te mencionó en #canal-name"
            const fallbackSlug = !channelSlug
                ? notification.title.match(/#([\w-]+)/)?.[1]
                : undefined;
            const slug = channelSlug ?? fallbackSlug;
            if (slug) {
                router.push(`/channels/${slug}`);
                onClose?.();
            }
        } else if (notification.entityType === "task" && notification.entityId) {
            openModal("task-detail-v2", { taskId: notification.entityId });
            onClose?.();
        }
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                !notification.isRead && "bg-primary/5"
            )}
        >
            <div className="flex gap-3">
                {/* Actor Avatar */}
                {notification.actor && (
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white text-xs">
                            {notification.actor.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                )}

                <div className="flex-1 space-y-1">
                    {/* Title */}
                    <div className="flex items-start justify-between gap-2">
                        <p
                            className={cn(
                                "text-sm",
                                !notification.isRead && "font-medium"
                            )}
                        >
                            {notification.title}
                        </p>
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>

                    {/* Message */}
                    {notification.message && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                        </p>
                    )}

                    {/* Time */}
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: es,
                        })}
                    </p>
                </div>

                {/* Unread indicator */}
                {!notification.isRead && (
                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
            </div>
        </div>
    );
}
