import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client configuration
 *
 * Credentials are loaded from environment variables.
 * For development, create a .env file from .env.example
 * For production, configure in EAS secrets or CI/CD
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const isTest = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  if (!isTest) {
    throw new Error(
      "Missing Supabase environment variables. " +
        "Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file."
    );
  }
}

// Use placeholder values in test environment if env vars are not set
const url = supabaseUrl || "https://test.supabase.co";
const key = supabaseAnonKey || "test-anon-key";

export const supabase = createClient(url, key);
