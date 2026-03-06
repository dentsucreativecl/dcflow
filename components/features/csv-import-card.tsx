"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const CSV_TEMPLATE = [
  "title,description,listId,statusId,priority,startDate,dueDate,estimatedHours",
  "Tarea de ejemplo,Descripcion de la tarea,LIST_ID,STATUS_ID,NORMAL,2025-01-15,2025-01-30,8",
  "Otra tarea,Segunda tarea de ejemplo,LIST_ID,STATUS_ID,HIGH,2025-02-01,2025-02-15,4",
].join("\n");

export function CsvImportCard() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created?: number; errors?: string[] } | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-tareas-dcflow.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/csv-import", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setResult({ created: data.created, errors: data.errors });
      } else {
        setError(data.error || "Error desconocido");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card className="p-6 col-span-full">
      <div className="flex items-center gap-2 mb-2">
        <FileSpreadsheet className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold text-foreground">Importar Tareas (CSV)</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Descarga la plantilla CSV, completa los datos y sube el archivo para crear tareas masivamente.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={downloadTemplate} className="gap-2">
          <Download className="h-4 w-4" />
          Descargar Plantilla CSV
        </Button>
        <div className="relative">
          <Button variant="default" disabled={uploading} className="gap-2" onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Importando..." : "Subir CSV"}
          </Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" />
        </div>
      </div>
      {result && (
        <div className="mt-4 p-3 rounded-md bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{result.created} tareas creadas exitosamente</span>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-600">
              {result.errors.map((err, i) => <p key={i}>{err}</p>)}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}
      <div className="mt-4 p-3 rounded-md bg-muted/50">
        <h4 className="text-sm font-medium text-foreground mb-2">Columnas del CSV:</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li><strong>title</strong> - Nombre de la tarea (requerido)</li>
          <li><strong>description</strong> - Descripción</li>
          <li><strong>listId</strong> - ID de la lista destino (requerido)</li>
          <li><strong>statusId</strong> - ID del estado</li>
          <li><strong>priority</strong> - LOW, NORMAL, HIGH, URGENT</li>
          <li><strong>startDate / dueDate</strong> - YYYY-MM-DD</li>
          <li><strong>estimatedHours</strong> - Horas estimadas</li>
        </ul>
      </div>
    </Card>
  );
}
