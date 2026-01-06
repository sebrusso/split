/**
 * Authentication Context Provider
 *
 * Provides authentication state and helpers throughout the app.
 * Wraps Clerk's useAuth and useUser hooks with app-specific functionality.
 */

import React, { createContext, useContext, useMemo } from "react";
import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-expo";
import { UserProfile } from "./types";

interface AuthContextValue {
  // Authentication state
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;

  // User profile data
  user: UserProfile | null;

  // Auth actions
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider component
 * Wrap your app with this to access auth state anywhere
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoaded, isSignedIn, userId, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();

  // Transform Clerk user to our UserProfile format
  const user = useMemo((): UserProfile | null => {
    if (!clerkUser) return null;

    return {
      id: clerkUser.id,
      clerkId: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress || "",
      displayName:
        clerkUser.fullName ||
        clerkUser.firstName ||
        clerkUser.username ||
        "User",
      avatarUrl: clerkUser.imageUrl || null,
      defaultCurrency: "USD", // Default currency, can be updated in settings
      createdAt: clerkUser.createdAt?.toISOString() || new Date().toISOString(),
    };
  }, [clerkUser]);

  const signOut = async () => {
    try {
      await clerkSignOut();
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const value: AuthContextValue = {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    userId: userId ?? null,
    user,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth hook
 * Access authentication state and actions
 *
 * @example
 * const { isSignedIn, user, signOut } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Get current user ID
 * Returns the Clerk user ID if signed in, null otherwise
 *
 * This is useful for other parts of the app that need the user ID
 * without needing the full auth context.
 *
 * @returns The current user's Clerk ID or null
 */
export function getCurrentUserId(): string | null {
  // Note: This is a simplified version. In components, use useAuth() hook instead.
  // This function is meant for use in non-component code.
  return null;
}

/**
 * Hook to get current user ID reactively
 * Use this in components for proper React lifecycle
 */
export function useCurrentUserId(): string | null {
  const { userId } = useAuth();
  return userId;
}
