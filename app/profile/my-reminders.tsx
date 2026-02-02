/**
 * My Reminders Screen
 *
 * Shows payment reminders the user has created and received.
 * Allows dismissing reminders and marking debts as paid.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import { useAuth } from "../../lib/auth-context";
import { useSupabase } from "../../lib/supabase";
import {
  PaymentReminder,
  getRemindersByCreator,
  getRemindersForDebtor,
  updateReminderStatus,
  deleteReminder,
} from "../../lib/payment-reminders";
import { formatCurrency, formatRelativeDate } from "../../lib/utils";
import { Card, Avatar } from "../../components/ui";

type TabType = "sent" | "received";

export default function MyRemindersScreen() {
  const { userId } = useAuth();
  const { getSupabase } = useSupabase();
  const [activeTab, setActiveTab] = useState<TabType>("sent");
  const [sentReminders, setSentReminders] = useState<PaymentReminder[]>([]);
  const [receivedReminders, setReceivedReminders] = useState<PaymentReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = await getSupabase();
      const [sent, received] = await Promise.all([
        getRemindersByCreator(supabase, userId),
        getRemindersForDebtor(supabase, userId),
      ]);
      setSentReminders(sent);
      setReceivedReminders(received);
    } catch (error) {
      __DEV__ && console.error("Error fetching reminders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, getSupabase]);

  useFocusEffect(
    useCallback(() => {
      fetchReminders();
    }, [fetchReminders])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReminders();
  }, [fetchReminders]);

  const handleDismissReminder = async (reminder: PaymentReminder) => {
    Alert.alert(
      "Dismiss Reminder",
      "Are you sure you want to dismiss this reminder?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Dismiss",
          style: "destructive",
          onPress: async () => {
            const supabase = await getSupabase();
            const success = await updateReminderStatus(supabase, reminder.id, "dismissed");
            if (success) {
              fetchReminders();
            } else {
              Alert.alert("Error", "Failed to dismiss reminder");
            }
          },
        },
      ]
    );
  };

  const handleMarkAsPaid = async (reminder: PaymentReminder) => {
    Alert.alert(
      "Mark as Paid",
      "Mark this payment as completed? This will update the reminder status.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Paid",
          onPress: async () => {
            const supabase = await getSupabase();
            const success = await updateReminderStatus(supabase, reminder.id, "paid");
            if (success) {
              fetchReminders();
            } else {
              Alert.alert("Error", "Failed to update reminder");
            }
          },
        },
      ]
    );
  };

  const handleDeleteReminder = async (reminder: PaymentReminder) => {
    Alert.alert(
      "Delete Reminder",
      "Are you sure you want to delete this reminder?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const supabase = await getSupabase();
            const success = await deleteReminder(supabase, reminder.id);
            if (success) {
              fetchReminders();
            } else {
              Alert.alert("Error", "Failed to delete reminder");
            }
          },
        },
      ]
    );
  };

  const handleGoToGroup = (groupId: string) => {
    router.push(`/group/${groupId}/balances`);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "pending":
        return colors.warning;
      case "sent":
        return colors.primary;
      case "paid":
        return colors.success;
      case "dismissed":
        return colors.textMuted;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "pending":
        return "Scheduled";
      case "sent":
        return "Sent";
      case "paid":
        return "Paid";
      case "dismissed":
        return "Dismissed";
      default:
        return status;
    }
  };

  const renderSentReminder = ({ item }: { item: PaymentReminder }) => {
    const isPending = item.status === "pending" || item.status === "sent";

    return (
      <Card style={styles.reminderCard}>
        <TouchableOpacity
          style={styles.reminderContent}
          onPress={() => handleGoToGroup(item.groupId)}
          activeOpacity={0.7}
        >
          <View style={styles.reminderLeft}>
            <Avatar name={item.fromMember?.name || "?"} size="md" />
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderName}>
                {item.fromMember?.name || "Unknown"}
              </Text>
              <Text style={styles.reminderGroup}>
                {item.group?.name || "Unknown group"}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(item.status) + "20" },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: getStatusColor(item.status) }]}
                  >
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
                <Text style={styles.reminderDate}>
                  {formatRelativeDate(item.createdAt)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.reminderRight}>
            <Text style={styles.reminderAmount}>
              {formatCurrency(item.amount, item.group?.currency)}
            </Text>
            {isPending && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteReminder(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  const renderReceivedReminder = ({ item }: { item: PaymentReminder }) => {
    return (
      <Card style={styles.reminderCard}>
        <TouchableOpacity
          style={styles.reminderContent}
          onPress={() => handleGoToGroup(item.groupId)}
          activeOpacity={0.7}
        >
          <View style={styles.reminderLeft}>
            <Avatar name={item.toMember?.name || "?"} size="md" />
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderName}>
                Pay {item.toMember?.name || "Unknown"}
              </Text>
              <Text style={styles.reminderGroup}>
                {item.group?.name || "Unknown group"}
              </Text>
              <Text style={styles.reminderDate}>
                Reminder sent {formatRelativeDate(item.sentAt || item.createdAt)}
              </Text>
            </View>
          </View>
          <View style={styles.reminderRight}>
            <Text style={[styles.reminderAmount, { color: colors.danger }]}>
              {formatCurrency(item.amount, item.group?.currency)}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => handleDismissReminder(item)}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.paidButton}
            onPress={() => handleMarkAsPaid(item)}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={styles.paidButtonText}>Mark Paid</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const EmptyState = ({ type }: { type: TabType }) => (
    <View style={styles.emptyState}>
      <Ionicons
        name={type === "sent" ? "notifications-off-outline" : "happy-outline"}
        size={48}
        color={colors.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {type === "sent" ? "No reminders sent" : "No reminders"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {type === "sent"
          ? "When you send payment reminders, they'll appear here"
          : "You don't have any pending payment reminders"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "My Reminders" }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const currentData = activeTab === "sent" ? sentReminders : receivedReminders;

  return (
    <>
      <Stack.Screen options={{ title: "My Reminders" }} />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "sent" && styles.tabActive]}
            onPress={() => setActiveTab("sent")}
          >
            <Ionicons
              name="paper-plane-outline"
              size={18}
              color={activeTab === "sent" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "sent" && styles.tabTextActive,
              ]}
            >
              Sent ({sentReminders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "received" && styles.tabActive]}
            onPress={() => setActiveTab("received")}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={activeTab === "received" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "received" && styles.tabTextActive,
              ]}
            >
              Received ({receivedReminders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reminders List */}
        <FlatList
          data={currentData}
          renderItem={activeTab === "sent" ? renderSentReminder : renderReceivedReminder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState type={activeTab} />}
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
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  reminderCard: {
    marginBottom: spacing.sm,
  },
  reminderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reminderLeft: {
    flexDirection: "row",
    flex: 1,
  },
  reminderInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  reminderName: {
    ...typography.bodyMedium,
  },
  reminderGroup: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.small,
    fontSize: 11,
    fontWeight: "600",
  },
  reminderDate: {
    ...typography.small,
    color: colors.textMuted,
  },
  reminderRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  reminderAmount: {
    ...typography.bodyMedium,
    fontWeight: "600",
    color: colors.success,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  actionButtons: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  dismissButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  dismissButtonText: {
    ...typography.small,
    color: colors.textMuted,
  },
  paidButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.success + "15",
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  paidButtonText: {
    ...typography.small,
    color: colors.success,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
