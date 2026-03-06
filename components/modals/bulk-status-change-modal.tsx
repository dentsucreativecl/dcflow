"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";

export function BulkStatusChangeModal() {
    const { activeModal, modalData, closeModal } = useAppStore();
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const isOpen = activeModal === "bulk-status-change";
    const taskIds = modalData?.taskIds as string[] | undefined;
    const statuses = modalData?.statuses as
        | Array<{ id: string; name: string; color: string }>
        | undefined;

    const handleSave = async () => {
        if (!taskIds || !selectedStatus) return;

        setSaving(true);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from("Task")
                .update({ statusId: selectedStatus })
                .in("id", taskIds);

            if (error) throw error;

            closeModal();
            window.location.reload(); // Simple refresh
        } catch (error) {
            console.error("Error updating tasks:", error);
            alert("Error al actualizar tareas");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={closeModal}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Cambiar estado de {taskIds?.length || 0} tarea
                        {taskIds?.length !== 1 ? "s" : ""}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                            {statuses?.map((status) => (
                                <SelectItem key={status.id} value={status.id}>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: status.color }}
                                        />
                                        {status.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={closeModal}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={!selectedStatus || saving}>
                        {saving ? "Guardando..." : "Guardar"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
