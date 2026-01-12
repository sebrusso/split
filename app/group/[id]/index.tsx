import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  ActionSheetIOS,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../lib/supabase";
import { Group, Member, Expense, SettlementRecord, Receipt } from "../../../lib/types";
import logger from "../../../lib/logger";
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

// Extended member type with profile info
interface MemberWithProfile extends Member {
  avatar_url?: string | null;
}

// Combined list item type for expenses and receipts
type ListItem =
  | { type: "expense"; data: Expense }
  | { type: "receipt"; data: Receipt };

export default function GroupDetailScreen() {
  const { id, name: initialName } = useLocalSearchParams<{ id: string; name?: string }>();
  const { userId } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [userClaimedMember, setUserClaimedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

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

      // Fetch profile images for claimed members
      const claimedMemberIds = (membersData || [])
        .filter((m) => m.clerk_user_id)
        .map((m) => m.clerk_user_id);

      let memberAvatars: Record<string, string | null> = {};
      if (claimedMemberIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("user_profiles")
          .select("clerk_id, avatar_url")
          .in("clerk_id", claimedMemberIds);

        if (profilesData) {
          memberAvatars = profilesData.reduce((acc, profile) => {
            acc[profile.clerk_id] = profile.avatar_url;
            return acc;
          }, {} as Record<string, string | null>);
        }
      }

      // Merge avatar URLs into members
      const membersWithAvatars: MemberWithProfile[] = (membersData || []).map((m) => ({
        ...m,
        avatar_url: m.clerk_user_id ? memberAvatars[m.clerk_user_id] : null,
      }));

      setMembers(membersWithAvatars);

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

      // Fetch receipts that are still being claimed (not settled)
      // Once settled, an expense is created and we show that instead
      const { data: receiptsData, error: receiptsError } = await supabase
        .from("receipts")
        .select(
          `
          *,
          uploader:members!uploaded_by(id, name)
        `,
        )
        .eq("group_id", id)
        .eq("status", "claiming")
        .order("created_at", { ascending: false });

      if (receiptsError) {
        logger.warn("Error fetching receipts:", receiptsError);
      } else {
        setReceipts(receiptsData || []);
      }

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
      logger.error("Error fetching group data:", error);
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
      logger.error("Error claiming member:", error);
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
      logger.error("Error toggling pin:", error);
      Alert.alert("Error", "Failed to update pin status. Please try again.");
    }
  };

  const handleExport = async () => {
    if (!group || exporting) return;

    setExporting(true);
    try {
      // Calculate balances for export (including multi-currency support)
      const expensesForCalc = expenses.map((exp) => ({
        paid_by: exp.paid_by,
        amount: parseFloat(String(exp.amount)),
        splits: (exp.splits || []).map((s: { member_id: string; amount: number }) => ({
          member_id: s.member_id,
          amount: parseFloat(String(s.amount)),
        })),
        currency: exp.currency,
        exchange_rate: exp.exchange_rate,
      }));

      const settlementsForCalc = settlements.map((s) => ({
        from_member_id: s.from_member_id,
        to_member_id: s.to_member_id,
        amount: parseFloat(String(s.amount)),
      }));

      const balances = calculateBalancesWithSettlements(
        expensesForCalc,
        settlementsForCalc,
        members,
        group?.currency || "USD"
      );

      const success = await exportGroup(group, expenses, members, settlements, balances);
      if (success) {
        // Export was shared successfully
      }
    } catch (error) {
      logger.error("Export error:", error);
      Alert.alert("Export Failed", "Could not export group data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const showOptionsMenu = () => {
    const isPinned = group?.pinned;
    const options = [
      isPinned ? "Unpin Group" : "Pin Group",
      "Edit Group",
      "Export Data",
      "Share Group",
      "Cancel",
    ];
    const cancelButtonIndex = options.length - 1;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
        },
        (buttonIndex) => {
          handleOptionsSelection(buttonIndex);
        }
      );
    } else {
      setOptionsModalVisible(true);
    }
  };

  const handleOptionsSelection = (index: number) => {
    setOptionsModalVisible(false);
    switch (index) {
      case 0: // Pin/Unpin Group
        handleTogglePin();
        break;
      case 1: // Edit Group
        router.push(`/group/${id}/edit`);
        break;
      case 2: // Export Data
        handleExport();
        break;
      case 3: // Share Group
        handleShare();
        break;
      // case 4 is Cancel - do nothing
    }
  };

  // Combine expenses and receipts into a single sorted list
  const combinedItems: ListItem[] = [
    ...expenses.map((e) => ({ type: "expense" as const, data: e })),
    ...receipts.map((r) => ({ type: "receipt" as const, data: r })),
  ].sort((a, b) => {
    const dateA = new Date(a.data.created_at).getTime();
    const dateB = new Date(b.data.created_at).getTime();
    return dateB - dateA; // Most recent first
  });

  const renderExpense = (item: Expense) => {
    const category = item.category ? getCategoryById(item.category) : null;

    // Check if this expense is from a receipt (has [receipt:xxx] in notes)
    const receiptMatch = item.notes?.match(/\[receipt:([^\]]+)\]/);
    const receiptId = receiptMatch ? receiptMatch[1] : null;
    const isFromReceipt = !!receiptId;

    const handlePress = () => {
      if (receiptId) {
        // Navigate to receipt claiming screen for receipt-based expenses
        router.push(`/group/${id}/receipt/${receiptId}`);
      } else {
        // Navigate to expense detail for regular expenses
        router.push(`/group/${id}/expense/${item.id}`);
      }
    };

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <Card style={[styles.expenseCard, isFromReceipt && styles.receiptCard]}>
          <View style={styles.expenseHeader}>
            {category && (
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryIconText}>{isFromReceipt ? "🧾" : category.icon}</Text>
              </View>
            )}
            {!category && isFromReceipt && (
              <View style={styles.categoryIcon}>
                <Text style={styles.categoryIconText}>🧾</Text>
              </View>
            )}
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseDescription}>{item.description}</Text>
              <Text style={styles.expenseMeta}>
                Paid by {item.payer?.name || "Unknown"} •{" "}
                {formatRelativeDate(item.created_at)}
              </Text>
              {isFromReceipt && (
                <View style={[styles.receiptBadge, styles.receiptBadgeComplete]}>
                  <Text style={[styles.receiptBadgeText, styles.receiptBadgeTextComplete]}>
                    Receipt
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.expenseAmount}>
              {formatCurrency(item.amount, item.currency || group?.currency)}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderReceipt = (item: Receipt) => {
    // Show clearer status: "Claiming" for in-progress, "Complete" for fully settled
    const badgeText = item.status === "settled" ? "Complete" : "Claiming";
    const isComplete = item.status === "settled";

    return (
      <TouchableOpacity
        onPress={() => router.push(`/group/${id}/receipt/${item.id}`)}
        activeOpacity={0.7}
      >
        <Card style={[styles.expenseCard, styles.receiptCard]}>
          <View style={styles.expenseHeader}>
            <View style={styles.categoryIcon}>
              <Text style={styles.categoryIconText}>🧾</Text>
            </View>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseDescription}>
                {item.merchant_name || "Receipt"}
              </Text>
              <Text style={styles.expenseMeta}>
                {item.uploader?.name ? `Added by ${item.uploader.name}` : ""}
                {item.uploader?.name && " • "}
                {formatRelativeDate(item.created_at)}
              </Text>
              <View style={[styles.receiptBadge, isComplete && styles.receiptBadgeComplete]}>
                <Text style={[styles.receiptBadgeText, isComplete && styles.receiptBadgeTextComplete]}>
                  {badgeText}
                </Text>
              </View>
            </View>
            <Text style={styles.expenseAmount}>
              {formatCurrency(item.total_amount || 0, item.currency)}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "expense") {
      return renderExpense(item.data);
    }
    return renderReceipt(item.data);
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
          const isUnclaimed = !member.clerk_user_id;
          const canShowClaimButton = userId && isUnclaimed && !userClaimedMember;

          return (
            <View key={member.id} style={styles.memberItem}>
              {member.avatar_url ? (
                <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
              ) : (
                <Avatar name={member.name} size="md" />
              )}
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

      <View style={styles.ledgerButtonContainer}>
        <TouchableOpacity
          style={styles.ledgerButton}
          onPress={() => router.push(`/group/${id}/ledger`)}
          activeOpacity={0.7}
        >
          <Text style={styles.ledgerButtonText}>📒 Transaction Ledger</Text>
          <Text style={styles.ledgerButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recurringButtonContainer}>
        <TouchableOpacity
          style={styles.recurringButton}
          onPress={() => router.push(`/group/${id}/recurring`)}
          activeOpacity={0.7}
        >
          <Text style={styles.recurringButtonText}>🔄 Recurring Expenses</Text>
          <Text style={styles.recurringButtonArrow}>→</Text>
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
          title: group?.name || initialName || "Group",
          headerBackTitle: "Groups",
          headerBackVisible: !loading,
          headerRight: loading
            ? undefined
            : () => (
                <TouchableOpacity
                  onPress={showOptionsMenu}
                  style={styles.headerOptionsButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              ),
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <FlatList
          data={combinedItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.type}-${item.data.id}`}
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

        {/* Options Modal for Android */}
        <Modal
          visible={optionsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setOptionsModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setOptionsModalVisible(false)}
          >
            <View style={styles.optionsModal}>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => handleOptionsSelection(0)}
              >
                <Ionicons
                  name={group?.pinned ? "star" : "star-outline"}
                  size={20}
                  color={group?.pinned ? colors.warning : colors.text}
                  style={styles.optionIcon}
                />
                <Text style={styles.optionText}>
                  {group?.pinned ? "Unpin Group" : "Pin Group"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => handleOptionsSelection(1)}
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={colors.text}
                  style={styles.optionIcon}
                />
                <Text style={styles.optionText}>Edit Group</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => handleOptionsSelection(2)}
              >
                <Ionicons
                  name="download-outline"
                  size={20}
                  color={colors.text}
                  style={styles.optionIcon}
                />
                <Text style={styles.optionText}>Export Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => handleOptionsSelection(3)}
              >
                <Ionicons
                  name="share-outline"
                  size={20}
                  color={colors.text}
                  style={styles.optionIcon}
                />
                <Text style={styles.optionText}>Share Group</Text>
              </TouchableOpacity>

              <View style={styles.optionDivider} />

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => setOptionsModalVisible(false)}
              >
                <Text style={[styles.optionText, styles.cancelText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
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
  headerOptionsButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  optionsModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  optionIcon: {
    marginRight: spacing.md,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  optionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  cancelText: {
    color: colors.textSecondary,
    textAlign: "center",
    flex: 1,
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
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  receiptCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  receiptBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  receiptBadgeText: {
    ...typography.small,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  receiptBadgeComplete: {
    backgroundColor: colors.successLight || "#D1FAE5",
  },
  receiptBadgeTextComplete: {
    color: colors.success || "#059669",
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
  ledgerButtonContainer: {
    marginTop: spacing.sm,
  },
  ledgerButton: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  ledgerButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  ledgerButtonArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  recurringButtonContainer: {
    marginTop: spacing.sm,
  },
  recurringButton: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  recurringButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  recurringButtonArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
});
