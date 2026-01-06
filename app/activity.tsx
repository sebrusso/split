/**
 * Global Activity Feed Screen
 *
 * Shows recent activity across all groups the user is a member of.
 * Users can filter by activity type and tap to navigate to relevant items.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, typography, borderRadius, shadows } from "../lib/theme";
import { ActivityItem, ActivityAction } from "../lib/types";
import { useAuth } from "../lib/auth-context";
import { getGlobalActivity, getActivityIcon } from "../lib/activity";
import { ActivityItemComponent } from "../components/ui";

type FilterType = "all" | ActivityAction;

interface FilterOption {
  key: FilterType;
  label: string;
  icon: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: "all", label: "All", icon: "📋" },
  { key: "expense_added", label: "Expenses", icon: "💰" },
  { key: "settlement_recorded", label: "Payments", icon: "✅" },
  { key: "member_joined", label: "Members", icon: "👋" },
];

export default function ActivityScreen() {
  const { userId } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const fetchActivity = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await getGlobalActivity(userId);
      setActivities(data);
      applyFilter(activeFilter, data);
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, activeFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchActivity();
    }, [fetchActivity])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivity();
  }, [fetchActivity]);

  const applyFilter = (filter: FilterType, data: ActivityItem[] = activities) => {
    setActiveFilter(filter);
    if (filter === "all") {
      setFilteredActivities(data);
    } else {
      setFilteredActivities(data.filter((a) => a.action === filter));
    }
  };

  const handleActivityPress = (activity: ActivityItem) => {
    // Navigate to the relevant screen based on activity type
    if (activity.groupId) {
      if (activity.entityType === "expense" && activity.entityId) {
        router.push(`/group/${activity.groupId}/expense/${activity.entityId}`);
      } else {
        router.push(`/group/${activity.groupId}`);
      }
    }
  };

  const renderFilter = ({ item }: { item: FilterOption }) => {
    const isActive = activeFilter === item.key;
    return (
      <TouchableOpacity
        style={[styles.filterButton, isActive && styles.filterButtonActive]}
        onPress={() => applyFilter(item.key)}
        activeOpacity={0.7}
      >
        <Text style={styles.filterIcon}>{item.icon}</Text>
        <Text
          style={[styles.filterText, isActive && styles.filterTextActive]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderActivity = ({ item }: { item: ActivityItem }) => (
    <ActivityItemComponent
      activity={item}
      showGroup={true}
      onPress={() => handleActivityPress(item)}
    />
  );

  const ListHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.subtitle}>Recent updates from your groups</Text>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
        style={styles.filterScroll}
      >
        {FILTER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterButton,
              activeFilter === option.key && styles.filterButtonActive,
            ]}
            onPress={() => applyFilter(option.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.filterIcon}>{option.icon}</Text>
            <Text
              style={[
                styles.filterText,
                activeFilter === option.key && styles.filterTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredActivities.length} activit
          {filteredActivities.length === 1 ? "y" : "ies"}
        </Text>
      </View>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyText}>No activity yet</Text>
      <Text style={styles.emptySubtext}>
        {activeFilter === "all"
          ? "Activity from your groups will appear here"
          : "No activities match this filter"}
      </Text>
      {activeFilter !== "all" && (
        <TouchableOpacity
          style={styles.clearFilterButton}
          onPress={() => applyFilter("all")}
        >
          <Text style={styles.clearFilterText}>Show All</Text>
        </TouchableOpacity>
      )}
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
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <FlatList
        data={filteredActivities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
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
    backgroundColor: colors.background,
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
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    marginBottom: spacing.lg,
  },
  filterScroll: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
  },
  filterContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flexDirection: "row",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primaryDark,
  },
  countRow: {
    marginTop: spacing.sm,
  },
  countText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
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
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  clearFilterButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  clearFilterText: {
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
