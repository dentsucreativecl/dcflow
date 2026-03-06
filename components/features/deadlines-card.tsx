"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Deadline {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  list: { name: string } | null;
}

const priorityLabels: Record<string, string> = { URGENT: "urgente", HIGH: "alta", NORMAL: "normal", LOW: "baja" };
const priorityColors: Record<string, "error" | "warning" | "secondary"> = { URGENT: "error", HIGH: "error", NORMAL: "warning", LOW: "secondary" };
const priorityBg: Record<string, string> = { URGENT: "bg-studio-error/20", HIGH: "bg-studio-error/20", NORMAL: "bg-secondary", LOW: "bg-secondary" };
const priorityIcon: Record<string, string> = { URGENT: "text-studio-error", HIGH: "text-studio-error", NORMAL: "text-muted-foreground", LOW: "text-muted-foreground" };

export function DeadlinesCard() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    async function fetchDeadlines() {
      const supabase = createClient();
      const { data } = await supabase.from("Task")
        .select("id, title, dueDate, priority, list:List(name)")
        .not("dueDate", "is", null)
        .gte("dueDate", new Date().toISOString())
        .order("dueDate", { ascending: true }).limit(8);
      if (data) {
        setDeadlines(data.map(d => ({ ...d, list: Array.isArray(d.list) ? d.list[0] : d.list })));
      }
    }
    fetchDeadlines();
  }, []);

    const [expanded, setExpanded] = useState(false);
  const MAX_ITEMS = 5;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3">
        <CardTitle className="text-sm font-semibold">Próximas Fechas Límite</CardTitle>
        <button onClick={() => setExpanded(e => !e)} className="text-xs font-medium text-primary hover:underline">{expanded ? "Menos" : "Ver Todo"}</button>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="p-0">
          {deadlines.slice(0, expanded ? deadlines.length : MAX_ITEMS).map((d) => (
            <div key={d.id} className="flex items-center gap-3 pl-4 pr-6 py-2.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${priorityBg[d.priority] || "bg-secondary"}`}>
                <Calendar className={`h-4 w-4 ${priorityIcon[d.priority] || "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">{d.list?.name || ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(d.dueDate), "d MMM", { locale: es })}
                </span>
                <Badge variant={priorityColors[d.priority] || "secondary"} className="text-[10px] h-5">
                  {priorityLabels[d.priority] || d.priority}
                </Badge>
              </div>
            </div>
          ))}
          {deadlines.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sin fechas próximas</p>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}