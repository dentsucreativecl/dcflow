"use client";

import { useAppStore } from "@/lib/store";
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

export function ConfirmDeleteModal() {
    const { activeModal, modalData, closeModal } = useAppStore();
    const isOpen = activeModal === "confirm-delete";

    const handleConfirm = () => {
        if (modalData?.onConfirm) {
            modalData.onConfirm();
        }
        closeModal();
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={closeModal}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {modalData?.title || "¿Estás seguro?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {modalData?.message ||
                            "Esta acción no se puede deshacer. El elemento será eliminado permanentemente."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        Eliminar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
