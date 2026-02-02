/**
 * useRealtimeGroup Hook
 *
 * Subscribes to real-time updates for a specific group.
 * Automatically handles subscription setup and cleanup.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useSupabase } from "../supabase";
import { getRealtimeManager, PostgresChangePayload } from "../realtime";
import { logger } from "../logger";

/**
 * Connection status for realtime subscription
 */
export type RealtimeConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Options for the useRealtimeGroup hook
 */
export interface UseRealtimeGroupOptions {
  /**
   * Whether the subscription is enabled (default: true)
   */
  enabled?: boolean;

  /**
   * Callback when an expense changes (INSERT, UPDATE, DELETE)
   */
  onExpenseChange?: () => void;

  /**
   * Callback when a member changes (INSERT, UPDATE, DELETE)
   */
  onMemberChange?: () => void;

  /**
   * Callback when a settlement changes (INSERT, UPDATE, DELETE)
   */
  onSettlementChange?: () => void;

  /**
   * Callback when a receipt changes (INSERT, UPDATE, DELETE)
   */
  onReceiptChange?: () => void;

  /**
   * Callback when any change occurs (convenience for refetching all data)
   */
  onAnyChange?: () => void;
}

/**
 * Hook for subscribing to real-time updates for a group
 *
 * @param groupId - The group ID to subscribe to
 * @param options - Subscription options and callbacks
 * @returns Status and control functions
 *
 * @example
 * ```tsx
 * const { isConnected } = useRealtimeGroup(groupId, {
 *   onExpenseChange: () => fetchExpenses(),
 *   onAnyChange: () => refetchAll(),
 * });
 * ```
 */
export function useRealtimeGroup(
  groupId: string | undefined,
  options: UseRealtimeGroupOptions = {}
) {
  const {
    enabled = true,
    onExpenseChange,
    onMemberChange,
    onSettlementChange,
    onReceiptChange,
    onAnyChange,
  } = options;

  const { getSupabase } = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const managerRef = useRef(getRealtimeManager());
  const [status, setStatus] = useState<RealtimeConnectionStatus>("disconnected");

  // Wrap callbacks in stable refs to avoid re-subscriptions
  const callbacksRef = useRef({
    onExpenseChange,
    onMemberChange,
    onSettlementChange,
    onReceiptChange,
    onAnyChange,
  });

  // Update callback refs when they change
  useEffect(() => {
    callbacksRef.current = {
      onExpenseChange,
      onMemberChange,
      onSettlementChange,
      onReceiptChange,
      onAnyChange,
    };
  }, [onExpenseChange, onMemberChange, onSettlementChange, onReceiptChange, onAnyChange]);

  // Handler that calls the appropriate callback
  const handleExpenseChange = useCallback(() => {
    callbacksRef.current.onExpenseChange?.();
    callbacksRef.current.onAnyChange?.();
  }, []);

  const handleMemberChange = useCallback(() => {
    callbacksRef.current.onMemberChange?.();
    callbacksRef.current.onAnyChange?.();
  }, []);

  const handleSettlementChange = useCallback(() => {
    callbacksRef.current.onSettlementChange?.();
    callbacksRef.current.onAnyChange?.();
  }, []);

  const handleReceiptChange = useCallback(() => {
    callbacksRef.current.onReceiptChange?.();
    callbacksRef.current.onAnyChange?.();
  }, []);

  useEffect(() => {
    // Don't subscribe if not enabled or no groupId
    if (!enabled || !groupId) {
      return;
    }

    let mounted = true;
    let currentChannel: RealtimeChannel | null = null;

    async function subscribe() {
      // Double-check groupId inside async function for TypeScript narrowing
      if (!groupId) return;

      try {
        setStatus("connecting");
        const supabase = await getSupabase();

        if (!mounted) return;

        logger.debug(`[useRealtimeGroup] Setting up subscription for group: ${groupId}`);

        currentChannel = managerRef.current.subscribeToGroup(supabase, groupId, {
          onExpenseChange: handleExpenseChange,
          onMemberChange: handleMemberChange,
          onSettlementChange: handleSettlementChange,
          onReceiptChange: handleReceiptChange,
        });

        channelRef.current = currentChannel;
        setStatus("connected");
      } catch (error) {
        logger.error(`[useRealtimeGroup] Subscription error:`, error);
        if (mounted) {
          setStatus("error");
        }
      }
    }

    subscribe();

    return () => {
      mounted = false;
      if (currentChannel) {
        logger.debug(`[useRealtimeGroup] Cleaning up subscription for group: ${groupId}`);
        managerRef.current.unsubscribe(currentChannel);
        channelRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [groupId, enabled, getSupabase, handleExpenseChange, handleMemberChange, handleSettlementChange, handleReceiptChange]);

  return {
    /**
     * Current connection status
     */
    status,

    /**
     * Whether the subscription is connected
     */
    isConnected: status === "connected",

    /**
     * Whether the subscription is connecting
     */
    isConnecting: status === "connecting",

    /**
     * Whether there was an error
     */
    hasError: status === "error",
  };
}
