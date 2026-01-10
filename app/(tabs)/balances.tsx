/**
 * Global Balances Tab Screen
 *
 * Shows Splitwise-style "balances across all groups" summary:
 * - Overall balance summary at the top ("You are owed $X.XX" or "You owe $X.XX")
 * - List of all people the user has balances with across all groups
 * - Each person shows their name and net balance (green if owed to you, red if you owe)
 */

import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import { Avatar } from "../../components/ui";
import {
  getGlobalBalancesForUser,
  PersonBalance,
  UserGlobalBalance,
} from "../../lib/balances";
import { formatCurrency } from "../../lib/utils";
import { useAuth } from "../../lib/auth-context";

export default function BalancesTabScreen() {
  const { userId } = useAuth();
  const [balanceData, setBalanceData] = useState<UserGlobalBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await getGlobalBalancesForUser(userId);
      setBalanceData(data);
    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handlePersonPress = (person: PersonBalance) => {
    // Navigate to the first group where this person has a balance
    if (person.groups.length > 0) {
      router.push(`/group/${person.groups[0].groupId}/balances`);
    }
  };

  const renderPerson = ({ item }: { item: PersonBalance }) => {
    const isOwedToUser = item.netBalance > 0;
    const balanceColor = isOwedToUser ? colors.success : colors.danger;
    const balancePrefix = isOwedToUser ? "owes you " : "you owe ";

    return (
      <TouchableOpacity
        style={styles.personCard}
        onPress={() => handlePersonPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.personLeft}>
          <Avatar name={item.name} size="md" />
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{item.name}</Text>
            <Text style={styles.personGroups}>
              {item.groups.length} group{item.groups.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        <View style={styles.personRight}>
          <Text style={[styles.balanceAmount, { color: balanceColor }]}>
            {formatCurrency(Math.abs(item.netBalance))}
          </Text>
          <Text style={[styles.balanceLabel, { color: balanceColor }]}>
            {balancePrefix}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => {
    if (!balanceData) return null;

    const { totalOwed, totalOwing, netBalance } = balanceData;
    const isPositive = netBalance >= 0;
    const summaryText = isPositive
      ? `Overall, you are owed`
      : `Overall, you owe`;
    const summaryColor = isPositive ? colors.success : colors.danger;

    return (
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Balances</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push("/profile")}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={32} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Overall Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{summaryText}</Text>
          <Text style={[styles.summaryAmount, { color: summaryColor }]}>
            {formatCurrency(Math.abs(netBalance))}
          </Text>

          {/* Breakdown */}
          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.success }]} />
              <Text style={styles.breakdownText}>
                Owed to you: {formatCurrency(totalOwed)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.danger }]} />
              <Text style={styles.breakdownText}>
                You owe: {formatCurrency(totalOwing)}
              </Text>
            </View>
          </View>
        </View>

        {/* Section Header */}
        {balanceData.people.length > 0 && (
          <Text style={styles.sectionTitle}>
            People ({balanceData.people.length})
          </Text>
        )}
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
      </View>
      <Text style={styles.emptyTitle}>All settled up!</Text>
      <Text style={styles.emptySubtitle}>
        You have no outstanding balances with anyone
      </Text>
      <TouchableOpacity
        style={styles.viewGroupsButton}
        onPress={() => router.push("/(tabs)")}
      >
        <Text style={styles.viewGroupsText}>View Groups</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasPeople = balanceData && balanceData.people.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={hasPeople ? balanceData.people : []}
        renderItem={renderPerson}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={balanceData ? EmptyState : null}
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
    </SafeAreaView>
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
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  profileButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h1,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    marginBottom: spacing.lg,
  },
  breakdownContainer: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  breakdownText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  personCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.sm,
  },
  personLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  personInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  personName: {
    ...typography.bodyMedium,
  },
  personGroups: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  personRight: {
    alignItems: "flex-end",
  },
  balanceAmount: {
    ...typography.bodyMedium,
    fontFamily: "Inter_600SemiBold",
  },
  balanceLabel: {
    ...typography.small,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
  },
  emptyIcon: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  viewGroupsButton: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  viewGroupsText: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
});
