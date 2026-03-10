"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ListOption {
    id: string;
    name: string;
    spaceName: string;
}

export function BulkImportModal() {
    const { activeModal, closeModal } = useAppStore();
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [selectedListId, setSelectedListId] = useState<string>("");
    const [lists, setLists] = useState<ListOption[]>([]);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);
    const [error, setError] = useState("");

    const isOpen = activeModal === "bulk-import";

    // Fetch available projects (Lists)
    const fetchLists = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from("List")
            .select("id, name, Space:spaceId(name)")
            .order("name");

        if (data) {
            setLists(
                data.map((l: any) => {
                    const space = Array.isArray(l.Space) ? l.Space[0] : l.Space;
                    return { id: l.id, name: l.name, spaceName: space?.name || "—" };
                })
            );
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchLists();
            setFile(null);
            setResult(null);
            setError("");
            setProgress(0);
            setSelectedListId("");
        }
    }, [isOpen, fetchLists]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
            setError("");
        }
    };

    const parseCSV = (text: string): string[][] => {
        const lines = text.split("\n").filter((line) => line.trim());
        return lines.map((line) => {
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
        if (!file || !selectedListId || !user) return;

        setImporting(true);
        setError("");
        setResult(null);
        setProgress(0);

        try {
            const text = await file.text();
            const rows = parseCSV(text);

            if (rows.length < 2) {
                throw new Error("El CSV debe tener encabezados y al menos una fila de datos");
            }

            const headers = rows[0].map((h) => h.toLowerCase().trim());
            const dataRows = rows.slice(1);

            // Need a title/task/name column
            const titleIdx = headers.indexOf("title") !== -1
                ? headers.indexOf("title")
                : headers.indexOf("task") !== -1
                ? headers.indexOf("task")
                : headers.indexOf("name") !== -1
                ? headers.indexOf("name")
                : -1;

            if (titleIdx === -1) {
                throw new Error("Se requiere una columna 'title', 'task' o 'name' en el CSV");
            }

            const priorityIdx = headers.indexOf("priority");
            const descriptionIdx = headers.indexOf("description");

            const supabase = createClient();

            // Get a default status for this list's space
            const { data: listData } = await supabase
                .from("List")
                .select("spaceId")
                .eq("id", selectedListId)
                .single();

            if (!listData) throw new Error("Proyecto no encontrado");

            const { data: statuses } = await supabase
                .from("Status")
                .select("id, type")
                .eq("spaceId", listData.spaceId)
                .order("order");

            const defaultStatus = statuses?.find((s) => s.type === "TODO") || statuses?.[0];
            if (!defaultStatus) throw new Error("No se encontró un estado por defecto para este espacio");

            let imported = 0;
            let errors = 0;
            const total = dataRows.length;

            // Import in batches of 10
            const batchSize = 10;
            for (let i = 0; i < dataRows.length; i += batchSize) {
                const batch = dataRows.slice(i, i + batchSize);
                const tasksToInsert = batch
                    .filter((row) => row[titleIdx]?.trim())
                    .map((row) => {
                        const priorityRaw = priorityIdx >= 0 ? row[priorityIdx]?.toUpperCase().trim() : "";
                        const validPriorities = ["URGENT", "HIGH", "NORMAL", "LOW"];
                        const priority = validPriorities.includes(priorityRaw) ? priorityRaw : "NORMAL";

                        return {
                            id: crypto.randomUUID(),
                            title: row[titleIdx].trim(),
                            description: descriptionIdx >= 0 ? row[descriptionIdx]?.trim() || null : null,
                            listId: selectedListId,
                            statusId: defaultStatus.id,
                            priority,
                            createdById: user.id,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        };
                    });

                if (tasksToInsert.length > 0) {
                    const { error: insertError } = await supabase
                        .from("Task")
                        .insert(tasksToInsert);

                    if (insertError) {
                        console.error("Batch insert error:", insertError);
                        errors += tasksToInsert.length;
                    } else {
                        imported += tasksToInsert.length;
                    }
                }

                setProgress(Math.round(((i + batch.length) / total) * 100));
            }

            setResult({ imported, errors });
            setProgress(100);

            if (imported > 0) {
                window.dispatchEvent(new CustomEvent("dcflow:refresh"));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al procesar el archivo CSV");
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        closeModal();
        setFile(null);
        setResult(null);
        setError("");
        setProgress(0);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importar Tareas desde CSV</DialogTitle>
                    <DialogDescription>
                        Sube un archivo CSV para importar tareas masivamente a un proyecto
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Project selector */}
                    <div className="space-y-2">
                        <Label>Proyecto destino *</Label>
                        <Select value={selectedListId} onValueChange={setSelectedListId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un proyecto..." />
                            </SelectTrigger>
                            <SelectContent>
                                {lists.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.name} — {l.spaceName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* File selector */}
                    <div className="space-y-2">
                        <Label>Archivo CSV</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => document.getElementById("csv-file")?.click()}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {file ? file.name : "Seleccionar archivo..."}
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

                    {/* Error */}
                    {error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-500">{error}</p>
                        </div>
                    )}

                    {/* Progress */}
                    {importing && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Importando...</span>
                                <span className="text-foreground font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <p className="text-emerald-600 font-medium">
                                    {result.imported} tareas importadas correctamente
                                </p>
                                {result.errors > 0 && (
                                    <p className="text-red-500 mt-1">{result.errors} tareas con error</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Format info */}
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p className="font-medium">Formato del CSV:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Primera fila: encabezados</li>
                                    <li>Columna requerida: <strong>title</strong> (o task, name)</li>
                                    <li>Opcional: priority (URGENT, HIGH, NORMAL, LOW)</li>
                                    <li>Opcional: description</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border p-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Ejemplo CSV:</p>
                        <pre className="text-xs bg-secondary p-2 rounded overflow-x-auto">
                            {`title,priority,description
Diseñar landing page,HIGH,Homepage redesign
Implementar API,NORMAL,REST endpoints
Escribir tests,LOW,Unit tests`}
                        </pre>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        {result ? "Cerrar" : "Cancelar"}
                    </Button>
                    {!result && (
                        <Button
                            onClick={handleImport}
                            disabled={!file || !selectedListId || importing}
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Importar
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
