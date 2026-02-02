/**
 * SettlementQRCodeModal
 *
 * Displays QR codes for in-person payments.
 * The recipient shows this QR code, and the payer scans it with their payment app.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
} from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import {
  SettlementQRCode,
  generateSettlementQRCodes,
  getPaymentAppIcon,
  PaymentApp,
} from "../../lib/payment-links";
import { formatCurrency } from "../../lib/utils";

// Note: For actual QR code rendering, install react-native-qrcode-svg
// This component provides the structure and can use a placeholder until the library is added

interface SettlementQRCodeModalProps {
  visible: boolean;
  amount: number;
  recipientName: string;
  recipientInfo: {
    venmoUsername?: string;
    paypalUsername?: string;
    cashAppTag?: string;
  };
  note?: string;
  currency?: string;
  onClose: () => void;
}

export function SettlementQRCodeModal({
  visible,
  amount,
  recipientName,
  recipientInfo,
  note,
  currency = "USD",
  onClose,
}: SettlementQRCodeModalProps) {
  const qrCodes = generateSettlementQRCodes(amount, recipientInfo, note);
  const [selectedApp, setSelectedApp] = useState<PaymentApp | null>(
    qrCodes.length > 0 ? qrCodes[0].app : null
  );

  const selectedQRCode = qrCodes.find((qr) => qr.app === selectedApp);

  const handleShare = async () => {
    if (!selectedQRCode) return;

    try {
      await Share.share({
        message: `Pay ${recipientName} ${formatCurrency(amount, currency)} via ${selectedQRCode.displayName}: ${selectedQRCode.url}`,
        url: selectedQRCode.url,
      });
    } catch (error) {
      __DEV__ && console.error("Error sharing QR code:", error);
    }
  };

  if (qrCodes.length === 0) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>!</Text>
              <Text style={styles.emptyTitle}>No Payment Methods Linked</Text>
              <Text style={styles.emptyText}>
                {recipientName} hasn't linked any payment accounts yet.
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          {/* Header */}
          <Text style={styles.title}>Scan to Pay</Text>
          <Text style={styles.subtitle}>
            Pay {recipientName} {formatCurrency(amount, currency)}
          </Text>

          {/* App Selector */}
          {qrCodes.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.appSelector}
            >
              {qrCodes.map((qr) => (
                <TouchableOpacity
                  key={qr.app}
                  style={[
                    styles.appButton,
                    selectedApp === qr.app && styles.appButtonSelected,
                  ]}
                  onPress={() => setSelectedApp(qr.app)}
                >
                  <Text style={styles.appIcon}>{getPaymentAppIcon(qr.app)}</Text>
                  <Text
                    style={[
                      styles.appName,
                      selectedApp === qr.app && styles.appNameSelected,
                    ]}
                  >
                    {qr.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* QR Code Display */}
          {selectedQRCode && (
            <View style={styles.qrContainer}>
              <View style={styles.qrPlaceholder}>
                {/*
                  To render actual QR codes, install react-native-qrcode-svg:
                  npm install react-native-qrcode-svg react-native-svg

                  Then replace this placeholder with:
                  <QRCode value={selectedQRCode.url} size={200} />
                */}
                <View style={styles.qrCode}>
                  <Text style={styles.qrText}>QR</Text>
                </View>
                <Text style={styles.qrHint}>
                  Install react-native-qrcode-svg to render QR codes
                </Text>
              </View>
              <Text style={styles.qrAppLabel}>
                {getPaymentAppIcon(selectedQRCode.app)} {selectedQRCode.displayName}
              </Text>
            </View>
          )}

          {/* URL Display */}
          {selectedQRCode && (
            <View style={styles.urlContainer}>
              <Text style={styles.urlLabel}>Or share this link:</Text>
              <Text style={styles.urlText} numberOfLines={2}>
                {selectedQRCode.url}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>Share Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
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
    maxHeight: "85%",
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
  title: {
    ...typography.h3,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  appSelector: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  appButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  appButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  appIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  appName: {
    ...typography.small,
  },
  appNameSelected: {
    color: colors.primary,
    fontWeight: "500",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  qrPlaceholder: {
    alignItems: "center",
  },
  qrCode: {
    width: 200,
    height: 200,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  qrText: {
    ...typography.h1,
    color: colors.textMuted,
  },
  qrHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  qrAppLabel: {
    ...typography.bodyMedium,
    marginTop: spacing.md,
  },
  urlContainer: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  urlLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  urlText: {
    ...typography.small,
    color: colors.primary,
  },
  actions: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    gap: spacing.md,
  },
  shareButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  doneButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  closeButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: "600",
  },
});
