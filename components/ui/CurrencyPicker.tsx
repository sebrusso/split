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
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { SUPPORTED_CURRENCIES, getCurrencyInfo } from "../../lib/exchange-rates";

interface CurrencyPickerProps {
  visible: boolean;
  selectedCurrency: string;
  onSelect: (currencyCode: string) => void;
  onClose: () => void;
  title?: string;
}

export function CurrencyPicker({
  visible,
  selectedCurrency,
  onSelect,
  onClose,
  title = "Select Currency",
}: CurrencyPickerProps) {
  const handleSelect = (currencyCode: string) => {
    onSelect(currencyCode);
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
          <Text style={styles.title}>{title}</Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <TouchableOpacity
                key={currency.code}
                style={[
                  styles.currencyRow,
                  selectedCurrency === currency.code && styles.currencyRowSelected,
                ]}
                onPress={() => handleSelect(currency.code)}
                activeOpacity={0.7}
              >
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                  <View style={styles.currencyText}>
                    <Text
                      style={[
                        styles.currencyCode,
                        selectedCurrency === currency.code && styles.currencyCodeSelected,
                      ]}
                    >
                      {currency.code}
                    </Text>
                    <Text style={styles.currencyName}>{currency.name}</Text>
                  </View>
                </View>
                {selectedCurrency === currency.code && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface CurrencyButtonProps {
  currencyCode: string;
  onPress: () => void;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  disabled?: boolean;
}

/**
 * Small pill/badge button to display selected currency and trigger picker
 */
export function CurrencyButton({
  currencyCode,
  onPress,
  size = "md",
  showName = false,
  disabled = false,
}: CurrencyButtonProps) {
  const currency = getCurrencyInfo(currencyCode) || {
    code: currencyCode,
    symbol: currencyCode,
    name: currencyCode,
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`button_${size}`],
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text style={[styles.buttonSymbol, styles[`buttonSymbol_${size}`]]}>
        {currency.symbol}
      </Text>
      <Text style={[styles.buttonCode, styles[`buttonCode_${size}`]]}>
        {currency.code}
      </Text>
      {showName && (
        <Text style={styles.buttonName} numberOfLines={1}>
          {currency.name}
        </Text>
      )}
      {!disabled && (
        <Ionicons
          name="chevron-down"
          size={size === "lg" ? 18 : size === "md" ? 16 : 14}
          color={colors.textSecondary}
        />
      )}
    </TouchableOpacity>
  );
}

interface CurrencyPillProps {
  currencyCode: string;
  onPress?: () => void;
  size?: "sm" | "md";
}

/**
 * Compact currency pill for inline display (e.g., next to amounts)
 */
export function CurrencyPill({
  currencyCode,
  onPress,
  size = "md",
}: CurrencyPillProps) {
  const currency = getCurrencyInfo(currencyCode);

  const content = (
    <View style={[styles.pill, styles[`pill_${size}`]]}>
      <Text style={[styles.pillCode, styles[`pillCode_${size}`]]}>
        {currencyCode}
      </Text>
      {onPress && (
        <Ionicons
          name="chevron-down"
          size={size === "sm" ? 12 : 14}
          color={colors.textSecondary}
          style={styles.pillChevron}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface ConversionPreviewProps {
  fromAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  loading?: boolean;
}

/**
 * Shows conversion preview when expense currency differs from group currency
 */
export function ConversionPreview({
  fromAmount,
  fromCurrency,
  toCurrency,
  exchangeRate,
  loading = false,
}: ConversionPreviewProps) {
  const fromInfo = getCurrencyInfo(fromCurrency);
  const toInfo = getCurrencyInfo(toCurrency);
  const convertedAmount = fromAmount * exchangeRate;

  if (fromCurrency === toCurrency) {
    return null;
  }

  return (
    <View style={styles.conversionContainer}>
      <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
      {loading ? (
        <Text style={styles.conversionText}>Loading rate...</Text>
      ) : (
        <Text style={styles.conversionText}>
          = {toInfo?.symbol || toCurrency}
          {convertedAmount.toFixed(2)} in {toCurrency}
        </Text>
      )}
      <Text style={styles.rateText}>
        (1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Modal styles
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: "70%",
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
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  currencyInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  currencySymbol: {
    ...typography.h2,
    width: 40,
    textAlign: "center",
    marginRight: spacing.md,
  },
  currencyText: {
    flex: 1,
  },
  currencyCode: {
    ...typography.bodyMedium,
  },
  currencyCodeSelected: {
    color: colors.primary,
  },
  currencyName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Button styles
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button_sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  button_md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  button_lg: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonSymbol: {
    fontWeight: "600",
    color: colors.text,
  },
  buttonSymbol_sm: {
    fontSize: 14,
  },
  buttonSymbol_md: {
    fontSize: 16,
  },
  buttonSymbol_lg: {
    fontSize: 20,
  },
  buttonCode: {
    fontWeight: "500",
    color: colors.textSecondary,
  },
  buttonCode_sm: {
    fontSize: 12,
  },
  buttonCode_md: {
    fontSize: 14,
  },
  buttonCode_lg: {
    fontSize: 16,
  },
  buttonName: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },

  // Pill styles
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill_sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pill_md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillCode: {
    fontWeight: "500",
    color: colors.textSecondary,
  },
  pillCode_sm: {
    fontSize: 11,
  },
  pillCode_md: {
    fontSize: 13,
  },
  pillChevron: {
    marginLeft: 2,
  },

  // Conversion preview styles
  conversionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    flexWrap: "wrap",
  },
  conversionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rateText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
