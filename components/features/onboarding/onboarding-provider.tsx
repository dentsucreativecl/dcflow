"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { detectCompletedSteps } from "@/lib/onboarding/auto-detect";
import { WelcomeWizard } from "./welcome-wizard";
import { OnboardingChecklist } from "./onboarding-checklist";
import { TourOverlay } from "./tour-overlay";
import type { OnboardingRole } from "@/lib/onboarding/types";

function getRoleCategory(
  isAdmin: boolean,
  isPM: boolean
): OnboardingRole {
  if (isAdmin || isPM) return "admin";
  return "member";
}

export function OnboardingProvider() {
  const { user, isAdmin, isPM, authLoading } = useAuth();
  const { loaded, loadProgress, mergeAutoDetected } = useOnboardingStore();

  // Skip for guests
  const isGuest = user?.userType === "GUEST";
  const role = getRoleCategory(isAdmin, isPM);

  // Load progress from Supabase
  useEffect(() => {
    if (authLoading || !user?.id || isGuest) return;
    loadProgress(user.id);
  }, [authLoading, user?.id, isGuest, loadProgress]);

  // Auto-detect completed steps
  useEffect(() => {
    if (!loaded || !user?.id || isGuest) return;

    detectCompletedSteps(user.id, role).then((detected) => {
      if (detected.length > 0) {
        mergeAutoDetected(detected, user.id);
      }
    });
  }, [loaded, user?.id, isGuest, role, mergeAutoDetected]);

  // Don't render for guests or while loading
  if (authLoading || !user?.id || isGuest || !loaded) return null;

  return (
    <>
      <WelcomeWizard userName={user.name || ""} role={role} userId={user.id} />
      <OnboardingChecklist role={role} userId={user.id} />
      <TourOverlay role={role} userId={user.id} />
    </>
  );
}
