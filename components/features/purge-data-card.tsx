"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

export function PurgeDataCard() {
  const [purging, setPurging] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handlePurge = async () => {
    setPurging(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/purge", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult("Datos eliminados exitosamente. Recarga la página.");
      } else {
        setResult("Error: " + (data.error || "desconocido"));
      }
    } catch (e: unknown) {
      setResult("Error de red: " + (e instanceof Error ? e.message : "Error desconocido"));
    }
    setPurging(false);
    setConfirm(false);
    setConfirmText("");
  };

  return (
    <Card className="p-6 border-red-200 bg-red-50/50 col-span-full">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <h3 className="font-semibold text-red-700">Gestión de Datos</h3>
      </div>
      <p className="text-sm text-red-600 mb-4">
        Elimina todo el contenido simulado para partir desde cero.
      </p>
      {!confirm ? (
        <Button variant="destructive" onClick={() => setConfirm(true)} className="gap-2">
          <Trash2 className="h-4 w-4" />
          Purgar Datos Simulados
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-red-700">
            ¿Estás seguro? Esta acción eliminará TODOS los datos simulados y no se puede deshacer.
          </p>
          <p className="text-sm text-red-600">
            Escribe <strong>ELIMINAR</strong> para confirmar:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ELIMINAR"
            className="border-red-300 focus-visible:ring-red-400 max-w-xs"
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={purging || confirmText !== "ELIMINAR"}
              className="gap-2"
            >
              {purging ? "Eliminando..." : "Sí, Eliminar Todo"}
            </Button>
            <Button variant="outline" onClick={() => { setConfirm(false); setConfirmText(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {result && (
        <p className={"text-sm mt-3 font-medium " + (result.startsWith("Error") ? "text-red-600" : "text-green-600")}>
          {result}
        </p>
      )}
    </Card>
  );
}
