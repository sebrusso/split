/**
 * Clerk Authentication Client Configuration
 *
 * This file sets up Clerk for Expo/React Native authentication.
 */

import * as SecureStore from "expo-secure-store";
import logger from "./logger";

// Validate required environment variables
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const oauthRedirectUrl = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL;

if (!clerkPublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable. " +
      "Please ensure your .env.local file is properly configured."
  );
}

if (!oauthRedirectUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_OAUTH_REDIRECT_URL environment variable. " +
      "Please ensure your .env file is properly configured."
  );
}

// Clerk publishable key from environment
// Frontend API: https://promoted-rattler-76.clerk.accounts.dev
export const CLERK_PUBLISHABLE_KEY: string = clerkPublishableKey;

/**
 * Token cache configuration using expo-secure-store
 * This persists auth tokens securely on the device
 *
 * Uses AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY for better reliability:
 * - Available after first unlock since device boot
 * - Survives app restarts
 * - Device-specific (not backed up to iCloud)
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const item = await SecureStore.getItemAsync(key, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      return item;
    } catch (error: any) {
      // Log with error code for debugging keychain issues
      logger.error("Error getting token from cache:", {
        code: error?.code,
        message: error?.message,
      });
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch (error: any) {
      // Log with error code for debugging keychain issues
      logger.error("Error saving token to cache:", {
        code: error?.code,
        message: error?.message,
      });
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch (error: any) {
      logger.error("Error clearing token from cache:", {
        code: error?.code,
        message: error?.message,
      });
    }
  },
};

/**
 * OAuth redirect URL configuration for deep linking
 */
export const OAUTH_REDIRECT_URL: string = oauthRedirectUrl;

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
