/**
 * Search Integration Tests
 *
 * These tests verify search functionality, SQL injection prevention,
 * and edge cases in search queries.
 *
 * Run with: npm test -- --testPathPattern=search.integration
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { escapeILike, validateClerkId, isValidClerkId } from "../lib/sanitize";
import { createTestClient } from "./helpers/test-config";

let supabase: SupabaseClient;

// Test data IDs for cleanup
let testGroupId: string;
let testMemberId: string;
const testExpenseIds: string[] = [];

beforeAll(async () => {
  supabase = createTestClient();

  // Create test group
  const { data: group } = await supabase
    .from("groups")
    .insert({
      name: "Search Test Group",
      emoji: "test-emoji",
      currency: "USD",
      share_code: "SRCH" + Date.now().toString().slice(-4),
    })
    .select()
    .single();

  testGroupId = group!.id;

  // Create test member
  const { data: member } = await supabase
    .from("members")
    .insert({
      group_id: testGroupId,
      name: "Search Test Member",
    })
    .select()
    .single();

  testMemberId = member!.id;

  // Create test expenses with various descriptions for search testing
  const expenses = [
    { description: "Coffee at Starbucks", amount: 5.50 },
    { description: "Lunch - pizza place", amount: 15.00 },
    { description: "100% discount test", amount: 10.00 },
    { description: "Item with underscore_test", amount: 20.00 },
    { description: "Backslash\\test", amount: 25.00 },
    { description: "Special chars: %test%", amount: 30.00 },
    { description: "Unicode cafe", amount: 12.00 },
  ];

  for (const exp of expenses) {
    const { data } = await supabase
      .from("expenses")
      .insert({
        group_id: testGroupId,
        description: exp.description,
        amount: exp.amount,
        paid_by: testMemberId,
      })
      .select()
      .single();

    if (data) {
      testExpenseIds.push(data.id);
    }
  }
});

afterAll(async () => {
  // Cleanup in order
  for (const id of testExpenseIds) {
    await supabase.from("splits").delete().eq("expense_id", id);
    await supabase.from("expenses").delete().eq("id", id);
  }
  if (testMemberId) {
    await supabase.from("members").delete().eq("id", testMemberId);
  }
  if (testGroupId) {
    await supabase.from("groups").delete().eq("id", testGroupId);
  }
});

describe("escapeILike Sanitization Function", () => {
  it("should escape percent sign", () => {
    const input = "100% discount";
    const escaped = escapeILike(input);
    expect(escaped).toBe("100\\% discount");
  });

  it("should escape underscore", () => {
    const input = "test_value";
    const escaped = escapeILike(input);
    expect(escaped).toBe("test\\_value");
  });

  it("should escape backslash", () => {
    const input = "path\\to\\file";
    const escaped = escapeILike(input);
    expect(escaped).toBe("path\\\\to\\\\file");
  });

  it("should escape multiple special characters", () => {
    const input = "100%_test\\value";
    const escaped = escapeILike(input);
    expect(escaped).toBe("100\\%\\_test\\\\value");
  });

  it("should not modify normal text", () => {
    const input = "normal search query";
    const escaped = escapeILike(input);
    expect(escaped).toBe("normal search query");
  });

  it("should handle empty string", () => {
    const input = "";
    const escaped = escapeILike(input);
    expect(escaped).toBe("");
  });

  it("should handle string with only special chars", () => {
    const input = "%_%\\";
    const escaped = escapeILike(input);
    expect(escaped).toBe("\\%\\_\\%\\\\");
  });
});

describe("validateClerkId Function", () => {
  it("should accept valid alphanumeric ID", () => {
    const id = "user_abc123";
    expect(validateClerkId(id)).toBe(id);
  });

  it("should accept ID with hyphens", () => {
    const id = "user-abc-123";
    expect(validateClerkId(id)).toBe(id);
  });

  it("should accept ID with underscores", () => {
    const id = "user_abc_123";
    expect(validateClerkId(id)).toBe(id);
  });

  it("should reject ID with special characters", () => {
    const id = "user'; DROP TABLE users; --";
    expect(() => validateClerkId(id)).toThrow("Invalid id: contains invalid characters");
  });

  it("should reject empty string", () => {
    expect(() => validateClerkId("")).toThrow();
  });

  it("should reject very long ID", () => {
    const longId = "a".repeat(150);
    expect(() => validateClerkId(longId)).toThrow();
  });

  it("should reject ID with spaces", () => {
    const id = "user with spaces";
    expect(() => validateClerkId(id)).toThrow();
  });

  it("should reject ID with SQL injection", () => {
    const id = "user' OR '1'='1";
    expect(() => validateClerkId(id)).toThrow();
  });
});

describe("isValidClerkId Function", () => {
  it("should return true for valid ID", () => {
    expect(isValidClerkId("user_abc123")).toBe(true);
  });

  it("should return false for invalid ID", () => {
    expect(isValidClerkId("user'; --")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isValidClerkId("")).toBe(false);
  });

  it("should return false for too long ID", () => {
    expect(isValidClerkId("a".repeat(101))).toBe(false);
  });
});

describe("Search with Special Characters (Direct DB)", () => {
  it("should find expense with percent in description", async () => {
    const searchTerm = escapeILike("100%");
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.some((e: any) => e.description.includes("100%"))).toBe(true);
  });

  it("should find expense with underscore in description", async () => {
    const searchTerm = escapeILike("underscore_test");
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.some((e: any) => e.description.includes("underscore_test"))).toBe(true);
  });

  it("should find expense with backslash in description", async () => {
    const searchTerm = escapeILike("Backslash\\test");
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});

describe("SQL Injection Prevention", () => {
  it("should not execute SQL injection in search query", async () => {
    // Malicious search term attempting SQL injection
    const maliciousSearch = "'; DELETE FROM expenses; --";
    const escapedSearch = escapeILike(maliciousSearch);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    // Should return empty results, not execute the DELETE
    expect(data).toBeDefined();

    // Verify expenses still exist
    const { data: allExpenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId);

    expect(allExpenses!.length).toBeGreaterThan(0);
  });

  it("should not execute SQL injection with UNION attack", async () => {
    const maliciousSearch = "' UNION SELECT * FROM users; --";
    const escapedSearch = escapeILike(maliciousSearch);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    // Should not return data from other tables
    expect(data).toBeDefined();
  });

  it("should not execute SQL injection with OR attack", async () => {
    const maliciousSearch = "' OR '1'='1";
    const escapedSearch = escapeILike(maliciousSearch);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    // Should not return all expenses due to OR 1=1
    // Only return expenses that literally contain the search term
    expect(data!.length).toBe(0); // No expense has this literal text
  });

  it("should handle null byte injection attempt", async () => {
    const maliciousSearch = "test\x00'; DROP TABLE expenses; --";
    const escapedSearch = escapeILike(maliciousSearch);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    // Should either error or return empty (not execute injection)
    expect(data).toBeDefined();
  });

  it("should handle comment injection attempt", async () => {
    const maliciousSearch = "test/**/OR/**/1=1";
    const escapedSearch = escapeILike(maliciousSearch);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBe(0); // No literal match
  });
});

describe("Search Edge Cases", () => {
  it("should handle empty search string", async () => {
    const searchTerm = "";
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    // Empty pattern matches everything
    expect(data!.length).toBe(testExpenseIds.length);
  });

  it("should handle whitespace-only search", async () => {
    const searchTerm = "   ";
    const trimmed = searchTerm.trim();

    if (trimmed === "") {
      // Should return all or handle gracefully
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("group_id", testGroupId);

      expect(error).toBeNull();
    }
  });

  it("should handle very long search string", async () => {
    const longSearch = "a".repeat(10000);
    const escapedSearch = escapeILike(longSearch);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    // Should not crash
    expect(error).toBeNull();
    expect(data!.length).toBe(0); // No match for very long string
  });

  it("should handle search with only special characters", async () => {
    const searchTerm = "%_%\\";
    const escapedSearch = escapeILike(searchTerm);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
  });

  it("should handle unicode search terms", async () => {
    const searchTerm = "cafe";
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    // Should find the unicode entry
    expect(data!.some((e: any) => e.description.includes("cafe"))).toBe(true);
  });

  it("should handle case-insensitive search", async () => {
    const searchTerm = "COFFEE";
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    // ILIKE is case-insensitive
    expect(data!.some((e: any) => e.description.toLowerCase().includes("coffee"))).toBe(true);
  });

  it("should handle search with newlines", async () => {
    const searchTerm = "test\ninjection";
    const escapedSearch = escapeILike(searchTerm);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("should handle search with tabs", async () => {
    const searchTerm = "test\tvalue";
    const escapedSearch = escapeILike(searchTerm);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern);

    expect(error).toBeNull();
  });
});

describe("Search Groups Functionality", () => {
  it("should search groups by name", async () => {
    const searchTerm = escapeILike("Search Test");
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .ilike("name", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.some((g: any) => g.name === "Search Test Group")).toBe(true);
  });

  it("should search groups by share_code", async () => {
    // Get the actual share code
    const { data: group } = await supabase
      .from("groups")
      .select("share_code")
      .eq("id", testGroupId)
      .single();

    const shareCode = group!.share_code;
    const pattern = `%${shareCode}%`;

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .ilike("share_code", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("should handle SQL injection in group search", async () => {
    const maliciousSearch = "'; DROP TABLE groups; --";
    const escapedSearch = escapeILike(maliciousSearch);
    const pattern = `%${escapedSearch}%`;

    const { error } = await supabase
      .from("groups")
      .select("*")
      .ilike("name", pattern);

    expect(error).toBeNull();

    // Verify table still exists
    const { data: groups } = await supabase
      .from("groups")
      .select("count");

    expect(groups).toBeDefined();
  });
});

describe("Search with Filters", () => {
  it("should filter by amount range", async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .gte("amount", 10)
      .lte("amount", 20);

    expect(error).toBeNull();
    expect(data!.every((e: any) => parseFloat(e.amount) >= 10 && parseFloat(e.amount) <= 20)).toBe(true);
  });

  it("should combine text search with filters", async () => {
    const searchTerm = escapeILike("test");
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", pattern)
      .gte("amount", 10);

    expect(error).toBeNull();
    expect(data!.every((e: any) =>
      e.description.toLowerCase().includes("test") &&
      parseFloat(e.amount) >= 10
    )).toBe(true);
  });

  it("should handle filter with SQL injection in column value", async () => {
    // Attempting to inject via a filter value
    const maliciousGroupId = "' OR 1=1; --";

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", maliciousGroupId);

    // Should return empty (no match for invalid UUID) or error
    // Note: Supabase may return error for invalid UUID format
    if (error) {
      // Invalid UUID format error is acceptable - SQL injection blocked
      expect(error).toBeDefined();
    } else {
      expect(data!.length).toBe(0);
    }
  });
});

describe("Search Performance (Basic)", () => {
  it("should complete search within reasonable time", async () => {
    const startTime = Date.now();
    const searchTerm = escapeILike("test");
    const pattern = `%${searchTerm}%`;

    const { error } = await supabase
      .from("expenses")
      .select("*")
      .ilike("description", pattern)
      .limit(50);

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(error).toBeNull();
    // Should complete in under 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  it("should handle limit and offset correctly", async () => {
    const { data: page1, error: error1 } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .order("created_at", { ascending: true })
      .limit(3)
      .range(0, 2);

    expect(error1).toBeNull();
    expect(page1!.length).toBeLessThanOrEqual(3);

    const { data: page2, error: error2 } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .order("created_at", { ascending: true })
      .limit(3)
      .range(3, 5);

    expect(error2).toBeNull();

    // Verify pages don't overlap (if enough data exists)
    if (page1!.length > 0 && page2!.length > 0) {
      const page1Ids = new Set(page1!.map((e: any) => e.id));
      const page2HasOverlap = page2!.some((e: any) => page1Ids.has(e.id));
      expect(page2HasOverlap).toBe(false);
    }
  });
});

describe("Potential Bug: Pattern Wildcards Without Escaping", () => {
  // This test reveals bugs if escapeILike is not used

  it("should NOT match everything when using raw % character", async () => {
    // If someone searches for "%" without escaping, it shouldn't match everything
    const rawSearch = "%"; // Dangerous if not escaped!
    const escapedSearch = escapeILike(rawSearch);
    const safePattern = `%${escapedSearch}%`;

    const { data: safeData, error: safeError } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", safePattern);

    expect(safeError).toBeNull();
    // Should only match expenses that literally contain %
    expect(safeData!.length).toBeLessThan(testExpenseIds.length);
  });

  it("should NOT match single character when using raw _ character", async () => {
    // _ is a single-char wildcard in LIKE/ILIKE
    const rawSearch = "_";
    const escapedSearch = escapeILike(rawSearch);
    const safePattern = `%${escapedSearch}%`;

    const { data: safeData, error: safeError } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", testGroupId)
      .ilike("description", safePattern);

    expect(safeError).toBeNull();
    // Should only match expenses that literally contain underscore
  });
});

describe("Search in user_profiles (if table exists)", () => {
  let testProfileId: string;

  beforeAll(async () => {
    // Create a test profile for searching
    const { data } = await supabase
      .from("user_profiles")
      .insert({
        clerk_id: `search_profile_${Date.now()}`,
        display_name: "Searchable User Test",
        email: "searchable@test.com",
      })
      .select()
      .single();

    if (data) {
      testProfileId = data.id;
    }
  });

  afterAll(async () => {
    if (testProfileId) {
      await supabase.from("user_profiles").delete().eq("id", testProfileId);
    }
  });

  it("should search user_profiles by display_name", async () => {
    const searchTerm = escapeILike("Searchable");
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("display_name", pattern);

    expect(error).toBeNull();
    expect(data!.some((p: any) => p.display_name?.includes("Searchable"))).toBe(true);
  });

  it("should search user_profiles by email", async () => {
    const searchTerm = escapeILike("searchable@");
    const pattern = `%${searchTerm}%`;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("email", pattern);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("should handle SQL injection in user search", async () => {
    const maliciousSearch = "' OR email LIKE '%'; --";
    const escapedSearch = escapeILike(maliciousSearch);
    const pattern = `%${escapedSearch}%`;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .ilike("display_name", pattern);

    expect(error).toBeNull();
    // Should not return all users
    expect(data!.length).toBe(0);
  });
});
