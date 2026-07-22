import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Client-side Supabase instance. Safe to import in any "use client"
 * component — uses the anon key, with row-level security doing the
 * real access control (see supabase/migrations/0001_init.sql).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
