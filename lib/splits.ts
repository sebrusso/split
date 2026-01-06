/**
 * Split calculation functions for different split methods
 */

import { Split, Member } from "./types";

export type SplitMethod = "equal" | "exact" | "percent" | "shares";

export interface SplitInput {
  memberId: string;
  value: number; // For exact: dollar amount, percent: percentage, shares: share count
}

/**
 * Calculate equal split among selected members
 * @param amount Total expense amount
 * @param memberIds Array of member IDs to split between
 * @returns Array of split objects with calculated amounts
 */
export function calculateEqualSplit(
  amount: number,
  memberIds: string[]
): Array<{ member_id: string; amount: number }> {
  if (memberIds.length === 0) {
    return [];
  }

  const perPerson = amount / memberIds.length;
  const roundedAmount = Math.round(perPerson * 100) / 100;

  // Handle rounding errors by adjusting the last person's split
  const splits = memberIds.map((memberId, index) => ({
    member_id: memberId,
    amount: roundedAmount,
  }));

  // Calculate total and adjust for rounding errors
  const total = splits.reduce((sum, s) => sum + s.amount, 0);
  const diff = Math.round((amount - total) * 100) / 100;

  if (diff !== 0 && splits.length > 0) {
    splits[splits.length - 1].amount =
      Math.round((splits[splits.length - 1].amount + diff) * 100) / 100;
  }

  return splits;
}

/**
 * Calculate exact amounts split (user specifies exact dollar amounts)
 * @param amounts Map of memberId to exact dollar amount
 * @returns Array of split objects
 */
export function calculateExactSplit(
  amounts: Record<string, number>
): Array<{ member_id: string; amount: number }> {
  return Object.entries(amounts)
    .filter(([_, amount]) => amount > 0)
    .map(([memberId, amount]) => ({
      member_id: memberId,
      amount: Math.round(amount * 100) / 100,
    }));
}

/**
 * Calculate percentage split (user specifies percentages for each member)
 * @param amount Total expense amount
 * @param percents Map of memberId to percentage (should sum to 100)
 * @returns Array of split objects with calculated amounts
 */
export function calculatePercentSplit(
  amount: number,
  percents: Record<string, number>
): Array<{ member_id: string; amount: number }> {
  const entries = Object.entries(percents).filter(([_, percent]) => percent > 0);

  const splits = entries.map(([memberId, percent]) => ({
    member_id: memberId,
    amount: Math.round((amount * percent) / 100 * 100) / 100,
  }));

  // Handle rounding errors
  const total = splits.reduce((sum, s) => sum + s.amount, 0);
  const diff = Math.round((amount - total) * 100) / 100;

  if (diff !== 0 && splits.length > 0) {
    splits[splits.length - 1].amount =
      Math.round((splits[splits.length - 1].amount + diff) * 100) / 100;
  }

  return splits;
}

/**
 * Calculate shares split (user specifies share count for each member)
 * @param amount Total expense amount
 * @param shares Map of memberId to number of shares
 * @returns Array of split objects with calculated amounts proportionally
 */
export function calculateSharesSplit(
  amount: number,
  shares: Record<string, number>
): Array<{ member_id: string; amount: number }> {
  const entries = Object.entries(shares).filter(([_, shareCount]) => shareCount > 0);
  const totalShares = entries.reduce((sum, [_, shareCount]) => sum + shareCount, 0);

  if (totalShares === 0) {
    return [];
  }

  const splits = entries.map(([memberId, shareCount]) => ({
    member_id: memberId,
    amount: Math.round((amount * shareCount) / totalShares * 100) / 100,
  }));

  // Handle rounding errors
  const total = splits.reduce((sum, s) => sum + s.amount, 0);
  const diff = Math.round((amount - total) * 100) / 100;

  if (diff !== 0 && splits.length > 0) {
    splits[splits.length - 1].amount =
      Math.round((splits[splits.length - 1].amount + diff) * 100) / 100;
  }

  return splits;
}

/**
 * Calculate splits based on method
 * @param method The split method to use
 * @param amount Total expense amount
 * @param data Split data based on method
 * @returns Array of split objects
 */
export function calculateSplits(
  method: SplitMethod,
  amount: number,
  data: {
    memberIds?: string[];
    amounts?: Record<string, number>;
    percents?: Record<string, number>;
    shares?: Record<string, number>;
  }
): Array<{ member_id: string; amount: number }> {
  switch (method) {
    case "equal":
      return calculateEqualSplit(amount, data.memberIds || []);
    case "exact":
      return calculateExactSplit(data.amounts || {});
    case "percent":
      return calculatePercentSplit(amount, data.percents || {});
    case "shares":
      return calculateSharesSplit(amount, data.shares || {});
    default:
      return [];
  }
}

/**
 * Validate split data based on method
 * @param method The split method
 * @param amount Total expense amount
 * @param data Split data
 * @returns Validation result with isValid and error message
 */
export function validateSplitData(
  method: SplitMethod,
  amount: number,
  data: {
    memberIds?: string[];
    amounts?: Record<string, number>;
    percents?: Record<string, number>;
    shares?: Record<string, number>;
  }
): { isValid: boolean; error: string | null } {
  switch (method) {
    case "equal": {
      if (!data.memberIds || data.memberIds.length === 0) {
        return { isValid: false, error: "Please select at least one person to split with" };
      }
      return { isValid: true, error: null };
    }

    case "exact": {
      if (!data.amounts) {
        return { isValid: false, error: "Please enter amounts for each person" };
      }
      const total = Object.values(data.amounts).reduce((sum, val) => sum + (val || 0), 0);
      const roundedTotal = Math.round(total * 100) / 100;
      const roundedAmount = Math.round(amount * 100) / 100;
      if (Math.abs(roundedTotal - roundedAmount) > 0.01) {
        return {
          isValid: false,
          error: `Amounts must add up to $${amount.toFixed(2)} (currently $${total.toFixed(2)})`,
        };
      }
      return { isValid: true, error: null };
    }

    case "percent": {
      if (!data.percents) {
        return { isValid: false, error: "Please enter percentages for each person" };
      }
      const totalPercent = Object.values(data.percents).reduce((sum, val) => sum + (val || 0), 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        return {
          isValid: false,
          error: `Percentages must add up to 100% (currently ${totalPercent.toFixed(1)}%)`,
        };
      }
      return { isValid: true, error: null };
    }

    case "shares": {
      if (!data.shares) {
        return { isValid: false, error: "Please enter shares for each person" };
      }
      const totalShares = Object.values(data.shares).reduce((sum, val) => sum + (val || 0), 0);
      if (totalShares === 0) {
        return { isValid: false, error: "Please assign at least one share" };
      }
      return { isValid: true, error: null };
    }

    default:
      return { isValid: false, error: "Invalid split method" };
  }
}

/**
 * Get display name for split method
 */
export function getSplitMethodLabel(method: SplitMethod): string {
  switch (method) {
    case "equal":
      return "Split Equally";
    case "exact":
      return "Exact Amounts";
    case "percent":
      return "By Percentage";
    case "shares":
      return "By Shares";
    default:
      return "Unknown";
  }
}

/**
 * Get description for split method
 */
export function getSplitMethodDescription(method: SplitMethod): string {
  switch (method) {
    case "equal":
      return "Everyone pays the same amount";
    case "exact":
      return "Enter specific amounts for each person";
    case "percent":
      return "Split by percentage (must total 100%)";
    case "shares":
      return "Split by shares (e.g., 1x, 2x)";
    default:
      return "";
  }
}

/**
 * Get icon for split method
 */
export function getSplitMethodIcon(method: SplitMethod): string {
  switch (method) {
    case "equal":
      return "=";
    case "exact":
      return "$";
    case "percent":
      return "%";
    case "shares":
      return "#";
    default:
      return "?";
  }
}
