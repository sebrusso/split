/**
 * Activity Feed Utilities Tests
 *
 * Comprehensive tests for activity-related functions in lib/activity.ts
 * Focuses on pure functions that don't require Supabase mocking.
 */

import {
  getActivityDescription,
  getActivityIcon,
} from "../lib/activity";
import { ActivityItem, ActivityAction, UserProfile } from "../lib/types";

// Helper to create mock activity items
function createMockActivity(
  overrides: Partial<ActivityItem> = {}
): ActivityItem {
  return {
    id: "activity-1",
    groupId: "group-1",
    actorId: "user-1",
    action: "expense_added",
    entityType: "expense",
    entityId: "expense-1",
    metadata: {},
    createdAt: "2024-01-15T12:00:00Z",
    ...overrides,
  };
}

// Helper to create mock user profile
function createMockProfile(
  overrides: Partial<UserProfile> = {}
): UserProfile {
  return {
    id: "profile-1",
    clerkId: "user-1",
    email: "test@example.com",
    displayName: "Test User",
    avatarUrl: null,
    defaultCurrency: "USD",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getActivityIcon", () => {
  describe("returns correct icon for each action type", () => {
    it("should return 💰 for expense_added", () => {
      expect(getActivityIcon("expense_added")).toBe("💰");
    });

    it("should return ✏️ for expense_edited", () => {
      expect(getActivityIcon("expense_edited")).toBe("✏️");
    });

    it("should return 🗑️ for expense_deleted", () => {
      expect(getActivityIcon("expense_deleted")).toBe("🗑️");
    });

    it("should return ✅ for settlement_recorded", () => {
      expect(getActivityIcon("settlement_recorded")).toBe("✅");
    });

    it("should return 👋 for member_joined", () => {
      expect(getActivityIcon("member_joined")).toBe("👋");
    });

    it("should return 👋 for member_left", () => {
      expect(getActivityIcon("member_left")).toBe("👋");
    });

    it("should return 🎉 for group_created", () => {
      expect(getActivityIcon("group_created")).toBe("🎉");
    });
  });

  describe("fallback behavior", () => {
    it("should return 📝 for unknown action type", () => {
      // @ts-expect-error - testing runtime behavior with invalid input
      expect(getActivityIcon("unknown_action")).toBe("📝");
    });

    it("should return 📝 for empty string", () => {
      // @ts-expect-error - testing runtime behavior with invalid input
      expect(getActivityIcon("")).toBe("📝");
    });
  });

  describe("consistency", () => {
    it("should return consistent results for same input", () => {
      const action: ActivityAction = "expense_added";
      expect(getActivityIcon(action)).toBe(getActivityIcon(action));
    });

    it("should return single emoji character for all actions", () => {
      const actions: ActivityAction[] = [
        "expense_added",
        "expense_edited",
        "expense_deleted",
        "settlement_recorded",
        "member_joined",
        "member_left",
        "group_created",
      ];

      actions.forEach((action) => {
        const icon = getActivityIcon(action);
        // Emoji length can be > 1 due to Unicode, but should be a single visual character
        expect(icon.length).toBeGreaterThan(0);
        expect(icon.length).toBeLessThanOrEqual(4); // Some emojis are up to 4 code points
      });
    });
  });
});

describe("getActivityDescription", () => {
  describe("expense_added action", () => {
    it("should format with actor name and expense details", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Dinner", amount: 50 },
        actor: createMockProfile({ displayName: "Alice" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Alice");
      expect(description).toContain("added an expense");
      expect(description).toContain("Dinner");
      expect(description).toContain("$50");
    });

    it("should handle missing amount", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Groceries" },
        actor: createMockProfile({ displayName: "Bob" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Bob");
      expect(description).toContain("Groceries");
      expect(description).not.toContain("$");
    });

    it("should handle missing description", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { amount: 25 },
        actor: createMockProfile({ displayName: "Charlie" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Charlie");
      expect(description).toContain("added an expense");
    });

    it("should handle empty metadata", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: {},
        actor: createMockProfile({ displayName: "Diana" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Diana");
      expect(description).toContain("added an expense");
    });
  });

  describe("expense_edited action", () => {
    it("should format with actor name and expense description", () => {
      const activity = createMockActivity({
        action: "expense_edited",
        metadata: { description: "Lunch" },
        actor: createMockProfile({ displayName: "Eve" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Eve");
      expect(description).toContain("edited an expense");
      expect(description).toContain("Lunch");
    });

    it("should handle missing description", () => {
      const activity = createMockActivity({
        action: "expense_edited",
        metadata: {},
        actor: createMockProfile({ displayName: "Frank" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Frank");
      expect(description).toContain("edited");
    });
  });

  describe("expense_deleted action", () => {
    it("should format with actor name and expense description", () => {
      const activity = createMockActivity({
        action: "expense_deleted",
        metadata: { description: "Coffee" },
        actor: createMockProfile({ displayName: "Grace" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Grace");
      expect(description).toContain("deleted an expense");
      expect(description).toContain("Coffee");
    });
  });

  describe("settlement_recorded action", () => {
    it("should format with actor name and amount", () => {
      const activity = createMockActivity({
        action: "settlement_recorded",
        metadata: { amount: 100 },
        actor: createMockProfile({ displayName: "Henry" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Henry");
      expect(description).toContain("recorded a payment");
      expect(description).toContain("$100");
    });

    it("should handle missing amount", () => {
      const activity = createMockActivity({
        action: "settlement_recorded",
        metadata: {},
        actor: createMockProfile({ displayName: "Ivy" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Ivy");
      expect(description).toContain("recorded a payment");
      expect(description).not.toContain("$");
    });
  });

  describe("member_joined action", () => {
    it("should use memberName from metadata when available", () => {
      const activity = createMockActivity({
        action: "member_joined",
        metadata: { memberName: "New Member" },
        actor: createMockProfile({ displayName: "Admin" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("New Member");
      expect(description).toContain("joined the group");
    });

    it("should fall back to actor name when memberName not in metadata", () => {
      const activity = createMockActivity({
        action: "member_joined",
        metadata: {},
        actor: createMockProfile({ displayName: "Jack" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Jack");
      expect(description).toContain("joined the group");
    });
  });

  describe("member_left action", () => {
    it("should use memberName from metadata when available", () => {
      const activity = createMockActivity({
        action: "member_left",
        metadata: { memberName: "Leaving Member" },
        actor: createMockProfile({ displayName: "Admin" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Leaving Member");
      expect(description).toContain("left the group");
    });

    it("should fall back to actor name when memberName not in metadata", () => {
      const activity = createMockActivity({
        action: "member_left",
        metadata: {},
        actor: createMockProfile({ displayName: "Kate" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Kate");
      expect(description).toContain("left the group");
    });
  });

  describe("group_created action", () => {
    it("should format with actor name", () => {
      const activity = createMockActivity({
        action: "group_created",
        metadata: {},
        actor: createMockProfile({ displayName: "Leo" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Leo");
      expect(description).toContain("created this group");
    });
  });

  describe("unknown action", () => {
    it("should provide fallback message for unknown action", () => {
      const activity = createMockActivity({
        // @ts-expect-error - testing runtime behavior with invalid input
        action: "unknown_action",
        metadata: {},
        actor: createMockProfile({ displayName: "Mike" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Mike");
      expect(description).toContain("performed an action");
    });
  });

  describe("missing actor", () => {
    it("should use 'Someone' when actor is undefined", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Test" },
        actor: undefined,
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Someone");
      expect(description).toContain("added an expense");
    });

    it("should use 'Someone' when actor displayName is undefined", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Test" },
        actor: {
          ...createMockProfile(),
          displayName: undefined as unknown as string,
        },
      });

      const description = getActivityDescription(activity);

      // The function uses actor?.displayName which would be undefined
      expect(description).toContain("Someone");
    });
  });

  describe("null and undefined metadata", () => {
    it("should handle null metadata gracefully", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: null as unknown as Record<string, unknown>,
        actor: createMockProfile({ displayName: "Nancy" }),
      });

      // Should not throw
      expect(() => getActivityDescription(activity)).not.toThrow();
    });

    it("should handle undefined metadata gracefully", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: undefined as unknown as Record<string, unknown>,
        actor: createMockProfile({ displayName: "Oscar" }),
      });

      expect(() => getActivityDescription(activity)).not.toThrow();
    });
  });

  describe("special characters in metadata", () => {
    it("should handle description with special characters", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Café & Restaurant 'Special'" },
        actor: createMockProfile({ displayName: "Paul" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("Café & Restaurant 'Special'");
    });

    it("should handle description with unicode characters", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "🍕 Pizza Night 🎉" },
        actor: createMockProfile({ displayName: "Quinn" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("🍕 Pizza Night 🎉");
    });

    it("should handle actor name with special characters", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Test" },
        actor: createMockProfile({ displayName: "José García" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("José García");
    });
  });

  describe("numeric edge cases", () => {
    it("should handle zero amount", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Free item", amount: 0 },
        actor: createMockProfile({ displayName: "Rachel" }),
      });

      const description = getActivityDescription(activity);

      // Zero amount is falsy, so it's not included in the description
      // The function only adds amount when metadata.amount is truthy
      expect(description).toContain("Rachel");
      expect(description).toContain("Free item");
      expect(description).not.toContain("$0"); // 0 is falsy, not included
    });

    it("should handle decimal amounts", () => {
      const activity = createMockActivity({
        action: "settlement_recorded",
        metadata: { amount: 25.99 },
        actor: createMockProfile({ displayName: "Steve" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("$25.99");
    });

    it("should handle large amounts", () => {
      const activity = createMockActivity({
        action: "expense_added",
        metadata: { description: "Big purchase", amount: 10000 },
        actor: createMockProfile({ displayName: "Tina" }),
      });

      const description = getActivityDescription(activity);

      expect(description).toContain("$10000");
    });
  });
});

describe("Action Type Coverage", () => {
  const allActions: ActivityAction[] = [
    "expense_added",
    "expense_edited",
    "expense_deleted",
    "settlement_recorded",
    "member_joined",
    "member_left",
    "group_created",
  ];

  it("should handle all defined action types in getActivityIcon", () => {
    allActions.forEach((action) => {
      const icon = getActivityIcon(action);
      expect(typeof icon).toBe("string");
      expect(icon.length).toBeGreaterThan(0);
    });
  });

  it("should handle all defined action types in getActivityDescription", () => {
    allActions.forEach((action) => {
      const activity = createMockActivity({
        action,
        metadata: { description: "Test", amount: 50, memberName: "Test User" },
        actor: createMockProfile({ displayName: "Actor" }),
      });

      const description = getActivityDescription(activity);
      expect(typeof description).toBe("string");
      expect(description.length).toBeGreaterThan(0);
    });
  });
});

describe("Integration Scenarios", () => {
  it("should work together for activity feed display", () => {
    const activity = createMockActivity({
      action: "expense_added",
      metadata: { description: "Team Dinner", amount: 120 },
      actor: createMockProfile({ displayName: "Team Lead" }),
    });

    const icon = getActivityIcon(activity.action);
    const description = getActivityDescription(activity);

    expect(icon).toBe("💰");
    expect(description).toContain("Team Lead");
    expect(description).toContain("Team Dinner");
    expect(description).toContain("$120");
  });

  it("should handle complete activity lifecycle", () => {
    // Activity 1: Group created
    const createActivity = createMockActivity({
      action: "group_created",
      metadata: { groupName: "Trip to Paris" },
      actor: createMockProfile({ displayName: "Alice" }),
    });
    expect(getActivityIcon(createActivity.action)).toBe("🎉");
    expect(getActivityDescription(createActivity)).toContain("created this group");

    // Activity 2: Member joined
    const joinActivity = createMockActivity({
      action: "member_joined",
      metadata: { memberName: "Bob" },
      actor: createMockProfile({ displayName: "Bob" }),
    });
    expect(getActivityIcon(joinActivity.action)).toBe("👋");
    expect(getActivityDescription(joinActivity)).toContain("joined");

    // Activity 3: Expense added
    const expenseActivity = createMockActivity({
      action: "expense_added",
      metadata: { description: "Hotel", amount: 500 },
      actor: createMockProfile({ displayName: "Alice" }),
    });
    expect(getActivityIcon(expenseActivity.action)).toBe("💰");
    expect(getActivityDescription(expenseActivity)).toContain("Hotel");

    // Activity 4: Settlement recorded
    const settlementActivity = createMockActivity({
      action: "settlement_recorded",
      metadata: { amount: 250 },
      actor: createMockProfile({ displayName: "Bob" }),
    });
    expect(getActivityIcon(settlementActivity.action)).toBe("✅");
    expect(getActivityDescription(settlementActivity)).toContain("$250");
  });
});
