"use client";

import Link from "next/link";
import { MoreHorizontal, Mail, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamMember } from "@/lib/data";

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

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

interface TeamCardProps {
  member: TeamMember;
}

export function TeamCard({ member }: TeamCardProps) {
  const utilization = Math.round((member.hoursThisWeek / member.capacity) * 100);

  return (
    <Card className="p-5 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className={`h-12 w-12 ${getAvatarColor(member.name)}`}>
            <AvatarFallback className="text-white font-semibold">
              {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <Link href={`/team/${member.id}`} className="font-semibold text-foreground hover:underline">
              {member.name}
            </Link>
            <p className="text-sm text-muted-foreground">{member.role}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
            <DropdownMenuItem>Asignar Tarea</DropdownMenuItem>
            <DropdownMenuItem>Ver Carga</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3">
        <Badge variant="outline" className="text-xs">{member.department}</Badge>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        <span className="truncate text-xs">{member.email}</span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Esta Semana
          </span>
          <span className="font-medium text-foreground">
            {member.hoursThisWeek}h / {member.capacity}h
          </span>
        </div>
        <Progress
          value={utilization}
          className="h-2"
          indicatorClassName={
            utilization > 100
              ? "bg-studio-error"
              : utilization > 80
              ? "bg-studio-warning"
              : "bg-studio-success"
          }
        />
      </div>
    </Card>
  );
}
