/**
 * Activity Feed Functions
 *
 * Functions for managing and retrieving activity logs.
 * Uses the activity_log table in Supabase.
 */

import { supabase } from "./supabase";
import {
  ActivityItem,
  ActivityAction,
  LogActivityParams,
  UserProfile,
  Group,
} from "./types";

/**
 * Database row type for activity_log table
 */
interface ActivityLogRow {
  id: string;
  group_id: string | null;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

/**
 * Transform database row to ActivityItem type
 */
function transformActivityItem(row: ActivityLogRow): ActivityItem {
  return {
    id: row.id,
    groupId: row.group_id,
    actorId: row.actor_id,
    action: row.action as ActivityAction,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

/**
 * Log an activity event
 * @param params - Activity parameters
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const { groupId, actorId, action, entityType, entityId, metadata } = params;

  const { error } = await supabase.from("activity_log").insert({
    group_id: groupId || null,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    metadata: metadata || {},
  });

  if (error) {
    console.error("Error logging activity:", error);
    // Don't throw - activity logging should be non-blocking
  }
}

/**
 * Get activity for a specific group
 * @param groupId - The group ID
 * @param limit - Maximum number of items to return (default 50)
 * @returns Array of activity items with actor profiles
 */
export async function getGroupActivity(
  groupId: string,
  limit: number = 50
): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching group activity:", error);
    throw new Error("Failed to fetch group activity");
  }

  const activities = (data || []).map(transformActivityItem);

  // Fetch actor profiles
  const actorIds = [...new Set(activities.map((a) => a.actorId))];

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("*")
      .in("clerk_id", actorIds);

    if (profiles) {
      const profileMap = new Map<string, UserProfile>();
      profiles.forEach((p) => {
        profileMap.set(p.clerk_id, {
          id: p.id,
          clerkId: p.clerk_id,
          email: p.email || "",
          displayName: p.display_name || "Unknown",
          avatarUrl: p.avatar_url,
          defaultCurrency: p.default_currency || "USD",
          createdAt: p.created_at,
        });
      });

      activities.forEach((activity) => {
        activity.actor = profileMap.get(activity.actorId);
      });
    }
  }

  return activities;
}

/**
 * Get global activity for a user (across all their groups)
 * @param userId - The user's Clerk ID
 * @param limit - Maximum number of items to return (default 50)
 * @returns Array of activity items with actor and group data
 */
export async function getGlobalActivity(
  userId: string,
  limit: number = 50
): Promise<ActivityItem[]> {
  // First, get all groups the user is a member of
  const { data: memberData } = await supabase
    .from("members")
    .select("group_id")
    .eq("clerk_user_id", userId);

  const groupIds = (memberData || []).map((m) => m.group_id);

  if (groupIds.length === 0) {
    return [];
  }

  // Get activity for all those groups
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching global activity:", error);
    throw new Error("Failed to fetch activity");
  }

  const activities = (data || []).map(transformActivityItem);

  // Fetch actor profiles
  const actorIds = [...new Set(activities.map((a) => a.actorId))];

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("*")
      .in("clerk_id", actorIds);

    if (profiles) {
      const profileMap = new Map<string, UserProfile>();
      profiles.forEach((p) => {
        profileMap.set(p.clerk_id, {
          id: p.id,
          clerkId: p.clerk_id,
          email: p.email || "",
          displayName: p.display_name || "Unknown",
          avatarUrl: p.avatar_url,
          defaultCurrency: p.default_currency || "USD",
          createdAt: p.created_at,
        });
      });

      activities.forEach((activity) => {
        activity.actor = profileMap.get(activity.actorId);
      });
    }
  }

  // Fetch group info
  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .in("id", groupIds);

  if (groups) {
    const groupMap = new Map<string, Group>();
    groups.forEach((g) => {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name,
        emoji: g.emoji || "",
        currency: g.currency || "USD",
        share_code: g.share_code,
        created_at: g.created_at,
      });
    });

    activities.forEach((activity) => {
      if (activity.groupId) {
        activity.group = groupMap.get(activity.groupId);
      }
    });
  }

  return activities;
}

/**
 * Get recent activity for a group (limited to 5 items)
 * Useful for showing a preview in the group detail screen
 * @param groupId - The group ID
 * @returns Array of recent activity items
 */
export async function getRecentGroupActivity(
  groupId: string
): Promise<ActivityItem[]> {
  return getGroupActivity(groupId, 5);
}

/**
 * Delete all activity for a specific entity
 * Useful when deleting an expense or member
 * @param entityType - The type of entity
 * @param entityId - The entity ID
 */
export async function deleteActivityForEntity(
  entityType: string,
  entityId: string
): Promise<void> {
  const { error } = await supabase
    .from("activity_log")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (error) {
    console.error("Error deleting activity:", error);
    // Don't throw - cleanup should be non-blocking
  }
}

/**
 * Get human-readable description for an activity
 * @param activity - The activity item
 * @returns Formatted description string
 */
export function getActivityDescription(activity: ActivityItem): string {
  const actorName = activity.actor?.displayName || "Someone";
  const metadata = activity.metadata || {};

  switch (activity.action) {
    case "expense_added":
      return `${actorName} added an expense "${metadata.description || ""}${
        metadata.amount ? ` ($${metadata.amount})` : ""
      }"`;

    case "expense_edited":
      return `${actorName} edited an expense "${metadata.description || ""}"`;

    case "expense_deleted":
      return `${actorName} deleted an expense "${metadata.description || ""}"`;

    case "settlement_recorded":
      return `${actorName} recorded a payment${
        metadata.amount ? ` of $${metadata.amount}` : ""
      }`;

    case "member_joined":
      return `${metadata.memberName || actorName} joined the group`;

    case "member_left":
      return `${metadata.memberName || actorName} left the group`;

    case "group_created":
      return `${actorName} created this group`;

    default:
      return `${actorName} performed an action`;
  }
}

/**
 * Get icon for an activity type
 * @param action - The activity action
 * @returns Emoji icon
 */
export function getActivityIcon(action: ActivityAction): string {
  switch (action) {
    case "expense_added":
      return "💰";
    case "expense_edited":
      return "✏️";
    case "expense_deleted":
      return "🗑️";
    case "settlement_recorded":
      return "✅";
    case "member_joined":
      return "👋";
    case "member_left":
      return "👋";
    case "group_created":
      return "🎉";
    default:
      return "📝";
  }
}

/**
 * Helper functions to log common activities
 */

export async function logExpenseAdded(
  groupId: string,
  actorId: string,
  expenseId: string,
  description: string,
  amount: number
): Promise<void> {
  await logActivity({
    groupId,
    actorId,
    action: "expense_added",
    entityType: "expense",
    entityId: expenseId,
    metadata: { description, amount },
  });
}

export async function logExpenseEdited(
  groupId: string,
  actorId: string,
  expenseId: string,
  description: string
): Promise<void> {
  await logActivity({
    groupId,
    actorId,
    action: "expense_edited",
    entityType: "expense",
    entityId: expenseId,
    metadata: { description },
  });
}

export async function logExpenseDeleted(
  groupId: string,
  actorId: string,
  expenseId: string,
  description: string
): Promise<void> {
  await logActivity({
    groupId,
    actorId,
    action: "expense_deleted",
    entityType: "expense",
    entityId: expenseId,
    metadata: { description },
  });
}

export async function logSettlementRecorded(
  groupId: string,
  actorId: string,
  settlementId: string,
  amount: number,
  fromName: string,
  toName: string
): Promise<void> {
  await logActivity({
    groupId,
    actorId,
    action: "settlement_recorded",
    entityType: "settlement",
    entityId: settlementId,
    metadata: { amount, fromName, toName },
  });
}

export async function logMemberJoined(
  groupId: string,
  actorId: string,
  memberId: string,
  memberName: string
): Promise<void> {
  await logActivity({
    groupId,
    actorId,
    action: "member_joined",
    entityType: "member",
    entityId: memberId,
    metadata: { memberName },
  });
}

export async function logGroupCreated(
  groupId: string,
  actorId: string,
  groupName: string
): Promise<void> {
  await logActivity({
    groupId,
    actorId,
    action: "group_created",
    entityType: "group",
    entityId: groupId,
    metadata: { groupName },
  });
}
