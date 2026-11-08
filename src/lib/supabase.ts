/// <reference types="vite/client" />

/**
 * Supabase Browser Client
 *
 * Used in all client-side code (React components, hooks, route loaders).
 * Uses the anon key — enforces RLS policies on every operation.
 *
 * Environment variables required (set in .env.local):
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[QuickWork] Missing Supabase credentials.\n" +
      "Set in .env.local:\n" +
      "  VITE_SUPABASE_URL=https://<project-ref>.supabase.co\n" +
      "  VITE_SUPABASE_ANON_KEY=eyJ...\n" +
      "Then restart the dev server.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type SupabaseClient = typeof supabase;
