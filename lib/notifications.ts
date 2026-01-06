/**
 * Push Notification Setup
 *
 * Infrastructure for Expo push notifications.
 * This is a placeholder implementation - full push notifications
 * will require a backend service to send messages.
 */

import { Platform } from "react-native";
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
 * Note: This requires expo-notifications to be installed
 * @returns Push token string or null if registration failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check if we're running in Expo Go or a development build
    // Push notifications require a development/production build

    // For now, return null as a placeholder
    // Full implementation will use expo-notifications:
    //
    // import * as Notifications from 'expo-notifications';
    // import * as Device from 'expo-device';
    //
    // if (!Device.isDevice) {
    //   console.log('Push notifications require a physical device');
    //   return null;
    // }
    //
    // const { status: existingStatus } = await Notifications.getPermissionsAsync();
    // let finalStatus = existingStatus;
    //
    // if (existingStatus !== 'granted') {
    //   const { status } = await Notifications.requestPermissionsAsync();
    //   finalStatus = status;
    // }
    //
    // if (finalStatus !== 'granted') {
    //   console.log('Push notification permission denied');
    //   return null;
    // }
    //
    // const token = (await Notifications.getExpoPushTokenAsync()).data;
    // return token;

    console.log("Push notifications not yet implemented");
    return null;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Save push token to user profile in database
 * @param userId - The user's Clerk ID
 * @param token - The Expo push token
 */
export async function savePushToken(
  userId: string,
  token: string
): Promise<void> {
  try {
    // Store the push token in a user's profile or separate table
    // For now, we'll store it in user_profiles metadata

    const pushData: PushTokenData = {
      token,
      platform: Platform.OS,
      createdAt: new Date().toISOString(),
    };

    // Update user profile with push token
    // This assumes we add a push_token column to user_profiles
    // or store it in a separate push_tokens table

    const { error } = await supabase
      .from("user_profiles")
      .update({
        // push_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_id", userId);

    if (error) {
      console.error("Error saving push token:", error);
    }
  } catch (error) {
    console.error("Error saving push token:", error);
  }
}

/**
 * Remove push token from user profile
 * Call this when the user signs out
 * @param userId - The user's Clerk ID
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({
        // push_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_id", userId);

    if (error) {
      console.error("Error removing push token:", error);
    }
  } catch (error) {
    console.error("Error removing push token:", error);
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
  | "group_invite";

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
 * Configure notification handler
 * Call this in your app's entry point
 */
export function configureNotificationHandler(): void {
  // Placeholder for notification handler configuration
  // Full implementation:
  //
  // import * as Notifications from 'expo-notifications';
  //
  // Notifications.setNotificationHandler({
  //   handleNotification: async () => ({
  //     shouldShowAlert: true,
  //     shouldPlaySound: true,
  //     shouldSetBadge: true,
  //   }),
  // });

  console.log("Notification handler configuration placeholder");
}

/**
 * Add notification received listener
 * @param callback - Function to call when notification is received
 * @returns Cleanup function
 */
export function addNotificationReceivedListener(
  callback: (notification: NotificationPayload) => void
): () => void {
  // Placeholder for notification listener
  // Full implementation:
  //
  // import * as Notifications from 'expo-notifications';
  //
  // const subscription = Notifications.addNotificationReceivedListener(
  //   (notification) => {
  //     const payload = notification.request.content.data as NotificationPayload;
  //     callback(payload);
  //   }
  // );
  //
  // return () => subscription.remove();

  return () => {};
}

/**
 * Add notification response listener (when user taps notification)
 * @param callback - Function to call when user responds to notification
 * @returns Cleanup function
 */
export function addNotificationResponseListener(
  callback: (notification: NotificationPayload) => void
): () => void {
  // Placeholder for response listener
  // Full implementation:
  //
  // import * as Notifications from 'expo-notifications';
  //
  // const subscription = Notifications.addNotificationResponseReceivedListener(
  //   (response) => {
  //     const payload = response.notification.request.content.data as NotificationPayload;
  //     callback(payload);
  //   }
  // );
  //
  // return () => subscription.remove();

  return () => {};
}
