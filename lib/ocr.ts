/**
 * OCR Service Layer
 *
 * Provides receipt text extraction and parsing using Google Gemini.
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

// API configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

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

// Single-pass prompt: Extract and parse receipt in one call with enhanced detection
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
   - Example: If item[0] is "Burger $12" and item[1] is "+ Bacon $2", then item[1] should have isModifier: true and parentItemIndex: 0

4. SERVICE CHARGES (separate from tip):
   - Extract as serviceCharges array, NOT as regular items
   - Types: "gratuity" (auto-gratuity), "delivery", "convenience", "other"
   - Common examples: "Service Charge", "Gratuity 18%", "Delivery Fee", "Convenience Fee"

5. DISCOUNTS:
   - Extract as discounts array with NEGATIVE amounts
   - If discount applies to specific item, set appliesToItemIndex
   - If discount applies to whole bill, set appliesToItemIndex: null
   - Examples: "Happy Hour -$5", "20% OFF", "BOGO", "Member Discount"

6. TAX HANDLING:
   - Extract as taxes array to support multiple tax types
   - Common types: "Sales Tax", "Alcohol Tax", "State Tax", "Local Tax"

7. GENERAL RULES:
   - Prices should be numbers without currency symbols
   - If you can't read a value clearly, use null
   - Do not guess or make up values
   - Exclude section headers, payment info, and change/balance due
   - Currency: infer from symbols ($=USD, €=EUR, £=GBP) or default to USD
   - Include combo components even if $0.00 (mark as modifiers of the combo)

Return ONLY the JSON object, no other text or markdown.`;

// Two-pass: First pass extracts raw text
const TEXT_EXTRACTION_PROMPT = `Extract all text from this receipt image exactly as it appears.
Preserve the layout as much as possible, keeping items and prices on the same lines.
Include everything: store name, address, items, prices, tax, total, date, etc.
Pay special attention to:
- Quantities (e.g., "3 x Burger" or "2 @ $5.99")
- Modifiers/add-ons (lines starting with +, Add, Extra)
- Service charges (Gratuity, Delivery Fee)
- Discounts (lines with negative amounts or % off)
Return only the extracted text, nothing else.`;

// Two-pass: Second pass parses the extracted text
const TEXT_PARSE_PROMPT = `Parse this receipt text and extract structured data. The text was extracted via OCR and may have some errors or formatting issues.

Receipt text:
---
{TEXT}
---

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

1. QUANTITY HANDLING:
   - For "3 x Burger @ $9.00 = $27.00": quantity: 3, unitPrice: 9.00, totalPrice: 27.00
   - For single items, use quantity: 1

2. SHARED ITEM DETECTION - Set isLikelyShared: true for:
   - Items with: "pitcher", "bottle of", "carafe", "for the table", "to share", "family style", "platter"
   - Large appetizers: nachos, wings, shared desserts

3. MODIFIER DETECTION:
   - Set isModifier: true for lines starting with "+", "Add", "Extra", "No", "Sub", "With"
   - Set parentItemIndex to the 0-based index of the parent item

4. SERVICE CHARGES: Extract separately (not as items). Types: "gratuity", "delivery", "convenience", "other"

5. DISCOUNTS: Extract with NEGATIVE amounts. Set appliesToItemIndex if item-specific, null if global.

6. TAXES: Support multiple tax types as array.

Return ONLY the JSON object, no other text or markdown.`;

/**
 * Call Gemini API with image (vision)
 */
async function callGeminiVision(
  imageBase64: string,
  prompt: string,
  mediaType: string = 'image/jpeg'
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your environment.');
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

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Call Gemini API with text only (no image)
 */
async function callGeminiText(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your environment.');
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

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Single-pass OCR: Gemini vision extracts and parses in one call
 */
export async function processReceiptSinglePass(
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<OCRResult> {
  const responseText = await callGeminiVision(imageBase64, SINGLE_PASS_PROMPT, mediaType);

  // Parse JSON response
  const parsed = parseJsonResponse(responseText);

  return convertToOCRResult(parsed, 'gemini');
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
  // Pass 1: Extract raw text from image
  const rawText = await callGeminiVision(imageBase64, TEXT_EXTRACTION_PROMPT, mediaType);

  if (!rawText || rawText.trim().length < 20) {
    throw new Error('Failed to extract sufficient text from receipt image');
  }

  // Pass 2: Parse the extracted text
  const parsePrompt = TEXT_PARSE_PROMPT.replace('{TEXT}', rawText);
  const responseText = await callGeminiText(parsePrompt);

  // Parse JSON response
  const parsed = parseJsonResponse(responseText);

  return convertToOCRResult(parsed, 'gemini', rawText);
}

/**
 * Parse JSON from model response, handling potential markdown code blocks
 */
function parseJsonResponse(text: string): any {
  const cleanText = text.trim();

  // Remove markdown code blocks if present
  let jsonText = cleanText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    // Try to find JSON object in the response
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error(`Failed to parse response as JSON: ${cleanText.substring(0, 200)}`);
      }
    }
    throw new Error(`Failed to parse response as JSON: ${cleanText.substring(0, 200)}`);
  }
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
    taxes = parsed.taxes.map((t: any) => ({
      type: t.type || 'Sales Tax',
      amount: t.amount || 0,
    }));
    taxTotal = taxes.reduce((sum, t) => sum + t.amount, 0);
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
