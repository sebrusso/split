/**
 * Receipt Hooks
 *
 * React hooks for fetching and managing receipt data,
 * including real-time updates for item claiming.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './supabase';
import {
  Receipt,
  ReceiptItem,
  ItemClaim,
  Member,
  ReceiptSummary,
  ClaimSource,
} from './types';
import {
  generateReceiptSummary,
  calculateMemberTotals,
  createClaim,
  getItemRemainingFraction,
} from './receipts';
import { prepareImageForUpload } from './imageUtils';
import { logger, getErrorMessage } from './logger';

/**
 * Hook to fetch a single receipt with all related data
 */
export function useReceipt(receiptId: string | undefined) {
  const { getSupabase } = useSupabase();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [claims, setClaims] = useState<ItemClaim[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    if (!receiptId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = await getSupabase();

      // Fetch receipt
      const { data: receiptData, error: receiptError } = await supabase
        .from('receipts')
        .select('*, uploader:members!uploaded_by(id, name)')
        .eq('id', receiptId)
        .single();

      if (receiptError) throw receiptError;
      setReceipt(receiptData);

      // Fetch items with claims
      const { data: itemsData, error: itemsError } = await supabase
        .from('receipt_items')
        .select('*, claims:item_claims(*, member:members(id, name))')
        .eq('receipt_id', receiptId)
        .order('line_number', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Extract all claims from items
      const allClaims: ItemClaim[] = [];
      for (const item of itemsData || []) {
        if (item.claims) {
          allClaims.push(...item.claims);
        }
      }
      setClaims(allClaims);

      // Fetch group members
      if (receiptData?.group_id) {
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('*')
          .eq('group_id', receiptData.group_id)
          .order('created_at', { ascending: true });

        if (membersError) throw membersError;
        setMembers(membersData || []);
      }
    } catch (err: unknown) {
      logger.error('Error fetching receipt:', err);
      setError(getErrorMessage(err) || 'Failed to fetch receipt');
    } finally {
      setLoading(false);
    }
  }, [receiptId, getSupabase]);

  // Initial fetch
  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  // Subscribe to real-time updates for claims
  // NOTE: This subscription listens to all item_claims changes, not just those for the current receipt.
  // This is a known limitation since Supabase postgres_changes can't filter on joined fields.
  // The refetch is idempotent and claims are low-frequency events, so this is acceptable for now.
  // Future optimization: Add receipt_id column to item_claims for direct filtering.
  useEffect(() => {
    if (!receiptId) return;

    let channel: ReturnType<Awaited<ReturnType<typeof getSupabase>>['channel']> | null = null;

    const setupSubscription = async () => {
      const supabase = await getSupabase();
      channel = supabase
        .channel(`receipt-claims:${receiptId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'item_claims',
          },
          (payload) => {
            // Refetch when claims change
            fetchReceipt();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        getSupabase().then(supabase => supabase.removeChannel(channel!));
      }
    };
  }, [receiptId, fetchReceipt, getSupabase]);

  return {
    receipt,
    items,
    claims,
    members,
    loading,
    error,
    refetch: fetchReceipt,
  };
}

/**
 * Hook to fetch receipts for a group
 */
export function useGroupReceipts(groupId: string | undefined) {
  const { getSupabase } = useSupabase();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipts = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = await getSupabase();

      const { data, error: fetchError } = await supabase
        .from('receipts')
        .select('*, uploader:members!uploaded_by(id, name)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setReceipts(data || []);
    } catch (err: unknown) {
      logger.error('Error fetching receipts:', err);
      setError(getErrorMessage(err) || 'Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  }, [groupId, getSupabase]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  return {
    receipts,
    loading,
    error,
    refetch: fetchReceipts,
  };
}

/**
 * Hook for managing item claims
 */
export function useItemClaims(receiptId: string | undefined) {
  const { getSupabase } = useSupabase();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Claim an item for a member
   */
  const claimItem = useCallback(
    async (
      itemId: string,
      memberId: string,
      options: {
        splitCount?: number;
        shareFraction?: number;
        claimedVia?: ClaimSource;
        maxFraction?: number;
      } = {}
    ) => {
      logger.debug('claimItem hook called:', { receiptId, itemId, memberId, options });

      if (!receiptId) return { success: false, error: 'No receipt ID' };

      try {
        setClaiming(true);
        setError(null);

        const supabase = await getSupabase();
        const claimData = createClaim(itemId, memberId, options);
        logger.debug('Created claim data:', claimData);

        const { data, error: insertError } = await supabase
          .from('item_claims')
          .upsert(claimData, {
            onConflict: 'receipt_item_id,member_id',
          })
          .select();

        logger.debug('Upsert result:', { data, error: insertError });

        if (insertError) throw insertError;

        return { success: true };
      } catch (err: unknown) {
        logger.error('Error claiming item:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to claim item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setClaiming(false);
      }
    },
    [receiptId, getSupabase]
  );

  /**
   * Remove a claim
   */
  const unclaimItem = useCallback(
    async (itemId: string, memberId: string) => {
      logger.debug('unclaimItem called:', { itemId, memberId });

      try {
        setClaiming(true);
        setError(null);

        const supabase = await getSupabase();

        const { error: deleteError, count } = await supabase
          .from('item_claims')
          .delete()
          .eq('receipt_item_id', itemId)
          .eq('member_id', memberId);

        logger.debug('unclaimItem delete result:', { deleteError, count });

        if (deleteError) throw deleteError;

        return { success: true };
      } catch (err: unknown) {
        logger.error('Error unclaiming item:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to unclaim item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setClaiming(false);
      }
    },
    [getSupabase]
  );

  /**
   * Split an item between multiple members
   */
  const splitItem = useCallback(
    async (
      itemId: string,
      memberIds: string[],
      claimedVia: ClaimSource = 'app'
    ) => {
      if (memberIds.length < 2) {
        return { success: false, error: 'Need at least 2 members to split' };
      }

      try {
        setClaiming(true);
        setError(null);

        const supabase = await getSupabase();

        // Delete existing claims for this item
        await supabase.from('item_claims').delete().eq('receipt_item_id', itemId);

        // Create new split claims
        const splitCount = memberIds.length;
        const shareFraction = 1 / splitCount;

        const claims = memberIds.map((memberId) =>
          createClaim(itemId, memberId, { splitCount, shareFraction, claimedVia })
        );

        const { error: insertError } = await supabase
          .from('item_claims')
          .insert(claims);

        if (insertError) throw insertError;

        return { success: true };
      } catch (err: unknown) {
        logger.error('Error splitting item:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to split item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setClaiming(false);
      }
    },
    [getSupabase]
  );

  /**
   * Clear all claims for all items in a receipt
   * Used when switching split modes (e.g., from item claiming to split evenly)
   */
  const clearAllClaims = useCallback(
    async (items: { id: string }[]) => {
      try {
        setClaiming(true);
        setError(null);

        if (items.length === 0) {
          return { success: true };
        }

        const supabase = await getSupabase();
        const itemIds = items.map((i) => i.id);

        const { error: deleteError } = await supabase
          .from('item_claims')
          .delete()
          .in('receipt_item_id', itemIds);

        if (deleteError) throw deleteError;

        return { success: true };
      } catch (err: unknown) {
        logger.error('Error clearing claims:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to clear claims';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setClaiming(false);
      }
    },
    [getSupabase]
  );

  return {
    claimItem,
    unclaimItem,
    splitItem,
    clearAllClaims,
    claiming,
    error,
  };
}

/**
 * Hook for creating and uploading receipts
 */
export function useReceiptUpload(groupId: string | undefined) {
  const { getSupabase } = useSupabase();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a receipt image and create the receipt record
   * Images are compressed before upload (max 1200x1600, 70% quality JPEG)
   */
  const uploadReceipt = useCallback(
    async (imageUri: string, uploaderId: string) => {
      if (!groupId) return { success: false, error: 'No group ID' };

      try {
        setUploading(true);
        setError(null);

        const supabase = await getSupabase();

        // Compress image and create thumbnail
        const { compressed, thumbnail } = await prepareImageForUpload(imageUri);

        // Generate unique filenames
        const timestamp = Date.now();
        const fileName = `receipt_${groupId}_${timestamp}.jpg`;
        const thumbFileName = `receipt_${groupId}_${timestamp}_thumb.jpg`;
        const filePath = `receipts/${groupId}/${fileName}`;
        const thumbPath = `receipts/${groupId}/${thumbFileName}`;

        // Upload compressed image (use arrayBuffer for React Native compatibility)
        const compressedArrayBuffer = await fetch(compressed.uri).then((res) =>
          res.arrayBuffer()
        );

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, compressedArrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Upload thumbnail (use arrayBuffer for React Native compatibility)
        const thumbArrayBuffer = await fetch(thumbnail.uri).then((res) =>
          res.arrayBuffer()
        );

        await supabase.storage
          .from('receipts')
          .upload(thumbPath, thumbArrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });
        // Don't throw on thumbnail error - it's optional

        // Get public URLs
        const {
          data: { publicUrl },
        } = supabase.storage.from('receipts').getPublicUrl(filePath);

        const {
          data: { publicUrl: thumbnailUrl },
        } = supabase.storage.from('receipts').getPublicUrl(thumbPath);

        // Create receipt record
        const { data: receipt, error: insertError } = await supabase
          .from('receipts')
          .insert({
            group_id: groupId,
            uploaded_by: uploaderId,
            image_url: publicUrl,
            image_thumbnail_url: thumbnailUrl,
            ocr_status: 'pending',
            status: 'draft',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return { success: true, receipt, compressedUri: compressed.uri };
      } catch (err: unknown) {
        logger.error('Error uploading receipt:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to upload receipt';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUploading(false);
      }
    },
    [groupId, getSupabase]
  );

  /**
   * Process a receipt with OCR (enhanced with P0/P1 features)
   */
  const processReceipt = useCallback(
    async (receiptId: string, imageUri: string) => {
      try {
        setProcessing(true);
        setError(null);

        const supabase = await getSupabase();

        // Import OCR dynamically to avoid loading it unnecessarily
        const { processReceiptImage, validateOCRResult } = await import('./ocr');

        // Update status to processing
        await supabase
          .from('receipts')
          .update({ ocr_status: 'processing' })
          .eq('id', receiptId);

        // Process the image
        const ocrResult = await processReceiptImage(imageUri);

        // Validate the result
        const validation = validateOCRResult(ocrResult);

        if (!validation.isValid) {
          await supabase
            .from('receipts')
            .update({ ocr_status: 'failed' })
            .eq('id', receiptId);

          return {
            success: false,
            error: validation.errors.join(', '),
            warnings: validation.warnings,
          };
        }

        // Calculate service charge and discount totals
        const serviceChargeAmount = ocrResult.metadata.serviceCharges?.reduce(
          (sum, sc) => sum + sc.amount,
          0
        ) || 0;
        const discountAmount = ocrResult.metadata.discounts?.reduce(
          (sum, d) => sum + d.amount, // discounts are negative
          0
        ) || 0;

        // Update receipt with metadata
        await supabase
          .from('receipts')
          .update({
            ocr_status: 'completed',
            ocr_provider: ocrResult.provider,
            ocr_confidence: ocrResult.confidence,
            ocr_raw_response: ocrResult,
            merchant_name: ocrResult.metadata.merchantName,
            merchant_address: ocrResult.metadata.merchantAddress,
            receipt_date: ocrResult.metadata.date,
            subtotal: ocrResult.metadata.subtotal,
            tax_amount: ocrResult.metadata.tax,
            tip_amount: ocrResult.metadata.tip,
            total_amount: ocrResult.metadata.total,
            currency: ocrResult.metadata.currency || 'USD',
            service_charge_amount: serviceChargeAmount,
            discount_amount: discountAmount,
            status: 'claiming',
          })
          .eq('id', receiptId);

        // Insert receipt items with enhanced fields
        const items = ocrResult.items.map((item, index) => ({
          receipt_id: receiptId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          original_text: item.originalText,
          confidence: item.confidence,
          line_number: index + 1,
          is_tax: false,
          is_tip: false,
          is_discount: item.totalPrice < 0,
          is_subtotal: false,
          is_total: false,
          // P0: Multi-quantity support
          original_quantity: item.quantity > 1 ? item.quantity : null,
          // P0: Shared item detection
          is_likely_shared: item.isLikelyShared || false,
          // P1: Modifier detection
          is_modifier: item.isModifier || false,
          // P1: Service charge detection
          is_service_charge: item.isServiceCharge || false,
          service_charge_type: item.serviceChargeType || null,
        }));

        // First insert all items to get their IDs
        const { data: insertedItems, error: itemsError } = await supabase
          .from('receipt_items')
          .insert(items)
          .select('id, line_number');

        if (itemsError) throw itemsError;

        // Update parent_item_id for modifiers (need IDs from inserted items)
        if (insertedItems && insertedItems.length > 0) {
          const lineNumberToId = new Map(
            insertedItems.map((item) => [item.line_number, item.id])
          );

          const modifierUpdates: PromiseLike<any>[] = [];
          ocrResult.items.forEach((item, index) => {
            if (item.isModifier && item.parentItemIndex !== null && item.parentItemIndex !== undefined) {
              const modifierItemId = lineNumberToId.get(index + 1);
              const parentLineNumber = item.parentItemIndex + 1;
              const parentItemId = lineNumberToId.get(parentLineNumber);

              if (modifierItemId && parentItemId) {
                modifierUpdates.push(
                  supabase
                    .from('receipt_items')
                    .update({ parent_item_id: parentItemId })
                    .eq('id', modifierItemId)
                    .then(() => {})
                );
              }
            }
          });

          // Also handle discounts with applies_to_item_id
          ocrResult.metadata.discounts?.forEach((discount) => {
            if (discount.appliesToItemIndex !== null && discount.appliesToItemIndex !== undefined) {
              // Find the discount item (negative totalPrice items)
              const discountItemIndex = ocrResult.items.findIndex(
                (item) => item.totalPrice < 0 && item.description === discount.description
              );
              if (discountItemIndex >= 0) {
                const discountItemId = lineNumberToId.get(discountItemIndex + 1);
                const targetLineNumber = discount.appliesToItemIndex + 1;
                const targetItemId = lineNumberToId.get(targetLineNumber);

                if (discountItemId && targetItemId) {
                  modifierUpdates.push(
                    supabase
                      .from('receipt_items')
                      .update({ applies_to_item_id: targetItemId })
                      .eq('id', discountItemId)
                      .then(() => {})
                  );
                }
              }
            }
          });

          if (modifierUpdates.length > 0) {
            await Promise.all(modifierUpdates);
          }
        }

        return {
          success: true,
          ocrResult,
          warnings: validation.warnings,
        };
      } catch (err: unknown) {
        logger.error('Error processing receipt:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to process receipt';
        setError(errorMsg);

        try {
          const supabase = await getSupabase();
          await supabase
            .from('receipts')
            .update({ ocr_status: 'failed' })
            .eq('id', receiptId);
        } catch {
          // Ignore update error
        }

        return { success: false, error: errorMsg };
      } finally {
        setProcessing(false);
      }
    },
    [getSupabase]
  );

  return {
    uploadReceipt,
    processReceipt,
    uploading,
    processing,
    error,
  };
}

/**
 * Hook to get receipt summary with member totals
 */
export function useReceiptSummary(receiptId: string | undefined) {
  const { receipt, items, claims, members, loading, error, refetch } =
    useReceipt(receiptId);

  const [summary, setSummary] = useState<ReceiptSummary | null>(null);

  useEffect(() => {
    if (receipt && items.length > 0 && members.length > 0) {
      const summaryData = generateReceiptSummary(receipt, items, claims, members);
      setSummary(summaryData);
    } else {
      setSummary(null);
    }
  }, [receipt, items, claims, members]);

  return {
    receipt,
    items,
    claims,
    members,
    summary,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to expand multi-quantity items into individual units
 * P0: Allows users to claim individual items from "3 x Burger = $27" as separate $9 items
 */
export function useItemExpansion(receiptId: string | undefined) {
  const { getSupabase } = useSupabase();
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Expand a multi-quantity item into individual units
   * e.g., "3 x Burger @ $9 = $27" becomes 3 separate "Burger" items at $9 each
   */
  const expandItem = useCallback(
    async (itemId: string) => {
      if (!receiptId) return { success: false, error: 'No receipt ID' };

      try {
        setExpanding(true);
        setError(null);

        const supabase = await getSupabase();

        // Fetch the item to expand
        const { data: item, error: fetchError } = await supabase
          .from('receipt_items')
          .select('*')
          .eq('id', itemId)
          .single();

        if (fetchError) throw fetchError;
        if (!item) throw new Error('Item not found');

        const quantity = item.original_quantity || item.quantity;
        if (quantity <= 1) {
          return { success: false, error: 'Item cannot be expanded (quantity is 1)' };
        }

        // Calculate unit price
        const unitPrice = item.unit_price || (item.total_price / quantity);

        // Create expanded items
        const expandedItems = [];
        for (let i = 0; i < quantity; i++) {
          expandedItems.push({
            receipt_id: receiptId,
            description: item.description,
            quantity: 1,
            unit_price: unitPrice,
            total_price: unitPrice,
            original_text: item.original_text,
            confidence: item.confidence,
            line_number: (item.line_number || 0) + (i * 0.01), // Keep ordering
            is_tax: false,
            is_tip: false,
            is_discount: false,
            is_subtotal: false,
            is_total: false,
            is_likely_shared: false, // Individual items are no longer shared
            is_modifier: false,
            is_expansion: true,
            expanded_from_id: itemId,
            original_quantity: 1,
          });
        }

        // Insert expanded items
        const { data: newItems, error: insertError } = await supabase
          .from('receipt_items')
          .insert(expandedItems)
          .select();

        if (insertError) throw insertError;

        // Mark original item as expanded (set quantity to 0 to hide it from claiming)
        // We keep the original for reference and potential "collapse" later
        const { error: updateError } = await supabase
          .from('receipt_items')
          .update({
            quantity: 0, // Hide from claiming
            total_price: 0, // Zero out to not affect totals
          })
          .eq('id', itemId);

        if (updateError) throw updateError;

        return {
          success: true,
          expandedItems: newItems,
          expandedCount: quantity,
        };
      } catch (err: unknown) {
        logger.error('Error expanding item:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to expand item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setExpanding(false);
      }
    },
    [receiptId, getSupabase]
  );

  /**
   * Collapse expanded items back into the original multi-quantity item
   */
  const collapseItems = useCallback(
    async (originalItemId: string) => {
      if (!receiptId) return { success: false, error: 'No receipt ID' };

      try {
        setExpanding(true);
        setError(null);

        const supabase = await getSupabase();

        // Fetch the original item
        const { data: originalItem, error: fetchError } = await supabase
          .from('receipt_items')
          .select('*')
          .eq('id', originalItemId)
          .single();

        if (fetchError) throw fetchError;
        if (!originalItem) throw new Error('Original item not found');

        // Fetch expanded items
        const { data: expandedItems, error: expandedError } = await supabase
          .from('receipt_items')
          .select('*')
          .eq('expanded_from_id', originalItemId);

        if (expandedError) throw expandedError;
        if (!expandedItems || expandedItems.length === 0) {
          return { success: false, error: 'No expanded items found' };
        }

        // Check if any expanded items have claims
        const expandedIds = expandedItems.map((i) => i.id);
        const { data: claims, error: claimsError } = await supabase
          .from('item_claims')
          .select('id')
          .in('receipt_item_id', expandedIds);

        if (claimsError) throw claimsError;
        if (claims && claims.length > 0) {
          return {
            success: false,
            error: 'Cannot collapse: some expanded items have been claimed',
          };
        }

        // Delete expanded items
        const { error: deleteError } = await supabase
          .from('receipt_items')
          .delete()
          .in('id', expandedIds);

        if (deleteError) throw deleteError;

        // Restore original item
        const quantity = originalItem.original_quantity || expandedItems.length;
        const unitPrice = expandedItems[0].unit_price || expandedItems[0].total_price;
        const { error: updateError } = await supabase
          .from('receipt_items')
          .update({
            quantity: quantity,
            total_price: unitPrice * quantity,
          })
          .eq('id', originalItemId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: unknown) {
        logger.error('Error collapsing items:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to collapse items';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setExpanding(false);
      }
    },
    [receiptId, getSupabase]
  );

  /**
   * Check if an item can be expanded
   */
  const canExpand = (item: ReceiptItem): boolean => {
    const quantity = item.original_quantity || item.quantity;
    return quantity > 1 && !item.is_expansion && !item.is_tax && !item.is_tip;
  };

  /**
   * Check if an item is the parent of expanded items
   */
  const isExpandedParent = (item: ReceiptItem): boolean => {
    return item.quantity === 0 && (item.original_quantity || 0) > 1;
  };

  return {
    expandItem,
    collapseItems,
    canExpand,
    isExpandedParent,
    expanding,
    error,
  };
}

/**
 * Hook to update receipt details (merchant, date, amounts)
 */
export function useReceiptUpdate() {
  const { getSupabase } = useSupabase();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateReceipt = useCallback(
    async (
      receiptId: string,
      updates: Partial<
        Pick<
          Receipt,
          | 'merchant_name'
          | 'receipt_date'
          | 'subtotal'
          | 'tax_amount'
          | 'tip_amount'
          | 'total_amount'
        >
      >
    ) => {
      try {
        setUpdating(true);
        setError(null);

        const supabase = await getSupabase();

        const { error: updateError } = await supabase
          .from('receipts')
          .update(updates)
          .eq('id', receiptId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: unknown) {
        logger.error('Error updating receipt:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to update receipt';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUpdating(false);
      }
    },
    [getSupabase]
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      updates: Partial<Pick<ReceiptItem, 'description' | 'quantity' | 'total_price'>>
    ) => {
      try {
        setUpdating(true);
        setError(null);

        const supabase = await getSupabase();

        const { error: updateError } = await supabase
          .from('receipt_items')
          .update(updates)
          .eq('id', itemId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: unknown) {
        logger.error('Error updating item:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to update item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUpdating(false);
      }
    },
    [getSupabase]
  );

  const deleteItem = useCallback(async (itemId: string) => {
    try {
      setUpdating(true);
      setError(null);

      const supabase = await getSupabase();

      const { error: deleteError } = await supabase
        .from('receipt_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (err: unknown) {
      logger.error('Error deleting item:', err);
      const errorMsg = getErrorMessage(err) || 'Failed to delete item';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setUpdating(false);
    }
  }, [getSupabase]);

  const addItem = useCallback(
    async (
      receiptId: string,
      item: Pick<ReceiptItem, 'description' | 'quantity' | 'total_price'>
    ) => {
      try {
        setUpdating(true);
        setError(null);

        const supabase = await getSupabase();

        // Get the next line number
        const { data: existingItems } = await supabase
          .from('receipt_items')
          .select('line_number')
          .eq('receipt_id', receiptId)
          .order('line_number', { ascending: false })
          .limit(1);

        const nextLineNumber = (existingItems?.[0]?.line_number || 0) + 1;

        const { data, error: insertError } = await supabase
          .from('receipt_items')
          .insert({
            receipt_id: receiptId,
            ...item,
            line_number: nextLineNumber,
            is_tax: false,
            is_tip: false,
            is_discount: false,
            is_subtotal: false,
            is_total: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return { success: true, item: data };
      } catch (err: unknown) {
        logger.error('Error adding item:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to add item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUpdating(false);
      }
    },
    [getSupabase]
  );

  return {
    updateReceipt,
    updateItem,
    deleteItem,
    addItem,
    updating,
    error,
  };
}

/**
 * Hook to upload a receipt without requiring a group ID
 * Used for the group-agnostic scanning flow where users scan first, assign group later
 */
export function useReceiptUploadNoGroup() {
  const { getSupabase } = useSupabase();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a receipt image without a group
   * Creates receipt with group_id: null and uploaded_by_clerk_id for ownership tracking
   */
  const uploadReceipt = useCallback(
    async (imageUri: string, clerkUserId: string) => {
      try {
        setUploading(true);
        setError(null);

        const supabase = await getSupabase();

        // Compress image and create thumbnail
        const { compressed, thumbnail } = await prepareImageForUpload(imageUri);

        // Generate unique filenames using clerk user ID
        const timestamp = Date.now();
        const fileName = `receipt_${clerkUserId}_${timestamp}.jpg`;
        const thumbFileName = `receipt_${clerkUserId}_${timestamp}_thumb.jpg`;
        const filePath = `receipts/unassigned/${clerkUserId}/${fileName}`;
        const thumbPath = `receipts/unassigned/${clerkUserId}/${thumbFileName}`;

        // Upload compressed image (use arrayBuffer for React Native compatibility)
        const compressedArrayBuffer = await fetch(compressed.uri).then((res) =>
          res.arrayBuffer()
        );

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, compressedArrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Upload thumbnail (use arrayBuffer for React Native compatibility)
        const thumbArrayBuffer = await fetch(thumbnail.uri).then((res) =>
          res.arrayBuffer()
        );

        await supabase.storage
          .from('receipts')
          .upload(thumbPath, thumbArrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        // Get public URLs
        const {
          data: { publicUrl },
        } = supabase.storage.from('receipts').getPublicUrl(filePath);

        const {
          data: { publicUrl: thumbnailUrl },
        } = supabase.storage.from('receipts').getPublicUrl(thumbPath);

        // Create receipt record without group
        const { data: receipt, error: insertError } = await supabase
          .from('receipts')
          .insert({
            group_id: null,
            uploaded_by: null,
            uploaded_by_clerk_id: clerkUserId,
            image_url: publicUrl,
            image_thumbnail_url: thumbnailUrl,
            ocr_status: 'pending',
            status: 'draft',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return { success: true, receipt, receiptId: receipt.id, compressedUri: compressed.uri };
      } catch (err: unknown) {
        logger.error('Error uploading receipt:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to upload receipt';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUploading(false);
      }
    },
    [getSupabase]
  );

  /**
   * Process a receipt with OCR (enhanced with P0/P1 features, works without group)
   */
  const processReceipt = useCallback(
    async (receiptId: string, imageUri: string) => {
      try {
        setProcessing(true);
        setError(null);

        const supabase = await getSupabase();

        // Import OCR dynamically
        const { processReceiptImage, validateOCRResult } = await import('./ocr');

        // Update status to processing
        await supabase
          .from('receipts')
          .update({ ocr_status: 'processing' })
          .eq('id', receiptId);

        // Process the image
        const ocrResult = await processReceiptImage(imageUri);

        // Validate the result
        const validation = validateOCRResult(ocrResult);

        if (!validation.isValid) {
          await supabase
            .from('receipts')
            .update({ ocr_status: 'failed' })
            .eq('id', receiptId);

          return {
            success: false,
            error: validation.errors.join(', '),
            warnings: validation.warnings,
          };
        }

        // Calculate service charge and discount totals
        const serviceChargeAmount = ocrResult.metadata.serviceCharges?.reduce(
          (sum, sc) => sum + sc.amount,
          0
        ) || 0;
        const discountAmount = ocrResult.metadata.discounts?.reduce(
          (sum, d) => sum + d.amount, // discounts are negative
          0
        ) || 0;

        // Update receipt with metadata (keep status as draft until group assigned)
        await supabase
          .from('receipts')
          .update({
            ocr_status: 'completed',
            ocr_provider: ocrResult.provider,
            ocr_confidence: ocrResult.confidence,
            ocr_raw_response: ocrResult,
            merchant_name: ocrResult.metadata.merchantName,
            merchant_address: ocrResult.metadata.merchantAddress,
            receipt_date: ocrResult.metadata.date,
            subtotal: ocrResult.metadata.subtotal,
            tax_amount: ocrResult.metadata.tax,
            tip_amount: ocrResult.metadata.tip,
            total_amount: ocrResult.metadata.total,
            currency: ocrResult.metadata.currency || 'USD',
            service_charge_amount: serviceChargeAmount,
            discount_amount: discountAmount,
            // Don't change status to 'claiming' yet - will be set when group is assigned
          })
          .eq('id', receiptId);

        // Insert receipt items with enhanced fields
        const items = ocrResult.items.map((item, index) => ({
          receipt_id: receiptId,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          line_number: index + 1,
          confidence: item.confidence,
          is_tax: false,
          is_tip: false,
          is_discount: item.totalPrice < 0,
          is_subtotal: false,
          is_total: false,
          // P0: Multi-quantity support
          original_quantity: item.quantity > 1 ? item.quantity : null,
          // P0: Shared item detection
          is_likely_shared: item.isLikelyShared || false,
          // P1: Modifier detection
          is_modifier: item.isModifier || false,
          // P1: Service charge detection
          is_service_charge: item.isServiceCharge || false,
          service_charge_type: item.serviceChargeType || null,
        }));

        if (items.length > 0) {
          // First insert all items to get their IDs
          const { data: insertedItems, error: itemsError } = await supabase
            .from('receipt_items')
            .insert(items)
            .select('id, line_number');

          if (itemsError) throw itemsError;

          // Update parent_item_id for modifiers
          if (insertedItems && insertedItems.length > 0) {
            const lineNumberToId = new Map(
              insertedItems.map((item) => [item.line_number, item.id])
            );

            const modifierUpdates: PromiseLike<any>[] = [];
            ocrResult.items.forEach((item, index) => {
              if (item.isModifier && item.parentItemIndex !== null && item.parentItemIndex !== undefined) {
                const modifierItemId = lineNumberToId.get(index + 1);
                const parentLineNumber = item.parentItemIndex + 1;
                const parentItemId = lineNumberToId.get(parentLineNumber);

                if (modifierItemId && parentItemId) {
                  modifierUpdates.push(
                    supabase
                      .from('receipt_items')
                      .update({ parent_item_id: parentItemId })
                      .eq('id', modifierItemId)
                      .then(() => {})
                  );
                }
              }
            });

            if (modifierUpdates.length > 0) {
              await Promise.all(modifierUpdates);
            }
          }
        }

        return {
          success: true,
          warnings: validation.warnings,
          itemCount: items.length,
        };
      } catch (err: unknown) {
        logger.error('Error processing receipt:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to process receipt';
        setError(errorMsg);

        // Mark as failed
        try {
          const supabase = await getSupabase();
          await supabase
            .from('receipts')
            .update({ ocr_status: 'failed' })
            .eq('id', receiptId);
        } catch {
          // Ignore update error
        }

        return { success: false, error: errorMsg };
      } finally {
        setProcessing(false);
      }
    },
    [getSupabase]
  );

  return { uploadReceipt, processReceipt, uploading, processing, error };
}

/**
 * Hook to assign a group to an existing receipt
 * Used after scanning and reviewing OCR results
 */
export function useReceiptGroupAssignment() {
  const { getSupabase } = useSupabase();
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Assign a group to a receipt and set it ready for claiming
   */
  const assignGroup = useCallback(
    async (receiptId: string, groupId: string, clerkUserId: string) => {
      try {
        setAssigning(true);
        setError(null);

        const supabase = await getSupabase();

        // Find or create member record for user in this group
        let { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('group_id', groupId)
          .eq('clerk_user_id', clerkUserId)
          .single();

        // If no member record exists, we can't assign (user must be a member)
        if (!member) {
          throw new Error('You must be a member of this group to assign a receipt');
        }

        // Generate share code for the receipt
        const { generateReceiptShareCode } = await import('./receipts');
        const shareCode = generateReceiptShareCode();

        // Update receipt with group assignment
        const { data: receipt, error: updateError } = await supabase
          .from('receipts')
          .update({
            group_id: groupId,
            uploaded_by: member.id,
            status: 'claiming',
            share_code: shareCode,
          })
          .eq('id', receiptId)
          .select()
          .single();

        if (updateError) throw updateError;

        return {
          success: true,
          receipt,
          memberId: member.id,
          shareCode,
        };
      } catch (err: unknown) {
        logger.error('Error assigning group:', err);
        const errorMsg = getErrorMessage(err) || 'Failed to assign group';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setAssigning(false);
      }
    },
    [getSupabase]
  );

  return { assignGroup, assigning, error };
}

/**
 * Hook to fetch unassigned receipts for a user
 */
export function useUnassignedReceipts(clerkUserId: string | undefined) {
  const { getSupabase } = useSupabase();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipts = useCallback(async () => {
    if (!clerkUserId) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = await getSupabase();

      const { data, error: fetchError } = await supabase
        .from('receipts')
        .select('*')
        .eq('uploaded_by_clerk_id', clerkUserId)
        .is('group_id', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setReceipts(data || []);
    } catch (err: unknown) {
      logger.error('Error fetching unassigned receipts:', err);
      setError(getErrorMessage(err) || 'Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  }, [clerkUserId, getSupabase]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  return { receipts, loading, error, refetch: fetchReceipts };
}
