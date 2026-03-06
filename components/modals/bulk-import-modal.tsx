"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Project, Task } from "@/lib/data";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function BulkImportModal() {
    const { activeModal, closeModal, addProject, addTask, addClient } = useAppStore();
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const { toast } = useToast();

    const isOpen = activeModal === "bulk-import";

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const parseCSV = (text: string): string[][] => {
        const lines = text.split("\n").filter(line => line.trim());
        return lines.map(line => {
            // Simple CSV parser (handles basic cases)
            const values: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === "," && !inQuotes) {
                    values.push(current.trim());
                    current = "";
                } else {
                    current += char;
                }
            }
            values.push(current.trim());
            return values;
        });
    };

    const handleImport = async () => {
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const rows = parseCSV(text);

            if (rows.length < 2) {
                throw new Error("CSV file must have headers and at least one data row");
            }

            const headers = rows[0].map(h => h.toLowerCase().trim());
            const dataRows = rows.slice(1);

            let imported = 0;

            // Detect type based on headers
            if (headers.includes("project") || headers.includes("client")) {
                // Import projects
                dataRows.forEach(row => {
                    const nameIdx = headers.indexOf("name") || headers.indexOf("project");
                    const clientIdx = headers.indexOf("client");
                    const statusIdx = headers.indexOf("status");
                    const budgetIdx = headers.indexOf("budget");

                    if (row[nameIdx]) {
                        addProject({
                            name: row[nameIdx],
                            client: row[clientIdx] || "Unknown",
                            clientId: "cl-1",
                            status: (row[statusIdx] as Project["status"]) || "briefing",
                            progress: 0,
                            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            team: [],
                            budget: parseFloat(row[budgetIdx]) || 10000,
                            spent: 0,
                            description: "",
                            color: "#4F46E5",
                            tasks: [],
                        });
                        imported++;
                    }
                });
            } else if (headers.includes("task") || headers.includes("title")) {
                // Import tasks
                dataRows.forEach(row => {
                    const titleIdx = headers.indexOf("title") || headers.indexOf("task");
                    const statusIdx = headers.indexOf("status");
                    const priorityIdx = headers.indexOf("priority");

                    if (row[titleIdx]) {
                        addTask({
                            title: row[titleIdx],
                            description: "",
                            status: (row[statusIdx] as Task["status"]) || "todo",
                            priority: (row[priorityIdx] as Task["priority"]) || "medium",
                            assignee: null,
                            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            projectId: "pj-1",
                            estimatedHours: 8,
                            loggedHours: 0,
                        });
                        imported++;
                    }
                });
            }

            toast({
                title: "Importación exitosa",
                description: `Imported ${imported} items from CSV`,
            });

            closeModal();
            setFile(null);
        } catch (error) {
            toast({
                title: "Error en importación",
                description: error instanceof Error ? error.message : "Failed to parse CSV file",
                variant: "destructive",
            });
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={closeModal}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importación Masiva from CSV</DialogTitle>
                    <DialogDescription>
                        Sube un archivo CSV file to import multiple projects or tasks at once
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="csv-file">CSV File</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => document.getElementById("csv-file")?.click()}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {file ? file.name : "Choose file..."}
                            </Button>
                            <input
                                id="csv-file"
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>

                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p className="font-medium">CSV Format Requirements:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>First row must contain headers</li>
                                    <li>For projects: name, client, status, budget</li>
                                    <li>For tasks: title, status, priority</li>
                                    <li>Use comma-separated values</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Example CSV:</p>
                        <pre className="text-xs bg-secondary p-2 rounded overflow-x-auto">
                            {`name,client,status,budget
Project Alpha,Acme Corp,in-progress,50000
Project Beta,TechCorp,briefing,35000`}
                        </pre>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={closeModal}>
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={!file || importing}>
                        <FileText className="h-4 w-4 mr-2" />
                        {importing ? "Importando..." : "Importar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
