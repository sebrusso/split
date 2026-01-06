/**
 * Clerk Authentication Client Configuration
 *
 * This file sets up Clerk for Expo/React Native authentication.
 */

import * as SecureStore from "expo-secure-store";

// Clerk publishable key from dashboard
// Frontend API: https://promoted-rattler-76.clerk.accounts.dev
export const CLERK_PUBLISHABLE_KEY: string = "pk_test_cHJvbW90ZWQtcmF0dGxlci03Ni5jbGVyay5hY2NvdW50cy5kZXYk";

/**
 * Token cache configuration using expo-secure-store
 * This persists auth tokens securely on the device
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      console.error("Error getting token from cache:", error);
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("Error saving token to cache:", error);
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("Error clearing token from cache:", error);
    }
  },
};

/**
 * OAuth redirect URL configuration for deep linking
 * Update this when you set up deep linking for OAuth callbacks
 */
export const OAUTH_REDIRECT_URL = "splitfree://oauth-callback";

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
