import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";

export type SettlementMethod = "cash" | "venmo" | "paypal" | "bank_transfer" | "zelle" | "other";

interface SettlementMethodOption {
  id: SettlementMethod;
  name: string;
  icon: string;
  color: string;
}

const SETTLEMENT_METHODS: SettlementMethodOption[] = [
  { id: "cash", name: "Cash", icon: "💵", color: "#10B981" },
  { id: "venmo", name: "Venmo", icon: "📱", color: "#3D95CE" },
  { id: "paypal", name: "PayPal", icon: "💳", color: "#0070BA" },
  { id: "zelle", name: "Zelle", icon: "⚡", color: "#6D1ED4" },
  { id: "bank_transfer", name: "Bank Transfer", icon: "🏦", color: "#059669" },
  { id: "other", name: "Other", icon: "💰", color: "#6B7280" },
];

interface SettlementMethodPickerProps {
  visible: boolean;
  selectedMethod: SettlementMethod;
  onSelect: (method: SettlementMethod) => void;
  onClose: () => void;
}

export function SettlementMethodPicker({
  visible,
  selectedMethod,
  onSelect,
  onClose,
}: SettlementMethodPickerProps) {
  const handleSelect = (method: SettlementMethod) => {
    onSelect(method);
    onClose();
  };

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
          <Text style={styles.title}>Payment Method</Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {SETTLEMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodButton,
                  selectedMethod === method.id && styles.methodButtonSelected,
                ]}
                onPress={() => handleSelect(method.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: method.color + "20" },
                  ]}
                >
                  <Text style={styles.icon}>{method.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.methodName,
                    selectedMethod === method.id && styles.methodNameSelected,
                  ]}
                >
                  {method.name}
                </Text>
                {selectedMethod === method.id && (
                  <View style={[styles.checkmark, { backgroundColor: method.color }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Button to display current settlement method selection
interface SettlementMethodButtonProps {
  method: SettlementMethod;
  onPress: () => void;
}

export function SettlementMethodButton({ method, onPress }: SettlementMethodButtonProps) {
  const methodOption = SETTLEMENT_METHODS.find((m) => m.id === method) || SETTLEMENT_METHODS[0];

  return (
    <TouchableOpacity
      style={styles.selectButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.selectIconContainer, { backgroundColor: methodOption.color + "20" }]}>
        <Text style={styles.selectIcon}>{methodOption.icon}</Text>
      </View>
      <Text style={styles.selectText}>{methodOption.name}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// Helper function to get method display name
export function getSettlementMethodName(method: SettlementMethod): string {
  const methodOption = SETTLEMENT_METHODS.find((m) => m.id === method);
  return methodOption?.name || "Cash";
}

// Helper function to get method icon
export function getSettlementMethodIcon(method: SettlementMethod): string {
  const methodOption = SETTLEMENT_METHODS.find((m) => m.id === method);
  return methodOption?.icon || "💵";
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
    maxHeight: "60%",
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
  title: {
    ...typography.h3,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  scrollView: {
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  methodButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  methodButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 22,
  },
  methodName: {
    ...typography.bodyMedium,
    flex: 1,
  },
  methodNameSelected: {
    color: colors.primary,
    fontWeight: "500",
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  // SettlementMethodButton styles
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  selectIcon: {
    fontSize: 22,
  },
  selectText: {
    ...typography.bodyMedium,
    flex: 1,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
});
