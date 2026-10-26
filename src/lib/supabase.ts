import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null when the env vars are missing or still the placeholder, so the app falls back to local preview.
export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabaseAnonKey && !supabaseAnonKey.startsWith("PASTE_")
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;
