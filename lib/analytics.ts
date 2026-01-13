/**
 * Analytics Module - PostHog Integration
 *
 * Provides analytics tracking for user behavior and UX insights.
 * Features:
 * - Event tracking
 * - Screen view tracking
 * - User identification
 * - Session replay with privacy masking
 * - Opt-out support
 */

import PostHog, { PostHogOptions } from "posthog-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

// Type for event properties
type EventProperties = Record<string, string | number | boolean | null | undefined>;

// Storage key for opt-out preference
const ANALYTICS_OPT_OUT_KEY = "@splitfree/analytics_opt_out";

// PostHog configuration
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "";
const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

// PostHog client instance
let posthogClient: PostHog | null = null;

/**
 * Check if analytics is properly configured
 */
export function isAnalyticsConfigured(): boolean {
  return Boolean(POSTHOG_API_KEY);
}

/**
 * Initialize PostHog analytics
 * Should be called once at app startup
 */
export async function initAnalytics(): Promise<PostHog | null> {
  if (!isAnalyticsConfigured()) {
    if (__DEV__) {
      logger.warn(
        "PostHog not configured. Set EXPO_PUBLIC_POSTHOG_API_KEY in .env"
      );
    }
    return null;
  }

  try {
    // Check if user has opted out
    const optedOut = await getOptOutPreference();

    // Log API key (masked) for debugging
    if (__DEV__) {
      logger.debug(
        "PostHog config:",
        `key=${POSTHOG_API_KEY.substring(0, 10)}...`,
        `host=${POSTHOG_HOST}`
      );
    }

    const options: PostHogOptions = {
      host: POSTHOG_HOST,
      // Flush events every 10 seconds (default is 30)
      flushInterval: 10000,
      // Flush after 10 events (default is 20)
      flushAt: 10,
      // Enable session replay
      enableSessionReplay: true,
      sessionReplayConfig: {
        // Privacy: mask all text inputs (amounts, names, etc.)
        maskAllTextInputs: true,
        // Keep images visible (receipts are useful for debugging)
        maskAllImages: false,
        // Capture console logs for debugging
        captureLog: true,
        // Android debounce for performance
        androidDebouncerDelayMs: 500,
      },
      // Respect opt-out preference
      disabled: optedOut,
    };

    posthogClient = new PostHog(POSTHOG_API_KEY, options);

    logger.info("PostHog analytics initialized");
    return posthogClient;
  } catch (error) {
    logger.error("Failed to initialize PostHog:", error);
    return null;
  }
}

/**
 * Get the PostHog client instance
 */
export function getPostHog(): PostHog | null {
  return posthogClient;
}

/**
 * Identify a user for analytics
 * Links all future events to this user ID
 */
export function identify(
  userId: string,
  traits?: EventProperties
): void {
  if (!posthogClient) return;

  try {
    posthogClient.identify(userId, traits as Record<string, string | number | boolean>);
    logger.debug("Analytics: User identified", userId);
  } catch (error) {
    logger.error("Analytics: Failed to identify user", error);
  }
}

/**
 * Reset user identity (on sign out)
 */
export function resetIdentity(): void {
  if (!posthogClient) return;

  try {
    posthogClient.reset();
    logger.debug("Analytics: Identity reset");
  } catch (error) {
    logger.error("Analytics: Failed to reset identity", error);
  }
}

/**
 * Track a custom event
 */
export function trackEvent(
  eventName: string,
  properties?: EventProperties
): void {
  if (!posthogClient) return;

  try {
    posthogClient.capture(eventName, properties as Record<string, string | number | boolean>);
    logger.debug("Analytics: Event tracked", eventName, properties);
  } catch (error) {
    logger.error("Analytics: Failed to track event", error);
  }
}

/**
 * Track a screen view
 */
export function trackScreen(
  screenName: string,
  properties?: EventProperties
): void {
  if (!posthogClient) return;

  try {
    posthogClient.screen(screenName, properties as Record<string, string | number | boolean>);
    logger.debug("Analytics: Screen tracked", screenName);
  } catch (error) {
    logger.error("Analytics: Failed to track screen", error);
  }
}

/**
 * Get user's opt-out preference from storage
 */
export async function getOptOutPreference(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ANALYTICS_OPT_OUT_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Set user's opt-out preference
 */
export async function setOptOut(optOut: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ANALYTICS_OPT_OUT_KEY, String(optOut));

    if (posthogClient) {
      if (optOut) {
        posthogClient.optOut();
        logger.info("Analytics: User opted out");
      } else {
        posthogClient.optIn();
        logger.info("Analytics: User opted in");
      }
    }
  } catch (error) {
    logger.error("Analytics: Failed to set opt-out preference", error);
  }
}

/**
 * Flush pending events (useful before app closes)
 */
export async function flushAnalytics(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.flush();
    logger.debug("Analytics: Events flushed");
  } catch (error) {
    logger.error("Analytics: Failed to flush events", error);
  }
}

/**
 * Shutdown analytics (on app close)
 */
export async function shutdownAnalytics(): Promise<void> {
  if (!posthogClient) return;

  try {
    await posthogClient.shutdown();
    posthogClient = null;
    logger.debug("Analytics: Shutdown complete");
  } catch (error) {
    logger.error("Analytics: Failed to shutdown", error);
  }
}

// Event name constants for consistency
export const AnalyticsEvents = {
  // Onboarding events
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_SKIPPED: "onboarding_skipped",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // Auth events
  SIGN_UP_COMPLETED: "sign_up_completed",
  SIGN_IN_COMPLETED: "sign_in_completed",
  SIGN_OUT: "sign_out",

  // Group events
  GROUP_CREATED: "group_created",
  GROUP_JOINED: "group_joined",
  GROUP_LEFT: "group_left",

  // Expense events
  EXPENSE_ADDED: "expense_added",
  EXPENSE_EDITED: "expense_edited",
  EXPENSE_DELETED: "expense_deleted",

  // Member events
  MEMBER_INVITED: "member_invited",
  MEMBER_REMOVED: "member_removed",

  // Receipt events
  RECEIPT_SCANNED: "receipt_scanned",
  RECEIPT_CLAIMED: "receipt_claimed",
  RECEIPT_SETTLED: "receipt_settled",

  // Settlement events
  SETTLE_UP_COMPLETED: "settle_up_completed",

  // Feature usage
  DEEP_LINK_OPENED: "deep_link_opened",
  SHARE_LINK_CREATED: "share_link_created",
} as const;
