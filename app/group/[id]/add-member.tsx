import {
  View,
  Text,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius } from "../../../lib/theme";
import { Button, Card } from "../../../components/ui";

/**
 * Add Member Screen
 *
 * Instead of creating "dummy" members (which can't receive notifications,
 * claim receipts, or use payment features), we now guide users to invite
 * people via the share link. This ensures all members have proper accounts.
 */
export default function AddMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const handleInvite = () => {
    // Navigate to share screen to invite members
    router.replace(`/group/${id}/share`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add-outline" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>Invite Members</Text>
        <Text style={styles.subtitle}>
          Share your group link to invite friends. They'll create their own profile when they join.
        </Text>

        <Card style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>Why invite instead of add?</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <Text style={styles.benefitText}>They'll receive push notifications</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            <Text style={styles.benefitText}>They can claim items on receipts</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="logo-venmo" size={20} color={colors.primary} />
            <Text style={styles.benefitText}>You can request payments directly</Text>
          </View>
        </Card>

        <View style={styles.footer}>
          <Button
            title="Share Invite Link"
            onPress={handleInvite}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => router.back()}
            style={styles.cancelButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  benefitsCard: {
    width: "100%",
    marginBottom: spacing.xl,
  },
  benefitsTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.md,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  benefitText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  footer: {
    width: "100%",
    marginTop: "auto",
    paddingTop: spacing.lg,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});
