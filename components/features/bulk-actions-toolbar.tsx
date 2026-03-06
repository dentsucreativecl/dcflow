"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Trash2, Edit, UserPlus, CheckCircle } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/data";

interface BulkActionsToolbarProps {
    selectedIds: string[];
    onClearSelection: () => void;
    type: "projects" | "tasks" | "clients";
}

export function BulkActionsToolbar({
    selectedIds,
    onClearSelection,
    type,
}: BulkActionsToolbarProps) {
    const { openModal, deleteProject, deleteTask, deleteClient, updateTask } = useAppStore();

    if (selectedIds.length === 0) return null;

    const handleBulkDelete = () => {
        openModal("confirm-delete", {
            title: `Delete ${selectedIds.length} ${type}`,
            message: `Are you sure you want to delete ${selectedIds.length} ${type}? This action cannot be undone.`,
            onConfirm: () => {
                selectedIds.forEach((id) => {
                    if (type === "projects") deleteProject(id);
                    else if (type === "tasks") deleteTask(id);
                    else if (type === "clients") deleteClient(id);
                });
                onClearSelection();
            },
        });
    };

    const handleBulkStatusChange = (status: string) => {
        if (type === "tasks") {
            selectedIds.forEach((id) => {
                updateTask(id, { status: status as Task["status"] });
            });
            onClearSelection();
        }
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
                <Badge variant="secondary" className="font-medium">
                    {selectedIds.length} selected
                </Badge>

                <div className="h-4 w-px bg-border" />

                {type === "tasks" && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Change Status
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange("todo")}>
                                To Do
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange("in-progress")}>
                                In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange("review")}>
                                Review
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkStatusChange("done")}>
                                Done
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign
                </Button>

                <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                </Button>

                <div className="h-4 w-px bg-border" />

                <Button variant="ghost" size="sm" onClick={onClearSelection}>
                    Clear
                </Button>
            </div>
        </div>
    );
}
