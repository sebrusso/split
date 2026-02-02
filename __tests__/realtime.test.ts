/**
 * Tests for Realtime Manager
 *
 * Tests the Supabase Realtime subscription manager functionality.
 */

import { createRealtimeManager, getRealtimeManager, PostgresChangePayload } from "../lib/realtime";

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockImplementation((callback) => {
      // Simulate successful connection
      if (callback) callback("SUBSCRIBED");
      return mockChannel;
    }),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
  };

  return {
    channel: jest.fn().mockReturnValue(mockChannel),
    mockChannel,
  };
};

describe("createRealtimeManager", () => {
  it("should create a manager with subscribeToGroup and unsubscribe methods", () => {
    const manager = createRealtimeManager();

    expect(manager).toHaveProperty("subscribeToGroup");
    expect(manager).toHaveProperty("subscribeToUser");
    expect(manager).toHaveProperty("unsubscribe");
    expect(typeof manager.subscribeToGroup).toBe("function");
    expect(typeof manager.subscribeToUser).toBe("function");
    expect(typeof manager.unsubscribe).toBe("function");
  });
});

describe("getRealtimeManager", () => {
  it("should return a singleton instance", () => {
    const manager1 = getRealtimeManager();
    const manager2 = getRealtimeManager();

    expect(manager1).toBe(manager2);
  });
});

describe("subscribeToGroup", () => {
  it("should create a channel with the correct name", () => {
    const manager = createRealtimeManager();
    const { channel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    manager.subscribeToGroup(mockSupabase, "test-group-id", {});

    expect(channel).toHaveBeenCalledWith("group:test-group-id");
  });

  it("should subscribe to expenses, members, settlements, and receipts tables", () => {
    const manager = createRealtimeManager();
    const { channel, mockChannel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    manager.subscribeToGroup(mockSupabase, "test-group-id", {});

    // Verify .on was called 4 times (expenses, members, settlements, receipts)
    expect(mockChannel.on).toHaveBeenCalledTimes(4);

    // Verify the filter includes the group_id
    const onCalls = mockChannel.on.mock.calls;
    onCalls.forEach((call: any[]) => {
      expect(call[1].filter).toBe("group_id=eq.test-group-id");
    });
  });

  it("should call subscribe on the channel", () => {
    const manager = createRealtimeManager();
    const { channel, mockChannel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    manager.subscribeToGroup(mockSupabase, "test-group-id", {});

    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("should return the channel for later unsubscription", () => {
    const manager = createRealtimeManager();
    const { channel, mockChannel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    const result = manager.subscribeToGroup(mockSupabase, "test-group-id", {});

    expect(result).toBe(mockChannel);
  });

  it("should call onExpenseChange callback when expense changes", () => {
    const manager = createRealtimeManager();
    const { channel, mockChannel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    const onExpenseChange = jest.fn();
    manager.subscribeToGroup(mockSupabase, "test-group-id", {
      onExpenseChange,
    });

    // Find the expenses callback from the .on calls
    const expensesCall = mockChannel.on.mock.calls.find(
      (call: any[]) => call[1].table === "expenses"
    );

    // Simulate a change event
    const mockPayload: PostgresChangePayload = {
      eventType: "INSERT",
      new: { id: "expense-1" },
      old: {},
      schema: "public",
      table: "expenses",
      commit_timestamp: new Date().toISOString(),
    };

    // Call the callback that was passed to .on
    expensesCall[2](mockPayload);

    expect(onExpenseChange).toHaveBeenCalledWith(mockPayload);
  });

  it("should call onMemberChange callback when member changes", () => {
    const manager = createRealtimeManager();
    const { channel, mockChannel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    const onMemberChange = jest.fn();
    manager.subscribeToGroup(mockSupabase, "test-group-id", {
      onMemberChange,
    });

    // Find the members callback
    const membersCall = mockChannel.on.mock.calls.find(
      (call: any[]) => call[1].table === "members"
    );

    const mockPayload: PostgresChangePayload = {
      eventType: "INSERT",
      new: { id: "member-1" },
      old: {},
      schema: "public",
      table: "members",
      commit_timestamp: new Date().toISOString(),
    };

    membersCall[2](mockPayload);

    expect(onMemberChange).toHaveBeenCalledWith(mockPayload);
  });

  it("should call onSettlementChange callback when settlement changes", () => {
    const manager = createRealtimeManager();
    const { channel, mockChannel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    const onSettlementChange = jest.fn();
    manager.subscribeToGroup(mockSupabase, "test-group-id", {
      onSettlementChange,
    });

    // Find the settlements callback
    const settlementsCall = mockChannel.on.mock.calls.find(
      (call: any[]) => call[1].table === "settlements"
    );

    const mockPayload: PostgresChangePayload = {
      eventType: "INSERT",
      new: { id: "settlement-1" },
      old: {},
      schema: "public",
      table: "settlements",
      commit_timestamp: new Date().toISOString(),
    };

    settlementsCall[2](mockPayload);

    expect(onSettlementChange).toHaveBeenCalledWith(mockPayload);
  });
});

describe("subscribeToUser", () => {
  it("should create a channel with the correct name", () => {
    const manager = createRealtimeManager();
    const { channel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    manager.subscribeToUser(mockSupabase, "user-123", {});

    expect(channel).toHaveBeenCalledWith("user:user-123");
  });

  it("should subscribe to friendships and activity_log tables", () => {
    const manager = createRealtimeManager();
    const { channel, mockChannel } = createMockSupabaseClient();
    const mockSupabase = { channel } as any;

    manager.subscribeToUser(mockSupabase, "user-123", {});

    // Verify .on was called 3 times (friendships requester, friendships addressee, activity_log)
    expect(mockChannel.on).toHaveBeenCalledTimes(3);
  });
});

describe("unsubscribe", () => {
  it("should call unsubscribe on the channel", async () => {
    const manager = createRealtimeManager();
    const mockChannel = {
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };

    await manager.unsubscribe(mockChannel as any);

    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });

  it("should handle unsubscribe errors gracefully", async () => {
    const manager = createRealtimeManager();
    const mockChannel = {
      unsubscribe: jest.fn().mockRejectedValue(new Error("Test error")),
    };

    // Should not throw
    await expect(manager.unsubscribe(mockChannel as any)).resolves.toBeUndefined();
  });
});
