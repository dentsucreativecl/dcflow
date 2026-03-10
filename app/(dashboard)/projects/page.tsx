"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  List as ListIcon, Plus, Search, Loader2, FolderOpen,
  Calendar, CheckCircle2, Circle, ArrowUpDown, ArrowUp, ArrowDown,
  User as UserIcon, Users, LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterDropdown } from "@/components/features/filter-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { KanbanBoard, deriveStatus, type KanbanProjectRow } from "@/components/features/kanban-board";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  spaceName: string;
  spaceColor: string;
  folderName: string | null;
  isPitch: boolean;
  pitchResult: string | null;
  totalTasks: number;
  doneTasks: number;
  progress: number;
  dueDate: string | null;
  createdAt: string;
}

type ViewMode = "list" | "kanban";
type SortField = "name" | "dueDate" | "progress";
type SortOrder = "asc" | "desc";

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ProjectsPage() {
  const { openModal } = useAppStore();
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [spaceFilter, setSpaceFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [personListMap, setPersonListMap] = useState<Map<string, Set<string>>>(new Map());
  const [teamListMap, setTeamListMap] = useState<Map<string, Set<string>>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const fetchProjects = useCallback(async () => {
      if (!user) return;
      const supabase = createClient();

      // For non-admin users, get their allowed spaces
      let allowedSpaceIds: string[] | null = null;
      if (!isAdmin) {
        const { data: memberships } = await supabase
          .from("SpaceMember")
          .select("spaceId")
          .eq("userId", user.id);
        if (memberships) {
          allowedSpaceIds = memberships.map(m => m.spaceId);
        }
      }

      // Fetch lists as projects with their space and folder info
      let listQuery = supabase
        .from("List")
        .select(`
          id, name, description, isPitch, pitchResult, createdAt,
          Space(name, color),
          Folder(name)
        `)
        .order("name");

      // Filter by allowed spaces for non-admin users
      if (allowedSpaceIds !== null) {
        listQuery = listQuery.in("spaceId", allowedSpaceIds.length > 0 ? allowedSpaceIds : ["__none__"]);
      }

      const { data: lists } = await listQuery;

      if (!lists) {
        setLoading(false);
        return;
      }

      // Fetch task counts per list
      const { data: tasks } = await supabase
        .from("Task")
        .select("id, listId, Status(type)")
        .is("parentId", null);

      // Build per-list counts and latest due dates
      const tasksByList = new Map<string, { total: number; done: number; latestDue: string | null }>();
      if (tasks) {
        for (const t of tasks as Array<Record<string, unknown>>) {
          const listId = t.listId as string;
          const status = t.Status as Record<string, unknown> | null;
          const statusType = (status?.type as string) || "TODO";

          if (!tasksByList.has(listId)) {
            tasksByList.set(listId, { total: 0, done: 0, latestDue: null });
          }
          const entry = tasksByList.get(listId)!;
          entry.total++;
          if (statusType === "DONE") entry.done++;
        }
      }

      // Fetch latest due date per list
      const { data: dueTasks } = await supabase
        .from("Task")
        .select("listId, dueDate")
        .not("dueDate", "is", null)
        .is("parentId", null)
        .order("dueDate", { ascending: false });

      const latestDueByList = new Map<string, string>();
      if (dueTasks) {
        for (const t of dueTasks) {
          const listId = t.listId as string;
          if (!latestDueByList.has(listId)) {
            latestDueByList.set(listId, t.dueDate as string);
          }
        }
      }

      const mapped: ProjectRow[] = lists.map((l: Record<string, unknown>) => {
        const space = l.Space as Record<string, unknown> | null;
        const folder = l.Folder as Record<string, unknown> | null;
        const listId = l.id as string;
        const counts = tasksByList.get(listId) || { total: 0, done: 0 };
        const progress = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

        return {
          id: listId,
          name: l.name as string,
          description: l.description as string | null,
          spaceName: (space?.name as string) || "General",
          spaceColor: (space?.color as string) || "#666",
          folderName: (folder?.name as string) || null,
          isPitch: l.isPitch as boolean,
          pitchResult: l.pitchResult as string | null,
          totalTasks: counts.total,
          doneTasks: counts.done,
          progress,
          dueDate: latestDueByList.get(listId) || null,
          createdAt: l.createdAt as string,
        };
      });

      setProjects(mapped);

      // Fetch admin filter data (people and teams with task assignments)
      if (isAdmin) {
        const [assignmentsRes, teamsRes, teamMembersRes] = await Promise.all([
          supabase.from("TaskAssignment").select("userId, User(id, name), Task(listId)"),
          supabase.from("Team").select("id, name").order("name"),
          supabase.from("TeamMember").select("teamId, userId"),
        ]);

        // Build person -> listIds map
        const pMap = new Map<string, Set<string>>();
        const peopleMap = new Map<string, string>();
        if (assignmentsRes.data) {
          for (const a of assignmentsRes.data as Array<Record<string, unknown>>) {
            const u = a.User as Record<string, unknown> | null;
            const t = a.Task as Record<string, unknown> | null;
            if (u && t) {
              const userId = u.id as string;
              const listId = t.listId as string;
              peopleMap.set(userId, u.name as string);
              if (!pMap.has(userId)) pMap.set(userId, new Set());
              pMap.get(userId)!.add(listId);
            }
          }
        }
        setPeople(Array.from(peopleMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
        setPersonListMap(pMap);

        // Build team -> listIds map (via team members -> assignments)
        if (teamsRes.data) setTeams(teamsRes.data);
        const tMap = new Map<string, Set<string>>();
        if (teamMembersRes.data && teamsRes.data) {
          for (const tm of teamMembersRes.data) {
            const teamId = tm.teamId as string;
            const userId = tm.userId as string;
            if (!tMap.has(teamId)) tMap.set(teamId, new Set());
            const personLists = pMap.get(userId);
            if (personLists) {
              for (const listId of personLists) {
                tMap.get(teamId)!.add(listId);
              }
            }
          }
        }
        setTeamListMap(tMap);
      }

      setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Listen for refresh events (e.g. after creating a new project)
  useEffect(() => {
    const handler = () => { fetchProjects(); };
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, [fetchProjects]);

  const spaces = useMemo(
    () => [...new Set(projects.map((p) => p.spaceName))].filter(Boolean),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    let filtered = projects.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.spaceName.toLowerCase().includes(q))
          return false;
      }
      if (spaceFilter.length > 0 && !spaceFilter.includes(p.spaceName))
        return false;
      if (personFilter.length > 0) {
        const hasMatch = personFilter.some(userId => personListMap.get(userId)?.has(p.id));
        if (!hasMatch) return false;
      }
      if (teamFilter.length > 0) {
        const hasMatch = teamFilter.some(teamId => teamListMap.get(teamId)?.has(p.id));
        if (!hasMatch) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "dueDate": {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = aTime - bTime;
          break;
        }
        case "progress":
          cmp = a.progress - b.progress;
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [projects, searchQuery, spaceFilter, personFilter, teamFilter, personListMap, teamListMap, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortLabels: Record<SortField, string> = {
    name: "Nombre",
    dueDate: "Fecha",
    progress: "Progreso",
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="Proyectos"
        description="Gestiona todos tus proyectos creativos en un solo lugar"
        showSearch={false}
        actions={
          <Button className="gap-2" onClick={() => openModal("new-project")}>
            <Plus className="h-4 w-4" />
            Nuevo Proyecto
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar proyectos..."
              className="w-[280px] bg-card pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <FilterDropdown
            label="Espacio"
            options={spaces.map((s) => ({
              value: s,
              label: s,
              count: projects.filter((p) => p.spaceName === s).length,
            }))}
            selected={spaceFilter}
            onChange={setSpaceFilter}
          />
          {isAdmin && people.length > 0 && (
            <FilterDropdown
              label="Persona"
              icon={<UserIcon className="h-4 w-4" />}
              options={people.map((p) => ({
                value: p.id,
                label: p.name,
                count: personListMap.get(p.id)?.size || 0,
              }))}
              selected={personFilter}
              onChange={setPersonFilter}
            />
          )}
          {isAdmin && teams.length > 0 && (
            <FilterDropdown
              label="Equipo"
              icon={<Users className="h-4 w-4" />}
              options={teams.map((t) => ({
                value: t.id,
                label: t.name,
                count: teamListMap.get(t.id)?.size || 0,
              }))}
              selected={teamFilter}
              onChange={setTeamFilter}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border bg-card p-1 gap-0.5">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("list")}
              title="Vista lista"
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode("kanban")}
              title="Vista kanban"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {viewMode === "list" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-card">
                  <ArrowUpDown className="h-4 w-4" />
                  {sortLabels[sortField]}
                  {sortOrder === "asc" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSort("name")}>
                  Nombre {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("dueDate")}>
                  Fecha {sortField === "dueDate" && (sortOrder === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("progress")}>
                  Progreso {sortField === "progress" && (sortOrder === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Projects View */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "kanban" ? (
          <KanbanBoard
            projects={filteredProjects.map((p): KanbanProjectRow => ({
              ...p,
              status: deriveStatus(p),
            }))}
          />
        ) : (
          <>
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_120px_120px_100px] gap-4 px-5 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Proyecto</span>
                <span>Espacio</span>
                <span>Progreso</span>
                <span>Fecha Límite</span>
                <span>Tareas</span>
              </div>
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="divide-y divide-border/50">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      className="grid grid-cols-[2fr_1fr_120px_120px_100px] gap-4 px-5 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        window.location.href = `/lists/${project.id}`;
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-3 h-3 rounded shrink-0"
                          style={{ backgroundColor: project.spaceColor }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {project.name}
                            </span>
                            {project.isPitch && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                Pitch
                              </Badge>
                            )}
                          </div>
                          {project.folderName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" />
                              {project.folderName}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground truncate">
                        {project.spaceName}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              project.progress === 100
                                ? "bg-emerald-500"
                                : project.progress > 50
                                ? "bg-blue-500"
                                : "bg-amber-500"
                            )}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {project.progress}%
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(project.dueDate)}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>{project.doneTasks}</span>
                        <span className="text-muted-foreground/50">/</span>
                        <Circle className="h-3 w-3" />
                        <span>{project.totalTasks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {filteredProjects.length === 0 && (
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No se encontraron proyectos</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
