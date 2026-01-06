import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { colors, spacing, typography, borderRadius, shadows } from "../../lib/theme";
import { SplitMethod } from "../../lib/types";
import { Member } from "../../lib/types";
import {
  getSplitMethodLabel,
  getSplitMethodDescription,
  getSplitMethodIcon,
} from "../../lib/splits";
import { Avatar } from "./Avatar";

const SPLIT_METHODS: SplitMethod[] = ["equal", "exact", "percent", "shares"];

interface SplitMethodPickerProps {
  selectedMethod: SplitMethod;
  onSelect: (method: SplitMethod) => void;
  amount: number;
  members: Member[];
  // Data for each split type
  selectedMemberIds: string[];
  exactAmounts: Record<string, number>;
  percentages: Record<string, number>;
  shares: Record<string, number>;
  // Callbacks
  onToggleMember: (memberId: string) => void;
  onExactAmountChange: (memberId: string, amount: number) => void;
  onPercentageChange: (memberId: string, percent: number) => void;
  onSharesChange: (memberId: string, shares: number) => void;
}

export function SplitMethodPicker({
  selectedMethod,
  onSelect,
  amount,
  members,
  selectedMemberIds,
  exactAmounts,
  percentages,
  shares,
  onToggleMember,
  onExactAmountChange,
  onPercentageChange,
  onSharesChange,
}: SplitMethodPickerProps) {
  return (
    <View style={styles.container}>
      {/* Method Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {SPLIT_METHODS.map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.tab,
                selectedMethod === method && styles.tabSelected,
              ]}
              onPress={() => onSelect(method)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabIcon,
                  selectedMethod === method && styles.tabIconSelected,
                ]}
              >
                {getSplitMethodIcon(method)}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  selectedMethod === method && styles.tabLabelSelected,
                ]}
              >
                {getSplitMethodLabel(method)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Method Description */}
      <Text style={styles.description}>{getSplitMethodDescription(selectedMethod)}</Text>

      {/* Method-specific UI */}
      <View style={styles.splitContent}>
        {selectedMethod === "equal" && (
          <EqualSplitUI
            members={members}
            selectedMemberIds={selectedMemberIds}
            amount={amount}
            onToggle={onToggleMember}
          />
        )}
        {selectedMethod === "exact" && (
          <ExactSplitUI
            members={members}
            amounts={exactAmounts}
            totalAmount={amount}
            onChange={onExactAmountChange}
          />
        )}
        {selectedMethod === "percent" && (
          <PercentSplitUI
            members={members}
            percentages={percentages}
            totalAmount={amount}
            onChange={onPercentageChange}
          />
        )}
        {selectedMethod === "shares" && (
          <SharesSplitUI
            members={members}
            shares={shares}
            totalAmount={amount}
            onChange={onSharesChange}
          />
        )}
      </View>
    </View>
  );
}

// Equal Split UI - Checkboxes to select members
interface EqualSplitUIProps {
  members: Member[];
  selectedMemberIds: string[];
  amount: number;
  onToggle: (memberId: string) => void;
}

function EqualSplitUI({ members, selectedMemberIds, amount, onToggle }: EqualSplitUIProps) {
  const perPerson = selectedMemberIds.length > 0 ? amount / selectedMemberIds.length : 0;

  return (
    <View>
      {members.map((member) => {
        const isSelected = selectedMemberIds.includes(member.id);
        return (
          <TouchableOpacity
            key={member.id}
            style={[styles.memberRow, isSelected && styles.memberRowSelected]}
            onPress={() => onToggle(member.id)}
            activeOpacity={0.7}
          >
            <Avatar name={member.name} size="sm" color={isSelected ? colors.primary : colors.textMuted} />
            <Text style={[styles.memberName, isSelected && styles.memberNameSelected]}>
              {member.name}
            </Text>
            {isSelected && (
              <>
                <Text style={styles.memberAmount}>${perPerson.toFixed(2)}</Text>
                <View style={styles.checkbox}>
                  <Text style={styles.checkboxText}>✓</Text>
                </View>
              </>
            )}
            {!isSelected && <View style={styles.checkboxEmpty} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Exact Split UI - Input field for each member
interface ExactSplitUIProps {
  members: Member[];
  amounts: Record<string, number>;
  totalAmount: number;
  onChange: (memberId: string, amount: number) => void;
}

function ExactSplitUI({ members, amounts, totalAmount, onChange }: ExactSplitUIProps) {
  const currentTotal = Object.values(amounts).reduce((sum, val) => sum + (val || 0), 0);
  const remaining = totalAmount - currentTotal;

  return (
    <View>
      {members.map((member) => (
        <View key={member.id} style={styles.inputRow}>
          <Avatar name={member.name} size="sm" />
          <Text style={styles.memberName}>{member.name}</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amounts[member.id]?.toString() || ""}
              onChangeText={(text) => {
                const num = parseFloat(text) || 0;
                onChange(member.id, num);
              }}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      ))}
      <View style={[styles.totalRow, remaining !== 0 && styles.totalRowError]}>
        <Text style={styles.totalLabel}>
          {remaining > 0 ? "Remaining:" : remaining < 0 ? "Over by:" : "Total:"}
        </Text>
        <Text style={[styles.totalAmount, remaining !== 0 && styles.totalAmountError]}>
          ${Math.abs(remaining).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

// Percent Split UI - Percentage input for each member
interface PercentSplitUIProps {
  members: Member[];
  percentages: Record<string, number>;
  totalAmount: number;
  onChange: (memberId: string, percent: number) => void;
}

function PercentSplitUI({ members, percentages, totalAmount, onChange }: PercentSplitUIProps) {
  const currentTotal = Object.values(percentages).reduce((sum, val) => sum + (val || 0), 0);
  const remaining = 100 - currentTotal;

  return (
    <View>
      {members.map((member) => {
        const percent = percentages[member.id] || 0;
        const amount = (totalAmount * percent) / 100;
        return (
          <View key={member.id} style={styles.inputRow}>
            <Avatar name={member.name} size="sm" />
            <Text style={styles.memberName}>{member.name}</Text>
            <View style={styles.percentInputContainer}>
              <TextInput
                style={styles.percentInput}
                value={percent > 0 ? percent.toString() : ""}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  onChange(member.id, Math.min(100, Math.max(0, num)));
                }}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.percentSuffix}>%</Text>
            </View>
            <Text style={styles.calculatedAmount}>${amount.toFixed(2)}</Text>
          </View>
        );
      })}
      <View style={[styles.totalRow, Math.abs(remaining) > 0.01 && styles.totalRowError]}>
        <Text style={styles.totalLabel}>
          {remaining > 0.01 ? "Remaining:" : remaining < -0.01 ? "Over by:" : "Total:"}
        </Text>
        <Text style={[styles.totalAmount, Math.abs(remaining) > 0.01 && styles.totalAmountError]}>
          {Math.abs(remaining).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

// Shares Split UI - Share count input for each member
interface SharesSplitUIProps {
  members: Member[];
  shares: Record<string, number>;
  totalAmount: number;
  onChange: (memberId: string, shares: number) => void;
}

function SharesSplitUI({ members, shares, totalAmount, onChange }: SharesSplitUIProps) {
  const totalShares = Object.values(shares).reduce((sum, val) => sum + (val || 0), 0);

  return (
    <View>
      {members.map((member) => {
        const memberShares = shares[member.id] || 0;
        const amount = totalShares > 0 ? (totalAmount * memberShares) / totalShares : 0;
        return (
          <View key={member.id} style={styles.inputRow}>
            <Avatar name={member.name} size="sm" />
            <Text style={styles.memberName}>{member.name}</Text>
            <View style={styles.sharesContainer}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => onChange(member.id, Math.max(0, memberShares - 1))}
              >
                <Text style={styles.shareButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.sharesValue}>{memberShares}</Text>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => onChange(member.id, memberShares + 1)}
              >
                <Text style={styles.shareButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.calculatedAmount}>${amount.toFixed(2)}</Text>
          </View>
        );
      })}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total shares:</Text>
        <Text style={styles.totalAmount}>{totalShares}</Text>
      </View>
    </View>
  );
}

// Button to display current split method selection
interface SplitMethodButtonProps {
  method: SplitMethod;
  memberCount: number;
  onPress: () => void;
}

export function SplitMethodButton({ method, memberCount, onPress }: SplitMethodButtonProps) {
  return (
    <TouchableOpacity style={styles.methodButton} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.methodIconContainer}>
        <Text style={styles.methodIcon}>{getSplitMethodIcon(method)}</Text>
      </View>
      <View style={styles.methodInfo}>
        <Text style={styles.methodLabel}>{getSplitMethodLabel(method)}</Text>
        <Text style={styles.methodSubtext}>
          {memberCount} {memberCount === 1 ? "person" : "people"}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  tabsContainer: {
    marginHorizontal: -spacing.lg,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabIcon: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  tabIconSelected: {
    color: colors.primary,
  },
  tabLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  tabLabelSelected: {
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  splitContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Member rows (for all split types)
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
  },
  memberRowSelected: {
    backgroundColor: colors.primaryLight,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
  },
  memberName: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
  },
  memberNameSelected: {
    color: colors.primary,
    fontFamily: "Inter_500Medium",
  },
  memberAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkboxText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  // Exact amount input
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    width: 100,
  },
  currencyPrefix: {
    ...typography.body,
    color: colors.textSecondary,
  },
  amountInput: {
    ...typography.body,
    flex: 1,
    textAlign: "right",
    paddingVertical: spacing.xs,
  },
  // Percent input
  percentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    width: 70,
  },
  percentInput: {
    ...typography.body,
    flex: 1,
    textAlign: "right",
    paddingVertical: spacing.xs,
  },
  percentSuffix: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  calculatedAmount: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 60,
    textAlign: "right",
  },
  // Shares controls
  sharesContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  shareButtonText: {
    fontSize: 20,
    color: colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  sharesValue: {
    ...typography.bodyMedium,
    minWidth: 24,
    textAlign: "center",
  },
  // Total row
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalRowError: {
    borderTopColor: colors.danger,
  },
  totalLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  totalAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  totalAmountError: {
    color: colors.danger,
  },
  // Method button styles
  methodButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  methodIcon: {
    fontSize: 20,
    color: colors.primary,
    fontFamily: "Inter_700Bold",
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    ...typography.bodyMedium,
  },
  methodSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
});
