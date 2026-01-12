/**
 * Shareable Settlement Links
 *
 * Generate shareable URLs for group settlements that show
 * amounts owed to each person with integrated payment buttons.
 */

import { supabase } from "./supabase";
import { formatCurrency } from "./utils";
import {
  getVenmoDeepLink,
  getPayPalDeepLink,
  getCashAppDeepLink,
  getVenmoQRCodeUrl,
  PaymentApp,
} from "./payment-links";
import { getVenmoUsernamesForMembers } from "./user-profile";
import logger from "./logger";

// ============================================
// Types
// ============================================

export interface SettlementLinkData {
  id: string;
  groupId: string;
  groupName: string;
  currency: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  shareCode: string;
  settlements: SettlementItem[];
}

export interface SettlementItem {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
  paymentLinks: PaymentLinkInfo[];
}

export interface PaymentLinkInfo {
  app: PaymentApp;
  displayName: string;
  url: string;
  webUrl?: string; // Web-friendly URL for sharing
}

export interface CreateSettlementLinkParams {
  groupId: string;
  createdBy: string;
  settlements: Array<{
    fromMemberId: string;
    toMemberId: string;
    amount: number;
  }>;
  expiresInDays?: number;
}

// ============================================
// Share Code Generation
// ============================================

/**
 * Generate a unique share code for settlement links
 * Similar to receipt share codes, excludes confusing characters
 */
export function generateSettlementShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// Settlement Link CRUD
// ============================================

/**
 * Create a shareable settlement link
 */
export async function createSettlementLink(
  params: CreateSettlementLinkParams
): Promise<SettlementLinkData | null> {
  try {
    // Get group info
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, name, currency")
      .eq("id", params.groupId)
      .single();

    if (groupError || !group) {
      logger.error("Error fetching group:", groupError);
      return null;
    }

    // Get member info
    const memberIds = [
      ...new Set([
        ...params.settlements.map((s) => s.fromMemberId),
        ...params.settlements.map((s) => s.toMemberId),
      ]),
    ];

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, name, clerk_user_id")
      .in("id", memberIds);

    if (membersError) {
      logger.error("Error fetching members:", membersError);
      return null;
    }

    const memberMap = new Map(members?.map((m) => [m.id, m]) || []);

    // Get Venmo usernames for payment links
    const venmoUsernames = await getVenmoUsernamesForMembers(memberIds);

    // Generate share code
    const shareCode = generateSettlementShareCode();

    // Calculate expiration (default 7 days)
    const expiresInDays = params.expiresInDays ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Build settlement items with payment links
    const settlements: SettlementItem[] = params.settlements.map((s) => {
      const fromMember = memberMap.get(s.fromMemberId);
      const toMember = memberMap.get(s.toMemberId);
      const toVenmoUsername = venmoUsernames.get(s.toMemberId);

      const note = `${group.name} - Settlement`;
      const paymentLinks: PaymentLinkInfo[] = [];

      // Add Venmo link if recipient has username
      if (toVenmoUsername) {
        paymentLinks.push({
          app: "venmo",
          displayName: "Venmo",
          url: getVenmoDeepLink(s.amount, note, toVenmoUsername),
          webUrl: getVenmoQRCodeUrl(toVenmoUsername, s.amount, note),
        });
      }

      return {
        fromMemberId: s.fromMemberId,
        fromMemberName: fromMember?.name || "Unknown",
        toMemberId: s.toMemberId,
        toMemberName: toMember?.name || "Unknown",
        amount: s.amount,
        paymentLinks,
      };
    });

    // Store in database
    const { data: link, error: linkError } = await supabase
      .from("settlement_links")
      .insert({
        group_id: params.groupId,
        share_code: shareCode,
        created_by: params.createdBy,
        expires_at: expiresAt.toISOString(),
        settlement_data: JSON.stringify(settlements),
      })
      .select()
      .single();

    if (linkError) {
      logger.error("Error creating settlement link:", linkError);
      return null;
    }

    return {
      id: link.id,
      groupId: params.groupId,
      groupName: group.name,
      currency: group.currency,
      createdBy: params.createdBy,
      createdAt: link.created_at,
      expiresAt: expiresAt.toISOString(),
      shareCode,
      settlements,
    };
  } catch (error) {
    logger.error("Error creating settlement link:", error);
    return null;
  }
}

/**
 * Get a settlement link by share code
 */
export async function getSettlementLinkByCode(
  shareCode: string
): Promise<SettlementLinkData | null> {
  try {
    const { data, error } = await supabase
      .from("settlement_links")
      .select(`
        *,
        group:groups!group_id(id, name, currency)
      `)
      .eq("share_code", shareCode.toUpperCase())
      .single();

    if (error || !data) {
      logger.error("Error fetching settlement link:", error);
      return null;
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return null;
    }

    const settlements = JSON.parse(data.settlement_data) as SettlementItem[];

    return {
      id: data.id,
      groupId: data.group_id,
      groupName: data.group?.name || "Unknown Group",
      currency: data.group?.currency || "USD",
      createdBy: data.created_by,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      shareCode: data.share_code,
      settlements,
    };
  } catch (error) {
    logger.error("Error fetching settlement link:", error);
    return null;
  }
}

/**
 * Delete a settlement link
 */
export async function deleteSettlementLink(linkId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("settlement_links")
      .delete()
      .eq("id", linkId);

    if (error) {
      logger.error("Error deleting settlement link:", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error deleting settlement link:", error);
    return false;
  }
}

// ============================================
// URL Generation
// ============================================

/**
 * Generate the shareable URL for a settlement link
 * This URL should point to a web page or deep link handler
 */
export function getSettlementLinkUrl(shareCode: string): string {
  // This should be your app's URL scheme or web domain
  // For web: https://splitfree.app/settle/{shareCode}
  // For app deep link: splitfree://settle/{shareCode}
  return `https://splitfree.app/settle/${shareCode}`;
}

/**
 * Generate a share message for settlement link
 */
export function getSettlementShareMessage(
  linkData: SettlementLinkData
): string {
  const totalAmount = linkData.settlements.reduce((sum, s) => sum + s.amount, 0);
  const formattedTotal = formatCurrency(totalAmount, linkData.currency);

  const url = getSettlementLinkUrl(linkData.shareCode);

  return `${linkData.groupName} - Settle Up\n\nTotal outstanding: ${formattedTotal}\n\nPay your share here: ${url}`;
}

/**
 * Generate individual settlement message
 */
export function getIndividualSettlementMessage(
  settlement: SettlementItem,
  groupName: string,
  currency: string
): string {
  const amount = formatCurrency(settlement.amount, currency);

  let message = `${groupName} - You owe ${settlement.toMemberName} ${amount}`;

  if (settlement.paymentLinks.length > 0) {
    const venmoLink = settlement.paymentLinks.find((l) => l.app === "venmo");
    if (venmoLink?.webUrl) {
      message += `\n\nPay via Venmo: ${venmoLink.webUrl}`;
    }
  }

  return message;
}

// ============================================
// Summary Generation
// ============================================

/**
 * Generate a text summary of all settlements
 */
export function generateSettlementSummary(
  linkData: SettlementLinkData
): string {
  const lines: string[] = [
    `${linkData.groupName} - Settlement Summary`,
    `Currency: ${linkData.currency}`,
    "",
  ];

  for (const settlement of linkData.settlements) {
    const amount = formatCurrency(settlement.amount, linkData.currency);
    lines.push(`${settlement.fromMemberName} → ${settlement.toMemberName}: ${amount}`);
  }

  const totalAmount = linkData.settlements.reduce((sum, s) => sum + s.amount, 0);
  lines.push("");
  lines.push(`Total: ${formatCurrency(totalAmount, linkData.currency)}`);

  return lines.join("\n");
}

/**
 * Get settlements grouped by debtor (person who owes)
 */
export function getSettlementsByDebtor(
  settlements: SettlementItem[]
): Map<string, SettlementItem[]> {
  const byDebtor = new Map<string, SettlementItem[]>();

  for (const settlement of settlements) {
    const existing = byDebtor.get(settlement.fromMemberId) || [];
    existing.push(settlement);
    byDebtor.set(settlement.fromMemberId, existing);
  }

  return byDebtor;
}

/**
 * Get settlements grouped by creditor (person who is owed)
 */
export function getSettlementsByCreditor(
  settlements: SettlementItem[]
): Map<string, SettlementItem[]> {
  const byCreditor = new Map<string, SettlementItem[]>();

  for (const settlement of settlements) {
    const existing = byCreditor.get(settlement.toMemberId) || [];
    existing.push(settlement);
    byCreditor.set(settlement.toMemberId, existing);
  }

  return byCreditor;
}
