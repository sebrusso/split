/**
 * Global balance calculation utilities
 * Calculates balances across all groups and friends
 */

import { supabase } from "./supabase";
import { Group, Member } from "./types";
import { calculateBalancesWithSettlements, simplifyDebts } from "./utils";

/**
 * Member balance within a specific group
 */
export interface MemberBalance {
  member: Member;
  balance: number; // Positive = owed, Negative = owes
}

/**
 * Group-level balance summary
 */
export interface GroupBalance {
  group: Group;
  balance: number; // Net balance for the user in this group
  totalOwed: number; // Total owed to user in this group
  totalOwing: number; // Total user owes in this group
  members: MemberBalance[];
  memberCount: number;
  expenseCount: number;
}

/**
 * Friend-level balance (aggregate across all groups)
 */
export interface FriendBalance {
  member: Member;
  balance: number; // Net balance with this friend
  groups: { group: Group; balance: number }[];
}

/**
 * Global balance overview
 */
export interface GlobalBalance {
  totalOwed: number; // Total amount others owe you (across all groups)
  totalOwing: number; // Total amount you owe others (across all groups)
  netBalance: number; // totalOwed - totalOwing
  byGroup: GroupBalance[];
  byFriend: FriendBalance[];
}

/**
 * Expense breakdown item
 */
export interface ExpenseBreakdownItem {
  expenseId: string;
  description: string;
  amount: number;
  date: string;
  groupName: string;
  groupId: string;
  youPaid: number;
  yourShare: number;
  netEffect: number;
}

/**
 * Get balances for a specific group
 */
export async function getGroupBalances(groupId: string): Promise<GroupBalance | null> {
  try {
    // Fetch group
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError || !group) return null;

    // Fetch members
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", groupId);

    if (membersError) throw membersError;

    // Fetch expenses with splits
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("id, paid_by, amount, splits(member_id, amount)")
      .eq("group_id", groupId)
      .is("deleted_at", null);

    if (expensesError) throw expensesError;

    // Fetch settlements
    const { data: settlements, error: settlementsError } = await supabase
      .from("settlements")
      .select("from_member_id, to_member_id, amount")
      .eq("group_id", groupId);

    if (settlementsError) throw settlementsError;

    // Prepare data for calculation
    const expensesForCalc = (expenses || []).map((exp) => ({
      paid_by: exp.paid_by,
      amount: parseFloat(String(exp.amount)),
      splits: (exp.splits || []).map((s: { member_id: string; amount: number }) => ({
        member_id: s.member_id,
        amount: parseFloat(String(s.amount)),
      })),
    }));

    const settlementsForCalc = (settlements || []).map((s) => ({
      from_member_id: s.from_member_id,
      to_member_id: s.to_member_id,
      amount: parseFloat(String(s.amount)),
    }));

    // Calculate balances
    const balances = calculateBalancesWithSettlements(
      expensesForCalc,
      settlementsForCalc,
      members || []
    );

    // Build member balances
    const memberBalances: MemberBalance[] = (members || []).map((member) => ({
      member,
      balance: balances.get(member.id) || 0,
    }));

    // Calculate totals
    let totalOwed = 0;
    let totalOwing = 0;
    balances.forEach((balance) => {
      if (balance > 0) totalOwed += balance;
      else if (balance < 0) totalOwing += Math.abs(balance);
    });

    // Net balance for the group is 0 by definition (debts cancel out)
    // But we track individual positions
    const netBalance = totalOwed - totalOwing;

    return {
      group,
      balance: netBalance,
      totalOwed,
      totalOwing,
      members: memberBalances,
      memberCount: members?.length || 0,
      expenseCount: expenses?.length || 0,
    };
  } catch (error) {
    console.error("getGroupBalances error:", error);
    return null;
  }
}

/**
 * Get global balances across all groups
 * Note: This requires knowing which member in each group represents the current user
 */
export async function getGlobalBalances(userId?: string): Promise<GlobalBalance> {
  try {
    // Fetch all groups
    const { data: groups, error: groupsError } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (groupsError) throw groupsError;

    const groupBalances: GroupBalance[] = [];
    const friendMap = new Map<string, { member: Member; groups: { group: Group; balance: number }[] }>();

    // Process each group
    for (const group of groups || []) {
      const groupBalance = await getGroupBalances(group.id);
      if (groupBalance) {
        groupBalances.push(groupBalance);

        // Aggregate friend balances
        groupBalance.members.forEach(({ member, balance }) => {
          // Skip if this is the user's own member entry (if we know who they are)
          if (userId && member.user_id === userId) return;

          const existing = friendMap.get(member.name.toLowerCase());
          if (existing) {
            existing.groups.push({ group, balance });
          } else {
            friendMap.set(member.name.toLowerCase(), {
              member,
              groups: [{ group, balance }],
            });
          }
        });
      }
    }

    // Calculate friend balances
    const friendBalances: FriendBalance[] = [];
    friendMap.forEach(({ member, groups }) => {
      const totalBalance = groups.reduce((sum, g) => sum + g.balance, 0);
      friendBalances.push({
        member,
        balance: totalBalance,
        groups,
      });
    });

    // Sort friends by absolute balance (most significant first)
    friendBalances.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    // Calculate global totals
    let totalOwed = 0;
    let totalOwing = 0;

    groupBalances.forEach((gb) => {
      totalOwed += gb.totalOwed;
      totalOwing += gb.totalOwing;
    });

    return {
      totalOwed,
      totalOwing,
      netBalance: totalOwed - totalOwing,
      byGroup: groupBalances,
      byFriend: friendBalances,
    };
  } catch (error) {
    console.error("getGlobalBalances error:", error);
    return {
      totalOwed: 0,
      totalOwing: 0,
      netBalance: 0,
      byGroup: [],
      byFriend: [],
    };
  }
}

/**
 * Get detailed expense breakdown between you and a friend
 */
export async function getExpenseBreakdown(
  userId: string,
  friendMemberId?: string
): Promise<ExpenseBreakdownItem[]> {
  try {
    // Fetch all expenses with splits and group info
    let query = supabase
      .from("expenses")
      .select(`
        id,
        description,
        amount,
        expense_date,
        created_at,
        paid_by,
        group:groups!group_id(id, name),
        splits(member_id, amount)
      `)
      .is("deleted_at", null)
      .order("expense_date", { ascending: false });

    const { data: expenses, error } = await query.limit(100);

    if (error) throw error;

    const breakdown: ExpenseBreakdownItem[] = [];

    (expenses || []).forEach((exp) => {
      const group = exp.group as unknown as { id: string; name: string };
      if (!group) return;

      // Find user's split and what they paid
      const splits = exp.splits || [];

      // If filtering by friend, only include expenses where both user and friend are involved
      if (friendMemberId) {
        const friendSplit = splits.find(
          (s: { member_id: string }) => s.member_id === friendMemberId
        );
        if (!friendSplit) return;
      }

      // Calculate net effect of this expense
      // This is simplified - in reality we'd need to know which member is the user
      const totalAmount = parseFloat(String(exp.amount));
      const splitCount = splits.length;
      const equalShare = splitCount > 0 ? totalAmount / splitCount : totalAmount;

      breakdown.push({
        expenseId: exp.id,
        description: exp.description,
        amount: totalAmount,
        date: exp.expense_date || exp.created_at.split("T")[0],
        groupName: group.name,
        groupId: group.id,
        youPaid: 0, // Would need user's member ID to calculate
        yourShare: equalShare,
        netEffect: 0, // Would need user's member ID to calculate
      });
    });

    return breakdown;
  } catch (error) {
    console.error("getExpenseBreakdown error:", error);
    return [];
  }
}

/**
 * Get a quick summary of balances for display
 */
export async function getBalanceSummary(): Promise<{
  groupsWithBalance: number;
  settledGroups: number;
  totalExpenses: number;
}> {
  try {
    // Get all groups
    const { data: groups } = await supabase.from("groups").select("id");

    let groupsWithBalance = 0;
    let settledGroups = 0;

    for (const group of groups || []) {
      const balance = await getGroupBalances(group.id);
      if (balance) {
        if (balance.totalOwed > 0 || balance.totalOwing > 0) {
          groupsWithBalance++;
        } else {
          settledGroups++;
        }
      }
    }

    // Get total expenses count
    const { count } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    return {
      groupsWithBalance,
      settledGroups,
      totalExpenses: count || 0,
    };
  } catch (error) {
    console.error("getBalanceSummary error:", error);
    return {
      groupsWithBalance: 0,
      settledGroups: 0,
      totalExpenses: 0,
    };
  }
}

/**
 * Get suggested settlements across all groups
 * @param preloadedBalances Optional preloaded global balances to avoid duplicate queries
 */
export async function getAllSuggestedSettlements(
  preloadedBalances?: GlobalBalance
): Promise<
  Array<{
    group: Group;
    from: Member;
    to: Member;
    amount: number;
  }>
> {
  try {
    const globalBalances = preloadedBalances || await getGlobalBalances();
    const suggestions: Array<{
      group: Group;
      from: Member;
      to: Member;
      amount: number;
    }> = [];

    for (const groupBalance of globalBalances.byGroup) {
      // Get balances map
      const balancesMap = new Map<string, number>();
      groupBalance.members.forEach(({ member, balance }) => {
        balancesMap.set(member.id, balance);
      });

      // Calculate simplified debts
      const debts = simplifyDebts(
        balancesMap,
        groupBalance.members.map((mb) => mb.member)
      );

      // Convert to suggestions with full member objects
      debts.forEach((debt) => {
        const fromMember = groupBalance.members.find(
          (mb) => mb.member.id === debt.from
        )?.member;
        const toMember = groupBalance.members.find(
          (mb) => mb.member.id === debt.to
        )?.member;

        if (fromMember && toMember) {
          suggestions.push({
            group: groupBalance.group,
            from: fromMember,
            to: toMember,
            amount: debt.amount,
          });
        }
      });
    }

    // Sort by amount (largest first)
    suggestions.sort((a, b) => b.amount - a.amount);

    return suggestions;
  } catch (error) {
    console.error("getAllSuggestedSettlements error:", error);
    return [];
  }
}
