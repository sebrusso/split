/**
 * Multiplayer Test Utilities
 *
 * Helper functions for testing multiplayer/multi-user scenarios.
 * These utilities help create isolated test data and clean up after tests.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { createTestClient, supabaseUrl, supabaseAnonKey, supabaseServiceKey } from "./test-config";

/**
 * Test user representation
 */
export interface TestUser {
  clerkId: string;
  displayName: string;
  email: string;
}

/**
 * Test IDs for cleanup
 */
export interface TestIds {
  groupIds: string[];
  memberIds: string[];
  expenseIds: string[];
  settlementIds: string[];
  friendshipIds: string[];
  userProfileIds: string[];
}

/**
 * Get a Supabase client for testing
 * Uses service role key if available (bypasses RLS)
 */
export function getTestSupabaseClient(): SupabaseClient {
  return createTestClient();
}

/**
 * Check if we have write access to the database
 */
export async function canWriteToDatabase(supabase: SupabaseClient): Promise<boolean> {
  const testCode = "WRITETEST" + Date.now();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name: "Write Test", share_code: testCode })
    .select()
    .single();

  if (data && !error) {
    // Clean up the test record
    await supabase.from("groups").delete().eq("id", data.id);
    return true;
  }
  return false;
}

/**
 * Generate a unique share code for testing
 */
export function generateTestShareCode(prefix: string = "TEST"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix.toUpperCase().slice(0, 2) + suffix;
}

/**
 * Create a test user profile
 */
export async function createTestUser(
  supabase: SupabaseClient,
  suffix: string
): Promise<TestUser & { profileId: string }> {
  const clerkId = `test_clerk_${suffix}_${Date.now()}`;
  const displayName = `Test User ${suffix}`;
  const email = `test_${suffix}_${Date.now()}@test.example.com`;

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      clerk_id: clerkId,
      display_name: displayName,
      email: email,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return {
    clerkId,
    displayName,
    email,
    profileId: data.id,
  };
}

/**
 * Create a test group
 */
export async function createTestGroup(
  supabase: SupabaseClient,
  creatorClerkId?: string,
  options: {
    name?: string;
    emoji?: string;
    currency?: string;
  } = {}
): Promise<{
  id: string;
  name: string;
  shareCode: string;
  currency: string;
}> {
  const shareCode = generateTestShareCode("GRP");
  const name = options.name || `Test Group ${Date.now()}`;

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name,
      emoji: options.emoji || "🧪",
      currency: options.currency || "USD",
      share_code: shareCode,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test group: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    shareCode: data.share_code,
    currency: data.currency,
  };
}

/**
 * Add a member to a group
 */
export async function joinGroupAsUser(
  supabase: SupabaseClient,
  groupId: string,
  clerkUserId: string | null,
  name: string
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("members")
    .insert({
      group_id: groupId,
      name,
      clerk_user_id: clerkUserId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to join group: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
  };
}

/**
 * Create a test expense with splits
 */
export async function createTestExpense(
  supabase: SupabaseClient,
  groupId: string,
  payerId: string,
  amount: number,
  splits: Array<{ memberId: string; amount: number }>,
  options: {
    description?: string;
    category?: string;
  } = {}
): Promise<{ id: string; amount: number }> {
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      group_id: groupId,
      description: options.description || `Test Expense ${Date.now()}`,
      amount,
      paid_by: payerId,
      category: options.category || "food",
    })
    .select()
    .single();

  if (expenseError) {
    throw new Error(`Failed to create expense: ${expenseError.message}`);
  }

  // Create splits
  const splitRecords = splits.map((split) => ({
    expense_id: expense.id,
    member_id: split.memberId,
    amount: split.amount,
  }));

  const { error: splitsError } = await supabase
    .from("splits")
    .insert(splitRecords);

  if (splitsError) {
    throw new Error(`Failed to create splits: ${splitsError.message}`);
  }

  return {
    id: expense.id,
    amount: parseFloat(expense.amount),
  };
}

/**
 * Create a test settlement
 */
export async function createTestSettlement(
  supabase: SupabaseClient,
  groupId: string,
  fromMemberId: string,
  toMemberId: string,
  amount: number
): Promise<{ id: string; amount: number }> {
  const { data, error } = await supabase
    .from("settlements")
    .insert({
      group_id: groupId,
      from_member_id: fromMemberId,
      to_member_id: toMemberId,
      amount,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create settlement: ${error.message}`);
  }

  return {
    id: data.id,
    amount: parseFloat(data.amount),
  };
}

/**
 * Create a test friendship
 */
export async function createTestFriendship(
  supabase: SupabaseClient,
  requesterId: string,
  addresseeId: string,
  status: "pending" | "accepted" | "blocked" = "pending"
): Promise<{ id: string; status: string }> {
  const { data, error } = await supabase
    .from("friendships")
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create friendship: ${error.message}`);
  }

  return {
    id: data.id,
    status: data.status,
  };
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(
  supabase: SupabaseClient,
  testIds: TestIds
): Promise<void> {
  // Clean up in order to respect foreign key constraints

  // 1. Friendships (no dependencies)
  if (testIds.friendshipIds.length > 0) {
    await supabase.from("friendships").delete().in("id", testIds.friendshipIds);
  }

  // 2. Settlements (depends on members)
  if (testIds.settlementIds.length > 0) {
    await supabase.from("settlements").delete().in("id", testIds.settlementIds);
  }

  // 3. Expenses and their splits (splits depend on expenses and members)
  if (testIds.expenseIds.length > 0) {
    await supabase.from("splits").delete().in("expense_id", testIds.expenseIds);
    await supabase.from("expenses").delete().in("id", testIds.expenseIds);
  }

  // 4. Members (depends on groups)
  if (testIds.memberIds.length > 0) {
    await supabase.from("members").delete().in("id", testIds.memberIds);
  }

  // 5. Groups
  if (testIds.groupIds.length > 0) {
    await supabase.from("groups").delete().in("id", testIds.groupIds);
  }

  // 6. User profiles
  if (testIds.userProfileIds.length > 0) {
    await supabase.from("user_profiles").delete().in("id", testIds.userProfileIds);
  }
}

/**
 * Create an empty TestIds object for tracking
 */
export function createTestIds(): TestIds {
  return {
    groupIds: [],
    memberIds: [],
    expenseIds: [],
    settlementIds: [],
    friendshipIds: [],
    userProfileIds: [],
  };
}

/**
 * Wait for a specified duration (useful for testing race conditions)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run multiple operations concurrently and return results
 */
export async function runConcurrently<T>(
  operations: Array<() => Promise<T>>
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const results = await Promise.allSettled(operations.map((op) => op()));

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return { success: true, result: result.value };
    } else {
      return { success: false, error: result.reason };
    }
  });
}
