import { createClient } from "@supabase/supabase-js";

// Validate required environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL environment variable. " +
      "Please ensure your .env file is properly configured."
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
      "Please ensure your .env.local file is properly configured."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Creates a Supabase client with the user's Clerk JWT
 * This is required for RLS policies to work correctly
 */
export function createAuthenticatedClient(clerkToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${clerkToken}`,
      },
    },
  });
}
