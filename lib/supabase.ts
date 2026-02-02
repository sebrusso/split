import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useMemo } from "react";
import { useAuth } from "./auth-context";
import { logger } from "./logger";

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
 *
 * IMPORTANT: For third-party auth to work, Clerk session tokens must include
 * a `role: "authenticated"` claim. This is configured in Clerk Dashboard via:
 * 1. "Connect with Supabase" feature (automatic), OR
 * 2. Session token customization (manual)
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
 * Supabase verifies tokens via Clerk's JWKS endpoint.
 *
 * REQUIREMENTS for this to work:
 * 1. Clerk Dashboard: Enable "Connect with Supabase" OR customize session tokens
 *    to include `role: "authenticated"` claim
 * 2. Supabase Dashboard: Add Clerk as third-party auth provider with your
 *    Clerk domain (e.g., clerk.split-it.net)
 *
 * @example
 * const { getSupabase } = useSupabase();
 * const authSupabase = await getSupabase();
 * const { data } = await authSupabase.from('expenses').insert({...});
 */
export function useSupabase() {
  const { getToken } = useAuth();

  const getSupabase = useCallback(async (): Promise<SupabaseClient> => {
    // Get Clerk session token for Supabase third-party auth
    //
    // The token MUST include a `role: "authenticated"` claim for Supabase
    // to recognize the user as authenticated. This is configured in Clerk:
    // - Via "Connect with Supabase" feature (adds role claim automatically)
    // - Or via session token customization in Clerk Dashboard
    //
    // Without the role claim, auth.jwt() returns NULL in Supabase and
    // RLS policies will fail with "new row violates row-level security policy"
    const token = await getToken();

    if (token) {
      // Debug: Log token claims in development to verify role claim exists
      if (__DEV__) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (!payload.role) {
            logger.warn(
              "[Supabase] Clerk token missing 'role' claim. " +
              "RLS policies will fail. Configure Clerk's 'Connect with Supabase' " +
              "feature or add role claim to session token customization."
            );
          }
        } catch {
          // Ignore parsing errors
        }
      }
      return createAuthenticatedClient(token);
    }

    // Fallback to unauthenticated client (will fail RLS checks)
    logger.warn("No auth token available, using unauthenticated Supabase client");
    return supabase;
  }, [getToken]);

  return { getSupabase };
}
