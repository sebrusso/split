import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, shadows } from "../../lib/theme";
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
 * Uses blue/gray semantic colors:
 * - Blue: positive balance (you're owed)
 * - Gray: negative balance (you owe)
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

  // Blue for positive (owed), Gray for negative (owing)
  const balanceColor = isPositive
    ? colors.positive
    : isNegative
      ? colors.negative
      : colors.settled;

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

  // Blue for positive, Gray for negative
  const balanceColor = isPositive
    ? colors.positive
    : isNegative
      ? colors.negative
      : colors.settled;

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
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  status: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textMuted,
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  amount: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  // Summary card styles - uses gradient accent background
  summaryCard: {
    backgroundColor: colors.accentLight,
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
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.accentDark,
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  summaryOwed: {
    color: colors.positive, // Blue
  },
  summaryOwing: {
    color: colors.negative, // Gray
  },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(59, 130, 246, 0.2)", // Blue with opacity
  },
  netLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.accentDark,
  },
  netAmount: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.settled,
  },
  netPositive: {
    color: colors.positive, // Blue
  },
  netNegative: {
    color: colors.negative, // Gray
  },
  // Indicator styles
  indicator: {
    fontWeight: "600",
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
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.textSecondary,
  },
});
