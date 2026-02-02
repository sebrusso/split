/**
 * CSV Export utilities for split it.
 * Uses React Native Share API for sharing files
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { Alert } from "react-native";
import { Group, Member, Expense, SettlementRecord } from "./types";
import { formatCurrency, calculateBalances } from "./utils";
import { getCategoryDisplay } from "./categories";
import { supabase } from "./supabase";
import { logger } from "./logger";

/**
 * Escape a value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const strValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (
    strValue.includes(",") ||
    strValue.includes('"') ||
    strValue.includes("\n")
  ) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV<T extends object>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  // Header row
  const headerRow = headers.map((h) => escapeCSV(h.label)).join(",");

  // Data rows
  const dataRows = data.map((item) =>
    headers.map((h) => escapeCSV(item[h.key] as string | number)).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Export interface for expense row
 */
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

/**
 * Export interface for balance row
 */
interface BalanceExportRow {
  member: string;
  balance: number;
  status: string;
}

/**
 * Export interface for settlement row
 */
interface SettlementExportRow {
  date: string;
  from: string;
  to: string;
  amount: number;
}

/**
 * Generate CSV content for a group's expenses
 */
export function exportExpensesToCSV(
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

/**
 * Generate CSV content for balances
 */
export function exportBalancesToCSV(
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

/**
 * Generate CSV content for settlement history
 */
export function exportSettlementsToCSV(
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

/**
 * Generate a complete group export with all data
 */
export function exportGroupToCSV(
  group: Group,
  expenses: Expense[],
  members: Member[],
  settlements: SettlementRecord[],
  balances: Map<string, number>
): string {
  const sections: string[] = [];

  // Group info header
  sections.push(`# Group: ${group.name}`);
  sections.push(`# Exported: ${new Date().toISOString().split("T")[0]}`);
  sections.push(`# Currency: ${group.currency}`);
  sections.push(`# Share Code: ${group.share_code}`);
  sections.push("");

  // Members section
  sections.push("## Members");
  sections.push(members.map((m) => m.name).join(", "));
  sections.push("");

  // Expenses section
  sections.push("## Expenses");
  sections.push(exportExpensesToCSV(expenses, members, group.currency));
  sections.push("");

  // Balances section
  sections.push("## Current Balances");
  sections.push(exportBalancesToCSV(balances, members, group.currency));
  sections.push("");

  // Settlements section
  if (settlements.length > 0) {
    sections.push("## Settlement History");
    sections.push(exportSettlementsToCSV(settlements, group.currency));
  }

  return sections.join("\n");
}

/**
 * Save CSV content to a file and share it
 * Uses expo-file-system and expo-sharing
 */
export async function shareCSV(
  content: string,
  filename: string
): Promise<boolean> {
  try {
    // Ensure filename has .csv extension
    const fullFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      Alert.alert(
        "Sharing Unavailable",
        "Sharing is not available on this device. The CSV content has been logged to console.",
        [{ text: "OK" }]
      );
      logger.debug("CSV Content:", content);
      return false;
    }

    // Write to temporary file using new File API
    const file = new File(Paths.cache, fullFilename);
    await file.write(content);

    // Share the file
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      dialogTitle: `Export ${fullFilename}`,
      UTI: "public.comma-separated-values-text",
    });

    // Clean up temp file after a delay
    setTimeout(async () => {
      try {
        if (file.exists) {
          await file.delete();
        }
      } catch {
        // Ignore cleanup errors
      }
    }, 60000); // Clean up after 1 minute

    return true;
  } catch (error) {
    logger.error("Error sharing CSV:", error);
    Alert.alert(
      "Export Failed",
      "Could not export the file. Please try again.",
      [{ text: "OK" }]
    );
    return false;
  }
}

/**
 * Quick export function for a group (CSV format)
 */
export async function exportGroup(
  group: Group,
  expenses: Expense[],
  members: Member[],
  settlements: SettlementRecord[],
  balances: Map<string, number>
): Promise<boolean> {
  const content = exportGroupToCSV(group, expenses, members, settlements, balances);
  const filename = `${group.name.replace(/[^a-zA-Z0-9]/g, "_")}_export_${new Date().toISOString().split("T")[0]}.csv`;
  return shareCSV(content, filename);
}

// ============================================
// PDF Export Functions
// ============================================

/**
 * Generate HTML content for PDF export
 */
function generatePDFHTML(
  group: Group,
  expenses: Expense[],
  members: Member[],
  settlements: SettlementRecord[],
  balances: Map<string, number>
): string {
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const getMemberName = (memberId: string): string => {
    const member = members.find((m) => m.id === memberId);
    return member?.name || "Unknown";
  };

  // Generate balances table rows
  const balanceRows = members.map((member) => {
    const balance = balances.get(member.id) || 0;
    const statusClass = balance > 0.01 ? "positive" : balance < -0.01 ? "negative" : "settled";
    const statusText = balance > 0.01 ? "is owed" : balance < -0.01 ? "owes" : "settled";
    return `
      <tr>
        <td>${member.name}</td>
        <td class="${statusClass}">${formatCurrency(Math.abs(balance), group.currency)}</td>
        <td class="${statusClass}">${statusText}</td>
      </tr>
    `;
  }).join("");

  // Generate expenses table rows (most recent 20)
  const expenseRows = expenses.slice(0, 20).map((exp) => {
    const date = exp.expense_date || exp.created_at.split("T")[0];
    return `
      <tr>
        <td>${date}</td>
        <td>${exp.description}</td>
        <td>${formatCurrency(exp.amount, group.currency)}</td>
        <td>${exp.payer?.name || getMemberName(exp.paid_by)}</td>
      </tr>
    `;
  }).join("");

  // Generate settlements table rows
  const settlementRows = settlements.map((s) => {
    const date = s.settled_at.split("T")[0];
    return `
      <tr>
        <td>${date}</td>
        <td>${s.from_member?.name || "Unknown"}</td>
        <td>${s.to_member?.name || "Unknown"}</td>
        <td>${formatCurrency(s.amount, group.currency)}</td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${group.emoji} ${group.name} - Expense Report</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #1F2937;
          line-height: 1.5;
        }
        h1 {
          color: #3B82F6;
          font-size: 28px;
          margin-bottom: 8px;
        }
        h2 {
          color: #475569;
          font-size: 18px;
          margin-top: 32px;
          margin-bottom: 16px;
          border-bottom: 2px solid #E2E8F0;
          padding-bottom: 8px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 14px;
          margin-bottom: 24px;
        }
        .summary-grid {
          display: flex;
          gap: 24px;
          margin-bottom: 32px;
        }
        .summary-card {
          background: #F8FAFC;
          border-radius: 8px;
          padding: 16px 24px;
          flex: 1;
        }
        .summary-label {
          color: #6B7280;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .summary-value {
          font-size: 24px;
          font-weight: 700;
          color: #3B82F6;
          margin-top: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th {
          background: #F1F5F9;
          text-align: left;
          padding: 12px;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748B;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #E2E8F0;
        }
        .positive { color: #3B82F6; }
        .negative { color: #64748B; }
        .settled { color: #94A3B8; }
        .footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #E2E8F0;
          color: #94A3B8;
          font-size: 12px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <h1>${group.emoji} ${group.name}</h1>
      <p class="subtitle">Expense Report - Generated ${new Date().toLocaleDateString()}</p>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Total Expenses</div>
          <div class="summary-value">${formatCurrency(totalSpent, group.currency)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Number of Expenses</div>
          <div class="summary-value">${expenses.length}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Members</div>
          <div class="summary-value">${members.length}</div>
        </div>
      </div>

      <h2>Current Balances</h2>
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${balanceRows}
        </tbody>
      </table>

      <h2>Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Paid By</th>
          </tr>
        </thead>
        <tbody>
          ${expenseRows}
        </tbody>
      </table>
      ${expenses.length > 20 ? `<p style="color: #6B7280; font-style: italic;">Showing 20 of ${expenses.length} expenses</p>` : ""}

      ${settlements.length > 0 ? `
        <h2>Settlement History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${settlementRows}
          </tbody>
        </table>
      ` : ""}

      <div class="footer">
        Generated by split it. - 100% free expense splitting
      </div>
    </body>
    </html>
  `;
}

/**
 * Export group data as PDF
 */
export async function exportGroupAsPDF(
  group: Group,
  expenses: Expense[],
  members: Member[],
  settlements: SettlementRecord[],
  balances: Map<string, number>
): Promise<boolean> {
  try {
    const html = generatePDFHTML(group, expenses, members, settlements, balances);

    // Generate PDF from HTML
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert(
        "Sharing Unavailable",
        "Sharing is not available on this device."
      );
      return false;
    }

    // Share the PDF file
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Export ${group.name}`,
      UTI: "com.adobe.pdf",
    });

    return true;
  } catch (error) {
    logger.error("Error exporting PDF:", error);
    Alert.alert(
      "Export Failed",
      "Could not generate the PDF. Please try again."
    );
    return false;
  }
}

/**
 * Export type for user selection
 */
export type ExportFormat = "csv" | "pdf";

/**
 * Export group data in the specified format
 */
export async function exportGroupWithFormat(
  format: ExportFormat,
  group: Group,
  expenses: Expense[],
  members: Member[],
  settlements: SettlementRecord[],
  balances: Map<string, number>
): Promise<boolean> {
  if (format === "pdf") {
    return exportGroupAsPDF(group, expenses, members, settlements, balances);
  }
  return exportGroup(group, expenses, members, settlements, balances);
}

/**
 * Generate a simple expense report as formatted text
 * Useful for quick sharing via messaging apps
 */
export function generateExpenseReport(
  group: Group,
  expenses: Expense[],
  members: Member[],
  balances: Map<string, number>
): string {
  const lines: string[] = [];

  lines.push(`${group.emoji} ${group.name} - Expense Report`);
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  lines.push("");

  // Summary
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  lines.push(`Total Expenses: ${formatCurrency(totalSpent, group.currency)}`);
  lines.push(`Number of Expenses: ${expenses.length}`);
  lines.push(`Members: ${members.length}`);
  lines.push("");

  // Balances
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

  // Recent expenses (last 5)
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

/**
 * Export all user data across all groups
 * Fetches all groups the user is a member of and exports everything
 */
export async function exportAllUserData(userId: string): Promise<boolean> {
  try {
    // Get all groups where user is a member
    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("group_id")
      .eq("clerk_user_id", userId);

    if (memberError) throw memberError;

    const groupIds = (memberData || []).map((m) => m.group_id);

    if (groupIds.length === 0) {
      Alert.alert("No Data", "You don't have any groups to export.");
      return false;
    }

    // Fetch all groups
    const { data: groups, error: groupsError } = await supabase
      .from("groups")
      .select("*")
      .in("id", groupIds);

    if (groupsError) throw groupsError;

    // Fetch all members for these groups
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("*")
      .in("group_id", groupIds);

    if (membersError) throw membersError;

    // Fetch all expenses for these groups (including currency fields)
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*, currency, exchange_rate, payer:members!paid_by(id, name), splits(member_id, amount)")
      .in("group_id", groupIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (expensesError) throw expensesError;

    // Fetch all settlements for these groups
    const { data: settlements, error: settlementsError } = await supabase
      .from("settlements")
      .select("*, from_member:members!from_member_id(id, name), to_member:members!to_member_id(id, name)")
      .in("group_id", groupIds);

    if (settlementsError) throw settlementsError;

    // Generate combined CSV
    const sections: string[] = [];
    sections.push("# split it. Data Export");
    sections.push(`# Exported: ${new Date().toISOString()}`);
    sections.push(`# Total Groups: ${groups?.length || 0}`);
    sections.push(`# Total Expenses: ${expenses?.length || 0}`);
    sections.push("");

    // For each group, add a section
    for (const group of groups || []) {
      const groupMembers = (members || []).filter((m) => m.group_id === group.id);
      const groupExpenses = (expenses || []).filter((e) => e.group_id === group.id);
      const groupSettlements = (settlements || []).filter((s) => s.group_id === group.id);

      // Calculate balances (including multi-currency support)
      const expensesForCalc = groupExpenses.map((exp) => ({
        paid_by: exp.paid_by,
        amount: parseFloat(String(exp.amount)),
        splits: (exp.splits || []).map((s: { member_id: string; amount: number }) => ({
          member_id: s.member_id,
          amount: parseFloat(String(s.amount)),
        })),
        currency: exp.currency,
        exchange_rate: exp.exchange_rate,
      }));
      const balances = calculateBalances(expensesForCalc, groupMembers, group?.currency || "USD");

      sections.push(`## ${group.emoji} ${group.name}`);
      sections.push(`Currency: ${group.currency}`);
      sections.push(`Members: ${groupMembers.map((m) => m.name).join(", ")}`);
      sections.push("");

      if (groupExpenses.length > 0) {
        sections.push("### Expenses");
        sections.push(exportExpensesToCSV(groupExpenses, groupMembers, group.currency));
        sections.push("");
      }

      sections.push("### Balances");
      sections.push(exportBalancesToCSV(balances, groupMembers, group.currency));
      sections.push("");

      if (groupSettlements.length > 0) {
        sections.push("### Settlements");
        sections.push(exportSettlementsToCSV(groupSettlements, group.currency));
        sections.push("");
      }
    }

    const content = sections.join("\n");
    const filename = `splitfree_full_export_${new Date().toISOString().split("T")[0]}.csv`;

    return shareCSV(content, filename);
  } catch (error) {
    logger.error("Export all data error:", error);
    Alert.alert("Export Failed", "Could not export your data. Please try again.");
    return false;
  }
}
