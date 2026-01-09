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
 * Change Email Screen
 * Allows users to update their email address
 */
export default function ChangeEmailScreen() {
  const { user, isLoaded } = useUser();
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async () => {
    if (!user) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Create a new email address and send verification
      const emailAddress = await user.createEmailAddress({ email: newEmail });
      await emailAddress.prepareVerification({ strategy: "email_code" });
      setStep("verify");
      Alert.alert("Code Sent", `A verification code has been sent to ${newEmail}`);
    } catch (error: any) {
      console.error("Error sending verification:", error);
      setError(error.errors?.[0]?.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!user) return;

    if (verificationCode.length < 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Find the unverified email and verify it
      const emailAddress = user.emailAddresses.find(
        (e) => e.emailAddress === newEmail
      );

      if (!emailAddress) {
        throw new Error("Email not found");
      }

      await emailAddress.attemptVerification({ code: verificationCode });

      // Set as primary email
      await user.update({ primaryEmailAddressId: emailAddress.id });

      Alert.alert("Success", "Email address updated successfully");
      router.back();
    } catch (error: any) {
      console.error("Error verifying email:", error);
      setError(error.errors?.[0]?.message || "Invalid verification code");
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

  return (
    <>
      <Stack.Screen
        options={{
          title: "Change Email",
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
            {/* Current Email */}
            <Card style={styles.infoCard}>
              <Text style={styles.infoLabel}>Current Email</Text>
              <Text style={styles.infoValue}>
                {user.primaryEmailAddress?.emailAddress}
              </Text>
            </Card>

            {step === "email" ? (
              /* Step 1: Enter new email */
              <Card style={styles.formCard}>
                <Text style={styles.label}>New Email Address</Text>
                <Input
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="Enter new email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  error={error}
                />
                <Text style={styles.hint}>
                  We'll send a verification code to this email
                </Text>
              </Card>
            ) : (
              /* Step 2: Enter verification code */
              <Card style={styles.formCard}>
                <Text style={styles.label}>Verification Code</Text>
                <Input
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="Enter 6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  error={error}
                />
                <Text style={styles.hint}>
                  Enter the code sent to {newEmail}
                </Text>
              </Card>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step === "email" ? (
              <Button
                title="Send Verification Code"
                onPress={handleSendCode}
                loading={loading}
                disabled={loading || !newEmail.trim()}
              />
            ) : (
              <>
                <Button
                  title="Verify & Update Email"
                  onPress={handleVerifyCode}
                  loading={loading}
                  disabled={loading || verificationCode.length < 6}
                />
                <Button
                  title="Back"
                  onPress={() => {
                    setStep("email");
                    setVerificationCode("");
                    setError("");
                  }}
                  variant="secondary"
                  style={styles.backButton}
                  disabled={loading}
                />
              </>
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
    marginBottom: spacing.lg,
  },
  infoLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  formCard: {
    padding: spacing.lg,
  },
  label: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  backButton: {
    marginTop: spacing.sm,
  },
});
