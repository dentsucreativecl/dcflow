"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_STEPS = [
  { id: "profile", title: "Configura tu perfil", desc: "Ajusta tu nombre, foto y preferencias" },
  { id: "project", title: "Crea tu primer proyecto", desc: "Organiza tu trabajo en espacios y listas" },
  { id: "task", title: "Añade una tarea", desc: "Crea tareas con prioridad y fecha límite" },
  { id: "team", title: "Invita a tu equipo", desc: "Asigna roles y colabora en tiempo real" },
  { id: "views", title: "Explora las vistas", desc: "Kanban, lista, calendario y reportes" },
  { id: "time", title: "Registra tu primer tiempo", desc: "Usa el timer para trackear tus horas" },
];

const STORAGE_KEY = "dcflow-onboarding";

export function OnboardingChecklist() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.completed) setCompleted(data.completed);
        if (data.dismissed) setDismissed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed, dismissed }));
  }, [completed, dismissed]);

  const toggleStep = (id: string) => {
    setCompleted(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const progress = Math.round((completed.length / ONBOARDING_STEPS.length) * 100);
  const allDone = completed.length === ONBOARDING_STEPS.length;

  if (dismissed && allDone) return null;
  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          <Rocket className="h-5 w-5" />
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Primeros pasos</p>
            <p className="text-xs opacity-80">{progress}% completado</p>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-primary-foreground/30 flex items-center justify-center">
            <span className="text-xs font-bold">{completed.length}/{ONBOARDING_STEPS.length}</span>
          </div>
        </button>
      )}
      {isOpen && (
        <div className="bg-background rounded-xl shadow-2xl border overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              <h3 className="font-semibold">Primeros Pasos</h3>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button onClick={() => setDismissed(true)} className="p-1 hover:bg-white/20 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="px-4 pt-3 pb-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{progress}% completado</span>
              <span>{completed.length} de {ONBOARDING_STEPS.length}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: progress + "%" }} />
            </div>
          </div>
          <div className="p-2 max-h-60 overflow-y-auto">
            {ONBOARDING_STEPS.map((step) => {
              const isDone = completed.includes(step.id);
              return (
                <button
                  key={step.id}
                  onClick={() => toggleStep(step.id)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-studio-success mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className={cn("text-sm font-medium", isDone && "line-through text-muted-foreground")}>{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {allDone && (
            <div className="p-4 text-center border-t">
              <p className="text-sm font-medium text-studio-success">¡Excelente! Has completado todos los pasos.</p>
              <button onClick={() => setDismissed(true)} className="text-xs text-muted-foreground hover:underline mt-1">Cerrar guía</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
