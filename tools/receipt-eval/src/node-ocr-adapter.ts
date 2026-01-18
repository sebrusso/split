/**
 * Node.js OCR Adapter
 *
 * Node.js-compatible version of the OCR functions from lib/ocr.ts.
 * Uses the same Gemini API and prompts but adapted for Node.js environment.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Re-export types from lib/types.ts
export type OCRProvider = 'gemini' | 'google_vision' | 'claude' | 'gpt4v' | 'textract';
export type ServiceChargeType = 'gratuity' | 'delivery' | 'convenience' | 'other';

export interface OCRExtractedItem {
  description: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
  confidence?: number;
  originalText?: string;
  isLikelyShared?: boolean;
  isModifier?: boolean;
  parentItemIndex?: number | null;
  isServiceCharge?: boolean;
  serviceChargeType?: ServiceChargeType;
}

export interface OCRServiceCharge {
  description: string;
  amount: number;
  type?: ServiceChargeType;
}

export interface OCRDiscount {
  description: string;
  amount: number;
  appliesToItemIndex?: number | null;
}

export interface OCRTaxEntry {
  type?: string;
  amount: number;
}

export interface OCRExtractedMetadata {
  merchantName?: string;
  merchantAddress?: string;
  date?: string;
  subtotal?: number;
  tax?: number;
  taxes?: OCRTaxEntry[];
  tip?: number;
  total?: number;
  currency?: string;
  serviceCharges?: OCRServiceCharge[];
  discounts?: OCRDiscount[];
}

export interface OCRResult {
  items: OCRExtractedItem[];
  metadata: OCRExtractedMetadata;
  rawText?: string;
  confidence: number;
  provider: OCRProvider;
}

// API configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// OCR Mode configuration
export type OCRMode = 'single_pass' | 'two_pass';
let currentOCRMode: OCRMode = 'single_pass';

export function setOCRMode(mode: OCRMode): void {
  currentOCRMode = mode;
}

export function getOCRMode(): OCRMode {
  return currentOCRMode;
}

// Single-pass prompt
const SINGLE_PASS_PROMPT = `You are a receipt parser. Analyze this receipt image and extract all information into a structured JSON format.

Return a JSON object with this exact structure:
{
  "merchant": {
    "name": "Store Name",
    "address": "Full address if visible" | null
  },
  "date": "YYYY-MM-DD" | null,
  "items": [
    {
      "description": "Item name/description",
      "quantity": 1,
      "unitPrice": 5.99 | null,
      "totalPrice": 5.99,
      "isLikelyShared": false,
      "isModifier": false,
      "parentItemIndex": null
    }
  ],
  "subtotal": 25.99 | null,
  "taxes": [{ "type": "Sales Tax", "amount": 2.08 }],
  "tip": 5.00 | null,
  "serviceCharges": [{ "description": "Gratuity 18%", "amount": 8.00, "type": "gratuity" }],
  "discounts": [{ "description": "Happy Hour", "amount": -5.00, "appliesToItemIndex": null }],
  "total": 33.07,
  "currency": "USD"
}

CRITICAL RULES:

1. QUANTITY HANDLING (very important for splitting):
   - For items with quantity > 1 (e.g., "3 x Burger @ $9.00 = $27.00"), ALWAYS extract:
     - quantity: 3
     - unitPrice: 9.00
     - totalPrice: 27.00
   - For single items, use quantity: 1

2. SHARED ITEM DETECTION - Set isLikelyShared: true for:
   - Items containing: "pitcher", "bottle of", "carafe", "for the table", "to share", "family style", "platter"
   - Large appetizers: nachos, wings (10+ count), fries for table, chips & salsa/guac, dips
   - Items with unusually high quantities (6+ drinks, large platters)
   - Desserts meant for sharing: "brownie sundae", "sampler"

3. MODIFIER/ADD-ON DETECTION:
   - Set isModifier: true for lines that modify another item:
     - Lines starting with "+", "Add", "Extra", "No", "Sub", "With"
     - Toppings, sides that are priced separately
     - Customizations like "Upgrade to large +$2"
   - Set parentItemIndex to the 0-based index of the item being modified

4. SERVICE CHARGES (separate from tip):
   - Extract as serviceCharges array, NOT as regular items
   - Types: "gratuity" (auto-gratuity), "delivery", "convenience", "other"

5. DISCOUNTS:
   - Extract as discounts array with NEGATIVE amounts
   - If discount applies to specific item, set appliesToItemIndex
   - If discount applies to whole bill, set appliesToItemIndex: null

6. TAX HANDLING:
   - Extract as taxes array to support multiple tax types

7. GENERAL RULES:
   - Prices should be numbers without currency symbols
   - If you can't read a value clearly, use null
   - Do not guess or make up values
   - Exclude section headers, payment info, and change/balance due
   - Currency: infer from symbols ($=USD, €=EUR, £=GBP) or default to USD

Return ONLY the JSON object, no other text or markdown.`;

/**
 * Call Gemini API with image
 */
async function callGeminiVision(
  imageBase64: string,
  prompt: string,
  mediaType: string = 'image/jpeg'
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Parse JSON from model response
 */
function parseJsonResponse(text: string): Record<string, unknown> {
  const cleanText = text.trim();

  let jsonText = cleanText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error(`Failed to parse response as JSON: ${cleanText.substring(0, 200)}`);
      }
    }
    throw new Error(`Failed to parse response as JSON: ${cleanText.substring(0, 200)}`);
  }
}

/**
 * Convert parsed JSON to OCRResult format
 */
function convertToOCRResult(
  parsed: Record<string, unknown>,
  provider: OCRProvider,
  rawText?: string
): OCRResult {
  const parsedItems = (parsed.items || []) as Array<Record<string, unknown>>;
  const items: OCRExtractedItem[] = parsedItems.map((item, index) => ({
    description: (item.description as string) || `Item ${index + 1}`,
    quantity: (item.quantity as number) || 1,
    unitPrice: item.unitPrice as number | undefined,
    totalPrice: (item.totalPrice as number) || 0,
    confidence: 0.9,
    isLikelyShared: (item.isLikelyShared as boolean) || false,
    isModifier: (item.isModifier as boolean) || false,
    parentItemIndex: item.parentItemIndex as number | null | undefined,
    isServiceCharge: (item.isServiceCharge as boolean) || false,
    serviceChargeType: item.serviceChargeType as ServiceChargeType | undefined,
  }));

  // Parse taxes
  let taxes: OCRTaxEntry[] | undefined;
  let taxTotal: number | undefined;

  const parsedTaxes = parsed.taxes as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(parsedTaxes) && parsedTaxes.length > 0) {
    taxes = parsedTaxes.map((t) => ({
      type: (t.type as string) || 'Sales Tax',
      amount: (t.amount as number) || 0,
    }));
    taxTotal = taxes.reduce((sum, t) => sum + t.amount, 0);
  } else if (typeof parsed.tax === 'number') {
    taxTotal = parsed.tax;
    taxes = [{ type: 'Sales Tax', amount: parsed.tax }];
  }

  // Parse service charges
  const parsedServiceCharges = parsed.serviceCharges as Array<Record<string, unknown>> | undefined;
  const serviceCharges: OCRServiceCharge[] | undefined = Array.isArray(parsedServiceCharges)
    ? parsedServiceCharges.map((sc) => ({
        description: (sc.description as string) || 'Service Charge',
        amount: (sc.amount as number) || 0,
        type: (sc.type as ServiceChargeType) || 'other',
      }))
    : undefined;

  // Parse discounts
  const parsedDiscounts = parsed.discounts as Array<Record<string, unknown>> | undefined;
  const discounts: OCRDiscount[] | undefined = Array.isArray(parsedDiscounts)
    ? parsedDiscounts.map((d) => ({
        description: (d.description as string) || 'Discount',
        amount: (d.amount as number) || 0,
        appliesToItemIndex: d.appliesToItemIndex as number | null | undefined,
      }))
    : undefined;

  const merchant = parsed.merchant as Record<string, unknown> | undefined;
  const metadata: OCRExtractedMetadata = {
    merchantName: merchant?.name as string | undefined,
    merchantAddress: merchant?.address as string | undefined,
    date: parsed.date as string | undefined,
    subtotal: parsed.subtotal as number | undefined,
    tax: taxTotal,
    taxes,
    tip: parsed.tip as number | undefined,
    total: parsed.total as number | undefined,
    currency: (parsed.currency as string) || 'USD',
    serviceCharges,
    discounts,
  };

  // Calculate confidence
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
 * Single-pass OCR: extract and parse in one call
 */
export async function processReceiptSinglePass(
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<OCRResult> {
  const responseText = await callGeminiVision(imageBase64, SINGLE_PASS_PROMPT, mediaType);
  const parsed = parseJsonResponse(responseText);
  return convertToOCRResult(parsed, 'gemini');
}

/**
 * Two-pass OCR: extract text first, then parse
 */
export async function processReceiptTwoPass(
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<OCRResult> {
  // For simplicity, just use single pass for now
  // Two-pass would require separate prompts
  return processReceiptSinglePass(imageBase64, mediaType);
}

/**
 * Main entry point: process receipt based on mode
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
 * Validate OCR result
 */
export function validateOCRResult(result: OCRResult): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (result.items.length === 0) {
    errors.push('No items detected on receipt');
  }

  if (!result.metadata.total) {
    warnings.push('Receipt total not detected');
  }

  for (const item of result.items) {
    if (item.totalPrice <= 0) {
      warnings.push(`Invalid price for "${item.description}"`);
    }
  }

  const itemsSum = result.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const expectedSubtotal = result.metadata.subtotal || result.metadata.total;

  if (expectedSubtotal && Math.abs(itemsSum - expectedSubtotal) > 1) {
    warnings.push(
      `Items total ($${itemsSum.toFixed(2)}) doesn't match receipt subtotal ($${expectedSubtotal.toFixed(2)})`
    );
  }

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
 * Load an image file and convert to base64
 */
export function loadImageAsBase64(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  return buffer.toString('base64');
}

/**
 * Get the MIME type for an image file
 */
export function getMediaType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

/**
 * Get API key prefix for debugging
 */
export function getApiKeyPrefix(): string {
  const key = GEMINI_API_KEY;
  if (!key) return '(not set)';
  return key.substring(0, 8) + '...';
}
