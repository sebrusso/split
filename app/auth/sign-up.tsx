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
import { useSignUp, useOAuth } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import { Button, Input } from "../../components/ui";

/**
 * Sign Up Screen
 * Registration with email/password and OAuth options
 */
export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startAppleOAuth } = useOAuth({ strategy: "oauth_apple" });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const validateForm = useCallback(() => {
    if (!firstName.trim()) {
      setError("Please enter your first name");
      return false;
    }
    if (!email.trim()) {
      setError("Please enter your email");
      return false;
    }
    if (!phoneNumber.trim()) {
      setError("Please enter your phone number");
      return false;
    }
    // Basic phone validation - must have at least 10 digits
    const phoneDigits = phoneNumber.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Please enter a valid phone number");
      return false;
    }
    if (!password) {
      setError("Please enter a password");
      return false;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  }, [firstName, email, phoneNumber, password, confirmPassword]);

  // Format phone number for Clerk (E.164 format)
  const formatPhoneForClerk = useCallback((phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    // If it doesn't start with country code, assume US (+1)
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    // If it already has country code (11+ digits starting with 1)
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
    // Otherwise, return with + prefix
    return digits.startsWith("+") ? digits : `+${digits}`;
  }, []);

  const handleSignUp = useCallback(async () => {
    if (!isLoaded || !signUp) return;
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      // Create the sign-up with phone number
      const formattedPhone = formatPhoneForClerk(phoneNumber);
      const result = await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        emailAddress: email.trim(),
        phoneNumber: formattedPhone,
        password,
      });

      console.log("Sign-up result status:", result.status);
      console.log("Missing fields:", result.missingFields);

      // Check if we need email verification
      if (result.status === "missing_requirements") {
        // Check what verifications are needed
        const unverifiedFields = result.unverifiedFields || [];

        if (unverifiedFields.includes("email_address")) {
          // Send verification email first
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setPendingVerification(true);
        } else if (unverifiedFields.includes("phone_number")) {
          // Send phone verification
          await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
          setPendingPhoneVerification(true);
        } else {
          // Default: try email verification
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setPendingVerification(true);
        }
      } else if (result.status === "complete" && result.createdSessionId) {
        // Rare case: sign-up completed without verification
        await setActive({ session: result.createdSessionId });
        router.replace("/");
      } else {
        // Default: send verification
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPendingVerification(true);
      }
    } catch (err: unknown) {
      console.error("Sign up error:", err);
      const clerkError = err as {
        errors?: Array<{ message?: string; code?: string; longMessage?: string }>;
        message?: string;
      };

      // Get error message
      let errorMessage = "Failed to create account";
      if (clerkError.errors?.[0]?.message) {
        errorMessage = clerkError.errors[0].message;
      } else if (clerkError.message) {
        errorMessage = clerkError.message;
      }

      // Handle specific error codes
      const errorCode = clerkError.errors?.[0]?.code;
      if (errorCode === "form_password_pwned") {
        errorMessage = "This password has been compromised in a data breach. Please choose a different password.";
      } else if (errorCode === "session_exists") {
        errorMessage = "You already have an active session. Please sign out first.";
      } else if (errorCode === "form_identifier_exists") {
        errorMessage = "An account with this email or phone already exists.";
      } else if (errorCode === "form_param_format_invalid") {
        errorMessage = "Please check your phone number format (e.g., +1 555 123 4567)";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, validateForm, signUp, setActive, firstName, lastName, email, phoneNumber, password, formatPhoneForClerk]);

  const handleVerification = useCallback(async () => {
    if (!isLoaded || !signUp) return;

    if (!verificationCode.trim()) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      console.log("Verification status:", result.status);
      console.log("Session ID:", result.createdSessionId);
      console.log("Unverified fields:", result.unverifiedFields);
      console.log("Missing fields:", result.missingFields);

      if (result.status === "complete" && result.createdSessionId) {
        // Sign-up complete, activate session
        await setActive({ session: result.createdSessionId });
        router.replace("/");
      } else if (result.status === "complete") {
        // Complete but no session - try to get session from signUp
        if (signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId });
          router.replace("/");
        } else {
          // Redirect to sign-in since account is created
          setSuccessMessage("Account created! Redirecting to sign in...");
          setTimeout(() => router.replace("/auth/sign-in"), 1500);
        }
      } else if (result.status === "missing_requirements") {
        // Check what's still missing
        const unverifiedFields = result.unverifiedFields || [];
        console.log("Unverified after email:", unverifiedFields);

        // Check if phone verification is needed
        if (unverifiedFields.includes("phone_number")) {
          // Email verified, now verify phone
          setSuccessMessage("Email verified! Now verify your phone number.");
          await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
          setPendingVerification(false);
          setPendingPhoneVerification(true);
          setVerificationCode("");
        } else if (signUp.createdSessionId) {
          // Try to complete the sign-up
          await setActive({ session: signUp.createdSessionId });
          router.replace("/");
        } else {
          // Account created but needs sign-in
          setSuccessMessage("Account created! Redirecting to sign in...");
          setTimeout(() => router.replace("/auth/sign-in"), 1500);
        }
      } else {
        console.log("Unexpected status:", result.status);
        setSuccessMessage("Account created! Redirecting to sign in...");
        setTimeout(() => router.replace("/auth/sign-in"), 1500);
      }
    } catch (err: unknown) {
      console.error("Verification error:", err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      const errorMessage =
        clerkError.errors?.[0]?.message || "Invalid verification code";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, verificationCode, setActive]);

  // Handle phone verification
  const handlePhoneVerification = useCallback(async () => {
    if (!isLoaded || !signUp) return;

    if (!phoneVerificationCode.trim()) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await signUp.attemptPhoneNumberVerification({
        code: phoneVerificationCode.trim(),
      });

      console.log("Phone verification status:", result.status);
      console.log("Session ID:", result.createdSessionId);

      if (result.status === "complete" && result.createdSessionId) {
        // Sign-up complete, activate session
        await setActive({ session: result.createdSessionId });
        router.replace("/");
      } else if (result.status === "complete") {
        // Complete but no session
        if (signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId });
          router.replace("/");
        } else {
          setSuccessMessage("Account created! Redirecting to sign in...");
          setTimeout(() => router.replace("/auth/sign-in"), 1500);
        }
      } else if (result.status === "missing_requirements") {
        // Check if there's a session we can use
        if (signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId });
          router.replace("/");
        } else {
          setSuccessMessage("Account created! Redirecting to sign in...");
          setTimeout(() => router.replace("/auth/sign-in"), 1500);
        }
      } else {
        console.log("Unexpected phone verification status:", result.status);
        setSuccessMessage("Account created! Redirecting to sign in...");
        setTimeout(() => router.replace("/auth/sign-in"), 1500);
      }
    } catch (err: unknown) {
      console.error("Phone verification error:", err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      const errorMessage =
        clerkError.errors?.[0]?.message || "Invalid verification code";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signUp, phoneVerificationCode, setActive]);

  const handleGoogleSignUp = useCallback(async () => {
    if (!isLoaded) return;

    setOauthLoading("google");
    setError("");

    try {
      const { createdSessionId, setActive: setOAuthActive } = await startGoogleOAuth({
        redirectUrl: Linking.createURL("/"),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err: unknown) {
      console.error("Google sign up error:", err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      const errorMessage =
        clerkError.errors?.[0]?.message || "Failed to sign up with Google";
      setError(errorMessage);
    } finally {
      setOauthLoading(null);
    }
  }, [isLoaded, startGoogleOAuth]);

  const handleAppleSignUp = useCallback(async () => {
    if (!isLoaded) return;

    setOauthLoading("apple");
    setError("");

    try {
      const { createdSessionId, setActive: setOAuthActive } = await startAppleOAuth({
        redirectUrl: Linking.createURL("/"),
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err: unknown) {
      console.error("Apple sign up error:", err);
      const clerkError = err as { errors?: Array<{ message?: string }> };
      const errorMessage =
        clerkError.errors?.[0]?.message || "Failed to sign up with Apple";
      setError(errorMessage);
    } finally {
      setOauthLoading(null);
    }
  }, [isLoaded, startAppleOAuth]);

  // Phone verification screen
  if (pendingPhoneVerification) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.verificationHeader}>
              <Text style={styles.verificationEmoji}>📱</Text>
              <Text style={styles.verificationTitle}>Verify your phone</Text>
              <Text style={styles.verificationText}>
                We sent a verification code to{"\n"}
                <Text style={styles.emailHighlight}>{phoneNumber}</Text>
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Verification Code"
                value={phoneVerificationCode}
                onChangeText={setPhoneVerificationCode}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                autoFocus
              />

              {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                title="Verify Phone"
                onPress={handlePhoneVerification}
                loading={loading}
                disabled={!phoneVerificationCode.trim()}
                style={styles.verifyButton}
              />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={async () => {
                  if (!signUp) return;
                  try {
                    await signUp.preparePhoneNumberVerification({
                      strategy: "phone_code",
                    });
                    setError("");
                    setSuccessMessage("Code resent!");
                  } catch (err) {
                    console.error("Resend error:", err);
                    setError("Failed to resend code. Please try again.");
                    setSuccessMessage("");
                  }
                }}
              >
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Email verification screen
  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.verificationHeader}>
              <Text style={styles.verificationEmoji}>📧</Text>
              <Text style={styles.verificationTitle}>Check your email</Text>
              <Text style={styles.verificationText}>
                We sent a verification code to{"\n"}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Verification Code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Enter 6-digit code"
                keyboardType="number-pad"
                autoFocus
              />

              {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                title="Verify Email"
                onPress={handleVerification}
                loading={loading}
                disabled={!verificationCode.trim()}
                style={styles.verifyButton}
              />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={async () => {
                  if (!signUp) return;
                  try {
                    await signUp.prepareEmailAddressVerification({
                      strategy: "email_code",
                    });
                    setError("");
                    setSuccessMessage("Code resent!");
                  } catch (err) {
                    console.error("Resend error:", err);
                    setError("Failed to resend code. Please try again.");
                    setSuccessMessage("");
                  }
                }}
              >
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Registration form
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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Join SplitFree to split expenses with friends
          </Text>

          {/* OAuth Buttons */}
          <View style={styles.oauthContainer}>
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={handleGoogleSignUp}
              disabled={loading || oauthLoading !== null}
              activeOpacity={0.8}
            >
              <Text style={styles.oauthIcon}>G</Text>
              <Text style={styles.oauthText}>
                {oauthLoading === "google" ? "Signing up..." : "Sign up with Google"}
              </Text>
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[styles.oauthButton, styles.appleButton]}
                onPress={handleAppleSignUp}
                disabled={loading || oauthLoading !== null}
                activeOpacity={0.8}
              >
                <Text style={[styles.oauthIcon, styles.appleIcon]}></Text>
                <Text style={[styles.oauthText, styles.appleText]}>
                  {oauthLoading === "apple" ? "Signing up..." : "Sign up with Apple"}
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

          {/* Registration Form */}
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <Input
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                autoComplete="given-name"
                containerStyle={styles.nameInput}
              />
              <Input
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                autoComplete="family-name"
                containerStyle={styles.nameInput}
              />
            </View>

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
              label="Phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1 (555) 123-4567"
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
            />

            <Input
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Enter password again"
              secureTextEntry
              autoComplete="new-password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Create Account"
              onPress={handleSignUp}
              loading={loading}
              disabled={
                !firstName.trim() ||
                !email.trim() ||
                !phoneNumber.trim() ||
                !password ||
                !confirmPassword ||
                oauthLoading !== null
              }
              style={styles.signUpButton}
            />

            <Text style={styles.terms}>
              By creating an account, you agree to our{" "}
              <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.signInLink}>Sign In</Text>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    textAlign: "center",
  },
  subtitle: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
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
  nameRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  nameInput: {
    flex: 1,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
  },
  success: {
    ...typography.caption,
    color: colors.success,
    textAlign: "center",
  },
  signUpButton: {
    marginTop: spacing.sm,
  },
  terms: {
    ...typography.small,
    textAlign: "center",
    color: colors.textSecondary,
  },
  termsLink: {
    color: colors.primary,
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  signInText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  signInLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  // Verification styles
  verificationHeader: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  verificationEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  verificationTitle: {
    ...typography.h2,
    textAlign: "center",
  },
  verificationText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  emailHighlight: {
    color: colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  verifyButton: {
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
});
