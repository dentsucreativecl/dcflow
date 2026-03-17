"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { getStepsForRole } from "@/lib/onboarding/steps";
import { useTourTarget } from "./use-tour-target";
import type { OnboardingRole, TourStop } from "@/lib/onboarding/types";

interface TourOverlayProps {
  role: OnboardingRole;
  userId: string;
}

const PADDING = 8; // px around the spotlight target

export function TourOverlay({ role, userId }: TourOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isTourActive,
    activeTourStepId,
    activeTourStopIndex,
    nextTourStop,
    prevTourStop,
    endTour,
    completeStep,
  } = useOnboardingStore();

  const steps = getStepsForRole(role);
  const activeStep = steps.find((s) => s.id === activeTourStepId);
  const tourStops = activeStep?.tourStops ?? [];
  const currentStop: TourStop | undefined = tourStops[activeTourStopIndex];
  const isLastStop = activeTourStopIndex >= tourStops.length - 1;
  const isFirstStop = activeTourStopIndex === 0;

  // Navigate to the correct route if needed
  useEffect(() => {
    if (!isTourActive || !currentStop?.route) return;
    if (pathname !== currentStop.route) {
      router.push(currentStop.route);
    }
  }, [isTourActive, currentStop?.route, pathname, router]);

  const targetRect = useTourTarget(isTourActive ? currentStop?.targetId ?? null : null);

  const handleNext = useCallback(() => {
    if (isLastStop) {
      // Tour complete for this step
      if (activeTourStepId) {
        completeStep(activeTourStepId, userId);
      }
      endTour();
    } else {
      nextTourStop();
    }
  }, [isLastStop, activeTourStepId, completeStep, userId, endTour, nextTourStop]);

  const handleSkip = useCallback(() => {
    endTour();
  }, [endTour]);

  // Close on Escape
  useEffect(() => {
    if (!isTourActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft" && !isFirstStop) prevTourStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isTourActive, handleSkip, handleNext, isFirstStop, prevTourStop]);

  if (!isTourActive || !currentStop) return null;

  // Spotlight clip-path
  const clipPath = targetRect
    ? buildSpotlightClip(targetRect)
    : undefined;

  // Popover position
  const popoverStyle = targetRect
    ? getPopoverPosition(targetRect, currentStop.side ?? "bottom")
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      {/* Semi-transparent overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[45] bg-black/60 transition-all duration-300"
        style={clipPath ? { clipPath } : undefined}
        onClick={handleSkip}
      />

      {/* Spotlight ring highlight */}
      {targetRect && (
        <div
          className="fixed z-[45] rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - PADDING,
            left: targetRect.left - PADDING,
            width: targetRect.width + PADDING * 2,
            height: targetRect.height + PADDING * 2,
          }}
        />
      )}

      {/* Popover */}
      <div
        className="fixed z-[46] w-80 rounded-xl border bg-card p-4 shadow-2xl transition-all duration-300"
        style={popoverStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <p className="text-[11px] font-medium text-primary mb-1">
          {activeStep?.title} — {activeTourStopIndex + 1} de {tourStops.length}
        </p>

        {/* Content */}
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {currentStop.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {currentStop.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Saltar tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirstStop && (
              <Button
                variant="ghost"
                size="sm"
                onClick={prevTourStop}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="h-8 px-3">
              {isLastStop ? "Finalizar" : "Siguiente"}
              {!isLastStop && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>

        {/* Step dots */}
        {tourStops.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {tourStops.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeTourStopIndex
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function buildSpotlightClip(rect: DOMRect): string {
  const t = rect.top - PADDING;
  const l = rect.left - PADDING;
  const b = rect.bottom + PADDING;
  const r = rect.right + PADDING;
  // Polygon that covers the full screen minus the spotlight rectangle
  return `polygon(
    0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
    ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px
  )`;
}

function getPopoverPosition(
  rect: DOMRect,
  preferredSide: "top" | "bottom" | "left" | "right"
): React.CSSProperties {
  const gap = 16;
  const popoverWidth = 320;
  const popoverHeight = 200; // approximate

  // Calculate available space on each side
  const spaceTop = rect.top;
  const spaceBottom = window.innerHeight - rect.bottom;
  const spaceLeft = rect.left;
  const spaceRight = window.innerWidth - rect.right;

  // Choose side
  let side = preferredSide;
  if (side === "bottom" && spaceBottom < popoverHeight + gap) {
    side = spaceTop > spaceBottom ? "top" : "right";
  } else if (side === "top" && spaceTop < popoverHeight + gap) {
    side = spaceBottom > spaceTop ? "bottom" : "right";
  } else if (side === "left" && spaceLeft < popoverWidth + gap) {
    side = "right";
  } else if (side === "right" && spaceRight < popoverWidth + gap) {
    side = "left";
  }

  switch (side) {
    case "bottom":
      return {
        top: rect.bottom + gap + PADDING,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8)),
      };
    case "top":
      return {
        bottom: window.innerHeight - rect.top + gap + PADDING,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8)),
      };
    case "right":
      return {
        top: Math.max(8, rect.top),
        left: rect.right + gap + PADDING,
      };
    case "left":
      return {
        top: Math.max(8, rect.top),
        right: window.innerWidth - rect.left + gap + PADDING,
      };
  }
}
