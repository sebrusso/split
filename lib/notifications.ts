/**
 * Push Notification Setup
 *
 * Infrastructure for Expo push notifications.
 * Handles permission requests, token registration, and notification handlers.
 *
 * Note: Sending push notifications requires a backend service.
 * This file provides the client-side infrastructure and helper functions.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { supabase } from "./supabase";

/**
 * Push token storage in user profile
 */
interface PushTokenData {
  token: string;
  platform: string;
  createdAt: string;
}

/**
 * Register for push notifications and get the token
 * @returns Push token string or null if registration failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check if we're running on a physical device
    // Push notifications don't work on simulators/emulators
    if (!Device.isDevice) {
      console.log(
        "Push notifications require a physical device (not available on simulator/emulator)"
      );
      return null;
    }

    // Check current permission status
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // If permission denied, return null
    if (finalStatus !== "granted") {
      console.log("Push notification permission denied");
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    console.log("Push notification token obtained:", token);
    return token;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Save push token to database
 * Stores the token in the push_tokens table
 * @param userId - The user's Clerk ID
 * @param token - The Expo push token
 */
export async function savePushToken(
  userId: string,
  token: string
): Promise<void> {
  try {
    // Check if token already exists for this user
    const { data: existingToken } = await supabase
      .from("push_tokens")
      .select("id, token")
      .eq("user_id", userId)
      .eq("token", token)
      .single();

    if (existingToken) {
      // Token already exists, just update the timestamp
      const { error } = await supabase
        .from("push_tokens")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existingToken.id);

      if (error) {
        console.error("Error updating push token timestamp:", error);
      } else {
        console.log("Push token timestamp updated");
      }
      return;
    }

    // Insert new token
    const { error } = await supabase.from("push_tokens").insert({
      user_id: userId,
      token,
      platform: Platform.OS,
    });

    if (error) {
      console.error("Error saving push token:", error);
    } else {
      console.log("Push token saved successfully");
    }
  } catch (error) {
    console.error("Error saving push token:", error);
  }
}

/**
 * Remove push token from database
 * Call this when the user signs out or revokes notification permissions
 * @param userId - The user's Clerk ID
 * @param token - Optional specific token to remove (if not provided, removes all tokens for user)
 */
export async function removePushToken(
  userId: string,
  token?: string
): Promise<void> {
  try {
    let query = supabase.from("push_tokens").delete().eq("user_id", userId);

    if (token) {
      // Remove specific token
      query = query.eq("token", token);
    }

    const { error } = await query;

    if (error) {
      console.error("Error removing push token:", error);
    } else {
      console.log(
        `Push token${token ? "" : "s"} removed successfully for user ${userId}`
      );
    }
  } catch (error) {
    console.error("Error removing push token:", error);
  }
}

/**
 * Request notification permissions (simplified wrapper)
 * @returns true if permissions granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return false;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    if (existingStatus === "granted") {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error requesting notification permissions:", error);
    return false;
  }
}

/**
 * Register push token and save to database
 * Convenience function that combines token registration and saving
 * @param userId - The user's Clerk ID
 * @returns The push token if successful, null otherwise
 */
export async function registerPushToken(
  userId: string
): Promise<string | null> {
  try {
    const token = await registerForPushNotifications();

    if (token) {
      await savePushToken(userId, token);
      return token;
    }

    return null;
  } catch (error) {
    console.error("Error registering push token:", error);
    return null;
  }
}

/**
 * Schedule a local notification
 * Useful for testing and for reminder notifications
 * @param title - Notification title
 * @param body - Notification body
 * @param trigger - When to send the notification (seconds from now, or specific date)
 * @returns Notification identifier
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: number | Date
): Promise<string | null> {
  try {
    let triggerConfig: Notifications.NotificationTriggerInput;

    if (typeof trigger === "number") {
      // Schedule notification X seconds from now
      triggerConfig = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: trigger,
        repeats: false,
      };
    } else {
      // Schedule notification at specific date/time
      triggerConfig = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      };
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: triggerConfig,
    });

    return identifier;
  } catch (error) {
    console.error("Error scheduling local notification:", error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 * @param identifier - The notification identifier returned from scheduleLocalNotification
 */
export async function cancelScheduledNotification(
  identifier: string
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error("Error canceling scheduled notification:", error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling all scheduled notifications:", error);
  }
}

/**
 * Notification types for the app
 */
export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "expense_added"
  | "settlement_recorded"
  | "group_invite"
  | "member_joined";

/**
 * Notification payload structure
 */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Create notification payload for a friend request
 */
export function createFriendRequestNotification(
  fromName: string
): NotificationPayload {
  return {
    type: "friend_request",
    title: "New Friend Request",
    body: `${fromName} wants to be your friend`,
    data: {},
  };
}

/**
 * Create notification payload for friend request accepted
 */
export function createFriendAcceptedNotification(
  friendName: string
): NotificationPayload {
  return {
    type: "friend_accepted",
    title: "Friend Request Accepted",
    body: `${friendName} accepted your friend request`,
    data: {},
  };
}

/**
 * Create notification payload for new expense
 */
export function createExpenseNotification(
  groupName: string,
  description: string,
  amount: number
): NotificationPayload {
  return {
    type: "expense_added",
    title: `New expense in ${groupName}`,
    body: `${description} - $${amount.toFixed(2)}`,
    data: { groupName, description, amount },
  };
}

/**
 * Create notification payload for settlement
 */
export function createSettlementNotification(
  groupName: string,
  fromName: string,
  amount: number
): NotificationPayload {
  return {
    type: "settlement_recorded",
    title: `Payment in ${groupName}`,
    body: `${fromName} paid $${amount.toFixed(2)}`,
    data: { groupName, fromName, amount },
  };
}

/**
 * Create notification payload for group invite
 */
export function createGroupInviteNotification(
  inviterName: string,
  groupName: string
): NotificationPayload {
  return {
    type: "group_invite",
    title: "Group Invite",
    body: `${inviterName} invited you to join ${groupName}`,
    data: { inviterName, groupName },
  };
}

/**
 * Create notification payload for member joining a group
 */
export function createMemberJoinedNotification(
  memberName: string,
  groupName: string
): NotificationPayload {
  return {
    type: "member_joined",
    title: `New member in ${groupName}`,
    body: `${memberName} joined the group`,
    data: { memberName, groupName },
  };
}

/**
 * Configure notification handler
 * Call this in your app's entry point (_layout.tsx)
 * Sets how notifications are displayed when app is in foreground
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, // Show alert (deprecated, same as shouldShowBanner)
      shouldPlaySound: true, // Play notification sound
      shouldSetBadge: true, // Update app badge count
      shouldShowBanner: true, // Show notification banner (iOS 14+)
      shouldShowList: true, // Show in notification list (iOS 14+)
    }),
  });
}

/**
 * Add notification received listener
 * Called when a notification is received while app is in foreground
 * @param callback - Function to call when notification is received
 * @returns Cleanup function to remove the listener
 */
export function addNotificationReceivedListener(
  callback: (notification: NotificationPayload) => void
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const payload = notification.request.content.data as unknown as NotificationPayload;
      callback(payload);
    }
  );

  return () => subscription.remove();
}

/**
 * Add notification response listener (when user taps notification)
 * Called when user interacts with a notification (tap, action button, etc.)
 * @param callback - Function to call when user responds to notification
 * @returns Cleanup function to remove the listener
 */
export function addNotificationResponseListener(
  callback: (notification: NotificationPayload) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const payload = response.notification.request.content.data as unknown as NotificationPayload;
      callback(payload);
    }
  );

  return () => subscription.remove();
}
