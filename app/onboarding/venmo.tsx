/**
 * Venmo Onboarding Screen
 * Prompts new users to link their Venmo account for faster settlements
 */

import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from "../../lib/theme";
import { Button, Input, Card } from "../../components/ui";
import { useAuth } from "../../lib/auth-context";
import { updateVenmoUsername } from "../../lib/user-profile";

export default function VenmoOnboardingScreen() {
  const { userId } = useAuth();
  const [venmoUsername, setVenmoUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!userId) return;

    // Validate username
    const cleanUsername = venmoUsername.trim().replace(/^@/, "");
    if (cleanUsername && !/^[a-zA-Z0-9_-]{1,30}$/.test(cleanUsername)) {
      setError("Username can only contain letters, numbers, underscores, and hyphens");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const success = await updateVenmoUsername(userId, cleanUsername || null);
      if (success) {
        router.replace("/(tabs)");
      } else {
        setError("Failed to save Venmo username. Please try again.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.replace("/(tabs)");
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="wallet-outline" size={48} color={colors.primary} />
            </View>
            <Text style={styles.title}>Link Your Venmo</Text>
            <Text style={styles.subtitle}>
              Make settling up faster by connecting your Venmo account
            </Text>
          </View>

          {/* Benefits */}
          <Card style={styles.benefitsCard}>
            <View style={styles.benefit}>
              <Ionicons name="flash" size={24} color={colors.primary} />
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>One-Tap Payments</Text>
                <Text style={styles.benefitDescription}>
                  Open Venmo directly from the settle up screen
                </Text>
              </View>
            </View>
            <View style={styles.benefit}>
              <Ionicons name="people" size={24} color={colors.primary} />
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Easy Discovery</Text>
                <Text style={styles.benefitDescription}>
                  Friends can find your Venmo when paying you
                </Text>
              </View>
            </View>
          </Card>

          {/* Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Venmo Username</Text>
            <Input
              value={venmoUsername}
              onChangeText={(text) => {
                setVenmoUsername(text.replace(/^@/, ""));
                setError("");
              }}
              placeholder="your-username"
              autoCapitalize="none"
              autoCorrect={false}
              prefix="@"
              error={error}
            />
            <Text style={styles.inputHint}>
              You can always change this later in your profile
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={venmoUsername.trim() ? "Continue" : "Skip for Now"}
              onPress={venmoUsername.trim() ? handleSave : handleSkip}
              loading={saving}
            />
            {venmoUsername.trim() && (
              <Button
                title="Skip"
                onPress={handleSkip}
                variant="secondary"
                style={styles.skipButton}
              />
            )}
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
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  benefitsCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  benefitText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  benefitTitle: {
    ...typography.bodyMedium,
  },
  benefitDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  inputSection: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  inputHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  actions: {
    gap: spacing.md,
  },
  skipButton: {
    marginTop: spacing.sm,
  },
});
