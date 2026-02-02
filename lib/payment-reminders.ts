/**
 * Payment Reminders System
 *
 * Handles creation, scheduling, and tracking of payment reminders.
 * Sends push notifications to remind debtors about outstanding payments.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { sendPushNotifications, scheduleLocalNotification } from "./notifications";
import { formatCurrency } from "./utils";
import logger from "./logger";

// ============================================
// Types
// ============================================

export type ReminderStatus = "pending" | "sent" | "dismissed" | "paid";
export type ReminderFrequency = "once" | "daily" | "weekly";

export interface PaymentReminder {
  id: string;
  groupId: string;
  fromMemberId: string; // Person who owes money
  toMemberId: string; // Person who is owed money
  amount: number;
  status: ReminderStatus;
  frequency: ReminderFrequency;
  scheduledAt: string;
  sentAt?: string | null;
  dismissedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  createdBy: string; // Clerk user ID of who created the reminder
  note?: string | null;
  // Joined fields
  fromMember?: { id: string; name: string; clerk_user_id: string | null };
  toMember?: { id: string; name: string; clerk_user_id: string | null };
  group?: { id: string; name: string; currency: string };
}

export interface CreateReminderParams {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  createdBy: string;
  frequency?: ReminderFrequency;
  scheduledAt?: Date;
  note?: string;
}

export interface ReminderHistory {
  reminderId: string;
  sentAt: string;
  channel: "push" | "local";
  success: boolean;
  errorMessage?: string;
}

// ============================================
// Reminder CRUD Operations
// ============================================

// Spam protection: minimum hours between reminders for the same debt
const MIN_HOURS_BETWEEN_REMINDERS = 24;

/**
 * Check if a reminder can be sent (spam protection)
 * Returns true if no reminder was sent in the last 24 hours for this debt
 */
export async function canSendReminder(
  supabaseClient: SupabaseClient,
  groupId: string,
  fromMemberId: string,
  toMemberId: string
): Promise<{ canSend: boolean; hoursRemaining?: number; lastSentAt?: string }> {
  try {
    // Check for recent reminders for this specific debt
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MIN_HOURS_BETWEEN_REMINDERS);

    const { data, error } = await supabaseClient
      .from("payment_reminders")
      .select("created_at, sent_at")
      .eq("group_id", groupId)
      .eq("from_member_id", fromMemberId)
      .eq("to_member_id", toMemberId)
      .in("status", ["pending", "sent"])
      .gte("created_at", cutoffTime.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      logger.error("Error checking reminder cooldown:", error);
      return { canSend: true }; // Allow on error (fail open)
    }

    if (!data || data.length === 0) {
      return { canSend: true };
    }

    // Calculate hours remaining
    const lastReminder = new Date(data[0].created_at);
    const now = new Date();
    const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);
    const hoursRemaining = Math.ceil(MIN_HOURS_BETWEEN_REMINDERS - hoursSinceLastReminder);

    return {
      canSend: false,
      hoursRemaining,
      lastSentAt: data[0].sent_at || data[0].created_at,
    };
  } catch (error) {
    logger.error("Error checking reminder cooldown:", error);
    return { canSend: true }; // Allow on error
  }
}

/**
 * Create a new payment reminder
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param params - Reminder creation parameters
 * @param skipSpamCheck - Skip the spam check (use with caution)
 */
export async function createReminder(
  supabaseClient: SupabaseClient,
  params: CreateReminderParams,
  skipSpamCheck: boolean = false
): Promise<PaymentReminder | null> {
  try {
    // Check spam protection unless explicitly skipped
    if (!skipSpamCheck) {
      const cooldownCheck = await canSendReminder(
        supabaseClient,
        params.groupId,
        params.fromMemberId,
        params.toMemberId
      );

      if (!cooldownCheck.canSend) {
        logger.warn(`Reminder blocked by spam protection. Hours remaining: ${cooldownCheck.hoursRemaining}`);
        return null;
      }
    }

    const scheduledAt = params.scheduledAt || new Date();

    const { data, error } = await supabaseClient
      .from("payment_reminders")
      .insert({
        group_id: params.groupId,
        from_member_id: params.fromMemberId,
        to_member_id: params.toMemberId,
        amount: params.amount,
        status: "pending",
        frequency: params.frequency || "once",
        scheduled_at: scheduledAt.toISOString(),
        created_by: params.createdBy,
        note: params.note,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating reminder:", error);
      return null;
    }

    return mapDbToReminder(data);
  } catch (error) {
    logger.error("Error creating reminder:", error);
    return null;
  }
}

/**
 * Get all pending reminders for a group
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param groupId - The group ID
 */
export async function getPendingReminders(
  supabaseClient: SupabaseClient,
  groupId: string
): Promise<PaymentReminder[]> {
  try {
    const { data, error } = await supabaseClient
      .from("payment_reminders")
      .select(`
        *,
        fromMember:members!from_member_id(id, name, clerk_user_id),
        toMember:members!to_member_id(id, name, clerk_user_id),
        group:groups!group_id(id, name, currency)
      `)
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true });

    if (error) {
      logger.error("Error fetching reminders:", error);
      return [];
    }

    return (data || []).map(mapDbToReminder);
  } catch (error) {
    logger.error("Error fetching reminders:", error);
    return [];
  }
}

/**
 * Get reminders created by a specific user
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param createdBy - The creator's Clerk user ID
 */
export async function getRemindersByCreator(
  supabaseClient: SupabaseClient,
  createdBy: string
): Promise<PaymentReminder[]> {
  try {
    const { data, error } = await supabaseClient
      .from("payment_reminders")
      .select(`
        *,
        fromMember:members!from_member_id(id, name, clerk_user_id),
        toMember:members!to_member_id(id, name, clerk_user_id),
        group:groups!group_id(id, name, currency)
      `)
      .eq("created_by", createdBy)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching reminders:", error);
      return [];
    }

    return (data || []).map(mapDbToReminder);
  } catch (error) {
    logger.error("Error fetching reminders:", error);
    return [];
  }
}

/**
 * Get reminders where a user owes money
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param clerkUserId - The user's Clerk ID
 */
export async function getRemindersForDebtor(
  supabaseClient: SupabaseClient,
  clerkUserId: string
): Promise<PaymentReminder[]> {
  try {
    // First get member IDs for this user
    const { data: members, error: membersError } = await supabaseClient
      .from("members")
      .select("id")
      .eq("clerk_user_id", clerkUserId);

    if (membersError || !members?.length) {
      return [];
    }

    const memberIds = members.map((m: { id: string }) => m.id);

    const { data, error } = await supabaseClient
      .from("payment_reminders")
      .select(`
        *,
        fromMember:members!from_member_id(id, name, clerk_user_id),
        toMember:members!to_member_id(id, name, clerk_user_id),
        group:groups!group_id(id, name, currency)
      `)
      .in("from_member_id", memberIds)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true });

    if (error) {
      logger.error("Error fetching debtor reminders:", error);
      return [];
    }

    return (data || []).map(mapDbToReminder);
  } catch (error) {
    logger.error("Error fetching debtor reminders:", error);
    return [];
  }
}

/**
 * Update reminder status
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param reminderId - The reminder ID
 * @param status - The new status
 */
export async function updateReminderStatus(
  supabaseClient: SupabaseClient,
  reminderId: string,
  status: ReminderStatus
): Promise<boolean> {
  try {
    const updateFields: Record<string, any> = { status };

    if (status === "sent") {
      updateFields.sent_at = new Date().toISOString();
    } else if (status === "dismissed") {
      updateFields.dismissed_at = new Date().toISOString();
    } else if (status === "paid") {
      updateFields.paid_at = new Date().toISOString();
    }

    const { error } = await supabaseClient
      .from("payment_reminders")
      .update(updateFields)
      .eq("id", reminderId);

    if (error) {
      logger.error("Error updating reminder status:", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error updating reminder status:", error);
    return false;
  }
}

/**
 * Delete a reminder
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param reminderId - The reminder ID
 */
export async function deleteReminder(
  supabaseClient: SupabaseClient,
  reminderId: string
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from("payment_reminders")
      .delete()
      .eq("id", reminderId);

    if (error) {
      logger.error("Error deleting reminder:", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error deleting reminder:", error);
    return false;
  }
}

// ============================================
// Reminder Sending
// ============================================

/**
 * Send a payment reminder notification
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param reminder - The payment reminder to send
 */
export async function sendReminder(
  supabaseClient: SupabaseClient,
  reminder: PaymentReminder
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the debtor's Clerk user ID
    const debtorUserId = reminder.fromMember?.clerk_user_id;
    if (!debtorUserId) {
      return { success: false, error: "Debtor not linked to an account" };
    }

    const creditorName = reminder.toMember?.name || "Someone";
    const groupName = reminder.group?.name || "a group";
    const currency = reminder.group?.currency || "USD";
    const amount = formatCurrency(reminder.amount, currency);

    const title = "Payment Reminder";
    const body = `You owe ${creditorName} ${amount} in ${groupName}. Tap to pay now!`;

    const result = await sendPushNotifications(
      supabaseClient,
      [debtorUserId],
      title,
      body,
      {
        type: "payment_reminder",
        reminderId: reminder.id,
        groupId: reminder.groupId,
        amount: reminder.amount,
      }
    );

    if (result.success) {
      await updateReminderStatus(supabaseClient, reminder.id, "sent");
      await logReminderHistory(supabaseClient, reminder.id, "push", true);
    } else {
      await logReminderHistory(supabaseClient, reminder.id, "push", false, result.error);
    }

    return result;
  } catch (error) {
    const errorMsg = String(error);
    await logReminderHistory(supabaseClient, reminder.id, "push", false, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send reminders for all due payments in a group
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param groupId - The group ID
 */
export async function sendDueReminders(
  supabaseClient: SupabaseClient,
  groupId: string
): Promise<{
  sent: number;
  failed: number;
}> {
  const reminders = await getPendingReminders(supabaseClient, groupId);
  const now = new Date();

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    const scheduledAt = new Date(reminder.scheduledAt);
    if (scheduledAt <= now) {
      const result = await sendReminder(supabaseClient, reminder);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, failed };
}

/**
 * Schedule a local notification for a reminder
 * Used when push notifications aren't available
 */
export async function scheduleLocalReminder(
  reminder: PaymentReminder,
  triggerDate: Date
): Promise<string | null> {
  const creditorName = reminder.toMember?.name || "Someone";
  const currency = reminder.group?.currency || "USD";
  const amount = formatCurrency(reminder.amount, currency);

  const title = "Payment Reminder";
  const body = `You owe ${creditorName} ${amount}. Don't forget to pay!`;

  return await scheduleLocalNotification(title, body, triggerDate);
}

/**
 * Log reminder send history
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 */
async function logReminderHistory(
  supabaseClient: SupabaseClient,
  reminderId: string,
  channel: "push" | "local",
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabaseClient.from("reminder_history").insert({
      reminder_id: reminderId,
      channel,
      success,
      error_message: errorMessage,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error logging reminder history:", error);
  }
}

// ============================================
// Smart Reminder Suggestions
// ============================================

/**
 * Suggest optimal reminder timing based on patterns
 */
export function suggestReminderTime(): Date {
  const now = new Date();
  const hour = now.getHours();

  // Suggest reminders at reasonable times
  // If current time is before 10am, suggest 10am today
  // If current time is 10am-6pm, suggest 6pm today
  // If current time is after 6pm, suggest 10am tomorrow

  const suggestedDate = new Date(now);

  if (hour < 10) {
    suggestedDate.setHours(10, 0, 0, 0);
  } else if (hour < 18) {
    suggestedDate.setHours(18, 0, 0, 0);
  } else {
    suggestedDate.setDate(suggestedDate.getDate() + 1);
    suggestedDate.setHours(10, 0, 0, 0);
  }

  return suggestedDate;
}

/**
 * Check if it's a good time to send reminders (not too late/early)
 */
export function isGoodTimeForReminder(): boolean {
  const hour = new Date().getHours();
  return hour >= 9 && hour <= 21; // 9am to 9pm
}

/**
 * Calculate days until a balance is considered overdue
 */
export function getDaysUntilOverdue(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffTime = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Consider overdue after 7 days
  const OVERDUE_THRESHOLD = 7;
  return Math.max(0, OVERDUE_THRESHOLD - diffDays);
}

/**
 * Get reminder message templates
 */
export function getReminderMessage(
  type: "friendly" | "reminder" | "urgent",
  creditorName: string,
  amount: string
): { title: string; body: string } {
  switch (type) {
    case "friendly":
      return {
        title: "Quick reminder",
        body: `Hey! Just a friendly nudge - you owe ${creditorName} ${amount} when you get a chance.`,
      };
    case "reminder":
      return {
        title: "Payment Reminder",
        body: `You still owe ${creditorName} ${amount}. Tap to settle up now!`,
      };
    case "urgent":
      return {
        title: "Payment Overdue",
        body: `Your payment of ${amount} to ${creditorName} is overdue. Please settle up soon!`,
      };
    default:
      return {
        title: "Payment Reminder",
        body: `You owe ${creditorName} ${amount}.`,
      };
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Map database row to PaymentReminder interface
 */
function mapDbToReminder(row: any): PaymentReminder {
  return {
    id: row.id,
    groupId: row.group_id,
    fromMemberId: row.from_member_id,
    toMemberId: row.to_member_id,
    amount: parseFloat(row.amount),
    status: row.status,
    frequency: row.frequency,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    dismissedAt: row.dismissed_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    note: row.note,
    fromMember: row.fromMember,
    toMember: row.toMember,
    group: row.group,
  };
}
