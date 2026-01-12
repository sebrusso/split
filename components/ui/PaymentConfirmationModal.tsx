/**
 * PaymentConfirmationModal
 *
 * Modal shown when user returns to the app after opening a payment app.
 * Allows them to confirm whether the payment was completed.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import {
  PendingPaymentSession,
  formatTimeSinceOpened,
  isReasonablePaymentDuration,
  getPaymentAppName,
  getPaymentAppIcon,
} from "../../lib/payment-links";
import { formatCurrency } from "../../lib/utils";

interface PaymentConfirmationModalProps {
  visible: boolean;
  session: PendingPaymentSession | null;
  onConfirm: (transactionId?: string) => void;
  onNotCompleted: () => void;
  onRetry: () => void;
  onClose: () => void;
  isLoading?: boolean;
  currency?: string;
}

export function PaymentConfirmationModal({
  visible,
  session,
  onConfirm,
  onNotCompleted,
  onRetry,
  onClose,
  isLoading = false,
  currency = "USD",
}: PaymentConfirmationModalProps) {
  const [transactionId, setTransactionId] = useState("");
  const [showTransactionInput, setShowTransactionInput] = useState(false);

  if (!session) return null;

  const appName = getPaymentAppName(session.app);
  const appIcon = getPaymentAppIcon(session.app);
  const timeSinceOpened = formatTimeSinceOpened(session);
  const isReasonableDuration = isReasonablePaymentDuration(session);

  const handleConfirm = () => {
    onConfirm(transactionId.trim() || undefined);
    setTransactionId("");
    setShowTransactionInput(false);
  };

  const handleNotCompleted = () => {
    onNotCompleted();
    setTransactionId("");
    setShowTransactionInput(false);
  };

  const handleClose = () => {
    onClose();
    setTransactionId("");
    setShowTransactionInput(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appIcon}>{appIcon}</Text>
            <Text style={styles.title}>Did you complete the payment?</Text>
          </View>

          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>To</Text>
              <Text style={styles.summaryValue}>{session.recipientName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(session.amount, currency)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Via</Text>
              <Text style={styles.summaryValue}>{appName}</Text>
            </View>
            <Text style={styles.timeLabel}>Opened {timeSinceOpened}</Text>
          </View>

          {/* Warning if too quick */}
          {!isReasonableDuration && (
            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>!</Text>
              <Text style={styles.warningText}>
                That was quick! Make sure you completed the payment in {appName}.
              </Text>
            </View>
          )}

          {/* Transaction ID Input (optional) */}
          {showTransactionInput ? (
            <View style={styles.transactionInputSection}>
              <Text style={styles.transactionLabel}>
                Transaction ID (optional)
              </Text>
              <TextInput
                style={styles.transactionInput}
                value={transactionId}
                onChangeText={setTransactionId}
                placeholder="e.g., 3847592034"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.transactionHint}>
                Adding a transaction ID helps track payments
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addTransactionButton}
              onPress={() => setShowTransactionInput(true)}
            >
              <Text style={styles.addTransactionText}>
                + Add transaction ID (optional)
              </Text>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Recording payment...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>
                    Yes, payment completed
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.notCompletedButton}
                  onPress={handleNotCompleted}
                >
                  <Text style={styles.notCompletedButtonText}>
                    No, not completed
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                  <Text style={styles.retryButtonText}>
                    Open {appName} again
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  appIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    textAlign: "center",
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.bodyMedium,
  },
  summaryAmount: {
    ...typography.amountMedium,
    color: colors.primary,
  },
  timeLabel: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  warningBox: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: "#FEF3C7",
    borderRadius: borderRadius.md,
    flexDirection: "row",
    alignItems: "center",
  },
  warningIcon: {
    fontSize: 18,
    color: "#D97706",
    fontWeight: "bold",
    marginRight: spacing.sm,
  },
  warningText: {
    ...typography.small,
    color: "#92400E",
    flex: 1,
  },
  transactionInputSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  transactionLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  transactionInput: {
    ...typography.body,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transactionHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  addTransactionButton: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.sm,
  },
  addTransactionText: {
    ...typography.small,
    color: colors.primary,
    textAlign: "center",
  },
  actions: {
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  loadingText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontFamily: "Inter_600SemiBold",
  },
  notCompletedButton: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  notCompletedButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  retryButtonText: {
    ...typography.small,
    color: colors.primary,
  },
});
