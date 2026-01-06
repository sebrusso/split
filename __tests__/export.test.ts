/**
 * CSV Export Utilities Tests
 *
 * Comprehensive tests for export functions in lib/export.ts
 * Tests actual exported functions (not reimplementations).
 */

import { Group, Member, Expense, SettlementRecord } from "../lib/types";

// Mock dependencies before importing the module under test
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    write: jest.fn().mockResolvedValue(undefined),
    exists: true,
    delete: jest.fn().mockResolvedValue(undefined),
    uri: "file:///mock/path/file.csv",
  })),
  Paths: {
    cache: "/mock/cache/path",
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// Import actual functions from lib/export.ts
import {
  exportExpensesToCSV,
  exportBalancesToCSV,
  exportSettlementsToCSV,
  exportGroupToCSV,
  generateExpenseReport,
  shareCSV,
  exportGroup,
} from "../lib/export";

// Test data fixtures
const mockGroup: Group = {
  id: "group-1",
  name: "Test Group",
  emoji: "🏠",
  currency: "USD",
  share_code: "ABC123",
  created_at: "2024-01-01T00:00:00Z",
};

const mockMembers: Member[] = [
  {
    id: "member-1",
    group_id: "group-1",
    name: "Alice",
    user_id: null,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "member-2",
    group_id: "group-1",
    name: "Bob",
    user_id: null,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "member-3",
    group_id: "group-1",
    name: "Charlie",
    user_id: null,
    created_at: "2024-01-01T00:00:00Z",
  },
];

const mockExpenses: Expense[] = [
  {
    id: "expense-1",
    group_id: "group-1",
    description: "Groceries",
    amount: 50.0,
    paid_by: "member-1",
    created_at: "2024-01-15T12:00:00Z",
    category: "groceries",
    expense_date: "2024-01-15",
    notes: "Weekly groceries",
    merchant: "Whole Foods",
    split_type: "equal",
    payer: mockMembers[0],
  },
  {
    id: "expense-2",
    group_id: "group-1",
    description: "Dinner",
    amount: 75.5,
    paid_by: "member-2",
    created_at: "2024-01-16T19:00:00Z",
    category: "food",
    expense_date: "2024-01-16",
    notes: null,
    merchant: "Restaurant",
    split_type: "equal",
    payer: mockMembers[1],
  },
];

const mockSettlements: SettlementRecord[] = [
  {
    id: "settlement-1",
    group_id: "group-1",
    from_member_id: "member-3",
    to_member_id: "member-1",
    amount: 25.0,
    settled_at: "2024-01-20T10:00:00Z",
    created_at: "2024-01-20T10:00:00Z",
    from_member: mockMembers[2],
    to_member: mockMembers[0],
  },
];

const mockBalances = new Map<string, number>([
  ["member-1", 25.0],
  ["member-2", 15.5],
  ["member-3", -40.5],
]);

describe("exportExpensesToCSV", () => {
  describe("header row", () => {
    it("should include all expected column headers", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("Date");
      expect(csv).toContain("Description");
      expect(csv).toContain("Category");
      expect(csv).toContain("Amount (USD)");
      expect(csv).toContain("Paid By");
      expect(csv).toContain("Merchant");
      expect(csv).toContain("Notes");
      expect(csv).toContain("Split Type");
    });

    it("should include currency in Amount header", () => {
      const csvUSD = exportExpensesToCSV(mockExpenses, mockMembers, "USD");
      expect(csvUSD).toContain("Amount (USD)");

      const csvEUR = exportExpensesToCSV(mockExpenses, mockMembers, "EUR");
      expect(csvEUR).toContain("Amount (EUR)");

      const csvGBP = exportExpensesToCSV(mockExpenses, mockMembers, "GBP");
      expect(csvGBP).toContain("Amount (GBP)");
    });
  });

  describe("data rows", () => {
    it("should include expense data in output", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("Groceries");
      expect(csv).toContain("Dinner");
      expect(csv).toContain("50");
      expect(csv).toContain("75.5");
    });

    it("should include payer names", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("Alice");
      expect(csv).toContain("Bob");
    });

    it("should use expense_date when available", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("2024-01-15");
      expect(csv).toContain("2024-01-16");
    });

    it("should fall back to created_at date when expense_date is missing", () => {
      const expenseWithoutDate: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: "Test",
          amount: 10,
          paid_by: "member-1",
          created_at: "2024-02-20T15:30:00Z",
          payer: mockMembers[0],
        },
      ];

      const csv = exportExpensesToCSV(expenseWithoutDate, mockMembers, "USD");

      expect(csv).toContain("2024-02-20");
    });

    it("should include merchant info", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("Whole Foods");
      expect(csv).toContain("Restaurant");
    });

    it("should include notes", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("Weekly groceries");
    });

    it("should include split type", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("equal");
    });

    it("should include category display name", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("Groceries"); // Category name, not ID
    });
  });

  describe("empty data handling", () => {
    it("should return header row only for empty expenses array", () => {
      const csv = exportExpensesToCSV([], mockMembers, "USD");
      const lines = csv.split("\n");

      expect(lines.length).toBe(1); // Just header
      expect(lines[0]).toContain("Date");
    });
  });

  describe("missing data handling", () => {
    it("should handle expense without payer object", () => {
      const expenseNoPayer: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: "Test",
          amount: 10,
          paid_by: "member-1",
          created_at: "2024-01-01T00:00:00Z",
          // No payer property
        },
      ];

      const csv = exportExpensesToCSV(expenseNoPayer, mockMembers, "USD");

      expect(csv).toContain("Alice"); // Should look up from members
    });

    it("should handle unknown paid_by member", () => {
      const expenseUnknownPayer: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: "Test",
          amount: 10,
          paid_by: "unknown-member-id",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const csv = exportExpensesToCSV(expenseUnknownPayer, mockMembers, "USD");

      expect(csv).toContain("Unknown");
    });

    it("should handle null notes and merchant", () => {
      const expenseNullFields: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: "Test",
          amount: 10,
          paid_by: "member-1",
          created_at: "2024-01-01T00:00:00Z",
          notes: null,
          merchant: null,
          payer: mockMembers[0],
        },
      ];

      // Should not throw
      expect(() =>
        exportExpensesToCSV(expenseNullFields, mockMembers, "USD")
      ).not.toThrow();
    });

    it("should default to 'other' category when missing", () => {
      const expenseNoCategory: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: "Test",
          amount: 10,
          paid_by: "member-1",
          created_at: "2024-01-01T00:00:00Z",
          payer: mockMembers[0],
        },
      ];

      const csv = exportExpensesToCSV(expenseNoCategory, mockMembers, "USD");

      expect(csv).toContain("Other"); // Default category name
    });
  });

  describe("CSV escaping", () => {
    it("should escape commas in description", () => {
      const expenseWithComma: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: "Coffee, Tea, and Snacks",
          amount: 25.0,
          paid_by: "member-1",
          created_at: "2024-01-15T12:00:00Z",
          payer: mockMembers[0],
        },
      ];

      const csv = exportExpensesToCSV(expenseWithComma, mockMembers, "USD");

      expect(csv).toContain('"Coffee, Tea, and Snacks"');
    });

    it("should escape quotes in description", () => {
      const expenseWithQuotes: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: 'The "Best" Restaurant',
          amount: 100.0,
          paid_by: "member-1",
          created_at: "2024-01-15T12:00:00Z",
          payer: mockMembers[0],
        },
      ];

      const csv = exportExpensesToCSV(expenseWithQuotes, mockMembers, "USD");

      expect(csv).toContain('"The ""Best"" Restaurant"');
    });

    it("should escape newlines in notes", () => {
      const expenseWithNewline: Expense[] = [
        {
          id: "exp-1",
          group_id: "group-1",
          description: "Multi-item",
          amount: 50.0,
          paid_by: "member-1",
          created_at: "2024-01-15T12:00:00Z",
          notes: "Item 1\nItem 2\nItem 3",
          payer: mockMembers[0],
        },
      ];

      const csv = exportExpensesToCSV(expenseWithNewline, mockMembers, "USD");

      expect(csv).toContain('"Item 1\nItem 2\nItem 3"');
    });
  });
});

describe("exportBalancesToCSV", () => {
  describe("header row", () => {
    it("should include all expected column headers", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      expect(csv).toContain("Member");
      expect(csv).toContain("Balance (USD)");
      expect(csv).toContain("Status");
    });

    it("should include currency in Balance header", () => {
      const csvEUR = exportBalancesToCSV(mockBalances, mockMembers, "EUR");

      expect(csvEUR).toContain("Balance (EUR)");
    });
  });

  describe("data rows", () => {
    it("should include all members", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      expect(csv).toContain("Alice");
      expect(csv).toContain("Bob");
      expect(csv).toContain("Charlie");
    });

    it("should show correct status for positive balance", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      expect(csv).toContain("Is owed money");
    });

    it("should show correct status for negative balance", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      expect(csv).toContain("Owes money");
    });

    it("should show Settled status for zero balance", () => {
      const zeroBalances = new Map<string, number>([
        ["member-1", 0],
        ["member-2", 0],
        ["member-3", 0],
      ]);

      const csv = exportBalancesToCSV(zeroBalances, mockMembers, "USD");

      expect(csv).toContain("Settled");
    });

    it("should show Settled for very small balances (< 0.01)", () => {
      const tinyBalances = new Map<string, number>([
        ["member-1", 0.005],
        ["member-2", -0.005],
        ["member-3", 0.009],
      ]);

      const csv = exportBalancesToCSV(tinyBalances, mockMembers, "USD");

      // All should be considered settled
      const lines = csv.split("\n");
      const dataLines = lines.slice(1); // Skip header
      dataLines.forEach((line) => {
        expect(line).toContain("Settled");
      });
    });
  });

  describe("balance rounding", () => {
    it("should round balances to 2 decimal places", () => {
      const preciseBalances = new Map<string, number>([
        ["member-1", 25.126],
        ["member-2", -15.994],
      ]);

      const csv = exportBalancesToCSV(preciseBalances, mockMembers.slice(0, 2), "USD");

      expect(csv).toContain("25.13");
      expect(csv).toContain("-15.99");
    });
  });

  describe("missing balance handling", () => {
    it("should treat missing balances as 0", () => {
      const partialBalances = new Map<string, number>([
        ["member-1", 10],
        // member-2 and member-3 not in map
      ]);

      const csv = exportBalancesToCSV(partialBalances, mockMembers, "USD");

      // Should not throw and should include all members
      expect(csv).toContain("Alice");
      expect(csv).toContain("Bob");
      expect(csv).toContain("Charlie");
    });
  });
});

describe("exportSettlementsToCSV", () => {
  describe("header row", () => {
    it("should include all expected column headers", () => {
      const csv = exportSettlementsToCSV(mockSettlements, "USD");

      expect(csv).toContain("Date");
      expect(csv).toContain("From");
      expect(csv).toContain("To");
      expect(csv).toContain("Amount (USD)");
    });
  });

  describe("data rows", () => {
    it("should include settlement data", () => {
      const csv = exportSettlementsToCSV(mockSettlements, "USD");

      expect(csv).toContain("Charlie");
      expect(csv).toContain("Alice");
      expect(csv).toContain("2024-01-20");
      expect(csv).toContain("25");
    });
  });

  describe("empty data handling", () => {
    it("should return header row only for empty settlements", () => {
      const csv = exportSettlementsToCSV([], "USD");
      const lines = csv.split("\n");

      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("Date");
    });
  });

  describe("missing member handling", () => {
    it("should show Unknown for missing from_member", () => {
      const settlementNoFrom: SettlementRecord[] = [
        {
          id: "s-1",
          group_id: "group-1",
          from_member_id: "member-1",
          to_member_id: "member-2",
          amount: 50,
          settled_at: "2024-01-15T00:00:00Z",
          created_at: "2024-01-15T00:00:00Z",
          from_member: undefined,
          to_member: mockMembers[1],
        },
      ];

      const csv = exportSettlementsToCSV(settlementNoFrom, "USD");

      expect(csv).toContain("Unknown");
    });

    it("should show Unknown for missing to_member", () => {
      const settlementNoTo: SettlementRecord[] = [
        {
          id: "s-1",
          group_id: "group-1",
          from_member_id: "member-1",
          to_member_id: "member-2",
          amount: 50,
          settled_at: "2024-01-15T00:00:00Z",
          created_at: "2024-01-15T00:00:00Z",
          from_member: mockMembers[0],
          to_member: undefined,
        },
      ];

      const csv = exportSettlementsToCSV(settlementNoTo, "USD");

      expect(csv).toContain("Unknown");
    });
  });
});

describe("exportGroupToCSV", () => {
  describe("group info header", () => {
    it("should include group name", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("# Group: Test Group");
    });

    it("should include export date", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("# Exported:");
    });

    it("should include currency", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("# Currency: USD");
    });

    it("should include share code", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("# Share Code: ABC123");
    });
  });

  describe("sections", () => {
    it("should include Members section", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("## Members");
      expect(csv).toContain("Alice");
      expect(csv).toContain("Bob");
      expect(csv).toContain("Charlie");
    });

    it("should include Expenses section", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("## Expenses");
      expect(csv).toContain("Groceries");
    });

    it("should include Current Balances section", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("## Current Balances");
    });

    it("should include Settlement History section when settlements exist", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("## Settlement History");
    });

    it("should omit Settlement History section when empty", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        [], // No settlements
        mockBalances
      );

      expect(csv).not.toContain("## Settlement History");
    });
  });
});

describe("generateExpenseReport", () => {
  describe("header", () => {
    it("should include group name and emoji", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("🏠");
      expect(report).toContain("Test Group");
      expect(report).toContain("Expense Report");
    });

    it("should include generation date", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Generated:");
    });
  });

  describe("summary statistics", () => {
    it("should include total expenses", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Total Expenses:");
    });

    it("should include number of expenses", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Number of Expenses: 2");
    });

    it("should include member count", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Members: 3");
    });
  });

  describe("balances section", () => {
    it("should include Current Balances header", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Current Balances:");
    });

    it("should show member balances with status", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Alice");
      expect(report).toContain("(is owed)");
      expect(report).toContain("Charlie");
      expect(report).toContain("(owes)");
    });

    it("should show (settled) for zero balance", () => {
      const zeroBalances = new Map<string, number>([
        ["member-1", 0],
        ["member-2", 0],
        ["member-3", 0],
      ]);

      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        zeroBalances
      );

      expect(report).toContain("(settled)");
    });
  });

  describe("recent expenses section", () => {
    it("should include Recent Expenses header when expenses exist", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Recent Expenses:");
    });

    it("should list expense descriptions", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Groceries");
      expect(report).toContain("Dinner");
    });

    it("should not include Recent Expenses when empty", () => {
      const report = generateExpenseReport(
        mockGroup,
        [],
        mockMembers,
        mockBalances
      );

      expect(report).not.toContain("Recent Expenses:");
    });

    it("should show Number of Expenses: 0 for empty expenses", () => {
      const report = generateExpenseReport(
        mockGroup,
        [],
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Number of Expenses: 0");
    });

    it("should limit to 5 most recent expenses", () => {
      const manyExpenses: Expense[] = Array.from({ length: 10 }, (_, i) => ({
        id: `exp-${i}`,
        group_id: "group-1",
        description: `Expense ${i}`,
        amount: 10 * (i + 1),
        paid_by: "member-1",
        created_at: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        payer: mockMembers[0],
      }));

      const report = generateExpenseReport(
        mockGroup,
        manyExpenses,
        mockMembers,
        mockBalances
      );

      // Should only show first 5
      expect(report).toContain("Expense 0");
      expect(report).toContain("Expense 4");
      expect(report).not.toContain("Expense 5");
    });
  });
});

describe("shareCSV", () => {
  const Sharing = require("expo-sharing");

  beforeEach(() => {
    jest.clearAllMocks();
    Sharing.isAvailableAsync.mockResolvedValue(true);
  });

  it("should return true when sharing succeeds", async () => {
    const result = await shareCSV("test,content", "test.csv");

    expect(result).toBe(true);
  });

  it("should add .csv extension if missing", async () => {
    await shareCSV("content", "filename");

    // The File constructor should be called with filename.csv
    const { File } = require("expo-file-system");
    expect(File).toHaveBeenCalled();
  });

  it("should not duplicate .csv extension", async () => {
    await shareCSV("content", "file.csv");

    // Should work without error
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  it("should return false when sharing is unavailable", async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);

    const result = await shareCSV("content", "file.csv");

    expect(result).toBe(false);
  });
});

describe("exportGroup", () => {
  const Sharing = require("expo-sharing");

  beforeEach(() => {
    jest.clearAllMocks();
    Sharing.isAvailableAsync.mockResolvedValue(true);
  });

  it("should generate and share group export", async () => {
    const result = await exportGroup(
      mockGroup,
      mockExpenses,
      mockMembers,
      mockSettlements,
      mockBalances
    );

    expect(result).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  it("should sanitize group name for filename", async () => {
    const groupWithSpecialChars: Group = {
      ...mockGroup,
      name: "Trip/to:Paris?*",
    };

    const result = await exportGroup(
      groupWithSpecialChars,
      mockExpenses,
      mockMembers,
      mockSettlements,
      mockBalances
    );

    expect(result).toBe(true);
  });
});

describe("Edge Cases", () => {
  it("should handle empty group", () => {
    const csv = exportGroupToCSV(
      mockGroup,
      [],
      [],
      [],
      new Map()
    );

    expect(csv).toContain("# Group: Test Group");
    expect(csv).toContain("## Members");
    expect(csv).toContain("## Expenses");
  });

  it("should handle very large amounts", () => {
    const bigExpense: Expense[] = [
      {
        id: "exp-1",
        group_id: "group-1",
        description: "Big Purchase",
        amount: 1000000.99,
        paid_by: "member-1",
        created_at: "2024-01-01T00:00:00Z",
        payer: mockMembers[0],
      },
    ];

    const csv = exportExpensesToCSV(bigExpense, mockMembers, "USD");

    expect(csv).toContain("1000000.99");
  });

  it("should handle unicode in all fields", () => {
    const unicodeGroup: Group = {
      ...mockGroup,
      name: "北京旅行 🇨🇳",
    };

    const unicodeMembers: Member[] = [
      {
        id: "member-1",
        group_id: "group-1",
        name: "李明",
        user_id: null,
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    const csv = exportGroupToCSV(
      unicodeGroup,
      [],
      unicodeMembers,
      [],
      new Map()
    );

    expect(csv).toContain("北京旅行 🇨🇳");
    expect(csv).toContain("李明");
  });
});
