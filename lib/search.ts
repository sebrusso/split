/**
 * Search utilities for expenses and groups
 */

import { supabase } from "./supabase";
import { Expense, Group, Member } from "./types";
import { escapeILike } from "./sanitize";
import logger from "./logger";

export interface SearchFilters {
  groupId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  paidBy?: string;
}

export interface ExpenseSearchResult extends Expense {
  group?: Group;
}

export interface SearchResults {
  expenses: ExpenseSearchResult[];
  groups: Group[];
}

/**
 * Search expenses with text query and optional filters
 * Uses Supabase ilike for text search
 */
export async function searchExpenses(
  query: string,
  filters?: SearchFilters
): Promise<ExpenseSearchResult[]> {
  try {
    let queryBuilder = supabase
      .from("expenses")
      .select(
        `
        *,
        payer:members!paid_by(id, name),
        group:groups!group_id(id, name, emoji, currency),
        splits(member_id, amount)
      `
      )
      .is("deleted_at", null);

    // Apply text search if query exists
    if (query.trim()) {
      const escapedQuery = escapeILike(query.trim());
      const searchPattern = `%${escapedQuery}%`;
      // Search in description, merchant, and notes
      queryBuilder = queryBuilder.or(
        `description.ilike.${searchPattern},merchant.ilike.${searchPattern},notes.ilike.${searchPattern}`
      );
    }

    // Apply filters
    if (filters?.groupId) {
      queryBuilder = queryBuilder.eq("group_id", filters.groupId);
    }

    if (filters?.category) {
      queryBuilder = queryBuilder.eq("category", filters.category);
    }

    if (filters?.dateFrom) {
      queryBuilder = queryBuilder.gte("expense_date", filters.dateFrom);
    }

    if (filters?.dateTo) {
      queryBuilder = queryBuilder.lte("expense_date", filters.dateTo);
    }

    if (filters?.amountMin !== undefined) {
      queryBuilder = queryBuilder.gte("amount", filters.amountMin);
    }

    if (filters?.amountMax !== undefined) {
      queryBuilder = queryBuilder.lte("amount", filters.amountMax);
    }

    if (filters?.paidBy) {
      queryBuilder = queryBuilder.eq("paid_by", filters.paidBy);
    }

    // Order by most recent first
    queryBuilder = queryBuilder.order("expense_date", { ascending: false });

    const { data, error } = await queryBuilder.limit(50);

    if (error) {
      logger.error("Error searching expenses:", error);
      throw error;
    }

    return (data || []) as ExpenseSearchResult[];
  } catch (error) {
    logger.error("searchExpenses error:", error);
    return [];
  }
}

/**
 * Search groups by name or share code
 */
export async function searchGroups(query: string): Promise<Group[]> {
  try {
    if (!query.trim()) {
      // Return all groups if no query
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    }

    const escapedQuery = escapeILike(query.trim());
    const searchPattern = `%${escapedQuery}%`;

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .or(`name.ilike.${searchPattern},share_code.ilike.${searchPattern}`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      logger.error("Error searching groups:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error("searchGroups error:", error);
    return [];
  }
}

/**
 * Combined search for both expenses and groups
 */
export async function searchAll(
  query: string,
  filters?: SearchFilters
): Promise<SearchResults> {
  const [expenses, groups] = await Promise.all([
    searchExpenses(query, filters),
    searchGroups(query),
  ]);

  return { expenses, groups };
}

/**
 * Get recent search suggestions based on expense descriptions
 */
export async function getSearchSuggestions(
  query: string,
  limit: number = 5
): Promise<string[]> {
  try {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    const escapedQuery = escapeILike(query.trim());
    const searchPattern = `%${escapedQuery}%`;

    const { data, error } = await supabase
      .from("expenses")
      .select("description")
      .ilike("description", searchPattern)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit * 2); // Get more to dedupe

    if (error) throw error;

    // Deduplicate and return unique suggestions
    const unique = [...new Set((data || []).map((d) => d.description))];
    return unique.slice(0, limit);
  } catch (error) {
    logger.error("getSearchSuggestions error:", error);
    return [];
  }
}

/**
 * Get expense statistics for a group
 */
export async function getExpenseStats(groupId: string): Promise<{
  totalExpenses: number;
  totalAmount: number;
  byCategory: Record<string, { count: number; total: number }>;
  byMonth: Record<string, { count: number; total: number }>;
}> {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("amount, category, expense_date, created_at")
      .eq("group_id", groupId)
      .is("deleted_at", null);

    if (error) throw error;

    const expenses = data || [];
    const totalExpenses = expenses.length;
    const totalAmount = expenses.reduce(
      (sum, exp) => sum + parseFloat(String(exp.amount)),
      0
    );

    // Aggregate by category
    const byCategory: Record<string, { count: number; total: number }> = {};
    expenses.forEach((exp) => {
      const cat = exp.category || "other";
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, total: 0 };
      }
      byCategory[cat].count++;
      byCategory[cat].total += parseFloat(String(exp.amount));
    });

    // Aggregate by month
    const byMonth: Record<string, { count: number; total: number }> = {};
    expenses.forEach((exp) => {
      const date = exp.expense_date || exp.created_at;
      if (date) {
        const monthKey = date.slice(0, 7); // YYYY-MM
        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { count: 0, total: 0 };
        }
        byMonth[monthKey].count++;
        byMonth[monthKey].total += parseFloat(String(exp.amount));
      }
    });

    return { totalExpenses, totalAmount, byCategory, byMonth };
  } catch (error) {
    logger.error("getExpenseStats error:", error);
    return { totalExpenses: 0, totalAmount: 0, byCategory: {}, byMonth: {} };
  }
}
