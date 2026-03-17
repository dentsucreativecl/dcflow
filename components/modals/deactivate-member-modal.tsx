"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export function DeactivateMemberModal() {
    const { activeModal, modalData, closeModal } = useAppStore();
    const { addToast } = useToast();
    const isOpen = activeModal === "deactivate-member";
    const userId = modalData?.userId as string | undefined;
    const userName = modalData?.userName as string | undefined;

    const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
    const [reassignTo, setReassignTo] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(true);

    useEffect(() => {
        if (!isOpen || !userId) return;
        setReassignTo("");
        setLoadingMembers(true);

        const supabase = createClient();
        supabase
            .from("User")
            .select("id, name")
            .eq("isActive", true)
            .neq("id", userId)
            .order("name")
            .then(({ data }) => {
                setMembers(data || []);
                setLoadingMembers(false);
            });
    }, [isOpen, userId]);

    const handleDeactivate = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/team/${userId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reassignTo: reassignTo || null }),
            });
            if (res.ok) {
                const data = await res.json();
                const msg = data.reassigned
                    ? "Miembro desactivado y tareas reasignadas"
                    : "Miembro desactivado";
                addToast({ title: msg, type: "success" });
                window.dispatchEvent(new Event("dcflow:refresh"));
                closeModal();
            } else {
                const data = await res.json().catch(() => ({}));
                addToast({ title: data.error || "Error al desactivar", type: "error" });
            }
        } catch {
            addToast({ title: "Error de conexión", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={closeModal}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Desactivar miembro</DialogTitle>
                    <DialogDescription>
                        <strong>{userName}</strong> será desactivado y no podrá acceder a la plataforma.
                        Puedes reasignar sus tareas activas a otro miembro del equipo.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                        Reasignar tareas a (opcional)
                    </label>
                    {loadingMembers ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando miembros...
                        </div>
                    ) : (
                        <Select value={reassignTo} onValueChange={setReassignTo}>
                            <SelectTrigger>
                                <SelectValue placeholder="No reasignar (tareas quedan sin asignar)" />
                            </SelectTrigger>
                            <SelectContent>
                                {members.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={closeModal} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDeactivate}
                        disabled={loading}
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Desactivar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
