import { createClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase client with anon key.
 * Safe for use in client components. RLS policies apply.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, anonKey);
}
