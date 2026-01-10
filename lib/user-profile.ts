/**
 * User Profile Service
 * Handles user profile data stored in Supabase (separate from Clerk auth)
 */

import { supabase } from "./supabase";
import logger from "./logger";

/**
 * Get user's Venmo username from their profile
 */
export async function getVenmoUsername(clerkUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("venmo_username")
      .eq("clerk_id", clerkUserId)
      .single();

    if (error) {
      // User profile might not exist yet
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data?.venmo_username || null;
  } catch (error) {
    logger.error("Error fetching Venmo username:", error);
    return null;
  }
}

/**
 * Update user's Venmo username
 */
export async function updateVenmoUsername(
  clerkUserId: string,
  venmoUsername: string | null
): Promise<boolean> {
  try {
    // Clean up the username - remove @ prefix if present
    const cleanUsername = venmoUsername
      ? venmoUsername.replace(/^@/, "").trim()
      : null;

    // Validate username format (alphanumeric, underscores, hyphens, 5-30 chars)
    if (cleanUsername && !/^[a-zA-Z0-9_-]{1,30}$/.test(cleanUsername)) {
      throw new Error("Invalid Venmo username format");
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ venmo_username: cleanUsername })
      .eq("clerk_id", clerkUserId);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error("Error updating Venmo username:", error);
    return false;
  }
}

/**
 * Get Venmo username for a member by looking up their linked user profile
 */
export async function getVenmoUsernameForMember(memberId: string): Promise<string | null> {
  try {
    // First get the member's clerk_user_id
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("clerk_user_id")
      .eq("id", memberId)
      .single();

    if (memberError || !member?.clerk_user_id) {
      return null;
    }

    // Then get their Venmo username from user_profiles
    return await getVenmoUsername(member.clerk_user_id);
  } catch (error) {
    logger.error("Error fetching Venmo username for member:", error);
    return null;
  }
}

/**
 * Batch fetch Venmo usernames for multiple members
 * Returns a map of memberId -> venmoUsername
 */
export async function getVenmoUsernamesForMembers(
  memberIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (memberIds.length === 0) return result;

  try {
    // Get clerk_user_ids for all members
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, clerk_user_id")
      .in("id", memberIds)
      .not("clerk_user_id", "is", null);

    if (membersError || !members?.length) {
      return result;
    }

    // Get unique clerk_user_ids
    const clerkUserIds = [...new Set(members.map(m => m.clerk_user_id).filter(Boolean))];

    // Fetch all user profiles with Venmo usernames
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("clerk_id, venmo_username")
      .in("clerk_id", clerkUserIds)
      .not("venmo_username", "is", null);

    if (profilesError || !profiles?.length) {
      return result;
    }

    // Create a map of clerk_id -> venmo_username
    const clerkToVenmo = new Map<string, string>();
    for (const profile of profiles) {
      if (profile.venmo_username) {
        clerkToVenmo.set(profile.clerk_id, profile.venmo_username);
      }
    }

    // Map member IDs to Venmo usernames
    for (const member of members) {
      if (member.clerk_user_id) {
        const venmoUsername = clerkToVenmo.get(member.clerk_user_id);
        if (venmoUsername) {
          result.set(member.id, venmoUsername);
        }
      }
    }

    return result;
  } catch (error) {
    logger.error("Error batch fetching Venmo usernames:", error);
    return result;
  }
}

/**
 * Check if user has completed Venmo onboarding (has username set)
 */
export async function hasCompletedVenmoOnboarding(clerkUserId: string): Promise<boolean> {
  const username = await getVenmoUsername(clerkUserId);
  return username !== null && username.length > 0;
}
