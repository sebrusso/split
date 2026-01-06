import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { formatCurrency } from "../../lib/utils";
import { Avatar } from "./Avatar";

interface BalanceCardProps {
  name: string;
  emoji?: string;
  balance: number;
  currency?: string;
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * Balance card for displaying group or friend balances
 */
export function BalanceCard({
  name,
  emoji,
  balance,
  currency = "USD",
  subtitle,
  onPress,
  style,
}: BalanceCardProps) {
  const isPositive = balance > 0.01;
  const isNegative = balance < -0.01;
  const isSettled = !isPositive && !isNegative;

  const balanceColor = isPositive
    ? colors.success
    : isNegative
      ? colors.danger
      : colors.textSecondary;

  const statusText = isPositive
    ? "is owed"
    : isNegative
      ? "owes"
      : "settled";

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, shadows.md, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.left}>
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : (
          <Avatar name={name} size="md" />
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.status, { color: balanceColor }]}>
            {statusText}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: balanceColor }]}>
          {isSettled ? "$0.00" : formatCurrency(Math.abs(balance), currency)}
        </Text>
        {onPress && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textMuted}
            style={styles.chevron}
          />
        )}
      </View>
    </Container>
  );
}

/**
 * Summary card showing total owed/owing at the top of balance screens
 */
interface BalanceSummaryCardProps {
  totalOwed: number;
  totalOwing: number;
  currency?: string;
  style?: ViewStyle;
}

export function BalanceSummaryCard({
  totalOwed,
  totalOwing,
  currency = "USD",
  style,
}: BalanceSummaryCardProps) {
  const netBalance = totalOwed - totalOwing;
  const isPositive = netBalance > 0.01;
  const isNegative = netBalance < -0.01;

  return (
    <View style={[styles.summaryCard, style]}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>You are owed</Text>
          <Text style={[styles.summaryAmount, styles.summaryOwed]}>
            {formatCurrency(totalOwed, currency)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>You owe</Text>
          <Text style={[styles.summaryAmount, styles.summaryOwing]}>
            {formatCurrency(totalOwing, currency)}
          </Text>
        </View>
      </View>
      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net balance</Text>
        <Text
          style={[
            styles.netAmount,
            isPositive && styles.netPositive,
            isNegative && styles.netNegative,
          ]}
        >
          {isPositive ? "+" : ""}
          {formatCurrency(Math.abs(netBalance), currency)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Compact balance indicator for list items
 */
interface BalanceIndicatorProps {
  balance: number;
  currency?: string;
  showSign?: boolean;
  size?: "sm" | "md" | "lg";
}

export function BalanceIndicator({
  balance,
  currency = "USD",
  showSign = true,
  size = "md",
}: BalanceIndicatorProps) {
  const isPositive = balance > 0.01;
  const isNegative = balance < -0.01;
  const isSettled = !isPositive && !isNegative;

  const balanceColor = isPositive
    ? colors.success
    : isNegative
      ? colors.danger
      : colors.textSecondary;

  const fontSize =
    size === "sm" ? 12 : size === "lg" ? 18 : 14;

  const prefix = showSign && isPositive ? "+" : showSign && isNegative ? "-" : "";

  return (
    <Text style={[styles.indicator, { color: balanceColor, fontSize }]}>
      {isSettled ? "$0" : prefix + formatCurrency(Math.abs(balance), currency)}
    </Text>
  );
}

/**
 * Empty state for when all balances are settled
 */
interface BalanceEmptyStateProps {
  title?: string;
  subtitle?: string;
}

export function BalanceEmptyState({
  title = "All settled up!",
  subtitle = "No outstanding balances",
}: BalanceEmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>✨</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    ...typography.bodyMedium,
  },
  status: {
    ...typography.small,
    marginTop: 2,
  },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  amount: {
    ...typography.amountMedium,
    fontSize: 20,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  // Summary card styles
  summaryCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.primaryDark,
    opacity: 0.2,
  },
  summaryLabel: {
    ...typography.small,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    ...typography.amountMedium,
    fontSize: 24,
  },
  summaryOwed: {
    color: colors.success,
  },
  summaryOwing: {
    color: colors.danger,
  },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(16, 185, 129, 0.2)",
  },
  netLabel: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
  netAmount: {
    ...typography.amountMedium,
    fontSize: 20,
    color: colors.textSecondary,
  },
  netPositive: {
    color: colors.success,
  },
  netNegative: {
    color: colors.danger,
  },
  // Indicator styles
  indicator: {
    fontFamily: "Inter_600SemiBold",
  },
  // Empty state styles
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
