/**
 * Navigation Utilities
 *
 * Helper functions for consistent navigation patterns across the app.
 * These handle common navigation scenarios like resetting the stack
 * and navigating to a new screen.
 */

import { router } from "expo-router";

/**
 * Reset the navigation stack to the tabs root, then navigate to a path.
 *
 * Use this when completing a flow (like receipt scanning) and you want
 * the back button to go to the Groups tab, not the previous screen.
 *
 * @param path - The path to navigate to after resetting (e.g., "/group/123")
 * @param delay - Optional delay in ms before pushing (default: 0)
 *
 * @example
 * // After finishing receipt assignment, navigate to group
 * resetAndNavigate(`/group/${groupId}`);
 */
export function resetAndNavigate(path: string, delay: number = 0): void {
  // First, replace current stack with tabs root
  router.replace("/(tabs)");
  // Then push the new path after the tab switch completes
  setTimeout(() => {
    router.push(path);
  }, delay);
}

/**
 * Navigate to a group with clean back navigation.
 *
 * Ensures pressing back from the group detail goes to the Groups tab.
 *
 * @param groupId - The group ID to navigate to
 */
export function navigateToGroup(groupId: string): void {
  resetAndNavigate(`/group/${groupId}`);
}

/**
 * Navigate to a group's receipt claiming flow with clean back navigation.
 *
 * @param groupId - The group ID
 * @param receiptId - The receipt ID to start claiming
 */
export function navigateToReceiptClaiming(
  groupId: string,
  receiptId: string
): void {
  resetAndNavigate(`/group/${groupId}/receipt/${receiptId}/split-method`);
}

/**
 * Navigate to tabs root (Groups tab by default).
 *
 * Use this when you want to dismiss all screens and go back to the main app.
 */
export function navigateToTabs(): void {
  router.replace("/(tabs)");
}
