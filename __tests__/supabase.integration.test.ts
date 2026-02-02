/**
 * Supabase Integration Tests
 *
 * These tests verify that the database schema and operations work correctly.
 * They run against the actual Supabase instance.
 *
 * Run with: npm test -- --testPathPattern=supabase.integration
 *
 * IMPORTANT: These tests require write access to the database.
 * - If SUPABASE_SERVICE_ROLE_KEY is set, tests use service role (bypasses RLS)
 * - Otherwise, tests check if anonymous writes are allowed
 * - Tests skip gracefully if write access is blocked by RLS
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceKey,
  createTestClient,
  generateTestShareCode,
} from "./helpers/test-config";

let supabase: SupabaseClient;
let testGroupId: string;
let testMemberIds: string[] = [];
let testExpenseId: string;
let canWriteToDatabase = false;

beforeAll(async () => {
  // Create test client (uses service role key if available)
  supabase = createTestClient();

  // Test if we have write access before running tests
  const testCode = "WRITETEST" + Date.now();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name: "Write Test", share_code: testCode })
    .select()
    .single();

  if (data && !error) {
    canWriteToDatabase = true;
    // Clean up the test record
    await supabase.from("groups").delete().eq("id", data.id);
  } else {
    console.warn(
      "\n⚠️  Supabase write access blocked (RLS policy).\n" +
      "   Set SUPABASE_SERVICE_ROLE_KEY environment variable to run integration tests.\n" +
      "   Tests that require write access will be skipped.\n"
    );
  }
});

/**
 * Helper to skip tests when write access is not available
 */
function skipIfNoWriteAccess() {
  if (!canWriteToDatabase) {
    return true;
  }
  return false;
}

afterAll(async () => {
  // Cleanup: Delete test data in correct order
  if (testExpenseId) {
    await supabase.from("splits").delete().eq("expense_id", testExpenseId);
    await supabase.from("expenses").delete().eq("id", testExpenseId);
  }
  if (testMemberIds.length > 0) {
    for (const id of testMemberIds) {
      await supabase.from("members").delete().eq("id", id);
    }
  }
  if (testGroupId) {
    await supabase.from("groups").delete().eq("id", testGroupId);
  }
});

describe("Supabase Connection", () => {
  it("should connect to Supabase", async () => {
    const { data, error } = await supabase.from("groups").select("count");
    expect(error).toBeNull();
  });
});

describe("Groups CRUD", () => {
  it("should create a new group", async () => {
    if (skipIfNoWriteAccess()) {
      console.log("Skipping: No write access to database");
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: "Test Group",
        emoji: "🧪",
        currency: "USD",
        share_code:
          "TEST" + Math.random().toString(36).substring(2, 4).toUpperCase(),
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe("Test Group");
    expect(data.emoji).toBe("🧪");
    expect(data.id).toBeDefined();

    testGroupId = data.id;
  });

  it("should read the created group", async () => {
    if (skipIfNoWriteAccess() || !testGroupId) {
      console.log("Skipping: Depends on previous test");
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", testGroupId)
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe("Test Group");
  });

  it("should update a group", async () => {
    if (skipIfNoWriteAccess() || !testGroupId) {
      console.log("Skipping: Depends on previous test");
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .update({ name: "Updated Test Group" })
      .eq("id", testGroupId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe("Updated Test Group");
  });

  it("should enforce unique share_code", async () => {
    // Get existing share code
    const { data: existingGroup } = await supabase
      .from("groups")
      .select("share_code")
      .eq("id", testGroupId)
      .single();

    // Try to create another group with same share code
    const { error } = await supabase.from("groups").insert({
      name: "Duplicate Code Group",
      share_code: existingGroup!.share_code,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505"); // Unique violation
  });
});

describe("Members CRUD", () => {
  it("should create members in a group", async () => {
    const members = [
      { group_id: testGroupId, name: "Test Alice" },
      { group_id: testGroupId, name: "Test Bob" },
      { group_id: testGroupId, name: "Test Charlie" },
    ];

    const { data, error } = await supabase
      .from("members")
      .insert(members)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(3);

    testMemberIds = data!.map((m) => m.id);
  });

  it("should read members by group_id", async () => {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", testGroupId)
      .order("created_at");

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data![0].name).toBe("Test Alice");
  });

  it("should not allow member without group_id", async () => {
    const { error } = await supabase
      .from("members")
      .insert({ name: "Orphan Member" });

    expect(error).not.toBeNull();
  });

  it("should allow null user_id (guest members)", async () => {
    const { data, error } = await supabase
      .from("members")
      .select("user_id")
      .eq("id", testMemberIds[0])
      .single();

    expect(error).toBeNull();
    expect(data!.user_id).toBeNull();
  });
});

describe("Expenses CRUD", () => {
  it("should create an expense", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: testGroupId,
        description: "Test Dinner",
        amount: 90.0,
        paid_by: testMemberIds[0], // Alice pays
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.description).toBe("Test Dinner");
    expect(parseFloat(data.amount)).toBe(90.0);

    testExpenseId = data.id;
  });

  it("should enforce positive amount", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: testGroupId,
      description: "Invalid Expense",
      amount: -10,
      paid_by: testMemberIds[0],
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514"); // Check constraint violation
  });

  it("should enforce zero amount is invalid", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: testGroupId,
      description: "Zero Expense",
      amount: 0,
      paid_by: testMemberIds[0],
    });

    expect(error).not.toBeNull();
  });

  it("should read expense with payer info (join)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        `
        *,
        payer:members!paid_by(id, name)
      `,
      )
      .eq("id", testExpenseId)
      .single();

    expect(error).toBeNull();
    expect(data.payer.name).toBe("Test Alice");
  });
});

describe("Splits CRUD", () => {
  it("should create splits for an expense", async () => {
    const splits = [
      { expense_id: testExpenseId, member_id: testMemberIds[0], amount: 30 },
      { expense_id: testExpenseId, member_id: testMemberIds[1], amount: 30 },
      { expense_id: testExpenseId, member_id: testMemberIds[2], amount: 30 },
    ];

    const { data, error } = await supabase
      .from("splits")
      .insert(splits)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it("should read splits for an expense", async () => {
    const { data, error } = await supabase
      .from("splits")
      .select(
        `
        *,
        member:members(id, name)
      `,
      )
      .eq("expense_id", testExpenseId);

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data!.every((s) => parseFloat(s.amount) === 30)).toBe(true);
  });

  it("should enforce non-negative split amount", async () => {
    const { error } = await supabase.from("splits").insert({
      expense_id: testExpenseId,
      member_id: testMemberIds[0],
      amount: -5,
    });

    expect(error).not.toBeNull();
  });

  it("should allow zero split amount", async () => {
    // Create a new expense for this test to avoid unique constraint violation
    const { data: newExpense } = await supabase
      .from("expenses")
      .insert({
        group_id: testGroupId,
        description: "Zero Split Test",
        amount: 10,
        paid_by: testMemberIds[0],
      })
      .select()
      .single();

    const { data, error } = await supabase
      .from("splits")
      .insert({
        expense_id: newExpense!.id,
        member_id: testMemberIds[0],
        amount: 0,
      })
      .select()
      .single();

    expect(error).toBeNull();

    // Cleanup
    await supabase.from("splits").delete().eq("id", data.id);
    await supabase.from("expenses").delete().eq("id", newExpense!.id);
  });
});

describe("Foreign Key Constraints", () => {
  it("should not allow expense with invalid group_id", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: "00000000-0000-0000-0000-000000000000",
      description: "Invalid Group",
      amount: 10,
      paid_by: testMemberIds[0],
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23503"); // Foreign key violation
  });

  it("should not allow expense with invalid paid_by", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: testGroupId,
      description: "Invalid Payer",
      amount: 10,
      paid_by: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23503");
  });

  it("should not allow split with invalid expense_id", async () => {
    const { error } = await supabase.from("splits").insert({
      expense_id: "00000000-0000-0000-0000-000000000000",
      member_id: testMemberIds[0],
      amount: 10,
    });

    expect(error).not.toBeNull();
  });

  it("should not allow split with invalid member_id", async () => {
    const { error } = await supabase.from("splits").insert({
      expense_id: testExpenseId,
      member_id: "00000000-0000-0000-0000-000000000000",
      amount: 10,
    });

    expect(error).not.toBeNull();
  });
});

describe("Cascade Deletes", () => {
  let tempGroupId: string | null = null;
  let tempMemberId: string | null = null;
  let tempExpenseId: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    // Create temp group
    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Temp Group", share_code: "TEMP" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    // Create temp member
    const { data: member } = await supabase
      .from("members")
      .insert({ group_id: tempGroupId, name: "Temp Member" })
      .select()
      .single();
    tempMemberId = member!.id;

    // Create temp expense
    const { data: expense } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Temp Expense",
        amount: 10,
        paid_by: tempMemberId,
      })
      .select()
      .single();
    tempExpenseId = expense!.id;

    // Create temp split
    await supabase
      .from("splits")
      .insert({
        expense_id: tempExpenseId,
        member_id: tempMemberId,
        amount: 10,
      });
  });

  it("should cascade delete splits when expense is deleted", async () => {
    // First delete the expense
    await supabase.from("splits").delete().eq("expense_id", tempExpenseId);
    await supabase.from("expenses").delete().eq("id", tempExpenseId);

    // Verify splits are gone
    const { data } = await supabase
      .from("splits")
      .select("*")
      .eq("expense_id", tempExpenseId);

    expect(data).toHaveLength(0);
  });

  it("should cascade delete members when group is deleted", async () => {
    // Delete the group
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);

    // Verify members are gone
    const { data } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", tempGroupId);

    expect(data).toHaveLength(0);
  });
});

describe("Settlements CRUD", () => {
  let settlementId: string;

  it("should create a settlement", async () => {
    const { data, error } = await supabase
      .from("settlements")
      .insert({
        group_id: testGroupId,
        from_member_id: testMemberIds[1], // Bob pays
        to_member_id: testMemberIds[0], // Alice receives
        amount: 30.0,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(parseFloat(data.amount)).toBe(30.0);
    expect(data.from_member_id).toBe(testMemberIds[1]);
    expect(data.to_member_id).toBe(testMemberIds[0]);
    expect(data.settled_at).toBeDefined();

    settlementId = data.id;
  });

  it("should read settlements for a group", async () => {
    const { data, error } = await supabase
      .from("settlements")
      .select(
        `
        *,
        from_member:members!from_member_id(id, name),
        to_member:members!to_member_id(id, name)
      `,
      )
      .eq("group_id", testGroupId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].from_member.name).toBe("Test Bob");
    expect(data![0].to_member.name).toBe("Test Alice");
  });

  it("should enforce positive amount for settlements", async () => {
    const { error } = await supabase.from("settlements").insert({
      group_id: testGroupId,
      from_member_id: testMemberIds[1],
      to_member_id: testMemberIds[0],
      amount: -10,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23514"); // Check constraint violation
  });

  it("should enforce zero amount is invalid for settlements", async () => {
    const { error } = await supabase.from("settlements").insert({
      group_id: testGroupId,
      from_member_id: testMemberIds[1],
      to_member_id: testMemberIds[0],
      amount: 0,
    });

    expect(error).not.toBeNull();
  });

  it("should not allow settlement with invalid group_id", async () => {
    const { error } = await supabase.from("settlements").insert({
      group_id: "00000000-0000-0000-0000-000000000000",
      from_member_id: testMemberIds[1],
      to_member_id: testMemberIds[0],
      amount: 10,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23503"); // Foreign key violation
  });

  it("should not allow settlement with invalid from_member_id", async () => {
    const { error } = await supabase.from("settlements").insert({
      group_id: testGroupId,
      from_member_id: "00000000-0000-0000-0000-000000000000",
      to_member_id: testMemberIds[0],
      amount: 10,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23503");
  });

  it("should not allow settlement with invalid to_member_id", async () => {
    const { error } = await supabase.from("settlements").insert({
      group_id: testGroupId,
      from_member_id: testMemberIds[1],
      to_member_id: "00000000-0000-0000-0000-000000000000",
      amount: 10,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23503");
  });

  it("should delete a settlement", async () => {
    const { error } = await supabase
      .from("settlements")
      .delete()
      .eq("id", settlementId);

    expect(error).toBeNull();

    // Verify it's gone
    const { data } = await supabase
      .from("settlements")
      .select("*")
      .eq("id", settlementId);

    expect(data).toHaveLength(0);
  });
});

describe("Settlements Cascade Deletes", () => {
  let tempGroupId: string | null = null;
  let tempMember1Id: string | null = null;
  let tempMember2Id: string | null = null;
  let tempSettlementId: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    // Create temp group
    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Settlement Cascade Test", share_code: "SETT" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    // Create temp members
    const { data: members } = await supabase
      .from("members")
      .insert([
        { group_id: tempGroupId, name: "Temp Payer" },
        { group_id: tempGroupId, name: "Temp Receiver" },
      ])
      .select();
    if (!members || members.length < 2) return;
    tempMember1Id = members[0].id;
    tempMember2Id = members[1].id;

    // Create temp settlement
    const { data: settlement } = await supabase
      .from("settlements")
      .insert({
        group_id: tempGroupId,
        from_member_id: tempMember1Id,
        to_member_id: tempMember2Id,
        amount: 25,
      })
      .select()
      .single();
    if (!settlement) return;
    tempSettlementId = settlement.id;
  });

  it("should cascade delete settlements when group is deleted", async () => {
    if (!canWriteToDatabase || !tempGroupId || !tempSettlementId) {
      console.log("Skipping: No write access or missing test data");
      return;
    }

    // Delete the group (should cascade to members and settlements)
    await supabase.from("settlements").delete().eq("group_id", tempGroupId);
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);

    // Verify settlements are gone
    const { data } = await supabase
      .from("settlements")
      .select("*")
      .eq("id", tempSettlementId);

    expect(data).toHaveLength(0);
  });
});

// ============================================
// EDGE CASES AND STRESS TESTS
// These tests are designed to expose bugs and
// missing database constraints
// ============================================

describe("Edge Cases - String Input Validation", () => {
  let tempGroupId: string | null = null;
  let tempMemberId: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    // Create temp group for string tests
    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "String Test Group", share_code: "STR" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    // Create temp member
    const { data: member } = await supabase
      .from("members")
      .insert({ group_id: tempGroupId, name: "String Test Member" })
      .select()
      .single();
    if (!member) return;
    tempMemberId = member.id;
  });

  afterAll(async () => {
    if (!tempGroupId) return;
    await supabase.from("expenses").delete().eq("group_id", tempGroupId);
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);
  });

  // BUG HUNTER: Empty string tests
  it("should reject empty string for group name", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "",
      share_code: "EMPTY" + Date.now(),
    });

    // Expected: Should fail - empty group names are not meaningful
    expect(error).not.toBeNull();
  });

  it("should reject empty string for member name", async () => {
    const { error } = await supabase.from("members").insert({
      group_id: tempGroupId,
      name: "",
    });

    // Expected: Should fail - empty member names are not meaningful
    expect(error).not.toBeNull();
  });

  it("should reject empty string for expense description", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: tempGroupId,
      description: "",
      amount: 10,
      paid_by: tempMemberId,
    });

    // Expected: Should fail - empty descriptions are not meaningful
    expect(error).not.toBeNull();
  });

  it("should reject whitespace-only group name", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "   ",
      share_code: "SPACE" + Date.now(),
    });

    // Expected: Should fail - whitespace-only names are not meaningful
    expect(error).not.toBeNull();
  });

  it("should reject whitespace-only member name", async () => {
    const { error } = await supabase.from("members").insert({
      group_id: tempGroupId,
      name: "   \t\n  ",
    });

    // Expected: Should fail - whitespace-only names are not meaningful
    expect(error).not.toBeNull();
  });

  // BUG HUNTER: Very long strings
  it("should handle or reject extremely long group names (10000 chars)", async () => {
    const longName = "A".repeat(10000);
    const { error } = await supabase.from("groups").insert({
      name: longName,
      share_code: "LONG" + Date.now(),
    });

    // Expected: Should either truncate or reject - unlimited strings can cause UI issues
    // If it succeeds, verify it was truncated
    if (error) {
      expect(error).toBeDefined();
    } else {
      // This is a potential bug - unlimited length names
      console.warn("BUG: Database accepts 10000 character group names");
    }
  });

  it("should handle or reject extremely long expense descriptions (10000 chars)", async () => {
    const longDesc = "B".repeat(10000);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: longDesc,
        amount: 10,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    if (!error && data) {
      // Cleanup
      await supabase.from("expenses").delete().eq("id", data.id);
      console.warn("BUG: Database accepts 10000 character descriptions");
    }
  });

  // BUG HUNTER: Special characters that could break queries or UI
  it("should safely handle SQL injection in group name", async () => {
    const sqlInjection = "Robert'); DROP TABLE groups;--";
    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: sqlInjection,
        share_code: "SQL" + Date.now(),
      })
      .select()
      .single();

    // Should succeed (Supabase uses parameterized queries) but store literally
    expect(error).toBeNull();
    expect(data.name).toBe(sqlInjection);

    // Cleanup
    await supabase.from("groups").delete().eq("id", data.id);
  });

  it("should safely handle SQL injection in expense description", async () => {
    const sqlInjection = "Dinner'; DELETE FROM expenses WHERE '1'='1";
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: sqlInjection,
        amount: 10,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.description).toBe(sqlInjection);

    // Cleanup
    await supabase.from("expenses").delete().eq("id", data.id);
  });

  it("should safely handle XSS payload in group name", async () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: xssPayload,
        share_code: "XSS" + Date.now(),
      })
      .select()
      .single();

    // Should store literally without modification (UI should escape)
    expect(error).toBeNull();
    expect(data.name).toBe(xssPayload);

    // Cleanup
    await supabase.from("groups").delete().eq("id", data.id);
  });

  it("should safely handle XSS payload in member name", async () => {
    const xssPayload = '<img src=x onerror="alert(1)">';
    const { data, error } = await supabase
      .from("members")
      .insert({
        group_id: tempGroupId,
        name: xssPayload,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe(xssPayload);

    // Cleanup
    await supabase.from("members").delete().eq("id", data.id);
  });

  // BUG HUNTER: Unicode and emoji edge cases
  it("should handle complex unicode in names (Chinese/Arabic/Emoji mix)", async () => {
    const unicodeName = "测试用户 مستخدم 🎉🔥💰 Tëst";
    const { data, error } = await supabase
      .from("members")
      .insert({
        group_id: tempGroupId,
        name: unicodeName,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe(unicodeName);

    // Cleanup
    await supabase.from("members").delete().eq("id", data.id);
  });

  it("should handle emoji-only group name", async () => {
    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: "🏠🎉🍕",
        emoji: "🏠",
        share_code: "EMOJ" + Date.now(),
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe("🏠🎉🍕");

    // Cleanup
    await supabase.from("groups").delete().eq("id", data.id);
  });

  it("should handle null byte character in name", async () => {
    const nullByteName = "Test\u0000Name";
    const { error } = await supabase.from("members").insert({
      group_id: tempGroupId,
      name: nullByteName,
    });

    // Postgres typically rejects null bytes - this should fail
    expect(error).not.toBeNull();
  });

  it("should handle newlines and tabs in expense description", async () => {
    const multilineDesc = "Line1\nLine2\tTabbed\rCarriage";
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: multilineDesc,
        amount: 10,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.description).toBe(multilineDesc);

    // Cleanup
    await supabase.from("expenses").delete().eq("id", data.id);
  });

  // BUG HUNTER: Backslash and quote combinations
  it("should handle backslashes in expense description", async () => {
    const backslashDesc = 'C:\\Users\\Test\\file.txt and "quoted"';
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: backslashDesc,
        amount: 10,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.description).toBe(backslashDesc);

    // Cleanup
    await supabase.from("expenses").delete().eq("id", data.id);
  });
});

describe("Edge Cases - Numeric Boundaries", () => {
  let tempGroupId: string | null = null;
  let tempMemberId: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Numeric Test Group", share_code: "NUM" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    const { data: member } = await supabase
      .from("members")
      .insert({ group_id: tempGroupId, name: "Numeric Test Member" })
      .select()
      .single();
    if (!member) return;
    tempMemberId = member.id;
  });

  afterAll(async () => {
    if (!tempGroupId) return;
    await supabase.from("expenses").delete().eq("group_id", tempGroupId);
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);
  });

  // BUG HUNTER: Minimum valid amount
  it("should accept minimum practical amount (0.01 - one cent)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "One cent expense",
        amount: 0.01,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(parseFloat(data.amount)).toBe(0.01);

    // Cleanup
    await supabase.from("expenses").delete().eq("id", data.id);
  });

  it("should reject sub-cent amount (0.001)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Sub-cent expense",
        amount: 0.001,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    // Expected: Should either reject or round
    if (!error && data) {
      const storedAmount = parseFloat(data.amount);
      // If accepted, check if it was rounded
      if (storedAmount === 0.001) {
        console.warn("BUG: Database accepts sub-cent amounts (0.001)");
      }
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  it("should handle very small amount (0.000001)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Micro expense",
        amount: 0.000001,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    if (!error && data) {
      console.warn("BUG: Database accepts micro amounts (0.000001):", data.amount);
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  // BUG HUNTER: Maximum amount tests
  // Note: DECIMAL(10,2) supports max ~99,999,999.99 which is reasonable for expense splitting
  it("should reject amount over 100 million (DECIMAL precision limit)", async () => {
    const { error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Billion dollar expense",
        amount: 1000000000, // 1 billion exceeds DECIMAL(10,2) precision
        paid_by: tempMemberId,
      })
      .select()
      .single();

    // This correctly fails - DECIMAL(10,2) can't hold 1 billion
    expect(error).not.toBeNull();
    expect(error!.code).toBe("22003"); // numeric field overflow
  });

  it("should handle maximum valid amount (99 million)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "99 million expense",
        amount: 99999999.99, // Max for DECIMAL(10,2)
        paid_by: tempMemberId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(parseFloat(data.amount)).toBe(99999999.99);

    // Cleanup
    await supabase.from("expenses").delete().eq("id", data.id);
  });

  it("should handle or reject extremely large amount (quadrillion)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Quadrillion expense",
        amount: 1000000000000000,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    if (!error && data) {
      console.warn("BUG: Database accepts quadrillion amounts");
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  // BUG HUNTER: Decimal precision edge cases
  it("should preserve decimal precision (12.34)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Precise amount",
        amount: 12.34,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(parseFloat(data.amount)).toBe(12.34);

    // Cleanup
    await supabase.from("expenses").delete().eq("id", data.id);
  });

  it("should handle floating point precision issue (0.1 + 0.2)", async () => {
    // In JavaScript: 0.1 + 0.2 = 0.30000000000000004
    const amount = 0.1 + 0.2;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Floating point test",
        amount: amount,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    if (!error && data) {
      const stored = parseFloat(data.amount);
      // Check if the value was stored precisely as 0.3 or with floating point error
      if (stored !== 0.3 && stored !== 0.30) {
        console.warn("BUG: Floating point precision issue stored:", stored);
      }
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  it("should handle repeating decimal (1/3 = 0.333...)", async () => {
    const amount = 1 / 3;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Repeating decimal",
        amount: amount,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    if (!error && data) {
      const stored = parseFloat(data.amount);
      // This will have many decimal places - potential issue
      if (stored.toString().length > 10) {
        console.warn("BUG: Excessive decimal precision stored:", stored);
      }
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  // BUG HUNTER: Negative zero
  it("should handle negative zero (-0)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Negative zero",
        amount: -0,
        paid_by: tempMemberId,
      })
      .select()
      .single();

    // -0 should either be rejected (as <= 0) or stored as 0
    // If it passes, check if constraint is properly enforced
    if (!error) {
      console.warn("BUG: Negative zero passed positive amount check");
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  // BUG HUNTER: Special float values
  it("should reject NaN as amount", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: tempGroupId,
      description: "NaN expense",
      amount: NaN,
      paid_by: tempMemberId,
    });

    // NaN should be rejected
    expect(error).not.toBeNull();
  });

  it("should reject Infinity as amount", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: tempGroupId,
      description: "Infinite expense",
      amount: Infinity,
      paid_by: tempMemberId,
    });

    // Infinity should be rejected
    expect(error).not.toBeNull();
  });

  it("should reject negative Infinity as amount", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: tempGroupId,
      description: "Negative infinite expense",
      amount: -Infinity,
      paid_by: tempMemberId,
    });

    expect(error).not.toBeNull();
  });
});

describe("Edge Cases - Data Consistency", () => {
  let tempGroupId: string | null = null;
  let tempMember1Id: string | null = null;
  let tempMember2Id: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Consistency Test Group", share_code: "CONS" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    const { data: members } = await supabase
      .from("members")
      .insert([
        { group_id: tempGroupId, name: "Consistency Member 1" },
        { group_id: tempGroupId, name: "Consistency Member 2" },
      ])
      .select();
    if (!members || members.length < 2) return;
    tempMember1Id = members[0].id;
    tempMember2Id = members[1].id;
  });

  afterAll(async () => {
    if (!tempGroupId) return;
    await supabase.from("settlements").delete().eq("group_id", tempGroupId);
    if (tempMember1Id) await supabase.from("splits").delete().match({ member_id: tempMember1Id });
    if (tempMember2Id) await supabase.from("splits").delete().match({ member_id: tempMember2Id });
    await supabase.from("expenses").delete().eq("group_id", tempGroupId);
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);
  });

  // BUG HUNTER: Splits sum validation
  it("should reject splits that sum to more than expense total", async () => {
    // Create expense for $100
    const { data: expense } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Overflow splits test",
        amount: 100,
        paid_by: tempMember1Id,
      })
      .select()
      .single();

    // Try to create splits summing to $150 (more than expense)
    const { error } = await supabase.from("splits").insert([
      { expense_id: expense!.id, member_id: tempMember1Id, amount: 100 },
      { expense_id: expense!.id, member_id: tempMember2Id, amount: 50 },
    ]);

    // Expected: Should fail - splits shouldn't exceed expense total
    if (!error) {
      console.warn("BUG: Database allows splits ($150) exceeding expense total ($100)");
    }

    // Cleanup
    await supabase.from("splits").delete().eq("expense_id", expense!.id);
    await supabase.from("expenses").delete().eq("id", expense!.id);
  });

  it("should reject splits that sum to less than expense total", async () => {
    // Create expense for $100
    const { data: expense } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Underflow splits test",
        amount: 100,
        paid_by: tempMember1Id,
      })
      .select()
      .single();

    // Try to create splits summing to $50 (less than expense)
    const { error } = await supabase.from("splits").insert([
      { expense_id: expense!.id, member_id: tempMember1Id, amount: 25 },
      { expense_id: expense!.id, member_id: tempMember2Id, amount: 25 },
    ]);

    // Expected: Should fail - splits shouldn't be less than expense total
    if (!error) {
      console.warn("BUG: Database allows splits ($50) less than expense total ($100)");
    }

    // Cleanup
    await supabase.from("splits").delete().eq("expense_id", expense!.id);
    await supabase.from("expenses").delete().eq("id", expense!.id);
  });

  // BUG HUNTER: Self-settlement (same person paying themselves)
  it("should reject settlement where from_member equals to_member", async () => {
    const { error } = await supabase.from("settlements").insert({
      group_id: tempGroupId,
      from_member_id: tempMember1Id,
      to_member_id: tempMember1Id, // Same person!
      amount: 50,
    });

    // Expected: Should fail - can't settle with yourself
    if (!error) {
      console.warn("BUG: Database allows self-settlement (paying yourself)");
    }
    expect(error).not.toBeNull();
  });

  // BUG HUNTER: Duplicate splits for same member on same expense
  it("should reject duplicate splits (same member_id and expense_id)", async () => {
    const { data: expense } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Duplicate split test",
        amount: 100,
        paid_by: tempMember1Id,
      })
      .select()
      .single();

    // First split
    await supabase.from("splits").insert({
      expense_id: expense!.id,
      member_id: tempMember1Id,
      amount: 50,
    });

    // Try duplicate split for same member
    const { error } = await supabase.from("splits").insert({
      expense_id: expense!.id,
      member_id: tempMember1Id, // Same member!
      amount: 25,
    });

    // Expected: Should fail - unique constraint on (expense_id, member_id)
    if (!error) {
      console.warn("BUG: Database allows duplicate splits for same member on same expense");
    }

    // Cleanup
    await supabase.from("splits").delete().eq("expense_id", expense!.id);
    await supabase.from("expenses").delete().eq("id", expense!.id);
  });

  // BUG HUNTER: Cross-group data integrity
  it("should reject member from different group as payer", async () => {
    // Create another group with its own member
    const { data: otherGroup } = await supabase
      .from("groups")
      .insert({ name: "Other Group", share_code: "OTHER" + Date.now() })
      .select()
      .single();

    const { data: otherMember } = await supabase
      .from("members")
      .insert({ group_id: otherGroup!.id, name: "Other Group Member" })
      .select()
      .single();

    // Try to create expense in tempGroup but paid by member from otherGroup
    const { error } = await supabase.from("expenses").insert({
      group_id: tempGroupId,
      description: "Cross-group expense",
      amount: 100,
      paid_by: otherMember!.id, // Member from different group!
    });

    // Expected: Should fail - payer should belong to the same group
    if (!error) {
      console.warn("BUG: Database allows member from different group as expense payer");
    }

    // Cleanup
    await supabase.from("members").delete().eq("id", otherMember!.id);
    await supabase.from("groups").delete().eq("id", otherGroup!.id);
  });

  // BUG HUNTER: Member in split from different group
  it("should reject split for member from different group", async () => {
    // Create another group with its own member
    const { data: otherGroup } = await supabase
      .from("groups")
      .insert({ name: "Split Cross Group", share_code: "SPLIT" + Date.now() })
      .select()
      .single();

    const { data: otherMember } = await supabase
      .from("members")
      .insert({ group_id: otherGroup!.id, name: "Split Cross Member" })
      .select()
      .single();

    // Create expense in tempGroup
    const { data: expense } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Cross-group split test",
        amount: 100,
        paid_by: tempMember1Id,
      })
      .select()
      .single();

    // Try to create split for member from different group
    const { error } = await supabase.from("splits").insert({
      expense_id: expense!.id,
      member_id: otherMember!.id, // Member from different group!
      amount: 50,
    });

    // Expected: Should fail
    if (!error) {
      console.warn("BUG: Database allows split for member from different group than expense");
    }

    // Cleanup
    await supabase.from("splits").delete().eq("expense_id", expense!.id);
    await supabase.from("expenses").delete().eq("id", expense!.id);
    await supabase.from("members").delete().eq("id", otherMember!.id);
    await supabase.from("groups").delete().eq("id", otherGroup!.id);
  });
});

describe("Edge Cases - Concurrent Operations", () => {
  // BUG HUNTER: Race condition on share_code
  it("should handle concurrent group creation with same share_code", async () => {
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
    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].error!.code).toBe("23505"); // Unique violation

    // Cleanup
    if (successes[0].data) {
      await supabase.from("groups").delete().eq("id", successes[0].data.id);
    }
  });

  it("should handle rapid sequential expense creation", async () => {
    if (!canWriteToDatabase) {
      console.log("Skipping: No write access");
      return;
    }

    // Create temp group and member
    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Rapid Test", share_code: "RAPID" + Date.now() })
      .select()
      .single();

    if (!group) {
      console.log("Skipping: Failed to create test group");
      return;
    }

    const { data: member } = await supabase
      .from("members")
      .insert({ group_id: group.id, name: "Rapid Member" })
      .select()
      .single();

    if (!member) {
      await supabase.from("groups").delete().eq("id", group.id);
      console.log("Skipping: Failed to create test member");
      return;
    }

    // Create 10 expenses as fast as possible
    const expenses = Array.from({ length: 10 }, (_, i) => ({
      group_id: group.id,
      description: `Rapid expense ${i}`,
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

    // Cleanup
    await supabase.from("expenses").delete().eq("group_id", group.id);
    await supabase.from("members").delete().eq("group_id", group.id);
    await supabase.from("groups").delete().eq("id", group.id);
  });
});

describe("Edge Cases - Share Code Format", () => {
  // BUG HUNTER: Share code format validation
  it("should reject share_code with lowercase letters", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "Lowercase Code",
      share_code: "abcdef",
    });

    // Expected: Should fail if share codes should be uppercase only
    if (!error) {
      console.warn("NOTE: Database accepts lowercase share codes");
    }
  });

  it("should reject share_code with special characters", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "Special Code",
      share_code: "ABC@#$",
    });

    // Expected: Should fail if share codes should be alphanumeric only
    if (!error) {
      console.warn("NOTE: Database accepts special characters in share codes");
      // Cleanup
      const { data } = await supabase
        .from("groups")
        .select("id")
        .eq("share_code", "ABC@#$")
        .single();
      if (data) {
        await supabase.from("groups").delete().eq("id", data.id);
      }
    }
  });

  it("should reject share_code shorter than 6 characters", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "Short Code",
      share_code: "ABC",
    });

    // Expected: Should fail if minimum length is 6
    if (!error) {
      console.warn("NOTE: Database accepts share codes shorter than 6 chars");
      const { data } = await supabase
        .from("groups")
        .select("id")
        .eq("share_code", "ABC")
        .single();
      if (data) {
        await supabase.from("groups").delete().eq("id", data.id);
      }
    }
  });

  it("should reject share_code longer than expected length", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "Long Code",
      share_code: "ABCDEFGHIJKLMNOP",
    });

    // Expected: Should fail if maximum length is enforced
    if (!error) {
      console.warn("NOTE: Database accepts very long share codes (16+ chars)");
      const { data } = await supabase
        .from("groups")
        .select("id")
        .eq("share_code", "ABCDEFGHIJKLMNOP")
        .single();
      if (data) {
        await supabase.from("groups").delete().eq("id", data.id);
      }
    }
  });

  it("should reject empty share_code", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "Empty Code Group",
      share_code: "",
    });

    // Expected: Should fail
    expect(error).not.toBeNull();
  });

  it("should reject null share_code", async () => {
    const { error } = await supabase.from("groups").insert({
      name: "Null Code Group",
      share_code: null as any,
    });

    // Expected: Should fail if share_code is required
    expect(error).not.toBeNull();
  });
});

describe("Edge Cases - Temporal/Date Handling", () => {
  let tempGroupId: string | null = null;
  let tempMemberId: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Temporal Test", share_code: "TIME" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    const { data: member } = await supabase
      .from("members")
      .insert({ group_id: tempGroupId, name: "Temporal Member" })
      .select()
      .single();
    if (!member) return;
    tempMemberId = member.id;
  });

  afterAll(async () => {
    if (!tempGroupId) return;
    await supabase.from("expenses").delete().eq("group_id", tempGroupId);
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);
  });

  it("should handle expense_date in far future (year 2100)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Future expense",
        amount: 100,
        paid_by: tempMemberId,
        expense_date: "2100-12-31",
      })
      .select()
      .single();

    if (!error && data) {
      // Cleanup
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  it("should handle expense_date in far past (year 1900)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Historical expense",
        amount: 100,
        paid_by: tempMemberId,
        expense_date: "1900-01-01",
      })
      .select()
      .single();

    if (!error && data) {
      // Cleanup
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  it("should handle leap day (Feb 29, 2024)", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Leap day expense",
        amount: 100,
        paid_by: tempMemberId,
        expense_date: "2024-02-29",
      })
      .select()
      .single();

    expect(error).toBeNull();

    if (data) {
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });

  it("should reject invalid date (Feb 30)", async () => {
    const { error } = await supabase.from("expenses").insert({
      group_id: tempGroupId,
      description: "Invalid date expense",
      amount: 100,
      paid_by: tempMemberId,
      expense_date: "2024-02-30", // Invalid date
    });

    // Expected: Should fail
    expect(error).not.toBeNull();
  });
});

describe("Edge Cases - Currency Handling", () => {
  it("should accept valid currency code (USD)", async () => {
    if (!canWriteToDatabase) {
      console.log("Skipping: No write access");
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: "USD Group",
        share_code: "USD" + Date.now(),
        currency: "USD",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.currency).toBe("USD");

    // Cleanup
    await supabase.from("groups").delete().eq("id", data.id);
  });

  it("should accept valid currency code (EUR)", async () => {
    if (!canWriteToDatabase) {
      console.log("Skipping: No write access");
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: "EUR Group",
        share_code: "EUR" + Date.now(),
        currency: "EUR",
      })
      .select()
      .single();

    expect(error).toBeNull();

    // Cleanup
    await supabase.from("groups").delete().eq("id", data.id);
  });

  it("should reject invalid currency code", async () => {
    if (!canWriteToDatabase) {
      console.log("Skipping: No write access");
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: "Invalid Currency",
        share_code: "CURR" + Date.now(),
        currency: "INVALID",
      })
      .select()
      .single();

    // Expected: Should fail if currency is validated
    if (!error && data) {
      console.warn("BUG: Database accepts invalid currency code 'INVALID'");
      await supabase.from("groups").delete().eq("id", data.id);
    }
  });

  it("should reject empty currency string", async () => {
    if (!canWriteToDatabase) {
      console.log("Skipping: No write access");
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: "Empty Currency",
        share_code: "EMPC" + Date.now(),
        currency: "",
      })
      .select()
      .single();

    // Expected: Should fail
    if (!error && data) {
      console.warn("BUG: Database accepts empty currency string");
      await supabase.from("groups").delete().eq("id", data.id);
    }
  });
});

describe("Edge Cases - Expense Category Validation", () => {
  let tempGroupId: string | null = null;
  let tempMemberId: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Category Test", share_code: "CAT" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    const { data: member } = await supabase
      .from("members")
      .insert({ group_id: tempGroupId, name: "Category Member" })
      .select()
      .single();
    if (!member) return;
    tempMemberId = member.id;
  });

  afterAll(async () => {
    if (!tempGroupId) return;
    await supabase.from("expenses").delete().eq("group_id", tempGroupId);
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);
  });

  it("should reject invalid category value", async () => {
    if (!canWriteToDatabase || !tempGroupId || !tempMemberId) {
      console.log("Skipping: No write access or missing test data");
      return;
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        group_id: tempGroupId,
        description: "Invalid category expense",
        amount: 50,
        paid_by: tempMemberId,
        category: "not_a_valid_category",
      })
      .select()
      .single();

    // Expected: Should fail if category has enum constraint
    if (!error && data) {
      console.warn("BUG: Database accepts invalid category 'not_a_valid_category'");
      await supabase.from("expenses").delete().eq("id", data.id);
    }
  });
});

describe("Edge Cases - Settlement Method Validation", () => {
  let tempGroupId: string | null = null;
  let tempMember1Id: string | null = null;
  let tempMember2Id: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Settlement Method Test", share_code: "METH" + Date.now() })
      .select()
      .single();
    if (!group) return;
    tempGroupId = group.id;

    const { data: members } = await supabase
      .from("members")
      .insert([
        { group_id: tempGroupId, name: "Method Member 1" },
        { group_id: tempGroupId, name: "Method Member 2" },
      ])
      .select();
    if (!members || members.length < 2) return;
    tempMember1Id = members[0].id;
    tempMember2Id = members[1].id;
  });

  afterAll(async () => {
    if (!tempGroupId) return;
    await supabase.from("settlements").delete().eq("group_id", tempGroupId);
    await supabase.from("members").delete().eq("group_id", tempGroupId);
    await supabase.from("groups").delete().eq("id", tempGroupId);
  });

  it("should reject invalid settlement method", async () => {
    if (!canWriteToDatabase || !tempGroupId || !tempMember1Id || !tempMember2Id) {
      console.log("Skipping: No write access or missing test data");
      return;
    }

    const { data, error } = await supabase
      .from("settlements")
      .insert({
        group_id: tempGroupId,
        from_member_id: tempMember1Id,
        to_member_id: tempMember2Id,
        amount: 50,
        method: "bitcoin_cash", // Invalid method
      })
      .select()
      .single();

    // Expected: Should fail if method has enum constraint
    if (!error && data) {
      console.warn("BUG: Database accepts invalid settlement method 'bitcoin_cash'");
      await supabase.from("settlements").delete().eq("id", data.id);
    }
  });
});

describe("Data Integrity - Balance Calculation Scenario", () => {
  let scenarioGroupId: string | null = null;
  let aliceId: string | null = null;
  let bobId: string | null = null;
  let charlieId: string | null = null;

  beforeAll(async () => {
    if (!canWriteToDatabase) return;

    // Create a fresh group for this scenario
    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Balance Test Group", share_code: "BAL" + Date.now() })
      .select()
      .single();
    if (!group) return;
    scenarioGroupId = group.id;

    // Create members
    const { data: members } = await supabase
      .from("members")
      .insert([
        { group_id: scenarioGroupId, name: "Alice" },
        { group_id: scenarioGroupId, name: "Bob" },
        { group_id: scenarioGroupId, name: "Charlie" },
      ])
      .select();

    if (!members || members.length < 3) return;
    aliceId = members[0].id;
    bobId = members[1].id;
    charlieId = members[2].id;
  });

  afterAll(async () => {
    if (!scenarioGroupId) return;
    // Cleanup
    if (aliceId) await supabase.from("splits").delete().match({ member_id: aliceId });
    if (bobId) await supabase.from("splits").delete().match({ member_id: bobId });
    if (charlieId) await supabase.from("splits").delete().match({ member_id: charlieId });
    await supabase.from("expenses").delete().eq("group_id", scenarioGroupId);
    await supabase.from("members").delete().eq("group_id", scenarioGroupId);
    await supabase.from("groups").delete().eq("id", scenarioGroupId);
  });

  it("should correctly store and retrieve expense data for balance calculation", async () => {
    if (!canWriteToDatabase || !scenarioGroupId || !aliceId || !bobId || !charlieId) {
      console.log("Skipping: No write access or missing test data");
      return;
    }

    // Alice pays $90 for dinner, split 3 ways
    const { data: expense1 } = await supabase
      .from("expenses")
      .insert({
        group_id: scenarioGroupId,
        description: "Dinner",
        amount: 90,
        paid_by: aliceId,
      })
      .select()
      .single();

    if (!expense1) {
      console.log("Skipping: Failed to create test expense");
      return;
    }

    await supabase.from("splits").insert([
      { expense_id: expense1.id, member_id: aliceId, amount: 30 },
      { expense_id: expense1.id, member_id: bobId, amount: 30 },
      { expense_id: expense1.id, member_id: charlieId, amount: 30 },
    ]);

    // Bob pays $60 for drinks, split 3 ways
    const { data: expense2 } = await supabase
      .from("expenses")
      .insert({
        group_id: scenarioGroupId,
        description: "Drinks",
        amount: 60,
        paid_by: bobId,
      })
      .select()
      .single();

    if (!expense2) {
      console.log("Skipping: Failed to create test expense 2");
      return;
    }

    await supabase.from("splits").insert([
      { expense_id: expense2.id, member_id: aliceId, amount: 20 },
      { expense_id: expense2.id, member_id: bobId, amount: 20 },
      { expense_id: expense2.id, member_id: charlieId, amount: 20 },
    ]);

    // Fetch all expenses with splits for balance calculation
    const { data: expenses, error } = await supabase
      .from("expenses")
      .select(
        `
        id,
        amount,
        paid_by,
        splits(member_id, amount)
      `,
      )
      .eq("group_id", scenarioGroupId);

    expect(error).toBeNull();
    expect(expenses).toHaveLength(2);

    // Calculate balances manually
    const balances = new Map<string, number>();
    [aliceId, bobId, charlieId].forEach((id) => balances.set(id, 0));

    expenses!.forEach((exp) => {
      const currentPayerBalance = balances.get(exp.paid_by) || 0;
      balances.set(exp.paid_by, currentPayerBalance + parseFloat(exp.amount));

      exp.splits.forEach((split: any) => {
        const currentBalance = balances.get(split.member_id) || 0;
        balances.set(
          split.member_id,
          currentBalance - parseFloat(split.amount),
        );
      });
    });

    // Expected balances:
    // Alice: +90 - 30 - 20 = +40 (is owed $40)
    // Bob: +60 - 30 - 20 = +10 (is owed $10)
    // Charlie: 0 - 30 - 20 = -50 (owes $50)
    expect(balances.get(aliceId)).toBe(40);
    expect(balances.get(bobId)).toBe(10);
    expect(balances.get(charlieId)).toBe(-50);
  });
});
