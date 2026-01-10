// Test comment for /ship command

import * as Crypto from "expo-crypto";

// ============================================
// Error Handling
// ============================================

/**
 * Result type for async operations that can fail
 */
export interface AsyncResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Wraps an async operation with consistent error handling.
 * Use this for Supabase operations and other async tasks.
 *
 * @example
 * const result = await handleAsync(async () => {
 *   const { data, error } = await supabase.from('groups').select('*');
 *   if (error) throw error;
 *   return data;
 * }, 'Failed to load groups');
 */
export async function handleAsync<T>(
  operation: () => Promise<T>,
  errorMessage: string = "An error occurred",
): Promise<AsyncResult<T>> {
  try {
    const data = await operation();
    return { data, error: null };
  } catch (error) {
    if (__DEV__) {
      console.error(errorMessage, error);
    }
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { data: null, error: `${errorMessage}: ${message}` };
  }
}

/**
 * Extracts a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unexpected error occurred";
}

// ============================================
// Validation
// ============================================

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validates an amount value for expenses/settlements
 *
 * @param amount - The amount string or number to validate
 * @param options - Validation options
 * @returns ValidationResult with isValid flag and error message if invalid
 */
export function validateAmount(
  amount: string | number,
  options: { min?: number; max?: number; allowZero?: boolean } = {},
): ValidationResult {
  const { min = 0.01, max = 999999.99, allowZero = false } = options;

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return { isValid: false, error: "Please enter a valid amount" };
  }

  if (!allowZero && numAmount === 0) {
    return { isValid: false, error: "Amount cannot be zero" };
  }

  if (numAmount < 0) {
    return { isValid: false, error: "Amount cannot be negative" };
  }

  if (numAmount < min) {
    return { isValid: false, error: `Amount must be at least ${formatCurrency(min)}` };
  }

  if (numAmount > max) {
    return { isValid: false, error: `Amount cannot exceed ${formatCurrency(max)}` };
  }

  return { isValid: true, error: null };
}

/**
 * Validates a name string (for groups, members, expenses)
 *
 * @param name - The name to validate
 * @param options - Validation options
 * @returns ValidationResult with isValid flag and error message if invalid
 */
export function validateName(
  name: string,
  options: { minLength?: number; maxLength?: number; fieldName?: string } = {},
): ValidationResult {
  const {
    minLength = 1,
    maxLength = 100,
    fieldName = "Name",
  } = options;

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (trimmedName.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} character${minLength > 1 ? "s" : ""}`,
    };
  }

  if (trimmedName.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} cannot exceed ${maxLength} characters`,
    };
  }

  return { isValid: true, error: null };
}

// ============================================
// Code Generation
// ============================================

/**
 * Generate a cryptographically secure share code
 * Uses expo-crypto for secure random number generation
 * Increased to 8 characters for better security against brute force
 */
export async function generateShareCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomBytes = await Crypto.getRandomBytesAsync(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

/**
 * Synchronous fallback for share code generation
 * Uses Math.random - only use when async is not possible
 * @deprecated Prefer generateShareCode() for security
 */
export function generateShareCodeSync(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatCurrency(
  amount: number,
  currency: string = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function calculateBalances(
  expenses: Array<{
    paid_by: string;
    amount: number;
    splits: Array<{ member_id: string; amount: number }>;
  }>,
  members: Array<{ id: string; name: string }>,
): Map<string, number> {
  const balances = new Map<string, number>();

  // Initialize all members with 0 balance
  members.forEach((m) => balances.set(m.id, 0));

  expenses.forEach((exp) => {
    // Payer gets credited full amount
    const currentPayerBalance = balances.get(exp.paid_by) || 0;
    balances.set(exp.paid_by, currentPayerBalance + exp.amount);

    // Each person in split gets debited their share
    exp.splits.forEach((split) => {
      const currentBalance = balances.get(split.member_id) || 0;
      balances.set(split.member_id, currentBalance - split.amount);
    });
  });

  return balances;
}

export function calculateBalancesWithSettlements(
  expenses: Array<{
    paid_by: string;
    amount: number;
    splits: Array<{ member_id: string; amount: number }>;
  }>,
  settlements: Array<{
    from_member_id: string;
    to_member_id: string;
    amount: number;
  }>,
  members: Array<{ id: string; name: string }>,
): Map<string, number> {
  // Start with expense-based balances
  const balances = calculateBalances(expenses, members);

  // Apply settlements: when A pays B, A's debt decreases and B's credit decreases
  settlements.forEach((settlement) => {
    const fromBalance = balances.get(settlement.from_member_id) || 0;
    const toBalance = balances.get(settlement.to_member_id) || 0;

    // from_member paid money, so their balance increases (less debt / more credit)
    balances.set(settlement.from_member_id, fromBalance + settlement.amount);
    // to_member received money, so their balance decreases (less credit / more debt)
    balances.set(settlement.to_member_id, toBalance - settlement.amount);
  });

  return balances;
}

export function simplifyDebts(
  balances: Map<string, number>,
  members: Array<{ id: string; name: string }>,
): Array<{ from: string; to: string; amount: number }> {
  const settlements: Array<{ from: string; to: string; amount: number }> = [];

  // Separate debtors and creditors
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  balances.forEach((balance, memberId) => {
    if (balance < -0.01) {
      debtors.push({ id: memberId, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ id: memberId, amount: balance });
    }
  });

  // Sort by amount (descending)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Match debtors with creditors
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debt = debtors[i];
    const credit = creditors[j];
    const amount = Math.min(debt.amount, credit.amount);

    if (amount > 0.01) {
      settlements.push({
        from: debt.id,
        to: credit.id,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debt.amount -= amount;
    credit.amount -= amount;

    if (debt.amount < 0.01) i++;
    if (credit.amount < 0.01) j++;
  }

  return settlements;
}
