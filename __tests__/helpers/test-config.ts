/**
 * Shared test configuration for integration tests
 *
 * Uses environment variables with fallback to staging credentials.
 * Tests require SUPABASE_SERVICE_ROLE_KEY to bypass RLS for write operations.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Staging Supabase credentials (used as fallback)
const STAGING_URL = "https://odjvwviokthebfkbqgnx.supabase.co";
const STAGING_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kanZ3dmlva3RoZWJma2JxZ254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMTU5NDAsImV4cCI6MjA4NDc5MTk0MH0.JDU6X8HZ3D9B3-9fuwx6dKspFD3eMfMnmkavb1difzY";

// Use environment variables with staging fallback
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || STAGING_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || STAGING_ANON_KEY;
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Create a Supabase client for testing
 * Uses service role key if available (bypasses RLS)
 */
export function createTestClient(): SupabaseClient {
  const keyToUse = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, keyToUse);
}

/**
 * Check if we have write access (service role key)
 */
export function hasWriteAccess(): boolean {
  return !!supabaseServiceKey;
}

/**
 * Generate a unique share code for testing
 */
export function generateTestShareCode(prefix: string = "TEST"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix.toUpperCase().slice(0, 2) + suffix;
}
