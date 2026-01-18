import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSupabase } from "../../../lib/supabase";
import { Member, Group } from "../../../lib/types";
import logger from "../../../lib/logger";
import { formatCurrency } from "../../../lib/utils";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import { Card, Avatar, Button } from "../../../components/ui";
import { getCategoryById } from "../../../lib/categories";

interface RecurringExpense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  category: string;
  frequency: string;
  next_due_date: string;
  is_active: boolean;
  payer?: { id: string; name: string };
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default function RecurringExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getSupabase } = useSupabase();
  const [group, setGroup] = useState<Group | null>(null);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const supabase = await getSupabase();
      const [groupResult, recurringResult] = await Promise.all([
        supabase.from("groups").select("*").eq("id", id).single(),
        supabase
          .from("recurring_expenses")
          .select(`
            *,
            payer:members!paid_by(id, name)
          `)
          .eq("group_id", id)
          .order("next_due_date", { ascending: true }),
      ]);

      if (groupResult.error) throw groupResult.error;
      setGroup(groupResult.data);
      setRecurringExpenses(recurringResult.data || []);
    } catch (error) {
      logger.error("Error fetching recurring expenses:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, getSupabase]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleToggleActive = async (expense: RecurringExpense) => {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from("recurring_expenses")
        .update({ is_active: !expense.is_active })
        .eq("id", expense.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      logger.error("Error toggling recurring expense:", error);
      Alert.alert("Error", "Failed to update recurring expense.");
    }
  };

  const handleDelete = (expense: RecurringExpense) => {
    Alert.alert(
      "Delete Recurring Expense",
      `Delete "${expense.description}"? This will stop all future occurrences. Past expenses will not be affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const supabase = await getSupabase();
              const { error } = await supabase
                .from("recurring_expenses")
                .delete()
                .eq("id", expense.id);

              if (error) throw error;
              fetchData();
            } catch (error) {
              logger.error("Error deleting recurring expense:", error);
              Alert.alert("Error", "Failed to delete recurring expense.");
            }
          },
        },
      ]
    );
  };

  const formatNextDue = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date <= today) return "Today";
    if (date <= tomorrow) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderExpense = ({ item }: { item: RecurringExpense }) => {
    const category = item.category ? getCategoryById(item.category) : null;

    return (
      <Card style={[styles.expenseCard, !item.is_active && styles.expenseCardInactive]}>
        <TouchableOpacity
          style={styles.expenseContent}
          onPress={() => router.push(`/group/${id}/recurring/${item.id}`)}
        >
          <View style={styles.expenseHeader}>
            {category && (
              <View style={[styles.categoryIcon, { backgroundColor: category.color + "20" }]}>
                <Text style={styles.categoryIconText}>{category.icon}</Text>
              </View>
            )}
            <View style={styles.expenseInfo}>
              <Text style={[styles.expenseDescription, !item.is_active && styles.textInactive]}>
                {item.description}
              </Text>
              <Text style={styles.expenseMeta}>
                {item.payer?.name || "Unknown"} pays • {FREQUENCY_LABELS[item.frequency]}
              </Text>
              <Text style={[styles.nextDue, !item.is_active && styles.textMuted]}>
                {item.is_active ? `Next: ${formatNextDue(item.next_due_date)}` : "Paused"}
              </Text>
            </View>
            <View style={styles.amountContainer}>
              <Text style={[styles.expenseAmount, !item.is_active && styles.textInactive]}>
                {formatCurrency(item.amount, group?.currency)}
              </Text>
              {!item.is_active && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedText}>Paused</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.expenseActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleActive(item)}
          >
            <Ionicons
              name={item.is_active ? "pause" : "play"}
              size={18}
              color={item.is_active ? colors.warning : colors.success}
            />
            <Text style={[styles.actionText, { color: item.is_active ? colors.warning : colors.success }]}>
              {item.is_active ? "Pause" : "Resume"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.actionTextDanger}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const activeExpenses = recurringExpenses.filter((e) => e.is_active);
  const pausedExpenses = recurringExpenses.filter((e) => !e.is_active);

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🔄</Text>
      <Text style={styles.emptyTitle}>No recurring expenses</Text>
      <Text style={styles.emptySubtitle}>
        Set up recurring expenses for rent, utilities, subscriptions, and more
      </Text>
      <Button
        title="Add Recurring Expense"
        onPress={() => router.push(`/group/${id}/add-recurring`)}
        style={styles.emptyButton}
      />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Recurring Expenses",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push(`/group/${id}/add-recurring`)}
              style={styles.addButton}
            >
              <Ionicons name="add" size={28} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading...</Text>
          </View>
        ) : recurringExpenses.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={[...activeExpenses, ...pausedExpenses]}
            renderItem={renderExpense}
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
            ListHeaderComponent={
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{activeExpenses.length}</Text>
                  <Text style={styles.summaryLabel}>Active</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(
                      activeExpenses.reduce((sum, e) => sum + e.amount, 0),
                      group?.currency
                    )}
                  </Text>
                  <Text style={styles.summaryLabel}>Monthly Total</Text>
                </View>
              </View>
            }
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
  addButton: {
    marginRight: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    ...typography.h3,
    color: colors.primaryDark,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.primaryDark,
    opacity: 0.2,
    marginHorizontal: spacing.md,
  },
  expenseCard: {
    marginBottom: spacing.md,
    padding: 0,
    overflow: "hidden",
  },
  expenseCardInactive: {
    opacity: 0.7,
  },
  expenseContent: {
    padding: spacing.md,
  },
  expenseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  categoryIconText: {
    fontSize: 18,
  },
  expenseInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  expenseDescription: {
    ...typography.bodyMedium,
  },
  textInactive: {
    color: colors.textMuted,
  },
  textMuted: {
    color: colors.textMuted,
  },
  expenseMeta: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  nextDue: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  expenseAmount: {
    ...typography.amountMedium,
    color: colors.text,
  },
  pausedBadge: {
    backgroundColor: colors.warning + "20",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  pausedText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: "600",
  },
  expenseActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  actionText: {
    ...typography.small,
  },
  actionTextDanger: {
    ...typography.small,
    color: colors.danger,
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
    marginBottom: spacing.xl,
  },
  emptyButton: {
    minWidth: 200,
  },
});
