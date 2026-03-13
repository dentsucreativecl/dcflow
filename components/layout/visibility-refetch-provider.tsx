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
                // Force a real token refresh from the server — getSession() only
                // returns the cached (possibly expired) token
                const { data } = await supabase.auth.refreshSession();

                if (data.session) {
                    // Propagate fresh JWT to Realtime WebSocket subscriptions
                    supabase.realtime.setAuth(data.session.access_token);
                    // Notify all pages to re-fetch their data with the fresh token
                    window.dispatchEvent(new Event("dcflow:refresh"));
                }
            } catch {
                // Silent — page-level safety nets handle the fallback
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    return <>{children}</>;
}
