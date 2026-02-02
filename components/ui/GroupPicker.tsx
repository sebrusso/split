/**
 * GroupPicker Component
 *
 * Modal for selecting a group from user's groups, with option to create new.
 * Used in the receipt assignment flow.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import { useSupabase } from "../../lib/supabase";
import { Group } from "../../lib/types";

interface GroupPickerProps {
  visible: boolean;
  selectedGroupId?: string | null;
  clerkUserId: string;
  onSelect: (groupId: string, groupName: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
  title?: string;
}

export function GroupPicker({
  visible,
  selectedGroupId,
  clerkUserId,
  onSelect,
  onCreateNew,
  onClose,
  title = "Select Group",
}: GroupPickerProps) {
  const { getSupabase } = useSupabase();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGroups = useCallback(async () => {
    if (!clerkUserId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      const supabase = await getSupabase();
      // Get all group IDs where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("group_id")
        .eq("clerk_user_id", clerkUserId);

      if (memberError) throw memberError;

      const groupIds = (memberData || []).map((m) => m.group_id);

      if (groupIds.length === 0) {
        setGroups([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("*")
        .in("id", groupIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);
    } catch (error) {
      __DEV__ && console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clerkUserId, getSupabase]);

  useEffect(() => {
    if (visible) {
      fetchGroups();
    }
  }, [visible, fetchGroups]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (group: Group) => {
    onSelect(group.id, group.name);
    onClose();
  };

  const handleCreateNew = () => {
    onCreateNew();
    // Don't close - let parent handle the flow
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.container}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          {/* Create New Group Button */}
          <TouchableOpacity
            style={styles.createNewButton}
            onPress={handleCreateNew}
            activeOpacity={0.7}
          >
            <View style={styles.createNewIcon}>
              <Ionicons name="add" size={24} color={colors.white} />
            </View>
            <Text style={styles.createNewText}>Create New Group</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {/* Search Input */}
          {groups.length > 5 && (
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={colors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search groups..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Groups List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading groups...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🏠</Text>
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first group to add this receipt
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
            >
              {filteredGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.groupRow,
                    selectedGroupId === group.id && styles.groupRowSelected,
                  ]}
                  onPress={() => handleSelect(group)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.groupEmoji}>{group.emoji || "💰"}</Text>
                  <View style={styles.groupInfo}>
                    <Text
                      style={[
                        styles.groupName,
                        selectedGroupId === group.id && styles.groupNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {group.name}
                    </Text>
                    <Text style={styles.groupCurrency}>
                      {group.currency || "USD"}
                    </Text>
                  </View>
                  {selectedGroupId === group.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}

              {filteredGroups.length === 0 && searchQuery && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>
                    No groups matching "{searchQuery}"
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Button to display selected group and trigger picker
 */
interface GroupPickerButtonProps {
  selectedGroup?: { id: string; name: string; emoji?: string } | null;
  onPress: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function GroupPickerButton({
  selectedGroup,
  onPress,
  placeholder = "Select a group",
  disabled = false,
}: GroupPickerButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      {selectedGroup ? (
        <>
          <Text style={styles.buttonEmoji}>{selectedGroup.emoji || "💰"}</Text>
          <Text style={styles.buttonText} numberOfLines={1}>
            {selectedGroup.name}
          </Text>
        </>
      ) : (
        <Text style={styles.buttonPlaceholder}>{placeholder}</Text>
      )}
      <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: "80%",
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  createNewButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  createNewIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  createNewText: {
    ...typography.bodyMedium,
    flex: 1,
    color: colors.primary,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    height: "100%",
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  groupRowSelected: {
    backgroundColor: colors.primaryLight,
  },
  groupEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    ...typography.bodyMedium,
    fontWeight: "500",
  },
  groupNameSelected: {
    color: colors.primary,
  },
  groupCurrency: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: "center",
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  noResultsContainer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  noResultsText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  // Button styles
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  buttonText: {
    ...typography.body,
    flex: 1,
    color: colors.text,
  },
  buttonPlaceholder: {
    ...typography.body,
    flex: 1,
    color: colors.textMuted,
  },
});
