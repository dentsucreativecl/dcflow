import { createClient } from "@/lib/supabase/client";
import type { OnboardingRole } from "./types";
import { getStepsForRole } from "./steps";

/**
 * Queries Supabase to detect which onboarding steps the user has already completed.
 * Runs all queries in parallel for speed.
 */
export async function detectCompletedSteps(
  userId: string,
  role: OnboardingRole
): Promise<string[]> {
  const supabase = createClient();
  const steps = getStepsForRole(role);
  const stepsWithDetect = steps.filter((s) => s.autoDetect);

  const results = await Promise.allSettled(
    stepsWithDetect.map(async (step) => {
      const { table, filter } = step.autoDetect!;

      let query = supabase.from(table).select("id", { count: "exact", head: true });

      if (filter === "owns") {
        query = query.eq("creatorId", userId);
      } else if (filter === "assigned") {
        query = query.eq("userId", userId);
      }
      // "exists" = no user filter, just check any row exists

      const { count } = await query;
      return { stepId: step.id, count: count ?? 0 };
    })
  );

  const completed: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.count > 0) {
      completed.push(result.value.stepId);
    }
  }

  return completed;
}
