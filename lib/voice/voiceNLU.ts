/**
 * Voice NLU Service
 *
 * Uses Google Gemini to parse voice transcripts into structured
 * claim intents, handling complex natural language patterns.
 */

import { ReceiptItem, Member } from '../types';
import {
  VoiceNLUResult,
  VoiceClaimIntent,
  UnmatchedReference,
  ConversationContext,
  ConversationTurn,
} from './types';
import {
  findBestItemMatch,
  findBestMemberMatch,
  isEveryoneReference,
  createItemSearcher,
  createMemberSearcher,
} from './itemMatcher';

// API configuration
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * NLU Prompt for parsing voice commands into claims
 */
function buildNLUPrompt(
  transcript: string,
  items: ReceiptItem[],
  members: Member[],
  currentMemberName: string,
  context?: ConversationContext
): string {
  const itemsList = items
    .filter((i) => !i.is_tax && !i.is_tip && !i.is_discount && i.quantity > 0)
    .map((i, idx) => `${idx + 1}. "${i.description}" - $${i.total_price.toFixed(2)}`)
    .join('\n');

  const membersList = members.map((m) => `- "${m.name}" (ID: ${m.id})`).join('\n');

  // Include conversation context for P1 features
  let contextSection = '';
  if (context && context.turns.length > 0) {
    const recentTurns = context.turns.slice(-3);
    contextSection = `
## Previous Conversation
${recentTurns.map((t) => `User: "${t.userInput}"\nAssistant: "${t.systemResponse}"`).join('\n\n')}

## Pending Claims (not yet confirmed)
${
  context.pendingClaims.length > 0
    ? context.pendingClaims.map((c) => `- ${c.spokenMember}: ${c.spokenReference}`).join('\n')
    : 'None'
}
`;
  }

  return `You are a receipt splitting assistant. Parse the user's voice command to extract who claimed which items.

## Receipt Items
${itemsList}

## Group Members
${membersList}
Note: "I", "me", "my" refers to "${currentMemberName}"

${contextSection}

## User's Voice Command
"${transcript}"

## Instructions
1. Parse the transcript to identify who claimed which items
2. Match spoken item names to receipt items (fuzzy match OK, e.g., "burger" → "Classic Cheeseburger")
3. Match spoken names to member names (fuzzy match OK)
4. Handle pronouns:
   - "I", "me", "my" = "${currentMemberName}"
   - "we", "everyone", "us" = split equally between all mentioned or all members
5. Handle corrections/undos:
   - "actually...", "wait...", "no...", "scratch that" = undo intent
   - "not X" or "X didn't have that" = undo for specific person
6. Handle splits:
   - "we split X" = equal split between mentioned people
   - "X and Y shared the Z" = split between X and Y
   - "split 3 ways" = divide equally by 3

Return ONLY valid JSON with this schema:
{
  "claims": [
    {
      "itemIndex": 1,
      "memberName": "string",
      "shareFraction": 1.0,
      "confidence": 0.95,
      "spokenItem": "what user said for item",
      "spokenMember": "what user said for member"
    }
  ],
  "unmatched": [
    {
      "spokenReference": "what couldn't be matched",
      "reason": "no_matching_item" | "ambiguous_item" | "ambiguous_member" | "unknown_member" | "unclear_quantity",
      "possibleMatches": ["option1", "option2"]
    }
  ],
  "undoIntent": {
    "type": "undo",
    "itemIndex": null,
    "memberName": null,
    "trigger": "what triggered the undo"
  } | null,
  "splitIntent": {
    "type": "split",
    "itemIndex": 1,
    "memberNames": ["name1", "name2"],
    "spokenReference": "the item"
  } | null,
  "response": "Natural confirmation message",
  "needsClarification": false,
  "proactivePrompt": null | "Who had the Caesar Salad and the Tiramisu?"
}

IMPORTANT:
- itemIndex is 1-based (matches the numbered list above)
- shareFraction is 0-1 (1.0 = full item, 0.5 = half, 0.333 = third)
- If multiple items mentioned, create multiple claims
- If ambiguous, set needsClarification: true and ask in response
- For remaining unclaimed items, suggest them in proactivePrompt
- Be conversational in the response`;
}

/**
 * Parse JSON response from Gemini, handling potential markdown
 */
function parseGeminiResponse(text: string): any {
  const cleanText = text.trim();

  // Remove markdown code blocks if present
  let jsonText = cleanText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    // Try to find JSON object in the response
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error(`Failed to parse Gemini response as JSON`);
      }
    }
    throw new Error(`Failed to parse Gemini response as JSON`);
  }
}

/**
 * Call Gemini API for NLU parsing
 */
async function callGeminiNLU(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API key not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your environment.'
    );
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent parsing
        maxOutputTokens: 2048,
      },
    }),
  });

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
 * Convert Gemini's parsed output to our VoiceClaimIntent format
 */
function convertToVoiceClaimIntents(
  parsed: any,
  items: ReceiptItem[],
  members: Member[],
  currentMemberId: string | null
): VoiceNLUResult {
  const claims: VoiceClaimIntent[] = [];
  const unmatched: UnmatchedReference[] = [];

  // Create searchers for fallback fuzzy matching
  const itemSearcher = createItemSearcher(items);
  const memberSearcher = createMemberSearcher(members);

  // Get filterable items (exclude special items)
  const regularItems = items.filter(
    (i) => !i.is_tax && !i.is_tip && !i.is_discount && i.quantity > 0
  );

  // Process claims
  for (const claim of parsed.claims || []) {
    // Find the item by index or fuzzy match
    let matchedItem: ReceiptItem | null = null;

    if (claim.itemIndex && claim.itemIndex >= 1 && claim.itemIndex <= regularItems.length) {
      matchedItem = regularItems[claim.itemIndex - 1];
    } else if (claim.spokenItem) {
      const fuzzyMatch = findBestItemMatch(claim.spokenItem, regularItems, itemSearcher);
      if (fuzzyMatch && fuzzyMatch.score <= 0.4) {
        matchedItem = fuzzyMatch.item;
      }
    }

    // Find the member by name or fuzzy match
    let matchedMember: Member | null = null;

    if (claim.memberName) {
      const exactMatch = members.find(
        (m) => m.name.toLowerCase() === claim.memberName.toLowerCase()
      );
      if (exactMatch) {
        matchedMember = exactMatch;
      } else {
        const fuzzyMatch = findBestMemberMatch(
          claim.memberName,
          members,
          currentMemberId,
          memberSearcher
        );
        if (fuzzyMatch && fuzzyMatch.score <= 0.3) {
          matchedMember = fuzzyMatch.member;
        }
      }
    }

    // Handle successful matches
    if (matchedItem && matchedMember) {
      claims.push({
        itemId: matchedItem.id,
        memberId: matchedMember.id,
        shareFraction: claim.shareFraction || 1.0,
        confidence: claim.confidence || 0.8,
        spokenReference: claim.spokenItem || matchedItem.description,
        spokenMember: claim.spokenMember || matchedMember.name,
      });
    } else {
      // Add to unmatched
      if (!matchedItem) {
        unmatched.push({
          spokenReference: claim.spokenItem || 'unknown item',
          reason: 'no_matching_item',
        });
      }
      if (!matchedMember) {
        unmatched.push({
          spokenReference: claim.memberName || claim.spokenMember || 'unknown person',
          reason: 'unknown_member',
        });
      }
    }
  }

  // Process Gemini's unmatched items
  for (const um of parsed.unmatched || []) {
    unmatched.push({
      spokenReference: um.spokenReference,
      reason: um.reason || 'no_matching_item',
      possibleMatches: um.possibleMatches,
    });
  }

  // Handle split intent
  let splitIntent = undefined;
  if (parsed.splitIntent) {
    const splitItem =
      parsed.splitIntent.itemIndex >= 1 && parsed.splitIntent.itemIndex <= regularItems.length
        ? regularItems[parsed.splitIntent.itemIndex - 1]
        : null;

    const splitMemberIds = (parsed.splitIntent.memberNames || [])
      .map((name: string) => {
        const match = members.find((m) => m.name.toLowerCase() === name.toLowerCase());
        return match?.id;
      })
      .filter(Boolean);

    if (splitItem && splitMemberIds.length >= 2) {
      splitIntent = {
        type: 'split' as const,
        itemId: splitItem.id,
        memberIds: splitMemberIds,
        spokenReference: parsed.splitIntent.spokenReference || splitItem.description,
      };
    }
  }

  // Handle undo intent
  let undoIntent = undefined;
  if (parsed.undoIntent) {
    undoIntent = {
      type: 'undo' as const,
      itemId: parsed.undoIntent.itemIndex
        ? regularItems[parsed.undoIntent.itemIndex - 1]?.id
        : undefined,
      memberId: parsed.undoIntent.memberName
        ? members.find((m) => m.name.toLowerCase() === parsed.undoIntent.memberName.toLowerCase())
            ?.id
        : undefined,
      trigger: parsed.undoIntent.trigger || 'user request',
    };
  }

  return {
    claims,
    unmatched,
    undoIntent,
    splitIntent,
    response: parsed.response || 'I processed your request.',
    needsClarification: parsed.needsClarification || unmatched.length > 0,
    proactivePrompt: parsed.proactivePrompt || undefined,
  };
}

/**
 * Main NLU function: Parse voice transcript into claim intents
 */
export async function parseVoiceCommand(
  transcript: string,
  items: ReceiptItem[],
  members: Member[],
  currentMemberId: string | null,
  context?: ConversationContext
): Promise<VoiceNLUResult> {
  // Find current member name
  const currentMember = members.find((m) => m.id === currentMemberId);
  const currentMemberName = currentMember?.name || 'Me';

  // Build and send prompt
  const prompt = buildNLUPrompt(transcript, items, members, currentMemberName, context);

  try {
    const responseText = await callGeminiNLU(prompt);
    const parsed = parseGeminiResponse(responseText);

    return convertToVoiceClaimIntents(parsed, items, members, currentMemberId);
  } catch (error) {
    console.error('Error parsing voice command:', error);

    // Return error result
    return {
      claims: [],
      unmatched: [
        {
          spokenReference: transcript,
          reason: 'no_matching_item',
        },
      ],
      response: "I had trouble understanding that. Could you try saying it differently?",
      needsClarification: true,
    };
  }
}

/**
 * Simple local parsing for common patterns (fallback when API unavailable)
 */
export function parseVoiceCommandLocal(
  transcript: string,
  items: ReceiptItem[],
  members: Member[],
  currentMemberId: string | null
): VoiceNLUResult {
  const claims: VoiceClaimIntent[] = [];
  const unmatched: UnmatchedReference[] = [];

  const regularItems = items.filter(
    (i) => !i.is_tax && !i.is_tip && !i.is_discount && i.quantity > 0
  );

  // Simple pattern: "[Name] had/got [item]"
  const claimPattern = /(\w+(?:\s+\w+)?)\s+(?:had|got|ordered)\s+(?:the\s+)?([^,\.]+)/gi;
  let match;

  while ((match = claimPattern.exec(transcript)) !== null) {
    const spokenMember = match[1];
    const spokenItem = match[2];

    const memberMatch = findBestMemberMatch(spokenMember, members, currentMemberId);
    const itemMatch = findBestItemMatch(spokenItem, regularItems);

    if (memberMatch && itemMatch) {
      claims.push({
        itemId: itemMatch.item.id,
        memberId: memberMatch.member.id,
        shareFraction: 1.0,
        confidence: 0.7,
        spokenReference: spokenItem,
        spokenMember: spokenMember,
      });
    } else {
      if (!itemMatch) {
        unmatched.push({
          spokenReference: spokenItem,
          reason: 'no_matching_item',
        });
      }
      if (!memberMatch) {
        unmatched.push({
          spokenReference: spokenMember,
          reason: 'unknown_member',
        });
      }
    }
  }

  // Check for split pattern
  if (isEveryoneReference(transcript)) {
    // Handle "we split everything" or "split evenly"
    return {
      claims: [],
      unmatched: [],
      splitIntent: undefined,
      response: 'Would you like to split all items evenly between everyone?',
      needsClarification: true,
    };
  }

  const response =
    claims.length > 0
      ? `Got it! ${claims.map((c) => `${c.spokenMember} had ${c.spokenReference}`).join(', ')}.`
      : "I couldn't understand that. Try saying something like 'I had the burger' or 'Drew got the salmon'.";

  return {
    claims,
    unmatched,
    response,
    needsClarification: claims.length === 0 || unmatched.length > 0,
  };
}

// ============================================
// Conversation Context Management (P1)
// ============================================

/**
 * Create a new empty conversation context
 */
export function createConversationContext(): ConversationContext {
  return {
    turns: [],
    pendingClaims: [],
    mentionedItems: new Set(),
    mentionedMembers: new Set(),
  };
}

/**
 * Add a turn to the conversation context
 */
export function addConversationTurn(
  context: ConversationContext,
  userInput: string,
  parsedIntents: VoiceClaimIntent[],
  systemResponse: string
): ConversationContext {
  const turn: ConversationTurn = {
    userInput,
    parsedIntents,
    systemResponse,
    timestamp: Date.now(),
  };

  // Update mentioned items and members
  const mentionedItems = new Set(context.mentionedItems);
  const mentionedMembers = new Set(context.mentionedMembers);

  for (const intent of parsedIntents) {
    mentionedItems.add(intent.itemId);
    mentionedMembers.add(intent.memberId);
  }

  return {
    turns: [...context.turns, turn],
    pendingClaims: [...context.pendingClaims, ...parsedIntents],
    mentionedItems,
    mentionedMembers,
  };
}

/**
 * Clear pending claims (after confirmation)
 */
export function clearPendingClaims(context: ConversationContext): ConversationContext {
  return {
    ...context,
    pendingClaims: [],
  };
}

/**
 * Generate proactive prompt for remaining items
 */
export function generateProactivePrompt(
  items: ReceiptItem[],
  claims: VoiceClaimIntent[],
  existingClaims: Set<string>
): string | undefined {
  const regularItems = items.filter(
    (i) => !i.is_tax && !i.is_tip && !i.is_discount && i.quantity > 0
  );

  // Get items that are not yet claimed
  const claimedItemIds = new Set([...claims.map((c) => c.itemId), ...existingClaims]);
  const unclaimedItems = regularItems.filter((i) => !claimedItemIds.has(i.id));

  if (unclaimedItems.length === 0) {
    return undefined;
  }

  if (unclaimedItems.length <= 3) {
    const itemNames = unclaimedItems.map((i) => i.description).join(', ');
    return `Who had the ${itemNames}?`;
  }

  return `${unclaimedItems.length} items remaining. Who had those?`;
}
