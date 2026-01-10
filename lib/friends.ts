/**
 * Friend Management Functions
 *
 * Functions for managing friendships between users.
 * Uses the friendships table in Supabase.
 */

import { supabase } from "./supabase";
import { Friendship, UserProfile, FriendshipStatus } from "./types";
import { validateClerkId, escapeILike } from "./sanitize";
import logger from "./logger";

/**
 * Database row type for friendships table
 */
interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for user_profiles table
 */
interface UserProfileRow {
  id: string;
  clerk_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  default_currency: string;
  venmo_username: string | null;
  created_at: string;
}

/**
 * Transform database row to Friendship type
 */
function transformFriendship(row: FriendshipRow): Friendship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform database row to UserProfile type
 */
function transformUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    clerkId: row.clerk_id,
    email: row.email || "",
    displayName: row.display_name || "Unknown",
    avatarUrl: row.avatar_url,
    defaultCurrency: row.default_currency || "USD",
    venmoUsername: row.venmo_username,
    createdAt: row.created_at,
  };
}

/**
 * Send a friend request to another user
 * @param currentUserId - The Clerk ID of the current user
 * @param targetClerkId - The Clerk ID of the user to send the request to
 */
export async function sendFriendRequest(
  currentUserId: string,
  targetClerkId: string
): Promise<void> {
  // Validate IDs to prevent SQL injection
  const validCurrentUserId = validateClerkId(currentUserId, 'currentUserId');
  const validTargetClerkId = validateClerkId(targetClerkId, 'targetClerkId');

  // Check if friendship already exists (in either direction)
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status")
    .or(
      `and(requester_id.eq.${validCurrentUserId},addressee_id.eq.${validTargetClerkId}),and(requester_id.eq.${validTargetClerkId},addressee_id.eq.${validCurrentUserId})`
    )
    .single();

  if (existing) {
    if (existing.status === "blocked") {
      throw new Error("Cannot send friend request to this user");
    }
    if (existing.status === "pending") {
      throw new Error("Friend request already pending");
    }
    if (existing.status === "accepted") {
      throw new Error("Already friends with this user");
    }
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: currentUserId,
    addressee_id: targetClerkId,
    status: "pending",
  });

  if (error) {
    logger.error("Error sending friend request:", error);
    throw new Error("Failed to send friend request");
  }
}

/**
 * Accept a pending friend request
 * @param friendshipId - The ID of the friendship to accept
 */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({
      status: "accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", friendshipId)
    .eq("status", "pending");

  if (error) {
    logger.error("Error accepting friend request:", error);
    throw new Error("Failed to accept friend request");
  }
}

/**
 * Reject a pending friend request
 * @param friendshipId - The ID of the friendship to reject
 */
export async function rejectFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .eq("status", "pending");

  if (error) {
    logger.error("Error rejecting friend request:", error);
    throw new Error("Failed to reject friend request");
  }
}

/**
 * Remove an existing friendship
 * @param friendshipId - The ID of the friendship to remove
 */
export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    logger.error("Error removing friend:", error);
    throw new Error("Failed to remove friend");
  }
}

/**
 * Block a user
 * @param currentUserId - The Clerk ID of the current user
 * @param targetClerkId - The Clerk ID of the user to block
 */
export async function blockUser(
  currentUserId: string,
  targetClerkId: string
): Promise<void> {
  // Validate IDs to prevent SQL injection
  const validCurrentUserId = validateClerkId(currentUserId, 'currentUserId');
  const validTargetClerkId = validateClerkId(targetClerkId, 'targetClerkId');

  // Check if friendship exists
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${validCurrentUserId},addressee_id.eq.${validTargetClerkId}),and(requester_id.eq.${validTargetClerkId},addressee_id.eq.${validCurrentUserId})`
    )
    .single();

  if (existing) {
    // Update existing friendship to blocked
    const { error } = await supabase
      .from("friendships")
      .update({
        status: "blocked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      logger.error("Error blocking user:", error);
      throw new Error("Failed to block user");
    }
  } else {
    // Create new blocked relationship
    const { error } = await supabase.from("friendships").insert({
      requester_id: currentUserId,
      addressee_id: targetClerkId,
      status: "blocked",
    });

    if (error) {
      logger.error("Error blocking user:", error);
      throw new Error("Failed to block user");
    }
  }
}

/**
 * Unblock a user
 * @param friendshipId - The ID of the blocked friendship to remove
 */
export async function unblockUser(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .eq("status", "blocked");

  if (error) {
    logger.error("Error unblocking user:", error);
    throw new Error("Failed to unblock user");
  }
}

/**
 * Get all accepted friends for a user
 * @param userId - The Clerk ID of the user
 * @returns Array of friendships with friend profile data
 */
export async function getFriends(userId: string): Promise<Friendship[]> {
  // Get friendships where user is requester
  const { data: asRequester, error: error1 } = await supabase
    .from("friendships")
    .select("*")
    .eq("requester_id", userId)
    .eq("status", "accepted");

  if (error1) {
    logger.error("Error fetching friends (as requester):", error1);
    throw new Error("Failed to fetch friends");
  }

  // Get friendships where user is addressee
  const { data: asAddressee, error: error2 } = await supabase
    .from("friendships")
    .select("*")
    .eq("addressee_id", userId)
    .eq("status", "accepted");

  if (error2) {
    logger.error("Error fetching friends (as addressee):", error2);
    throw new Error("Failed to fetch friends");
  }

  const friendships = [...(asRequester || []), ...(asAddressee || [])];
  const result: Friendship[] = [];

  // Fetch friend profiles for each friendship
  for (const f of friendships) {
    const friendship = transformFriendship(f);
    const friendClerkId =
      f.requester_id === userId ? f.addressee_id : f.requester_id;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("clerk_id", friendClerkId)
      .single();

    if (profile) {
      friendship.friend = transformUserProfile(profile);
    }

    result.push(friendship);
  }

  return result;
}

/**
 * Get pending friend requests for a user (incoming)
 * @param userId - The Clerk ID of the user
 * @returns Array of pending friendships with requester profile data
 */
export async function getPendingRequests(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching pending requests:", error);
    throw new Error("Failed to fetch pending requests");
  }

  const result: Friendship[] = [];

  for (const f of data || []) {
    const friendship = transformFriendship(f);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("clerk_id", f.requester_id)
      .single();

    if (profile) {
      friendship.requester = transformUserProfile(profile);
    }

    result.push(friendship);
  }

  return result;
}

/**
 * Get outgoing friend requests for a user
 * @param userId - The Clerk ID of the user
 * @returns Array of pending friendships with addressee profile data
 */
export async function getOutgoingRequests(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .eq("requester_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Error fetching outgoing requests:", error);
    throw new Error("Failed to fetch outgoing requests");
  }

  const result: Friendship[] = [];

  for (const f of data || []) {
    const friendship = transformFriendship(f);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("clerk_id", f.addressee_id)
      .single();

    if (profile) {
      friendship.addressee = transformUserProfile(profile);
    }

    result.push(friendship);
  }

  return result;
}

/**
 * Search for users by email or name
 * @param query - Search query (email or name)
 * @param currentUserId - The current user's Clerk ID (to exclude from results)
 * @returns Array of matching user profiles
 */
export async function searchUsers(
  query: string,
  currentUserId: string
): Promise<UserProfile[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const searchTerm = escapeILike(query.toLowerCase().trim());

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .neq("clerk_id", currentUserId)
    .or(`email.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
    .limit(20);

  if (error) {
    logger.error("Error searching users:", error);
    throw new Error("Failed to search users");
  }

  return (data || []).map(transformUserProfile);
}

/**
 * Get friendship status between current user and another user
 * @param currentUserId - The current user's Clerk ID
 * @param otherUserId - The other user's Clerk ID
 * @returns Friendship if exists, null otherwise
 */
export async function getFriendshipStatus(
  currentUserId: string,
  otherUserId: string
): Promise<Friendship | null> {
  // Validate IDs to prevent SQL injection
  const validCurrentUserId = validateClerkId(currentUserId, 'currentUserId');
  const validOtherUserId = validateClerkId(otherUserId, 'otherUserId');

  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${validCurrentUserId},addressee_id.eq.${validOtherUserId}),and(requester_id.eq.${validOtherUserId},addressee_id.eq.${validCurrentUserId})`
    )
    .single();

  if (error || !data) {
    return null;
  }

  return transformFriendship(data);
}

/**
 * Get count of pending friend requests
 * @param userId - The Clerk ID of the user
 * @returns Number of pending requests
 */
export async function getPendingRequestCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .eq("addressee_id", userId)
    .eq("status", "pending");

  if (error) {
    logger.error("Error fetching pending request count:", error);
    return 0;
  }

  return count || 0;
}
