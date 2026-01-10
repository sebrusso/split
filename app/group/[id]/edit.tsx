import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";
import { generateShareCode, formatCurrency, calculateBalancesWithSettlements } from "../../../lib/utils";
import logger from "../../../lib/logger";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import { Button, Input, Card } from "../../../components/ui";
import { Group, Member, Expense, SettlementRecord } from "../../../lib/types";
import { useAuth } from "../../../lib/auth-context";
import { getMemberByUserId } from "../../../lib/members";

const EMOJIS = [
  "💰",
  "🏠",
  "✈️",
  "🍕",
  "🎉",
  "👥",
  "💳",
  "🛒",
  "🎬",
  "⛽",
  "🏖️",
  "🎮",
];

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
];

export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [userMember, setUserMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💰");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isFetching = useRef(false);

  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      // Fetch group, members, expenses, and settlements in parallel
      const [groupResult, membersResult, expensesResult, settlementsResult] = await Promise.all([
        supabase.from("groups").select("*").eq("id", id).single(),
        supabase.from("members").select("*").eq("group_id", id),
        supabase.from("expenses").select("*, splits(member_id, amount)").eq("group_id", id).is("deleted_at", null),
        supabase.from("settlements").select("*").eq("group_id", id),
      ]);

      if (groupResult.error) throw groupResult.error;
      const groupData = groupResult.data;
      setGroup(groupData);
      setName(groupData.name);
      setEmoji(groupData.emoji);
      setCurrency(groupData.currency || "USD");
      setNotes(groupData.notes || "");

      const membersData = membersResult.data || [];
      setMembers(membersData);

      // Check if the current user has a claimed member in this group
      let claimedMember: Member | null = null;
      if (userId) {
        claimedMember = membersData.find((m) => m.clerk_user_id === userId) || null;
        setUserMember(claimedMember);
      }

      // Calculate user's balance if they have a claimed member
      if (claimedMember) {
        const expensesForCalc = (expensesResult.data || []).map((exp) => ({
          paid_by: exp.paid_by,
          amount: parseFloat(String(exp.amount)),
          splits: (exp.splits || []).map((s: { member_id: string; amount: number }) => ({
            member_id: s.member_id,
            amount: parseFloat(String(s.amount)),
          })),
        }));

        const settlementsForCalc = (settlementsResult.data || []).map((s) => ({
          from_member_id: s.from_member_id,
          to_member_id: s.to_member_id,
          amount: parseFloat(String(s.amount)),
        }));

        const balances = calculateBalancesWithSettlements(expensesForCalc, settlementsForCalc, membersData);
        const memberBalance = balances.get(claimedMember.id) || 0;
        setUserBalance(memberBalance);
      }
    } catch (error) {
      logger.error("Error fetching group:", error);
      Alert.alert("Error", "Failed to load group data");
      router.back();
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a group name");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("groups")
        .update({
          name: name.trim(),
          emoji,
          currency,
          notes: notes.trim() || null,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      Alert.alert("Success", "Group updated successfully");
      router.back();
    } catch (err) {
      logger.error("Error updating group:", err);
      setError("Failed to update group. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateShareCode = () => {
    Alert.alert(
      "Regenerate Share Code",
      "This will create a new share code. The old code will no longer work. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: async () => {
            try {
              const newShareCode = await generateShareCode();
              const { error } = await supabase
                .from("groups")
                .update({ share_code: newShareCode })
                .eq("id", id);

              if (error) throw error;

              Alert.alert(
                "Share Code Updated",
                `New share code: ${newShareCode}`
              );
              fetchData(); // Refresh data
            } catch (err) {
              logger.error("Error regenerating share code:", err);
              Alert.alert("Error", "Failed to regenerate share code");
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    if (!userMember) {
      Alert.alert(
        "Cannot Leave",
        "You must claim a member in this group before you can leave."
      );
      return;
    }

    // Check if user has outstanding balance
    const hasOutstandingBalance = Math.abs(userBalance) > 0.01;

    if (hasOutstandingBalance) {
      const balanceText = userBalance > 0
        ? `You are owed ${formatCurrency(userBalance, group?.currency || "USD")} in this group.`
        : `You owe ${formatCurrency(Math.abs(userBalance), group?.currency || "USD")} in this group.`;

      Alert.alert(
        "Settle Up First",
        `${balanceText}\n\nPlease settle all balances before leaving the group.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "View Balances",
            onPress: () => router.push(`/group/${id}/balances`),
          },
        ]
      );
      return;
    }

    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group? You'll need a new invite to rejoin.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              // Unclaim the member (set clerk_user_id to null) instead of deleting
              // This preserves expense history
              const { error } = await supabase
                .from("members")
                .update({ clerk_user_id: null })
                .eq("id", userMember.id);

              if (error) throw error;

              Alert.alert("Left Group", "You have left the group");
              router.replace("/");
            } catch (err) {
              logger.error("Error leaving group:", err);
              Alert.alert("Error", "Failed to leave group. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleArchiveGroup = () => {
    Alert.alert(
      "Archive Group",
      "Archive this group? It will be hidden from your list but you can still access it later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("groups")
                .update({ archived_at: new Date().toISOString() })
                .eq("id", id);

              if (error) throw error;

              Alert.alert("Group Archived", "The group has been archived");
              router.replace("/");
            } catch (err) {
              logger.error("Error archiving group:", err);
              Alert.alert("Error", "Failed to archive group. Please try again.");
            }
          },
        },
      ]
    );
  };

  const selectedCurrency = CURRENCIES.find((c) => c.code === currency);

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
          title: "Edit Group",
          presentation: "modal",
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Group Name</Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="e.g., Vacation 2025, Roommates"
              error={error}
            />

            <Text style={[styles.sectionTitle, styles.emojiTitle]}>Icon</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[
                    styles.emojiButton,
                    emoji === e && styles.emojiButtonSelected,
                  ]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, styles.notesTitle]}>
              Notes (Optional)
            </Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Vegas Trip 2025, Monthly Rent"
              multiline
              numberOfLines={3}
            />

            <Text style={[styles.sectionTitle, styles.currencyTitle]}>
              Currency
            </Text>
            <Card style={styles.currencyCard}>
              <TouchableOpacity
                style={styles.currencySelector}
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
              >
                <View style={styles.currencyValue}>
                  <Text style={styles.currencySymbol}>
                    {selectedCurrency?.symbol}
                  </Text>
                  <Text style={styles.currencyCode}>{currency}</Text>
                </View>
                <Text style={styles.expandArrow}>
                  {showCurrencyPicker ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>

              {showCurrencyPicker && (
                <View style={styles.currencyList}>
                  {CURRENCIES.map((curr) => (
                    <TouchableOpacity
                      key={curr.code}
                      style={[
                        styles.currencyOption,
                        currency === curr.code &&
                          styles.currencyOptionSelected,
                      ]}
                      onPress={() => {
                        setCurrency(curr.code);
                        setShowCurrencyPicker(false);
                      }}
                    >
                      <View style={styles.currencyOptionContent}>
                        <Text style={styles.currencyOptionSymbol}>
                          {curr.symbol}
                        </Text>
                        <View>
                          <Text style={styles.currencyOptionCode}>
                            {curr.code}
                          </Text>
                          <Text style={styles.currencyOptionName}>
                            {curr.name}
                          </Text>
                        </View>
                      </View>
                      {currency === curr.code && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Card>

            <Text style={[styles.sectionTitle, styles.shareCodeTitle]}>
              Share Code
            </Text>
            <Card style={styles.shareCodeCard}>
              <View style={styles.shareCodeRow}>
                <View>
                  <Text style={styles.shareCodeLabel}>Current Code</Text>
                  <Text style={styles.shareCodeValue}>
                    {group?.share_code}
                  </Text>
                </View>
                <Button
                  title="Regenerate"
                  onPress={handleRegenerateShareCode}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                />
              </View>
            </Card>

            <Text style={[styles.sectionTitle, styles.trashTitle]}>Trash</Text>
            <Card style={styles.trashCard}>
              <TouchableOpacity
                style={styles.trashButton}
                onPress={() => router.push(`/group/${id}/trash`)}
              >
                <View style={styles.trashContent}>
                  <Text style={styles.trashIcon}>🗑️</Text>
                  <View>
                    <Text style={styles.trashText}>View Deleted Expenses</Text>
                    <Text style={styles.trashSubtext}>Restore or permanently delete</Text>
                  </View>
                </View>
                <Text style={styles.trashArrow}>→</Text>
              </TouchableOpacity>
            </Card>

            <View style={styles.dangerZone}>
              <Text style={styles.dangerZoneTitle}>Danger Zone</Text>

              <Button
                title="Leave Group"
                onPress={handleLeaveGroup}
                variant="danger"
                size="md"
                style={styles.dangerButton}
              />

              <Button
                title="Archive Group"
                onPress={handleArchiveGroup}
                variant="danger"
                size="md"
                style={styles.dangerButton}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Save Changes"
              onPress={handleSave}
              loading={saving}
              disabled={!name.trim()}
            />
          </View>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  emojiTitle: {
    marginTop: spacing.xl,
  },
  notesTitle: {
    marginTop: spacing.xl,
  },
  currencyTitle: {
    marginTop: spacing.xl,
  },
  shareCodeTitle: {
    marginTop: spacing.xl,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  emojiButton: {
    width: 56,
    height: 56,
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  emojiButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  emojiText: {
    fontSize: 28,
  },
  currencyCard: {
    padding: 0,
    overflow: "hidden",
  },
  currencySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  currencyValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  currencySymbol: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.primary,
  },
  currencyCode: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  expandArrow: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  currencyList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  currencyOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  currencyOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  currencyOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  currencyOptionSymbol: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    width: 30,
    textAlign: "center",
  },
  currencyOptionCode: {
    ...typography.bodyMedium,
  },
  currencyOptionName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  checkmark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "bold",
  },
  shareCodeCard: {
    padding: spacing.lg,
  },
  shareCodeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shareCodeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  shareCodeValue: {
    ...typography.h3,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  trashTitle: {
    marginTop: spacing.xl,
  },
  trashCard: {
    padding: 0,
    overflow: "hidden",
  },
  trashButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  trashContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  trashIcon: {
    fontSize: 24,
  },
  trashText: {
    ...typography.bodyMedium,
  },
  trashSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  trashArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  dangerZone: {
    marginTop: spacing.xxl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  dangerZoneTitle: {
    ...typography.bodyMedium,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  dangerButton: {
    marginBottom: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
