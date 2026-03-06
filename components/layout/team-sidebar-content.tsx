"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TeamMember {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
}

export function TeamSidebarContent() {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTeamMembers() {
            const supabase = createClient();

            try {
                const { data } = await supabase
                    .from("User")
                    .select("id, name, email, avatarUrl, role")
                    .order("name");

                if (data) {
                    setMembers(data);
                }
            } catch (error) {
                console.error("Error fetching team members:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchTeamMembers();
    }, []);

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);
    };

    const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
        switch (role?.toUpperCase()) {
            case "SUPER_ADMIN":
            case "ADMIN": return "default";
            default: return "outline";
        }
    };

    const getRoleLabel = (role: string): string => {
        switch (role?.toUpperCase()) {
            case "SUPER_ADMIN": return "Super Admin";
            case "ADMIN": return "Administrador";
            case "MEMBER": return "Miembro";
            default: return role || "Miembro";
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-3 space-y-3">
                <div className="text-xs font-medium text-muted-foreground">Miembros del equipo</div>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-1">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-2 w-16" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <div className="px-4 py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No hay miembros</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="px-4 py-3">
                <div className="text-xs font-medium text-muted-foreground mb-3">
                    {members.length} {members.length === 1 ? "miembro" : "miembros"}
                </div>
                <div className="space-y-1">
                    {members.map((member) => (
                        <Link
                            key={member.id}
                            href={'/team/' + member.id}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
                        >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
                                <AvatarFallback className="text-xs">
                                    {getInitials(member.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {member.name}
                                </p>
                                <div className="flex items-center gap-1">
                                    <Badge 
                                        variant={getRoleBadgeVariant(member.role)} 
                                        className="text-[10px] px-1 h-4"
                                    >
                                        {getRoleLabel(member.role)}
                                    </Badge>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </ScrollArea>
    );
}
