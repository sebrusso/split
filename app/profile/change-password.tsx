import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import {
  colors,
  spacing,
  typography,
} from "../../lib/theme";
import { Button, Input, Card } from "../../components/ui";

/**
 * Change Password Screen
 * Allows users to update their password
 */
export default function ChangePasswordScreen() {
  const { user, isLoaded } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChangePassword = async () => {
    if (!user) return;

    // Validation
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await user.updatePassword({
        currentPassword,
        newPassword,
      });
      Alert.alert("Success", "Password updated successfully");
      router.back();
    } catch (error: any) {
      console.error("Error changing password:", error);
      const message = error.errors?.[0]?.message || "Failed to change password";
      if (message.toLowerCase().includes("incorrect")) {
        setError("Current password is incorrect");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if user has password authentication enabled
  const hasPassword = user.passwordEnabled;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Change Password",
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
            {!hasPassword ? (
              <Card style={styles.infoCard}>
                <Text style={styles.infoTitle}>No Password Set</Text>
                <Text style={styles.infoText}>
                  You signed up using a social login (Google or Apple). You can
                  set a password to enable email/password login.
                </Text>
                <Button
                  title="Set Password"
                  onPress={() => {
                    Alert.alert(
                      "Set Password",
                      "To set a password, please use the forgot password flow from the sign-in screen.",
                      [{ text: "OK" }]
                    );
                  }}
                  variant="secondary"
                  style={styles.setPasswordButton}
                />
              </Card>
            ) : (
              <Card style={styles.formCard}>
                <Text style={styles.label}>Current Password</Text>
                <Input
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  secureTextEntry
                  autoComplete="password"
                />

                <Text style={[styles.label, styles.labelSpaced]}>New Password</Text>
                <Input
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry
                  autoComplete="new-password"
                />
                <Text style={styles.hint}>Must be at least 8 characters</Text>

                <Text style={[styles.label, styles.labelSpaced]}>
                  Confirm New Password
                </Text>
                <Input
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                  autoComplete="new-password"
                  error={error}
                />
              </Card>
            )}
          </ScrollView>

          {hasPassword && (
            <View style={styles.footer}>
              <Button
                title="Update Password"
                onPress={handleChangePassword}
                loading={loading}
                disabled={
                  loading ||
                  !currentPassword.trim() ||
                  !newPassword.trim() ||
                  !confirmPassword.trim()
                }
              />
            </View>
          )}
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
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  infoCard: {
    padding: spacing.lg,
  },
  infoTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  setPasswordButton: {
    marginTop: spacing.lg,
  },
  formCard: {
    padding: spacing.lg,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelSpaced: {
    marginTop: spacing.lg,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
