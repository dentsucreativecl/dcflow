"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/client";


const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Inicio",
  settings: "Configuración",
  projects: "Proyectos",
  tasks: "Tareas",
  "my-tasks": "Mis Tareas",
  inbox: "Bandeja de Entrada",
  reports: "Reportes",
  time: "Tiempo",
  docs: "Documentos",
  channels: "Canales",
  dm: "Mensajes Directos",
  calendar: "Calendario",
  team: "Equipo",
  clients: "Clientes",
  lists: "Proyectos",
  spaces: "Espacios",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Breadcrumbs() {
  const pathname = usePathname();
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!pathname) return;

    const segments = pathname.split("/").filter(Boolean);
    // Resolve both UUID segments AND slug-based IDs in known contexts (lists, spaces, team)
    const toResolve: Array<{ id: string; context: string }> = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const context = segments[i - 1] || "";
      if (UUID_RE.test(seg) || context === "lists" || context === "spaces") {
        toResolve.push({ id: seg, context });
      }
    }

    if (toResolve.length === 0) return;

    async function resolveNames() {
      const supabase = createClient();
      const resolved: Record<string, string> = {};

      for (const { id, context } of toResolve) {
        if (context === "lists") {
          const { data } = await supabase.from("List").select("name").eq("id", id).single() as unknown as { data: { name: string } | null };
          if (data?.name) resolved[id] = data.name;
        } else if (context === "spaces") {
          const { data } = await supabase.from("Space").select("name").eq("id", id).single() as unknown as { data: { name: string } | null };
          if (data?.name) resolved[id] = data.name;
        } else if (UUID_RE.test(id) && context === "team") {
          const { data } = await supabase.from("User").select("name").eq("id", id).single() as unknown as { data: { name: string } | null };
          if (data?.name) resolved[id] = data.name;
        }
      }

      if (Object.keys(resolved).length > 0) {
        setResolvedNames(prev => ({ ...prev, ...resolved }));
      }
    }

    resolveNames();
  }, [pathname]);

  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs: Array<{ label: string; href?: string }> = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += "/" + seg;

    const context = segments[i - 1] || "";
    let label: string;
    if (resolvedNames[seg]) {
      label = resolvedNames[seg];
    } else if (UUID_RE.test(seg) || context === "lists" || context === "spaces") {
      label = "...";
    } else {
      label = ROUTE_LABELS[seg] || seg.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }

    if (i < segments.length - 1) {
      crumbs.push({ label, href: currentPath });
    } else {
      crumbs.push({ label });
    }
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link href="/dashboard" className="hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((crumb, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
