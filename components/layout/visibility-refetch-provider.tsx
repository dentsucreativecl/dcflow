"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Global provider that refreshes auth + dispatches dcflow:refresh
 * whenever the user returns to the tab after inactivity.
 *
 * Wrap once in the dashboard layout — all pages that listen to
 * dcflow:refresh will re-fetch their data automatically.
 */
export function VisibilityRefetchProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState !== "visible") return;

            const supabase = createClient();

            try {
                // Force session refresh — this renews the JWT if expired
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) return;

                // Check if the token is stale (less than 60s remaining)
                const secsLeft = session.expires_at
                    ? session.expires_at - Math.floor(Date.now() / 1000)
                    : Infinity;

                if (secsLeft < 60) {
                    await supabase.auth.refreshSession();
                }
            } catch {
                // Silent — page-level safety nets handle the fallback
            }

            // Notify all pages to re-fetch their data
            window.dispatchEvent(new Event("dcflow:refresh"));
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    return <>{children}</>;
}
