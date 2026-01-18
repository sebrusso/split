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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../../../lib/theme';
import {
  Button,
  Card,
  Avatar,
  QuickSplitModal,
  VoiceDictationButton,
  VoiceDictationModal,
} from '../../../../../components/ui';
import { useVoiceDictation, VoiceClaimIntent } from '../../../../../lib/voice';
import { useReceiptSummary, useItemClaims, useItemExpansion } from '../../../../../lib/useReceipts';
import {
  formatReceiptDate,
  formatReceiptAmount,
  getItemClaimStatus,
  isItemFullyClaimed,
  canClaimItem,
  generateReceiptShareCode,
  canExpandItem,
  isHiddenExpandedParent,
  hasExpandableItems,
  groupItemsWithModifiers,
} from '../../../../../lib/receipts';
import { useAuth } from '../../../../../lib/auth-context';
import { supabase } from '../../../../../lib/supabase';
import { Member, ReceiptItem } from '../../../../../lib/types';

export default function ReceiptClaimingScreen() {
  const { id, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();
  const { userId } = useAuth();

  const { receipt, items, claims, members, summary, loading, error, refetch } =
    useReceiptSummary(receiptId);
  const { claimItem, unclaimItem, splitItem, clearAllClaims, claiming } = useItemClaims(receiptId);
  const { expandItem, canExpand, expanding } = useItemExpansion(receiptId);

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [showReceiptImage, setShowReceiptImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Quick split modal state
  const [quickSplitItem, setQuickSplitItem] = useState<ReceiptItem | null>(null);
  const [showQuickSplit, setShowQuickSplit] = useState(false);

  // Voice dictation state
  const [showVoiceModal, setShowVoiceModal] = useState(false);

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

  const [memberError, setMemberError] = useState<string | null>(null);

  // Voice dictation: apply claims from voice commands
  const handleVoiceApplyClaims = useCallback(
    async (voiceClaims: VoiceClaimIntent[]): Promise<{ success: boolean; error?: string }> => {
      if (!currentMember) {
        return { success: false, error: 'Member not found' };
      }

      try {
        // Apply each claim
        for (const claim of voiceClaims) {
          const item = items.find((i) => i.id === claim.itemId);
          if (!item) continue;

          // Check if this is a split
          if (claim.shareFraction < 1) {
            // This is part of a split - use splitItem if multiple people
            const existingClaims = item.claims || [];
            const otherClaimers = existingClaims
              .filter((c) => c.member_id !== claim.memberId)
              .map((c) => c.member_id);

            if (otherClaimers.length > 0) {
              // Add to existing split
              await splitItem(claim.itemId, [...otherClaimers, claim.memberId]);
            } else {
              // Create new claim with fraction
              await claimItem(claim.itemId, claim.memberId, {
                shareFraction: claim.shareFraction,
              });
            }
          } else {
            // Full claim
            await claimItem(claim.itemId, claim.memberId);
          }
        }

        // Refetch to update UI
        refetch();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to apply claims' };
      }
    },
    [items, currentMember, claimItem, splitItem, refetch]
  );

  // Voice dictation hook
  const [voiceState, voiceActions] = useVoiceDictation({
    items,
    members,
    currentMemberId: currentMember?.id || null,
    currency: receipt?.currency || 'USD',
    onApplyClaims: handleVoiceApplyClaims,
  });

  // Handle voice button press
  const handleVoiceButtonPress = useCallback(() => {
    if (voiceState.state === 'idle') {
      setShowVoiceModal(true);
    } else if (voiceState.state === 'recording') {
      voiceActions.stopRecording();
    }
  }, [voiceState.state, voiceActions]);

  // Fetch current user's member record
  useFocusEffect(
    useCallback(() => {
      const fetchMember = async () => {
        if (!id || !userId) {
          console.log('fetchMember skipped - missing id or userId:', { id, userId });
          return;
        }

        console.log('Fetching member for group/user:', { groupId: id, userId });

        try {
          const { data: member, error } = await supabase
            .from('members')
            .select('*')
            .eq('group_id', id)
            .eq('clerk_user_id', userId)
            .single();

          console.log('Member fetch result:', { member, error });

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
    // Navigate to the split-item screen for advanced splitting options
    router.push(`/group/${id}/receipt/${receiptId}/split-item?itemId=${item.id}`);
  };

  const handleJoinSplit = (item: ReceiptItem) => {
    // Navigate to the split-item screen to join an existing split
    router.push(`/group/${id}/receipt/${receiptId}/split-item?itemId=${item.id}`);
  };

  // P0: Open quick split modal
  const handleQuickSplit = (item: ReceiptItem) => {
    setQuickSplitItem(item);
    setShowQuickSplit(true);
  };

  // P0: Handle quick split from modal
  const handleQuickSplitConfirm = async (memberIds: string[]) => {
    if (!quickSplitItem) return { success: false, error: 'No item selected' };
    return splitItem(quickSplitItem.id, memberIds);
  };

  // P0: Handle claim for self from quick split modal
  const handleQuickClaimForSelf = async () => {
    if (!quickSplitItem || !currentMember) {
      return { success: false, error: 'No item or member' };
    }
    return claimItem(quickSplitItem.id, currentMember.id);
  };

  // P0: Handle expanding multi-quantity items
  const handleExpandItem = async (item: ReceiptItem) => {
    const result = await expandItem(item.id);
    if (result.success) {
      refetch();
    } else {
      Alert.alert('Error', result.error || 'Failed to expand item');
    }
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

  const handleSwitchToSplitEvenly = () => {
    Alert.alert(
      'Switch Mode',
      'This will clear all current claims. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            // Clear all claims for this receipt
            await clearAllClaims(items);
            // Navigate to split evenly screen
            router.replace(`/group/${id}/receipt/${receiptId}/split-evenly`);
          },
        },
      ]
    );
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

  // Filter to regular items only (not tax/tip/etc, not hidden expanded parents, not modifiers)
  const regularItems = items.filter(
    (item) =>
      !item.is_tax &&
      !item.is_tip &&
      !item.is_subtotal &&
      !item.is_total &&
      !item.is_discount &&
      !item.is_service_charge &&
      !item.is_modifier && // Modifiers are shown with their parent
      !isHiddenExpandedParent(item) // Hidden expanded parents
  );

  // Check if there are any expandable items
  const hasExpandable = hasExpandableItems(items);

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

        {/* Mode Switcher */}
        <TouchableOpacity
          style={styles.modeSwitcher}
          onPress={handleSwitchToSplitEvenly}
        >
          <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
          <Text style={styles.modeSwitcherText}>Switch to Split Evenly</Text>
        </TouchableOpacity>

        {/* Instructions */}
        <Text style={styles.instructions}>
          Tap to claim items. Tap claimed items to split them.
        </Text>

        {/* Expandable Items Banner */}
        {hasExpandable && (
          <View style={styles.expandableBanner}>
            <Ionicons name="layers-outline" size={18} color={colors.primary} />
            <Text style={styles.expandableBannerText}>
              Some items have multiple quantities. Long-press to split into individual items.
            </Text>
          </View>
        )}

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

          // P0: Check if item is expandable or likely shared
          const isExpandable = canExpand(item);
          const isShared = item.is_likely_shared;

          // P1: Get modifiers for this item
          const itemModifiers = items.filter((mod) => mod.parent_item_id === item.id);
          const totalWithModifiers = item.total_price +
            itemModifiers.reduce((sum, mod) => sum + mod.total_price, 0);

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                showAsClaimedByMe && styles.itemCardClaimed,
                showAsClaimed && !showAsClaimedByMe && styles.itemCardClaimedOther,
                isShared && !showAsClaimed && styles.itemCardShared,
              ]}
              onPress={() => {
                // Fresh check for current member's claim at tap time
                // This handles race conditions where render happened before currentMember was set
                const currentMemberClaim = currentMember
                  ? item.claims?.find((c) => c.member_id === currentMember.id)
                  : null;
                const hasCurrentMemberClaim = !!currentMemberClaim;
                const isAlreadySplit = (item.claims?.length || 0) > 1;

                // Handle tap based on current state
                if (isPendingUnclaim) {
                  // Re-claim: cancel the pending unclaim (will reclaim via DB when cleared)
                  if (successfulUnclaimsRef.current.has(item.id)) {
                    successfulUnclaimsRef.current.delete(item.id);
                    setPendingUnclaims((prev) => {
                      const next = new Set(prev);
                      next.delete(item.id);
                      return next;
                    });
                    handleClaimItem(item);
                  } else {
                    setPendingUnclaims((prev) => {
                      const next = new Set(prev);
                      next.delete(item.id);
                      return next;
                    });
                  }
                } else if (isPendingClaim) {
                  if (successfulClaimsRef.current.has(item.id)) {
                    successfulClaimsRef.current.delete(item.id);
                    setPendingClaims((prev) => {
                      const next = new Set(prev);
                      next.delete(item.id);
                      return next;
                    });
                    handleUnclaimItem(item);
                  } else {
                    setPendingClaims((prev) => {
                      const next = new Set(prev);
                      next.delete(item.id);
                      return next;
                    });
                  }
                } else if (isAlreadySplit) {
                  handleSplitItem(item);
                } else if (hasCurrentMemberClaim) {
                  handleUnclaimItem(item);
                } else if (!isClaimed) {
                  // P0: For shared items, open quick split instead of claiming directly
                  if (isShared) {
                    handleQuickSplit(item);
                  } else {
                    handleClaimItem(item);
                  }
                } else {
                  handleJoinSplit(item);
                }
              }}
              onLongPress={() => {
                // P0: Long press shows quick split or expand options
                if (isExpandable && !isClaimed) {
                  Alert.alert(
                    'Split Options',
                    `"${item.description}" has ${item.quantity} items.`,
                    [
                      {
                        text: 'Expand to Individual Items',
                        onPress: () => handleExpandItem(item),
                      },
                      {
                        text: 'Split by People',
                        onPress: () => handleQuickSplit(item),
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                } else {
                  handleQuickSplit(item);
                }
              }}
              disabled={claiming || isProcessing || expanding}
            >
              <View style={styles.itemContent}>
                <View style={styles.itemMain}>
                  {/* Quantity and description */}
                  <View style={styles.itemDescriptionRow}>
                    {item.quantity > 1 && (
                      <Text style={styles.quantityBadge}>{item.quantity}x</Text>
                    )}
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
                  {/* P1: Show modifiers */}
                  {itemModifiers.length > 0 && (
                    <View style={styles.modifiersContainer}>
                      {itemModifiers.map((mod) => (
                        <Text key={mod.id} style={styles.modifierText}>
                          + {mod.description} ({formatReceiptAmount(mod.total_price, receipt.currency)})
                        </Text>
                      ))}
                    </View>
                  )}
                  {/* P0: Shared item indicator */}
                  {isShared && !showAsClaimed && (
                    <View style={styles.sharedIndicator}>
                      <Ionicons name="people" size={12} color={colors.primary} />
                      <Text style={styles.sharedIndicatorText}>Shared Item - tap to split</Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemPriceContainer}>
                  <Text
                    style={[
                      styles.itemPrice,
                      isClaimedByMe && styles.itemPriceClaimed,
                    ]}
                  >
                    {formatReceiptAmount(
                      itemModifiers.length > 0 ? totalWithModifiers : item.total_price,
                      receipt.currency
                    )}
                  </Text>
                  {/* P0: Expandable indicator */}
                  {isExpandable && !isClaimed && (
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleExpandItem(item);
                      }}
                      disabled={expanding}
                    >
                      <Ionicons name="layers-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
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
            onPress={() => {
              setShowReceiptImage(false);
              setImageLoading(true);
              setImageError(false);
            }}
          >
            <Ionicons name="close-circle" size={32} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.imageModalContent}>
            {receipt.image_url ? (
              <>
                {imageLoading && (
                  <View style={styles.imageLoadingContainer}>
                    <ActivityIndicator size="large" color={colors.white} />
                    <Text style={styles.imageLoadingText}>Loading receipt...</Text>
                  </View>
                )}
                {imageError && (
                  <View style={styles.noImageContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.white} />
                    <Text style={styles.noImageText}>Failed to load receipt image</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => {
                        setImageError(false);
                        setImageLoading(true);
                      }}
                    >
                      <Text style={styles.retryButtonText}>Tap to retry</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Image
                  source={{ uri: receipt.image_url }}
                  style={[
                    styles.receiptImage,
                    (imageLoading || imageError) && styles.receiptImageHidden,
                  ]}
                  resizeMode="contain"
                  onLoadStart={() => {
                    setImageLoading(true);
                    setImageError(false);
                  }}
                  onLoadEnd={() => {
                    // onLoadEnd fires for both success and failure
                    // Only set loading to false here - error state is set by onError
                    setImageLoading(false);
                  }}
                  onError={() => {
                    setImageError(true);
                  }}
                />
              </>
            ) : (
              <View style={styles.noImageContainer}>
                <Ionicons name="image-outline" size={64} color={colors.white} />
                <Text style={styles.noImageText}>No receipt image available</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.imageModalCloseBottom}
            onPress={() => {
              setShowReceiptImage(false);
              setImageLoading(true);
              setImageError(false);
            }}
          >
            <Text style={styles.imageModalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* P0: Quick Split Modal */}
      <QuickSplitModal
        visible={showQuickSplit}
        onClose={() => {
          setShowQuickSplit(false);
          setQuickSplitItem(null);
        }}
        item={quickSplitItem}
        members={members}
        currentMemberId={currentMember?.id || null}
        currency={receipt?.currency}
        onSplit={handleQuickSplitConfirm}
        onClaimForSelf={handleQuickClaimForSelf}
      />

      {/* Voice Dictation FAB */}
      <View style={styles.voiceFabContainer}>
        <VoiceDictationButton
          state={voiceState.state}
          durationMs={voiceState.recordingDuration}
          onPress={handleVoiceButtonPress}
          onLongPress={voiceActions.cancelRecording}
          disabled={claiming || expanding}
        />
      </View>

      {/* Voice Dictation Modal */}
      <VoiceDictationModal
        visible={showVoiceModal}
        dictationState={voiceState}
        items={items}
        members={members}
        currency={receipt?.currency || 'USD'}
        onStartRecording={voiceActions.startRecording}
        onStopRecording={voiceActions.stopRecording}
        onConfirm={async () => {
          await voiceActions.confirmClaims();
          setShowVoiceModal(false);
        }}
        onRetry={() => {
          voiceActions.rejectClaims();
        }}
        onCancel={() => {
          voiceActions.cancelRecording();
          voiceActions.rejectClaims();
          setShowVoiceModal(false);
        }}
        onContinue={voiceActions.continueConversation}
      />
    </SafeAreaView>
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
  modeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeSwitcherText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: 'Inter_500Medium',
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
  itemCardShared: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
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
  itemDescriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  quantityBadge: {
    ...typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  itemDescription: {
    ...typography.bodyMedium,
    flex: 1,
  },
  itemDescriptionClaimed: {
    color: colors.textSecondary,
  },
  modifiersContainer: {
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
  modifierText: {
    ...typography.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  sharedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sharedIndicatorText: {
    ...typography.caption,
    color: colors.primary,
  },
  itemPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expandButton: {
    padding: spacing.xs,
  },
  expandableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  expandableBannerText: {
    ...typography.small,
    color: colors.primary,
    flex: 1,
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
  receiptImageHidden: {
    opacity: 0,
    position: 'absolute',
  },
  imageLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLoadingText: {
    color: colors.white,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    marginTop: spacing.md,
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
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  // Voice FAB
  voiceFabContainer: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
    zIndex: 100,
  },
});
