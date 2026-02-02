import { useEffect, useRef, useState } from "react";
import { Stack, useSegments, useRouter, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet, Text, Platform } from "react-native";

// Initialize Reactotron in development (native only)
if (__DEV__ && Platform.OS !== "web") {
  require("../ReactotronConfig");
}
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, ThemeProvider, useTheme } from "../lib/theme";
import { CLERK_PUBLISHABLE_KEY, tokenCache, isClerkConfigured } from "../lib/clerk";
import { AuthProvider } from "../lib/auth-context";
import { useSupabase } from "../lib/supabase";
import { AnalyticsProvider, useAnalytics } from "../lib/analytics-provider";
import {
  configureNotificationHandler,
  registerPushToken,
  removePushToken,
} from "../lib/notifications";
import { logger } from "../lib/logger";
import { WELCOME_SEEN_KEY } from "./auth/welcome";

// Key to track if user has completed/skipped Venmo onboarding
export const VENMO_ONBOARDING_KEY = "@splitfree/venmo_onboarding_completed";
import {
  initSentry,
  setSentryUser,
  clearSentryUser,
  SentryErrorBoundary,
  addBreadcrumb,
} from "../lib/sentry";

// Initialize Sentry early
initSentry();

// Note: Offline support requires native modules (development build)
// It's disabled in Expo Go - will be enabled when building for production

SplashScreen.preventAutoHideAsync();

/**
 * Authentication Guard
 * Redirects users based on their auth state
 * Also handles push notification registration and welcome flow
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { getSupabase } = useSupabase();
  const segments = useSegments();
  const router = useRouter();
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(true); // Default to true to avoid flicker
  const [venmoOnboardingChecked, setVenmoOnboardingChecked] = useState(false);
  const [hasCompletedVenmoOnboarding, setHasCompletedVenmoOnboarding] = useState(true); // Default to true to avoid flicker

  // Check if user has seen welcome screen
  useEffect(() => {
    const checkWelcome = async () => {
      try {
        const seen = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
        setHasSeenWelcome(seen === "true");
      } catch {
        setHasSeenWelcome(true); // On error, skip welcome
      }
      setWelcomeChecked(true);
    };
    checkWelcome();
  }, []);

  // Check if user has completed/skipped Venmo onboarding (only when signed in)
  useEffect(() => {
    const checkVenmoOnboarding = async () => {
      if (!isSignedIn || !userId) {
        setVenmoOnboardingChecked(true);
        return;
      }
      try {
        const completed = await AsyncStorage.getItem(VENMO_ONBOARDING_KEY);
        setHasCompletedVenmoOnboarding(completed === "true");
      } catch {
        setHasCompletedVenmoOnboarding(true); // On error, skip onboarding
      }
      setVenmoOnboardingChecked(true);
    };
    checkVenmoOnboarding();
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded || !welcomeChecked || !venmoOnboardingChecked) return;

    const inAuthGroup = segments[0] === "auth";
    const inOnboardingGroup = segments[0] === "onboarding";

    if (!isSignedIn && !inAuthGroup) {
      // Not signed in and not in auth flow
      if (!hasSeenWelcome) {
        // First time user - show welcome carousel
        router.replace("/auth/welcome");
      } else {
        // Returning user - go to sign-in
        router.replace("/auth/sign-in");
      }
    } else if (isSignedIn && inAuthGroup) {
      // Just signed in - check if needs Venmo onboarding
      if (!hasCompletedVenmoOnboarding) {
        router.replace("/onboarding/venmo");
      } else {
        router.replace("/");
      }
    }
    // Note: We intentionally don't redirect back to Venmo onboarding if user
    // is already in the main app. This prevents navigation loops when the
    // AsyncStorage state hasn't updated yet after completing onboarding.
  }, [isLoaded, isSignedIn, segments, router, welcomeChecked, hasSeenWelcome, venmoOnboardingChecked, hasCompletedVenmoOnboarding]);

  // Register for push notifications and set Sentry user context when user signs in
  useEffect(() => {
    if (isSignedIn && userId) {
      // Register push token in the background with authenticated client
      (async () => {
        try {
          const supabaseClient = await getSupabase();
          await registerPushToken(supabaseClient, userId);
        } catch (error) {
          logger.error("Failed to register push token:", error);
        }
      })();

      // Set Sentry user context for error tracking
      setSentryUser({ id: userId });
      addBreadcrumb("auth", "User signed in", { userId });
    } else if (!isSignedIn && userId) {
      // Remove push token when user signs out with authenticated client
      (async () => {
        try {
          const supabaseClient = await getSupabase();
          await removePushToken(supabaseClient, userId);
        } catch (error) {
          logger.error("Failed to remove push token:", error);
        }
      })();

      // Clear Sentry user context
      clearSentryUser();
      addBreadcrumb("auth", "User signed out");
    }
  }, [isSignedIn, userId, getSupabase]);

  return <>{children}</>;
}

/**
 * Screen Tracking Component
 * Tracks screen views for analytics
 */
function ScreenTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { trackScreen, isReady } = useAnalytics();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    // Only track if path actually changed
    if (pathname && pathname !== previousPath.current) {
      // Convert path to readable screen name
      // e.g., "/group/123/add-expense" -> "group_add_expense"
      const screenName = pathname
        .replace(/^\//, "") // Remove leading slash
        .replace(/\/\[.*?\]/g, "") // Remove dynamic segments like [id]
        .replace(/\//g, "_") // Replace slashes with underscores
        || "home";

      trackScreen(screenName);

      // Add Sentry navigation breadcrumb
      addBreadcrumb("navigation", `Navigated to ${screenName}`, {
        from: previousPath.current,
        to: pathname,
      });

      previousPath.current = pathname;
    }
  }, [pathname, isReady, trackScreen]);

  return <>{children}</>;
}

/**
 * Themed StatusBar that responds to theme changes
 */
function ThemedStatusBar() {
  const { effectiveScheme } = useTheme();
  return <StatusBar style={effectiveScheme === "dark" ? "light" : "dark"} />;
}

/**
 * Main Navigation Stack
 * Uses theme-aware colors from the ThemeProvider
 */
function RootNavigator() {
  const { colors: themeColors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: themeColors.background,
        },
        headerTintColor: themeColors.text,
        headerTitleStyle: {
          fontFamily: "Inter_600SemiBold",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: themeColors.background,
        },
      }}
    >
      {/* Auth screens */}
      <Stack.Screen
        name="auth"
        options={{
          headerShown: false,
        }}
      />

      {/* Tab Navigator (Groups, Balances, Activity, Account) */}
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />

      {/* Legacy index redirect - will be handled by (tabs)/index.tsx */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Home",
        }}
      />

      <Stack.Screen
        name="create-group"
        options={{
          title: "New Group",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="group/[id]/index"
        options={{
          title: "",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="group/[id]/add-expense"
        options={{
          title: "Add Expense",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="group/[id]/expense/[expenseId]"
        options={{
          title: "Expense Details",
        }}
      />
      <Stack.Screen
        name="group/[id]/add-member"
        options={{
          title: "Add Member",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="group/[id]/balances"
        options={{
          title: "Balances",
        }}
      />
      <Stack.Screen
        name="group/[id]/share"
        options={{
          title: "Share Group",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="group/[id]/edit"
        options={{
          title: "Edit Group",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="group/[id]/trash"
        options={{
          title: "Trash",
        }}
      />
      <Stack.Screen
        name="group/[id]/ledger"
        options={{
          title: "Transaction Ledger",
        }}
      />
      <Stack.Screen
        name="group/[id]/recurring"
        options={{
          title: "Recurring Expenses",
        }}
      />
      <Stack.Screen
        name="group/[id]/add-recurring"
        options={{
          title: "Add Recurring Expense",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="group/[id]/scan-receipt"
        options={{
          title: "Scan Receipt",
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="group/[id]/receipt/[receiptId]/index"
        options={{
          title: "Claim Items",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="group/[id]/receipt/[receiptId]/edit"
        options={{
          title: "Edit Receipt",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="group/[id]/receipt/[receiptId]/settle"
        options={{
          title: "Receipt",
        }}
      />
      <Stack.Screen
        name="group/[id]/receipt/[receiptId]/split-method"
        options={{
          title: "Split Receipt",
        }}
      />
      <Stack.Screen
        name="group/[id]/receipt/[receiptId]/split-evenly"
        options={{
          title: "Split Evenly",
        }}
      />
      <Stack.Screen
        name="group/[id]/receipt/[receiptId]/split-item"
        options={{
          title: "Split Item",
        }}
      />
      <Stack.Screen
        name="join/index"
        options={{
          title: "Join Group",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="join/[code]"
        options={{
          title: "Joining...",
          headerShown: false,
        }}
      />

      {/* Profile screens */}
      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
        }}
      />

      {/* Friends screens */}
      <Stack.Screen
        name="friends"
        options={{
          headerShown: false,
        }}
      />

      {/* Search screen */}
      <Stack.Screen
        name="search"
        options={{
          headerShown: false,
        }}
      />

      {/* Onboarding screens */}
      <Stack.Screen
        name="onboarding/venmo"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Configure notification handler on app start
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Verify Clerk is properly configured for production
  if (!isClerkConfigured()) {
    if (__DEV__) {
      logger.warn(
        "Clerk is not configured. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your environment."
      );
    } else {
      // In production, throw an error if Clerk is not configured
      throw new Error(
        "Authentication is not configured. Please contact support."
      );
    }
  }

  // Error fallback for Sentry error boundary
  const errorFallback = ({ resetError }: { resetError: () => void }) => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>
        The app encountered an unexpected error. Please try again.
      </Text>
      <Text style={styles.errorButton} onPress={resetError}>
        Try Again
      </Text>
    </View>
  );

  return (
    <SentryErrorBoundary fallback={errorFallback}>
      <ThemeProvider>
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY}
          tokenCache={tokenCache}
        >
          <ClerkLoaded>
            <AuthProvider>
              <AnalyticsProvider>
                <ThemedStatusBar />
                <AuthGuard>
                  <ScreenTracker>
                    <RootNavigator />
                  </ScreenTracker>
                </AuthGuard>
              </AnalyticsProvider>
            </AuthProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ThemeProvider>
    </SentryErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: colors.text,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  errorButton: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
