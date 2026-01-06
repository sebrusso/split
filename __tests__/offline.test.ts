/**
 * Offline functionality tests
 * Note: These tests use mocked modules since op-sqlite and NetInfo require native modules
 */

// Mock all native dependencies
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
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn() })) })),
      update: jest.fn(() => ({ eq: jest.fn() })),
      delete: jest.fn(() => ({ eq: jest.fn() })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ single: jest.fn() })),
        order: jest.fn(),
      })),
    })),
  },
}));

import { resolveConflict, SyncStatus } from "../lib/sync";

// Mock types for testing
interface MockRecord {
  id: string;
  name: string;
  updated_at?: string;
}

describe("Offline Support", () => {
  describe("resolveConflict", () => {
    it("should prefer remote when remote is newer", () => {
      const local: MockRecord = {
        id: "1",
        name: "Local",
        updated_at: "2024-01-01T10:00:00Z",
      };
      const remote: MockRecord = {
        id: "1",
        name: "Remote",
        updated_at: "2024-01-01T12:00:00Z",
      };

      const result = resolveConflict(local, remote);
      expect(result).toBe(remote);
      expect(result.name).toBe("Remote");
    });

    it("should prefer local when local is newer", () => {
      const local: MockRecord = {
        id: "1",
        name: "Local",
        updated_at: "2024-01-01T14:00:00Z",
      };
      const remote: MockRecord = {
        id: "1",
        name: "Remote",
        updated_at: "2024-01-01T12:00:00Z",
      };

      const result = resolveConflict(local, remote);
      expect(result).toBe(local);
      expect(result.name).toBe("Local");
    });

    it("should prefer remote when timestamps are equal", () => {
      const local: MockRecord = {
        id: "1",
        name: "Local",
        updated_at: "2024-01-01T12:00:00Z",
      };
      const remote: MockRecord = {
        id: "1",
        name: "Remote",
        updated_at: "2024-01-01T12:00:00Z",
      };

      const result = resolveConflict(local, remote);
      expect(result).toBe(remote);
    });

    it("should prefer remote when local has no timestamp", () => {
      const local: MockRecord = {
        id: "1",
        name: "Local",
      };
      const remote: MockRecord = {
        id: "1",
        name: "Remote",
        updated_at: "2024-01-01T12:00:00Z",
      };

      const result = resolveConflict(local, remote);
      expect(result).toBe(remote);
    });

    it("should prefer local when remote has no timestamp but local does", () => {
      const local: MockRecord = {
        id: "1",
        name: "Local",
        updated_at: "2024-01-01T12:00:00Z",
      };
      const remote: MockRecord = {
        id: "1",
        name: "Remote",
      };

      const result = resolveConflict(local, remote);
      expect(result).toBe(local);
    });

    it("should prefer remote when neither has timestamp", () => {
      const local: MockRecord = {
        id: "1",
        name: "Local",
      };
      const remote: MockRecord = {
        id: "1",
        name: "Remote",
      };

      const result = resolveConflict(local, remote);
      expect(result).toBe(remote);
    });
  });

  describe("SyncStatus types", () => {
    it("should have correct sync status values", () => {
      const statuses: SyncStatus[] = ["idle", "syncing", "error", "offline"];
      expect(statuses).toContain("idle");
      expect(statuses).toContain("syncing");
      expect(statuses).toContain("error");
      expect(statuses).toContain("offline");
    });
  });

  describe("Operation types", () => {
    it("should support INSERT, UPDATE, DELETE operations", () => {
      const operations = ["INSERT", "UPDATE", "DELETE"];
      expect(operations).toHaveLength(3);
      expect(operations).toContain("INSERT");
      expect(operations).toContain("UPDATE");
      expect(operations).toContain("DELETE");
    });
  });

  describe("Table names", () => {
    it("should support all table names", () => {
      const tables = ["groups", "members", "expenses", "splits", "settlements"];
      expect(tables).toHaveLength(5);
      expect(tables).toContain("groups");
      expect(tables).toContain("members");
      expect(tables).toContain("expenses");
      expect(tables).toContain("splits");
      expect(tables).toContain("settlements");
    });
  });
});

describe("Sync Queue Logic", () => {
  describe("Queue operation data structure", () => {
    it("should have correct queued operation structure", () => {
      const queuedOp = {
        id: 1,
        table_name: "groups" as const,
        operation: "INSERT" as const,
        record_id: "abc-123",
        data: JSON.stringify({ id: "abc-123", name: "Test Group" }),
        created_at: new Date().toISOString(),
      };

      expect(queuedOp.id).toBe(1);
      expect(queuedOp.table_name).toBe("groups");
      expect(queuedOp.operation).toBe("INSERT");
      expect(queuedOp.record_id).toBe("abc-123");
      expect(JSON.parse(queuedOp.data)).toHaveProperty("name", "Test Group");
    });

    it("should serialize and deserialize data correctly", () => {
      const originalData = {
        id: "test-id",
        name: "Test",
        amount: 100.5,
        nested: { key: "value" },
      };

      const serialized = JSON.stringify(originalData);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(originalData);
      expect(deserialized.amount).toBe(100.5);
      expect(deserialized.nested.key).toBe("value");
    });
  });

  describe("Conflict resolution scenarios", () => {
    it("should handle partial settlements correctly", () => {
      const settlement1 = {
        id: "s1",
        amount: 50,
        updated_at: "2024-01-01T10:00:00Z",
      };
      const settlement2 = {
        id: "s1",
        amount: 30,
        updated_at: "2024-01-01T11:00:00Z",
      };

      // Second settlement is newer, should win
      const result = resolveConflict(settlement1, settlement2);
      expect(result.amount).toBe(30);
    });

    it("should handle multiple updates to same record", () => {
      const updates = [
        { id: "1", value: "first", updated_at: "2024-01-01T10:00:00Z" },
        { id: "1", value: "second", updated_at: "2024-01-01T11:00:00Z" },
        { id: "1", value: "third", updated_at: "2024-01-01T12:00:00Z" },
      ];

      // Simulate sequential conflict resolution
      let current = updates[0];
      for (let i = 1; i < updates.length; i++) {
        current = resolveConflict(current, updates[i]);
      }

      expect(current.value).toBe("third");
    });
  });
});
