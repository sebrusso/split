# Receipt-Based Bill Splitting: Technical Architecture & UX Design

## Overview

This document explores the technical architecture and user experience design for split it.'s vision feature: photograph a receipt, extract items via OCR, let friends claim their items, and automatically calculate each person's share including tax and tip.

---

## Part 1: Technical Architecture

### 1.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   iOS/Android   │   iMessage      │   Web App       │   Share Extension     │
│   React Native  │   Extension     │   React         │   (iOS)               │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                     │
         └─────────────────┴─────────────────┴─────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                        │
│                     (Supabase Edge Functions)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│  Receipt OCR    │      │   Core Database     │      │  Payment Links  │
│  Service        │      │   (PostgreSQL)      │      │  Generator      │
│                 │      │                     │      │                 │
│  - Google Vision│      │  - receipts         │      │  - Venmo URLs   │
│  - GPT-4V       │      │  - receipt_items    │      │  - PayPal.me    │
│  - Claude       │      │  - item_claims      │      │  - Cash App     │
│  - Textract     │      │  - settlements      │      │  - Zelle        │
└─────────────────┘      └─────────────────────┘      └─────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Realtime Sync      │
                         │  (Supabase)         │
                         │                     │
                         │  - Item claims      │
                         │  - Status updates   │
                         │  - Notifications    │
                         └─────────────────────┘
```

### 1.2 Database Schema

```sql
-- Receipt uploaded by a user
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES members(id),

  -- Original image
  image_url TEXT NOT NULL,
  image_thumbnail_url TEXT,

  -- OCR results
  ocr_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  ocr_provider TEXT, -- 'google_vision', 'gpt4v', 'claude', 'textract'
  ocr_raw_response JSONB,
  ocr_confidence DECIMAL(3,2), -- 0.00 to 1.00

  -- Extracted metadata
  merchant_name TEXT,
  merchant_address TEXT,
  receipt_date DATE,
  subtotal DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  tip_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',

  -- Status
  status TEXT DEFAULT 'draft', -- draft, claiming, settled, archived
  claim_deadline TIMESTAMPTZ, -- optional deadline for claims

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual line items extracted from receipt
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,

  -- Item details
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2) NOT NULL,

  -- OCR metadata
  original_text TEXT, -- raw OCR text before parsing
  confidence DECIMAL(3,2),
  bounding_box JSONB, -- coordinates on receipt image

  -- Ordering
  line_number INTEGER,

  -- Status
  is_tax BOOLEAN DEFAULT FALSE,
  is_tip BOOLEAN DEFAULT FALSE,
  is_discount BOOLEAN DEFAULT FALSE,
  is_subtotal BOOLEAN DEFAULT FALSE,
  is_total BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims: who is responsible for which items
CREATE TABLE item_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_item_id UUID REFERENCES receipt_items(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,

  -- Claim type
  claim_type TEXT DEFAULT 'full', -- 'full', 'split', 'partial'
  share_fraction DECIMAL(5,4) DEFAULT 1.0, -- for split claims (0.5 = half)
  share_amount DECIMAL(10,2), -- calculated amount for this claim

  -- For items split by multiple people
  split_count INTEGER DEFAULT 1, -- how many ways this item is split

  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_via TEXT, -- 'app', 'imessage', 'web', 'assigned'

  UNIQUE(receipt_item_id, member_id)
);

-- Calculated totals per member (materialized for performance)
CREATE TABLE receipt_member_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,

  items_total DECIMAL(10,2) DEFAULT 0,
  tax_share DECIMAL(10,2) DEFAULT 0,
  tip_share DECIMAL(10,2) DEFAULT 0,
  grand_total DECIMAL(10,2) DEFAULT 0,

  -- Settlement
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  settlement_id UUID REFERENCES settlements(id),

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(receipt_id, member_id)
);

-- Indexes for performance
CREATE INDEX idx_receipts_group ON receipts(group_id);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX idx_item_claims_item ON item_claims(receipt_item_id);
CREATE INDEX idx_item_claims_member ON item_claims(member_id);
CREATE INDEX idx_receipt_totals_receipt ON receipt_member_totals(receipt_id);
```

### 1.3 OCR Service Architecture

#### Option A: Google Cloud Vision API (Recommended for MVP)

**Pros:**
- Best-in-class text detection
- Supports 100+ languages
- Good at handling skewed/rotated receipts
- Relatively affordable ($1.50 per 1000 images)

**Cons:**
- Returns raw text, requires parsing logic
- No semantic understanding of receipts

```typescript
// lib/ocr/google-vision.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';

interface OCRResult {
  rawText: string;
  items: ParsedItem[];
  metadata: ReceiptMetadata;
  confidence: number;
}

export async function extractReceiptData(imageUrl: string): Promise<OCRResult> {
  const client = new ImageAnnotatorClient();

  const [result] = await client.textDetection(imageUrl);
  const fullText = result.fullTextAnnotation?.text || '';

  // Parse the raw text into structured data
  const parsed = parseReceiptText(fullText);

  return {
    rawText: fullText,
    items: parsed.items,
    metadata: parsed.metadata,
    confidence: calculateConfidence(result),
  };
}
```

#### Option B: GPT-4 Vision / Claude (Best Accuracy)

**Pros:**
- Semantic understanding of receipts
- Can handle edge cases intelligently
- Returns structured data directly
- Better at inferring missing data

**Cons:**
- Higher cost (~$0.01-0.03 per image)
- Slower (2-5 seconds vs 0.5-1 second)
- Rate limits

```typescript
// lib/ocr/llm-vision.ts
import Anthropic from '@anthropic-ai/sdk';

const RECEIPT_PROMPT = `Analyze this receipt image and extract:
1. Merchant name and address
2. Date of purchase
3. All line items with: description, quantity, unit price, total price
4. Subtotal, tax, tip (if present), and grand total
5. Currency

Return as JSON in this exact format:
{
  "merchant": { "name": string, "address": string | null },
  "date": "YYYY-MM-DD" | null,
  "items": [{ "description": string, "quantity": number, "unitPrice": number, "totalPrice": number }],
  "subtotal": number,
  "tax": number | null,
  "tip": number | null,
  "total": number,
  "currency": "USD" | string
}

If you cannot read a value clearly, use null. Do not guess.`;

export async function extractWithClaude(imageBase64: string): Promise<OCRResult> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
        },
        { type: 'text', text: RECEIPT_PROMPT },
      ],
    }],
  });

  return JSON.parse(response.content[0].text);
}
```

#### Option C: Hybrid Approach (Recommended for Production)

Use Google Vision for fast text extraction, then GPT-4/Claude for parsing and validation:

```typescript
// lib/ocr/hybrid.ts
export async function extractReceiptHybrid(imageUrl: string): Promise<OCRResult> {
  // Step 1: Fast OCR with Google Vision
  const rawText = await googleVisionExtract(imageUrl);

  // Step 2: Semantic parsing with LLM
  const structured = await parseWithLLM(rawText, imageUrl);

  // Step 3: Validation and confidence scoring
  const validated = validateAndScore(structured, rawText);

  return validated;
}
```

### 1.4 Edge Function for Receipt Processing

```typescript
// supabase/functions/process-receipt/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  const { receiptId, imageUrl } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Update status to processing
  await supabase
    .from('receipts')
    .update({ ocr_status: 'processing' })
    .eq('id', receiptId);

  try {
    // Extract data using hybrid approach
    const ocrResult = await extractReceiptHybrid(imageUrl);

    // Update receipt with metadata
    await supabase
      .from('receipts')
      .update({
        ocr_status: 'completed',
        ocr_raw_response: ocrResult,
        ocr_confidence: ocrResult.confidence,
        merchant_name: ocrResult.metadata.merchant,
        receipt_date: ocrResult.metadata.date,
        subtotal: ocrResult.metadata.subtotal,
        tax_amount: ocrResult.metadata.tax,
        total_amount: ocrResult.metadata.total,
      })
      .eq('id', receiptId);

    // Insert line items
    const items = ocrResult.items.map((item, idx) => ({
      receipt_id: receiptId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      line_number: idx + 1,
      confidence: item.confidence,
    }));

    await supabase.from('receipt_items').insert(items);

    // Notify group members
    await notifyGroupMembers(receiptId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    await supabase
      .from('receipts')
      .update({ ocr_status: 'failed' })
      .eq('id', receiptId);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### 1.5 Real-time Item Claiming

```typescript
// lib/hooks/useReceiptClaims.ts
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function useReceiptClaims(receiptId: string) {
  const [claims, setClaims] = useState<ItemClaim[]>([]);
  const [items, setItems] = useState<ReceiptItem[]>([]);

  useEffect(() => {
    // Initial fetch
    fetchReceiptData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`receipt:${receiptId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_claims',
          filter: `receipt_item_id=in.(${items.map(i => i.id).join(',')})`,
        },
        (payload) => {
          handleClaimChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [receiptId]);

  const claimItem = async (itemId: string, memberId: string, splitCount = 1) => {
    const { error } = await supabase.from('item_claims').upsert({
      receipt_item_id: itemId,
      member_id: memberId,
      split_count: splitCount,
      share_fraction: 1 / splitCount,
      claimed_via: 'app',
    });

    if (!error) {
      await recalculateTotals(receiptId);
    }
  };

  return { items, claims, claimItem };
}
```

### 1.6 Tax and Tip Distribution Algorithm

```typescript
// lib/utils/receipt-calculations.ts

interface MemberTotal {
  memberId: string;
  itemsTotal: number;
  taxShare: number;
  tipShare: number;
  grandTotal: number;
}

export function calculateMemberTotals(
  receipt: Receipt,
  items: ReceiptItem[],
  claims: ItemClaim[]
): MemberTotal[] {
  // Step 1: Calculate each member's items total
  const memberItemTotals = new Map<string, number>();

  for (const claim of claims) {
    const item = items.find(i => i.id === claim.receiptItemId);
    if (!item || item.isTax || item.isTip) continue;

    const claimAmount = item.totalPrice * claim.shareFraction;
    const current = memberItemTotals.get(claim.memberId) || 0;
    memberItemTotals.set(claim.memberId, current + claimAmount);
  }

  // Step 2: Calculate subtotal from claims (for proportional distribution)
  const claimedSubtotal = Array.from(memberItemTotals.values())
    .reduce((sum, val) => sum + val, 0);

  // Step 3: Distribute tax proportionally based on items claimed
  const taxAmount = receipt.taxAmount || 0;
  const tipAmount = receipt.tipAmount || 0;

  const totals: MemberTotal[] = [];

  for (const [memberId, itemsTotal] of memberItemTotals) {
    // Proportional share of tax and tip
    const proportion = claimedSubtotal > 0 ? itemsTotal / claimedSubtotal : 0;
    const taxShare = roundCurrency(taxAmount * proportion);
    const tipShare = roundCurrency(tipAmount * proportion);

    totals.push({
      memberId,
      itemsTotal: roundCurrency(itemsTotal),
      taxShare,
      tipShare,
      grandTotal: roundCurrency(itemsTotal + taxShare + tipShare),
    });
  }

  // Step 4: Handle rounding discrepancies
  const calculatedTotal = totals.reduce((sum, t) => sum + t.grandTotal, 0);
  const actualTotal = receipt.totalAmount || (claimedSubtotal + taxAmount + tipAmount);
  const discrepancy = roundCurrency(actualTotal - calculatedTotal);

  if (Math.abs(discrepancy) > 0 && totals.length > 0) {
    // Add/subtract penny discrepancy to person who paid the most
    totals.sort((a, b) => b.grandTotal - a.grandTotal);
    totals[0].grandTotal = roundCurrency(totals[0].grandTotal + discrepancy);
  }

  return totals;
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
```

---

## Part 2: UX Design Exploration

### 2.1 Core User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RECEIPT SPLITTING FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
  │  UPLOAD  │ ───▶ │  REVIEW  │ ───▶ │  CLAIM   │ ───▶ │  SETTLE  │
  └──────────┘      └──────────┘      └──────────┘      └──────────┘
       │                 │                 │                 │
       ▼                 ▼                 ▼                 ▼
  Take photo or    Verify OCR       Friends select    Pay via Venmo,
  select from      extracted        their items       PayPal, etc.
  gallery          items correctly  (in-app or msg)
```

### 2.2 UX Option A: In-App Flow (Default)

**Scenario:** Dinner with friends, everyone has the app

```
┌─────────────────────────────────────┐
│ 📸 Scan Receipt                     │
│─────────────────────────────────────│
│                                     │
│    ┌─────────────────────────┐     │
│    │                         │     │
│    │    [Camera Viewfinder]  │     │
│    │                         │     │
│    │     ╔═══════════════╗   │     │
│    │     ║   RECEIPT     ║   │     │
│    │     ║   DETECTED    ║   │     │
│    │     ╚═══════════════╝   │     │
│    │                         │     │
│    └─────────────────────────┘     │
│                                     │
│  [ Take Photo ]  [ From Gallery ]   │
└─────────────────────────────────────┘

         ▼ After OCR processing

┌─────────────────────────────────────┐
│ 🧾 Review Items           [Edit ✏️] │
│─────────────────────────────────────│
│ Joe's Diner - Jan 10, 2026          │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Burger Deluxe            $18.99 │ │
│ │ Fish & Chips             $16.50 │ │
│ │ Caesar Salad             $12.00 │ │
│ │ Margherita Pizza         $22.00 │ │
│ │ 2x Craft Beer             $9.00 │ │
│ │ 1x Soda                   $3.50 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Subtotal                    $81.99  │
│ Tax (8.5%)                   $6.97  │
│ Tip (20%)                   $16.40  │
│ ─────────────────────────────────── │
│ TOTAL                      $105.36  │
│                                     │
│        [ Start Claiming → ]         │
└─────────────────────────────────────┘

         ▼ Claiming phase

┌─────────────────────────────────────┐
│ 🍽️ Who had what?                    │
│─────────────────────────────────────│
│ Tap items to claim • Hold to split  │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Burger Deluxe        $18.99   │   │
│ │ 🔵 You                        │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Fish & Chips         $16.50   │   │
│ │ 🟢 Sarah                      │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Caesar Salad         $12.00   │   │
│ │ ⚪ Unclaimed                  │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Margherita Pizza     $22.00   │   │
│ │ 🔵 You  🟢 Sarah  (split 2)   │   │
│ └───────────────────────────────┘   │
│                                     │
│ ─────────────────────────────────── │
│ 👤 You:     $29.99 + tax/tip        │
│ 👤 Sarah:   $27.50 + tax/tip        │
│ ⚪ Unclaimed: $12.00                │
│                                     │
│  [ Remind Unclaimed ]  [ Finalize ] │
└─────────────────────────────────────┘
```

**Pros:**
- Full control over the experience
- Real-time updates via Supabase Realtime
- Rich interactions (drag to split, swipe to remove)

**Cons:**
- Requires everyone to have the app installed
- Context switching from messaging

---

### 2.3 UX Option B: iMessage Extension (Your Idea - High Potential)

**This is genuinely compelling.** Most bill-splitting happens after a meal when everyone is still together, often coordinating via group chat.

#### Architecture for iMessage Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        iMESSAGE EXTENSION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

  iOS App                    iMessage Extension              Backend
  ───────                    ──────────────────              ───────
     │                              │                           │
     │   1. User uploads receipt    │                           │
     │   in main app                │                           │
     │ ─────────────────────────────┼──────────────────────────▶│
     │                              │         Process OCR       │
     │                              │◀──────────────────────────│
     │                              │                           │
     │   2. "Share to iMessage"     │                           │
     │ ────────────────────────────▶│                           │
     │                              │                           │
     │                              │   3. Sends interactive    │
     │                              │   message to group chat   │
     │                              │ ─────────────────────────▶│
     │                              │                           │
     │                              │   4. Friends tap message  │
     │                              │   to expand and claim     │
     │                              │◀─────────────────────────│
     │                              │                           │
     │                              │   5. Claims sync to       │
     │                              │   backend in real-time    │
     │                              │ ─────────────────────────▶│
     │                              │                           │
```

#### iMessage UI Concept

```
┌─────────────────────────────────────┐
│ Dinner Group Chat     ···           │
│─────────────────────────────────────│
│                                     │
│         That was fun! 🎉            │
│                           [8:45 PM] │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🧾 split it. Receipt            │ │
│ │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│ │
│ │ Joe's Diner                     │ │
│ │ Total: $105.36                  │ │
│ │                                 │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ Tap to claim your items     │ │ │
│ │ │                             │ │ │
│ │ │ 📋 6 items • 0/4 claimed    │ │ │
│ │ └─────────────────────────────┘ │ │
│ │                                 │ │
│ │        [ Open Receipt ]         │ │
│ └─────────────────────────────────┘ │
│ [You] sent a receipt    [8:47 PM]   │
│                                     │
│                                     │
│    Sarah is claiming items...       │
│                           [8:48 PM] │
│                                     │
└─────────────────────────────────────┘

      ▼ Tapping "Open Receipt"

┌─────────────────────────────────────┐
│ split it.              [Done]       │
│─────────────────────────────────────│
│                                     │
│ Joe's Diner                         │
│ Tap your items to claim them        │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ ☑️ Burger Deluxe      $18.99  │   │
│ │    Claimed by You             │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ ☑️ Fish & Chips       $16.50  │   │
│ │    Claimed by Sarah           │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ ☐ Caesar Salad        $12.00  │   │
│ │    Tap to claim               │   │
│ └───────────────────────────────┘   │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Your total: $24.67                  │
│ (Items + tax + tip share)           │
│                                     │
│      [ Pay via Venmo → ]            │
└─────────────────────────────────────┘
```

#### Implementation Details

```swift
// iOS/split it. Messages/MessagesViewController.swift

import Messages
import UIKit

class MessagesViewController: MSMessagesAppViewController {

    var receiptId: String?
    var items: [ReceiptItem] = []

    override func willBecomeActive(with conversation: MSConversation) {
        // Check if we're opening an existing receipt message
        if let message = conversation.selectedMessage,
           let url = message.url {
            receiptId = extractReceiptId(from: url)
            loadReceipt()
        }
    }

    func loadReceipt() {
        guard let receiptId = receiptId else { return }

        // Fetch from Supabase
        Task {
            let receipt = await SupabaseClient.shared.fetchReceipt(id: receiptId)
            let items = await SupabaseClient.shared.fetchReceiptItems(receiptId: receiptId)

            DispatchQueue.main.async {
                self.items = items
                self.updateUI()
            }
        }
    }

    func claimItem(_ item: ReceiptItem) {
        guard let conversation = activeConversation else { return }

        // Get participant identifier (anonymous in iMessage)
        let participantId = conversation.localParticipantIdentifier

        Task {
            await SupabaseClient.shared.claimItem(
                itemId: item.id,
                participantId: participantId.uuidString,
                claimedVia: "imessage"
            )

            // Update the message to show claim status
            sendUpdatedMessage(conversation: conversation)
        }
    }

    func sendUpdatedMessage(conversation: MSConversation) {
        let layout = MSMessageTemplateLayout()
        layout.image = generateReceiptPreview()
        layout.caption = "Receipt from \(merchantName)"
        layout.subcaption = "\(claimedCount)/\(totalItems) items claimed"

        let message = MSMessage(session: conversation.selectedMessage?.session ?? MSSession())
        message.layout = layout
        message.url = URL(string: "splitfree://receipt/\(receiptId!)")

        conversation.insert(message) { error in
            if let error = error {
                print("Failed to send message: \(error)")
            }
        }
    }
}
```

**Pros:**
- Zero friction for claiming - no app install required for friends
- Natural integration with existing social behavior
- Updates visible to everyone in real-time
- Can include non-app users (they see a preview, link to web)

**Cons:**
- iOS only (Android users need fallback)
- Apple's iMessage extension limitations (compact/expanded modes)
- Complex development (separate target, shared data layer)
- User identity mapping is tricky (iMessage participants are anonymous)

---

### 2.4 UX Option C: Web Link in Group Chat (Universal)

For maximum reach, generate a shareable web link that works in any messaging app.

```
┌─────────────────────────────────────┐
│ Group Chat (Any Platform)           │
│─────────────────────────────────────│
│                                     │
│ You: Here's the bill! Claim your    │
│ items: split.free/r/X7kM9p         │
│                           [8:47 PM] │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🧾 Receipt from Joe's Diner     │ │
│ │ $105.36 • 6 items               │ │
│ │ Tap to claim your items         │ │
│ │                                 │ │
│ │ [Open Graph Preview Image]      │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

#### Web Claiming Interface (PWA)

```
┌─────────────────────────────────────┐
│ 🧾 split it.                        │
│─────────────────────────────────────│
│                                     │
│ Joe's Diner                         │
│ Jan 10, 2026                        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ What's your name?               │ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ Sarah                       │ │ │
│ │ └─────────────────────────────┘ │ │
│ │          [ Continue → ]         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─── or sign in for saved data ───   │
│                                     │
│ [ Continue with Apple ]             │
│ [ Continue with Google ]            │
│                                     │
└─────────────────────────────────────┘

         ▼ After entering name

┌─────────────────────────────────────┐
│ 🧾 Joe's Diner         Hi, Sarah 👋│
│─────────────────────────────────────│
│                                     │
│ Tap the items you ordered:          │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Burger Deluxe        $18.99   │   │
│ │ 🔵 Mike                       │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ ✅ Fish & Chips      $16.50   │   │
│ │ 🟢 You (Sarah)                │   │
│ └───────────────────────────────┘   │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ Caesar Salad         $12.00   │   │
│ │ Tap to claim                  │   │
│ └───────────────────────────────┘   │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                     │
│ Your Total: $21.47                  │
│ Items ($16.50) + Tax ($1.40)        │
│ + Tip Share ($3.57)                 │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │   Pay Mike $21.47              │ │
│ │                                 │ │
│ │ [Venmo] [PayPal] [Cash App]    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📱 Get the app for easier splits    │
└─────────────────────────────────────┘
```

**Pros:**
- Works everywhere (iOS, Android, desktop)
- No app install required
- Great Open Graph previews for link sharing
- Can convert web users to app users

**Cons:**
- Requires name entry (slight friction)
- No push notifications for updates
- Less "magical" than native integrations

---

### 2.5 UX Option D: Share Sheet + Deep Links (Hybrid)

Combine native Share Sheet on iOS/Android with deep links for the best of both worlds.

```
┌─────────────────────────────────────┐
│ 📤 Share Receipt                    │
│─────────────────────────────────────│
│                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ 💬  │ │ ✉️  │ │ 📱  │ │ 🔗  │   │
│  │Msgs │ │Mail │ │WhApp│ │Copy │   │
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🧾 Send receipt link        │    │
│  │    Anyone can claim items   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 👥 Assign to group members  │    │
│  │    Pre-fill for your group  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📷 Share receipt image      │    │
│  │    With QR code overlay     │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

---

### 2.6 Payment Integration: The Final Mile

Making payment frictionless is critical. Options:

#### A. Deep Links to Payment Apps

```typescript
// lib/payments/deep-links.ts

interface PaymentLink {
  provider: 'venmo' | 'paypal' | 'cashapp' | 'zelle';
  url: string;
  fallbackUrl: string;
}

export function generatePaymentLinks(
  payeeUsername: string,
  amount: number,
  note: string
): PaymentLink[] {
  const encodedNote = encodeURIComponent(note);

  return [
    {
      provider: 'venmo',
      // venmo://paycharge?txn=pay&recipients=username&amount=10.00&note=Dinner
      url: `venmo://paycharge?txn=pay&recipients=${payeeUsername}&amount=${amount}&note=${encodedNote}`,
      fallbackUrl: `https://venmo.com/${payeeUsername}?txn=pay&amount=${amount}&note=${encodedNote}`,
    },
    {
      provider: 'paypal',
      url: `https://paypal.me/${payeeUsername}/${amount}`,
      fallbackUrl: `https://paypal.me/${payeeUsername}/${amount}`,
    },
    {
      provider: 'cashapp',
      // cashapp://cash.app/$cashtag/10.00
      url: `cashapp://cash.app/$${payeeUsername}/${amount}`,
      fallbackUrl: `https://cash.app/$${payeeUsername}/${amount}`,
    },
  ];
}
```

#### B. Request Money Flow

```
┌─────────────────────────────────────┐
│ 💸 Request Payment                  │
│─────────────────────────────────────│
│                                     │
│ From: Sarah                         │
│ Amount: $21.47                      │
│ For: Joe's Diner (Fish & Chips)     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ How do you want to be paid?     │ │
│ │                                 │ │
│ │ [ Venmo: @mike_smith ]          │ │
│ │ [ PayPal: mike@email.com ]      │ │
│ │ [ Cash App: $mikesmith ]        │ │
│ │ [ Just remind them ]            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Sarah will receive:                 │
│ "Mike requests $21.47 for dinner    │
│  at Joe's Diner. Pay here: [link]"  │
│                                     │
│          [ Send Request ]           │
└─────────────────────────────────────┘
```

---

### 2.7 Recommended UX Strategy

Based on the analysis, here's my recommended phased approach:

#### Phase 1: MVP (Web Links)
1. Receipt upload and OCR in main app
2. Generate shareable web links
3. Web-based claiming interface
4. Deep links to payment apps

**Why:** Maximum reach, lowest development cost, validates the concept.

#### Phase 2: Native Enhancement
1. iOS Share Sheet extension
2. iMessage app (compact preview)
3. Android Nearby Share integration
4. Push notifications for claim updates

**Why:** Better UX for users who have the app, increases engagement.

#### Phase 3: Full iMessage Integration
1. Full iMessage extension with claiming UI
2. Real-time updates in chat
3. Inline payment requests
4. Identity linking (iMessage ↔ split it. account)

**Why:** The "magical" experience, but requires significant investment.

---

## Part 3: Key Technical Decisions

### 3.1 OCR Provider Recommendation

| Provider | Cost | Accuracy | Speed | Recommendation |
|----------|------|----------|-------|----------------|
| Google Vision | $1.50/1K | 85% | 0.5s | MVP |
| Claude Vision | $0.02/img | 95% | 3s | Production |
| GPT-4 Vision | $0.02/img | 93% | 2s | Alternative |
| AWS Textract | $1.50/1K | 88% | 1s | Enterprise |

**Recommendation:** Start with Google Vision for MVP, add Claude as a fallback for low-confidence results.

### 3.2 Real-time Architecture

Use Supabase Realtime for claim synchronization:

```typescript
// Enable realtime on item_claims table
alter table item_claims replica identity full;

// Client subscription
const channel = supabase
  .channel('receipt-claims')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'item_claims'
  }, handleChange)
  .subscribe();
```

### 3.3 Identity Mapping Challenge

When users claim via web or iMessage without an account:

```sql
-- Anonymous claims with optional linking
CREATE TABLE anonymous_claims (
  id UUID PRIMARY KEY,
  receipt_item_id UUID REFERENCES receipt_items(id),

  -- Anonymous identifier
  display_name TEXT NOT NULL,
  session_token TEXT NOT NULL,

  -- For later account linking
  linked_member_id UUID REFERENCES members(id),
  linked_at TIMESTAMPTZ,

  -- Source tracking
  claimed_via TEXT, -- 'web', 'imessage'
  imessage_participant_id TEXT, -- for iMessage identity

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Part 4: Open Questions

1. **OCR Accuracy vs Cost:** Should we let users manually edit OCR results, or invest in higher accuracy?

2. **Split Items UX:** How do we handle items split 3+ ways? Drag and drop? Numeric input?

3. **Unclaimed Items:** How long do we wait? Auto-remind? Allow payer to assign?

4. **Multiple Receipts:** What if dinner has separate checks? Merge into one session?

5. **International:** Tax calculation varies by country. Do we need location-aware logic?

6. **Privacy:** Should receipt images be stored permanently or deleted after processing?

7. **Disputes:** What if someone claims they didn't order something? Dispute flow?

---

## Appendix: Competitive Analysis

| Feature | Splitwise | Tab | split it. (Proposed) |
|---------|-----------|-----|----------------------|
| Receipt OCR | ❌ | ✅ | ✅ |
| Item claiming | ❌ | ✅ | ✅ |
| iMessage integration | ❌ | ❌ | ✅ (planned) |
| Web claiming | ❌ | ❌ | ✅ |
| Payment deep links | ❌ | ✅ | ✅ |
| Free tier limits | ❌ Limited | ✅ Free | ✅ Free |

---

## Next Steps

1. **Prototype OCR pipeline** - Test Google Vision + Claude hybrid
2. **Design claiming UI** - Figma prototypes for in-app and web
3. **Build web claiming MVP** - React app at split.free/r/:id
4. **Validate with users** - Test with real receipts and friend groups
5. **Evaluate iMessage effort** - Spike on iOS extension development
