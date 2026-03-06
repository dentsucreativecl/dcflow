"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  MessageSquare,
  FileText,
  Upload,
  Edit,
  Plus,
  Trash2,
  Clock,
  User,
  GitBranch,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

interface ProjectActivityTabProps {
  projectId: string;
}

// Mock activity data
const getActivityData = (projectId: string) => [
  {
    id: "a-1",
    type: "task_completed",
    user: { name: "Sarah Chen", avatar: "SC" },
    action: "completed",
    target: "Design homepage mockup",
    timestamp: "2024-03-03T14:30:00",
    icon: CheckCircle2,
    iconColor: "text-studio-success",
    iconBg: "bg-studio-success/20",
  },
  {
    id: "a-2",
    type: "comment",
    user: { name: "Mike Johnson", avatar: "MJ" },
    action: "commented on",
    target: "Implement navigation component",
    timestamp: "2024-03-03T13:15:00",
    content: "I'll need the design specs for the mobile menu. @Sarah can you share those?",
    icon: MessageSquare,
    iconColor: "text-studio-info",
    iconBg: "bg-studio-info/20",
  },
  {
    id: "a-3",
    type: "file_uploaded",
    user: { name: "Rachel Green", avatar: "RG" },
    action: "uploaded",
    target: "Brand Guidelines v2.pdf",
    timestamp: "2024-03-03T11:45:00",
    icon: Upload,
    iconColor: "text-primary",
    iconBg: "bg-primary/20",
  },
  {
    id: "a-4",
    type: "task_created",
    user: { name: "John Doe", avatar: "JD" },
    action: "created task",
    target: "API integration",
    timestamp: "2024-03-03T10:20:00",
    icon: Plus,
    iconColor: "text-studio-success",
    iconBg: "bg-studio-success/20",
  },
  {
    id: "a-5",
    type: "task_updated",
    user: { name: "Emily Davis", avatar: "ED" },
    action: "updated status to In Progress on",
    target: "User research interviews",
    timestamp: "2024-03-03T09:00:00",
    icon: Edit,
    iconColor: "text-studio-warning",
    iconBg: "bg-studio-warning/20",
  },
  {
    id: "a-6",
    type: "time_logged",
    user: { name: "Lisa Park", avatar: "LP" },
    action: "logged 4 hours on",
    target: "Implement navigation component",
    timestamp: "2024-03-02T17:30:00",
    icon: Clock,
    iconColor: "text-muted-foreground",
    iconBg: "bg-secondary",
  },
  {
    id: "a-7",
    type: "member_added",
    user: { name: "John Doe", avatar: "JD" },
    action: "added",
    target: "Alex Rivera to the project",
    timestamp: "2024-03-02T14:00:00",
    icon: User,
    iconColor: "text-primary",
    iconBg: "bg-primary/20",
  },
  {
    id: "a-8",
    type: "comment",
    user: { name: "David Kim", avatar: "DK" },
    action: "commented on",
    target: "Brand guidelines document",
    timestamp: "2024-03-02T11:30:00",
    content: "The color palette looks great! Let's proceed with these choices.",
    icon: MessageSquare,
    iconColor: "text-studio-info",
    iconBg: "bg-studio-info/20",
  },
];

export function ProjectActivityTab({ projectId }: ProjectActivityTabProps) {
  const activities = getActivityData(projectId);

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = format(new Date(activity.timestamp), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, typeof activities>);

  return (
    <div className="space-y-6">
      {/* Add Comment */}
      <Card className="p-4">
        <Textarea
          placeholder="Write a comment or update..."
          rows={3}
          className="resize-none mb-3"
        />
        <div className="flex justify-end">
          <Button>Post Update</Button>
        </div>
      </Card>

      {/* Activity Feed */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-6">Recent Activity</h3>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center relative z-10">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {format(new Date(date), "EEEE, MMMM d")}
                  </span>
                </div>

                {/* Activities for this date */}
                {dayActivities.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div
                      key={activity.id}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      {/* Icon */}
                      <div
                        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${activity.iconBg}`}
                      >
                        <Icon className={`h-4 w-4 ${activity.iconColor}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                              {activity.user.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground text-sm">
                            {activity.user.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {activity.action}
                          </span>
                          <span className="font-medium text-foreground text-sm">
                            {activity.target}
                          </span>
                        </div>

                        {/* Comment content */}
                        {activity.content && (
                          <div className="mt-2 rounded-lg bg-secondary p-3">
                            <p className="text-sm text-foreground">
                              {activity.content}
                            </p>
                          </div>
                        )}

                        {/* Timestamp */}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Load More */}
        <div className="mt-6 text-center">
          <Button variant="outline">Load More Activity</Button>
        </div>
      </Card>
    </div>
  );
}
