/**
 * Notification Utilities Tests
 *
 * Comprehensive tests for notification-related functions in lib/notifications.ts
 * Focuses on pure notification payload creation functions.
 */

import {
  NotificationType,
  NotificationPayload,
  createFriendRequestNotification,
  createFriendAcceptedNotification,
  createExpenseNotification,
  createSettlementNotification,
  createGroupInviteNotification,
} from "../lib/notifications";

describe("NotificationType", () => {
  it("should support all expected notification types", () => {
    const types: NotificationType[] = [
      "friend_request",
      "friend_accepted",
      "expense_added",
      "settlement_recorded",
      "group_invite",
    ];

    types.forEach((type) => {
      expect(typeof type).toBe("string");
    });
  });
});

describe("NotificationPayload Interface", () => {
  it("should have correct structure", () => {
    const payload: NotificationPayload = {
      type: "friend_request",
      title: "Test Title",
      body: "Test Body",
      data: { key: "value" },
    };

    expect(payload).toHaveProperty("type");
    expect(payload).toHaveProperty("title");
    expect(payload).toHaveProperty("body");
    expect(payload).toHaveProperty("data");
  });

  it("should allow data to be optional", () => {
    const payload: NotificationPayload = {
      type: "friend_request",
      title: "Test Title",
      body: "Test Body",
    };

    expect(payload.data).toBeUndefined();
  });
});

describe("createFriendRequestNotification", () => {
  it("should create notification with correct structure", () => {
    const notification = createFriendRequestNotification("Alice");

    expect(notification).toHaveProperty("type");
    expect(notification).toHaveProperty("title");
    expect(notification).toHaveProperty("body");
    expect(notification).toHaveProperty("data");
  });

  it("should set type to friend_request", () => {
    const notification = createFriendRequestNotification("Bob");

    expect(notification.type).toBe("friend_request");
  });

  it("should set correct title", () => {
    const notification = createFriendRequestNotification("Charlie");

    expect(notification.title).toBe("New Friend Request");
  });

  it("should include sender name in body", () => {
    const notification = createFriendRequestNotification("Diana");

    expect(notification.body).toContain("Diana");
    expect(notification.body).toContain("wants to be your friend");
  });

  it("should handle empty name", () => {
    const notification = createFriendRequestNotification("");

    expect(notification.body).toContain("wants to be your friend");
  });

  it("should handle name with special characters", () => {
    const notification = createFriendRequestNotification("José García");

    expect(notification.body).toContain("José García");
  });

  it("should handle name with emojis", () => {
    const notification = createFriendRequestNotification("Alice 🎉");

    expect(notification.body).toContain("Alice 🎉");
  });

  it("should have empty data object", () => {
    const notification = createFriendRequestNotification("Eve");

    expect(notification.data).toEqual({});
  });

  it("should return consistent results for same input", () => {
    const first = createFriendRequestNotification("Frank");
    const second = createFriendRequestNotification("Frank");

    expect(first).toEqual(second);
  });
});

describe("createFriendAcceptedNotification", () => {
  it("should create notification with correct structure", () => {
    const notification = createFriendAcceptedNotification("Alice");

    expect(notification).toHaveProperty("type");
    expect(notification).toHaveProperty("title");
    expect(notification).toHaveProperty("body");
    expect(notification).toHaveProperty("data");
  });

  it("should set type to friend_accepted", () => {
    const notification = createFriendAcceptedNotification("Bob");

    expect(notification.type).toBe("friend_accepted");
  });

  it("should set correct title", () => {
    const notification = createFriendAcceptedNotification("Charlie");

    expect(notification.title).toBe("Friend Request Accepted");
  });

  it("should include friend name in body", () => {
    const notification = createFriendAcceptedNotification("Diana");

    expect(notification.body).toContain("Diana");
    expect(notification.body).toContain("accepted your friend request");
  });

  it("should handle empty name", () => {
    const notification = createFriendAcceptedNotification("");

    expect(notification.body).toContain("accepted your friend request");
  });

  it("should handle name with special characters", () => {
    const notification = createFriendAcceptedNotification("O'Connor");

    expect(notification.body).toContain("O'Connor");
  });

  it("should have empty data object", () => {
    const notification = createFriendAcceptedNotification("Eve");

    expect(notification.data).toEqual({});
  });
});

describe("createExpenseNotification", () => {
  it("should create notification with correct structure", () => {
    const notification = createExpenseNotification("Roommates", "Groceries", 50);

    expect(notification).toHaveProperty("type");
    expect(notification).toHaveProperty("title");
    expect(notification).toHaveProperty("body");
    expect(notification).toHaveProperty("data");
  });

  it("should set type to expense_added", () => {
    const notification = createExpenseNotification("Trip", "Hotel", 200);

    expect(notification.type).toBe("expense_added");
  });

  it("should include group name in title", () => {
    const notification = createExpenseNotification("Paris Trip", "Dinner", 100);

    expect(notification.title).toContain("Paris Trip");
    expect(notification.title).toContain("New expense");
  });

  it("should include description and amount in body", () => {
    const notification = createExpenseNotification("Roommates", "Utilities", 150);

    expect(notification.body).toContain("Utilities");
    expect(notification.body).toContain("$150.00");
  });

  it("should format amount with two decimal places", () => {
    const notification = createExpenseNotification("Group", "Item", 25);

    expect(notification.body).toContain("$25.00");
  });

  it("should handle decimal amounts", () => {
    const notification = createExpenseNotification("Group", "Coffee", 4.99);

    expect(notification.body).toContain("$4.99");
  });

  it("should handle zero amount", () => {
    const notification = createExpenseNotification("Group", "Free item", 0);

    expect(notification.body).toContain("$0.00");
  });

  it("should handle large amounts", () => {
    const notification = createExpenseNotification("Group", "Big expense", 10000);

    expect(notification.body).toContain("$10000.00");
  });

  it("should include all data in data object", () => {
    const notification = createExpenseNotification("Test Group", "Test Item", 75.50);

    expect(notification.data).toEqual({
      groupName: "Test Group",
      description: "Test Item",
      amount: 75.50,
    });
  });

  it("should handle empty group name", () => {
    const notification = createExpenseNotification("", "Item", 50);

    expect(notification.title).toContain("New expense");
  });

  it("should handle empty description", () => {
    const notification = createExpenseNotification("Group", "", 50);

    expect(notification.body).toContain("$50.00");
  });

  it("should handle description with special characters", () => {
    const notification = createExpenseNotification("Group", "Café & Restaurant", 75);

    expect(notification.body).toContain("Café & Restaurant");
  });

  it("should handle group name with emojis", () => {
    const notification = createExpenseNotification("🏠 Home", "Rent", 1000);

    expect(notification.title).toContain("🏠 Home");
  });
});

describe("createSettlementNotification", () => {
  it("should create notification with correct structure", () => {
    const notification = createSettlementNotification("Roommates", "Alice", 50);

    expect(notification).toHaveProperty("type");
    expect(notification).toHaveProperty("title");
    expect(notification).toHaveProperty("body");
    expect(notification).toHaveProperty("data");
  });

  it("should set type to settlement_recorded", () => {
    const notification = createSettlementNotification("Trip", "Bob", 100);

    expect(notification.type).toBe("settlement_recorded");
  });

  it("should include group name in title", () => {
    const notification = createSettlementNotification("Paris Trip", "Charlie", 200);

    expect(notification.title).toContain("Paris Trip");
    expect(notification.title).toContain("Payment");
  });

  it("should include payer name and amount in body", () => {
    const notification = createSettlementNotification("Group", "Diana", 150);

    expect(notification.body).toContain("Diana");
    expect(notification.body).toContain("paid");
    expect(notification.body).toContain("$150.00");
  });

  it("should format amount with two decimal places", () => {
    const notification = createSettlementNotification("Group", "Eve", 25);

    expect(notification.body).toContain("$25.00");
  });

  it("should handle decimal amounts", () => {
    const notification = createSettlementNotification("Group", "Frank", 33.33);

    expect(notification.body).toContain("$33.33");
  });

  it("should include all data in data object", () => {
    const notification = createSettlementNotification("Test Group", "Test User", 99.99);

    expect(notification.data).toEqual({
      groupName: "Test Group",
      fromName: "Test User",
      amount: 99.99,
    });
  });

  it("should handle empty group name", () => {
    const notification = createSettlementNotification("", "User", 50);

    expect(notification.title).toContain("Payment");
  });

  it("should handle empty payer name", () => {
    const notification = createSettlementNotification("Group", "", 50);

    expect(notification.body).toContain("paid");
    expect(notification.body).toContain("$50.00");
  });

  it("should handle payer name with special characters", () => {
    const notification = createSettlementNotification("Group", "José García", 100);

    expect(notification.body).toContain("José García");
  });
});

describe("createGroupInviteNotification", () => {
  it("should create notification with correct structure", () => {
    const notification = createGroupInviteNotification("Alice", "Trip Group");

    expect(notification).toHaveProperty("type");
    expect(notification).toHaveProperty("title");
    expect(notification).toHaveProperty("body");
    expect(notification).toHaveProperty("data");
  });

  it("should set type to group_invite", () => {
    const notification = createGroupInviteNotification("Bob", "Roommates");

    expect(notification.type).toBe("group_invite");
  });

  it("should set correct title", () => {
    const notification = createGroupInviteNotification("Charlie", "Trip");

    expect(notification.title).toBe("Group Invite");
  });

  it("should include inviter and group names in body", () => {
    const notification = createGroupInviteNotification("Diana", "Paris Trip");

    expect(notification.body).toContain("Diana");
    expect(notification.body).toContain("invited you to join");
    expect(notification.body).toContain("Paris Trip");
  });

  it("should include all data in data object", () => {
    const notification = createGroupInviteNotification("Eve", "Test Group");

    expect(notification.data).toEqual({
      inviterName: "Eve",
      groupName: "Test Group",
    });
  });

  it("should handle empty inviter name", () => {
    const notification = createGroupInviteNotification("", "Group");

    expect(notification.body).toContain("invited you to join");
    expect(notification.body).toContain("Group");
  });

  it("should handle empty group name", () => {
    const notification = createGroupInviteNotification("User", "");

    expect(notification.body).toContain("User");
    expect(notification.body).toContain("invited you to join");
  });

  it("should handle names with special characters", () => {
    const notification = createGroupInviteNotification("O'Brien", "Café & Friends");

    expect(notification.body).toContain("O'Brien");
    expect(notification.body).toContain("Café & Friends");
  });

  it("should handle names with emojis", () => {
    const notification = createGroupInviteNotification("Alice 👋", "🏠 Home");

    expect(notification.body).toContain("Alice 👋");
    expect(notification.body).toContain("🏠 Home");
  });
});

describe("Cross-Function Consistency", () => {
  it("all notification creators should return valid NotificationPayload", () => {
    const notifications: NotificationPayload[] = [
      createFriendRequestNotification("Test"),
      createFriendAcceptedNotification("Test"),
      createExpenseNotification("Group", "Expense", 50),
      createSettlementNotification("Group", "User", 50),
      createGroupInviteNotification("User", "Group"),
    ];

    notifications.forEach((notification) => {
      expect(notification).toHaveProperty("type");
      expect(notification).toHaveProperty("title");
      expect(notification).toHaveProperty("body");
      expect(typeof notification.type).toBe("string");
      expect(typeof notification.title).toBe("string");
      expect(typeof notification.body).toBe("string");
    });
  });

  it("all notification types should be distinct", () => {
    const types = [
      createFriendRequestNotification("Test").type,
      createFriendAcceptedNotification("Test").type,
      createExpenseNotification("Group", "Expense", 50).type,
      createSettlementNotification("Group", "User", 50).type,
      createGroupInviteNotification("User", "Group").type,
    ];

    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });

  it("all notifications should have non-empty title and body", () => {
    const notifications: NotificationPayload[] = [
      createFriendRequestNotification("Test"),
      createFriendAcceptedNotification("Test"),
      createExpenseNotification("Group", "Expense", 50),
      createSettlementNotification("Group", "User", 50),
      createGroupInviteNotification("User", "Group"),
    ];

    notifications.forEach((notification) => {
      expect(notification.title.length).toBeGreaterThan(0);
      expect(notification.body.length).toBeGreaterThan(0);
    });
  });
});

describe("Edge Cases", () => {
  describe("very long strings", () => {
    it("should handle very long names", () => {
      const longName = "A".repeat(500);
      const notification = createFriendRequestNotification(longName);

      expect(notification.body).toContain(longName);
    });

    it("should handle very long group names", () => {
      const longGroupName = "G".repeat(500);
      const notification = createExpenseNotification(longGroupName, "Item", 50);

      expect(notification.title).toContain(longGroupName);
    });

    it("should handle very long descriptions", () => {
      const longDescription = "D".repeat(500);
      const notification = createExpenseNotification("Group", longDescription, 50);

      expect(notification.body).toContain(longDescription);
    });
  });

  describe("unicode and special characters", () => {
    it("should handle Chinese characters", () => {
      const notification = createGroupInviteNotification("李明", "北京之旅");

      expect(notification.body).toContain("李明");
      expect(notification.body).toContain("北京之旅");
    });

    it("should handle Arabic characters", () => {
      const notification = createFriendRequestNotification("محمد");

      expect(notification.body).toContain("محمد");
    });

    it("should handle newlines in input", () => {
      const notification = createExpenseNotification("Group", "Line1\nLine2", 50);

      expect(notification.body).toContain("Line1\nLine2");
    });

    it("should handle tabs in input", () => {
      const notification = createExpenseNotification("Group", "Item\twith\ttabs", 50);

      expect(notification.body).toContain("Item\twith\ttabs");
    });
  });

  describe("numeric edge cases", () => {
    it("should handle very small amounts", () => {
      const notification = createExpenseNotification("Group", "Item", 0.01);

      expect(notification.body).toContain("$0.01");
    });

    it("should handle amounts with many decimal places", () => {
      const notification = createExpenseNotification("Group", "Item", 10.999);

      // toFixed(2) should round to 11.00
      expect(notification.body).toContain("$11.00");
    });

    it("should handle negative amounts", () => {
      const notification = createExpenseNotification("Group", "Refund", -50);

      // Note: toFixed formats as "$-50.00", not "-$50.00"
      expect(notification.body).toContain("$-50.00");
    });

    it("should handle Infinity amount", () => {
      const notification = createExpenseNotification("Group", "Item", Infinity);

      expect(notification.body).toContain("Infinity");
    });

    it("should handle NaN amount", () => {
      const notification = createExpenseNotification("Group", "Item", NaN);

      expect(notification.body).toContain("NaN");
    });
  });
});

describe("Integration Scenarios", () => {
  it("should work for complete friend request flow", () => {
    // User sends friend request
    const requestNotification = createFriendRequestNotification("Alice");
    expect(requestNotification.type).toBe("friend_request");
    expect(requestNotification.body).toContain("Alice");

    // Friend accepts
    const acceptedNotification = createFriendAcceptedNotification("Bob");
    expect(acceptedNotification.type).toBe("friend_accepted");
    expect(acceptedNotification.body).toContain("Bob");
  });

  it("should work for complete expense flow", () => {
    // User is invited to group
    const inviteNotification = createGroupInviteNotification("Alice", "Trip to Paris");
    expect(inviteNotification.type).toBe("group_invite");
    expect(inviteNotification.data?.groupName).toBe("Trip to Paris");

    // Expense is added
    const expenseNotification = createExpenseNotification("Trip to Paris", "Dinner", 120);
    expect(expenseNotification.type).toBe("expense_added");
    expect(expenseNotification.data?.amount).toBe(120);

    // Settlement is recorded
    const settlementNotification = createSettlementNotification("Trip to Paris", "Bob", 60);
    expect(settlementNotification.type).toBe("settlement_recorded");
    expect(settlementNotification.data?.amount).toBe(60);
  });

  it("should be suitable for push notification display", () => {
    // All notifications should have reasonable title/body lengths for push display
    const notifications = [
      createFriendRequestNotification("Short Name"),
      createFriendAcceptedNotification("Short Name"),
      createExpenseNotification("Group", "Item", 50),
      createSettlementNotification("Group", "User", 50),
      createGroupInviteNotification("User", "Group"),
    ];

    notifications.forEach((notification) => {
      // Titles should be concise (typically < 50 chars for push)
      expect(notification.title.length).toBeLessThan(100);
      // Bodies should be readable (typically < 200 chars for push)
      expect(notification.body.length).toBeLessThan(300);
    });
  });
});
