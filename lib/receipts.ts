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
 * Distributes tax, tip, service charges, and discounts proportionally based on items claimed
 * Enhanced for P1: Now includes service charge and discount distribution
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

  // Get regular items (exclude special items and hidden expanded parents)
  const regularItems = items.filter(
    (item) =>
      !item.is_tax &&
      !item.is_tip &&
      !item.is_subtotal &&
      !item.is_total &&
      !item.is_service_charge &&
      item.quantity > 0 // Exclude hidden expanded parents
  );

  // Initialize for all members who have claims
  for (const claim of claims) {
    const item = regularItems.find((i) => i.id === claim.receipt_item_id);
    if (!item) continue;

    // Skip discount items - they're handled separately
    if (item.is_discount) continue;

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

  // Calculate the sum of all claimed items (before discounts)
  const claimedSubtotal = Array.from(memberItemTotals.values()).reduce(
    (sum, data) => sum + data.total,
    0
  );

  // Get amounts
  const taxAmount = receipt.tax_amount || 0;
  const tipAmount = receipt.tip_amount || 0;
  const serviceChargeAmount = receipt.service_charge_amount || 0;
  const discountAmount = receipt.discount_amount || 0; // This is negative

  // Build member totals with proportional distribution
  const totals: ReceiptMemberCalculation[] = [];

  for (const [memberId, data] of memberItemTotals) {
    const member = members.find((m) => m.id === memberId);
    if (!member) continue;

    // Calculate proportional share of all extras
    const proportion = claimedSubtotal > 0 ? data.total / claimedSubtotal : 0;
    const taxShare = roundCurrency(taxAmount * proportion);
    const tipShare = roundCurrency(tipAmount * proportion);
    const serviceChargeShare = roundCurrency(serviceChargeAmount * proportion);
    const discountShare = roundCurrency(discountAmount * proportion); // Negative

    // Grand total = items + tax + tip + service charge + discount (negative)
    const grandTotal = roundCurrency(
      data.total + taxShare + tipShare + serviceChargeShare + discountShare
    );

    totals.push({
      memberId,
      memberName: member.name,
      itemsTotal: roundCurrency(data.total),
      taxShare: taxShare + serviceChargeShare, // Combine for simpler display
      tipShare,
      grandTotal,
      claimedItems: data.items,
    });
  }

  // Handle rounding discrepancy - add/subtract from person with highest total
  if (totals.length > 0) {
    const calculatedTotal = totals.reduce((sum, t) => sum + t.grandTotal, 0);
    const expectedTotal =
      receipt.total_amount ||
      claimedSubtotal + taxAmount + tipAmount + serviceChargeAmount + discountAmount;
    const discrepancy = roundCurrency(expectedTotal - calculatedTotal);

    if (Math.abs(discrepancy) > 0 && Math.abs(discrepancy) < 0.1) {
      // Sort by grand total descending
      totals.sort((a, b) => b.grandTotal - a.grandTotal);
      totals[0].grandTotal = roundCurrency(totals[0].grandTotal + discrepancy);
    }
  }

  return totals;
}

// ============================================
// P0/P1 ENHANCED UTILITIES
// ============================================

/**
 * Check if an item can be expanded into individual units
 * P0: Multi-quantity item expansion
 */
export function canExpandItem(item: ReceiptItem): boolean {
  const quantity = item.original_quantity || item.quantity;
  return (
    quantity > 1 &&
    !item.is_expansion &&
    !item.is_tax &&
    !item.is_tip &&
    !item.is_discount &&
    !item.is_service_charge
  );
}

/**
 * Check if an item is a hidden parent of expanded items
 */
export function isHiddenExpandedParent(item: ReceiptItem): boolean {
  return item.quantity === 0 && (item.original_quantity || 0) > 1;
}

/**
 * Get the display quantity for an item (handles expanded parents)
 */
export function getDisplayQuantity(item: ReceiptItem): number {
  if (isHiddenExpandedParent(item)) {
    return item.original_quantity || 0;
  }
  return item.quantity;
}

/**
 * Group items with their modifiers for display
 * P1: Modifier grouping
 */
export function groupItemsWithModifiers(items: ReceiptItem[]): Array<{
  mainItem: ReceiptItem;
  modifiers: ReceiptItem[];
  totalPrice: number;
}> {
  const grouped: Array<{
    mainItem: ReceiptItem;
    modifiers: ReceiptItem[];
    totalPrice: number;
  }> = [];

  // Get main items (not modifiers, not hidden)
  const mainItems = items.filter(
    (item) =>
      !item.is_modifier &&
      !item.is_tax &&
      !item.is_tip &&
      !item.is_subtotal &&
      !item.is_total &&
      !item.is_service_charge &&
      item.quantity > 0
  );

  // Get modifiers
  const modifiers = items.filter((item) => item.is_modifier);

  for (const mainItem of mainItems) {
    const itemModifiers = modifiers.filter(
      (mod) => mod.parent_item_id === mainItem.id
    );
    const totalPrice =
      mainItem.total_price +
      itemModifiers.reduce((sum, mod) => sum + mod.total_price, 0);

    grouped.push({
      mainItem,
      modifiers: itemModifiers,
      totalPrice,
    });
  }

  return grouped;
}

/**
 * Get items that should be split (shared items and service charges)
 * These are distributed proportionally
 */
export function getDistributedItems(
  items: ReceiptItem[]
): { serviceCharges: ReceiptItem[]; sharedItems: ReceiptItem[] } {
  return {
    serviceCharges: items.filter((item) => item.is_service_charge),
    sharedItems: items.filter((item) => item.is_likely_shared && !item.is_service_charge),
  };
}

/**
 * Calculate the fair share of a discount for a specific claim amount
 * P1: Discount attribution
 */
export function calculateDiscountShare(
  totalDiscount: number, // Negative value
  memberItemTotal: number,
  totalClaimedAmount: number
): number {
  if (totalClaimedAmount === 0) return 0;
  const proportion = memberItemTotal / totalClaimedAmount;
  return roundCurrency(totalDiscount * proportion);
}

/**
 * Get item-specific discount if any
 */
export function getItemDiscount(
  item: ReceiptItem,
  allItems: ReceiptItem[]
): ReceiptItem | null {
  return (
    allItems.find(
      (discount) => discount.is_discount && discount.applies_to_item_id === item.id
    ) || null
  );
}

/**
 * Format service charge type for display
 */
export function formatServiceChargeType(type: ServiceChargeType | null | undefined): string {
  switch (type) {
    case 'gratuity':
      return 'Auto-Gratuity';
    case 'delivery':
      return 'Delivery Fee';
    case 'convenience':
      return 'Convenience Fee';
    case 'other':
    default:
      return 'Service Charge';
  }
}

/**
 * Check if a receipt has any expandable multi-quantity items
 */
export function hasExpandableItems(items: ReceiptItem[]): boolean {
  return items.some((item) => canExpandItem(item));
}

/**
 * Check if a receipt has any shared items that might benefit from splitting
 */
export function hasSharedItems(items: ReceiptItem[]): boolean {
  return items.some((item) => item.is_likely_shared && item.quantity > 0);
}

/**
 * Get the effective price for an item after modifiers
 */
export function getItemEffectivePrice(
  item: ReceiptItem,
  allItems: ReceiptItem[]
): number {
  if (item.is_modifier) {
    // Modifier price is already included in total
    return item.total_price;
  }

  // Add modifier prices
  const modifiers = allItems.filter((mod) => mod.parent_item_id === item.id);
  return item.total_price + modifiers.reduce((sum, mod) => sum + mod.total_price, 0);
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
