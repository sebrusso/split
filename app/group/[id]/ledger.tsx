import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../lib/supabase";
import { Group, Expense, SettlementRecord, Member } from "../../../lib/types";
import logger from "../../../lib/logger";
import { formatCurrency, formatRelativeDate } from "../../../lib/utils";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import { Card, Avatar } from "../../../components/ui";
import { getCategoryById } from "../../../lib/categories";

// Combined transaction type
interface Transaction {
  id: string;
  type: "expense" | "settlement";
  date: string;
  amount: number;
  description: string;
  // Expense fields
  expense?: Expense;
  payer?: Member;
  category?: string;
  // Settlement fields
  settlement?: SettlementRecord;
  fromMember?: Member;
  toMember?: Member;
}

type FilterType = "all" | "expenses" | "settlements";

export default function LedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch group, expenses, and settlements in parallel
      const [groupResult, expensesResult, settlementsResult] = await Promise.all([
        supabase.from("groups").select("*").eq("id", id).single(),
        supabase
          .from("expenses")
          .select(`
            *,
            payer:members!paid_by(id, name)
          `)
          .eq("group_id", id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("settlements")
          .select(`
            *,
            from_member:members!from_member_id(id, name),
            to_member:members!to_member_id(id, name)
          `)
          .eq("group_id", id)
          .order("settled_at", { ascending: false }),
      ]);

      if (groupResult.error) throw groupResult.error;
      setGroup(groupResult.data);

      // Convert expenses to transactions
      const expenseTransactions: Transaction[] = (expensesResult.data || []).map((exp) => ({
        id: `expense-${exp.id}`,
        type: "expense" as const,
        date: exp.expense_date || exp.created_at,
        amount: exp.amount,
        description: exp.description,
        expense: exp,
        payer: exp.payer,
        category: exp.category,
      }));

      // Convert settlements to transactions
      const settlementTransactions: Transaction[] = (settlementsResult.data || []).map((s) => ({
        id: `settlement-${s.id}`,
        type: "settlement" as const,
        date: s.settled_at,
        amount: s.amount,
        description: `${s.from_member?.name || "Someone"} paid ${s.to_member?.name || "someone"}`,
        settlement: s,
        fromMember: s.from_member,
        toMember: s.to_member,
      }));

      // Combine and sort by date (newest first)
      const allTransactions = [...expenseTransactions, ...settlementTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setTransactions(allTransactions);
    } catch (error) {
      logger.error("Error fetching ledger:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredTransactions = transactions.filter((t) => {
    if (filter === "all") return true;
    if (filter === "expenses") return t.type === "expense";
    if (filter === "settlements") return t.type === "settlement";
    return true;
  });

  const renderTransaction = ({ item }: { item: Transaction }) => {
    if (item.type === "expense") {
      const category = item.category ? getCategoryById(item.category) : null;
      return (
        <TouchableOpacity
          onPress={() => router.push(`/group/${id}/expense/${item.expense?.id}`)}
        >
          <Card style={styles.transactionCard}>
            <View style={styles.transactionRow}>
              <View style={styles.iconContainer}>
                {category ? (
                  <View style={[styles.categoryIcon, { backgroundColor: category.color + "20" }]}>
                    <Text style={styles.categoryIconText}>{category.icon}</Text>
                  </View>
                ) : (
                  <View style={styles.expenseIcon}>
                    <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                  </View>
                )}
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>{item.description}</Text>
                <Text style={styles.transactionMeta}>
                  {item.payer?.name} paid • {formatRelativeDate(item.date)}
                </Text>
              </View>
              <View style={styles.amountContainer}>
                <Text style={styles.expenseAmount}>
                  -{formatCurrency(item.amount, group?.currency)}
                </Text>
                <Text style={styles.typeLabel}>Expense</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      );
    }

    // Settlement
    return (
      <Card style={styles.transactionCard}>
        <View style={styles.transactionRow}>
          <View style={styles.iconContainer}>
            <View style={styles.settlementIcon}>
              <Ionicons name="swap-horizontal" size={20} color={colors.success} />
            </View>
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionTitle}>Settlement</Text>
            <Text style={styles.transactionMeta}>
              {item.fromMember?.name} → {item.toMember?.name} • {formatRelativeDate(item.date)}
            </Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.settlementAmount}>
              {formatCurrency(item.amount, group?.currency)}
            </Text>
            <Text style={styles.typeLabel}>Payment</Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderSectionHeader = () => {
    // Group transactions by month
    const months: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach((t) => {
      const monthKey = new Date(t.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      if (!months[monthKey]) months[monthKey] = [];
      months[monthKey].push(t);
    });

    return null; // For now, just using flat list
  };

  const getTotals = () => {
    const expenseTotal = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const settlementTotal = filteredTransactions
      .filter((t) => t.type === "settlement")
      .reduce((sum, t) => sum + t.amount, 0);
    return { expenseTotal, settlementTotal };
  };

  const { expenseTotal, settlementTotal } = getTotals();

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📒</Text>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySubtitle}>
        Add expenses or record settlements to see them here
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Transaction Ledger",
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryValue, styles.expenseValue]}>
              {formatCurrency(expenseTotal, group?.currency)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Settled</Text>
            <Text style={[styles.summaryValue, styles.settlementValue]}>
              {formatCurrency(settlementTotal, group?.currency)}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          {(["all", "expenses", "settlements"] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === "all" ? "All" : f === "expenses" ? "Expenses" : "Settlements"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={filteredTransactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  summary: {
    flexDirection: "row",
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.bodyMedium,
    fontFamily: "Inter_600SemiBold",
    marginTop: spacing.xs,
  },
  expenseValue: {
    color: colors.danger,
  },
  settlementValue: {
    color: colors.success,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  filterContainer: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: borderRadius.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  transactionCard: {
    marginBottom: spacing.sm,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryIconText: {
    fontSize: 20,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  settlementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    ...typography.bodyMedium,
  },
  transactionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  expenseAmount: {
    ...typography.bodyMedium,
    fontFamily: "Inter_600SemiBold",
    color: colors.danger,
  },
  settlementAmount: {
    ...typography.bodyMedium,
    fontFamily: "Inter_600SemiBold",
    color: colors.success,
  },
  typeLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
