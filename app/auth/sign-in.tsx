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
import { useSignIn, useOAuth, isClerkAPIResponseError } from "@clerk/clerk-expo";
import type { ClerkAPIError } from "@clerk/types";
import * as Linking from "expo-linking";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import { Button, Input } from "../../components/ui";
import { useAnalytics, AnalyticsEvents } from "../../lib/analytics-provider";

/**
 * User-friendly error messages for Clerk error codes
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Account not found / identifier errors
  form_identifier_not_found: "We couldn't find an account with that email. Would you like to sign up instead?",
  form_password_incorrect: "Incorrect password. Please try again or reset your password.",
  form_password_or_identifier_incorrect: "Invalid email or password. Please check your credentials and try again.",
  // Password validation
  form_password_validation_failed: "Password validation failed. Please try again.",
  form_password_compromised: "This password has been found in a data breach. Please reset your password.",
  // Session/auth errors
  session_exists: "You already have an active session. Please sign out first.",
  authentication_invalid: "Your session has expired. Please sign in again.",
  // Rate limiting
  too_many_requests: "Too many attempts. Please wait a moment before trying again.",
  // Generic fallback
  default: "Something went wrong. Please try again.",
};

/**
 * Check if error indicates account doesn't exist
 */
function isAccountNotFoundError(code: string): boolean {
  return code === "form_identifier_not_found";
}

/**
 * Sign In Screen
 * Supports email/password and OAuth (Google, Apple)
 */
export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startAppleOAuth } = useOAuth({ strategy: "oauth_apple" });
  const { trackEvent } = useAnalytics();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!isLoaded) return;

    if (!email.trim()) {
      setError("Please enter your email");
      setShowSignUpPrompt(false);
      return;
    }
    if (!password) {
      setError("Please enter your password");
      setShowSignUpPrompt(false);
      return;
    }

    setLoading(true);
    setError("");
    setShowSignUpPrompt(false);

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        trackEvent(AnalyticsEvents.SIGN_IN_COMPLETED, { method: "email" });
        router.replace("/");
      } else {
        // Handle other statuses (e.g., needs_second_factor)
        setError("Additional verification required. Please check your email or authenticator app.");
      }
    } catch (err: unknown) {
      // Use Clerk's type guard for proper error handling
      if (isClerkAPIResponseError(err)) {
        const clerkErrors: ClerkAPIError[] = err.errors;
        const firstError = clerkErrors[0];
        const errorCode = firstError?.code || "default";

        // Check if this is an "account not found" error
        if (isAccountNotFoundError(errorCode)) {
          setShowSignUpPrompt(true);
        }

        // Get user-friendly message
        const userMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default;
        setError(userMessage);
      } else {
        // Non-Clerk error (network issues, etc.)
        setError("Unable to connect. Please check your internet connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [isLoaded, email, password, signIn, setActive]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!isLoaded) return;

    setOauthLoading("google");
    setError("");
    setShowSignUpPrompt(false);

    try {
      const { createdSessionId, setActive: setOAuthActive } = await startGoogleOAuth({
        redirectUrl: Linking.createURL("/"),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        trackEvent(AnalyticsEvents.SIGN_IN_COMPLETED, { method: "google" });
        router.replace("/");
      }
    } catch (err: unknown) {
      if (isClerkAPIResponseError(err)) {
        const errorCode = err.errors[0]?.code || "default";
        const userMessage = ERROR_MESSAGES[errorCode] || "Unable to sign in with Google. Please try again.";
        setError(userMessage);
      } else {
        setError("Unable to connect to Google. Please check your internet connection.");
      }
    } finally {
      setOauthLoading(null);
    }
  }, [isLoaded, startGoogleOAuth]);

  const handleAppleSignIn = useCallback(async () => {
    if (!isLoaded) return;

    setOauthLoading("apple");
    setError("");
    setShowSignUpPrompt(false);

    try {
      const { createdSessionId, setActive: setOAuthActive } = await startAppleOAuth({
        redirectUrl: Linking.createURL("/"),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        trackEvent(AnalyticsEvents.SIGN_IN_COMPLETED, { method: "apple" });
        router.replace("/");
      }
    } catch (err: unknown) {
      if (isClerkAPIResponseError(err)) {
        const errorCode = err.errors[0]?.code || "default";
        const userMessage = ERROR_MESSAGES[errorCode] || "Unable to sign in with Apple. Please try again.";
        setError(userMessage);
      } else {
        setError("Unable to connect to Apple. Please check your internet connection.");
      }
    } finally {
      setOauthLoading(null);
    }
  }, [isLoaded, startAppleOAuth]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>SplitFree</Text>
            <Text style={styles.tagline}>Split expenses, stay friends</Text>
          </View>

          {/* OAuth Buttons */}
          <View style={styles.oauthContainer}>
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={handleGoogleSignIn}
              disabled={loading || oauthLoading !== null}
              activeOpacity={0.8}
            >
              <Text style={styles.oauthIcon}>G</Text>
              <Text style={styles.oauthText}>
                {oauthLoading === "google" ? "Signing in..." : "Continue with Google"}
              </Text>
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[styles.oauthButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={loading || oauthLoading !== null}
                activeOpacity={0.8}
              >
                <Text style={[styles.oauthIcon, styles.appleIcon]}></Text>
                <Text style={[styles.oauthText, styles.appleText]}>
                  {oauthLoading === "apple" ? "Signing in..." : "Continue with Apple"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email/Password Form */}
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
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoComplete="password"
              containerStyle={styles.passwordInput}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => router.push("/auth/forgot-password")}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
                {showSignUpPrompt && (
                  <TouchableOpacity
                    style={styles.signUpPromptButton}
                    onPress={() => router.push("/auth/sign-up")}
                  >
                    <Text style={styles.signUpPromptText}>Create an account</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <Button
              title="Sign In"
              onPress={handleSignIn}
              loading={loading}
              disabled={!email.trim() || !password || oauthLoading !== null}
              style={styles.signInButton}
            />
          </View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/auth/sign-up")}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logo: {
    ...typography.h1,
    color: colors.primary,
    fontSize: 36,
  },
  tagline: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  oauthContainer: {
    gap: spacing.md,
  },
  oauthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  appleButton: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  oauthIcon: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    marginRight: spacing.sm,
  },
  appleIcon: {
    color: colors.white,
  },
  oauthText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  appleText: {
    color: colors.white,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    marginHorizontal: spacing.md,
  },
  form: {
    gap: spacing.lg,
  },
  passwordInput: {
    marginTop: spacing.xs,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
  },
  forgotPasswordText: {
    ...typography.caption,
    color: colors.primary,
  },
  errorContainer: {
    alignItems: "center",
    gap: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
  },
  signUpPromptButton: {
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
  },
  signUpPromptText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  signInButton: {
    marginTop: spacing.md,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  signUpText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  signUpLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
