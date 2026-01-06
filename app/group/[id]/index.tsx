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
import { Group, Member, Expense, SettlementRecord } from "../../../lib/types";
import { formatCurrency, formatRelativeDate, calculateBalancesWithSettlements } from "../../../lib/utils";
import {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
} from "../../../lib/theme";
import { Card, Avatar, Button } from "../../../components/ui";
import { exportGroup } from "../../../lib/export";
import { getCategoryById } from "../../../lib/categories";
import { useAuth } from "../../../lib/auth-context";
import { claimMember, getMemberByUserId } from "../../../lib/members";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [userClaimedMember, setUserClaimedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", id)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch expenses with payer info and splits
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select(
          `
          *,
          payer:members!paid_by(id, name),
          splits(member_id, amount)
        `,
        )
        .eq("group_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      // Fetch settlements
      const { data: settlementsData, error: settlementsError } = await supabase
        .from("settlements")
        .select(
          `
          *,
          from_member:members!from_member_id(id, name),
          to_member:members!to_member_id(id, name)
        `,
        )
        .eq("group_id", id)
        .order("settled_at", { ascending: false });

      if (settlementsError) throw settlementsError;
      setSettlements(settlementsData || []);

      // Check if the current user has a claimed member in this group
      if (userId) {
        const claimedMember = await getMemberByUserId(id, userId);
        setUserClaimedMember(claimedMember);
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleShare = () => {
    router.push(`/group/${id}/share`);
  };

  const handleClaimMember = async (memberId: string) => {
    if (!userId) {
      Alert.alert("Sign In Required", "Please sign in to claim a member.");
      return;
    }

    try {
      const result = await claimMember(memberId, userId);
      if (result.error) {
        Alert.alert("Error", result.error);
      } else {
        Alert.alert("Success", "You've claimed this member!");
        // Refresh data to update the UI
        fetchData();
      }
    } catch (error) {
      console.error("Error claiming member:", error);
      Alert.alert("Error", "Failed to claim member. Please try again.");
    }
  };

  const handleTogglePin = async () => {
    if (!group) return;

    try {
      const newPinnedState = !group.pinned;
      const { error } = await supabase
        .from("groups")
        .update({ pinned: newPinnedState })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setGroup({ ...group, pinned: newPinnedState });
    } catch (error) {
      console.error("Error toggling pin:", error);
      Alert.alert("Error", "Failed to update pin status. Please try again.");
    }
  };

  const handleExport = async () => {
    if (!group || exporting) return;

    setExporting(true);
    try {
      // Calculate balances for export
      const expensesForCalc = expenses.map((exp) => ({
        paid_by: exp.paid_by,
        amount: parseFloat(String(exp.amount)),
        splits: (exp.splits || []).map((s: { member_id: string; amount: number }) => ({
          member_id: s.member_id,
          amount: parseFloat(String(s.amount)),
        })),
      }));

      const settlementsForCalc = settlements.map((s) => ({
        from_member_id: s.from_member_id,
        to_member_id: s.to_member_id,
        amount: parseFloat(String(s.amount)),
      }));

      const balances = calculateBalancesWithSettlements(
        expensesForCalc,
        settlementsForCalc,
        members
      );

      const success = await exportGroup(group, expenses, members, settlements, balances);
      if (success) {
        // Export was shared successfully
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Export Failed", "Could not export group data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const renderExpense = ({ item }: { item: Expense }) => {
    const category = item.category ? getCategoryById(item.category) : null;
    return (
      <Card style={styles.expenseCard}>
        <View style={styles.expenseHeader}>
          {category && (
            <View style={styles.categoryIcon}>
              <Text style={styles.categoryIconText}>{category.icon}</Text>
            </View>
          )}
          <View style={styles.expenseInfo}>
            <Text style={styles.expenseDescription}>{item.description}</Text>
            <Text style={styles.expenseMeta}>
              Paid by {item.payer?.name || "Unknown"} •{" "}
              {formatRelativeDate(item.created_at)}
            </Text>
          </View>
          <Text style={styles.expenseAmount}>
            {formatCurrency(item.amount, group?.currency)}
          </Text>
        </View>
      </Card>
    );
  };

  const ListHeader = () => (
    <View style={styles.header}>
      <View style={styles.groupInfo}>
        <Text style={styles.groupEmoji}>{group?.emoji || "💰"}</Text>
        <View style={styles.groupInfoText}>
          <Text style={styles.groupName}>{group?.name}</Text>
          <TouchableOpacity onPress={handleShare}>
            <Text style={styles.shareCode}>
              Code: {group?.share_code} • Tap to share
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {group?.notes && (
        <View style={styles.notesCard}>
          <Text style={styles.notesText}>{group.notes}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Members</Text>
      <View style={styles.membersRow}>
        {members.map((member) => {
          const isUnclaimed = !member.user_id;
          const canShowClaimButton = userId && isUnclaimed && !userClaimedMember;

          return (
            <View key={member.id} style={styles.memberItem}>
              <Avatar name={member.name} size="md" />
              <Text style={styles.memberName} numberOfLines={1}>
                {member.name}
              </Text>
              {canShowClaimButton && (
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={() => handleClaimMember(member.id)}
                >
                  <Text style={styles.claimButtonText}>This is me</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <TouchableOpacity
          style={styles.addMemberButton}
          onPress={() => router.push(`/group/${id}/add-member`)}
        >
          <View style={styles.addMemberIcon}>
            <Text style={styles.addMemberPlus}>+</Text>
          </View>
          <Text style={styles.memberName}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.balanceButtonContainer}>
        <TouchableOpacity
          style={styles.balanceButton}
          onPress={() => router.push(`/group/${id}/balances`)}
          activeOpacity={0.7}
        >
          <Text style={styles.balanceButtonText}>View Balances</Text>
          <Text style={styles.balanceButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Expenses</Text>
    </View>
  );

  const EmptyExpenses = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📝</Text>
      <Text style={styles.emptyText}>No expenses yet</Text>
      <Text style={styles.emptySubtext}>
        Add your first expense to start tracking
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: group?.name || "Group",
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleTogglePin}
                style={styles.headerIconButton}
              >
                <Ionicons
                  name={group?.pinned ? "star" : "star-outline"}
                  size={22}
                  color={group?.pinned ? colors.warning : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/group/${id}/edit`)}
                style={styles.headerIconButton}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleExport}
                style={styles.headerIconButton}
                disabled={exporting}
              >
                <Ionicons
                  name="download-outline"
                  size={22}
                  color={exporting ? colors.textMuted : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.headerTextButton}>
                <Text style={styles.headerButton}>Share</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <FlatList
          data={expenses}
          renderItem={renderExpense}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={EmptyExpenses}
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

        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push(`/group/${id}/add-expense`)}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+ Add Expense</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    paddingTop: spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerIconButton: {
    padding: spacing.xs,
  },
  headerTextButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  headerButton: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  groupInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  groupInfoText: {
    flex: 1,
  },
  groupEmoji: {
    fontSize: 48,
    marginRight: spacing.md,
  },
  groupName: {
    ...typography.h2,
  },
  shareCode: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  notesCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  notesText: {
    ...typography.body,
    color: colors.primaryDark,
    lineHeight: 20,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  membersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  memberItem: {
    alignItems: "center",
    marginRight: spacing.lg,
    marginBottom: spacing.sm,
    width: 80,
  },
  memberName: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  claimButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  claimButtonText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: colors.white,
    textAlign: "center",
  },
  addMemberButton: {
    alignItems: "center",
    width: 56,
  },
  addMemberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  addMemberPlus: {
    fontSize: 24,
    color: colors.primary,
    fontFamily: "Inter_400Regular",
    marginTop: -2,
  },
  expenseCard: {
    marginBottom: spacing.md,
  },
  expenseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    marginTop: spacing.xs,
  },
  expenseAmount: {
    ...typography.amountMedium,
    color: colors.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  fabContainer: {
    position: "absolute",
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
  },
  fab: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.lg,
  },
  fabText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  balanceButtonContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  balanceButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceButtonText: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
  balanceButtonArrow: {
    fontSize: 18,
    color: colors.primaryDark,
  },
});
