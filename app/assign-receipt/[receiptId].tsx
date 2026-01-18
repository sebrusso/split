/**
 * Assign Receipt Screen
 *
 * Review OCR results, edit items, select/create group, and share.
 * This is the second step after scanning a receipt.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../lib/theme";
import {
  Button,
  Card,
  GroupPicker,
  GroupPickerButton,
  QuickCreateGroup,
} from "../../components/ui";
import { useReceipt, useReceiptGroupAssignment } from "../../lib/useReceipts";
import { useAuth } from "../../lib/auth-context";
import { formatCurrency } from "../../lib/utils";

export default function AssignReceiptScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const { userId } = useAuth();
  const { receipt, items, loading, error, refetch } = useReceipt(receiptId);
  const { assignGroup, assigning } = useReceiptGroupAssignment();

  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<{
    id: string;
    name: string;
    emoji?: string;
  } | null>(null);
  const [assignedShareCode, setAssignedShareCode] = useState<string | null>(null);

  // Handle group selection
  const handleGroupSelect = (groupId: string, groupName: string) => {
    setSelectedGroup({ id: groupId, name: groupName });
    setShowGroupPicker(false);
  };

  // Handle create new group
  const handleCreateNew = () => {
    setShowGroupPicker(false);
    setShowCreateGroup(true);
  };

  // Handle group created
  const handleGroupCreated = (groupId: string, groupName: string) => {
    setSelectedGroup({ id: groupId, name: groupName });
    setShowCreateGroup(false);
  };

  // Handle assign receipt to group
  const handleAssign = async () => {
    if (!selectedGroup || !receiptId || !userId) {
      Alert.alert("Error", "Please select a group");
      return;
    }

    const result = await assignGroup(receiptId, selectedGroup.id, userId);

    if (!result.success) {
      Alert.alert("Error", result.error || "Failed to assign receipt");
      return;
    }

    setAssignedShareCode(result.shareCode || null);
    setShowShareOptions(true);
  };

  // Handle share via iMessage/share sheet
  const handleShare = async () => {
    if (!assignedShareCode || !receipt) return;

    const shareUrl = `https://splitfree.app/r/${assignedShareCode}`;
    const message = `Claim your items from ${receipt.merchant_name || "a receipt"}!\n\n${shareUrl}`;

    try {
      await Share.share({
        message,
        url: shareUrl,
      });
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  // Handle copy link
  const handleCopyLink = async () => {
    if (!assignedShareCode) return;

    const shareUrl = `https://splitfree.app/r/${assignedShareCode}`;
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert("Copied!", "Link copied to clipboard");
  };

  // Navigate to split method picker screen
  const handleStartClaiming = () => {
    if (selectedGroup && receiptId) {
      // Reset navigation to Groups tab, then navigate to the group's claiming flow
      // This ensures back navigation goes to Groups tab, not Scan tab
      router.replace("/(tabs)");
      // Use setTimeout to ensure the tab switch completes before pushing
      setTimeout(() => {
        router.push(`/group/${selectedGroup.id}/receipt/${receiptId}/split-method`);
      }, 0);
    }
  };

  // Navigate to group
  const handleDone = () => {
    if (selectedGroup) {
      // Reset navigation to Groups tab, then navigate to the group
      // This ensures back navigation goes to Groups tab, not Scan tab
      router.replace("/(tabs)");
      // Use setTimeout to ensure the tab switch completes before pushing
      setTimeout(() => {
        router.push(`/group/${selectedGroup.id}`);
      }, 0);
    } else {
      router.replace("/(tabs)");
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.danger} />
          <Text style={styles.errorTitle}>Receipt Not Found</Text>
          <Text style={styles.errorText}>
            {error || "This receipt could not be loaded."}
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            variant="secondary"
          />
        </View>
      </SafeAreaView>
    );
  }

  // Share options view (after assignment)
  if (showShareOptions) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Receipt Assigned" }} />
        <ScrollView contentContainerStyle={styles.shareContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Receipt Added!</Text>
          <Text style={styles.successSubtitle}>
            Added to {selectedGroup?.name}
          </Text>

          <Card style={styles.shareCard}>
            <Text style={styles.shareCardTitle}>Share with your group</Text>
            <Text style={styles.shareCardText}>
              Let others claim their items via iMessage or a link
            </Text>

            <View style={styles.shareButtons}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={24} color={colors.primary} />
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleCopyLink}
                activeOpacity={0.7}
              >
                <Ionicons name="link-outline" size={24} color={colors.primary} />
                <Text style={styles.shareButtonText}>Copy Link</Text>
              </TouchableOpacity>
            </View>
          </Card>

          <View style={styles.actionButtons}>
            <Button
              title="Start Claiming"
              onPress={handleStartClaiming}
              style={styles.primaryButton}
            />
            <Button
              title="Done"
              onPress={handleDone}
              variant="secondary"
              style={styles.secondaryButton}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main assignment view
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen
        options={{
          title: "Review Receipt",
          headerBackTitle: "Cancel",
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Receipt Preview */}
        <Card style={styles.previewCard}>
          <View style={styles.previewHeader}>
            {receipt.image_thumbnail_url ? (
              <Image
                source={{ uri: receipt.image_thumbnail_url }}
                style={styles.thumbnail}
              />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="receipt" size={32} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.previewInfo}>
              <Text style={styles.merchantName}>
                {receipt.merchant_name || "Receipt"}
              </Text>
              {receipt.receipt_date && (
                <Text style={styles.receiptDate}>{receipt.receipt_date}</Text>
              )}
              <Text style={styles.totalAmount}>
                {formatCurrency(receipt.total_amount || 0, receipt.currency)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Items List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Items ({items.length})
            </Text>
            <TouchableOpacity
              onPress={() => {
                // Navigate to edit screen - but need group first
                if (selectedGroup) {
                  router.push(`/group/${selectedGroup.id}/receipt/${receiptId}/edit`);
                } else {
                  Alert.alert("Select Group First", "Please select a group before editing items.");
                }
              }}
            >
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <Card style={styles.emptyItems}>
              <Text style={styles.emptyText}>No items detected</Text>
              <Text style={styles.emptySubtext}>
                You can add items manually after assigning to a group
              </Text>
            </Card>
          ) : (
            <Card style={styles.itemsCard}>
              {items.slice(0, 5).map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index < Math.min(items.length, 5) - 1 && styles.itemRowBorder,
                  ]}
                >
                  <Text style={styles.itemDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatCurrency(item.total_price, receipt.currency)}
                  </Text>
                </View>
              ))}
              {items.length > 5 && (
                <Text style={styles.moreItems}>
                  +{items.length - 5} more items
                </Text>
              )}
            </Card>
          )}
        </View>

        {/* Group Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add to Group</Text>
          <GroupPickerButton
            selectedGroup={selectedGroup}
            onPress={() => setShowGroupPicker(true)}
            placeholder="Select a group"
          />
        </View>

        {/* Assign Button */}
        <Button
          title={assigning ? "Assigning..." : "Add to Group"}
          onPress={handleAssign}
          disabled={!selectedGroup || assigning}
          loading={assigning}
          style={styles.assignButton}
        />
      </ScrollView>

      {/* Group Picker Modal */}
      {userId && (
        <GroupPicker
          visible={showGroupPicker}
          clerkUserId={userId}
          selectedGroupId={selectedGroup?.id}
          onSelect={handleGroupSelect}
          onCreateNew={handleCreateNew}
          onClose={() => setShowGroupPicker(false)}
        />
      )}

      {/* Quick Create Group Modal */}
      {userId && (
        <QuickCreateGroup
          visible={showCreateGroup}
          clerkUserId={userId}
          onCreated={handleGroupCreated}
          onCancel={() => setShowCreateGroup(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  previewCard: {
    marginBottom: spacing.lg,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  previewInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  merchantName: {
    ...typography.h3,
  },
  receiptDate: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  totalAmount: {
    ...typography.h2,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  editLink: {
    ...typography.body,
    color: colors.primary,
  },
  itemsCard: {
    paddingVertical: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemDescription: {
    ...typography.body,
    flex: 1,
    marginRight: spacing.md,
  },
  itemPrice: {
    ...typography.bodyMedium,
    fontWeight: "500",
  },
  moreItems: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
  emptyItems: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  assignButton: {
    marginTop: spacing.md,
  },
  // Share options styles
  shareContent: {
    padding: spacing.lg,
    alignItems: "center",
  },
  successIcon: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.h1,
    textAlign: "center",
  },
  successSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  shareCard: {
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  shareCardTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  shareCardText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  shareButtons: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  shareButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  shareButtonText: {
    ...typography.small,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: "500",
  },
  actionButtons: {
    width: "100%",
    gap: spacing.md,
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
  },
});
