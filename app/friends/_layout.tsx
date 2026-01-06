/**
 * Friends Stack Layout
 *
 * Navigation layout for the friends section including
 * friend list, add friend, and friend requests screens.
 */

import { Stack } from "expo-router";
import { colors } from "../../lib/theme";

export default function FriendsLayout() {
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
          title: "Friends",
          headerBackTitle: "Home",
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: "Add Friend",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="requests"
        options={{
          title: "Friend Requests",
        }}
      />
    </Stack>
  );
}
