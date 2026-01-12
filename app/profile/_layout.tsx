import { Stack } from "expo-router";
import { colors } from "../../lib/theme";

/**
 * Profile Stack Layout
 * Handles navigation for profile and settings screens
 */
export default function ProfileLayout() {
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
      <Stack.Screen
        name="index"
        options={{
          title: "Profile",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: "Edit Profile",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="change-email"
        options={{
          title: "Change Email",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="change-password"
        options={{
          title: "Change Password",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
