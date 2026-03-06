"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 max-w-md p-6">
          <h2 className="text-2xl font-bold">Error critico</h2>
          <p className="text-muted-foreground">
            La aplicacion no pudo cargar correctamente.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
