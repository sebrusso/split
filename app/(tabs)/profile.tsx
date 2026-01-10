/**
 * Profile Tab Screen (Account)
 *
 * Displays user info and account settings.
 * Links to detailed profile screens in the profile stack.
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useUser, useClerk } from "@clerk/clerk-expo";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import { Button, Card, Avatar } from "../../components/ui";

/**
 * Profile Tab Screen
 * Displays user info and account settings
 */
export default function ProfileTabScreen() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
              router.replace("/auth/sign-in");
            } catch (error) {
              console.error("Sign out error:", error);
              Alert.alert("Error", "Failed to sign out. Please try again.");
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [signOut]);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName =
    user?.fullName || user?.firstName || user?.username || "User";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const avatarUrl = user?.imageUrl;
  const createdAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>Account</Text>

        {/* Profile Header */}
        <View style={styles.header}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Avatar name={displayName} size="lg" style={styles.avatar} />
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{email}</Text>
          {createdAt && (
            <Text style={styles.memberSince}>Member since {createdAt}</Text>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/profile/edit")}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuIcon}>👤</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Edit Profile</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Update your name and photo
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/profile/change-email")}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuIcon}>📧</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Email</Text>
                  <Text style={styles.menuItemSubtitle}>{email}</Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/profile/change-password")}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuIcon}>🔒</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Password</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Change your password
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Social Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/friends")}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuIcon}>👥</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Friends</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Manage your friends list
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/profile/settings")}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuIcon}>⚙️</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Settings</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Currency, notifications
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Alert.alert(
                  "Help & Support",
                  "For questions or feedback, email us at support@splitfree.app"
                );
              }}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuIcon}>❓</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Help & Support</Text>
                  <Text style={styles.menuItemSubtitle}>
                    Get help or send feedback
                  </Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Alert.alert("About SplitFree", "Version 1.0.0\n\n100% free expense splitting.\nNo limits. No paywalls.\n\nMade with love for friends who split bills.");
              }}
            >
              <View style={styles.menuItemContent}>
                <Text style={styles.menuIcon}>ℹ️</Text>
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>About</Text>
                  <Text style={styles.menuItemSubtitle}>Version 1.0.0</Text>
                </View>
              </View>
              <Text style={styles.menuArrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <Button
            title={signingOut ? "Signing Out..." : "Sign Out"}
            onPress={handleSignOut}
            variant="danger"
            loading={signingOut}
            disabled={signingOut}
          />
        </View>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteAccount}
          onPress={() => {
            Alert.alert(
              "Delete Account",
              "This will permanently delete your account and all associated data. This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    Alert.alert(
                      "Confirm Deletion",
                      "Are you absolutely sure? Type DELETE to confirm.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Yes, Delete My Account",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await user?.delete();
                              router.replace("/auth/sign-in");
                            } catch (error: any) {
                              console.error("Delete account error:", error);
                              Alert.alert(
                                "Error",
                                error.errors?.[0]?.message ||
                                  "Failed to delete account. Contact support@splitfree.app"
                              );
                            }
                          },
                        },
                      ]
                    );
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.md,
  },
  name: {
    ...typography.h2,
    textAlign: "center",
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  memberSince: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  menuCard: {
    padding: 0,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    ...typography.bodyMedium,
  },
  menuItemSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.lg + 24 + spacing.md, // Icon + margin offset
  },
  signOutContainer: {
    marginTop: spacing.lg,
  },
  deleteAccount: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  deleteAccountText: {
    ...typography.caption,
    color: colors.danger,
  },
});
