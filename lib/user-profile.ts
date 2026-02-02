/**
 * User Profile Service
 * Handles user profile data stored in Supabase (separate from Clerk auth)
 */

import { supabase } from "./supabase";
import { SupabaseClient } from "@supabase/supabase-js";
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
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param clerkUserId - The user's Clerk ID
 * @param venmoUsername - Venmo username (without @ prefix)
 */
export async function updateVenmoUsername(
  supabaseClient: SupabaseClient,
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

    // Use upsert to create the profile if it doesn't exist
    // Note: Must use authenticated client for RLS policies
    const { error } = await supabaseClient
      .from("user_profiles")
      .upsert(
        { clerk_id: clerkUserId, venmo_username: cleanUsername },
        { onConflict: "clerk_id" }
      );

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

/**
 * Get user's Venmo profile (username and display name)
 */
export async function getVenmoProfile(clerkUserId: string): Promise<{
  username: string | null;
  displayName: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("venmo_username, venmo_display_name")
      .eq("clerk_id", clerkUserId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { username: null, displayName: null };
      }
      throw error;
    }

    return {
      username: data?.venmo_username || null,
      displayName: data?.venmo_display_name || null,
    };
  } catch (error) {
    logger.error("Error fetching Venmo profile:", error);
    return { username: null, displayName: null };
  }
}

/**
 * Update user's Venmo profile (username and display name)
 * @param supabaseClient - Authenticated Supabase client (required for RLS)
 * @param clerkUserId - The user's Clerk ID
 * @param venmoUsername - Venmo username (without @ prefix)
 * @param venmoDisplayName - Display name for Venmo
 */
export async function updateVenmoProfile(
  supabaseClient: SupabaseClient,
  clerkUserId: string,
  venmoUsername: string | null,
  venmoDisplayName: string | null
): Promise<boolean> {
  try {
    // Clean up the username - remove @ prefix if present
    const cleanUsername = venmoUsername
      ? venmoUsername.replace(/^@/, "").trim()
      : null;

    // Validate username format
    if (cleanUsername && !/^[a-zA-Z0-9_-]{1,30}$/.test(cleanUsername)) {
      throw new Error("Invalid Venmo username format");
    }

    // Clean display name (trim whitespace, limit length)
    const cleanDisplayName = venmoDisplayName
      ? venmoDisplayName.trim().slice(0, 50)
      : null;

    // Use upsert to create the profile if it doesn't exist
    // Note: Must use authenticated client for RLS policies
    const { error } = await supabaseClient
      .from("user_profiles")
      .upsert(
        {
          clerk_id: clerkUserId,
          venmo_username: cleanUsername,
          venmo_display_name: cleanDisplayName,
        },
        { onConflict: "clerk_id" }
      );

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error("Error updating Venmo profile:", error);
    return false;
  }
}

/**
 * Batch fetch Venmo profiles (username + display name) for members
 * Returns a map of memberId -> { username, displayName }
 */
export async function getVenmoProfilesForMembers(
  memberIds: string[]
): Promise<Map<string, { username: string; displayName: string | null }>> {
  const result = new Map<string, { username: string; displayName: string | null }>();

  if (memberIds.length === 0) return result;

  try {
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, clerk_user_id")
      .in("id", memberIds)
      .not("clerk_user_id", "is", null);

    if (membersError || !members?.length) {
      return result;
    }

    const clerkUserIds = [...new Set(members.map(m => m.clerk_user_id).filter(Boolean))];

    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("clerk_id, venmo_username, venmo_display_name")
      .in("clerk_id", clerkUserIds)
      .not("venmo_username", "is", null);

    if (profilesError || !profiles?.length) {
      return result;
    }

    const clerkToVenmo = new Map<string, { username: string; displayName: string | null }>();
    for (const profile of profiles) {
      if (profile.venmo_username) {
        clerkToVenmo.set(profile.clerk_id, {
          username: profile.venmo_username,
          displayName: profile.venmo_display_name || null,
        });
      }
    }

    for (const member of members) {
      if (member.clerk_user_id) {
        const venmoProfile = clerkToVenmo.get(member.clerk_user_id);
        if (venmoProfile) {
          result.set(member.id, venmoProfile);
        }
      }
    }

    return result;
  } catch (error) {
    logger.error("Error batch fetching Venmo profiles:", error);
    return result;
  }
}
