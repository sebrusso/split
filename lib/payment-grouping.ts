/**
 * Smart Payment Grouping
 *
 * Aggregates small debts to the same person across multiple groups
 * into a single combined payment for efficiency.
 */

import { UserGlobalBalance, PersonBalance } from './balances';
import { getVenmoUsernameForMember } from './user-profile';
import { supabase } from './supabase';
import logger from './logger';

/**
 * A debt that can be grouped with others
 */
export interface GroupableDebt {
  groupId: string;
  groupName: string;
  amount: number;
}

/**
 * A grouped payment combining multiple debts to the same person
 */
export interface GroupedPayment {
  /** The person you owe money to */
  recipientName: string;
  /** Their Venmo username (if available) */
  recipientVenmo: string | null;
  /** Member ID of recipient (for the first group - used to look up Venmo) */
  recipientMemberId: string | null;
  /** Total amount across all groups */
  totalAmount: number;
  /** Breakdown of individual debts by group */
  debts: GroupableDebt[];
  /** Whether this is a combined payment (multiple debts) */
  isCombined: boolean;
  /** Suggested payment note for Venmo */
  suggestedNote: string;
}

/**
 * Default threshold for grouping small payments (in dollars)
 * Payments under this amount to the same person will be grouped
 */
export const DEFAULT_GROUPING_THRESHOLD = 50;

/**
 * Group debts to the same person across multiple groups
 *
 * @param globalBalances - User's global balance data from getGlobalBalancesForUser
 * @param threshold - Group individual debts under this amount (default $50)
 * @returns Array of grouped payments
 */
export function groupPaymentsByRecipient(
  globalBalances: UserGlobalBalance,
  threshold: number = DEFAULT_GROUPING_THRESHOLD
): GroupedPayment[] {
  const grouped: GroupedPayment[] = [];

  // Process each person the user owes money to
  for (const person of globalBalances.people) {
    // Skip if they owe us money (positive balance means they owe us)
    if (person.netBalance >= 0) continue;

    const amountOwed = Math.abs(person.netBalance);

    // Get individual debts (only groups where we owe them)
    const debtsToThisPerson = person.groups
      .filter(g => g.balance < 0)
      .map(g => ({
        groupId: g.groupId,
        groupName: g.groupName,
        amount: Math.abs(g.balance),
      }));

    // Determine if this should be a combined payment
    // Combine if: multiple debts AND total is meaningful (> $1)
    const isCombined = debtsToThisPerson.length > 1 && amountOwed > 1;

    // Build suggested note
    let suggestedNote: string;
    if (isCombined) {
      // Show breakdown in note
      const breakdown = debtsToThisPerson
        .map(d => `${d.groupName}: $${d.amount.toFixed(2)}`)
        .join(' + ');
      suggestedNote = `SplitFree - ${breakdown}`;
    } else if (debtsToThisPerson.length === 1) {
      suggestedNote = `SplitFree - ${debtsToThisPerson[0].groupName}`;
    } else {
      suggestedNote = 'SplitFree payment';
    }

    // Truncate note if too long for Venmo
    if (suggestedNote.length > 200) {
      suggestedNote = suggestedNote.substring(0, 197) + '...';
    }

    grouped.push({
      recipientName: person.name,
      recipientVenmo: null, // Will be populated later
      recipientMemberId: null, // Will be populated later
      totalAmount: amountOwed,
      debts: debtsToThisPerson,
      isCombined,
      suggestedNote,
    });
  }

  // Sort by total amount (largest first)
  grouped.sort((a, b) => b.totalAmount - a.totalAmount);

  return grouped;
}

/**
 * Enrich grouped payments with Venmo usernames
 * Looks up Venmo username for each recipient
 *
 * @param payments - Grouped payments to enrich
 * @param clerkUserId - Current user's Clerk ID (to find member mappings)
 * @returns Payments with Venmo usernames populated
 */
export async function enrichWithVenmoUsernames(
  payments: GroupedPayment[],
  clerkUserId: string
): Promise<GroupedPayment[]> {
  try {
    // For each payment, we need to find a member ID for the recipient
    // We'll look in the first group where we owe them
    for (const payment of payments) {
      if (payment.debts.length === 0) continue;

      const firstDebt = payment.debts[0];

      // Find the member in this group with this name
      const { data: members } = await supabase
        .from('members')
        .select('id, name, clerk_user_id')
        .eq('group_id', firstDebt.groupId)
        .ilike('name', payment.recipientName);

      if (members && members.length > 0) {
        // Find the one that's not us
        const recipient = members.find(m => m.clerk_user_id !== clerkUserId) || members[0];
        payment.recipientMemberId = recipient.id;

        // Get their Venmo username
        const venmoUsername = await getVenmoUsernameForMember(recipient.id);
        payment.recipientVenmo = venmoUsername;
      }
    }

    return payments;
  } catch (error) {
    logger.error('Error enriching payments with Venmo usernames:', error);
    return payments;
  }
}

/**
 * Get grouped payments for a user with Venmo info
 * Convenience function that combines grouping and enrichment
 *
 * @param globalBalances - User's global balance data
 * @param clerkUserId - Current user's Clerk ID
 * @param threshold - Grouping threshold in dollars
 * @returns Enriched grouped payments
 */
export async function getGroupedPaymentsWithVenmo(
  globalBalances: UserGlobalBalance,
  clerkUserId: string,
  threshold: number = DEFAULT_GROUPING_THRESHOLD
): Promise<GroupedPayment[]> {
  const grouped = groupPaymentsByRecipient(globalBalances, threshold);
  return enrichWithVenmoUsernames(grouped, clerkUserId);
}

/**
 * Check if any payments can be grouped
 * Quick check to determine if showing grouping option makes sense
 *
 * @param globalBalances - User's global balance data
 * @returns True if there are multiple debts to the same person
 */
export function hasGroupablePayments(globalBalances: UserGlobalBalance): boolean {
  return globalBalances.people.some(person => {
    // Only check people we owe money to
    if (person.netBalance >= 0) return false;

    // Check if they appear in multiple groups
    const debtsToThem = person.groups.filter(g => g.balance < 0);
    return debtsToThem.length > 1;
  });
}

/**
 * Calculate potential savings from grouping
 * (In terms of number of transactions saved)
 *
 * @param globalBalances - User's global balance data
 * @returns Number of transactions saved by grouping
 */
export function calculateGroupingSavings(globalBalances: UserGlobalBalance): {
  withoutGrouping: number;
  withGrouping: number;
  transactionsSaved: number;
} {
  let totalDebts = 0;
  let uniqueRecipients = 0;

  for (const person of globalBalances.people) {
    if (person.netBalance >= 0) continue; // Skip people who owe us

    const debtsToThem = person.groups.filter(g => g.balance < 0);
    totalDebts += debtsToThem.length;

    if (debtsToThem.length > 0) {
      uniqueRecipients++;
    }
  }

  return {
    withoutGrouping: totalDebts,
    withGrouping: uniqueRecipients,
    transactionsSaved: totalDebts - uniqueRecipients,
  };
}
