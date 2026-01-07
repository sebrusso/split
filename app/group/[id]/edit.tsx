import { useState, useCallback } from "react";
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
import { generateShareCode } from "../../../lib/utils";
import logger from "../../../lib/logger";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import { Button, Input, Card } from "../../../components/ui";
import { Group, Member } from "../../../lib/types";
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
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💰");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);
      setName(groupData.name);
      setEmoji(groupData.emoji);
      setCurrency(groupData.currency || "USD");
      setNotes(groupData.notes || "");

      // Check if the current user has a claimed member in this group
      if (userId) {
        const claimedMember = await getMemberByUserId(id, userId);
        setUserMember(claimedMember);
      }
    } catch (error) {
      logger.error("Error fetching group:", error);
      Alert.alert("Error", "Failed to load group data");
      router.back();
    } finally {
      setLoading(false);
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
              const { error } = await supabase
                .from("members")
                .delete()
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
              style={styles.notesInput}
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
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
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
