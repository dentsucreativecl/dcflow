"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TeamMember } from "@/lib/data";
import { Mail } from "lucide-react";

interface TeamTableProps {
    members: TeamMember[];
    onViewMember?: (id: string) => void;
    canViewMembers?: boolean;
    isSuperAdmin?: boolean;
    onDeactivate?: (member: TeamMember) => void;
}

export function TeamTable({ members, onViewMember, canViewMembers, isSuperAdmin, onDeactivate }: TeamTableProps) {
    const getUtilization = (member: TeamMember) => {
        return Math.round((member.hoursThisWeek / member.capacity) * 100);
    };

    return (
        <div className="rounded-lg border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Miembro</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Horas Semana</TableHead>
                        <TableHead>Utilización</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {members.map((member) => {
                        const utilization = getUtilization(member);
                        return (
                            <TableRow key={member.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback>
                                                {member.name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")
                                                    .slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <button
                                                onClick={() => onViewMember?.(member.id)}
                                                className="font-medium text-foreground hover:underline text-left"
                                                type="button"
                                            >
                                                {member.name}
                                            </button>
                                            <p className="text-xs text-muted-foreground">{member.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm">{member.department}</span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {member.userAreas && member.userAreas.length > 0
                                            ? member.userAreas.map((area) => (
                                                <Badge key={area} variant="outline">{area}</Badge>
                                            ))
                                            : <Badge variant="outline">{member.department}</Badge>
                                        }
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className="font-medium">{member.hoursThisWeek}h</span>
                                    <span className="text-muted-foreground"> / {member.capacity}h</span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-24 rounded-full bg-secondary">
                                            <div
                                                className={`h-full rounded-full ${utilization >= 90
                                                        ? "bg-red-500"
                                                        : utilization >= 70
                                                            ? "bg-orange-500"
                                                            : "bg-green-500"
                                                    }`}
                                                style={{ width: `${Math.min(utilization, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground">{utilization}%</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="sm" asChild>
                                            <a href={`mailto:${member.email}`}>
                                                <Mail className="h-4 w-4" />
                                            </a>
                                        </Button>
                                        {canViewMembers && (
                                            <Button variant="outline" size="sm" onClick={() => onViewMember?.(member.id)}>
                                                Ver
                                            </Button>
                                        )}
                                        {isSuperAdmin && (
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDeactivate?.(member)}>
                                                Desactivar
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
