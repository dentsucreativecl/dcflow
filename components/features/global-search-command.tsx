"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    FolderKanban,
    ListTodo,
    Users,
    Layers,
    CheckSquare,
} from "lucide-react";

interface SearchTask {
    id: string;
    title: string;
    list: { id: string; name: string } | null;
    priority: string;
    status: { name: string; color: string } | null;
}

interface SearchList {
    id: string;
    name: string;
    space: { name: string; color: string } | null;
}

interface SearchSpace {
    id: string;
    name: string;
    color: string;
}

interface SearchUser {
    id: string;
    name: string;
    email: string;
    role: string | null;
}

export function GlobalSearchCommand() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    const [tasks, setTasks] = useState<SearchTask[]>([]);
    const [lists, setLists] = useState<SearchList[]>([]);
    const [spaces, setSpaces] = useState<SearchSpace[]>([]);
    const [users, setUsers] = useState<SearchUser[]>([]);

    const router = useRouter();

    // Search when query changes
    useEffect(() => {
        if (!open || !search || search.length < 2) {
            setTasks([]);
            setLists([]);
            setSpaces([]);
            setUsers([]);
            return;
        }

        const performSearch = async () => {
            
            setLoading(true);
            const supabase = createClient();

            try {
                const searchPattern = `%${search}%`;

                // Search tasks
                const { data: tasksData } = await supabase
                    .from("Task")
                        .select("id, title, description, priority, listId, statusId, list:List(id, name), status:Status(name, color)")
                        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
                    .limit(5);

                // Search lists
                const { data: listsData } = await supabase
                    .from("List")
                        .select("id, name, description, spaceId, space:Space(id, name, color)")
                        .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
                    .limit(5);

                // Search spaces
                const { data: spacesData } = await supabase
                    .from("Space")
                        .select("id, name, color")
                        .ilike("name", searchPattern)
                    .limit(5);

                // Search users
                const { data: usersData } = await supabase
                    .from("User")
                    .select("id, name, email, avatarUrl, role")
                    .or(`name.ilike.${searchPattern},email.ilike.${searchPattern}`)
                    .eq("isActive", true)
                    .limit(5);

                
                setTasks((tasksData || []).map((t: any) => ({
                    ...t,
                    list: Array.isArray(t.list) ? t.list[0] ?? null : t.list ?? null,
                    status: Array.isArray(t.status) ? t.status[0] ?? null : t.status ?? null,
                })));
                setLists((listsData || []).map((l: any) => ({
                    ...l,
                    space: Array.isArray(l.space) ? l.space[0] ?? null : l.space ?? null,
                })));
                setSpaces(spacesData || []);
                setUsers(usersData || []);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(performSearch, 300);
        return () => clearTimeout(debounce);
    }, [search, open]);

    const handleSelect = (callback: () => void) => {
        setOpen(false);
        setSearch("");
        callback();
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            URGENT: "bg-red-500/20 text-red-500 border-red-500/30",
            HIGH: "bg-orange-500/20 text-orange-500 border-orange-500/30",
            NORMAL: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
            MEDIUM: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
            LOW: "bg-blue-500/20 text-blue-500 border-blue-500/30",
            NONE: "bg-gray-500/20 text-gray-500 border-gray-500/30",
        };
        return colors[priority?.toUpperCase()] || "bg-gray-500/20 text-gray-500";
    };

    const hasResults = tasks.length > 0 || lists.length > 0 || spaces.length > 0 || users.length > 0;

    return (
        <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
            <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4 shrink-0 opacity-50"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Buscar tareas, listas, espacios, usuarios..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
            </div>
            <CommandList>
                {loading && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        Buscando...
                    </div>
                )}

                {!loading && search && !hasResults && (
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                )}

                {!search && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        Escribe para buscar tareas, listas, espacios o usuarios...
                        <div className="mt-2 text-xs">
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                                ⌘K
                            </kbd>{" "}
                            para abrir
                        </div>
                    </div>
                )}

                {/* Tasks */}
                {!loading && tasks.length > 0 && (
                    <>
                        <CommandGroup heading="Tareas">
                            {tasks.map((task) => {
                                const list = task.list || null;
                                const status = task.status || null;

                                return (
                                    <CommandItem
                                        key={task.id}
                                        onSelect={() =>
                                            handleSelect(() => {
                                                if (list?.id) {
                                                    router.push(`/lists/${list.id}`);
                                                }
                                            })
                                        }
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
                                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-medium text-foreground truncate">
                                                {task.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {list?.name || "Sin lista"}
                                            </p>
                                        </div>
                                        {status && (
                                            <Badge
                                                variant="outline"
                                                style={{
                                                    backgroundColor: status.color + "20",
                                                    color: status.color,
                                                    borderColor: status.color + "30",
                                                }}
                                                className="text-xs"
                                            >
                                                {status.name}
                                            </Badge>
                                        )}
                                        {task.priority && task.priority !== "NONE" && (
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${getPriorityColor(task.priority)}`}
                                            >
                                                {task.priority}
                                            </Badge>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {/* Lists */}
                {!loading && lists.length > 0 && (
                    <>
                        <CommandGroup heading="Listas">
                            {lists.map((list) => {
                                const space = list?.space || null;

                                return (
                                    <CommandItem
                                        key={list.id}
                                        onSelect={() =>
                                            handleSelect(() => router.push(`/lists/${list.id}`))
                                        }
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <div
                                            className="h-8 w-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: space?.color + "20" || "#64748b20" }}
                                        >
                                            <ListTodo
                                                className="h-4 w-4"
                                                style={{ color: space?.color || "#64748b" }}
                                            />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-medium text-foreground truncate">
                                                {list.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {space?.name || "Sin espacio"}
                                            </p>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {/* Spaces */}
                {!loading && spaces.length > 0 && (
                    <>
                        <CommandGroup heading="Espacios">
                            {spaces.map((space) => (
                                <CommandItem
                                    key={space.id}
                                    onSelect={() =>
                                        handleSelect(() => router.push(`/clients/${space.id}`))
                                    }
                                    className="flex items-center gap-3 py-3"
                                >
                                    <div
                                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: space.color + "20" }}
                                    >
                                        <Layers
                                            className="h-4 w-4"
                                            style={{ color: space.color }}
                                        />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-medium text-foreground truncate">
                                            {space.name}
                                        </p>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {/* Users */}
                {!loading && users.length > 0 && (
                    <CommandGroup heading="Usuarios">
                        {users.map((user) => (
                            <CommandItem
                                key={user.id}
                                onSelect={() =>
                                    handleSelect(() => router.push(`/team/${user.id}`))
                                }
                                className="flex items-center gap-3 py-3"
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white text-xs">
                                        {user.name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-medium text-foreground truncate">
                                        {user.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {user.email}
                                    </p>
                                </div>
                                {user.role && (
                                    <Badge variant="outline" className="text-xs">
                                        {user.role}
                                    </Badge>
                                )}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
}
