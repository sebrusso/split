import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSignIn } from "@clerk/clerk-expo";
import { colors, spacing, typography } from "../../lib/theme";
import { Button, Input } from "../../components/ui";

type ResetStep = "email" | "code" | "password" | "success";

/**
 * Forgot Password Screen
 * Multi-step password reset flow
 */
export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = useCallback(async () => {
    if (!isLoaded) return;

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim(),
      });
      setStep("code");
    } catch (err: unknown) {
      __DEV__ && console.error("Send code error:", err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      const errorMessage =
        clerkError.errors?.[0]?.message ||
        "Failed to send reset code. Please check your email.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, email, signIn]);

  const handleVerifyCode = useCallback(async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
      });

      if (result.status === "needs_new_password") {
        setStep("password");
      } else {
        setError("Unexpected status. Please try again.");
      }
    } catch (err: unknown) {
      __DEV__ && console.error("Verify code error:", err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      const errorMessage =
        clerkError.errors?.[0]?.message || "Invalid verification code";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, code, signIn]);

  const handleResetPassword = useCallback(async () => {
    if (!isLoaded) return;

    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn.resetPassword({
        password: newPassword,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setStep("success");
      } else {
        setError("Password reset incomplete. Please try again.");
      }
    } catch (err: unknown) {
      __DEV__ && console.error("Reset password error:", err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      const errorMessage =
        clerkError.errors?.[0]?.message || "Failed to reset password";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, newPassword, confirmPassword, signIn, setActive]);

  const renderEmailStep = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔐</Text>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a code to reset your password
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Send Reset Code"
          onPress={handleSendCode}
          loading={loading}
          disabled={!email.trim()}
          style={styles.button}
        />
      </View>
    </>
  );

  const renderCodeStep = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.emoji}>📧</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification code to{"\n"}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Verification Code"
          value={code}
          onChangeText={setCode}
          placeholder="Enter 6-digit code"
          keyboardType="number-pad"
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Verify Code"
          onPress={handleVerifyCode}
          loading={loading}
          disabled={!code.trim()}
          style={styles.button}
        />

        <TouchableOpacity
          style={styles.resendButton}
          onPress={async () => {
            if (!signIn) return;
            setError("");
            try {
              await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email.trim(),
              });
            } catch (err) {
              __DEV__ && console.error("Resend error:", err);
              setError("Failed to resend code. Please try again.");
            }
          }}
        >
          <Text style={styles.resendText}>Resend code</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔑</Text>
        <Text style={styles.title}>Create new password</Text>
        <Text style={styles.subtitle}>
          Your new password must be at least 8 characters
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
          autoFocus
        />

        <Input
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Enter password again"
          secureTextEntry
          autoComplete="new-password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Reset Password"
          onPress={handleResetPassword}
          loading={loading}
          disabled={!newPassword || !confirmPassword}
          style={styles.button}
        />
      </View>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <View style={styles.successContainer}>
        <Text style={styles.successEmoji}>✅</Text>
        <Text style={styles.successTitle}>Password Reset!</Text>
        <Text style={styles.successText}>
          Your password has been successfully reset. You're now signed in.
        </Text>

        <Button
          title="Continue to App"
          onPress={() => router.replace("/")}
          style={styles.successButton}
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === "email" && renderEmailStep()}
          {step === "code" && renderCodeStep()}
          {step === "password" && renderPasswordStep()}
          {step === "success" && renderSuccessStep()}
        </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  emailHighlight: {
    color: colors.text,
    fontWeight: "600",
  },
  form: {
    gap: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
  },
  button: {
    marginTop: spacing.md,
  },
  resendButton: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
  },
  resendText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  successEmoji: {
    fontSize: 80,
    marginBottom: spacing.xl,
  },
  successTitle: {
    ...typography.h2,
    textAlign: "center",
  },
  successText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    lineHeight: 24,
  },
  successButton: {
    width: "100%",
  },
});
