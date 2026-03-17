"use client";

import { useState } from "react";
import { Rocket, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { OnboardingRole } from "@/lib/onboarding/types";

interface WelcomeWizardProps {
  userName: string;
  role: OnboardingRole;
  userId: string;
}

const ADMIN_FEATURES = [
  "Gestionar clientes y proyectos de la agencia",
  "Crear y asignar tareas con múltiples vistas",
  "Invitar miembros y gestionar roles del equipo",
  "Registrar y analizar horas de trabajo",
  "Comunicarte en canales en tiempo real",
  "Ver reportes y métricas de rendimiento",
];

const MEMBER_FEATURES = [
  "Ver y gestionar tus tareas asignadas",
  "Registrar horas de trabajo con el timer",
  "Comunicarte con tu equipo en canales",
  "Personalizar tu perfil y preferencias",
];

export function WelcomeWizard({ userName, role, userId }: WelcomeWizardProps) {
  const { progress, markWizardSeen } = useOnboardingStore();
  const [step, setStep] = useState(0);

  if (progress.wizardSeen) return null;

  const features = role === "admin" ? ADMIN_FEATURES : MEMBER_FEATURES;
  const firstName = userName.split(" ")[0] || "Hola";

  const handleFinish = () => {
    markWizardSeen(userId);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleFinish(); }}>
      <DialogContent className="sm:max-w-md">
        {step === 0 && (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Rocket className="h-7 w-7 text-primary" />
              </div>
              <DialogTitle className="text-xl">
                Bienvenido a DC Flow, {firstName}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed mt-2">
                Tu plataforma centralizada para gestionar proyectos, tareas, tiempo y
                comunicación del equipo en dentsu creative.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-center mt-4">
              <Button onClick={() => setStep(1)} className="gap-2">
                Continuar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <DialogTitle className="text-lg">
                {role === "admin"
                  ? "Lo que podrás hacer como Admin"
                  : "Lo que podrás hacer"}
              </DialogTitle>
            </DialogHeader>

            <ul className="space-y-2.5 mt-3">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 mt-5">
              <Button onClick={handleFinish} className="w-full gap-2">
                <Rocket className="h-4 w-4" />
                Comenzar
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                La guía estará siempre disponible en la esquina inferior derecha
              </p>
            </div>
          </>
        )}

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
