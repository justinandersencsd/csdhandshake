import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the Supabase SECRET key.
 * Bypasses Row Level Security — ONLY use this in server actions / route handlers
 * for privileged operations like creating users during invitation acceptance.
 * Never import this in a client component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
