"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingProgress } from "./types";
import { DEFAULT_PROGRESS } from "./types";

interface OnboardingState {
  // Persisted state (synced with Supabase)
  progress: OnboardingProgress;
  loaded: boolean;

  // Transient UI state
  isWidgetOpen: boolean;
  isTourActive: boolean;
  activeTourStepId: string | null;
  activeTourStopIndex: number;

  // Actions — persistence
  loadProgress: (userId: string) => Promise<OnboardingProgress>;
  persistProgress: (userId: string, progress: OnboardingProgress) => void;
  markWizardSeen: (userId: string) => void;
  completeStep: (stepId: string, userId: string) => void;
  mergeAutoDetected: (stepIds: string[], userId: string) => void;
  dismissChecklist: (userId: string) => void;
  resetOnboarding: (userId: string) => void;

  // Actions — tour
  startTour: (stepId: string) => void;
  nextTourStop: () => void;
  prevTourStop: () => void;
  endTour: () => void;

  // Actions — widget
  toggleWidget: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  progress: DEFAULT_PROGRESS,
  loaded: false,
  isWidgetOpen: false,
  isTourActive: false,
  activeTourStepId: null,
  activeTourStopIndex: 0,

  loadProgress: async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("User")
      .select("onboardingProgress")
      .eq("id", userId)
      .single();

    const raw = data?.onboardingProgress as Partial<OnboardingProgress> | null;
    const progress: OnboardingProgress = {
      completed: raw?.completed ?? [],
      dismissed: raw?.dismissed ?? false,
      wizardSeen: raw?.wizardSeen ?? false,
    };

    set({ progress, loaded: true });
    return progress;
  },

  persistProgress: (userId: string, progress: OnboardingProgress) => {
    const supabase = createClient();
    supabase
      .from("User")
      .update({ onboardingProgress: progress })
      .eq("id", userId)
      .then(() => {});
  },

  markWizardSeen: (userId: string) => {
    const { progress, persistProgress } = get();
    const updated = { ...progress, wizardSeen: true };
    set({ progress: updated });
    persistProgress(userId, updated);
  },

  completeStep: (stepId: string, userId: string) => {
    const { progress, persistProgress } = get();
    if (progress.completed.includes(stepId)) return;
    const updated = {
      ...progress,
      completed: [...progress.completed, stepId],
    };
    set({ progress: updated });
    persistProgress(userId, updated);
  },

  mergeAutoDetected: (stepIds: string[], userId: string) => {
    const { progress, persistProgress } = get();
    const newCompleted = [...new Set([...progress.completed, ...stepIds])];
    if (newCompleted.length === progress.completed.length) return; // no change
    const updated = { ...progress, completed: newCompleted };
    set({ progress: updated });
    persistProgress(userId, updated);
  },

  dismissChecklist: (userId: string) => {
    const { progress, persistProgress } = get();
    const updated = { ...progress, dismissed: true };
    set({ progress: updated });
    persistProgress(userId, updated);
  },

  resetOnboarding: (userId: string) => {
    const updated = { ...DEFAULT_PROGRESS };
    set({ progress: updated, isWidgetOpen: false, isTourActive: false });
    const { persistProgress } = get();
    persistProgress(userId, updated);
  },

  startTour: (stepId: string) => {
    set({
      isTourActive: true,
      activeTourStepId: stepId,
      activeTourStopIndex: 0,
      isWidgetOpen: false,
    });
  },

  nextTourStop: () => {
    set((state) => ({
      activeTourStopIndex: state.activeTourStopIndex + 1,
    }));
  },

  prevTourStop: () => {
    set((state) => ({
      activeTourStopIndex: Math.max(0, state.activeTourStopIndex - 1),
    }));
  },

  endTour: () => {
    set({
      isTourActive: false,
      activeTourStepId: null,
      activeTourStopIndex: 0,
    });
  },

  toggleWidget: () => {
    set((state) => ({ isWidgetOpen: !state.isWidgetOpen }));
  },
}));
