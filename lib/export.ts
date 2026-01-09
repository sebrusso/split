/**
 * CSV Export utilities for SplitFree
 * Uses React Native Share API for sharing files
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { Group, Member, Expense, SettlementRecord } from "./types";
import { formatCurrency, calculateBalances } from "./utils";
import { getCategoryDisplay } from "./categories";
import { supabase } from "./supabase";

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
      console.log("CSV Content:", content);
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
    console.error("Error sharing CSV:", error);
    Alert.alert(
      "Export Failed",
      "Could not export the file. Please try again.",
      [{ text: "OK" }]
    );
    return false;
  }
}

/**
 * Quick export function for a group
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

    // Fetch all expenses for these groups
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*, payer:members!paid_by(id, name)")
      .in("group_id", groupIds)
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
    sections.push("# SplitFree Data Export");
    sections.push(`# Exported: ${new Date().toISOString()}`);
    sections.push(`# Total Groups: ${groups?.length || 0}`);
    sections.push(`# Total Expenses: ${expenses?.length || 0}`);
    sections.push("");

    // For each group, add a section
    for (const group of groups || []) {
      const groupMembers = (members || []).filter((m) => m.group_id === group.id);
      const groupExpenses = (expenses || []).filter((e) => e.group_id === group.id);
      const groupSettlements = (settlements || []).filter((s) => s.group_id === group.id);

      // Calculate balances
      const balances = calculateBalances(groupExpenses, groupMembers);

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
    console.error("Export all data error:", error);
    Alert.alert("Export Failed", "Could not export your data. Please try again.");
    return false;
  }
}
