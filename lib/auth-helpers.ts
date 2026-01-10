/**
 * Authorization helpers for checking user permissions
 *
 * These helpers provide defense-in-depth authorization checks
 * even when RLS policies are in place.
 */

import { supabase } from "./supabase";

/**
 * Check if a user is a member of a group
 * @param groupId - The group ID to check
 * @param clerkUserId - The Clerk user ID (optional, checks any membership if not provided)
 * @returns True if the user is a member
 */
export async function isGroupMember(
  groupId: string,
  clerkUserId?: string
): Promise<boolean> {
  try {
    let query = supabase
      .from("members")
      .select("id")
      .eq("group_id", groupId);

    if (clerkUserId) {
      query = query.eq("clerk_user_id", clerkUserId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      if (__DEV__) {
        console.error("Error checking group membership:", error);
      }
      return false;
    }

    return data !== null && data.length > 0;
  } catch (error) {
    if (__DEV__) {
      console.error("Error checking group membership:", error);
    }
    return false;
  }
}

/**
 * Check if a user has access to an expense
 * User must be a member of the expense's group
 * @param expenseId - The expense ID to check
 * @param clerkUserId - The Clerk user ID
 * @returns True if the user has access
 */
export async function hasExpenseAccess(
  expenseId: string,
  clerkUserId?: string
): Promise<boolean> {
  try {
    // Get the expense's group
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .select("group_id")
      .eq("id", expenseId)
      .single();

    if (expenseError || !expense) {
      return false;
    }

    // Check if user is member of that group
    return isGroupMember(expense.group_id, clerkUserId);
  } catch (error) {
    if (__DEV__) {
      console.error("Error checking expense access:", error);
    }
    return false;
  }
}

/**
 * Get the member ID for a user in a specific group
 * @param groupId - The group ID
 * @param clerkUserId - The Clerk user ID
 * @returns The member ID or null if not a member
 */
export async function getMemberIdInGroup(
  groupId: string,
  clerkUserId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("group_id", groupId)
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch (error) {
    if (__DEV__) {
      console.error("Error getting member ID:", error);
    }
    return null;
  }
}

/**
 * Validate that a group exists and return basic info
 * @param groupId - The group ID to validate
 * @returns Group info or null if not found
 */
export async function validateGroupExists(
  groupId: string
): Promise<{ id: string; name: string } | null> {
  try {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name")
      .eq("id", groupId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      console.error("Error validating group:", error);
    }
    return null;
  }
}

/**
 * Check if an expense belongs to a specific group
 * @param expenseId - The expense ID
 * @param groupId - The expected group ID
 * @returns True if the expense belongs to the group
 */
export async function expenseBelongsToGroup(
  expenseId: string,
  groupId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("id")
      .eq("id", expenseId)
      .eq("group_id", groupId)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      console.error("Error checking expense group:", error);
    }
    return false;
  }
}
