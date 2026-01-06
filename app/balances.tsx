import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../lib/theme";
import {
  BalanceCard,
  BalanceSummaryCard,
  BalanceEmptyState,
} from "../components/ui/BalanceCard";
import { Avatar } from "../components/ui";
import { getGlobalBalances, GlobalBalance, getAllSuggestedSettlements } from "../lib/balances";
import { formatCurrency } from "../lib/utils";
import { Group, Member } from "../lib/types";

type ViewMode = "groups" | "settlements";

export default function GlobalBalancesScreen() {
  const [globalBalances, setGlobalBalances] = useState<GlobalBalance | null>(null);
  const [suggestedSettlements, setSuggestedSettlements] = useState<
    Array<{ group: Group; from: Member; to: Member; amount: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("groups");

  const fetchData = useCallback(async () => {
    try {
      // Fetch balances first, then pass to settlements to avoid duplicate queries
      const balances = await getGlobalBalances();
      const settlements = await getAllSuggestedSettlements(balances);
      setGlobalBalances(balances);
      setSuggestedSettlements(settlements);
    } catch (error) {
      console.error("Error fetching global balances:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleGroupPress = (groupId: string) => {
    router.push(`/group/${groupId}/balances`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasBalances =
    globalBalances &&
    (globalBalances.totalOwed > 0 || globalBalances.totalOwing > 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: "All Balances",
          headerBackTitle: "Home",
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Card */}
          {globalBalances && (
            <BalanceSummaryCard
              totalOwed={globalBalances.totalOwed}
              totalOwing={globalBalances.totalOwing}
              style={styles.summaryCard}
            />
          )}

          {/* View Mode Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, viewMode === "groups" && styles.tabActive]}
              onPress={() => setViewMode("groups")}
            >
              <Text
                style={[
                  styles.tabText,
                  viewMode === "groups" && styles.tabTextActive,
                ]}
              >
                By Group
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, viewMode === "settlements" && styles.tabActive]}
              onPress={() => setViewMode("settlements")}
            >
              <Text
                style={[
                  styles.tabText,
                  viewMode === "settlements" && styles.tabTextActive,
                ]}
              >
                Settle Up
              </Text>
              {suggestedSettlements.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {suggestedSettlements.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {viewMode === "groups" ? (
            <>
              {/* Group Balances */}
              {!hasBalances ? (
                <BalanceEmptyState
                  title="No outstanding balances"
                  subtitle="All groups are settled up"
                />
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Groups with Balances</Text>
                  {globalBalances?.byGroup
                    .filter(
                      (gb) =>
                        gb.totalOwed > 0.01 || gb.totalOwing > 0.01
                    )
                    .map((groupBalance) => {
                      // Calculate net balance for display
                      const netBalance = groupBalance.totalOwed - groupBalance.totalOwing;
                      return (
                        <BalanceCard
                          key={groupBalance.group.id}
                          name={groupBalance.group.name}
                          emoji={groupBalance.group.emoji}
                          balance={netBalance}
                          currency={groupBalance.group.currency}
                          subtitle={`${groupBalance.expenseCount} expenses • ${groupBalance.memberCount} members`}
                          onPress={() => handleGroupPress(groupBalance.group.id)}
                        />
                      );
                    })}

                  {/* Settled Groups */}
                  {globalBalances?.byGroup.some(
                    (gb) => gb.totalOwed <= 0.01 && gb.totalOwing <= 0.01
                  ) && (
                    <>
                      <Text style={styles.sectionTitle}>Settled Groups</Text>
                      {globalBalances?.byGroup
                        .filter(
                          (gb) =>
                            gb.totalOwed <= 0.01 && gb.totalOwing <= 0.01
                        )
                        .map((groupBalance) => (
                          <BalanceCard
                            key={groupBalance.group.id}
                            name={groupBalance.group.name}
                            emoji={groupBalance.group.emoji}
                            balance={0}
                            currency={groupBalance.group.currency}
                            subtitle={`${groupBalance.expenseCount} expenses`}
                            onPress={() =>
                              handleGroupPress(groupBalance.group.id)
                            }
                          />
                        ))}
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Suggested Settlements */}
              {suggestedSettlements.length === 0 ? (
                <BalanceEmptyState
                  title="All settled up!"
                  subtitle="No payments needed"
                />
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Suggested Payments</Text>
                  <Text style={styles.sectionSubtitle}>
                    Tap a group to record a settlement
                  </Text>
                  {suggestedSettlements.map((settlement, index) => (
                    <TouchableOpacity
                      key={`${settlement.group.id}-${index}`}
                      style={styles.settlementCard}
                      onPress={() => handleGroupPress(settlement.group.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.settlementHeader}>
                        <Text style={styles.settlementGroup}>
                          {settlement.group.emoji} {settlement.group.name}
                        </Text>
                      </View>
                      <View style={styles.settlementContent}>
                        <View style={styles.settlementMember}>
                          <Avatar name={settlement.from.name} size="sm" />
                          <Text style={styles.settlementName}>
                            {settlement.from.name}
                          </Text>
                        </View>
                        <View style={styles.settlementArrow}>
                          <Ionicons
                            name="arrow-forward"
                            size={20}
                            color={colors.textMuted}
                          />
                          <Text style={styles.settlementAmount}>
                            {formatCurrency(
                              settlement.amount,
                              settlement.group.currency
                            )}
                          </Text>
                        </View>
                        <View style={styles.settlementMember}>
                          <Avatar name={settlement.to.name} size="sm" />
                          <Text style={styles.settlementName}>
                            {settlement.to.name}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}

          {/* Quick Stats */}
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Quick Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {globalBalances?.byGroup.length || 0}
                </Text>
                <Text style={styles.statLabel}>Groups</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {globalBalances?.byGroup.reduce(
                    (sum, gb) => sum + gb.memberCount,
                    0
                  ) || 0}
                </Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {suggestedSettlements.length}
                </Text>
                <Text style={styles.statLabel}>Payments</Text>
              </View>
            </View>
          </View>
        </ScrollView>
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  badge: {
    marginLeft: spacing.xs,
    backgroundColor: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionSubtitle: {
    ...typography.small,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  settlementCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  settlementHeader: {
    marginBottom: spacing.md,
  },
  settlementGroup: {
    ...typography.small,
    color: colors.textSecondary,
  },
  settlementContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settlementMember: {
    alignItems: "center",
    width: 80,
  },
  settlementName: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  settlementArrow: {
    alignItems: "center",
  },
  settlementAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
    ...shadows.sm,
  },
  statsTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statLabel: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
});
