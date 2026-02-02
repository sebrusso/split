/**
 * User Feedback Service
 *
 * Handles submission of user feedback (feature requests, general feedback)
 * to Supabase. Bug reports are handled separately via Sentry.
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { SupabaseClient } from "@supabase/supabase-js";
import { Feedback, FeedbackSubmission, FeedbackType } from "./types";
import { logger } from "./logger";
import { addBreadcrumb } from "./sentry";

/**
 * Get device information for feedback context
 */
function getDeviceInfo(): Feedback["device_info"] {
  return {
    platform: Platform.OS,
    os_version: Platform.Version?.toString() || "unknown",
    device_model: Device.modelName || "unknown",
    app_build: Constants.expoConfig?.ios?.buildNumber ||
      Constants.expoConfig?.android?.versionCode?.toString() ||
      "unknown",
  };
}

/**
 * Get the current app version from expo config
 */
function getAppVersion(): string {
  return Constants.expoConfig?.version || "1.0.0";
}

/**
 * Submit user feedback to Supabase
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - Clerk user ID
 * @param userEmail - User's email address
 * @param userName - User's display name
 * @param feedback - Feedback submission data
 * @returns The created feedback record or null on error
 */
export async function submitFeedback(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | undefined,
  userName: string | undefined,
  feedback: FeedbackSubmission
): Promise<Feedback | null> {
  try {
    addBreadcrumb("feedback", "Submitting feedback", {
      type: feedback.type,
      screen: feedback.screen_name,
    });

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        clerk_user_id: userId,
        user_email: userEmail || null,
        user_name: userName || null,
        type: feedback.type,
        message: feedback.message,
        screen_name: feedback.screen_name || null,
        app_version: getAppVersion(),
        device_info: getDeviceInfo(),
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to submit feedback:", error);
      addBreadcrumb("feedback", "Feedback submission failed", {
        error: error.message,
      });
      return null;
    }

    addBreadcrumb("feedback", "Feedback submitted successfully", {
      feedbackId: data.id,
    });

    return data as Feedback;
  } catch (error) {
    logger.error("Error submitting feedback:", error);
    return null;
  }
}

/**
 * Get user's previous feedback submissions
 *
 * @param supabase - Authenticated Supabase client
 * @returns Array of feedback records or empty array on error
 */
export async function getUserFeedback(
  supabase: SupabaseClient
): Promise<Feedback[]> {
  try {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch user feedback:", error);
      return [];
    }

    return (data as Feedback[]) || [];
  } catch (error) {
    logger.error("Error fetching user feedback:", error);
    return [];
  }
}

/**
 * Feedback type configuration for UI
 */
export const FEEDBACK_TYPES: {
  type: FeedbackType;
  label: string;
  icon: string;
  placeholder: string;
}[] = [
  {
    type: "feature",
    label: "Feature Request",
    icon: "lightbulb",
    placeholder: "I would love it if the app could...",
  },
  {
    type: "general",
    label: "General Feedback",
    icon: "comment",
    placeholder: "I wanted to share that...",
  },
  {
    type: "bug",
    label: "Bug Report",
    icon: "bug",
    placeholder: "I found an issue where...",
  },
];

/**
 * Get feedback type configuration
 */
export function getFeedbackTypeConfig(type: FeedbackType) {
  return FEEDBACK_TYPES.find((t) => t.type === type) || FEEDBACK_TYPES[1];
}
