import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { Group, GlobalBalance } from "../lib/types";
import logger from "../lib/logger";
import {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
} from "../lib/theme";
import { Button, Card, Avatar } from "../components/ui";
import { SearchBarCompact } from "../components/ui/SearchBar";
import { getGlobalBalances } from "../lib/balances";
import { formatCurrency } from "../lib/utils";
import { useAuth } from "../lib/auth-context";

export default function HomeScreen() {
  const { user } = useUser();
  const { userId } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [globalBalance, setGlobalBalance] = useState<GlobalBalance | null>(null);

  const displayName = user?.fullName || user?.firstName || user?.username || "User";
  const avatarUrl = user?.imageUrl;

  const fetchData = useCallback(async () => {
    try {
      // If no user is logged in, show empty state
      if (!userId) {
        setGroups([]);
        setGlobalBalance(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // First, get all group IDs where the user is a member
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("group_id")
        .eq("clerk_user_id", userId);

      if (memberError) throw memberError;

      const userGroupIds = (memberData || []).map((m) => m.group_id);

      // If user has no groups, show empty state
      if (userGroupIds.length === 0) {
        setGroups([]);
        setGlobalBalance(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch groups and balances in parallel
      // Filter to only groups the user is a member of and not archived
      const [groupsResponse, balances] = await Promise.all([
        supabase
          .from("groups")
          .select("*")
          .in("id", userGroupIds)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
        getGlobalBalances(),
      ]);

      if (groupsResponse.error) throw groupsResponse.error;

      // Sort groups: pinned first, then by created_at
      const sortedGroups = (groupsResponse.data || []).sort((a, b) => {
        // Pinned groups come first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Within same pinned state, sort by created_at (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setGroups(sortedGroups);
      setGlobalBalance(balances);
    } catch (error) {
      logger.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const renderGroup = ({ item }: { item: Group }) => (
    <Card
      style={styles.groupCard}
      onPress={() => router.push(`/group/${item.id}`)}
    >
      <View style={styles.groupHeader}>
        <Text style={styles.groupEmoji}>{item.emoji || "💰"}</Text>
        <View style={styles.groupInfo}>
          <View style={styles.groupNameRow}>
            <Text style={styles.groupName}>{item.name}</Text>
            {item.pinned && (
              <Ionicons
                name="star"
                size={16}
                color={colors.warning}
                style={styles.pinIcon}
              />
            )}
          </View>
          <Text style={styles.groupCode}>Code: {item.share_code}</Text>
        </View>
      </View>
    </Card>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>💸</Text>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptySubtitle}>
        Create a group to start splitting expenses with friends
      </Text>
      <Button
        title="Create Your First Group"
        onPress={() => router.push("/create-group")}
        style={styles.emptyButton}
      />
    </View>
  );

  const hasOutstandingBalance =
    globalBalance &&
    (globalBalance.totalOwed > 0.01 || globalBalance.totalOwing > 0.01);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>SplitFree</Text>
            <Text style={styles.subtitle}>Split expenses, stay friends</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push("/profile")}
            activeOpacity={0.8}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
            ) : (
              <Avatar name={displayName} size="md" />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <SearchBarCompact
          onPress={() => router.push("/search")}
          style={styles.searchBar}
        />

        {/* Balance Summary Card */}
        {hasOutstandingBalance && (
          <TouchableOpacity
            style={styles.balanceSummary}
            onPress={() => router.push("/balances")}
            activeOpacity={0.7}
          >
            <View style={styles.balanceSummaryContent}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>You are owed</Text>
                <Text style={[styles.balanceValue, styles.balanceOwed]}>
                  {formatCurrency(globalBalance.totalOwed)}
                </Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>You owe</Text>
                <Text style={[styles.balanceValue, styles.balanceOwing]}>
                  {formatCurrency(globalBalance.totalOwing)}
                </Text>
              </View>
            </View>
            <View style={styles.balanceArrow}>
              <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {groups.length === 0 && !loading ? (
        <EmptyState />
      ) : (
        <>
          <FlatList
            data={groups}
            renderItem={renderGroup}
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
          <View style={styles.fabContainer}>
            <TouchableOpacity
              style={styles.fabSecondary}
              onPress={() => router.push("/join")}
              activeOpacity={0.8}
            >
              <Text style={styles.fabSecondaryText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => router.push("/create-group")}
              activeOpacity={0.8}
            >
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  profileButton: {
    marginTop: spacing.xs,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchBar: {
    marginTop: spacing.lg,
  },
  balanceSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  balanceSummaryContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  balanceItem: {
    flex: 1,
    alignItems: "center",
  },
  balanceLabel: {
    ...typography.small,
    color: colors.primaryDark,
  },
  balanceValue: {
    ...typography.bodyMedium,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  balanceOwed: {
    color: colors.success,
  },
  balanceOwing: {
    color: colors.danger,
  },
  balanceDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.primaryDark,
    opacity: 0.2,
  },
  balanceArrow: {
    marginLeft: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  groupCard: {
    marginBottom: spacing.md,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupEmoji: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  groupInfo: {
    flex: 1,
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupName: {
    ...typography.h3,
  },
  pinIcon: {
    marginLeft: spacing.xs,
  },
  groupCode: {
    ...typography.small,
    marginTop: spacing.xs,
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
    ...typography.h2,
    textAlign: "center",
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    width: "100%",
  },
  fabContainer: {
    position: "absolute",
    bottom: spacing.xl,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  fabSecondary: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.md,
  },
  fabSecondaryText: {
    fontSize: 16,
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.lg,
  },
  fabText: {
    fontSize: 28,
    color: colors.white,
    fontFamily: "Inter_400Regular",
    marginTop: -2,
  },
});
