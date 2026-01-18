/**
 * Friends List Screen
 *
 * Displays all accepted friends with search functionality.
 * Provides access to add friends and view friend requests.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { Friendship } from "../../lib/types";
import { useAuth } from "../../lib/auth-context";
import { getFriends, getPendingRequestCount, removeFriend } from "../../lib/friends";
import { FriendCard, Card } from "../../components/ui";

export default function FriendsListScreen() {
  const { userId } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friendship[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const [friendsData, count] = await Promise.all([
        getFriends(userId),
        getPendingRequestCount(userId),
      ]);

      setFriends(friendsData);
      setFilteredFriends(friendsData);
      setPendingCount(count);
    } catch (error) {
      console.error("Error fetching friends:", error);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = friends.filter((f) => {
      const name = f.friend?.displayName?.toLowerCase() || "";
      const email = f.friend?.email?.toLowerCase() || "";
      return name.includes(lowerQuery) || email.includes(lowerQuery);
    });
    setFilteredFriends(filtered);
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    setRemovingId(friendshipId);
    try {
      await removeFriend(friendshipId);
      setFriends((prev) => prev.filter((f) => f.id !== friendshipId));
      setFilteredFriends((prev) => prev.filter((f) => f.id !== friendshipId));
    } catch (error) {
      console.error("Error removing friend:", error);
    } finally {
      setRemovingId(null);
    }
  };

  const renderFriend = ({ item }: { item: Friendship }) => (
    <FriendCard
      friendship={item}
      status="accepted"
      onRemove={() => handleRemoveFriend(item.id)}
      loading={removingId === item.id}
    />
  );

  const ListHeader = () => (
    <View style={styles.header}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Text style={styles.clearButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Friend Requests Badge */}
      {pendingCount > 0 && (
        <TouchableOpacity
          style={styles.requestsCard}
          onPress={() => router.push("/friends/requests")}
          activeOpacity={0.7}
        >
          <View style={styles.requestsLeft}>
            <Text style={styles.requestsIcon}>📬</Text>
            <View>
              <Text style={styles.requestsTitle}>Friend Requests</Text>
              <Text style={styles.requestsSubtitle}>
                {pendingCount} pending request{pendingCount > 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <View style={styles.requestsBadge}>
            <Text style={styles.requestsBadgeText}>{pendingCount}</Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>
        {filteredFriends.length === 0
          ? "No friends found"
          : `${filteredFriends.length} Friend${filteredFriends.length !== 1 ? "s" : ""}`}
      </Text>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>👋</Text>
      <Text style={styles.emptyText}>
        {searchQuery ? "No friends match your search" : "No friends yet"}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery
          ? "Try a different search term"
          : "Add friends to split expenses together"}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/friends/add")}
        >
          <Text style={styles.addButtonText}>Add Friend</Text>
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
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push("/friends/add")}>
              <Text style={styles.headerButton}>+ Add</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <FlatList
          data={filteredFriends}
          renderItem={renderFriend}
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
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerButton: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    color: colors.text,
  },
  clearButton: {
    fontSize: 16,
    color: colors.textMuted,
    paddingLeft: spacing.sm,
  },
  requestsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  requestsLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  requestsIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  requestsTitle: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
  requestsSubtitle: {
    ...typography.caption,
    color: colors.primaryDark,
    marginTop: 2,
  },
  requestsBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 28,
    alignItems: "center",
  },
  requestsBadgeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
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
    textAlign: "center",
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 16,
  },
});
