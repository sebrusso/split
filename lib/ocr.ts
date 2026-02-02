/**
 * OCR Service Layer
 *
 * Provides receipt text extraction and parsing using Supabase Edge Function.
 * The Edge Function calls Google Gemini, keeping API keys secure server-side.
 *
 * Two modes available:
 * - Single-pass (default): Gemini vision extracts and parses in one call
 * - Two-pass: Gemini extracts text first, then parses semantically
 */

import {
  OCRResult,
  OCRExtractedItem,
  OCRExtractedMetadata,
  OCRProvider,
  OCRServiceCharge,
  OCRDiscount,
  OCRTaxEntry,
  ServiceChargeType,
} from './types';
import { supabase } from './supabase';

// OCR Mode configuration
export type OCRMode = 'single_pass' | 'two_pass';

// Default mode - single pass is active
let currentOCRMode: OCRMode = 'single_pass';

/**
 * Set the OCR processing mode
 */
export function setOCRMode(mode: OCRMode): void {
  currentOCRMode = mode;
}

/**
 * Get the current OCR processing mode
 */
export function getOCRMode(): OCRMode {
  return currentOCRMode;
}

/**
 * Call the scan-receipt Edge Function
 */
async function callScanReceiptFunction(
  imageBase64: string,
  mediaType: string,
  mode: OCRMode
): Promise<{ data: any; rawText?: string }> {
  const { data, error } = await supabase.functions.invoke('scan-receipt', {
    body: {
      imageBase64,
      mediaType,
      mode,
    },
  });

  if (error) {
    throw new Error(`Edge function error: ${error.message}`);
  }

  if (!data.success) {
    throw new Error(data.error || 'Unknown error from scan-receipt function');
  }

  return {
    data: data.data,
    rawText: data.rawText,
  };
}

/**
 * Convert parsed JSON to our OCRResult format
 */
function convertToOCRResult(
  parsed: any,
  provider: OCRProvider,
  rawText?: string
): OCRResult {
  const items: OCRExtractedItem[] = (parsed.items || []).map(
    (item: any, index: number) => ({
      description: item.description || `Item ${index + 1}`,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice ?? undefined,
      totalPrice: item.totalPrice || 0,
      confidence: 0.9,
      // Enhanced fields
      isLikelyShared: item.isLikelyShared || false,
      isModifier: item.isModifier || false,
      parentItemIndex: item.parentItemIndex ?? null,
      isServiceCharge: item.isServiceCharge || false,
      serviceChargeType: item.serviceChargeType as ServiceChargeType | undefined,
    })
  );

  // Parse taxes - support both legacy single tax and new array format
  let taxes: OCRTaxEntry[] | undefined;
  let taxTotal: number | undefined;

  if (Array.isArray(parsed.taxes) && parsed.taxes.length > 0) {
    const taxesArray = parsed.taxes.map((t: any) => ({
      type: t.type || 'Sales Tax',
      amount: t.amount || 0,
    }));
    taxes = taxesArray;
    taxTotal = taxesArray.reduce((sum: number, t: OCRTaxEntry) => sum + t.amount, 0);
  } else if (typeof parsed.tax === 'number') {
    // Legacy format - single tax value
    taxTotal = parsed.tax;
    taxes = [{ type: 'Sales Tax', amount: parsed.tax }];
  }

  // Parse service charges
  const serviceCharges: OCRServiceCharge[] | undefined = Array.isArray(parsed.serviceCharges)
    ? parsed.serviceCharges.map((sc: any) => ({
        description: sc.description || 'Service Charge',
        amount: sc.amount || 0,
        type: (sc.type as ServiceChargeType) || 'other',
      }))
    : undefined;

  // Parse discounts
  const discounts: OCRDiscount[] | undefined = Array.isArray(parsed.discounts)
    ? parsed.discounts.map((d: any) => ({
        description: d.description || 'Discount',
        amount: d.amount || 0, // Should be negative
        appliesToItemIndex: d.appliesToItemIndex ?? null,
      }))
    : undefined;

  const metadata: OCRExtractedMetadata = {
    merchantName: parsed.merchant?.name,
    merchantAddress: parsed.merchant?.address,
    date: parsed.date,
    subtotal: parsed.subtotal,
    tax: taxTotal,
    taxes,
    tip: parsed.tip,
    total: parsed.total,
    currency: parsed.currency || 'USD',
    serviceCharges,
    discounts,
  };

  // Calculate confidence based on completeness
  let confidence = 0.5;
  if (metadata.merchantName) confidence += 0.1;
  if (metadata.total) confidence += 0.2;
  if (items.length > 0) confidence += 0.2;

  return {
    items,
    metadata,
    rawText,
    confidence: Math.min(confidence, 1),
    provider,
  };
}

/**
 * Single-pass OCR: Gemini vision extracts and parses in one call
 */
export async function processReceiptSinglePass(
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<OCRResult> {
  const { data } = await callScanReceiptFunction(imageBase64, mediaType, 'single_pass');
  return convertToOCRResult(data, 'gemini');
}

/**
 * Two-pass OCR:
 * 1. Gemini extracts raw text from image
 * 2. Gemini parses the text into structured data
 */
export async function processReceiptTwoPass(
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<OCRResult> {
  const { data, rawText } = await callScanReceiptFunction(imageBase64, mediaType, 'two_pass');
  return convertToOCRResult(data, 'gemini', rawText);
}

/**
 * Main entry point: Process receipt image based on current mode
 */
export async function extractReceipt(
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<OCRResult> {
  if (currentOCRMode === 'single_pass') {
    return processReceiptSinglePass(imageBase64, mediaType);
  } else {
    return processReceiptTwoPass(imageBase64, mediaType);
  }
}

/**
 * Process receipt from image URI (convenience wrapper)
 */
export async function processReceiptImage(imageUri: string): Promise<OCRResult> {
  // Convert image URI to base64
  const response = await fetch(imageUri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];

        // Determine media type from data URL
        const mediaTypeMatch = dataUrl.match(/^data:([^;]+);/);
        const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';

        const result = await extractReceipt(base64, mediaType);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Validate OCR result quality
 */
export function validateOCRResult(result: OCRResult): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for items
  if (result.items.length === 0) {
    errors.push('No items detected on receipt');
  }

  // Check for total
  if (!result.metadata.total) {
    warnings.push('Receipt total not detected');
  }

  // Validate item prices
  for (const item of result.items) {
    if (item.totalPrice <= 0) {
      warnings.push(`Invalid price for "${item.description}"`);
    }
  }

  // Check if items sum to subtotal/total
  const itemsSum = result.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const expectedSubtotal = result.metadata.subtotal || result.metadata.total;

  if (expectedSubtotal && Math.abs(itemsSum - expectedSubtotal) > 1) {
    warnings.push(
      `Items total ($${itemsSum.toFixed(2)}) doesn't match receipt subtotal ($${expectedSubtotal.toFixed(2)})`
    );
  }

  // Check confidence
  if (result.confidence < 0.5) {
    warnings.push('Low confidence OCR result - please verify items');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Basic receipt text parser (fallback when API unavailable)
 */
export function parseReceiptTextBasic(text: string): OCRResult {
  const lines = text.split('\n').filter((line) => line.trim());

  const items: OCRExtractedItem[] = [];
  let merchantName: string | undefined;
  let total: number | undefined;
  let tax: number | undefined;
  let subtotal: number | undefined;

  // Simple regex patterns
  const pricePattern = /\$?\s*(\d+\.\d{2})\s*$/;
  const taxPattern = /tax/i;
  const totalPattern = /total/i;
  const subtotalPattern = /subtotal|sub\s*-?\s*total/i;

  // First non-price line is likely merchant name
  for (const line of lines) {
    if (!pricePattern.test(line) && !taxPattern.test(line) && !totalPattern.test(line)) {
      merchantName = line.trim();
      break;
    }
  }

  // Parse lines for items and totals
  for (const line of lines) {
    const priceMatch = line.match(pricePattern);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      const description = line.replace(pricePattern, '').trim();

      if (totalPattern.test(description) && !subtotalPattern.test(description)) {
        total = price;
      } else if (subtotalPattern.test(description)) {
        subtotal = price;
      } else if (taxPattern.test(description)) {
        tax = price;
      } else if (description.length > 0) {
        items.push({
          description,
          quantity: 1,
          totalPrice: price,
          confidence: 0.5,
        });
      }
    }
  }

  return {
    items,
    metadata: {
      merchantName,
      subtotal,
      tax,
      total,
      currency: 'USD',
    },
    rawText: text,
    confidence: 0.4,
    provider: 'gemini',
  };
}
