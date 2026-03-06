"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold text-foreground">
          Error al cargar la pagina
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Ocurrio un error inesperado."}
        </p>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </div>
  );
}
