"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, BarChart3, LayoutGrid, List, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamCard } from "@/components/features/team-card";
import { FilterDropdown } from "@/components/features/filter-dropdown";
import { useAppStore } from "@/lib/store";
import { TeamTable } from "@/components/features/team-table";
import { createClient } from "@/lib/supabase/client";
import type { TeamMember } from "@/lib/data";

export default function TeamPage() {
  const { openModal } = useAppStore();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    async function fetchTeam() {
      const supabase = createClient();

      // Compute monday date before parallel queries
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const mondayStr = monday.toISOString().split("T")[0];

      // Fetch all data in parallel
      const [{ data: users }, { data: memberships }, { data: timeEntries }] =
        await Promise.all([
          supabase
            .from("User")
            .select("id, name, email, role, weeklyCapacity, jobTitle, department")
            .eq("userType", "MEMBER")
            .eq("isActive", true)
            .order("name"),
          supabase.from("TeamMember").select("userId, role, Team(id, name)"),
          supabase.from("TimeEntry").select("userId, hours").gte("date", mondayStr),
        ]);

      if (!users) {
        setLoading(false);
        return;
      }

      // Map to TeamMember interface
      const mapped: TeamMember[] = users.map((user) => {
        const membership = memberships?.find((m) => m.userId === user.id);
        const team = membership?.Team as { id: string; name: string } | null;
        const teamName = team?.name || "General";

        const weeklyHours = (timeEntries || [])
          .filter((te) => te.userId === user.id)
          .reduce((sum, te) => sum + (te.hours || 0), 0);

        return {
          id: user.id,
          name: user.name,
          role: (user as Record<string, unknown>).jobTitle as string || teamName,
          email: user.email,
          avatar: user.name
            .split(" ")
            .map((n) => n[0])
            .join(""),
          department: (user as Record<string, unknown>).department as string || teamName,
          hourlyRate: 0,
          hoursThisWeek: Math.round(weeklyHours * 10) / 10,
          capacity: user.weeklyCapacity || 40,
          skills: [],
          status: "available" as const,
        };
      });

      setTeamMembers(mapped);
      setLoading(false);
    }

    fetchTeam();
  }, []);

  // Get unique departments and statuses
  const departments = [...new Set(teamMembers.map((m) => m.department))];
  const statuses = ["available", "busy", "away"];

  // Normalize text to remove accents for accent-insensitive search
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const normalizedQuery = normalize(searchQuery);

  // Filter members — each condition is independent
  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      normalize(member.name).includes(normalizedQuery) ||
      normalize(member.role).includes(normalizedQuery);

    const matchesDepartment =
      departmentFilter.length === 0 ||
      departmentFilter.includes(member.department);

    const matchesStatus =
      statusFilter.length === 0 || statusFilter.includes(member.status);

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="Equipo"
        description="Gestiona los miembros del equipo y su carga de trabajo"
        showSearch={false}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/team/workload">
                <BarChart3 className="h-4 w-4" />
                Carga de Trabajo
              </Link>
            </Button>
            <Button className="gap-2" onClick={() => openModal("new-member")}>
              <Plus className="h-4 w-4" />
              Añadir Miembro
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar en el equipo..."
              className="w-[280px] bg-card pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <FilterDropdown
            label="Departamento"
            options={departments.map((d) => ({
              value: d,
              label: d,
              count: teamMembers.filter((m) => m.department === d).length,
            }))}
            selected={departmentFilter}
            onChange={setDepartmentFilter}
          />
          <FilterDropdown
            label="Estado"
            options={statuses.map((s) => ({
              value: s,
              label: s.charAt(0).toUpperCase() + s.slice(1),
              count: teamMembers.filter((m) => m.status === s).length,
            }))}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Team Grid or List */}
      {viewMode === "grid" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMembers.map((member) => (
            <TeamCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <TeamTable members={filteredMembers} />
      )}

      {/* Empty State */}
      {filteredMembers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No se encontraron miembros</p>
          {(searchQuery || departmentFilter.length > 0 || statusFilter.length > 0) && (
            <Button
              variant="link"
              onClick={() => {
                setSearchQuery("");
                setDepartmentFilter([]);
                setStatusFilter([]);
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
