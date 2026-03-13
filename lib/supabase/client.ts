// Supabase client for browser/client components
import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

type SupabaseClient = ReturnType<typeof createBrowserClient<Database>>

// Use window to survive Next.js hot-reload module re-execution
declare global {
    interface Window { __supabase?: SupabaseClient }
}

export const createClient = (): SupabaseClient => {
    if (typeof window !== 'undefined' && window.__supabase) {
        return window.__supabase
    }
    const client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                // Replace navigator.locks with a no-op to avoid lock timeout errors
                // Safe for single-tab SPA usage
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                lock: async (_name: string, _timeout: number, fn: () => Promise<any>) => fn(),
            },
            realtime: {
                params: { eventsPerSecond: 10 },
                timeout: 10000,
            },
        }
    )
    // Browser-only: auth listeners and proactive refresh
    if (typeof window !== 'undefined') {
        // When the JWT is refreshed, pass the new token to Realtime
        // so WebSocket subscriptions don't keep using the expired one
        client.auth.onAuthStateChange((event, session) => {
            if (event === 'TOKEN_REFRESHED' && session) {
                client.realtime.setAuth(session.access_token)
            }
        })

    }

    if (typeof window !== 'undefined') {
        window.__supabase = client
    }
    return client
}
