/**
 * Friend Requests Screen
 *
 * Shows incoming pending friend requests with accept/reject options.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, typography } from "../../lib/theme";
import { Friendship } from "../../lib/types";
import { useAuth } from "../../lib/auth-context";
import {
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} from "../../lib/friends";
import { FriendCard } from "../../components/ui";

export default function FriendRequestsScreen() {
  const { userId } = useAuth();
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await getPendingRequests(userId);
      setRequests(data);
    } catch (error) {
      __DEV__ && console.error("Error fetching friend requests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const handleAccept = async (friendshipId: string) => {
    setProcessingId(friendshipId);
    try {
      await acceptFriendRequest(friendshipId);
      setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    } catch (error) {
      __DEV__ && console.error("Error accepting friend request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (friendshipId: string) => {
    setProcessingId(friendshipId);
    try {
      await rejectFriendRequest(friendshipId);
      setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    } catch (error) {
      __DEV__ && console.error("Error rejecting friend request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const renderRequest = ({ item }: { item: Friendship }) => (
    <FriendCard
      friendship={item}
      status="pending"
      onAccept={() => handleAccept(item.id)}
      onReject={() => handleReject(item.id)}
      loading={processingId === item.id}
    />
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyText}>No pending requests</Text>
      <Text style={styles.emptySubtext}>
        When someone sends you a friend request, it will appear here
      </Text>
    </View>
  );

  const ListHeader = () => (
    <View style={styles.header}>
      <Text style={styles.sectionTitle}>
        {requests.length === 0
          ? "No Requests"
          : `${requests.length} Request${requests.length !== 1 ? "s" : ""}`}
      </Text>
      {requests.length > 0 && (
        <Text style={styles.sectionSubtitle}>
          Accept or decline friend requests
        </Text>
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
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <FlatList
        data={requests}
        renderItem={renderRequest}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
});
