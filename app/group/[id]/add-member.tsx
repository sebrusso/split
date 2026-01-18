import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useSupabase } from "../../../lib/supabase";
import { colors, spacing, typography } from "../../../lib/theme";
import { Button, Input, Avatar } from "../../../components/ui";
import { useAnalytics, AnalyticsEvents } from "../../../lib/analytics-provider";

export default function AddMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trackEvent } = useAnalytics();
  const { getSupabase } = useSupabase();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = await getSupabase();
      const { error: memberError } = await supabase.from("members").insert({
        group_id: id,
        name: name.trim(),
      });

      if (memberError) throw memberError;

      trackEvent(AnalyticsEvents.MEMBER_INVITED, { groupId: id });
      router.back();
    } catch (err) {
      console.error("Error adding member:", err);
      setError("Failed to add member. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.previewContainer}>
            <Avatar name={name || "?"} size="lg" />
            <Text style={styles.previewName}>{name || "New Member"}</Text>
          </View>

          <Input
            inputTestID="member-name-input"
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter member's name"
            autoFocus
            error={error}
          />

          <Text style={styles.hint}>
            They don't need an account to be part of the group
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            testID="submit-add-member"
            title="Add Member"
            onPress={handleSubmit}
            loading={loading}
            disabled={!name.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  previewContainer: {
    alignItems: "center",
    marginVertical: spacing.xxl,
  },
  previewName: {
    ...typography.h3,
    marginTop: spacing.md,
  },
  hint: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
