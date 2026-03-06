"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";

interface HoursData {
  logged: number;
  target: number;
  byProject: { project: string; hours: number }[];
}

export function HoursCard() {
  const { openModal } = useAppStore();
  const { user } = useAuth();
  const [data, setData] = useState<HoursData>({ logged: 0, target: 40, byProject: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeeklyHours() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const supabase = createClient();

      try {
        // Calculate start and end of current week
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Fetch completed time entries for this week
        const { data: timeEntries, error } = await supabase
          .from("TimeEntry")
          .select(`
            duration,
            task:Task(
              id,
              list:List(
                id,
                name
              )
            )
          `)
          .eq("userId", user.id)
          .gte("startTime", startOfWeek.toISOString())
          .lte("startTime", endOfWeek.toISOString())
          .not("endTime", "is", null);

        if (error) {
          setLoading(false);
          return;
        }

        // Calculate total hours and group by project/list
        const projectHours: Record<string, number> = {};
        let totalSeconds = 0;

        for (const entry of timeEntries || []) {
          const duration = entry.duration || 0;
          totalSeconds += duration;

          const task = entry.task as { list?: { name?: string } } | null;
          const listName = task?.list?.name || "Sin lista";
          projectHours[listName] = (projectHours[listName] || 0) + duration;
        }

        const byProject = Object.entries(projectHours)
          .map(([project, seconds]) => ({
            project,
            hours: Math.round(seconds / 3600),
          }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 3);

        setData({
          logged: Math.round(totalSeconds / 3600),
          target: 40,
          byProject,
        });
      } catch (err) {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchWeeklyHours();
  }, [user?.id]);

  const percentComplete = data.target > 0
    ? Math.round((data.logged / data.target) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3">
        <CardTitle className="text-sm font-semibold">
          Mis Horas Esta Semana
        </CardTitle>
        <Button
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={() => openModal("log-time")}
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar Tiempo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-semibold text-foreground">
                  {data.logged}h
                </span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  / {data.target}h
                </span>
              </div>
              <span className="text-sm font-medium text-primary">
                {percentComplete}%
              </span>
            </div>

            <Progress
              value={percentComplete}
              className="h-2"
              indicatorClassName="bg-primary"
            />

            <div className="space-y-2">
              {data.byProject.length > 0 ? (
                data.byProject.map((item) => (
                  <div key={item.project} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {item.project}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {item.hours}h
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Sin registros esta semana
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
