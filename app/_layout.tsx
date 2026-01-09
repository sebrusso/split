import { useEffect } from "react";
import { Stack, useSegments, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { colors } from "../lib/theme";
import { CLERK_PUBLISHABLE_KEY, tokenCache, isClerkConfigured } from "../lib/clerk";
import { AuthProvider } from "../lib/auth-context";
import {
  configureNotificationHandler,
  registerPushToken,
  removePushToken,
} from "../lib/notifications";

// Note: Offline support requires native modules (development build)
// It's disabled in Expo Go - will be enabled when building for production

SplashScreen.preventAutoHideAsync();

/**
 * Authentication Guard
 * Redirects users based on their auth state
 * Also handles push notification registration
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "auth";

    if (!isSignedIn && !inAuthGroup) {
      // Redirect to sign-in if not authenticated and not already in auth flow
      router.replace("/auth/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      // Redirect to home if authenticated but still in auth flow
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  // Register for push notifications when user signs in
  useEffect(() => {
    if (isSignedIn && userId) {
      // Register push token in the background
      registerPushToken(userId).catch((error) => {
        console.error("Failed to register push token:", error);
      });
    } else if (!isSignedIn && userId) {
      // Remove push token when user signs out
      removePushToken(userId).catch((error) => {
        console.error("Failed to remove push token:", error);
      });
    }
  }, [isSignedIn, userId]);

  return <>{children}</>;
}

/**
 * Main Navigation Stack
 */
function RootNavigator() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: "Inter_600SemiBold",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
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

      {/* Main app screens */}
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
          headerBackTitle: "Home",
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

      {/* Activity screen */}
      <Stack.Screen
        name="activity"
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

      {/* Global balances screen */}
      <Stack.Screen
        name="balances"
        options={{
          title: "All Balances",
          headerBackTitle: "Home",
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

  // Check if Clerk is configured
  if (!isClerkConfigured()) {
    console.warn(
      "Clerk is not configured. Please update CLERK_PUBLISHABLE_KEY in lib/clerk.ts"
    );
    // Continue without auth for development - remove this in production
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <AuthProvider>
          <StatusBar style="dark" />
          <AuthGuard>
            <RootNavigator />
          </AuthGuard>
        </AuthProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
