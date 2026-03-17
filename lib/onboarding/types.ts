export type OnboardingRole = "admin" | "member";

export interface TourStop {
  targetId: string; // matches data-tour-id on DOM element
  title: string;
  description: string;
  route?: string; // navigate here before showing
  side?: "top" | "bottom" | "left" | "right";
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  roles: OnboardingRole[];
  tourStops: TourStop[];
  autoDetect?: {
    table: string;
    filter: "owns" | "assigned" | "exists";
  };
}

export interface OnboardingProgress {
  completed: string[];
  dismissed: boolean;
  wizardSeen: boolean;
}

export const DEFAULT_PROGRESS: OnboardingProgress = {
  completed: [],
  dismissed: false,
  wizardSeen: false,
};
