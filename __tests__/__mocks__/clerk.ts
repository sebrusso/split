/**
 * Mock for lib/clerk.ts
 * Provides test-safe exports without environment variable requirements
 */

// Test publishable key
export const CLERK_PUBLISHABLE_KEY = "pk_test_mock_key_for_testing";

// Mock OAuth redirect URL
export const OAUTH_REDIRECT_URL = "splitfree://oauth-callback";

// Mock token cache using in-memory storage
const tokenStore = new Map<string, string>();

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    return tokenStore.get(key) || null;
  },
  async saveToken(key: string, value: string): Promise<void> {
    tokenStore.set(key, value);
  },
  async clearToken(key: string): Promise<void> {
    tokenStore.delete(key);
  },
};

/**
 * Check if Clerk is properly configured
 */
export function isClerkConfigured(): boolean {
  return (
    CLERK_PUBLISHABLE_KEY.length > 0 &&
    CLERK_PUBLISHABLE_KEY.startsWith("pk_") &&
    !CLERK_PUBLISHABLE_KEY.includes("REPLACE")
  );
}
