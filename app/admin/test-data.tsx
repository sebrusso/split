/**
 * Admin Test Data Manager
 *
 * This screen allows you to view all groups and members in the database
 * and link your Clerk user ID to members that should be associated with your account.
 *
 * Access via: /admin/test-data
 */

import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSupabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";

interface Member {
  id: string;
  name: string;
  clerk_user_id: string | null;
  group_id: string;
}

interface Group {
  id: string;
  name: string;
  emoji: string | null;
  share_code: string;
  created_at: string;
  archived_at: string | null;
  members: Member[];
  expense_count: number;
}

export default function TestDataScreen() {
  // Block access in production builds
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const { userId, user } = useAuth();
  const { getSupabase } = useSupabase();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myMemberCount, setMyMemberCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const supabase = await getSupabase();
      // Fetch all groups with members
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select(`
          *,
          members (id, name, clerk_user_id, group_id)
        `)
        .order("created_at", { ascending: false });

      if (groupsError) throw groupsError;

      // Get expense counts for each group
      const groupsWithCounts: Group[] = [];
      for (const group of groupsData || []) {
        const { count } = await supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id);

        groupsWithCounts.push({
          ...group,
          expense_count: count || 0,
        });
      }

      setGroups(groupsWithCounts);

      // Count how many members are linked to current user
      const myCount = groupsWithCounts.reduce((acc, g) => {
        return acc + g.members.filter(m => m.clerk_user_id === userId).length;
      }, 0);
      setMyMemberCount(myCount);
    } catch (error) {
      __DEV__ && console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to fetch data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, getSupabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const linkMemberToMe = async (memberId: string, memberName: string) => {
    if (!userId) {
      Alert.alert("Error", "You must be signed in to link members");
      return;
    }

    Alert.alert(
      "Link Member",
      `Link "${memberName}" to your account?\n\nYour Clerk ID: ${userId.substring(0, 20)}...`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Link",
          onPress: async () => {
            try {
              const supabase = await getSupabase();
              const { error } = await supabase
                .from("members")
                .update({ clerk_user_id: userId })
                .eq("id", memberId);

              if (error) throw error;

              Alert.alert("Success", `"${memberName}" is now linked to your account`);
              fetchData();
            } catch (error) {
              __DEV__ && console.error("Error linking member:", error);
              Alert.alert("Error", "Failed to link member");
            }
          },
        },
      ]
    );
  };

  const unlinkMember = async (memberId: string, memberName: string) => {
    Alert.alert(
      "Unlink Member",
      `Remove link for "${memberName}"? This will make them a guest member again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            try {
              const supabase = await getSupabase();
              const { error } = await supabase
                .from("members")
                .update({ clerk_user_id: null })
                .eq("id", memberId);

              if (error) throw error;

              Alert.alert("Success", `"${memberName}" is now a guest member`);
              fetchData();
            } catch (error) {
              __DEV__ && console.error("Error unlinking member:", error);
              Alert.alert("Error", "Failed to unlink member");
            }
          },
        },
      ]
    );
  };

  const linkAllMyMembers = async () => {
    if (!userId || !user) {
      Alert.alert("Error", "You must be signed in");
      return;
    }

    // Find all members that match the user's display name
    const displayName = user.displayName;
    const matchingMembers: { id: string; name: string; groupName: string }[] = [];

    for (const group of groups) {
      for (const member of group.members) {
        // Check if member name matches and is not already linked
        const nameMatches =
          member.name.toLowerCase() === displayName?.toLowerCase() ||
          member.name.toLowerCase().includes(displayName?.toLowerCase() || "") ||
          displayName?.toLowerCase().includes(member.name.toLowerCase());

        if (nameMatches && !member.clerk_user_id) {
          matchingMembers.push({
            id: member.id,
            name: member.name,
            groupName: group.name,
          });
        }
      }
    }

    if (matchingMembers.length === 0) {
      Alert.alert(
        "No Matches",
        `No unlinked members found matching "${displayName}". You may need to manually link members.`
      );
      return;
    }

    const memberList = matchingMembers
      .map((m) => `• "${m.name}" in ${m.groupName}`)
      .join("\n");

    Alert.alert(
      "Link Matching Members",
      `Found ${matchingMembers.length} member(s) matching "${displayName}":\n\n${memberList}\n\nLink all to your account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Link All",
          onPress: async () => {
            try {
              const supabase = await getSupabase();
              for (const member of matchingMembers) {
                await supabase
                  .from("members")
                  .update({ clerk_user_id: userId })
                  .eq("id", member.id);
              }

              Alert.alert(
                "Success",
                `Linked ${matchingMembers.length} member(s) to your account`
              );
              fetchData();
            } catch (error) {
              __DEV__ && console.error("Error linking members:", error);
              Alert.alert("Error", "Failed to link some members");
            }
          },
        },
      ]
    );
  };

  const renderMember = (member: Member, groupName: string) => {
    const isLinkedToMe = member.clerk_user_id === userId;
    const isLinkedToOther = member.clerk_user_id && !isLinkedToMe;

    return (
      <View key={member.id} style={styles.memberRow}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.memberStatus}>
            {isLinkedToMe
              ? "✓ Linked to YOU"
              : isLinkedToOther
              ? `⚠ Linked to: ${member.clerk_user_id?.substring(0, 15)}...`
              : "○ Guest (not linked)"}
          </Text>
        </View>
        <View style={styles.memberActions}>
          {!member.clerk_user_id && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => linkMemberToMe(member.id, member.name)}
            >
              <Ionicons name="link" size={16} color={colors.white} />
              <Text style={styles.linkButtonText}>Link to Me</Text>
            </TouchableOpacity>
          )}
          {isLinkedToMe && (
            <TouchableOpacity
              style={styles.unlinkButton}
              onPress={() => unlinkMember(member.id, member.name)}
            >
              <Ionicons name="unlink" size={16} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupEmoji}>{item.emoji || "💰"}</Text>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMeta}>
            Code: {item.share_code} • {item.members.length} members • {item.expense_count} expenses
          </Text>
          {item.archived_at && (
            <Text style={styles.archivedBadge}>ARCHIVED</Text>
          )}
        </View>
      </View>
      <View style={styles.membersList}>
        {item.members.map((m) => renderMember(m, item.name))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Test Data Manager",
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      {/* User Info Header */}
      <View style={styles.userInfoCard}>
        <Text style={styles.userInfoTitle}>Your Account</Text>
        <Text style={styles.userInfoText}>
          Display Name: {user?.displayName || "Not signed in"}
        </Text>
        <Text style={styles.userInfoText}>
          Clerk ID: {userId ? `${userId.substring(0, 30)}...` : "Not signed in"}
        </Text>
        <Text style={styles.userInfoText}>
          Linked Members: {myMemberCount} across {groups.filter(g => g.members.some(m => m.clerk_user_id === userId)).length} groups
        </Text>

        <TouchableOpacity
          style={styles.autoLinkButton}
          onPress={linkAllMyMembers}
        >
          <Ionicons name="flash" size={18} color={colors.white} />
          <Text style={styles.autoLinkButtonText}>Auto-Link Matching Members</Text>
        </TouchableOpacity>
      </View>

      {/* Groups List */}
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
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>
            All Groups ({groups.length})
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <Text style={styles.emptyText}>Loading...</Text>
          ) : (
            <Text style={styles.emptyText}>No groups found</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  userInfoCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
  },
  userInfoTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  userInfoText: {
    ...typography.small,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  autoLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  autoLinkButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    ...typography.h3,
  },
  groupMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  archivedBadge: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  membersList: {
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.bodyMedium,
    fontWeight: "500",
  },
  memberStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  linkButtonText: {
    ...typography.small,
    color: colors.white,
    fontWeight: "500",
  },
  unlinkButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
