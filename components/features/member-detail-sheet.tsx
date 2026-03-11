"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Briefcase, FolderOpen, CheckSquare } from "lucide-react";
import Link from "next/link";

interface MemberDetailSheetProps {
  memberId: string | null;
  onClose: () => void;
}

interface MemberProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  userAreas: string[] | null;
  isActive: boolean;
}

interface ClientSpace {
  id: string;
  name: string;
  color: string | null;
  folders: { id: string; name: string }[];
}

interface ProjectInfo {
  listId: string;
  listName: string;
  spaceName: string;
  spaceColor: string | null;
  totalTasks: number;
  doneTasks: number;
}

interface TaskInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  listName: string;
  spaceName: string;
  spaceColor: string | null;
}

const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-primary",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-rose-500",
  "bg-blue-500",
  "bg-orange-500",
];

function getAvatarColor(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  PM: "PM",
  MEMBER: "Miembro",
};

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "TODO":
    case "BACKLOG":
      return "secondary" as const;
    case "IN_PROGRESS":
    case "IN_REVIEW":
      return "default" as const;
    case "DONE":
      return "success" as const;
    default:
      return "secondary" as const;
  }
}

function getPriorityBadgeVariant(priority: string) {
  switch (priority) {
    case "URGENT":
      return "error" as const;
    case "HIGH":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

function formatStatusLabel(status: string) {
  switch (status) {
    case "TODO": return "Por hacer";
    case "BACKLOG": return "Backlog";
    case "IN_PROGRESS": return "En progreso";
    case "IN_REVIEW": return "En revisión";
    case "DONE": return "Hecho";
    default: return status;
  }
}

function formatPriorityLabel(priority: string) {
  switch (priority) {
    case "URGENT": return "Urgente";
    case "HIGH": return "Alta";
    case "MEDIUM": return "Media";
    case "LOW": return "Baja";
    default: return priority;
  }
}

type Tab = "clientes" | "proyectos" | "tareas";

export function MemberDetailSheet({ memberId, onClose }: MemberDetailSheetProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [clients, setClients] = useState<ClientSpace[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("clientes");

  useEffect(() => {
    if (!memberId) return;

    setLoading(true);
    setActiveTab("clientes");

    async function fetchData() {
      const supabase = createClient();

      const [profileRes, spaceMembersRes, taskAssignmentsRes] = await Promise.all([
        supabase
          .from("User")
          .select("id, name, email, role, department, userAreas, isActive")
          .eq("id", memberId!)
          .single(),
        supabase
          .from("SpaceMember")
          .select("Space(id, name, color, Folder(id, name))")
          .eq("userId", memberId!),
        supabase
          .from("TaskAssignment")
          .select("Task(id, title, status, priority, dueDate, List(id, name, Space(name, color)))")
          .eq("userId", memberId!),
      ]);

      // Profile
      if (profileRes.data) {
        setProfile(profileRes.data as unknown as MemberProfile);
      }

      // Client spaces
      if (spaceMembersRes.data) {
        const spaceList: ClientSpace[] = [];
        const seenSpaces = new Set<string>();

        for (const sm of spaceMembersRes.data) {
          const space = (sm as Record<string, unknown>).Space as {
            id: string;
            name: string;
            color: string | null;
            Folder: { id: string; name: string }[];
          } | null;

          if (space && !seenSpaces.has(space.id)) {
            seenSpaces.add(space.id);
            spaceList.push({
              id: space.id,
              name: space.name,
              color: space.color,
              folders: space.Folder || [],
            });
          }
        }
        setClients(spaceList);
      }

      // Task assignments -> projects + tasks
      if (taskAssignmentsRes.data) {
        const projectMap = new Map<string, ProjectInfo>();
        const taskList: TaskInfo[] = [];

        for (const ta of taskAssignmentsRes.data) {
          const task = (ta as Record<string, unknown>).Task as {
            id: string;
            title: string;
            status: string;
            priority: string;
            dueDate: string | null;
            List: {
              id: string;
              name: string;
              Space: { name: string; color: string | null } | null;
            } | null;
          } | null;

          if (!task) continue;

          const list = task.List;
          const spaceName = list?.Space?.name || "";
          const spaceColor = list?.Space?.color || null;
          const listName = list?.name || "";
          const listId = list?.id || "";

          // Add to tasks
          taskList.push({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            listName,
            spaceName,
            spaceColor,
          });

          // Aggregate projects
          if (listId) {
            const existing = projectMap.get(listId);
            if (existing) {
              existing.totalTasks++;
              if (task.status === "DONE") existing.doneTasks++;
            } else {
              projectMap.set(listId, {
                listId,
                listName,
                spaceName,
                spaceColor,
                totalTasks: 1,
                doneTasks: task.status === "DONE" ? 1 : 0,
              });
            }
          }
        }

        setProjects(Array.from(projectMap.values()));
        setTasks(taskList);
      }

      setLoading(false);
    }

    fetchData();
  }, [memberId]);

  const isOpen = memberId !== null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="flex flex-col gap-5">
            {/* Header */}
            <SheetHeader>
              <div className="flex items-center gap-4">
                <Avatar className={`h-14 w-14 ${getAvatarColor(profile.id)}`}>
                  <AvatarFallback className="text-white font-semibold text-lg">
                    {profile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-xl">{profile.name}</SheetTitle>
                  <SheetDescription className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {profile.email}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Info badges */}
            <div className="flex flex-wrap gap-2">
              {profile.department && (
                <Badge variant="outline" className="gap-1">
                  <Briefcase className="h-3 w-3" />
                  {profile.department}
                </Badge>
              )}
              {profile.userAreas && profile.userAreas.length > 0 && (
                profile.userAreas.map((area) => (
                  <Badge key={area} variant="info" className="gap-1">
                    {area}
                  </Badge>
                ))
              )}
              <Badge variant={profile.role === "SUPER_ADMIN" || profile.role === "ADMIN" ? "default" : "secondary"}>
                {roleLabels[profile.role] || profile.role}
              </Badge>
              <Badge variant={profile.isActive ? "success" : "error"}>
                {profile.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg border bg-card p-1">
              {([
                { key: "clientes" as Tab, icon: FolderOpen, label: "Clientes", count: clients.length },
                { key: "proyectos" as Tab, icon: Briefcase, label: "Proyectos", count: projects.length },
                { key: "tareas" as Tab, icon: CheckSquare, label: "Tareas", count: tasks.length },
              ]).map(({ key, icon: Icon, label, count }) => (
                <Button
                  key={key}
                  variant={activeTab === key ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setActiveTab(key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  <span className="text-xs text-muted-foreground">({count})</span>
                </Button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex flex-col gap-2">
              {activeTab === "clientes" && (
                clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin clientes asignados</p>
                ) : (
                  clients.map((space) => (
                    <div key={space.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: space.color || "#6366f1" }}
                        />
                        <Link
                          href={`/clients/${space.id}`}
                          className="font-medium text-sm hover:underline"
                        >
                          {space.name}
                        </Link>
                      </div>
                      {space.folders.length > 0 && (
                        <div className="pl-5 space-y-1">
                          {space.folders.map((folder) => (
                            <p key={folder.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <FolderOpen className="h-3 w-3" />
                              {folder.name}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )
              )}

              {activeTab === "proyectos" && (
                projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin proyectos asignados</p>
                ) : (
                  projects.map((project) => {
                    const progress = project.totalTasks > 0
                      ? Math.round((project.doneTasks / project.totalTasks) * 100)
                      : 0;
                    return (
                      <div key={project.listId} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: project.spaceColor || "#6366f1" }}
                            />
                            <span className="font-medium text-sm truncate">{project.listName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                            {project.doneTasks}/{project.totalTasks}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">{project.spaceName}</p>
                        <div className="h-1.5 w-full rounded-full bg-secondary">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress === 100
                                ? "bg-green-500"
                                : progress >= 50
                                ? "bg-blue-500"
                                : "bg-orange-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {activeTab === "tareas" && (
                tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin tareas asignadas</p>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/tasks?taskId=${task.id}`}
                          className="font-medium text-sm hover:underline line-clamp-2"
                        >
                          {task.title}
                        </Link>
                        <Badge variant={getPriorityBadgeVariant(task.priority)} className="flex-shrink-0 text-[10px]">
                          {formatPriorityLabel(task.priority)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getStatusBadgeVariant(task.status)} className="text-[10px]">
                          {formatStatusLabel(task.status)}
                        </Badge>
                        {task.spaceName && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <div
                              className="h-2 w-2 rounded-full inline-block"
                              style={{ backgroundColor: task.spaceColor || "#6366f1" }}
                            />
                            {task.spaceName}
                          </span>
                        )}
                        {task.listName && (
                          <span className="text-[10px] text-muted-foreground">{task.listName}</span>
                        )}
                        {task.dueDate && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.dueDate).toLocaleDateString("es-CL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">No se encontro el miembro</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
