"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, ExternalLink, Video, Mail } from "lucide-react";

interface OutlookTask {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string | null;
}

function generateICS(tasks: OutlookTask[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DC Flow//Tasks//ES"];
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = new Date(t.dueDate);
    const dtStr = d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push("BEGIN:VEVENT");
    lines.push("DTSTART:" + dtStr);
    lines.push("DTEND:" + dtStr);
    lines.push("SUMMARY:" + (t.title || "Tarea"));
    lines.push("DESCRIPTION:" + (t.description || ""));
    lines.push("STATUS:" + (t.priority || "NORMAL"));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function OutlookIntegration({ tasks }: { tasks: OutlookTask[] }) {
  const [exported, setExported] = useState(false);

  const exportToICS = () => {
    const ics = generateICS(tasks);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dcflow-tareas.ics";
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const openOutlookWeb = () => {
    window.open("https://outlook.office.com/calendar", "_blank");
  };

  const openTeams = () => {
    window.open("https://teams.microsoft.com", "_blank");
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-foreground">Integración Microsoft</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Exporta tus tareas al calendario de Outlook o sincroniza con Teams.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportToICS} className="gap-2">
          <Download className="h-4 w-4" />
          {exported ? "✓ Exportado" : "Exportar .ICS"}
        </Button>
        <Button variant="outline" size="sm" onClick={openOutlookWeb} className="gap-2">
          <Mail className="h-4 w-4" />
          Outlook Web
        </Button>
        <Button variant="outline" size="sm" onClick={openTeams} className="gap-2">
          <Video className="h-4 w-4" />
          Teams
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Descarga el archivo .ICS e impórtalo en tu calendario de Outlook. Las tareas con fecha límite se agregarán como eventos.
      </p>
    </Card>
  );
}
