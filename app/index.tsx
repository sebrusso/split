/**
 * Root Index - Redirects to Tab Navigator
 *
 * This file exists for backward compatibility. The main home screen
 * is now in app/(tabs)/index.tsx with bottom tab navigation.
 */
import { Redirect } from "expo-router";

export default function RootIndex() {
  // Redirect to the tabs navigator
  return <Redirect href="/(tabs)" />;
}
