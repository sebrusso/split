/**
 * Receipt Scanning Edge Function
 *
 * Processes receipt images using Google Gemini Vision API.
 * Keeps API keys secure on the server side.
 *
 * Usage:
 *   const { data, error } = await supabase.functions.invoke('scan-receipt', {
 *     body: { imageBase64, mediaType, mode }
 *   })
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Single-pass prompt: Extract and parse receipt in one call
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
   - Currency: infer from symbols ($=USD, \u20AC=EUR, \u00A3=GBP) or default to USD
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
  apiKey: string,
  imageBase64: string,
  prompt: string,
  mediaType: string = "image/jpeg"
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    throw new Error("Invalid response from Gemini API");
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Call Gemini API with text only (no image)
 */
async function callGeminiText(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    throw new Error("Invalid response from Gemini API");
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Parse JSON from model response, handling potential markdown code blocks
 */
function parseJsonResponse(text: string): Record<string, unknown> {
  const cleanText = text.trim();

  // Remove markdown code blocks if present
  let jsonText = cleanText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(jsonText);
  } catch (_e) {
    // Try to find JSON object in the response
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (_e2) {
        throw new Error(
          `Failed to parse response as JSON: ${cleanText.substring(0, 200)}`
        );
      }
    }
    throw new Error(
      `Failed to parse response as JSON: ${cleanText.substring(0, 200)}`
    );
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the API key from environment
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY not configured. Run: supabase secrets set GEMINI_API_KEY=your_key"
      );
    }

    // Parse request body
    const { imageBase64, mediaType = "image/jpeg", mode = "single_pass" } =
      await req.json();

    if (!imageBase64) {
      throw new Error("imageBase64 is required");
    }

    let parsed: Record<string, unknown>;
    let rawText: string | undefined;

    if (mode === "single_pass") {
      // Single-pass: Extract and parse in one call
      const responseText = await callGeminiVision(
        apiKey,
        imageBase64,
        SINGLE_PASS_PROMPT,
        mediaType
      );
      parsed = parseJsonResponse(responseText);
    } else {
      // Two-pass: Extract text first, then parse
      rawText = await callGeminiVision(
        apiKey,
        imageBase64,
        TEXT_EXTRACTION_PROMPT,
        mediaType
      );

      if (!rawText || rawText.trim().length < 20) {
        throw new Error("Failed to extract sufficient text from receipt image");
      }

      const parsePrompt = TEXT_PARSE_PROMPT.replace("{TEXT}", rawText);
      const responseText = await callGeminiText(apiKey, parsePrompt);
      parsed = parseJsonResponse(responseText);
    }

    // Return the parsed result
    return new Response(
      JSON.stringify({
        success: true,
        data: parsed,
        rawText,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("scan-receipt error:", message);

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
