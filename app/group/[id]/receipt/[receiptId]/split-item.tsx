/**
 * Item Split Management Screen
 *
 * Allows users to split an individual receipt item with various methods:
 * - Equal split between selected members
 * - Split by percentage
 * - Split by exact amount
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../../../lib/theme';
import { Button, Card, Avatar } from '../../../../../components/ui';
import { useReceiptSummary, useItemClaims } from '../../../../../lib/useReceipts';
import { formatReceiptAmount, roundCurrency } from '../../../../../lib/receipts';
import { useAuth } from '../../../../../lib/auth-context';
import { useSupabase } from '../../../../../lib/supabase';
import { Member, ReceiptItem } from '../../../../../lib/types';
import { getErrorMessage } from '../../../../../lib/logger';

type SplitMethod = 'equal' | 'percent' | 'exact';

export default function SplitItemScreen() {
  const { id, receiptId, itemId } = useLocalSearchParams<{
    id: string;
    receiptId: string;
    itemId: string;
  }>();
  const { userId } = useAuth();
  const { getSupabase } = useSupabase();

  const { receipt, items, members, loading, error } = useReceiptSummary(receiptId);
  const { claiming } = useItemClaims(receiptId);

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [item, setItem] = useState<ReceiptItem | null>(null);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Find the item
  useEffect(() => {
    if (items.length > 0 && itemId) {
      const foundItem = items.find((i) => i.id === itemId);
      setItem(foundItem || null);

      // Pre-select members who have already claimed this item
      if (foundItem?.claims) {
        const claimedMemberIds = foundItem.claims.map((c) => c.member_id);
        setSelectedMemberIds(claimedMemberIds);

        // Initialize percentages/amounts from existing claims
        const initPercentages: Record<string, string> = {};
        const initAmounts: Record<string, string> = {};
        foundItem.claims.forEach((claim) => {
          initPercentages[claim.member_id] = String(Math.round(claim.share_fraction * 100));
          initAmounts[claim.member_id] = String(roundCurrency(foundItem.total_price * claim.share_fraction));
        });
        setPercentages(initPercentages);
        setAmounts(initAmounts);
      }
    }
  }, [items, itemId]);

  // Fetch current user's member record
  useEffect(() => {
    const fetchMember = async () => {
      if (!id || !userId) return;

      try {
        const supabase = await getSupabase();
        const { data: member } = await supabase
          .from('members')
          .select('*')
          .eq('group_id', id)
          .eq('clerk_user_id', userId)
          .single();

        if (member) {
          setCurrentMember(member);
          // Add current member to selection if not already there
          if (!selectedMemberIds.includes(member.id)) {
            setSelectedMemberIds((prev) => [...prev, member.id]);
          }
        }
      } catch (err) {
        __DEV__ && console.error('Error fetching member:', err);
      }
    };

    fetchMember();
  }, [id, userId]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        // Remove from selection
        const next = prev.filter((id) => id !== memberId);
        // Clean up percentages/amounts
        const newPercentages = { ...percentages };
        const newAmounts = { ...amounts };
        delete newPercentages[memberId];
        delete newAmounts[memberId];
        setPercentages(newPercentages);
        setAmounts(newAmounts);
        return next;
      } else {
        // Add to selection
        return [...prev, memberId];
      }
    });
  };

  const handlePercentageChange = (memberId: string, value: string) => {
    // Allow empty or numeric input
    if (value === '' || /^\d{0,3}$/.test(value)) {
      setPercentages((prev) => ({ ...prev, [memberId]: value }));
    }
  };

  const handleAmountChange = (memberId: string, value: string) => {
    // Allow decimal input
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmounts((prev) => ({ ...prev, [memberId]: value }));
    }
  };

  const getEqualSplitAmount = () => {
    if (!item || selectedMemberIds.length === 0) return 0;
    return roundCurrency(item.total_price / selectedMemberIds.length);
  };

  const getTotalPercentage = () => {
    return selectedMemberIds.reduce((sum, memberId) => {
      return sum + (parseFloat(percentages[memberId]) || 0);
    }, 0);
  };

  const getTotalAmount = () => {
    return selectedMemberIds.reduce((sum, memberId) => {
      return sum + (parseFloat(amounts[memberId]) || 0);
    }, 0);
  };

  const isValidSplit = () => {
    if (selectedMemberIds.length === 0) return false;

    switch (splitMethod) {
      case 'equal':
        return selectedMemberIds.length >= 1;
      case 'percent':
        return Math.abs(getTotalPercentage() - 100) < 0.1;
      case 'exact':
        return item ? Math.abs(getTotalAmount() - item.total_price) < 0.01 : false;
      default:
        return false;
    }
  };

  const handleSave = async () => {
    if (!item || !isValidSplit()) return;

    try {
      setSaving(true);
      const supabase = await getSupabase();

      // Delete all existing claims for this item
      await supabase.from('item_claims').delete().eq('receipt_item_id', itemId);

      // Create new claims based on split method
      const claims = selectedMemberIds.map((memberId) => {
        let shareFraction: number;

        switch (splitMethod) {
          case 'equal':
            shareFraction = 1 / selectedMemberIds.length;
            break;
          case 'percent':
            shareFraction = (parseFloat(percentages[memberId]) || 0) / 100;
            break;
          case 'exact':
            shareFraction = (parseFloat(amounts[memberId]) || 0) / item.total_price;
            break;
          default:
            shareFraction = 1 / selectedMemberIds.length;
        }

        return {
          receipt_item_id: itemId,
          member_id: memberId,
          claim_type: selectedMemberIds.length > 1 ? 'split' : 'full',
          share_fraction: roundCurrency(shareFraction * 100) / 100, // Round to 2 decimals
          split_count: selectedMemberIds.length,
          claimed_via: 'app',
        };
      });

      const { error: insertError } = await supabase.from('item_claims').insert(claims);

      if (insertError) throw insertError;

      router.back();
    } catch (err: unknown) {
      __DEV__ && console.error('Error saving split:', err);
      Alert.alert('Error', getErrorMessage(err) || 'Failed to save split');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !item || !receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error || 'Item not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Item Info */}
          <Card style={styles.itemCard}>
            <Text style={styles.itemDescription}>{item.description}</Text>
            <Text style={styles.itemPrice}>
              {formatReceiptAmount(item.total_price, receipt.currency)}
            </Text>
          </Card>

          {/* Split Method Selector */}
          <Text style={styles.sectionTitle}>Split Method</Text>
          <View style={styles.methodSelector}>
            <TouchableOpacity
              style={[styles.methodButton, splitMethod === 'equal' && styles.methodButtonActive]}
              onPress={() => setSplitMethod('equal')}
            >
              <Ionicons
                name="people"
                size={20}
                color={splitMethod === 'equal' ? colors.white : colors.text}
              />
              <Text
                style={[
                  styles.methodButtonText,
                  splitMethod === 'equal' && styles.methodButtonTextActive,
                ]}
              >
                Equal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodButton, splitMethod === 'percent' && styles.methodButtonActive]}
              onPress={() => setSplitMethod('percent')}
            >
              <Ionicons
                name="pie-chart"
                size={20}
                color={splitMethod === 'percent' ? colors.white : colors.text}
              />
              <Text
                style={[
                  styles.methodButtonText,
                  splitMethod === 'percent' && styles.methodButtonTextActive,
                ]}
              >
                Percent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodButton, splitMethod === 'exact' && styles.methodButtonActive]}
              onPress={() => setSplitMethod('exact')}
            >
              <Ionicons
                name="calculator"
                size={20}
                color={splitMethod === 'exact' ? colors.white : colors.text}
              />
              <Text
                style={[
                  styles.methodButtonText,
                  splitMethod === 'exact' && styles.methodButtonTextActive,
                ]}
              >
                Amount
              </Text>
            </TouchableOpacity>
          </View>

          {/* Members List */}
          <Text style={styles.sectionTitle}>Split Between</Text>
          <Card style={styles.membersCard}>
            {members.map((member) => {
              const isSelected = selectedMemberIds.includes(member.id);
              const isMe = member.id === currentMember?.id;

              return (
                <View key={member.id} style={styles.memberRow}>
                  <TouchableOpacity
                    style={styles.memberInfo}
                    onPress={() => toggleMember(member.id)}
                  >
                    <View
                      style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color={colors.white} />
                      )}
                    </View>
                    <Avatar
                      name={member.name}
                      size="sm"
                      color={isSelected ? colors.primary : undefined}
                    />
                    <Text style={styles.memberName}>
                      {member.name}
                      {isMe && ' (You)'}
                    </Text>
                  </TouchableOpacity>

                  {/* Amount/Percentage Input */}
                  {isSelected && (
                    <View style={styles.memberInput}>
                      {splitMethod === 'equal' && (
                        <Text style={styles.equalAmount}>
                          {formatReceiptAmount(getEqualSplitAmount(), receipt.currency)}
                        </Text>
                      )}
                      {splitMethod === 'percent' && (
                        <View style={styles.inputRow}>
                          <TextInput
                            style={styles.textInput}
                            value={percentages[member.id] || ''}
                            onChangeText={(v) => handlePercentageChange(member.id, v)}
                            keyboardType="numeric"
                            placeholder="0"
                            maxLength={3}
                          />
                          <Text style={styles.inputSuffix}>%</Text>
                        </View>
                      )}
                      {splitMethod === 'exact' && (
                        <View style={styles.inputRow}>
                          <Text style={styles.inputPrefix}>$</Text>
                          <TextInput
                            style={styles.textInput}
                            value={amounts[member.id] || ''}
                            onChangeText={(v) => handleAmountChange(member.id, v)}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </Card>

          {/* Summary */}
          {selectedMemberIds.length > 0 && (
            <Card style={styles.summaryCard}>
              {splitMethod === 'equal' && (
                <Text style={styles.summaryText}>
                  {formatReceiptAmount(getEqualSplitAmount(), receipt.currency)} each (
                  {selectedMemberIds.length} {selectedMemberIds.length === 1 ? 'person' : 'people'})
                </Text>
              )}
              {splitMethod === 'percent' && (
                <Text
                  style={[
                    styles.summaryText,
                    Math.abs(getTotalPercentage() - 100) > 0.1 && styles.summaryTextError,
                  ]}
                >
                  {getTotalPercentage()}% of 100%
                  {Math.abs(getTotalPercentage() - 100) > 0.1 && ' - Must equal 100%'}
                </Text>
              )}
              {splitMethod === 'exact' && (
                <Text
                  style={[
                    styles.summaryText,
                    Math.abs(getTotalAmount() - item.total_price) > 0.01 && styles.summaryTextError,
                  ]}
                >
                  {formatReceiptAmount(getTotalAmount(), receipt.currency)} of{' '}
                  {formatReceiptAmount(item.total_price, receipt.currency)}
                  {Math.abs(getTotalAmount() - item.total_price) > 0.01 &&
                    ` - ${formatReceiptAmount(Math.abs(item.total_price - getTotalAmount()), receipt.currency)} ${getTotalAmount() < item.total_price ? 'remaining' : 'over'}`}
                </Text>
              )}
            </Card>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            style={styles.footerButton}
          />
          <Button
            title="Save Split"
            onPress={handleSave}
            loading={saving}
            disabled={!isValidSplit()}
            style={styles.footerButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  itemCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  itemDescription: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  itemPrice: {
    ...typography.h2,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodButtonText: {
    ...typography.small,
    color: colors.text,
  },
  methodButtonTextActive: {
    color: colors.white,
  },
  membersCard: {
    marginBottom: spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  memberName: {
    ...typography.body,
    flex: 1,
  },
  memberInput: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  equalAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
  },
  textInput: {
    ...typography.bodyMedium,
    minWidth: 50,
    textAlign: 'right',
    paddingVertical: spacing.sm,
  },
  inputPrefix: {
    ...typography.body,
    color: colors.textSecondary,
  },
  inputSuffix: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.primaryLight,
  },
  summaryText: {
    ...typography.bodyMedium,
    color: colors.primary,
    textAlign: 'center',
  },
  summaryTextError: {
    color: colors.danger,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  footerButton: {
    flex: 1,
  },
});
