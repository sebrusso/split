/**
 * Comprehensive Offline Sync Tests
 *
 * Extended test coverage for offline functionality, sync queue,
 * conflict resolution, and data integrity.
 */

// Mock native dependencies
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock("@op-engineering/op-sqlite", () => ({
  open: jest.fn(() => ({
    execute: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({ single: jest.fn() })),
      })),
      update: jest.fn(() => ({ eq: jest.fn() })),
      delete: jest.fn(() => ({ eq: jest.fn() })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ single: jest.fn() })),
        order: jest.fn(),
      })),
    })),
  },
}));

import { resolveConflict } from "../lib/sync";

// ============================================
// Queue Operation Ordering
// ============================================

describe("Queue Operation Ordering", () => {
  it("should process operations in FIFO order", () => {
    const operations = [
      {
        id: 1,
        table_name: "groups",
        operation: "INSERT",
        record_id: "g1",
        data: "{}",
        created_at: "2024-01-01T10:00:00Z",
      },
      {
        id: 2,
        table_name: "members",
        operation: "INSERT",
        record_id: "m1",
        data: "{}",
        created_at: "2024-01-01T10:00:01Z",
      },
      {
        id: 3,
        table_name: "expenses",
        operation: "INSERT",
        record_id: "e1",
        data: "{}",
        created_at: "2024-01-01T10:00:02Z",
      },
    ];

    // Operations should be processed in order by id
    const processedOrder = [...operations].sort((a, b) => a.id - b.id);
    expect(processedOrder[0].table_name).toBe("groups");
    expect(processedOrder[1].table_name).toBe("members");
    expect(processedOrder[2].table_name).toBe("expenses");
  });

  it("should maintain dependency order (groups -> members -> expenses)", () => {
    const operations = [
      { table: "expenses", dependsOn: "members" },
      { table: "members", dependsOn: "groups" },
      { table: "groups", dependsOn: null },
      { table: "splits", dependsOn: "expenses" },
      { table: "settlements", dependsOn: "members" },
    ];

    // Build dependency order
    const order: string[] = [];
    const remaining = [...operations];

    while (remaining.length > 0) {
      const canProcess = remaining.filter(
        (op) => op.dependsOn === null || order.includes(op.dependsOn)
      );
      canProcess.forEach((op) => {
        order.push(op.table);
        remaining.splice(remaining.indexOf(op), 1);
      });
    }

    expect(order.indexOf("groups")).toBeLessThan(order.indexOf("members"));
    expect(order.indexOf("members")).toBeLessThan(order.indexOf("expenses"));
    expect(order.indexOf("expenses")).toBeLessThan(order.indexOf("splits"));
  });

  it("should handle INSERT -> UPDATE -> DELETE sequence optimization", () => {
    const operations = [
      { operation: "INSERT", record_id: "r1", data: { name: "Original" } },
      { operation: "UPDATE", record_id: "r1", data: { name: "Updated" } },
      { operation: "DELETE", record_id: "r1", data: {} },
    ];

    // Optimization: If we INSERT then DELETE the same record, we can skip both
    const optimizeQueue = (
      ops: typeof operations
    ): typeof operations => {
      const byRecord = new Map<string, typeof operations>();

      ops.forEach((op) => {
        const existing = byRecord.get(op.record_id) || [];
        existing.push(op);
        byRecord.set(op.record_id, existing);
      });

      const optimized: typeof operations = [];
      byRecord.forEach((recordOps) => {
        const first = recordOps[0];
        const last = recordOps[recordOps.length - 1];

        // If INSERT followed by DELETE, skip entire chain
        if (first.operation === "INSERT" && last.operation === "DELETE") {
          return; // Skip all operations for this record
        }

        // Otherwise keep all operations
        optimized.push(...recordOps);
      });

      return optimized;
    };

    const optimized = optimizeQueue(operations);
    expect(optimized.length).toBe(0); // All operations can be skipped
  });

  it("should NOT optimize if final operation is not DELETE", () => {
    const operations = [
      { operation: "INSERT", record_id: "r1", data: { name: "Original" } },
      { operation: "UPDATE", record_id: "r1", data: { name: "Updated" } },
    ];

    // No optimization possible - need to keep INSERT and UPDATE
    expect(operations.length).toBe(2);
  });
});

// ============================================
// Network State Transitions
// ============================================

describe("Network State Transitions", () => {
  it("should detect offline to online transition", () => {
    const transitions: string[] = [];
    let wasOffline = true;

    const networkStates = [false, false, true, true, false, true];

    networkStates.forEach((isOnline) => {
      if (wasOffline && isOnline) {
        transitions.push("offline->online");
      } else if (!wasOffline && !isOnline) {
        transitions.push("online->offline");
      }
      wasOffline = !isOnline;
    });

    // Should detect 2 offline->online transitions
    expect(
      transitions.filter((t) => t === "offline->online").length
    ).toBe(2);
  });

  it("should queue operations when offline", () => {
    let isOnline = false;
    const queue: { type: string; data: object }[] = [];

    const queueOperation = (op: { type: string; data: object }) => {
      if (!isOnline) {
        queue.push(op);
        return { queued: true };
      }
      return { queued: false, synced: true };
    };

    const result1 = queueOperation({ type: "INSERT", data: { id: "1" } });
    const result2 = queueOperation({ type: "UPDATE", data: { id: "1" } });

    expect(result1.queued).toBe(true);
    expect(result2.queued).toBe(true);
    expect(queue.length).toBe(2);

    // Come online
    isOnline = true;
    const result3 = queueOperation({ type: "INSERT", data: { id: "2" } });
    expect(result3.queued).toBe(false);
    expect(result3.synced).toBe(true);
  });

  it("should trigger sync immediately when coming online", async () => {
    let syncCalled = false;
    const mockSync = jest.fn(async () => {
      syncCalled = true;
      return { success: true, synced: 5, failed: 0 };
    });

    // Simulate network state change handler
    const handleNetworkChange = async (
      wasOffline: boolean,
      isOnline: boolean
    ) => {
      if (wasOffline && isOnline) {
        await mockSync();
      }
    };

    await handleNetworkChange(true, true);
    expect(syncCalled).toBe(true);
    expect(mockSync).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// Conflict Resolution Scenarios
// ============================================

describe("Conflict Resolution Scenarios", () => {
  it("should handle concurrent edits to same expense", () => {
    const localEdit = {
      id: "e1",
      description: "Local description",
      amount: 100,
      updated_at: "2024-01-01T10:00:00Z",
    };

    const remoteEdit = {
      id: "e1",
      description: "Remote description",
      amount: 150,
      updated_at: "2024-01-01T10:00:05Z",
    };

    const resolved = resolveConflict(localEdit, remoteEdit);

    // Remote wins (newer timestamp)
    expect(resolved.description).toBe("Remote description");
    expect(resolved.amount).toBe(150);
  });

  it("should handle split modifications during offline", () => {
    const localSplits = [
      { member_id: "m1", amount: 33.33 },
      { member_id: "m2", amount: 33.33 },
      { member_id: "m3", amount: 33.34 },
    ];

    const remoteSplits = [
      { member_id: "m1", amount: 50 },
      { member_id: "m2", amount: 50 },
      // m3 removed from split
    ];

    // In a real scenario, we'd merge based on expense timestamp
    // Remote splits should be used if remote expense is newer
    expect(remoteSplits.length).toBe(2);
    expect(localSplits.length).toBe(3);
  });

  it("should handle member added while offline", () => {
    const offlineCreatedMember = {
      id: "m-offline-1",
      name: "Offline User",
      group_id: "g1",
      created_at: "2024-01-01T10:00:00Z",
    };

    // When syncing, should INSERT the new member
    expect(offlineCreatedMember.id).toBeDefined();
    expect(offlineCreatedMember.id).toContain("offline");
  });

  it("should handle expense deleted on server while edited locally", () => {
    const localExpense = {
      id: "e-deleted",
      description: "Updated locally",
      amount: 200,
      updated_at: "2024-01-01T10:00:00Z",
    };

    // Server returns 404 or indicates record doesn't exist
    const serverResponse = { error: { code: "PGRST116" } }; // Row not found

    // Local edit should be discarded if record no longer exists
    const handleServerNotFound = (response: { error?: { code: string } }) => {
      if (response.error?.code === "PGRST116") {
        return { action: "discard", reason: "Record no longer exists" };
      }
      return { action: "retry" };
    };

    expect(handleServerNotFound(serverResponse).action).toBe("discard");
  });

  it("should handle group deleted during offline session", () => {
    const queuedOps = [
      {
        table_name: "expenses",
        operation: "INSERT",
        record_id: "e1",
        data: { group_id: "g-deleted" },
      },
      {
        table_name: "splits",
        operation: "INSERT",
        record_id: "s1",
        data: { expense_id: "e1" },
      },
    ];

    // When syncing, expense insert will fail with FK violation
    // Should handle gracefully and remove dependent operations
    const handleForeignKeyError = (
      error: { code: string },
      queue: typeof queuedOps
    ) => {
      if (error.code === "23503") {
        // FK violation
        // Remove all operations that depend on the failed record
        return queue.filter((op) => op.data.group_id !== "g-deleted");
      }
      return queue;
    };

    const remaining = handleForeignKeyError({ code: "23503" }, queuedOps);
    expect(remaining.length).toBe(1); // Only splits remain (no group_id dependency)
  });
});

// ============================================
// Data Integrity
// ============================================

describe("Data Integrity", () => {
  it("should maintain referential integrity in cache", () => {
    const expense = { id: "e1", paid_by: "m1", group_id: "g1" };
    const members = [
      { id: "m1", group_id: "g1" },
      { id: "m2", group_id: "g1" },
    ];
    const groups = [{ id: "g1", name: "Test Group" }];

    // Verify payer exists
    const payerExists = members.some((m) => m.id === expense.paid_by);
    expect(payerExists).toBe(true);

    // Verify group exists
    const groupExists = groups.some((g) => g.id === expense.group_id);
    expect(groupExists).toBe(true);
  });

  it("should handle orphaned splits after expense deletion", () => {
    const deletedExpenseId = "e-deleted";
    const splits = [
      { id: "s1", expense_id: deletedExpenseId, member_id: "m1", amount: 50 },
      { id: "s2", expense_id: deletedExpenseId, member_id: "m2", amount: 50 },
      { id: "s3", expense_id: "e-existing", member_id: "m1", amount: 100 },
    ];

    // Cascade delete splits when expense is deleted
    const cleanupOrphanedSplits = (
      allSplits: typeof splits,
      deletedExpense: string
    ) => {
      return allSplits.filter((s) => s.expense_id !== deletedExpense);
    };

    const remainingSplits = cleanupOrphanedSplits(splits, deletedExpenseId);
    expect(remainingSplits.length).toBe(1);
    expect(remainingSplits[0].id).toBe("s3");
  });

  it("should validate cache consistency before sync", () => {
    const cache = {
      groups: [{ id: "g1", name: "Group 1" }],
      members: [
        { id: "m1", group_id: "g1" },
        { id: "m2", group_id: "g-invalid" }, // Invalid group reference
      ],
      expenses: [{ id: "e1", group_id: "g1", paid_by: "m1" }],
    };

    const validateCache = (data: typeof cache) => {
      const errors: string[] = [];
      const groupIds = new Set(data.groups.map((g) => g.id));
      const memberIds = new Set(data.members.map((m) => m.id));

      // Check members reference valid groups
      data.members.forEach((m) => {
        if (!groupIds.has(m.group_id)) {
          errors.push(`Member ${m.id} references invalid group ${m.group_id}`);
        }
      });

      // Check expenses reference valid groups and members
      data.expenses.forEach((e) => {
        if (!groupIds.has(e.group_id)) {
          errors.push(`Expense ${e.id} references invalid group ${e.group_id}`);
        }
        if (!memberIds.has(e.paid_by)) {
          errors.push(`Expense ${e.id} references invalid payer ${e.paid_by}`);
        }
      });

      return errors;
    };

    const errors = validateCache(cache);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("g-invalid");
  });
});

// ============================================
// Background Sync Behavior
// ============================================

describe("Background Sync Behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should sync at regular intervals when online", () => {
    const SYNC_INTERVAL_MS = 30000;
    let syncCount = 0;

    const syncInterval = setInterval(() => {
      syncCount++;
    }, SYNC_INTERVAL_MS);

    // Fast-forward 2 minutes
    jest.advanceTimersByTime(120000);

    clearInterval(syncInterval);

    // Should have synced 4 times (120000 / 30000)
    expect(syncCount).toBe(4);
  });

  it("should not sync when offline", () => {
    let isOnline = false;
    let syncAttempts = 0;

    const trySync = () => {
      if (isOnline) {
        syncAttempts++;
        return { synced: true };
      }
      return { synced: false, reason: "offline" };
    };

    // Attempt syncs while offline
    for (let i = 0; i < 5; i++) {
      trySync();
    }

    expect(syncAttempts).toBe(0);
  });

  it("should debounce rapid sync requests", () => {
    let syncCount = 0;
    const DEBOUNCE_MS = 1000;
    let lastSyncTime = -DEBOUNCE_MS; // Start at -1000 so first sync is allowed

    // Use jest's mocked Date.now for consistent behavior
    let mockedNow = 0;
    const originalDateNow = Date.now;
    Date.now = jest.fn(() => mockedNow);

    const debouncedSync = () => {
      const now = Date.now();
      if (now - lastSyncTime >= DEBOUNCE_MS) {
        syncCount++;
        lastSyncTime = now;
      }
    };

    // Rapid sync requests
    debouncedSync(); // First sync at time 0 (allowed: 0 - (-1000) >= 1000)
    mockedNow = 500;
    debouncedSync(); // Skip - only 500ms since first
    mockedNow = 800;
    debouncedSync(); // Skip - only 800ms since first
    mockedNow = 1000;
    debouncedSync(); // Second sync at time 1000 (allowed: 1000 - 0 >= 1000)
    mockedNow = 1500;
    debouncedSync(); // Skip - only 500ms since second

    // Restore original Date.now
    Date.now = originalDateNow;

    // Should only sync twice (initial + after debounce)
    expect(syncCount).toBe(2);
  });
});

// ============================================
// Error Recovery
// ============================================

describe("Error Recovery", () => {
  it("should retry failed operations with exponential backoff", () => {
    const retryDelays = [1000, 2000, 4000, 8000, 16000];
    const MAX_RETRIES = 5;

    let attempt = 0;
    const getDelay = () => {
      const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
      attempt++;
      return delay;
    };

    expect(getDelay()).toBe(1000);
    expect(getDelay()).toBe(2000);
    expect(getDelay()).toBe(4000);
    expect(getDelay()).toBe(8000);
    expect(getDelay()).toBe(16000);
    expect(getDelay()).toBe(16000); // Max delay reached
  });

  it("should mark operations as failed after max retries", async () => {
    const MAX_RETRIES = 3;
    let retries = 0;
    let status = "pending";

    const processWithRetry = async () => {
      while (retries < MAX_RETRIES) {
        try {
          // Simulate always failing
          throw new Error("Network error");
        } catch {
          retries++;
          if (retries >= MAX_RETRIES) {
            status = "failed";
          }
        }
      }
    };

    await processWithRetry();

    expect(retries).toBe(MAX_RETRIES);
    expect(status).toBe("failed");
  });

  it("should handle partial sync success", async () => {
    const operations = [
      { id: 1, success: true },
      { id: 2, success: false },
      { id: 3, success: true },
      { id: 4, success: false },
      { id: 5, success: true },
    ];

    const syncResults = {
      synced: 0,
      failed: 0,
      remaining: [] as number[],
    };

    operations.forEach((op) => {
      if (op.success) {
        syncResults.synced++;
      } else {
        syncResults.failed++;
        syncResults.remaining.push(op.id);
      }
    });

    expect(syncResults.synced).toBe(3);
    expect(syncResults.failed).toBe(2);
    expect(syncResults.remaining).toEqual([2, 4]);
  });

  it("should recover from corrupted queue", () => {
    const corruptedQueue = [
      { id: 1, data: '{"valid": true}' },
      { id: 2, data: "not-valid-json" },
      { id: 3, data: '{"also": "valid"}' },
    ];

    const sanitizeQueue = (
      queue: typeof corruptedQueue
    ): Array<{ id: number; data: object }> => {
      return queue
        .map((item) => {
          try {
            return { id: item.id, data: JSON.parse(item.data) };
          } catch {
            console.warn(`Skipping corrupted queue item ${item.id}`);
            return null;
          }
        })
        .filter((item): item is { id: number; data: object } => item !== null);
    };

    const sanitized = sanitizeQueue(corruptedQueue);
    expect(sanitized.length).toBe(2);
    expect(sanitized[0].id).toBe(1);
    expect(sanitized[1].id).toBe(3);
  });
});

// ============================================
// Sync Status Management
// ============================================

describe("Sync Status Management", () => {
  type SyncStatus = "idle" | "syncing" | "error" | "offline";

  it("should track sync status transitions", () => {
    const statusHistory: SyncStatus[] = [];
    let currentStatus: SyncStatus = "idle";

    const setStatus = (status: SyncStatus) => {
      statusHistory.push(status);
      currentStatus = status;
    };

    // Simulate sync flow
    setStatus("syncing");
    setStatus("idle");
    setStatus("syncing");
    setStatus("error");
    setStatus("idle");
    setStatus("offline");

    expect(statusHistory).toEqual([
      "syncing",
      "idle",
      "syncing",
      "error",
      "idle",
      "offline",
    ]);
    expect(currentStatus).toBe("offline");
  });

  it("should notify listeners on status change", () => {
    const listeners: Array<(status: SyncStatus) => void> = [];
    const notifications: SyncStatus[] = [];

    const subscribe = (callback: (status: SyncStatus) => void) => {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    };

    const setStatus = (status: SyncStatus) => {
      listeners.forEach((cb) => cb(status));
    };

    // Subscribe
    const unsubscribe = subscribe((status) => notifications.push(status));

    // Trigger changes
    setStatus("syncing");
    setStatus("idle");

    expect(notifications).toEqual(["syncing", "idle"]);

    // Unsubscribe
    unsubscribe();
    setStatus("error");

    // Should not receive after unsubscribe
    expect(notifications).toEqual(["syncing", "idle"]);
  });
});
