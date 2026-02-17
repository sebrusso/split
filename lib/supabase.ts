import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useMemo, useCallback } from "react";
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

// Unauthenticated client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Hook that provides an authenticated Supabase client
 *
 * Uses Supabase's native third-party auth integration with Clerk.
 * The client is created ONCE with a dynamic accessToken callback that
 * fetches a fresh Clerk token for each request.
 *
 * REQUIREMENTS for this to work:
 * 1. Clerk Dashboard: Enable "Connect with Supabase" (adds role claim automatically)
 * 2. Supabase Dashboard: Add Clerk as third-party auth provider with your
 *    Clerk domain (e.g., https://clerk.split-it.net)
 *
 * @example
 * const { supabase } = useSupabase();
 * const { data } = await supabase.from('expenses').insert({...});
 */
export function useSupabase() {
  const { getToken } = useAuth();

  // Create a single authenticated client with a dynamic accessToken callback
  // This matches the Clerk docs pattern where getToken() is called inside the callback
  const authenticatedClient = useMemo(() => {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
      // Dynamic accessToken callback - fetches fresh token for each request
      // This is the pattern recommended by Clerk for Supabase third-party auth
      accessToken: async () => {
        const token = await getToken();
        return token ?? null;
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }, [getToken]);

  // Legacy API - returns a promise for backwards compatibility
  // Memoized to prevent infinite re-render loops in hooks that depend on this
  const getSupabase = useCallback(async (): Promise<SupabaseClient> => {
    return authenticatedClient;
  }, [authenticatedClient]);

  return {
    supabase: authenticatedClient,  // New: direct access to client
    getSupabase,                     // Legacy: async getter for compatibility
  };
}
