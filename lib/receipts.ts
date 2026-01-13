/**
 * Receipt Scanning Utilities
 *
 * This module provides utilities for processing receipts,
 * calculating member totals based on item claims, and
 * generating payment links.
 */

import {
  Receipt,
  ReceiptItem,
  ItemClaim,
  Member,
  ReceiptMemberCalculation,
  ReceiptSummary,
  ClaimSource,
  ServiceChargeType,
} from './types';

/**
 * Round to 2 decimal places for currency
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Generate a unique share code for receipt web sharing
 */
export function generateReceiptShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculate the total claimed amount for an item
 */
export function getItemClaimedAmount(item: ReceiptItem): number {
  if (!item.claims || item.claims.length === 0) return 0;

  return item.claims.reduce((sum, claim) => {
    return sum + item.total_price * claim.share_fraction;
  }, 0);
}

/**
 * Check if an item is fully claimed (100% of it is assigned)
 * Uses a tolerance of 0.002 to handle floating point rounding (e.g., 3-way splits, 0.999 edge cases)
 */
export function isItemFullyClaimed(item: ReceiptItem): boolean {
  if (!item.claims || item.claims.length === 0) return false;

  const totalFraction = item.claims.reduce(
    (sum, claim) => sum + claim.share_fraction,
    0
  );

  // Use tolerance of 0.002 to handle JS floating point issues
  // (e.g., 1 - 0.999 = 0.0010000000000000009, not exactly 0.001)
  return Math.abs(totalFraction - 1) < 0.002;
}

/**
 * Get the remaining fraction of an item that can still be claimed
 */
export function getItemRemainingFraction(item: ReceiptItem): number {
  if (!item.claims || item.claims.length === 0) return 1;

  const claimedFraction = item.claims.reduce(
    (sum, claim) => sum + claim.share_fraction,
    0
  );

  return Math.max(0, 1 - claimedFraction);
}

/**
 * Calculate each member's total based on their claimed items
 * Distributes tax and tip proportionally based on items claimed
 */
export function calculateMemberTotals(
  receipt: Receipt,
  items: ReceiptItem[],
  claims: ItemClaim[],
  members: Member[]
): ReceiptMemberCalculation[] {
  // Build a map of item claims by member
  const memberItemTotals = new Map<
    string,
    {
      total: number;
      items: Array<{
        itemId: string;
        description: string;
        amount: number;
        shareFraction: number;
      }>;
    }
  >();

  // Initialize for all members who have claims
  for (const claim of claims) {
    const item = items.find((i) => i.id === claim.receipt_item_id);
    if (!item || item.is_tax || item.is_tip || item.is_subtotal || item.is_total) {
      continue;
    }

    const claimAmount = roundCurrency(item.total_price * claim.share_fraction);

    if (!memberItemTotals.has(claim.member_id)) {
      memberItemTotals.set(claim.member_id, { total: 0, items: [] });
    }

    const memberData = memberItemTotals.get(claim.member_id)!;
    memberData.total += claimAmount;
    memberData.items.push({
      itemId: item.id,
      description: item.description,
      amount: claimAmount,
      shareFraction: claim.share_fraction,
    });
  }

  // Calculate the sum of all claimed items
  const claimedSubtotal = Array.from(memberItemTotals.values()).reduce(
    (sum, data) => sum + data.total,
    0
  );

  // Get tax and tip amounts
  const taxAmount = receipt.tax_amount || 0;
  const tipAmount = receipt.tip_amount || 0;

  // Build member totals with proportional tax/tip
  const totals: ReceiptMemberCalculation[] = [];

  for (const [memberId, data] of memberItemTotals) {
    const member = members.find((m) => m.id === memberId);
    if (!member) continue;

    // Calculate proportional share of tax and tip
    const proportion = claimedSubtotal > 0 ? data.total / claimedSubtotal : 0;
    const taxShare = roundCurrency(taxAmount * proportion);
    const tipShare = roundCurrency(tipAmount * proportion);
    const grandTotal = roundCurrency(data.total + taxShare + tipShare);

    totals.push({
      memberId,
      memberName: member.name,
      itemsTotal: roundCurrency(data.total),
      taxShare,
      tipShare,
      grandTotal,
      claimedItems: data.items,
    });
  }

  // Handle rounding discrepancy - add/subtract from person with highest total
  if (totals.length > 0) {
    const calculatedTotal = totals.reduce((sum, t) => sum + t.grandTotal, 0);
    const expectedTotal =
      receipt.total_amount || claimedSubtotal + taxAmount + tipAmount;
    const discrepancy = roundCurrency(expectedTotal - calculatedTotal);

    if (Math.abs(discrepancy) > 0 && Math.abs(discrepancy) < 0.1) {
      // Sort by grand total descending
      totals.sort((a, b) => b.grandTotal - a.grandTotal);
      totals[0].grandTotal = roundCurrency(totals[0].grandTotal + discrepancy);
    }
  }

  return totals;
}

/**
 * Generate a receipt summary with claim statistics
 */
export function generateReceiptSummary(
  receipt: Receipt,
  items: ReceiptItem[],
  claims: ItemClaim[],
  members: Member[]
): ReceiptSummary {
  // Filter to only regular items (not tax/tip/subtotal/total)
  const regularItems = items.filter(
    (item) =>
      !item.is_tax && !item.is_tip && !item.is_subtotal && !item.is_total && !item.is_discount
  );

  // Count claimed items
  const itemClaimMap = new Map<string, number>();
  for (const claim of claims) {
    const current = itemClaimMap.get(claim.receipt_item_id) || 0;
    itemClaimMap.set(claim.receipt_item_id, current + claim.share_fraction);
  }

  let claimedCount = 0;
  let unclaimedCount = 0;

  for (const item of regularItems) {
    const claimedFraction = itemClaimMap.get(item.id) || 0;
    if (claimedFraction >= 0.99) {
      claimedCount++;
    } else {
      unclaimedCount++;
    }
  }

  // Calculate subtotal from items
  const calculatedSubtotal = regularItems.reduce(
    (sum, item) => sum + item.total_price,
    0
  );

  const memberTotals = calculateMemberTotals(receipt, items, claims, members);

  return {
    receiptId: receipt.id,
    merchantName: receipt.merchant_name || undefined,
    receiptDate: receipt.receipt_date || undefined,
    itemCount: regularItems.length,
    claimedItemCount: claimedCount,
    unclaimedItemCount: unclaimedCount,
    subtotal: receipt.subtotal || calculatedSubtotal,
    tax: receipt.tax_amount || 0,
    tip: receipt.tip_amount || 0,
    total:
      receipt.total_amount ||
      calculatedSubtotal + (receipt.tax_amount || 0) + (receipt.tip_amount || 0),
    memberTotals,
  };
}

/**
 * Generate Venmo payment link
 */
export function generateVenmoLink(
  username: string,
  amount: number,
  note: string
): string {
  const encodedNote = encodeURIComponent(note);
  return `venmo://paycharge?txn=pay&recipients=${username}&amount=${amount.toFixed(2)}&note=${encodedNote}`;
}

/**
 * Generate PayPal.me payment link
 */
export function generatePayPalLink(username: string, amount: number): string {
  return `https://paypal.me/${username}/${amount.toFixed(2)}`;
}

/**
 * Generate Cash App payment link
 */
export function generateCashAppLink(cashtag: string, amount: number): string {
  // Remove $ prefix if present
  const tag = cashtag.startsWith('$') ? cashtag.slice(1) : cashtag;
  return `https://cash.app/$${tag}/${amount.toFixed(2)}`;
}

/**
 * Generate all payment links for a member's total
 */
export function generatePaymentLinks(
  amount: number,
  payeeInfo: {
    venmoUsername?: string;
    paypalUsername?: string;
    cashAppTag?: string;
  },
  note: string
): Array<{ provider: string; url: string; displayName: string }> {
  const links: Array<{ provider: string; url: string; displayName: string }> = [];

  if (payeeInfo.venmoUsername) {
    links.push({
      provider: 'venmo',
      url: generateVenmoLink(payeeInfo.venmoUsername, amount, note),
      displayName: 'Venmo',
    });
  }

  if (payeeInfo.paypalUsername) {
    links.push({
      provider: 'paypal',
      url: generatePayPalLink(payeeInfo.paypalUsername, amount),
      displayName: 'PayPal',
    });
  }

  if (payeeInfo.cashAppTag) {
    links.push({
      provider: 'cashapp',
      url: generateCashAppLink(payeeInfo.cashAppTag, amount),
      displayName: 'Cash App',
    });
  }

  return links;
}

/**
 * Format a claim for display
 */
export function formatClaimDescription(
  item: ReceiptItem,
  claim: ItemClaim
): string {
  if (claim.share_fraction === 1) {
    return item.description;
  }

  if (claim.split_count > 1) {
    return `${item.description} (1/${claim.split_count})`;
  }

  const percentage = Math.round(claim.share_fraction * 100);
  return `${item.description} (${percentage}%)`;
}

/**
 * Validate if all items are claimed before settling
 */
export function validateAllItemsClaimed(
  items: ReceiptItem[],
  claims: ItemClaim[]
): { isValid: boolean; unclaimedItems: ReceiptItem[] } {
  const regularItems = items.filter(
    (item) =>
      !item.is_tax && !item.is_tip && !item.is_subtotal && !item.is_total && !item.is_discount
  );

  const unclaimedItems: ReceiptItem[] = [];

  for (const item of regularItems) {
    const itemClaims = claims.filter((c) => c.receipt_item_id === item.id);
    const totalFraction = itemClaims.reduce((sum, c) => sum + c.share_fraction, 0);

    if (totalFraction < 0.99) {
      unclaimedItems.push(item);
    }
  }

  return {
    isValid: unclaimedItems.length === 0,
    unclaimedItems,
  };
}

/**
 * Create initial claim for an item
 *
 * @param itemId - The receipt item ID
 * @param memberId - The member ID claiming the item
 * @param options - Options for the claim
 * @param options.splitCount - Number of ways to split (calculates shareFraction as 1/splitCount)
 * @param options.shareFraction - Explicit share fraction (overrides splitCount calculation)
 * @param options.maxFraction - Maximum allowed fraction (used to prevent over-claiming)
 * @param options.claimedVia - Source of the claim (app, web, imessage, assigned)
 */
export function createClaim(
  itemId: string,
  memberId: string,
  options: {
    splitCount?: number;
    shareFraction?: number;
    maxFraction?: number;
    claimedVia?: ClaimSource;
  } = {}
): Omit<ItemClaim, 'id' | 'claimed_at' | 'share_amount' | 'member' | 'receipt_item'> {
  const splitCount = options.splitCount || 1;
  let shareFraction = options.shareFraction ?? 1 / splitCount;

  // If maxFraction is provided, cap the share fraction to prevent over-claiming
  if (options.maxFraction !== undefined && shareFraction > options.maxFraction) {
    shareFraction = options.maxFraction;
  }

  // Determine claim type based on final share fraction
  const claimType = shareFraction < 1 ? 'split' : 'full';

  return {
    receipt_item_id: itemId,
    member_id: memberId,
    claim_type: claimType,
    share_fraction: shareFraction,
    split_count: splitCount,
    claimed_via: options.claimedVia || 'app',
  };
}

/**
 * Determine if a member can claim more of an item
 */
export function canClaimItem(
  item: ReceiptItem,
  memberId: string
): { canClaim: boolean; reason?: string; remainingFraction?: number } {
  // Check if item is a special item (tax, tip, subtotal, total, or discount)
  if (item.is_tax || item.is_tip || item.is_subtotal || item.is_total || item.is_discount) {
    return { canClaim: false, reason: 'This item cannot be claimed' };
  }

  // Check if member already claimed this item fully (check this first for better UX)
  const memberClaim = item.claims?.find((c) => c.member_id === memberId);
  if (memberClaim && memberClaim.share_fraction >= 1) {
    return { canClaim: false, reason: 'You already claimed this item' };
  }

  // Check if fully claimed by others
  if (isItemFullyClaimed(item)) {
    return { canClaim: false, reason: 'Item is fully claimed' };
  }

  // Return remaining fraction for informational purposes
  const remainingFraction = getItemRemainingFraction(item);
  return { canClaim: true, remainingFraction };
}

/**
 * Parse receipt date string into a Date object
 */
export function parseReceiptDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  // Try YYYY-MM-DD format first (parse as local time, not UTC)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }

  // Try MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try generic Date parsing as fallback
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  return null;
}

/**
 * Format receipt date for display
 */
export function formatReceiptDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown date';

  const dateObj = typeof date === 'string' ? parseReceiptDate(date) : date;
  if (!dateObj) return 'Unknown date';

  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format currency amount for display
 */
export function formatReceiptAmount(
  amount: number,
  currency: string = 'USD'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Get claim status text for an item
 */
export function getItemClaimStatus(item: ReceiptItem): string {
  if (!item.claims || item.claims.length === 0) {
    return 'Unclaimed';
  }

  const totalFraction = item.claims.reduce((sum, c) => sum + c.share_fraction, 0);

  if (totalFraction >= 0.99) {
    if (item.claims.length === 1) {
      return `Claimed by ${item.claims[0].member?.name || 'someone'}`;
    }
    return `Split ${item.claims.length} ways`;
  }

  const percentage = Math.round(totalFraction * 100);
  return `${percentage}% claimed`;
}
