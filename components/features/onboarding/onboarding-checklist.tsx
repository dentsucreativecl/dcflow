"use client";

import {
  CheckCircle2,
  Circle,
  ChevronDown,
  X,
  Rocket,
  LayoutDashboard,
  Building2,
  FolderKanban,
  CheckSquare,
  ClipboardList,
  Users,
  Clock,
  MessageSquare,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { getStepsForRole } from "@/lib/onboarding/steps";
import type { OnboardingRole } from "@/lib/onboarding/types";

interface OnboardingChecklistProps {
  role: OnboardingRole;
  userId: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  FolderKanban,
  CheckSquare,
  ClipboardList,
  Users,
  Clock,
  MessageSquare,
  BarChart3,
  Settings,
};

export function OnboardingChecklist({ role, userId }: OnboardingChecklistProps) {
  const {
    progress,
    isWidgetOpen,
    toggleWidget,
    dismissChecklist,
    startTour,
  } = useOnboardingStore();

  const steps = getStepsForRole(role);
  const completedCount = steps.filter((s) =>
    progress.completed.includes(s.id)
  ).length;
  const total = steps.length;
  const progressPct = Math.round((completedCount / total) * 100);
  const allDone = completedCount === total;

  if (progress.dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80">
      {/* Collapsed button */}
      {!isWidgetOpen && (
        <button
          onClick={toggleWidget}
          className="w-full flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          <Rocket className="h-5 w-5" />
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Guía de inicio</p>
            <p className="text-xs opacity-80">{progressPct}% completado</p>
          </div>
          <div className="w-10 h-10 rounded-full border-2 border-primary-foreground/30 flex items-center justify-center">
            <span className="text-xs font-bold">
              {completedCount}/{total}
            </span>
          </div>
        </button>
      )}

      {/* Expanded panel */}
      {isWidgetOpen && (
        <div className="bg-background rounded-xl shadow-2xl border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              <h3 className="font-semibold">Guía de Inicio</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleWidget}
                className="p-1 hover:bg-white/20 rounded"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => dismissChecklist(userId)}
                className="p-1 hover:bg-white/20 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{progressPct}% completado</span>
              <span>
                {completedCount} de {total}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: progressPct + "%" }}
              />
            </div>
          </div>

          {/* Steps list */}
          <div className="p-2 max-h-72 overflow-y-auto">
            {steps.map((step) => {
              const isDone = progress.completed.includes(step.id);
              const Icon = ICON_MAP[step.icon] || Circle;
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (!isDone) startTour(step.id);
                  }}
                  disabled={isDone}
                  className={cn(
                    "w-full flex items-start gap-3 p-2.5 rounded-lg transition-colors text-left",
                    isDone
                      ? "opacity-60 cursor-default"
                      : "hover:bg-muted/50 cursor-pointer"
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isDone && "line-through text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {step.description}
                    </p>
                  </div>
                  {!isDone && (
                    <span className="text-[10px] text-primary font-medium mt-1 shrink-0">
                      Iniciar
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* All done message */}
          {allDone && (
            <div className="p-4 text-center border-t">
              <p className="text-sm font-medium text-green-500">
                Has completado todos los pasos.
              </p>
              <button
                onClick={() => dismissChecklist(userId)}
                className="text-xs text-muted-foreground hover:underline mt-1"
              >
                Cerrar guía
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
