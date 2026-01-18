import { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from './types';

/**
 * Verify that a user is a member of a group
 */
export async function verifyGroupMembership(
  client: SupabaseClient,
  groupId: string,
  clerkUserId: string
): Promise<boolean> {
  const { data, error } = await client
    .from('members')
    .select('id')
    .eq('group_id', groupId)
    .eq('clerk_user_id', clerkUserId)
    .single();

  return !error && data !== null;
}

/**
 * Get the current user's member record for a group
 */
export async function getCurrentMember(
  client: SupabaseClient,
  groupId: string,
  clerkUserId: string
): Promise<Member | null> {
  const { data, error } = await client
    .from('members')
    .select('*')
    .eq('group_id', groupId)
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Member;
}

/**
 * Throws an error if user is not a member of the group
 */
export async function requireGroupMembership(
  client: SupabaseClient,
  groupId: string,
  clerkUserId: string
): Promise<void> {
  const isMember = await verifyGroupMembership(client, groupId, clerkUserId);
  if (!isMember) {
    throw new Error('Access denied: You are not a member of this group');
  }
}
