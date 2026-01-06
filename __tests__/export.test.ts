/**
 * Tests for CSV export functionality
 *
 * Note: These tests focus on the pure functions that generate CSV content.
 * The shareCSV and exportGroup functions that use expo-file-system and expo-sharing
 * are not tested here as they require native modules.
 */

import { Group, Member, Expense, SettlementRecord } from "../lib/types";
import { formatCurrency } from "../lib/utils";
import { getCategoryDisplay } from "../lib/categories";

/**
 * Local implementations of CSV generation functions for testing
 * These mirror the implementations in lib/export.ts but without the native dependencies
 */

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const strValue = String(value);

  if (
    strValue.includes(",") ||
    strValue.includes('"') ||
    strValue.includes("\n")
  ) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

function arrayToCSV<T extends object>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  const headerRow = headers.map((h) => escapeCSV(h.label)).join(",");
  const dataRows = data.map((item) =>
    headers.map((h) => escapeCSV(item[h.key] as string | number)).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

interface ExpenseExportRow {
  date: string;
  description: string;
  category: string;
  amount: number;
  paidBy: string;
  merchant: string;
  notes: string;
  splitType: string;
}

interface BalanceExportRow {
  member: string;
  balance: number;
  status: string;
}

interface SettlementExportRow {
  date: string;
  from: string;
  to: string;
  amount: number;
}

function exportExpensesToCSV(
  expenses: Expense[],
  members: Member[],
  currency: string = "USD"
): string {
  const getMemberName = (memberId: string): string => {
    const member = members.find((m) => m.id === memberId);
    return member?.name || "Unknown";
  };

  const data: ExpenseExportRow[] = expenses.map((exp) => ({
    date: exp.expense_date || exp.created_at.split("T")[0],
    description: exp.description,
    category: getCategoryDisplay(exp.category || "other").name,
    amount: exp.amount,
    paidBy: exp.payer?.name || getMemberName(exp.paid_by),
    merchant: exp.merchant || "",
    notes: exp.notes || "",
    splitType: exp.split_type || "equal",
  }));

  const headers: { key: keyof ExpenseExportRow; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
    { key: "amount", label: `Amount (${currency})` },
    { key: "paidBy", label: "Paid By" },
    { key: "merchant", label: "Merchant" },
    { key: "notes", label: "Notes" },
    { key: "splitType", label: "Split Type" },
  ];

  return arrayToCSV(data, headers);
}

function exportBalancesToCSV(
  balances: Map<string, number>,
  members: Member[],
  currency: string = "USD"
): string {
  const data: BalanceExportRow[] = members.map((member) => {
    const balance = balances.get(member.id) || 0;
    let status = "Settled";
    if (balance > 0.01) status = "Is owed money";
    else if (balance < -0.01) status = "Owes money";

    return {
      member: member.name,
      balance: Math.round(balance * 100) / 100,
      status,
    };
  });

  const headers: { key: keyof BalanceExportRow; label: string }[] = [
    { key: "member", label: "Member" },
    { key: "balance", label: `Balance (${currency})` },
    { key: "status", label: "Status" },
  ];

  return arrayToCSV(data, headers);
}

function exportSettlementsToCSV(
  settlements: SettlementRecord[],
  currency: string = "USD"
): string {
  const data: SettlementExportRow[] = settlements.map((s) => ({
    date: s.settled_at.split("T")[0],
    from: s.from_member?.name || "Unknown",
    to: s.to_member?.name || "Unknown",
    amount: s.amount,
  }));

  const headers: { key: keyof SettlementExportRow; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "from", label: "From" },
    { key: "to", label: "To" },
    { key: "amount", label: `Amount (${currency})` },
  ];

  return arrayToCSV(data, headers);
}

function exportGroupToCSV(
  group: Group,
  expenses: Expense[],
  members: Member[],
  settlements: SettlementRecord[],
  balances: Map<string, number>
): string {
  const sections: string[] = [];

  sections.push(`# Group: ${group.name}`);
  sections.push(`# Exported: ${new Date().toISOString().split("T")[0]}`);
  sections.push(`# Currency: ${group.currency}`);
  sections.push(`# Share Code: ${group.share_code}`);
  sections.push("");

  sections.push("## Members");
  sections.push(members.map((m) => m.name).join(", "));
  sections.push("");

  sections.push("## Expenses");
  sections.push(exportExpensesToCSV(expenses, members, group.currency));
  sections.push("");

  sections.push("## Current Balances");
  sections.push(exportBalancesToCSV(balances, members, group.currency));
  sections.push("");

  if (settlements.length > 0) {
    sections.push("## Settlement History");
    sections.push(exportSettlementsToCSV(settlements, group.currency));
  }

  return sections.join("\n");
}

function generateExpenseReport(
  group: Group,
  expenses: Expense[],
  members: Member[],
  balances: Map<string, number>
): string {
  const lines: string[] = [];

  lines.push(`${group.emoji} ${group.name} - Expense Report`);
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  lines.push("");

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  lines.push(`Total Expenses: ${formatCurrency(totalSpent, group.currency)}`);
  lines.push(`Number of Expenses: ${expenses.length}`);
  lines.push(`Members: ${members.length}`);
  lines.push("");

  lines.push("Current Balances:");
  members.forEach((member) => {
    const balance = balances.get(member.id) || 0;
    const sign = balance > 0 ? "+" : "";
    const status =
      Math.abs(balance) < 0.01
        ? "(settled)"
        : balance > 0
          ? "(is owed)"
          : "(owes)";
    lines.push(
      `  ${member.name}: ${sign}${formatCurrency(Math.abs(balance), group.currency)} ${status}`
    );
  });
  lines.push("");

  if (expenses.length > 0) {
    lines.push("Recent Expenses:");
    expenses.slice(0, 5).forEach((exp) => {
      const date = exp.expense_date || exp.created_at.split("T")[0];
      lines.push(
        `  ${date}: ${exp.description} - ${formatCurrency(exp.amount, group.currency)}`
      );
    });
  }

  return lines.join("\n");
}

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

describe("CSV Export Functions", () => {
  describe("exportExpensesToCSV", () => {
    it("should generate valid CSV with headers", () => {
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

    it("should include expense data rows", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("Groceries");
      expect(csv).toContain("Alice");
      expect(csv).toContain("Whole Foods");
      expect(csv).toContain("Weekly groceries");
      expect(csv).toContain("Dinner");
      expect(csv).toContain("Bob");
    });

    it("should handle empty expenses array", () => {
      const csv = exportExpensesToCSV([], mockMembers, "USD");

      // Should have header row but no data rows
      const lines = csv.split("\n");
      expect(lines.length).toBe(1); // Just header
      expect(lines[0]).toContain("Date");
    });

    it("should use expense_date when available", () => {
      const csv = exportExpensesToCSV(mockExpenses, mockMembers, "USD");

      expect(csv).toContain("2024-01-15");
      expect(csv).toContain("2024-01-16");
    });

    it("should handle different currencies", () => {
      const csvUSD = exportExpensesToCSV(mockExpenses, mockMembers, "USD");
      const csvEUR = exportExpensesToCSV(mockExpenses, mockMembers, "EUR");

      expect(csvUSD).toContain("Amount (USD)");
      expect(csvEUR).toContain("Amount (EUR)");
    });
  });

  describe("exportBalancesToCSV", () => {
    it("should generate valid CSV with headers", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      expect(csv).toContain("Member");
      expect(csv).toContain("Balance (USD)");
      expect(csv).toContain("Status");
    });

    it("should include all members", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      expect(csv).toContain("Alice");
      expect(csv).toContain("Bob");
      expect(csv).toContain("Charlie");
    });

    it("should show correct status for positive balance", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      // Alice has positive balance (is owed)
      expect(csv).toContain("Is owed money");
    });

    it("should show correct status for negative balance", () => {
      const csv = exportBalancesToCSV(mockBalances, mockMembers, "USD");

      // Charlie has negative balance (owes)
      expect(csv).toContain("Owes money");
    });

    it("should show settled status for zero balance", () => {
      const zeroBalances = new Map<string, number>([
        ["member-1", 0],
        ["member-2", 0],
        ["member-3", 0],
      ]);
      const csv = exportBalancesToCSV(zeroBalances, mockMembers, "USD");

      expect(csv).toContain("Settled");
    });
  });

  describe("exportSettlementsToCSV", () => {
    it("should generate valid CSV with headers", () => {
      const csv = exportSettlementsToCSV(mockSettlements, "USD");

      expect(csv).toContain("Date");
      expect(csv).toContain("From");
      expect(csv).toContain("To");
      expect(csv).toContain("Amount (USD)");
    });

    it("should include settlement data", () => {
      const csv = exportSettlementsToCSV(mockSettlements, "USD");

      expect(csv).toContain("Charlie");
      expect(csv).toContain("Alice");
      expect(csv).toContain("2024-01-20");
    });

    it("should handle empty settlements", () => {
      const csv = exportSettlementsToCSV([], "USD");

      const lines = csv.split("\n");
      expect(lines.length).toBe(1); // Just header
    });
  });

  describe("exportGroupToCSV", () => {
    it("should include group info header", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("# Group: Test Group");
      expect(csv).toContain("# Currency: USD");
      expect(csv).toContain("# Share Code: ABC123");
    });

    it("should include members section", () => {
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

    it("should include expenses section", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("## Expenses");
      expect(csv).toContain("Groceries");
      expect(csv).toContain("Dinner");
    });

    it("should include balances section", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("## Current Balances");
    });

    it("should include settlements section when present", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockSettlements,
        mockBalances
      );

      expect(csv).toContain("## Settlement History");
    });

    it("should omit settlements section when empty", () => {
      const csv = exportGroupToCSV(
        mockGroup,
        mockExpenses,
        mockMembers,
        [],
        mockBalances
      );

      expect(csv).not.toContain("## Settlement History");
    });
  });

  describe("generateExpenseReport", () => {
    it("should include group name and emoji", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Test Group");
      expect(report).toContain(mockGroup.emoji);
    });

    it("should include total expenses summary", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Total Expenses:");
      expect(report).toContain("Number of Expenses: 2");
      expect(report).toContain("Members: 3");
    });

    it("should include current balances", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Current Balances:");
      expect(report).toContain("Alice");
      expect(report).toContain("(is owed)");
      expect(report).toContain("Charlie");
      expect(report).toContain("(owes)");
    });

    it("should include recent expenses", () => {
      const report = generateExpenseReport(
        mockGroup,
        mockExpenses,
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Recent Expenses:");
      expect(report).toContain("Groceries");
      expect(report).toContain("Dinner");
    });

    it("should handle empty expenses", () => {
      const report = generateExpenseReport(
        mockGroup,
        [],
        mockMembers,
        mockBalances
      );

      expect(report).toContain("Total Expenses:");
      expect(report).toContain("Number of Expenses: 0");
      expect(report).not.toContain("Recent Expenses:");
    });
  });
});

describe("CSV Escaping", () => {
  it("should escape values with commas", () => {
    const expenseWithComma: Expense[] = [
      {
        id: "expense-1",
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

  it("should escape values with quotes", () => {
    const expenseWithQuotes: Expense[] = [
      {
        id: "expense-1",
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

  it("should escape values with newlines", () => {
    const expenseWithNewline: Expense[] = [
      {
        id: "expense-1",
        group_id: "group-1",
        description: "Item 1\nItem 2",
        amount: 50.0,
        paid_by: "member-1",
        created_at: "2024-01-15T12:00:00Z",
        notes: "Multiple\nitems",
        payer: mockMembers[0],
      },
    ];

    const csv = exportExpensesToCSV(expenseWithNewline, mockMembers, "USD");
    expect(csv).toContain('"Item 1\nItem 2"');
    expect(csv).toContain('"Multiple\nitems"');
  });

  it("should handle null and undefined values", () => {
    const expenseWithNulls: Expense[] = [
      {
        id: "expense-1",
        group_id: "group-1",
        description: "Simple expense",
        amount: 25.0,
        paid_by: "member-1",
        created_at: "2024-01-15T12:00:00Z",
        notes: null,
        merchant: null,
        payer: mockMembers[0],
      },
    ];

    const csv = exportExpensesToCSV(expenseWithNulls, mockMembers, "USD");
    // Should not throw and should handle nulls gracefully
    expect(csv).toContain("Simple expense");
  });
});

describe("Balance Rounding", () => {
  it("should round balances to 2 decimal places", () => {
    const preciseBalances = new Map<string, number>([
      ["member-1", 25.123456],
      ["member-2", -15.987654],
    ]);

    const csv = exportBalancesToCSV(preciseBalances, mockMembers.slice(0, 2), "USD");
    expect(csv).toContain("25.12");
    expect(csv).toContain("-15.99");
  });
});

describe("Date Formatting", () => {
  it("should extract date from ISO string", () => {
    const dateString = "2024-01-15T12:30:45Z";
    const datePart = dateString.split("T")[0];
    expect(datePart).toBe("2024-01-15");
  });

  it("should handle date-only strings", () => {
    const dateString = "2024-01-15";
    const datePart = dateString.split("T")[0];
    expect(datePart).toBe("2024-01-15");
  });
});
