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
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      logger.error("Error getting token from cache:", error);
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      logger.error("Error saving token to cache:", error);
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logger.error("Error clearing token from cache:", error);
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
