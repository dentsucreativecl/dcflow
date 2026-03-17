"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/features/notifications/notification-bell";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Inbox, Search, Settings, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

interface TopHeaderProps {
    className?: string;
}

export function TopHeader({ className }: TopHeaderProps) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { openSearch } = useAppStore();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [inboxCount, setInboxCount] = useState(0);

    useEffect(() => {
        async function fetchCount() {
            const supabase = createClient();
            const { count } = await supabase
                .from("Notification")
                .select("id", { count: "exact", head: true })
                .eq("isRead", false);
            if (count !== null) setInboxCount(count);
        }
        fetchCount();
    }, []);

    const initials = user?.name
        ?.split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2) || "DC";

    return (
        <>
            <header className={cn("flex h-14 items-center justify-between border-b border-border bg-background px-4 shrink-0", className)}>
                {/* Left: Logo */}
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black overflow-hidden">
                            <Image
                                src="/img/dc-ico.png"
                                alt="DC Flow"
                                width={32}
                                height={32}
                                className="object-contain"
                            />
                        </div>
                        <span className="font-bold text-lg tracking-tight hidden sm:block">DC Flow</span>
                    </Link>
                </div>

                {/* Center: Search */}
                <button
                    onClick={() => openSearch()}
                    data-tour-id="header-search"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors w-64 max-w-md"
                >
                    <Search className="h-4 w-4" />
                    <span className="flex-1 text-left">Buscar...</span>
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
                        ⌘K
                    </kbd>
                </button>

                {/* Right: Inbox, Notifications, Avatar */}
                <div className="flex items-center gap-1" data-tour-id="header-timer">
                    {/* Inbox */}
                    <Link href="/inbox">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-9 w-9 relative", pathname === "/inbox" && "bg-accent")}
                            title="Bandeja de entrada"
                        >
                            <Inbox className="h-5 w-5" />
                            {inboxCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                            )}
                        </Button>
                    </Link>

                    {/* Notifications */}
                    {user && <NotificationBell userId={user.id} />}

                    {/* User Avatar */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="ml-1 flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white text-sm font-medium cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                                {user?.avatarUrl
                                    ? <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="object-cover w-full h-full" />
                                    : initials}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <div className="px-2 py-1.5">
                                <p className="text-sm font-medium">{user?.name || "Usuario"}</p>
                                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/settings" className="flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    Configuración
                                </Link>
                            </DropdownMenuItem>
                            {(user?.supabaseRole === "SUPER_ADMIN" || user?.supabaseRole === "ADMIN") && (
                                <DropdownMenuItem asChild>
                                    <Link href="/admin" className="flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4" />
                                        Administración
                                    </Link>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setShowLogoutConfirm(true)}
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Cerrar sesión
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

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
        </>
    );
}
