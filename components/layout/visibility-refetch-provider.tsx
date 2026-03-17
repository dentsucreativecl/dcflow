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
        let refreshing = false;

        const handleVisibilityChange = async () => {
            if (document.visibilityState !== "visible") return;
            if (refreshing) return; // Prevent concurrent runs
            refreshing = true;

            const supabase = createClient();

            try {
                // Force a real token refresh from the server.
                // The serializing lock in client.ts ensures this doesn't
                // race with autoRefreshToken's internal timer.
                const { data, error } = await supabase.auth.refreshSession();

                if (data.session) {
                    // Propagate fresh JWT to Realtime WebSocket subscriptions
                    supabase.realtime.setAuth(data.session.access_token);
                    // Notify all pages to re-fetch their data with the fresh token
                    window.dispatchEvent(new Event("dcflow:refresh"));
                } else if (error) {
                    // Refresh token expired or invalid — check if there's a
                    // cached session that might still work (network glitch).
                    const { data: { session: cached } } = await supabase.auth.getSession();
                    if (cached) {
                        // Cached session exists — let pages try with it
                        window.dispatchEvent(new Event("dcflow:refresh"));
                    } else {
                        // No session at all — force re-login
                        window.location.href = "/login";
                    }
                }
            } catch {
                // Network error — dispatch refresh anyway so pages try with
                // whatever token is available. Safety nets handle the rest.
                window.dispatchEvent(new Event("dcflow:refresh"));
            } finally {
                refreshing = false;
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, []);

    return <>{children}</>;
}
