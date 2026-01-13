/**
 * Analytics Provider
 *
 * React context provider for PostHog analytics.
 * Initializes analytics on mount and provides tracking functions to children.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { PostHogProvider as PHProvider } from "posthog-react-native";
import {
  initAnalytics,
  getPostHog,
  identify,
  resetIdentity,
  trackEvent,
  trackScreen,
  setOptOut,
  getOptOutPreference,
  isAnalyticsConfigured,
  AnalyticsEvents,
} from "./analytics";
import { useAuth } from "./auth-context";
import { logger } from "./logger";

interface AnalyticsContextValue {
  isReady: boolean;
  isOptedOut: boolean;
  trackEvent: typeof trackEvent;
  trackScreen: typeof trackScreen;
  setOptOut: (optOut: boolean) => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(
  undefined
);

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

/**
 * Analytics Provider Component
 *
 * Wrap your app with this to enable analytics throughout.
 * Automatically identifies users when they sign in.
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isOptedOut, setIsOptedOut] = useState(false);
  const { isSignedIn, userId, user } = useAuth();

  // Initialize analytics on mount
  useEffect(() => {
    async function init() {
      if (!isAnalyticsConfigured()) {
        setIsReady(true);
        return;
      }

      const optedOut = await getOptOutPreference();
      setIsOptedOut(optedOut);

      await initAnalytics();
      setIsReady(true);
    }

    init();
  }, []);

  // Identify user when auth state changes
  useEffect(() => {
    if (!isReady) return;

    if (isSignedIn && userId) {
      // User signed in - identify them
      identify(userId, {
        email: user?.email,
        displayName: user?.displayName,
        currency: user?.defaultCurrency,
      });
    } else if (!isSignedIn) {
      // User signed out - reset identity
      resetIdentity();
    }
  }, [isReady, isSignedIn, userId, user]);

  // Handle opt-out changes
  const handleSetOptOut = async (optOut: boolean) => {
    await setOptOut(optOut);
    setIsOptedOut(optOut);
  };

  const value: AnalyticsContextValue = {
    isReady,
    isOptedOut,
    trackEvent,
    trackScreen,
    setOptOut: handleSetOptOut,
  };

  // If PostHog is configured, wrap with their provider for session replay
  const posthog = getPostHog();

  if (posthog) {
    return (
      <PHProvider client={posthog}>
        <AnalyticsContext.Provider value={value}>
          {children}
        </AnalyticsContext.Provider>
      </PHProvider>
    );
  }

  // Fallback without PostHog provider (when not configured)
  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// No-op functions for when analytics isn't available
const noopTrackEvent = () => {};
const noopTrackScreen = () => {};
const noopSetOptOut = async () => {};

const defaultAnalyticsValue: AnalyticsContextValue = {
  isReady: false,
  isOptedOut: false,
  trackEvent: noopTrackEvent,
  trackScreen: noopTrackScreen,
  setOptOut: noopSetOptOut,
};

/**
 * Hook to access analytics functions
 * Returns no-op functions if used outside provider (graceful fallback)
 */
export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);
  // Return default value instead of throwing - allows usage before provider is ready
  if (context === undefined) {
    return defaultAnalyticsValue;
  }
  return context;
}

// Re-export event constants for convenience
export { AnalyticsEvents };
