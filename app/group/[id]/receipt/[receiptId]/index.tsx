/**
 * Receipt Claiming Screen
 *
 * Displays receipt items and allows members to claim what they ordered.
 * Supports real-time updates as others claim items.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
  Modal,
  Image,
  Dimensions,
  Pressable,
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
  const [showReceiptImage, setShowReceiptImage] = useState(false);

  // Optimistic UI state for instant feedback
  const [pendingClaims, setPendingClaims] = useState<Set<string>>(new Set());
  const [pendingUnclaims, setPendingUnclaims] = useState<Set<string>>(new Set());

  // Track successful claims that are waiting for real-time data
  const successfulClaimsRef = useRef<Set<string>>(new Set());
  const successfulUnclaimsRef = useRef<Set<string>>(new Set());

  // Clear pending state when actual claims appear in the data
  useEffect(() => {
    if (!currentMember) return;

    // Check for successful claims that now appear in the data
    for (const itemId of successfulClaimsRef.current) {
      const item = items.find(i => i.id === itemId);
      const hasActualClaim = item?.claims?.some(c => c.member_id === currentMember.id);
      if (hasActualClaim) {
        successfulClaimsRef.current.delete(itemId);
        setPendingClaims(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    }

    // Check for successful unclaims that are now removed from data
    for (const itemId of successfulUnclaimsRef.current) {
      const item = items.find(i => i.id === itemId);
      const stillHasClaim = item?.claims?.some(c => c.member_id === currentMember.id);
      if (!stillHasClaim) {
        successfulUnclaimsRef.current.delete(itemId);
        setPendingUnclaims(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    }
  }, [items, currentMember]);

  // Fetch current user's member record
  useFocusEffect(
    useCallback(() => {
      const fetchMember = async () => {
        if (!id || !userId) {
          console.log('fetchMember skipped - missing id or userId:', { id, userId });
          return;
        }

        console.log('Fetching member for group/user:', { groupId: id, userId });

        const { data: member, error } = await supabase
          .from('members')
          .select('*')
          .eq('group_id', id)
          .eq('clerk_user_id', userId)
          .single();

        console.log('Member fetch result:', { member, error });

        if (error) {
          console.warn('Error fetching member:', error.message);
        }

        setCurrentMember(member);
      };

      fetchMember();
    }, [id, userId])
  );

  const handleClaimItem = async (item: ReceiptItem) => {
    if (!currentMember) {
      Alert.alert(
        'Error',
        'Unable to identify you as a group member. Please make sure you are a member of this group.'
      );
      return;
    }

    const { canClaim, reason, remainingFraction } = canClaimItem(item, currentMember.id);

    if (!canClaim) {
      Alert.alert('Cannot Claim', reason || 'Unable to claim this item');
      return;
    }

    // Optimistic update - show claimed immediately
    setPendingClaims((prev) => new Set(prev).add(item.id));

    // Pass maxFraction to prevent over-claiming when item is partially claimed
    const result = await claimItem(item.id, currentMember.id, {
      maxFraction: remainingFraction,
    });

    if (!result.success) {
      // Rollback optimistic update on failure
      setPendingClaims((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      Alert.alert('Error', result.error || 'Failed to claim item');
    } else {
      // Mark as successful - pending state will be cleared when real data arrives
      successfulClaimsRef.current.add(item.id);
    }
  };

  const handleUnclaimItem = async (item: ReceiptItem) => {
    console.log('handleUnclaimItem called:', {
      itemId: item.id,
      itemDescription: item.description,
      currentMemberId: currentMember?.id,
      claims: item.claims,
      claimMemberIds: item.claims?.map(c => c.member_id),
    });

    if (!currentMember) {
      console.log('handleUnclaimItem: no currentMember, returning');
      Alert.alert('Error', 'Please wait while we load your membership info');
      return;
    }

    // Use fresh items data to find the claim (item param might have stale claims)
    const freshItem = items.find(i => i.id === item.id);
    const memberClaim = freshItem?.claims?.find((c) => c.member_id === currentMember.id);
    console.log('handleUnclaimItem: memberClaim lookup result:', memberClaim, 'freshItem claims:', freshItem?.claims);

    if (!memberClaim) {
      console.log('handleUnclaimItem: no memberClaim found, returning');
      return;
    }

    // Optimistic update - show unclaimed immediately
    setPendingUnclaims((prev) => new Set(prev).add(item.id));

    const result = await unclaimItem(item.id, currentMember.id);

    if (!result.success) {
      // Rollback optimistic update on failure
      setPendingUnclaims((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      Alert.alert('Error', result.error || 'Failed to unclaim item');
    } else {
      // Mark as successful - pending state will be cleared when real data arrives
      successfulUnclaimsRef.current.add(item.id);
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
    // Use replace so the claiming screen is removed from the stack
    // This way, back button from settle goes to group, not back to claiming
    router.replace(`/group/${id}/receipt/${receiptId}/settle`);
  };

  const getMemberClaim = (item: ReceiptItem) => {
    if (!currentMember) {
      console.log('getMemberClaim: no currentMember');
      return null;
    }
    const claim = item.claims?.find((c) => c.member_id === currentMember.id);
    if (!claim && item.claims && item.claims.length > 0) {
      console.log('getMemberClaim: no match found', {
        itemId: item.id,
        currentMemberId: currentMember.id,
        claimMemberIds: item.claims.map(c => c.member_id),
      });
    }
    return claim;
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
                summary?.total || receipt.total_amount || 0,
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

          {/* View Receipt Image Button */}
          {receipt.image_url && (
            <TouchableOpacity
              style={styles.viewReceiptButton}
              onPress={() => setShowReceiptImage(true)}
            >
              <Ionicons name="image-outline" size={18} color={colors.primary} />
              <Text style={styles.viewReceiptButtonText}>View Original Receipt</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Instructions */}
        <Text style={styles.instructions}>
          Tap items you ordered to claim them
        </Text>

        {/* Items List */}
        {regularItems.length === 0 && (
          <Text style={styles.instructions}>No items found on this receipt.</Text>
        )}
        {regularItems.map((item) => {
          const memberClaim = getMemberClaim(item);
          const isClaimed = isItemFullyClaimed(item);

          // Use optimistic state for instant feedback
          const isPendingClaim = pendingClaims.has(item.id);
          const isPendingUnclaim = pendingUnclaims.has(item.id);

          // Determine actual claimed state (from database or optimistic)
          const hasDbClaim = !!memberClaim;
          const isClaimedByMe = hasDbClaim || isPendingClaim;
          const showAsClaimedByMe = isPendingUnclaim ? false : isClaimedByMe;
          const showAsClaimed = isPendingUnclaim ? false : (isClaimed || isPendingClaim);

          const isProcessing = isPendingClaim || isPendingUnclaim;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                showAsClaimedByMe && styles.itemCardClaimed,
                showAsClaimed && !showAsClaimedByMe && styles.itemCardClaimedOther,
              ]}
              onPress={() => {
                // Fresh check for current member's claim at tap time
                // This handles race conditions where render happened before currentMember was set
                const currentMemberClaim = currentMember
                  ? item.claims?.find((c) => c.member_id === currentMember.id)
                  : null;
                const hasCurrentMemberClaim = !!currentMemberClaim;

                // Debug logging
                console.log('Item tapped:', {
                  itemId: item.id,
                  itemDescription: item.description,
                  isPendingUnclaim,
                  isPendingClaim,
                  hasDbClaim,
                  hasCurrentMemberClaim,
                  isClaimed,
                  claims: item.claims,
                  currentMemberId: currentMember?.id,
                });

                // Handle tap based on current state
                if (isPendingUnclaim) {
                  // Cancel the pending unclaim
                  setPendingUnclaims((prev) => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                  });
                  successfulUnclaimsRef.current.delete(item.id);
                } else if (isPendingClaim) {
                  // Cancel the pending claim
                  setPendingClaims((prev) => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                  });
                  successfulClaimsRef.current.delete(item.id);
                } else if (hasCurrentMemberClaim) {
                  // Unclaim existing claim (use fresh check, not stale render-time value)
                  handleUnclaimItem(item);
                } else if (!isClaimed) {
                  // Claim unclaimed item
                  handleClaimItem(item);
                }
              }}
              onLongPress={() => handleSplitItem(item)}
              disabled={claiming || isProcessing}
            >
              <View style={styles.itemContent}>
                <View style={styles.itemMain}>
                  <Text
                    style={[
                      styles.itemDescription,
                      showAsClaimed && styles.itemDescriptionClaimed,
                    ]}
                    numberOfLines={2}
                  >
                    {item.description}
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
          title="Confirm"
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

      {/* Receipt Image Viewer Modal */}
      <Modal
        visible={showReceiptImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceiptImage(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setShowReceiptImage(false)}
          >
            <Ionicons name="close-circle" size={32} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.imageModalContent}>
            {receipt.image_url ? (
              <Image
                source={{ uri: receipt.image_url }}
                style={styles.receiptImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noImageContainer}>
                <Ionicons name="image-outline" size={64} color={colors.white} />
                <Text style={styles.noImageText}>No receipt image available</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.imageModalCloseBottom}
            onPress={() => setShowReceiptImage(false)}
          >
            <Text style={styles.imageModalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  itemCardProcessing: {
    opacity: 0.7,
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
  // View Receipt Button
  viewReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  viewReceiptButtonText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  // Receipt Image Modal
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 80,
  },
  imageModalClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  imageModalCloseBottom: {
    position: 'absolute',
    bottom: 40,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.md,
  },
  imageModalCloseText: {
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  receiptImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 200,
  },
  noImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    color: colors.white,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    marginTop: spacing.md,
  },
});
