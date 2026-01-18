import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useCallback } from "react";
import { useAuth } from "./auth-context";

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
 * Creates a Supabase client with the user's Clerk session token
 * Uses native Supabase third-party auth (Clerk verified via JWKS)
 */
export function createAuthenticatedClient(clerkToken: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${clerkToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Hook that provides an authenticated Supabase client
 * The client is automatically configured with the user's Clerk session token
 * for RLS policies to work correctly.
 *
 * Uses Supabase's native third-party auth integration with Clerk.
 * Supabase verifies tokens via Clerk's JWKS endpoint - no JWT template needed.
 *
 * @example
 * const { getSupabase } = useSupabase();
 * const authSupabase = await getSupabase();
 * const { data } = await authSupabase.from('expenses').insert({...});
 */
export function useSupabase() {
  const { getToken } = useAuth();

  const getSupabase = useCallback(async (): Promise<SupabaseClient> => {
    // Get Clerk session token (native Supabase third-party auth integration)
    // No JWT template needed - Supabase verifies via Clerk's JWKS (RS256)
    const token = await getToken();

    if (token) {
      return createAuthenticatedClient(token);
    }

    // Fallback to unauthenticated client (will fail RLS checks)
    console.warn("No auth token available, using unauthenticated Supabase client");
    return supabase;
  }, [getToken]);

  return { getSupabase };
}
