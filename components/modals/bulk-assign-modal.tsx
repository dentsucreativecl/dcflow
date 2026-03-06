"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";

interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
}

export function BulkAssignModal() {
    const { activeModal, modalData, closeModal } = useAppStore();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const isOpen = activeModal === "bulk-assign";
    const taskIds = modalData?.taskIds as string[] | undefined;

    useEffect(() => {
        if (!isOpen) return;

        async function fetchUsers() {
            const supabase = createClient();

            const { data } = await supabase
                .from("User")
                .select("id, name, email, avatarUrl")
                .eq("isActive", true)
                .order("name");

            if (data) setUsers(data);
            setLoading(false);
        }

        fetchUsers();
    }, [isOpen]);

    const toggleUser = (userId: string) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUsers(newSet);
    };

    const handleSave = async () => {
        if (!taskIds || selectedUsers.size === 0) return;

        setSaving(true);
        const supabase = createClient();

        try {
            // Create assignments for each combination of task + user
            const assignments = taskIds.flatMap((taskId) =>
                Array.from(selectedUsers).map((userId) => ({
                    id: self.crypto.randomUUID(),
                    taskId,
                    userId,
                }))
            );

            const { error } = await supabase
                .from("TaskAssignment")
                .upsert(assignments, { onConflict: "taskId,userId" });

            if (error) throw error;

            closeModal();
            window.location.reload();
        } catch (error) {
            console.error("Error assigning tasks:", error);
            alert("Error al asignar tareas");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={closeModal}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Asignar {taskIds?.length || 0} tarea{taskIds?.length !== 1 ? "s" : ""}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 max-h-96 overflow-y-auto">
                    {loading ? (
                        <p className="text-center text-muted-foreground">Cargando usuarios...</p>
                    ) : (
                        <div className="space-y-2">
                            {users.map((user) => (
                                <label
                                    key={user.id}
                                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                                >
                                    <Checkbox
                                        checked={selectedUsers.has(user.id)}
                                        onCheckedChange={() => toggleUser(user.id)}
                                    />
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs bg-gradient-to-br from-[#F2A6A6] to-[#17385C] text-white">
                                            {user.name.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{user.name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={closeModal}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={selectedUsers.size === 0 || saving}>
                        {saving ? "Asignando..." : `Asignar a ${selectedUsers.size}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
