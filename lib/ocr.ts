/**
 * OCR Service Layer
 *
 * Provides receipt text extraction and parsing using multiple providers:
 * - Google Cloud Vision (primary, fast)
 * - Claude Vision (fallback, high accuracy)
 *
 * The service uses a hybrid approach: Google Vision for initial extraction,
 * then Claude for semantic parsing and validation.
 */

import { OCRResult, OCRExtractedItem, OCRExtractedMetadata, OCRProvider } from './types';

// API configuration
const GOOGLE_VISION_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

// Claude prompt for receipt parsing
const RECEIPT_PARSE_PROMPT = `Analyze this receipt image and extract all information. Return a JSON object with this exact structure:

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
      "totalPrice": 5.99
    }
  ],
  "subtotal": 25.99 | null,
  "tax": 2.08 | null,
  "tip": 5.00 | null,
  "total": 33.07,
  "currency": "USD"
}

Important rules:
1. Extract ALL line items from the receipt
2. For quantity, default to 1 if not specified
3. Prices should be numbers without currency symbols
4. If you can't read a value clearly, use null
5. Do not guess or make up values
6. Include discounts as negative items
7. Only include actual purchased items, not section headers

Return ONLY the JSON object, no other text.`;

// Text parsing prompt for when we have raw OCR text
const TEXT_PARSE_PROMPT = `Parse this receipt text and extract structured data. The text was extracted via OCR and may have some errors.

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
      "totalPrice": 5.99
    }
  ],
  "subtotal": 25.99 | null,
  "tax": 2.08 | null,
  "tip": 5.00 | null,
  "total": 33.07,
  "currency": "USD"
}

Important rules:
1. Extract ALL line items from the receipt
2. For quantity, default to 1 if not specified
3. Prices should be numbers without currency symbols
4. If you can't read a value clearly, use null
5. Do not guess or make up values
6. Include discounts as negative items
7. Only include actual purchased items, not section headers

Return ONLY the JSON object, no other text.`;

/**
 * Extract text from image using Google Cloud Vision API
 */
export async function extractTextWithGoogleVision(
  imageBase64: string
): Promise<{ text: string; confidence: number }> {
  if (!GOOGLE_VISION_API_KEY) {
    throw new Error('Google Vision API key not configured');
  }

  const requestBody = {
    requests: [
      {
        image: {
          content: imageBase64,
        },
        features: [
          {
            type: 'TEXT_DETECTION',
            maxResults: 1,
          },
        ],
      },
    ],
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Vision API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.responses || !data.responses[0]) {
    throw new Error('No response from Google Vision API');
  }

  const result = data.responses[0];

  if (result.error) {
    throw new Error(`Google Vision error: ${result.error.message}`);
  }

  const fullText = result.fullTextAnnotation?.text || '';
  const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence || 0.8;

  return { text: fullText, confidence };
}

/**
 * Parse receipt using Claude Vision API (direct image analysis)
 */
export async function parseReceiptWithClaude(
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<OCRResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: RECEIPT_PARSE_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.content || !data.content[0] || data.content[0].type !== 'text') {
    throw new Error('Invalid response from Claude API');
  }

  const jsonText = data.content[0].text.trim();

  // Parse the JSON response
  let parsed;
  try {
    // Handle potential markdown code blocks
    const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${jsonText.substring(0, 200)}`);
  }

  return convertToOCRResult(parsed, 'claude');
}

/**
 * Parse receipt text using Claude (text-only, no image)
 */
export async function parseReceiptTextWithClaude(rawText: string): Promise<OCRResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const prompt = TEXT_PARSE_PROMPT.replace('{TEXT}', rawText);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.content || !data.content[0] || data.content[0].type !== 'text') {
    throw new Error('Invalid response from Claude API');
  }

  const jsonText = data.content[0].text.trim();

  let parsed;
  try {
    const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${jsonText.substring(0, 200)}`);
  }

  return convertToOCRResult(parsed, 'claude', rawText);
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
    })
  );

  const metadata: OCRExtractedMetadata = {
    merchantName: parsed.merchant?.name,
    merchantAddress: parsed.merchant?.address,
    date: parsed.date,
    subtotal: parsed.subtotal,
    tax: parsed.tax,
    tip: parsed.tip,
    total: parsed.total,
    currency: parsed.currency || 'USD',
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
 * Hybrid OCR: Use Google Vision for text extraction, Claude for parsing
 * This gives us fast extraction with high-quality semantic parsing
 */
export async function extractReceiptHybrid(imageBase64: string): Promise<OCRResult> {
  // First try Google Vision for fast text extraction
  let rawText: string | undefined;
  let googleConfidence = 0;

  if (GOOGLE_VISION_API_KEY) {
    try {
      const googleResult = await extractTextWithGoogleVision(imageBase64);
      rawText = googleResult.text;
      googleConfidence = googleResult.confidence;
    } catch (error) {
      console.warn('Google Vision extraction failed:', error);
    }
  }

  // If we have raw text, use Claude to parse it (cheaper than sending image)
  if (rawText && rawText.length > 50) {
    try {
      const result = await parseReceiptTextWithClaude(rawText);
      // Combine confidences
      result.confidence = (result.confidence + googleConfidence) / 2;
      return result;
    } catch (error) {
      console.warn('Claude text parsing failed:', error);
    }
  }

  // Fall back to Claude vision (direct image analysis)
  if (ANTHROPIC_API_KEY) {
    return parseReceiptWithClaude(imageBase64);
  }

  // If all else fails, try basic text parsing
  if (rawText) {
    return parseReceiptTextBasic(rawText);
  }

  throw new Error('No OCR provider available or configured');
}

/**
 * Basic receipt text parser (fallback when APIs unavailable)
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
    provider: 'google_vision', // Basic parser, but we got text from Google
  };
}

/**
 * Main entry point: Extract and parse receipt from image
 */
export async function processReceiptImage(
  imageUri: string
): Promise<OCRResult> {
  // Convert image URI to base64
  const response = await fetch(imageUri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const result = await extractReceiptHybrid(base64);
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
