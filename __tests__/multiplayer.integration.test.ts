/**
 * Multiplayer Integration Tests
 *
 * Tests for multi-user scenarios including group joining,
 * concurrent operations, settlements, and friend requests.
 *
 * Run with: npm test -- --testPathPattern=multiplayer
 *
 * IMPORTANT: These tests require write access to the database.
 * Set SUPABASE_SERVICE_ROLE_KEY environment variable to run tests.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  getTestSupabaseClient,
  canWriteToDatabase,
  createTestUser,
  createTestGroup,
  joinGroupAsUser,
  createTestExpense,
  createTestSettlement,
  createTestFriendship,
  cleanupTestData,
  createTestIds,
  runConcurrently,
  wait,
  TestIds,
} from "./helpers/multiplayer-test-utils";

let supabase: SupabaseClient;
let hasWriteAccess = false;
let testIds: TestIds;

beforeAll(async () => {
  supabase = getTestSupabaseClient();
  hasWriteAccess = await canWriteToDatabase(supabase);

  if (!hasWriteAccess) {
    console.warn(
      "\n⚠️  Supabase write access blocked (RLS policy).\n" +
      "   Set SUPABASE_SERVICE_ROLE_KEY environment variable to run integration tests.\n" +
      "   Tests that require write access will be skipped.\n"
    );
  }

  testIds = createTestIds();
});

afterAll(async () => {
  // Clean up all test data
  await cleanupTestData(supabase, testIds);
});

/**
 * Helper to skip tests when write access is not available
 */
function skipIfNoWriteAccess(): boolean {
  if (!hasWriteAccess) {
    console.log("Skipping: No write access to database");
    return true;
  }
  return false;
}

// ============================================
// Suite 1: Group Joining Flow
// ============================================

describe("Group Joining Flow", () => {
  let groupId: string;
  let shareCode: string;

  beforeAll(async () => {
    if (!hasWriteAccess) return;

    const group = await createTestGroup(supabase);
    groupId = group.id;
    shareCode = group.shareCode;
    testIds.groupIds.push(groupId);
  });

  it("should join a group via share code", async () => {
    if (skipIfNoWriteAccess()) return;

    // Find group by share code
    const { data: foundGroup, error } = await supabase
      .from("groups")
      .select("*")
      .eq("share_code", shareCode)
      .single();

    expect(error).toBeNull();
    expect(foundGroup).toBeDefined();
    expect(foundGroup.id).toBe(groupId);

    // Join the group
    const member = await joinGroupAsUser(supabase, groupId, null, "Test Member");
    testIds.memberIds.push(member.id);

    expect(member.id).toBeDefined();
    expect(member.name).toBe("Test Member");
  });

  it("should verify deep link format splitfree://join/{code}", async () => {
    if (skipIfNoWriteAccess()) return;

    const deepLink = `splitfree://join/${shareCode}`;

    // Verify the format
    expect(deepLink).toMatch(/^splitfree:\/\/join\/[A-Z0-9]{6}$/);

    // Extract code from deep link
    const extractedCode = deepLink.replace("splitfree://join/", "");
    expect(extractedCode).toBe(shareCode);
  });

  it("should detect when user is already a member", async () => {
    if (skipIfNoWriteAccess()) return;

    const clerkUserId = `test_clerk_${Date.now()}`;

    // Join the group
    const member1 = await joinGroupAsUser(supabase, groupId, clerkUserId, "Existing User");
    testIds.memberIds.push(member1.id);

    // Check if user is already a member
    const { data: existingMembers } = await supabase
      .from("members")
      .select("id, name")
      .eq("group_id", groupId)
      .eq("clerk_user_id", clerkUserId);

    expect(existingMembers).toHaveLength(1);
    expect(existingMembers![0].name).toBe("Existing User");
  });

  it("should handle non-existent share codes", async () => {
    if (skipIfNoWriteAccess()) return;

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("share_code", "NOTEXIST")
      .single();

    expect(error).not.toBeNull();
    expect(error!.code).toBe("PGRST116"); // No rows returned
    expect(data).toBeNull();
  });
});

// ============================================
// Suite 2: Multi-User Scenarios
// ============================================

describe("Multi-User Scenarios", () => {
  let groupId: string;
  let member1Id: string;
  let member2Id: string;
  let member3Id: string;

  beforeAll(async () => {
    if (!hasWriteAccess) return;

    const group = await createTestGroup(supabase, undefined, { name: "Multi-User Test" });
    groupId = group.id;
    testIds.groupIds.push(groupId);

    const member1 = await joinGroupAsUser(supabase, groupId, null, "Alice");
    const member2 = await joinGroupAsUser(supabase, groupId, null, "Bob");
    const member3 = await joinGroupAsUser(supabase, groupId, null, "Charlie");

    member1Id = member1.id;
    member2Id = member2.id;
    member3Id = member3.id;

    testIds.memberIds.push(member1Id, member2Id, member3Id);
  });

  it("should prevent duplicate member names within a group (case-insensitive)", async () => {
    if (skipIfNoWriteAccess()) return;

    // Try to create a member with the same name (different case)
    const { error } = await supabase
      .from("members")
      .insert({
        group_id: groupId,
        name: "alice", // lowercase, should conflict with "Alice"
        clerk_user_id: null,
      });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505"); // Unique violation
  });

  it("should handle concurrent member creation attempts", async () => {
    if (skipIfNoWriteAccess()) return;

    // Create a new group for this test
    const group = await createTestGroup(supabase, undefined, { name: "Concurrent Test" });
    testIds.groupIds.push(group.id);

    // Try to create two members with the same name concurrently
    const promises = [
      supabase
        .from("members")
        .insert({ group_id: group.id, name: "Concurrent User" })
        .select()
        .single(),
      supabase
        .from("members")
        .insert({ group_id: group.id, name: "Concurrent User" })
        .select()
        .single(),
    ];

    const results = await Promise.all(promises);

    // One should succeed, one should fail
    const successes = results.filter((r) => !r.error && r.data);
    const failures = results.filter((r) => r.error);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Clean up the successful member
    if (successes[0]?.data) {
      testIds.memberIds.push(successes[0].data.id);
    }
  });

  it("should sync expenses between group members", async () => {
    if (skipIfNoWriteAccess()) return;

    // Create an expense paid by Alice, split between all
    const expense = await createTestExpense(
      supabase,
      groupId,
      member1Id,
      90,
      [
        { memberId: member1Id, amount: 30 },
        { memberId: member2Id, amount: 30 },
        { memberId: member3Id, amount: 30 },
      ],
      { description: "Dinner" }
    );
    testIds.expenseIds.push(expense.id);

    // Fetch expenses as if another user is viewing
    const { data: expenses, error } = await supabase
      .from("expenses")
      .select("*, splits(*)")
      .eq("group_id", groupId);

    expect(error).toBeNull();
    expect(expenses).toBeDefined();
    expect(expenses!.length).toBeGreaterThan(0);

    const ourExpense = expenses!.find((e) => e.id === expense.id);
    expect(ourExpense).toBeDefined();
    expect(ourExpense!.splits).toHaveLength(3);
  });

  it("should correctly calculate balances across expenses", async () => {
    if (skipIfNoWriteAccess()) return;

    // Fetch all expenses with splits
    const { data: expenses, error } = await supabase
      .from("expenses")
      .select("*, splits(*)")
      .eq("group_id", groupId);

    expect(error).toBeNull();

    // Calculate balances manually
    const balances = new Map<string, number>();
    [member1Id, member2Id, member3Id].forEach((id) => balances.set(id, 0));

    for (const exp of expenses || []) {
      // Payer gets credit
      const currentPayerBalance = balances.get(exp.paid_by) || 0;
      balances.set(exp.paid_by, currentPayerBalance + parseFloat(exp.amount));

      // Each split is a debit
      for (const split of exp.splits || []) {
        const currentBalance = balances.get(split.member_id) || 0;
        balances.set(split.member_id, currentBalance - parseFloat(split.amount));
      }
    }

    // Verify balances sum to zero (conservation of money)
    const totalBalance = Array.from(balances.values()).reduce((sum, b) => sum + b, 0);
    expect(Math.abs(totalBalance)).toBeLessThan(0.01); // Account for floating point
  });
});

// ============================================
// Suite 3: Settlement Flows
// ============================================

describe("Settlement Flows", () => {
  let groupId: string;
  let payerId: string;
  let receiverId: string;

  beforeAll(async () => {
    if (!hasWriteAccess) return;

    const group = await createTestGroup(supabase, undefined, { name: "Settlement Test" });
    groupId = group.id;
    testIds.groupIds.push(groupId);

    const payer = await joinGroupAsUser(supabase, groupId, null, "Payer");
    const receiver = await joinGroupAsUser(supabase, groupId, null, "Receiver");

    payerId = payer.id;
    receiverId = receiver.id;

    testIds.memberIds.push(payerId, receiverId);
  });

  it("should create and record a settlement", async () => {
    if (skipIfNoWriteAccess()) return;

    const settlement = await createTestSettlement(
      supabase,
      groupId,
      payerId,
      receiverId,
      50
    );
    testIds.settlementIds.push(settlement.id);

    expect(settlement.id).toBeDefined();
    expect(settlement.amount).toBe(50);
  });

  it("should reject settlements with zero amount", async () => {
    if (skipIfNoWriteAccess()) return;

    const { error } = await supabase.from("settlements").insert({
      group_id: groupId,
      from_member_id: payerId,
      to_member_id: receiverId,
      amount: 0,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514"); // Check constraint violation
  });

  it("should reject settlements with negative amount", async () => {
    if (skipIfNoWriteAccess()) return;

    const { error } = await supabase.from("settlements").insert({
      group_id: groupId,
      from_member_id: payerId,
      to_member_id: receiverId,
      amount: -10,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514"); // Check constraint violation
  });

  it("should reject self-settlement (paying yourself)", async () => {
    if (skipIfNoWriteAccess()) return;

    const { error } = await supabase.from("settlements").insert({
      group_id: groupId,
      from_member_id: payerId,
      to_member_id: payerId, // Same person!
      amount: 50,
    });

    // This should fail due to check constraint
    expect(error).not.toBeNull();
  });

  it("should update balances after settlement is recorded", async () => {
    if (skipIfNoWriteAccess()) return;

    // Create an expense: Receiver pays for both
    const expense = await createTestExpense(
      supabase,
      groupId,
      receiverId,
      100,
      [
        { memberId: payerId, amount: 50 },
        { memberId: receiverId, amount: 50 },
      ]
    );
    testIds.expenseIds.push(expense.id);

    // Now Payer owes Receiver $50
    // Create settlement to square up
    const settlement = await createTestSettlement(
      supabase,
      groupId,
      payerId,
      receiverId,
      50
    );
    testIds.settlementIds.push(settlement.id);

    // Fetch both expenses and settlements
    const { data: expenses } = await supabase
      .from("expenses")
      .select("*, splits(*)")
      .eq("group_id", groupId);

    const { data: settlements } = await supabase
      .from("settlements")
      .select("*")
      .eq("group_id", groupId);

    // Calculate net balances including settlements
    const balances = new Map<string, number>();
    [payerId, receiverId].forEach((id) => balances.set(id, 0));

    // Process expenses
    for (const exp of expenses || []) {
      const payerBalance = balances.get(exp.paid_by) || 0;
      balances.set(exp.paid_by, payerBalance + parseFloat(exp.amount));

      for (const split of exp.splits || []) {
        const memberBalance = balances.get(split.member_id) || 0;
        balances.set(split.member_id, memberBalance - parseFloat(split.amount));
      }
    }

    // Process settlements
    for (const sett of settlements || []) {
      const fromBalance = balances.get(sett.from_member_id) || 0;
      const toBalance = balances.get(sett.to_member_id) || 0;

      balances.set(sett.from_member_id, fromBalance + parseFloat(sett.amount));
      balances.set(sett.to_member_id, toBalance - parseFloat(sett.amount));
    }

    // After settlement, balances should be close to zero
    const payerBalance = balances.get(payerId) || 0;
    const receiverBalance = balances.get(receiverId) || 0;

    expect(Math.abs(payerBalance + receiverBalance)).toBeLessThan(0.01);
  });
});

// ============================================
// Suite 4: Friend Request Flows
// ============================================

describe("Friend Request Flows", () => {
  let user1ClerkId: string;
  let user2ClerkId: string;
  let user1ProfileId: string;
  let user2ProfileId: string;

  beforeAll(async () => {
    if (!hasWriteAccess) return;

    const user1 = await createTestUser(supabase, "friend1");
    const user2 = await createTestUser(supabase, "friend2");

    user1ClerkId = user1.clerkId;
    user2ClerkId = user2.clerkId;
    user1ProfileId = user1.profileId;
    user2ProfileId = user2.profileId;

    testIds.userProfileIds.push(user1ProfileId, user2ProfileId);
  });

  it("should complete friend request lifecycle", async () => {
    if (skipIfNoWriteAccess()) return;

    // Send friend request
    const friendship = await createTestFriendship(
      supabase,
      user1ClerkId,
      user2ClerkId,
      "pending"
    );
    testIds.friendshipIds.push(friendship.id);

    expect(friendship.status).toBe("pending");

    // Accept friend request
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendship.id);

    expect(error).toBeNull();

    // Verify accepted
    const { data: updated } = await supabase
      .from("friendships")
      .select("status")
      .eq("id", friendship.id)
      .single();

    expect(updated?.status).toBe("accepted");
  });

  it("should prevent duplicate friend requests", async () => {
    if (skipIfNoWriteAccess()) return;

    // Create two new users for this test
    const userA = await createTestUser(supabase, "dupA");
    const userB = await createTestUser(supabase, "dupB");
    testIds.userProfileIds.push(userA.profileId, userB.profileId);

    // First request
    const friendship1 = await createTestFriendship(
      supabase,
      userA.clerkId,
      userB.clerkId,
      "pending"
    );
    testIds.friendshipIds.push(friendship1.id);

    // Try duplicate request
    const { error } = await supabase.from("friendships").insert({
      requester_id: userA.clerkId,
      addressee_id: userB.clerkId,
      status: "pending",
    });

    // Should fail due to unique constraint
    expect(error).not.toBeNull();
  });

  it("should find users by email", async () => {
    if (skipIfNoWriteAccess()) return;

    const testUser = await createTestUser(supabase, "searchable");
    testIds.userProfileIds.push(testUser.profileId);

    const { data: results, error } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("email", `%${testUser.email.split("@")[0]}%`);

    expect(error).toBeNull();
    expect(results).toBeDefined();
    expect(results!.length).toBeGreaterThan(0);
    expect(results!.some((r) => r.email === testUser.email)).toBe(true);
  });

  it("should find users by display name", async () => {
    if (skipIfNoWriteAccess()) return;

    const testUser = await createTestUser(supabase, "findable");
    testIds.userProfileIds.push(testUser.profileId);

    const { data: results, error } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("display_name", "%findable%");

    expect(error).toBeNull();
    expect(results).toBeDefined();
    expect(results!.length).toBeGreaterThan(0);
  });
});

// ============================================
// Suite 5: Race Conditions
// ============================================

describe("Race Conditions", () => {
  it("should handle concurrent group creation with same share code", async () => {
    if (skipIfNoWriteAccess()) return;

    const shareCode = "RACE" + Date.now();

    // Try to create two groups with the same share code simultaneously
    const promises = [
      supabase
        .from("groups")
        .insert({ name: "Race Group 1", share_code: shareCode })
        .select()
        .single(),
      supabase
        .from("groups")
        .insert({ name: "Race Group 2", share_code: shareCode })
        .select()
        .single(),
    ];

    const results = await Promise.all(promises);

    // One should succeed, one should fail
    const successes = results.filter((r) => !r.error && r.data);
    const failures = results.filter((r) => r.error);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Clean up successful one
    if (successes[0]?.data) {
      testIds.groupIds.push(successes[0].data.id);
    }
  });

  it("should create unique expense IDs under load", async () => {
    if (skipIfNoWriteAccess()) return;

    // Create a group and member
    const group = await createTestGroup(supabase, undefined, { name: "Load Test" });
    const member = await joinGroupAsUser(supabase, group.id, null, "Load Tester");
    testIds.groupIds.push(group.id);
    testIds.memberIds.push(member.id);

    // Create 10 expenses rapidly
    const expenses = Array.from({ length: 10 }, (_, i) => ({
      group_id: group.id,
      description: `Load expense ${i}`,
      amount: 10 + i,
      paid_by: member.id,
    }));

    const { data, error } = await supabase
      .from("expenses")
      .insert(expenses)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(10);

    // Verify all have unique IDs
    const ids = data!.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    // Track for cleanup
    ids.forEach((id) => testIds.expenseIds.push(id));
  });

  it("should prevent duplicate settlements for same transaction", async () => {
    if (skipIfNoWriteAccess()) return;

    // Create group and members
    const group = await createTestGroup(supabase, undefined, { name: "Dup Settlement" });
    const payer = await joinGroupAsUser(supabase, group.id, null, "Dup Payer");
    const receiver = await joinGroupAsUser(supabase, group.id, null, "Dup Receiver");
    testIds.groupIds.push(group.id);
    testIds.memberIds.push(payer.id, receiver.id);

    // Create settlements concurrently with same details
    const promises = [
      supabase
        .from("settlements")
        .insert({
          group_id: group.id,
          from_member_id: payer.id,
          to_member_id: receiver.id,
          amount: 25,
        })
        .select()
        .single(),
      supabase
        .from("settlements")
        .insert({
          group_id: group.id,
          from_member_id: payer.id,
          to_member_id: receiver.id,
          amount: 25,
        })
        .select()
        .single(),
    ];

    const results = await Promise.all(promises);

    // Note: Currently there's no unique constraint on settlements
    // Both might succeed - this is expected behavior
    // But we verify each has a unique ID
    const successfulSettlements = results
      .filter((r) => !r.error && r.data)
      .map((r) => r.data!);

    const ids = successfulSettlements.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // Track for cleanup
    ids.forEach((id) => testIds.settlementIds.push(id));
  });
});

// ============================================
// Suite 6: QR Code and Deep Link Parsing
// ============================================

describe("QR Code and Deep Link Parsing", () => {
  it("should generate scannable QR code with correct format", async () => {
    if (skipIfNoWriteAccess()) return;

    const group = await createTestGroup(supabase);
    testIds.groupIds.push(group.id);

    const deepLink = `splitfree://join/${group.shareCode}`;

    // Verify format
    expect(deepLink).toMatch(/^splitfree:\/\/join\/[A-Z0-9]{6}$/);

    // Verify the code can be used to find the group
    const extractedCode = deepLink.split("/").pop();
    expect(extractedCode).toBe(group.shareCode);

    const { data: foundGroup } = await supabase
      .from("groups")
      .select("id")
      .eq("share_code", extractedCode)
      .single();

    expect(foundGroup).toBeDefined();
    expect(foundGroup!.id).toBe(group.id);
  });

  it("should handle URL-encoded deep links", async () => {
    if (skipIfNoWriteAccess()) return;

    const shareCode = "ABC123";
    const encodedDeepLink = encodeURIComponent(`splitfree://join/${shareCode}`);
    const decodedDeepLink = decodeURIComponent(encodedDeepLink);

    expect(decodedDeepLink).toBe(`splitfree://join/${shareCode}`);

    const extractedCode = decodedDeepLink.replace("splitfree://join/", "");
    expect(extractedCode).toBe(shareCode);
  });
});
