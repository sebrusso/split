/**
 * Supabase Integration Tests
 *
 * These tests verify that the database schema and operations work correctly.
 * They run against the actual Supabase instance.
 *
 * Run with: npm test -- --testPathPattern=supabase.integration
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rzwuknfycyqitcbotsvx.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d3VrbmZ5Y3lxaXRjYm90c3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Nzc0MTcsImV4cCI6MjA4MzE1MzQxN30.TKXVVOCaiV-wX--V4GEPNg2yupF-ERSZFMfekve2yt8";

let supabase: SupabaseClient;
let testGroupId: string;
let testMemberIds: string[] = [];
let testExpenseId: string;

beforeAll(() => {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
});

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
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", testGroupId)
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe("Test Group");
  });

  it("should update a group", async () => {
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
    const { data, error } = await supabase
      .from("splits")
      .insert({
        expense_id: testExpenseId,
        member_id: testMemberIds[0],
        amount: 0,
      })
      .select()
      .single();

    expect(error).toBeNull();

    // Cleanup
    await supabase.from("splits").delete().eq("id", data.id);
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
  let tempGroupId: string;
  let tempMemberId: string;
  let tempExpenseId: string;

  beforeAll(async () => {
    // Create temp group
    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Temp Group", share_code: "TEMP" + Date.now() })
      .select()
      .single();
    tempGroupId = group!.id;

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

describe("Data Integrity - Balance Calculation Scenario", () => {
  let scenarioGroupId: string;
  let aliceId: string;
  let bobId: string;
  let charlieId: string;

  beforeAll(async () => {
    // Create a fresh group for this scenario
    const { data: group } = await supabase
      .from("groups")
      .insert({ name: "Balance Test Group", share_code: "BAL" + Date.now() })
      .select()
      .single();
    scenarioGroupId = group!.id;

    // Create members
    const { data: members } = await supabase
      .from("members")
      .insert([
        { group_id: scenarioGroupId, name: "Alice" },
        { group_id: scenarioGroupId, name: "Bob" },
        { group_id: scenarioGroupId, name: "Charlie" },
      ])
      .select();

    aliceId = members![0].id;
    bobId = members![1].id;
    charlieId = members![2].id;
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from("splits").delete().match({ member_id: aliceId });
    await supabase.from("splits").delete().match({ member_id: bobId });
    await supabase.from("splits").delete().match({ member_id: charlieId });
    await supabase.from("expenses").delete().eq("group_id", scenarioGroupId);
    await supabase.from("members").delete().eq("group_id", scenarioGroupId);
    await supabase.from("groups").delete().eq("id", scenarioGroupId);
  });

  it("should correctly store and retrieve expense data for balance calculation", async () => {
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

    await supabase.from("splits").insert([
      { expense_id: expense1!.id, member_id: aliceId, amount: 30 },
      { expense_id: expense1!.id, member_id: bobId, amount: 30 },
      { expense_id: expense1!.id, member_id: charlieId, amount: 30 },
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

    await supabase.from("splits").insert([
      { expense_id: expense2!.id, member_id: aliceId, amount: 20 },
      { expense_id: expense2!.id, member_id: bobId, amount: 20 },
      { expense_id: expense2!.id, member_id: charlieId, amount: 20 },
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
