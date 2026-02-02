/**
 * Supabase Realtime Manager
 *
 * Manages WebSocket subscriptions for real-time updates to group data.
 * Replaces 10-second polling with instant updates for multiplayer scenarios.
 */

import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

/**
 * Postgres change event payload
 */
export interface PostgresChangePayload<T = unknown> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: T;
  schema: string;
  table: string;
  commit_timestamp: string;
}

/**
 * Callback type for subscription events
 */
type SubscriptionCallback<T = unknown> = (
  payload: PostgresChangePayload<T>
) => void;

/**
 * Subscription callbacks for a group
 */
export interface GroupSubscriptionCallbacks {
  onExpenseChange?: SubscriptionCallback;
  onMemberChange?: SubscriptionCallback;
  onSettlementChange?: SubscriptionCallback;
  onReceiptChange?: SubscriptionCallback;
}

/**
 * Realtime manager for handling Supabase Realtime subscriptions
 */
export interface RealtimeManager {
  /**
   * Subscribe to all changes for a specific group
   */
  subscribeToGroup(
    supabase: SupabaseClient,
    groupId: string,
    callbacks: GroupSubscriptionCallbacks
  ): RealtimeChannel;

  /**
   * Subscribe to user-specific changes (friend requests, etc.)
   */
  subscribeToUser(
    supabase: SupabaseClient,
    userId: string,
    callbacks: {
      onFriendshipChange?: SubscriptionCallback;
      onActivityChange?: SubscriptionCallback;
    }
  ): RealtimeChannel;

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: RealtimeChannel): Promise<void>;
}

/**
 * Create a realtime manager instance
 */
export function createRealtimeManager(): RealtimeManager {
  return {
    subscribeToGroup(supabase, groupId, callbacks) {
      const channelName = `group:${groupId}`;

      logger.debug(`[Realtime] Subscribing to group: ${groupId}`);

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "expenses",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            logger.debug(`[Realtime] Expense change in group ${groupId}:`, payload.eventType);
            callbacks.onExpenseChange?.(payload as PostgresChangePayload);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "members",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            logger.debug(`[Realtime] Member change in group ${groupId}:`, payload.eventType);
            callbacks.onMemberChange?.(payload as PostgresChangePayload);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "settlements",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            logger.debug(`[Realtime] Settlement change in group ${groupId}:`, payload.eventType);
            callbacks.onSettlementChange?.(payload as PostgresChangePayload);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "receipts",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            logger.debug(`[Realtime] Receipt change in group ${groupId}:`, payload.eventType);
            callbacks.onReceiptChange?.(payload as PostgresChangePayload);
          }
        )
        .subscribe((status) => {
          logger.debug(`[Realtime] Group ${groupId} subscription status:`, status);
        });

      return channel;
    },

    subscribeToUser(supabase, userId, callbacks) {
      const channelName = `user:${userId}`;

      logger.debug(`[Realtime] Subscribing to user: ${userId}`);

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friendships",
            filter: `requester_id=eq.${userId}`,
          },
          (payload) => {
            logger.debug(`[Realtime] Friendship change (requester):`, payload.eventType);
            callbacks.onFriendshipChange?.(payload as PostgresChangePayload);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "friendships",
            filter: `addressee_id=eq.${userId}`,
          },
          (payload) => {
            logger.debug(`[Realtime] Friendship change (addressee):`, payload.eventType);
            callbacks.onFriendshipChange?.(payload as PostgresChangePayload);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "activity_log",
            filter: `actor_id=eq.${userId}`,
          },
          (payload) => {
            logger.debug(`[Realtime] Activity change:`, payload.eventType);
            callbacks.onActivityChange?.(payload as PostgresChangePayload);
          }
        )
        .subscribe((status) => {
          logger.debug(`[Realtime] User ${userId} subscription status:`, status);
        });

      return channel;
    },

    async unsubscribe(channel) {
      try {
        await channel.unsubscribe();
        logger.debug(`[Realtime] Unsubscribed from channel`);
      } catch (error) {
        logger.error(`[Realtime] Error unsubscribing:`, error);
      }
    },
  };
}

// Singleton instance for convenience
let _manager: RealtimeManager | null = null;

/**
 * Get the singleton realtime manager instance
 */
export function getRealtimeManager(): RealtimeManager {
  if (!_manager) {
    _manager = createRealtimeManager();
  }
  return _manager;
}
