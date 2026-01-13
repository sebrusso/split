/**
 * Race Condition Tests
 *
 * Tests for concurrent operations to ensure thread safety
 * and correct behavior under parallel execution.
 */

// Mock native dependencies before imports
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

import { calculateBalances, simplifyDebts } from "../lib/utils";
import { resolveConflict } from "../lib/sync";

// ============================================
// Concurrent Balance Calculations
// ============================================

describe("Concurrent Balance Calculations", () => {
  const members = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];

  const expenses = [
    {
      paid_by: "1",
      amount: 300,
      splits: [
        { member_id: "1", amount: 100 },
        { member_id: "2", amount: 100 },
        { member_id: "3", amount: 100 },
      ],
    },
    {
      paid_by: "2",
      amount: 150,
      splits: [
        { member_id: "1", amount: 50 },
        { member_id: "2", amount: 50 },
        { member_id: "3", amount: 50 },
      ],
    },
  ];

  it("should produce consistent results when calculated in parallel", async () => {
    // Simulate concurrent calculations
    const results = await Promise.all(
      Array(10)
        .fill(null)
        .map(() => Promise.resolve(calculateBalances(expenses, members)))
    );

    // All results should be identical
    const firstResult = results[0];
    results.forEach((result) => {
      expect(result.get("1")).toBe(firstResult.get("1"));
      expect(result.get("2")).toBe(firstResult.get("2"));
      expect(result.get("3")).toBe(firstResult.get("3"));
    });
  });

  it("should handle interleaved balance and settlement calculations", async () => {
    const calculations = await Promise.all([
      Promise.resolve(calculateBalances(expenses, members)),
      Promise.resolve(calculateBalances(expenses, members)).then((balances) =>
        simplifyDebts(balances, members)
      ),
      Promise.resolve(calculateBalances(expenses, members)),
      Promise.resolve(calculateBalances(expenses, members)).then((balances) =>
        simplifyDebts(balances, members)
      ),
    ]);

    // Verify balance calculations are consistent
    const balance1 = calculations[0] as Map<string, number>;
    const balance2 = calculations[2] as Map<string, number>;
    expect(balance1.get("1")).toBe(balance2.get("1"));

    // Verify settlement calculations are consistent
    const settlements1 = calculations[1] as Array<{
      from: string;
      to: string;
      amount: number;
    }>;
    const settlements2 = calculations[3] as Array<{
      from: string;
      to: string;
      amount: number;
    }>;
    expect(settlements1.length).toBe(settlements2.length);
  });

  it("should handle rapid sequential calculations without corruption", () => {
    const iterations = 100;
    const results: Map<string, number>[] = [];

    for (let i = 0; i < iterations; i++) {
      results.push(calculateBalances(expenses, members));
    }

    // All results should be identical
    const expected = results[0];
    results.forEach((result, i) => {
      expect(result.get("1")).toBe(expected.get("1"));
      expect(result.get("2")).toBe(expected.get("2"));
      expect(result.get("3")).toBe(expected.get("3"));
    });
  });
});

// ============================================
// Concurrent Conflict Resolution
// ============================================

describe("Concurrent Sync Operations", () => {
  it("should handle simultaneous updates with last-write-wins deterministically", () => {
    const updates = [
      { id: "1", name: "Update A", updated_at: "2024-01-01T10:00:00Z" },
      { id: "1", name: "Update B", updated_at: "2024-01-01T11:00:00Z" },
      { id: "1", name: "Update C", updated_at: "2024-01-01T12:00:00Z" },
      { id: "1", name: "Update D", updated_at: "2024-01-01T09:00:00Z" },
    ];

    // Shuffle to simulate out-of-order arrival
    const shuffled = [...updates].sort(() => Math.random() - 0.5);

    let current = shuffled[0];
    for (let i = 1; i < shuffled.length; i++) {
      current = resolveConflict(current, shuffled[i]);
    }

    // Update C should always win (latest timestamp)
    expect(current.name).toBe("Update C");
  });

  it("should produce consistent results regardless of resolution order", () => {
    const record1 = {
      id: "1",
      value: "first",
      updated_at: "2024-01-01T10:00:00Z",
    };
    const record2 = {
      id: "1",
      value: "second",
      updated_at: "2024-01-01T12:00:00Z",
    };

    // Order shouldn't matter
    const result1 = resolveConflict(record1, record2);
    const result2 = resolveConflict(record2, record1);

    expect(result1.value).toBe(result2.value);
    expect(result1.value).toBe("second"); // Later timestamp wins
  });

  it("should handle race between create and update", () => {
    const createOp = {
      id: "1",
      name: "Created",
      updated_at: "2024-01-01T10:00:00Z",
    };
    const updateOp = {
      id: "1",
      name: "Updated",
      updated_at: "2024-01-01T10:00:01Z",
    };

    const result = resolveConflict(createOp, updateOp);
    expect(result.name).toBe("Updated");
  });

  it("should handle equal timestamps by preferring remote", () => {
    const local = {
      id: "1",
      name: "Local",
      updated_at: "2024-01-01T12:00:00Z",
    };
    const remote = {
      id: "1",
      name: "Remote",
      updated_at: "2024-01-01T12:00:00Z",
    };

    const result = resolveConflict(local, remote);
    expect(result.name).toBe("Remote"); // Remote wins on tie
  });

  it("should handle missing timestamps by preferring the one with timestamp", () => {
    const withTimestamp = {
      id: "1",
      name: "Has Timestamp",
      updated_at: "2024-01-01T12:00:00Z",
    };
    const withoutTimestamp = {
      id: "1",
      name: "No Timestamp",
      updated_at: undefined as string | undefined,
    };

    const result1 = resolveConflict(withTimestamp, withoutTimestamp);
    const result2 = resolveConflict(withoutTimestamp, withTimestamp);

    // The one with timestamp should win
    expect((result1 as typeof withTimestamp).name).toBe("Has Timestamp");
    expect((result2 as typeof withTimestamp).name).toBe("Has Timestamp");
  });
});

// ============================================
// Concurrent Settlement Recording
// ============================================

describe("Concurrent Settlement Recording", () => {
  it("should handle duplicate settlement attempts idempotently", async () => {
    const settlement = {
      from: "2",
      to: "1",
      amount: 50,
    };

    // Mock idempotent settlement recording
    const recordedSettlements: typeof settlement[] = [];
    const mockRecordSettlement = jest
      .fn()
      .mockImplementation(async (s: typeof settlement) => {
        // Simulate network delay
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 50)
        );
        // Idempotent - only add if not already present
        const exists = recordedSettlements.some(
          (existing) =>
            existing.from === s.from &&
            existing.to === s.to &&
            existing.amount === s.amount
        );
        if (!exists) {
          recordedSettlements.push(s);
        }
        return { success: true };
      });

    // Simulate concurrent API calls
    const results = await Promise.all([
      mockRecordSettlement(settlement),
      mockRecordSettlement(settlement),
      mockRecordSettlement(settlement),
    ]);

    // All should succeed
    expect(results.every((r) => r.success)).toBe(true);
    // But only one settlement should be recorded
    expect(recordedSettlements.length).toBe(1);
  });

  it("should handle concurrent settlements between different pairs", async () => {
    const settlements = [
      { from: "1", to: "2", amount: 50 },
      { from: "2", to: "3", amount: 30 },
      { from: "3", to: "1", amount: 20 },
    ];

    const recorded: typeof settlements = [];
    const mockRecord = async (s: (typeof settlements)[0]) => {
      await new Promise((r) => setTimeout(r, Math.random() * 20));
      recorded.push(s);
      return { success: true };
    };

    await Promise.all(settlements.map(mockRecord));

    // All settlements should be recorded
    expect(recorded.length).toBe(3);
    settlements.forEach((s) => {
      expect(recorded.some((r) => r.from === s.from && r.to === s.to)).toBe(
        true
      );
    });
  });
});

// ============================================
// Concurrent Cache Operations
// ============================================

describe("Concurrent Cache Operations", () => {
  it("should handle simultaneous cache reads and writes", async () => {
    const cache = new Map<string, { value: number; timestamp: number }>();
    const operations: Promise<string>[] = [];

    // Simulate concurrent reads and writes
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        operations.push(
          Promise.resolve().then(() => {
            cache.set(`key-${Math.floor(i / 10)}`, {
              value: i,
              timestamp: Date.now(),
            });
            return `write-${i}`;
          })
        );
      } else {
        operations.push(
          Promise.resolve().then(() => {
            const value = cache.get(`key-${Math.floor(i / 10)}`);
            return `read-${i}: ${value?.value ?? "miss"}`;
          })
        );
      }
    }

    const results = await Promise.all(operations);
    // Should complete without errors
    expect(results.length).toBe(50);
  });

  it("should maintain data consistency with interleaved operations", async () => {
    const state = { balance: 100 };
    const operations: Promise<number>[] = [];

    // Simulate concurrent balance modifications
    for (let i = 0; i < 20; i++) {
      operations.push(
        Promise.resolve().then(() => {
          const current = state.balance;
          // Simulate atomic operation
          state.balance = current + (i % 2 === 0 ? 10 : -10);
          return state.balance;
        })
      );
    }

    await Promise.all(operations);

    // Balance should be unchanged (10 adds, 10 subtracts)
    expect(state.balance).toBe(100);
  });
});

// ============================================
// Stress Tests
// ============================================

describe("Stress Tests", () => {
  it("should handle high-volume concurrent balance calculations", async () => {
    const members = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      name: `Member ${i}`,
    }));

    const expenses = Array.from({ length: 50 }, (_, i) => ({
      paid_by: `m${i % 10}`,
      amount: Math.random() * 100,
      splits: members.map((m) => ({
        member_id: m.id,
        amount: Math.random() * 10,
      })),
    }));

    // Run 100 concurrent calculations
    const start = Date.now();
    const results = await Promise.all(
      Array(100)
        .fill(null)
        .map(() => Promise.resolve(calculateBalances(expenses, members)))
    );
    const duration = Date.now() - start;

    // Should complete in reasonable time
    expect(duration).toBeLessThan(5000);
    // All results should be valid
    expect(results.every((r) => r instanceof Map)).toBe(true);
  });

  it("should handle rapid conflict resolution chains", () => {
    const iterations = 1000;
    let current = { id: "1", value: 0, updated_at: "2024-01-01T00:00:00Z" };

    for (let i = 1; i <= iterations; i++) {
      const candidate = {
        id: "1",
        value: i,
        updated_at: new Date(Date.UTC(2024, 0, 1, 0, 0, i)).toISOString(),
      };
      current = resolveConflict(current, candidate);
    }

    // Final value should be the last iteration (latest timestamp)
    expect(current.value).toBe(iterations);
  });
});
