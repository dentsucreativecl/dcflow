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
    console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    const client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                // Replace navigator.locks with a no-op to avoid lock timeout errors
                // Safe for single-tab SPA usage
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                lock: async (_name: string, _timeout: number, fn: () => Promise<any>) => fn(),
            },
        }
    )
    if (typeof window !== 'undefined') {
        window.__supabase = client
    }
    return client
}

export const supabase = createClient()
