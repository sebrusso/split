/**
 * QuickCreateGroup Component
 *
 * Lightweight modal for inline group creation within the receipt assignment flow.
 * Creates group and adds current user as member.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from "../../lib/theme";
import { useSupabase } from "../../lib/supabase";
import { generateShareCode } from "../../lib/utils";
import { Input } from "./Input";
import { Button } from "./Button";
import { getErrorMessage } from '../../lib/logger';

const EMOJIS = [
  "💰", "🏠", "✈️", "🍕", "🎉", "👥",
  "💳", "🛒", "🎬", "⛽", "🏖️", "🎮",
];

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
];

interface QuickCreateGroupProps {
  visible: boolean;
  clerkUserId: string;
  onCreated: (groupId: string, groupName: string) => void;
  onCancel: () => void;
}

export function QuickCreateGroup({
  visible,
  clerkUserId,
  onCreated,
  onCancel,
}: QuickCreateGroupProps) {
  const { user } = useUser();
  const { getSupabase } = useSupabase();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💰");
  const [currency, setCurrency] = useState("USD");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a group name");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const supabase = await getSupabase();
      const shareCode = await generateShareCode();

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: name.trim(),
          emoji,
          currency,
          share_code: shareCode,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as first member
      const memberName = user?.fullName || user?.firstName || "You";
      const { error: memberError } = await supabase.from("members").insert({
        group_id: group.id,
        name: memberName,
        clerk_user_id: clerkUserId,
      });

      if (memberError) throw memberError;

      // Reset form
      setName("");
      setEmoji("💰");
      setCurrency("USD");

      onCreated(group.id, group.name);
    } catch (err: unknown) {
      __DEV__ && console.error("Error creating group:", err);
      setError(getErrorMessage(err) || "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setEmoji("💰");
    setCurrency("USD");
    setError("");
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Pressable style={styles.overlay} onPress={handleCancel}>
          <Pressable
            style={styles.container}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.title}>Create New Group</Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Group Name */}
              <Text style={styles.label}>Group Name</Text>
              <Input
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (error) setError("");
                }}
                placeholder="e.g., Weekend Trip"
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
              />

              {/* Emoji Picker */}
              <Text style={styles.label}>Choose an Emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJIS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.emojiButton,
                      emoji === e && styles.emojiButtonSelected,
                    ]}
                    onPress={() => setEmoji(e)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Currency Picker */}
              <Text style={styles.label}>Currency</Text>
              <View style={styles.currencyGrid}>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c.code}
                    style={[
                      styles.currencyButton,
                      currency === c.code && styles.currencyButtonSelected,
                    ]}
                    onPress={() => setCurrency(c.code)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.currencySymbol,
                        currency === c.code && styles.currencySymbolSelected,
                      ]}
                    >
                      {c.symbol}
                    </Text>
                    <Text
                      style={[
                        styles.currencyCode,
                        currency === c.code && styles.currencyCodeSelected,
                      ]}
                    >
                      {c.code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Error Message */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Create Button */}
              <Button
                title={creating ? "Creating..." : "Create Group"}
                onPress={handleCreate}
                disabled={creating || !name.trim()}
                style={styles.createButton}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    ...typography.h3,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  label: {
    ...typography.bodyMedium,
    fontWeight: "500",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
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
    fontSize: 24,
  },
  currencyGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  currencyButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  currencyButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
  },
  currencySymbolSelected: {
    color: colors.primary,
  },
  currencyCode: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  currencyCodeSelected: {
    color: colors.primary,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: "center",
  },
  createButton: {
    marginTop: spacing.xl,
  },
});
