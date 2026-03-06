"use client";

import { useAuth } from "@/contexts/auth-context";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Shield,
    Users,
    FolderKanban,
    Building2,
    TrendingUp,
    TrendingDown,
    Download,
    Upload,
    FileText,
} from "lucide-react";
import { redirect } from "next/navigation";

export default function AdminPage() {
    const { user, hasPermission } = useAuth();
    const { projects, clients, teamMembers, tasks, openModal } = useAppStore();

    // Redirect if not admin
    if (!user || !hasPermission("access_admin")) {
        redirect("/dashboard");
    }

    // Calculate stats
    const activeProjects = projects.filter((p) => p.status !== "delivered").length;
    const activeClients = clients.filter((c) => c.status === "active").length;
    const totalRevenue = projects.reduce((sum, p) => sum + p.spent, 0);
    const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
    const utilizationRate = Math.round(
        (teamMembers.reduce((sum, m) => sum + m.hoursThisWeek, 0) /
            teamMembers.reduce((sum, m) => sum + m.capacity, 0)) *
        100
    );

    const stats = [
        {
            label: "Active Projects",
            value: activeProjects,
            change: "+12%",
            trend: "up",
            icon: FolderKanban,
            color: "text-blue-500",
        },
        {
            label: "Active Clients",
            value: activeClients,
            change: "+8%",
            trend: "up",
            icon: Building2,
            color: "text-green-500",
        },
        {
            label: "Team Members",
            value: teamMembers.length,
            change: "+2",
            trend: "up",
            icon: Users,
            color: "text-purple-500",
        },
        {
            label: "Utilization Rate",
            value: `${utilizationRate}%`,
            change: "+5%",
            trend: "up",
            icon: TrendingUp,
            color: "text-orange-500",
        },
    ];

    return (
        <div className="flex h-full flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        Admin Dashboard
                    </h2>
                    <p className="text-muted-foreground">
                        System overview and management tools
                    </p>
                </div>
                <Badge className="bg-primary/20 text-primary">
                    Administrator Access
                </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
                    return (
                        <Card key={stat.label} className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-secondary p-2">
                                        <Icon className={`h-5 w-5 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                                        <p className="text-2xl font-bold text-foreground">
                                            {stat.value}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1 text-sm">
                                <TrendIcon
                                    className={`h-4 w-4 ${stat.trend === "up" ? "text-green-500" : "text-red-500"
                                        }`}
                                />
                                <span
                                    className={
                                        stat.trend === "up" ? "text-green-500" : "text-red-500"
                                    }
                                >
                                    {stat.change}
                                </span>
                                <span className="text-muted-foreground">from last month</span>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <Button
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => openModal("bulk-import")}
                    >
                        <Upload className="h-4 w-4" />
                        Import CSV
                    </Button>
                    <Button variant="outline" className="justify-start gap-2">
                        <Download className="h-4 w-4" />
                        Export Reports
                    </Button>
                    <Button variant="outline" className="justify-start gap-2">
                        <Users className="h-4 w-4" />
                        Manage Users
                    </Button>
                    <Button variant="outline" className="justify-start gap-2">
                        <FileText className="h-4 w-4" />
                        View Logs
                    </Button>
                </div>
            </Card>

            {/* System Health */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-6">
                    <h3 className="font-semibold text-foreground mb-4">
                        Financial Overview
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Total Revenue
                            </span>
                            <span className="text-lg font-semibold text-foreground">
                                ${totalRevenue.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Total Budget
                            </span>
                            <span className="text-lg font-semibold text-foreground">
                                ${totalBudget.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Budget Utilization
                            </span>
                            <span className="text-lg font-semibold text-foreground">
                                {Math.round((totalRevenue / totalBudget) * 100)}%
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="font-semibold text-foreground mb-4">
                        Recent Activity
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-green-500/20 p-1">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-foreground">New project created</p>
                                <p className="text-xs text-muted-foreground">2 hours ago</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-blue-500/20 p-1">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-foreground">Team member added</p>
                                <p className="text-xs text-muted-foreground">5 hours ago</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-purple-500/20 p-1">
                                <div className="h-2 w-2 rounded-full bg-purple-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-foreground">Report exported</p>
                                <p className="text-xs text-muted-foreground">1 day ago</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
