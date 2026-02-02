/**
 * Add Friend Screen
 *
 * Search for users by email and send friend requests.
 * Shows outgoing pending requests.
 */

import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { UserProfile, Friendship } from "../../lib/types";
import { useAuth } from "../../lib/auth-context";
import {
  searchUsers,
  sendFriendRequest,
  getOutgoingRequests,
  rejectFriendRequest,
  getFriendshipStatus,
} from "../../lib/friends";
import { FriendCard } from "../../components/ui";
import { getErrorMessage } from '../../lib/logger';

export default function AddFriendScreen() {
  const { userId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [friendshipStatuses, setFriendshipStatuses] = useState<
    Map<string, Friendship | null>
  >(new Map());

  // Fetch outgoing requests on mount
  useEffect(() => {
    const fetchOutgoing = async () => {
      if (!userId) return;
      try {
        const requests = await getOutgoingRequests(userId);
        setOutgoingRequests(requests);
      } catch (error) {
        __DEV__ && console.error("Error fetching outgoing requests:", error);
      }
    };
    fetchOutgoing();
  }, [userId]);

  // Debounced search
  useEffect(() => {
    if (!userId || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(searchQuery, userId);
        setSearchResults(results);

        // Fetch friendship status for each result
        const statuses = new Map<string, Friendship | null>();
        for (const user of results) {
          const status = await getFriendshipStatus(userId, user.clerkId);
          statuses.set(user.clerkId, status);
        }
        setFriendshipStatuses(statuses);
      } catch (error) {
        __DEV__ && console.error("Error searching users:", error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, userId]);

  const handleSendRequest = async (targetClerkId: string) => {
    if (!userId) return;

    setSendingTo(targetClerkId);
    try {
      await sendFriendRequest(userId, targetClerkId);

      // Refresh outgoing requests
      const requests = await getOutgoingRequests(userId);
      setOutgoingRequests(requests);

      // Update friendship status in search results
      const newStatus = await getFriendshipStatus(userId, targetClerkId);
      setFriendshipStatuses((prev) => {
        const updated = new Map(prev);
        updated.set(targetClerkId, newStatus);
        return updated;
      });
    } catch (error: unknown) {
      __DEV__ && console.error("Error sending friend request:", error);
      // Could show an alert here with getErrorMessage(error)
    } finally {
      setSendingTo(null);
    }
  };

  const handleCancelRequest = async (friendshipId: string) => {
    setCancelingId(friendshipId);
    try {
      await rejectFriendRequest(friendshipId);
      setOutgoingRequests((prev) => prev.filter((r) => r.id !== friendshipId));

      // Update search results status if applicable
      const canceled = outgoingRequests.find((r) => r.id === friendshipId);
      if (canceled) {
        setFriendshipStatuses((prev) => {
          const updated = new Map(prev);
          updated.set(canceled.addresseeId, null);
          return updated;
        });
      }
    } catch (error) {
      __DEV__ && console.error("Error canceling request:", error);
    } finally {
      setCancelingId(null);
    }
  };

  const getStatusForUser = (clerkId: string): "none" | "pending" | "accepted" | "outgoing" => {
    const friendship = friendshipStatuses.get(clerkId);
    if (!friendship) return "none";

    if (friendship.status === "accepted") return "accepted";
    if (friendship.status === "pending") {
      // Check if this is an outgoing request from current user
      if (friendship.requesterId === userId) return "outgoing";
      return "pending";
    }
    return "none";
  };

  const renderSearchResult = ({ item }: { item: UserProfile }) => {
    const status = getStatusForUser(item.clerkId);
    const friendship = friendshipStatuses.get(item.clerkId);

    return (
      <FriendCard
        user={item}
        status={status}
        onAddFriend={
          status === "none" ? () => handleSendRequest(item.clerkId) : undefined
        }
        onReject={
          status === "outgoing" && friendship
            ? () => handleCancelRequest(friendship.id)
            : undefined
        }
        loading={sendingTo === item.clerkId}
      />
    );
  };

  const renderOutgoingRequest = ({ item }: { item: Friendship }) => (
    <FriendCard
      friendship={item}
      status="outgoing"
      onReject={() => handleCancelRequest(item.id)}
      loading={cancelingId === item.id}
    />
  );

  const showOutgoing = searchQuery.length < 2 && outgoingRequests.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        {/* Search Input */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by email or name..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text style={styles.clearButton}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <Text style={styles.searchHint}>
              Type at least 2 characters to search
            </Text>
          )}
        </View>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <View style={styles.resultsSection}>
            {searching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyText}>No users found</Text>
                <Text style={styles.emptySubtext}>
                  Try a different email or name
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""}
                </Text>
                <FlatList
                  data={searchResults}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.clerkId}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        )}

        {/* Outgoing Requests (when not searching) */}
        {showOutgoing && (
          <View style={styles.outgoingSection}>
            <Text style={styles.sectionTitle}>
              Pending Requests ({outgoingRequests.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Friend requests you've sent
            </Text>
            <FlatList
              data={outgoingRequests}
              renderItem={renderOutgoingRequest}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={styles.outgoingList}
            />
          </View>
        )}

        {/* Empty state when no search and no outgoing */}
        {searchQuery.length < 2 && outgoingRequests.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>Find Friends</Text>
            <Text style={styles.emptySubtext}>
              Search by email or name to add friends and split expenses together
            </Text>
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
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
  searchHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  resultsSection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  outgoingSection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  outgoingList: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptySubtext: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: "center",
  },
});
