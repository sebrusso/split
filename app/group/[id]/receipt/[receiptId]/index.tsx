/**
 * Receipt Claiming Screen
 *
 * Displays receipt items and allows members to claim what they ordered.
 * Supports real-time updates as others claim items.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../../../lib/theme';
import { Button, Card, Avatar } from '../../../../../components/ui';
import { useReceiptSummary, useItemClaims } from '../../../../../lib/useReceipts';
import {
  formatReceiptDate,
  formatReceiptAmount,
  getItemClaimStatus,
  isItemFullyClaimed,
  canClaimItem,
  generateReceiptShareCode,
} from '../../../../../lib/receipts';
import { useAuth } from '../../../../../lib/auth-context';
import { supabase } from '../../../../../lib/supabase';
import { Member, ReceiptItem } from '../../../../../lib/types';

export default function ReceiptClaimingScreen() {
  const { id, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();
  const { userId } = useAuth();

  const { receipt, items, claims, members, summary, loading, error, refetch } =
    useReceiptSummary(receiptId);
  const { claimItem, unclaimItem, splitItem, claiming } = useItemClaims(receiptId);

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReceiptItem | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const [memberError, setMemberError] = useState<string | null>(null);

  // Fetch current user's member record
  useFocusEffect(
    useCallback(() => {
      const fetchMember = async () => {
        if (!id || !userId) return;

        try {
          const { data: member, error } = await supabase
            .from('members')
            .select('*')
            .eq('group_id', id)
            .eq('clerk_user_id', userId)
            .single();

          if (error) {
            console.error('Error fetching member:', error);
            setMemberError('You are not a member of this group');
            return;
          }

          setCurrentMember(member);
          setMemberError(null);
        } catch (err) {
          console.error('Error fetching member:', err);
          setMemberError('Failed to load member data');
        }
      };

      fetchMember();
    }, [id, userId])
  );

  const handleClaimItem = async (item: ReceiptItem) => {
    if (!currentMember) {
      Alert.alert('Error', 'Unable to claim item. Please try again.');
      return;
    }

    const { canClaim, reason } = canClaimItem(item, currentMember.id);
    if (!canClaim) {
      Alert.alert('Cannot Claim', reason);
      return;
    }

    const result = await claimItem(item.id, currentMember.id);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to claim item');
    }
  };

  const handleUnclaimItem = async (item: ReceiptItem) => {
    if (!currentMember) return;

    const memberClaim = item.claims?.find((c) => c.member_id === currentMember.id);
    if (!memberClaim) return;

    const result = await unclaimItem(item.id, currentMember.id);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to unclaim item');
    }
  };

  const handleSplitItem = (item: ReceiptItem) => {
    setSelectedItem(item);
    setShowMemberPicker(true);
  };

  const handleSplitConfirm = async (selectedMemberIds: string[]) => {
    if (!selectedItem) return;

    setShowMemberPicker(false);
    const result = await splitItem(selectedItem.id, selectedMemberIds);

    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to split item');
    }

    setSelectedItem(null);
  };

  const handleShare = async () => {
    if (!receipt) return;

    // Generate share code if not exists
    let shareCode = receipt.share_code;
    if (!shareCode) {
      shareCode = generateReceiptShareCode();
      await supabase
        .from('receipts')
        .update({ share_code: shareCode })
        .eq('id', receipt.id);
    }

    const shareUrl = `https://splitfree.app/r/${shareCode}`;

    await Share.share({
      message: `Claim your items from ${receipt.merchant_name || 'our receipt'}!\n\n${shareUrl}`,
      url: shareUrl,
    });
  };

  const handleFinalize = () => {
    if (!summary) return;

    if (summary.unclaimedItemCount > 0) {
      Alert.alert(
        'Unclaimed Items',
        `There are ${summary.unclaimedItemCount} unclaimed items. Do you want to continue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => router.push(`/group/${id}/receipt/${receiptId}/settle`),
          },
        ]
      );
      return;
    }

    router.push(`/group/${id}/receipt/${receiptId}/settle`);
  };

  const getMemberClaim = (item: ReceiptItem) => {
    if (!currentMember) return null;
    return item.claims?.find((c) => c.member_id === currentMember.id);
  };

  // Filter to regular items only (not tax/tip/etc)
  const regularItems = items.filter(
    (item) =>
      !item.is_tax && !item.is_tip && !item.is_subtotal && !item.is_total && !item.is_discount
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.danger} />
          <Text style={styles.errorTitle}>Error Loading Receipt</Text>
          <Text style={styles.errorText}>{error || 'Receipt not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  if (memberError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="person-remove" size={64} color={colors.danger} />
          <Text style={styles.errorTitle}>Cannot Claim Items</Text>
          <Text style={styles.errorText}>{memberError}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} />
        }
      >
        {/* Receipt Header */}
        <Card style={styles.headerCard}>
          <View style={styles.merchantRow}>
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantName}>
                {receipt.merchant_name || 'Receipt'}
              </Text>
              {receipt.receipt_date && (
                <Text style={styles.receiptDate}>
                  {formatReceiptDate(receipt.receipt_date)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
              <Ionicons name="share-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>
              {formatReceiptAmount(
                receipt.total_amount || summary?.total || 0,
                receipt.currency
              )}
            </Text>
          </View>

          {/* Progress indicator */}
          {summary && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(summary.claimedItemCount / summary.itemCount) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {summary.claimedItemCount} of {summary.itemCount} items claimed
              </Text>
            </View>
          )}
        </Card>

        {/* Instructions */}
        <Text style={styles.instructions}>
          Tap items you ordered to claim them
        </Text>

        {/* Items List */}
        {regularItems.map((item) => {
          const memberClaim = getMemberClaim(item);
          const isClaimed = isItemFullyClaimed(item);
          const isClaimedByMe = !!memberClaim;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                isClaimedByMe && styles.itemCardClaimed,
                isClaimed && !isClaimedByMe && styles.itemCardClaimedOther,
              ]}
              onPress={() => {
                if (isClaimedByMe) {
                  handleUnclaimItem(item);
                } else if (!isClaimed) {
                  handleClaimItem(item);
                }
              }}
              onLongPress={() => handleSplitItem(item)}
              disabled={claiming}
            >
              <View style={styles.itemContent}>
                <View style={styles.itemMain}>
                  <Text
                    style={[
                      styles.itemDescription,
                      isClaimed && styles.itemDescriptionClaimed,
                    ]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                  <Text style={styles.itemStatus}>
                    {getItemClaimStatus(item)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemPrice,
                    isClaimedByMe && styles.itemPriceClaimed,
                  ]}
                >
                  {formatReceiptAmount(item.total_price, receipt.currency)}
                </Text>
              </View>

              {/* Claimed by avatars */}
              {item.claims && item.claims.length > 0 && (
                <View style={styles.claimersRow}>
                  {item.claims.map((claim) => (
                    <View key={claim.id} style={styles.claimerBadge}>
                      <Avatar
                        name={claim.member?.name || 'Unknown'}
                        size="sm"
                        color={
                          claim.member_id === currentMember?.id
                            ? colors.primary
                            : undefined
                        }
                      />
                      {claim.split_count > 1 && (
                        <Text style={styles.splitBadge}>
                          1/{claim.split_count}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Summary Card */}
        {summary && summary.memberTotals.length > 0 && (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Current Totals</Text>
            {summary.memberTotals.map((memberTotal) => (
              <View key={memberTotal.memberId} style={styles.memberTotalRow}>
                <View style={styles.memberTotalInfo}>
                  <Avatar
                    name={memberTotal.memberName}
                    size="sm"
                    color={
                      memberTotal.memberId === currentMember?.id
                        ? colors.primary
                        : undefined
                    }
                  />
                  <Text style={styles.memberTotalName}>
                    {memberTotal.memberName}
                    {memberTotal.memberId === currentMember?.id && ' (You)'}
                  </Text>
                </View>
                <View style={styles.memberTotalAmounts}>
                  <Text style={styles.memberTotalItemsAmount}>
                    {formatReceiptAmount(memberTotal.itemsTotal, receipt.currency)}
                  </Text>
                  {(memberTotal.taxShare > 0 || memberTotal.tipShare > 0) && (
                    <Text style={styles.memberTotalExtras}>
                      +{formatReceiptAmount(
                        memberTotal.taxShare + memberTotal.tipShare,
                        receipt.currency
                      )} (tax/tip)
                    </Text>
                  )}
                  <Text style={styles.memberTotalGrand}>
                    {formatReceiptAmount(memberTotal.grandTotal, receipt.currency)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Tax & Tip Info */}
        {(receipt.tax_amount || receipt.tip_amount) && (
          <Card style={styles.taxTipCard}>
            <Text style={styles.taxTipTitle}>Additional Charges</Text>
            {receipt.tax_amount && receipt.tax_amount > 0 && (
              <View style={styles.taxTipRow}>
                <Text style={styles.taxTipLabel}>Tax</Text>
                <Text style={styles.taxTipAmount}>
                  {formatReceiptAmount(receipt.tax_amount, receipt.currency)}
                </Text>
              </View>
            )}
            {receipt.tip_amount && receipt.tip_amount > 0 && (
              <View style={styles.taxTipRow}>
                <Text style={styles.taxTipLabel}>Tip</Text>
                <Text style={styles.taxTipAmount}>
                  {formatReceiptAmount(receipt.tip_amount, receipt.currency)}
                </Text>
              </View>
            )}
            <Text style={styles.taxTipNote}>
              Tax and tip are split proportionally based on items claimed
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <Button
          title="Edit Receipt"
          variant="secondary"
          onPress={() => router.push(`/group/${id}/receipt/${receiptId}/edit`)}
          style={styles.footerButton}
        />
        <Button
          title="Finalize & Pay"
          onPress={handleFinalize}
          style={styles.footerButton}
        />
      </View>

      {/* Member Picker Modal for Splitting */}
      {showMemberPicker && selectedItem && (
        <MemberSplitPicker
          item={selectedItem}
          members={members}
          currentMemberId={currentMember?.id}
          onConfirm={handleSplitConfirm}
          onCancel={() => {
            setShowMemberPicker(false);
            setSelectedItem(null);
          }}
          currency={receipt.currency}
        />
      )}
    </SafeAreaView>
  );
}

// Member picker component for splitting items
function MemberSplitPicker({
  item,
  members,
  currentMemberId,
  onConfirm,
  onCancel,
  currency,
}: {
  item: ReceiptItem;
  members: Member[];
  currentMemberId?: string;
  onConfirm: (memberIds: string[]) => void;
  onCancel: () => void;
  currency: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentMemberId ? [currentMemberId] : []
  );

  const toggleMember = (memberId: string) => {
    setSelectedIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const splitAmount =
    selectedIds.length > 0 ? item.total_price / selectedIds.length : 0;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Split Item</Text>
        <Text style={styles.modalSubtitle}>{item.description}</Text>
        <Text style={styles.modalPrice}>
          {formatReceiptAmount(item.total_price, currency)}
        </Text>

        <Text style={styles.modalLabel}>Select who to split with:</Text>

        <ScrollView style={styles.memberList}>
          {members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.memberOption,
                selectedIds.includes(member.id) && styles.memberOptionSelected,
              ]}
              onPress={() => toggleMember(member.id)}
            >
              <Avatar
                name={member.name}
                size="sm"
                color={selectedIds.includes(member.id) ? colors.primary : undefined}
              />
              <Text style={styles.memberOptionName}>{member.name}</Text>
              {selectedIds.includes(member.id) && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedIds.length > 1 && (
          <Text style={styles.splitPreview}>
            {formatReceiptAmount(splitAmount, currency)} each ({selectedIds.length}{' '}
            people)
          </Text>
        )}

        <View style={styles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onCancel}
            style={styles.modalButton}
          />
          <Button
            title="Split"
            onPress={() => onConfirm(selectedIds)}
            disabled={selectedIds.length < 2}
            style={styles.modalButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  headerCard: {
    marginBottom: spacing.lg,
  },
  merchantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    ...typography.h2,
  },
  receiptDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  shareButton: {
    padding: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  totalLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  totalAmount: {
    ...typography.h2,
    color: colors.primary,
  },
  progressContainer: {
    marginTop: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  instructions: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  itemCardClaimed: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  itemCardClaimedOther: {
    backgroundColor: colors.borderLight,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemMain: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemDescription: {
    ...typography.bodyMedium,
  },
  itemDescriptionClaimed: {
    color: colors.textSecondary,
  },
  itemStatus: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  itemPrice: {
    ...typography.bodyMedium,
  },
  itemPriceClaimed: {
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  claimersRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  claimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  splitBadge: {
    ...typography.small,
    color: colors.textSecondary,
  },
  summaryCard: {
    marginTop: spacing.lg,
  },
  summaryTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  memberTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberTotalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberTotalName: {
    ...typography.bodyMedium,
  },
  memberTotalAmounts: {
    alignItems: 'flex-end',
  },
  memberTotalItemsAmount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  memberTotalExtras: {
    ...typography.small,
    color: colors.textSecondary,
  },
  memberTotalGrand: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  taxTipCard: {
    marginTop: spacing.md,
  },
  taxTipTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  taxTipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  taxTipLabel: {
    ...typography.body,
  },
  taxTipAmount: {
    ...typography.body,
  },
  taxTipNote: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerButton: {
    flex: 1,
  },
  // Modal styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalPrice: {
    ...typography.h3,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  modalLabel: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  memberList: {
    maxHeight: 250,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  memberOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  memberOptionName: {
    ...typography.body,
    flex: 1,
  },
  splitPreview: {
    ...typography.bodyMedium,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
});
