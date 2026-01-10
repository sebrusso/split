/**
 * Receipt Hooks
 *
 * React hooks for fetching and managing receipt data,
 * including real-time updates for item claiming.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
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

/**
 * Hook to fetch a single receipt with all related data
 */
export function useReceipt(receiptId: string | undefined) {
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
    } catch (err: any) {
      console.error('Error fetching receipt:', err);
      setError(err.message || 'Failed to fetch receipt');
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  // Initial fetch
  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  // Subscribe to real-time updates for claims
  useEffect(() => {
    if (!receiptId) return;

    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [receiptId, fetchReceipt]);

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

      const { data, error: fetchError } = await supabase
        .from('receipts')
        .select('*, uploader:members!uploaded_by(id, name)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setReceipts(data || []);
    } catch (err: any) {
      console.error('Error fetching receipts:', err);
      setError(err.message || 'Failed to fetch receipts');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

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
      } = {}
    ) => {
      if (!receiptId) return { success: false, error: 'No receipt ID' };

      try {
        setClaiming(true);
        setError(null);

        const claimData = createClaim(itemId, memberId, options);

        const { error: insertError } = await supabase
          .from('item_claims')
          .upsert(claimData, {
            onConflict: 'receipt_item_id,member_id',
          });

        if (insertError) throw insertError;

        return { success: true };
      } catch (err: any) {
        console.error('Error claiming item:', err);
        const errorMsg = err.message || 'Failed to claim item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setClaiming(false);
      }
    },
    [receiptId]
  );

  /**
   * Remove a claim
   */
  const unclaimItem = useCallback(
    async (itemId: string, memberId: string) => {
      try {
        setClaiming(true);
        setError(null);

        const { error: deleteError } = await supabase
          .from('item_claims')
          .delete()
          .eq('receipt_item_id', itemId)
          .eq('member_id', memberId);

        if (deleteError) throw deleteError;

        return { success: true };
      } catch (err: any) {
        console.error('Error unclaiming item:', err);
        const errorMsg = err.message || 'Failed to unclaim item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setClaiming(false);
      }
    },
    []
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
      } catch (err: any) {
        console.error('Error splitting item:', err);
        const errorMsg = err.message || 'Failed to split item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setClaiming(false);
      }
    },
    []
  );

  return {
    claimItem,
    unclaimItem,
    splitItem,
    claiming,
    error,
  };
}

/**
 * Hook for creating and uploading receipts
 */
export function useReceiptUpload(groupId: string | undefined) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Upload a receipt image and create the receipt record
   */
  const uploadReceipt = useCallback(
    async (imageUri: string, uploaderId: string) => {
      if (!groupId) return { success: false, error: 'No group ID' };

      try {
        setUploading(true);
        setError(null);

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `receipt_${groupId}_${timestamp}.jpg`;
        const filePath = `receipts/${groupId}/${fileName}`;

        // Read and upload image
        const response = await fetch(imageUri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('receipts').getPublicUrl(filePath);

        // Create receipt record
        const { data: receipt, error: insertError } = await supabase
          .from('receipts')
          .insert({
            group_id: groupId,
            uploaded_by: uploaderId,
            image_url: publicUrl,
            ocr_status: 'pending',
            status: 'draft',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return { success: true, receipt };
      } catch (err: any) {
        console.error('Error uploading receipt:', err);
        const errorMsg = err.message || 'Failed to upload receipt';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUploading(false);
      }
    },
    [groupId]
  );

  /**
   * Process a receipt with OCR
   */
  const processReceipt = useCallback(
    async (receiptId: string, imageUri: string) => {
      try {
        setProcessing(true);
        setError(null);

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
            status: 'claiming',
          })
          .eq('id', receiptId);

        // Insert receipt items
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
        }));

        const { error: itemsError } = await supabase
          .from('receipt_items')
          .insert(items);

        if (itemsError) throw itemsError;

        return {
          success: true,
          ocrResult,
          warnings: validation.warnings,
        };
      } catch (err: any) {
        console.error('Error processing receipt:', err);
        const errorMsg = err.message || 'Failed to process receipt';
        setError(errorMsg);

        await supabase
          .from('receipts')
          .update({ ocr_status: 'failed' })
          .eq('id', receiptId);

        return { success: false, error: errorMsg };
      } finally {
        setProcessing(false);
      }
    },
    []
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
 * Hook to update receipt details (merchant, date, amounts)
 */
export function useReceiptUpdate() {
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

        const { error: updateError } = await supabase
          .from('receipts')
          .update(updates)
          .eq('id', receiptId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: any) {
        console.error('Error updating receipt:', err);
        const errorMsg = err.message || 'Failed to update receipt';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUpdating(false);
      }
    },
    []
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      updates: Partial<Pick<ReceiptItem, 'description' | 'quantity' | 'total_price'>>
    ) => {
      try {
        setUpdating(true);
        setError(null);

        const { error: updateError } = await supabase
          .from('receipt_items')
          .update(updates)
          .eq('id', itemId);

        if (updateError) throw updateError;

        return { success: true };
      } catch (err: any) {
        console.error('Error updating item:', err);
        const errorMsg = err.message || 'Failed to update item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUpdating(false);
      }
    },
    []
  );

  const deleteItem = useCallback(async (itemId: string) => {
    try {
      setUpdating(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('receipt_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting item:', err);
      const errorMsg = err.message || 'Failed to delete item';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setUpdating(false);
    }
  }, []);

  const addItem = useCallback(
    async (
      receiptId: string,
      item: Pick<ReceiptItem, 'description' | 'quantity' | 'total_price'>
    ) => {
      try {
        setUpdating(true);
        setError(null);

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
      } catch (err: any) {
        console.error('Error adding item:', err);
        const errorMsg = err.message || 'Failed to add item';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setUpdating(false);
      }
    },
    []
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
