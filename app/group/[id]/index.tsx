import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";
import { Group, Member, Expense } from "../../../lib/types";
import { formatCurrency, formatRelativeDate } from "../../../lib/utils";
import {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
} from "../../../lib/theme";
import { Card, Avatar, Button } from "../../../components/ui";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      // Fetch expenses with payer info
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select(
          `
          *,
          payer:members!paid_by(id, name)
        `,
        )
        .eq("group_id", id)
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
    } catch (error) {
      console.error("Error fetching group data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleShare = async () => {
    if (!group) return;
    try {
      await Share.share({
        message: `Join my expense group "${group.name}" on SplitFree!\n\nCode: ${group.share_code}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const renderExpense = ({ item }: { item: Expense }) => (
    <Card style={styles.expenseCard}>
      <View style={styles.expenseHeader}>
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

  const ListHeader = () => (
    <View style={styles.header}>
      <View style={styles.groupInfo}>
        <Text style={styles.groupEmoji}>{group?.emoji || "💰"}</Text>
        <View>
          <Text style={styles.groupName}>{group?.name}</Text>
          <TouchableOpacity onPress={handleShare}>
            <Text style={styles.shareCode}>
              Code: {group?.share_code} • Tap to share
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Members</Text>
      <View style={styles.membersRow}>
        {members.map((member) => (
          <View key={member.id} style={styles.memberItem}>
            <Avatar name={member.name} size="md" />
            <Text style={styles.memberName} numberOfLines={1}>
              {member.name}
            </Text>
          </View>
        ))}
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
            <TouchableOpacity onPress={handleShare}>
              <Text style={styles.headerButton}>Share</Text>
            </TouchableOpacity>
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
  headerButton: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  groupInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
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
    width: 56,
  },
  memberName: {
    ...typography.small,
    marginTop: spacing.xs,
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
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
