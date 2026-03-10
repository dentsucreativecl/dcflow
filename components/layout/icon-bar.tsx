"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Home,
    Calendar,
    Users,
    FileText,
    BarChart3,
    Settings,
    LogOut,
} from "lucide-react";

interface IconBarProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
}

const mainIcons = [
    { id: "home", icon: Home, label: "Inicio", href: "/dashboard", preview: "Bandeja, tareas, favoritos y espacios" },
    { id: "calendar", icon: Calendar, label: "Agenda", href: "/calendar", preview: "Calendario y eventos del equipo" },
    { id: "team", icon: Users, label: "Equipos", href: "/team", preview: "Miembros, roles y disponibilidad" },
    { id: "docs", icon: FileText, label: "Documentos", href: "/docs", preview: "Archivos y documentos compartidos" },
    { id: "reports", icon: BarChart3, label: "Reportes", href: "/reports", preview: "Métricas, KPIs y reportes" },
];

const bottomIcons = [
    { id: "settings", icon: Settings, label: "Configuración", href: "/settings" },
];

/**
 * IconBar - Fixed 48px wide vertical bar with main navigation icons
 */
export function IconBar({ activeSection, onSectionChange }: IconBarProps) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex h-full w-12 flex-col items-center border-r border-border bg-sidebar py-3">
                {/* Logo */}
                <Link href="/dashboard" className="mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black overflow-hidden">
                        <Image
                            src="/img/dc-ico.png"
                            alt="DC Flow"
                            width={36}
                            height={36}
                            className="object-contain"
                        />
                    </div>
                </Link>

                {/* Main Navigation */}
                <nav className="flex flex-1 flex-col items-center gap-1">
                    {mainIcons.map((item) => {
                        const isActive = item.href
                            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                            : activeSection === item.id;

                        return (
                            <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    {item.href ? (
                                        <Link
                                            href={item.href}
                                            onClick={() => onSectionChange(item.id)}
                                            className={cn(
                                                "inline-flex items-center justify-center h-9 w-9 rounded-lg transition-colors",
                                                isActive
                                                    ? "bg-white/15 text-white"
                                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                                            )}
                                        >
                                            <item.icon className="h-5 w-5" />
                                        </Link>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-9 w-9 rounded-lg",
                                                isActive
                                                    ? "bg-white/15 text-white"
                                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                                            )}
                                            onClick={() => onSectionChange(item.id)}
                                        >
                                            <item.icon className="h-5 w-5" />
                                        </Button>
                                    )}
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-slate-800 border-slate-700 px-3 py-2">
                                    <p className="font-medium text-white">{item.label}</p>
                                    {item.preview && <p className="text-xs text-slate-400 mt-0.5">{item.preview}</p>}
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="flex flex-col items-center gap-1">
                    {bottomIcons.map((item) => {
                        const isActive = item.href
                            ? pathname === item.href
                            : activeSection === item.id;

                        return (
                            <Tooltip key={item.id}>
                                <TooltipTrigger asChild>
                                    {item.href ? (
                                        <Link
                                            href={item.href}
                                            onClick={() => onSectionChange(item.id)}
                                            className={cn(
                                                "inline-flex items-center justify-center h-9 w-9 rounded-lg transition-colors",
                                                isActive
                                                    ? "bg-white/15 text-white"
                                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                                            )}
                                        >
                                            <item.icon className="h-5 w-5" />
                                        </Link>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-9 w-9 rounded-lg",
                                                isActive
                                                    ? "bg-white/15 text-white"
                                                    : "text-slate-400 hover:text-white hover:bg-white/10"
                                            )}
                                            onClick={() => onSectionChange(item.id)}
                                        >
                                            <item.icon className="h-5 w-5" />
                                        </Button>
                                    )}
                                </TooltipTrigger>
                                <TooltipContent side="right" className="bg-slate-800 border-slate-700 px-3 py-2">
                                    <p className="font-medium text-white">{item.label}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}

                    {/* Logout */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                onClick={() => setShowLogoutConfirm(true)}
                            >
                                <LogOut className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-slate-800 border-slate-700">
                            <p>Cerrar sesión</p>
                        </TooltipContent>
                    </Tooltip>

                    <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Serás redirigido a la pantalla de inicio de sesión.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={logout}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Cerrar sesión
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Notifications */}
                    {user && <NotificationBell userId={user.id} />}

                    {/* User Avatar */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white text-sm font-medium cursor-pointer">
                                {user?.avatar || "DC"}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-slate-800 border-slate-700">
                            <p className="font-medium">{user?.name || "Usuario"}</p>
                            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider>
    );
}
