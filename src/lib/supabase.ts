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
 *
 * Without real credentials the app runs in PREVIEW/MOCK mode —
 * all data pages fall back to mock data instead of crashing.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as
  | string
  | undefined;

// Detect whether the env vars are real (not placeholder/empty)
const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("placeholder") ||
  supabaseAnonKey.includes("placeholder");

if (isPlaceholder) {
  console.warn(
    "[QuickWork] Supabase credentials not configured — running in PREVIEW mode.\n" +
      "Create .env.local with:\n" +
      "  VITE_SUPABASE_URL=https://<project-ref>.supabase.co\n" +
      "  VITE_SUPABASE_ANON_KEY=eyJ...\n" +
      "Then restart the dev server.",
  );
}

// Provide safe fallback values so createClient never throws at import time.
// All real Supabase calls will fail gracefully and pages fall back to mock data.
const SAFE_URL = isPlaceholder
  ? "https://placeholder.supabase.co"
  : supabaseUrl!;
const SAFE_KEY = isPlaceholder
  ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder"
  : supabaseAnonKey!;

export const supabase = createClient<Database>(SAFE_URL, SAFE_KEY, {
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
