/**
 * Member management utilities
 * Functions for claiming guest members and linking them to user accounts
 */

import { supabase } from "./supabase";
import { Member } from "./types";
import { handleAsync, AsyncResult } from "./utils";
import logger from "./logger";

/**
 * Claim a guest member by linking it to a user account
 * This allows a user to associate themselves with a member that was created
 * by someone else in the group (e.g., "John" added by the group creator)
 *
 * @param memberId The ID of the member to claim
 * @param userId The Clerk user ID to link to this member
 * @returns Success result with the updated member
 */
export async function claimMember(
  memberId: string,
  userId: string
): Promise<AsyncResult<Member>> {
  return handleAsync(async () => {
    // Update the member's user_id
    const { data, error } = await supabase
      .from("members")
      .update({ user_id: userId })
      .eq("id", memberId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Failed to claim member");
    }

    return data;
  }, "Failed to claim member");
}

/**
 * Get a member in a group by user ID
 * This checks if a user already has a claimed member in a specific group
 *
 * @param groupId The group ID to search in
 * @param userId The Clerk user ID to search for
 * @returns The member if found, null otherwise
 */
export async function getMemberByUserId(
  groupId: string,
  userId: string
): Promise<Member | null> {
  try {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .single();

    if (error) {
      // If no member found, that's OK - return null
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error("Error getting member by user ID:", error);
    return null;
  }
}

/**
 * Check if a user can claim a specific member
 * A user can claim a member if:
 * 1. The member doesn't have a user_id yet (it's unclaimed)
 * 2. The user doesn't already have a claimed member in this group
 *
 * @param memberId The member ID to check
 * @param userId The Clerk user ID
 * @returns Whether the user can claim this member
 */
export async function canClaimMember(
  memberId: string,
  userId: string
): Promise<{ canClaim: boolean; reason?: string }> {
  try {
    // Get the member to check if it's already claimed
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .single();

    if (memberError || !member) {
      return { canClaim: false, reason: "Member not found" };
    }

    // Check if member is already claimed
    if (member.user_id) {
      return { canClaim: false, reason: "This member is already claimed" };
    }

    // Check if user already has a claimed member in this group
    const existingMember = await getMemberByUserId(member.group_id, userId);
    if (existingMember) {
      return {
        canClaim: false,
        reason: "You already have a member in this group",
      };
    }

    return { canClaim: true };
  } catch (error) {
    logger.error("Error checking if member can be claimed:", error);
    return { canClaim: false, reason: "Error checking claim eligibility" };
  }
}
