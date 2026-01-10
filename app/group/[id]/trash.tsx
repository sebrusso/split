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
import { supabase } from "../../../lib/supabase";
import { Expense, Member } from "../../../lib/types";
import logger from "../../../lib/logger";
import { formatCurrency, formatRelativeDate } from "../../../lib/utils";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import { Card, Button } from "../../../components/ui";
import { getCategoryById } from "../../../lib/categories";
import { deleteReceipt } from "../../../lib/storage";

export default function TrashScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deletedExpenses, setDeletedExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch deleted expenses and members in parallel
      const [expensesResult, membersResult] = await Promise.all([
        supabase
          .from("expenses")
          .select(`
            *,
            payer:members!paid_by(id, name)
          `)
          .eq("group_id", id)
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false }),
        supabase.from("members").select("*").eq("group_id", id),
      ]);

      if (expensesResult.error) throw expensesResult.error;
      setDeletedExpenses(expensesResult.data || []);
      setMembers(membersResult.data || []);
    } catch (error) {
      logger.error("Error fetching trash:", error);
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

  const handleRestore = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: null })
        .eq("id", expenseId);

      if (error) throw error;

      Alert.alert("Restored", "Expense has been restored.");
      fetchData();
    } catch (error) {
      logger.error("Error restoring expense:", error);
      Alert.alert("Error", "Failed to restore expense.");
    }
  };

  const handlePermanentDelete = (expense: Expense) => {
    Alert.alert(
      "Delete Forever",
      `Are you sure you want to permanently delete "${expense.description}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete receipt if exists
              if (expense.receipt_url) {
                await deleteReceipt(expense.receipt_url);
              }

              const { error } = await supabase
                .from("expenses")
                .delete()
                .eq("id", expense.id);

              if (error) throw error;

              fetchData();
            } catch (error) {
              logger.error("Error permanently deleting expense:", error);
              Alert.alert("Error", "Failed to delete expense.");
            }
          },
        },
      ]
    );
  };

  const handleEmptyTrash = () => {
    if (deletedExpenses.length === 0) return;

    Alert.alert(
      "Empty Trash",
      `Are you sure you want to permanently delete all ${deletedExpenses.length} expenses? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete all receipts
              for (const expense of deletedExpenses) {
                if (expense.receipt_url) {
                  await deleteReceipt(expense.receipt_url);
                }
              }

              // Delete all expenses
              const { error } = await supabase
                .from("expenses")
                .delete()
                .eq("group_id", id)
                .not("deleted_at", "is", null);

              if (error) throw error;

              Alert.alert("Trash Emptied", "All deleted expenses have been permanently removed.");
              fetchData();
            } catch (error) {
              logger.error("Error emptying trash:", error);
              Alert.alert("Error", "Failed to empty trash.");
            }
          },
        },
      ]
    );
  };

  const handleRestoreAll = () => {
    if (deletedExpenses.length === 0) return;

    Alert.alert(
      "Restore All",
      `Restore all ${deletedExpenses.length} deleted expenses?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore All",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("expenses")
                .update({ deleted_at: null })
                .eq("group_id", id)
                .not("deleted_at", "is", null);

              if (error) throw error;

              Alert.alert("Restored", "All expenses have been restored.");
              fetchData();
            } catch (error) {
              logger.error("Error restoring all:", error);
              Alert.alert("Error", "Failed to restore expenses.");
            }
          },
        },
      ]
    );
  };

  const getDaysUntilPermanentDelete = (deletedAt: string): number => {
    const deleteDate = new Date(deletedAt);
    const permanentDeleteDate = new Date(deleteDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((permanentDeleteDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysLeft);
  };

  const renderExpense = ({ item }: { item: Expense }) => {
    const category = item.category ? getCategoryById(item.category) : null;
    const daysLeft = getDaysUntilPermanentDelete(item.deleted_at || "");

    return (
      <Card style={styles.expenseCard}>
        <TouchableOpacity
          style={styles.expenseContent}
          onPress={() => router.push(`/group/${id}/expense/${item.id}`)}
        >
          <View style={styles.expenseHeader}>
            {category && (
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryIconText}>{category.icon}</Text>
              </View>
            )}
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseDescription}>{item.description}</Text>
              <Text style={styles.expenseMeta}>
                Paid by {item.payer?.name || "Unknown"} • Deleted {formatRelativeDate(item.deleted_at || "")}
              </Text>
              <Text style={[styles.daysLeft, daysLeft <= 7 && styles.daysLeftUrgent]}>
                {daysLeft === 0 ? "Deleting today" : `${daysLeft} days until permanent deletion`}
              </Text>
            </View>
            <Text style={styles.expenseAmount}>
              {formatCurrency(item.amount)}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.expenseActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePermanentDelete(item)}
          >
            <Ionicons name="trash" size={18} color={colors.danger} />
            <Text style={styles.actionTextDanger}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRestore(item.id)}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.actionText}>Restore</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🗑️</Text>
      <Text style={styles.emptyTitle}>Trash is empty</Text>
      <Text style={styles.emptySubtitle}>
        Deleted expenses will appear here for 30 days before being permanently removed
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Trash",
          headerRight: () =>
            deletedExpenses.length > 0 ? (
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleRestoreAll} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>Restore All</Text>
                </TouchableOpacity>
              </View>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading...</Text>
          </View>
        ) : deletedExpenses.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <FlatList
              data={deletedExpenses}
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
            />
            <View style={styles.footer}>
              <Button
                title="Empty Trash"
                variant="danger"
                onPress={handleEmptyTrash}
              />
            </View>
          </>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
  },
  headerButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  expenseCard: {
    marginBottom: spacing.md,
    padding: 0,
    overflow: "hidden",
  },
  expenseContent: {
    padding: spacing.md,
  },
  expenseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  categoryIconText: {
    fontSize: 16,
  },
  expenseInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  expenseDescription: {
    ...typography.bodyMedium,
  },
  expenseMeta: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  daysLeft: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  daysLeftUrgent: {
    color: colors.danger,
  },
  expenseAmount: {
    ...typography.amountMedium,
    color: colors.textMuted,
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
    color: colors.primary,
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
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
