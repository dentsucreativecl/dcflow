"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Loader2,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { getProgressColor } from "@/lib/utils";

interface ProjectBudgetTabProps {
  projectId: string;
}

interface MemberHours {
  name: string;
  initials: string;
  hours: number;
}

export function ProjectBudgetTab({ projectId }: ProjectBudgetTabProps) {
  const [loading, setLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);
  const [estimatedHours, setEstimatedHours] = useState(0);
  const [memberHours, setMemberHours] = useState<MemberHours[]>([]);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    // Get task IDs and estimated hours
    const { data: taskData } = await supabase
      .from("Task")
      .select("id, estimatedHours")
      .eq("listId", projectId);

    if (!taskData || taskData.length === 0) {
      setLoading(false);
      return;
    }

    const ids = taskData.map((t) => t.id);
    const totalEstimated = taskData.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
    setEstimatedHours(Math.round(totalEstimated * 10) / 10);

    // Fetch time entries with user info
    const { data: timeData } = await supabase
      .from("TimeEntry")
      .select("hours, User:userId(id, name)")
      .in("taskId", ids);

    if (!timeData) {
      setLoading(false);
      return;
    }

    // Calculate totals
    const total = timeData.reduce((acc: number, te: any) => acc + (te.hours || 0), 0);
    setTotalHours(Math.round(total * 10) / 10);

    // Group by member
    const byMember = new Map<string, { name: string; hours: number }>();
    timeData.forEach((te: any) => {
      const user = Array.isArray(te.User) ? te.User[0] : te.User;
      if (!user) return;
      const existing = byMember.get(user.id) || { name: user.name, hours: 0 };
      existing.hours += te.hours || 0;
      byMember.set(user.id, existing);
    });

    const members: MemberHours[] = Array.from(byMember.values())
      .map((m) => ({
        name: m.name,
        initials: m.name.split(" ").map((n) => n[0]).join("").slice(0, 2),
        hours: Math.round(m.hours * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours);

    setMemberHours(members);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hoursPercent = estimatedHours > 0
    ? Math.min(Math.round((totalHours / estimatedHours) * 100), 100)
    : 0;
  const isOverEstimate = totalHours > estimatedHours && estimatedHours > 0;

  return (
    <div className="space-y-6">
      {/* Hours Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-info/20">
              <Clock className="h-5 w-5 text-studio-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horas Registradas</p>
              <p className="text-xl font-semibold text-foreground">
                {totalHours}h
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horas Estimadas</p>
              <p className="text-xl font-semibold text-foreground">
                {estimatedHours}h
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-warning/20">
              <Users className="h-5 w-5 text-studio-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Miembros</p>
              <p className="text-xl font-semibold text-foreground">
                {memberHours.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Hours Progress */}
      {estimatedHours > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Uso de Horas</h3>
            {isOverEstimate && (
              <span className="text-xs text-studio-error font-medium">
                Excede estimación
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {totalHours}h registradas
              </span>
              <span className="text-foreground font-medium">{hoursPercent}%</span>
            </div>
            <Progress
              value={hoursPercent}
              className="h-3"
              indicatorClassName={
                isOverEstimate ? "bg-studio-error" : getProgressColor(100 - hoursPercent)
              }
            />
          </div>
        </Card>
      )}

      {/* Team Hours Breakdown */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">Horas por Miembro</h3>
        {memberHours.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin horas registradas
          </p>
        ) : (
          <div className="space-y-4">
            {memberHours.map((member) => (
              <div
                key={member.name}
                className="flex items-center gap-4 rounded-lg border border-border p-4"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{member.name}</span>
                    <span className="text-foreground font-semibold">
                      {member.hours}h
                    </span>
                  </div>
                  {totalHours > 0 && (
                    <Progress
                      value={Math.round((member.hours / totalHours) * 100)}
                      className="h-1.5"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
