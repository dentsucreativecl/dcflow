"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

const shortcuts = [
  { keys: ["⌘", "K"], description: "Buscar globalmente" },
  { keys: ["⌘", "N"], description: "Nuevo proyecto" },
  { keys: ["Esc"], description: "Cerrar modal/panel" },
  { keys: ["?"], description: "Mostrar atajos de teclado" },
  { keys: ["1-6"], description: "Navegar entre secciones" },
  { keys: ["T"], description: "Cambiar tema claro/oscuro" },
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
      <div className="bg-background rounded-xl shadow-2xl border w-[420px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Atajos de Teclado</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key, ki) => (
                  <span key={ki}>
                    <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border shadow-sm">{key}</kbd>
                    {ki < s.keys.length - 1 && <span className="text-xs text-muted-foreground mx-1">+</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t text-center">
          <span className="text-xs text-muted-foreground">Presiona <kbd className="px-1 py-0.5 text-xs font-mono bg-muted rounded border">?</kbd> para abrir/cerrar</span>
        </div>
      </div>
    </div>
  );
}
