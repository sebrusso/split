/**
 * Fuzzy Item Matching Utility
 *
 * Uses Fuse.js for fuzzy string matching to match spoken item
 * references to OCR-extracted receipt items.
 */

import Fuse from 'fuse.js';
import { ReceiptItem, Member } from '../types';
import { ItemMatchResult, MemberMatchResult } from './types';

// ============================================
// Item Matching
// ============================================

/**
 * Create a Fuse instance for item searching
 */
export function createItemSearcher(items: ReceiptItem[]): Fuse<ReceiptItem> {
  return new Fuse(items, {
    keys: [
      { name: 'description', weight: 0.7 },
      { name: 'original_text', weight: 0.3 },
    ],
    threshold: 0.4, // Allow fairly fuzzy matches
    distance: 100,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    useExtendedSearch: false,
    minMatchCharLength: 2,
  });
}

/**
 * Find the best matching item for a spoken reference
 */
export function findBestItemMatch(
  spokenReference: string,
  items: ReceiptItem[],
  existingSearcher?: Fuse<ReceiptItem>
): ItemMatchResult | null {
  if (!spokenReference || items.length === 0) {
    return null;
  }

  // Normalize the spoken reference
  const normalized = normalizeItemReference(spokenReference);

  const searcher = existingSearcher || createItemSearcher(items);
  const results = searcher.search(normalized);

  if (results.length === 0) {
    return null;
  }

  const best = results[0];
  return {
    item: best.item,
    score: best.score || 0,
    matchedOn: best.matches?.[0]?.key === 'original_text' ? 'original_text' : 'description',
  };
}

/**
 * Find all possible item matches (for ambiguous cases)
 */
export function findAllItemMatches(
  spokenReference: string,
  items: ReceiptItem[],
  maxResults: number = 5,
  threshold: number = 0.5
): ItemMatchResult[] {
  if (!spokenReference || items.length === 0) {
    return [];
  }

  const normalized = normalizeItemReference(spokenReference);
  const searcher = createItemSearcher(items);
  const results = searcher.search(normalized);

  return results
    .filter((r) => (r.score || 0) <= threshold)
    .slice(0, maxResults)
    .map((r) => ({
      item: r.item,
      score: r.score || 0,
      matchedOn: r.matches?.[0]?.key === 'original_text' ? 'original_text' : 'description',
    }));
}

/**
 * Check if an item match is confident enough to use
 */
export function isConfidentItemMatch(result: ItemMatchResult): boolean {
  return result.score <= 0.3; // Lower score = better match in Fuse.js
}

/**
 * Normalize a spoken item reference for better matching
 */
export function normalizeItemReference(reference: string): string {
  return (
    reference
      .toLowerCase()
      .trim()
      // Remove common filler words
      .replace(/\b(the|a|an|my|our|some)\b/gi, '')
      // Normalize common abbreviations
      .replace(/\bbeer\b/gi, 'beer')
      .replace(/\bburger\b/gi, 'burger')
      .replace(/\bapp\b/gi, 'appetizer')
      .replace(/\bapps\b/gi, 'appetizers')
      .replace(/\bfries\b/gi, 'fries')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ============================================
// Member Matching
// ============================================

// Common pronoun mappings
const PRONOUN_MAPPINGS: Record<string, 'current_user' | 'everyone' | 'unknown'> = {
  i: 'current_user',
  me: 'current_user',
  my: 'current_user',
  mine: 'current_user',
  myself: 'current_user',
  we: 'everyone',
  us: 'everyone',
  our: 'everyone',
  everyone: 'everyone',
  'all of us': 'everyone',
  everybody: 'everyone',
};

// Common relationship words (P1 feature)
const RELATIONSHIP_PATTERNS: Array<{
  pattern: RegExp;
  relationship: string;
}> = [
  { pattern: /my\s*(wife|husband|spouse|partner)/i, relationship: 'spouse' },
  { pattern: /my\s*(girlfriend|boyfriend|gf|bf)/i, relationship: 'partner' },
  { pattern: /my\s*(mom|mother|dad|father|parent)/i, relationship: 'parent' },
  { pattern: /my\s*(brother|sister|sibling)/i, relationship: 'sibling' },
  { pattern: /my\s*(friend|buddy|pal)/i, relationship: 'friend' },
];

/**
 * Create a Fuse instance for member searching
 */
export function createMemberSearcher(members: Member[]): Fuse<Member> {
  return new Fuse(members, {
    keys: ['name'],
    threshold: 0.3, // Stricter matching for names
    distance: 50,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

/**
 * Find the best matching member for a spoken reference
 */
export function findBestMemberMatch(
  spokenReference: string,
  members: Member[],
  currentMemberId: string | null,
  existingSearcher?: Fuse<Member>
): MemberMatchResult | null {
  if (!spokenReference || members.length === 0) {
    return null;
  }

  const normalized = spokenReference.toLowerCase().trim();

  // Check for pronouns first
  const pronounMatch = PRONOUN_MAPPINGS[normalized];
  if (pronounMatch === 'current_user' && currentMemberId) {
    const currentMember = members.find((m) => m.id === currentMemberId);
    if (currentMember) {
      return {
        member: currentMember,
        score: 0,
        matchedAs: 'pronoun',
      };
    }
  }

  // "everyone" returns null - handled specially by caller
  if (pronounMatch === 'everyone') {
    return null;
  }

  // Check for relationship patterns (P1)
  for (const { pattern } of RELATIONSHIP_PATTERNS) {
    if (pattern.test(normalized)) {
      // For now, we can't resolve relationships without additional context
      // This will be handled by the NLU layer asking for clarification
      return null;
    }
  }

  // Fuzzy search for member name
  const searcher = existingSearcher || createMemberSearcher(members);
  const results = searcher.search(normalized);

  if (results.length === 0) {
    return null;
  }

  const best = results[0];
  return {
    member: best.item,
    score: best.score || 0,
    matchedAs: 'name',
  };
}

/**
 * Find all possible member matches
 */
export function findAllMemberMatches(
  spokenReference: string,
  members: Member[],
  maxResults: number = 3,
  threshold: number = 0.4
): MemberMatchResult[] {
  if (!spokenReference || members.length === 0) {
    return [];
  }

  const searcher = createMemberSearcher(members);
  const results = searcher.search(spokenReference.toLowerCase().trim());

  return results
    .filter((r) => (r.score || 0) <= threshold)
    .slice(0, maxResults)
    .map((r) => ({
      member: r.item,
      score: r.score || 0,
      matchedAs: 'name' as const,
    }));
}

/**
 * Check if a member match is confident enough to use
 */
export function isConfidentMemberMatch(result: MemberMatchResult): boolean {
  return result.score <= 0.2; // Even stricter for member names
}

/**
 * Check if spoken reference indicates "everyone" / split equally
 */
export function isEveryoneReference(spokenReference: string): boolean {
  const normalized = spokenReference.toLowerCase().trim();
  return (
    PRONOUN_MAPPINGS[normalized] === 'everyone' ||
    /\b(split|share|divide)\s*(it|this|that)?\s*(equally|evenly|between\s+us|among\s+us)?\b/i.test(
      normalized
    ) ||
    /\bwe\s+(all\s+)?(split|shared?|had)\b/i.test(normalized)
  );
}

/**
 * Check if spoken reference indicates the current user
 */
export function isCurrentUserReference(spokenReference: string): boolean {
  const normalized = spokenReference.toLowerCase().trim();
  return PRONOUN_MAPPINGS[normalized] === 'current_user';
}

// ============================================
// Combined Matching Utilities
// ============================================

export interface ParsedClaimStatement {
  memberReference: string;
  itemReferences: string[];
  isSplit: boolean;
  splitWith?: string[];
}

/**
 * Basic parsing of claim statements
 * More sophisticated parsing is done by the NLU layer with Gemini
 */
export function parseBasicClaimStatement(statement: string): ParsedClaimStatement | null {
  const normalized = statement.toLowerCase().trim();

  // Pattern: "[person] had/got/ordered [item]"
  const hadPattern = /^(\w+(?:\s+\w+)?)\s+(?:had|got|ordered|ate|drank|had the)\s+(.+)$/i;
  const hadMatch = normalized.match(hadPattern);

  if (hadMatch) {
    return {
      memberReference: hadMatch[1].trim(),
      itemReferences: [hadMatch[2].trim()],
      isSplit: false,
    };
  }

  // Pattern: "I got [item]" or "I had [item]"
  const iPattern = /^i\s+(?:had|got|ordered|ate|drank)\s+(.+)$/i;
  const iMatch = normalized.match(iPattern);

  if (iMatch) {
    return {
      memberReference: 'i',
      itemReferences: [iMatch[1].trim()],
      isSplit: false,
    };
  }

  // Pattern: "we split [item]" or "[item] was split"
  const splitPattern = /(?:we\s+(?:split|shared)|split|shared)\s+(?:the\s+)?(.+)/i;
  const splitMatch = normalized.match(splitPattern);

  if (splitMatch) {
    return {
      memberReference: 'we',
      itemReferences: [splitMatch[1].trim()],
      isSplit: true,
    };
  }

  return null;
}

/**
 * Extract item references from a sentence
 * Returns array of potential item references
 */
export function extractItemReferences(sentence: string): string[] {
  const items: string[] = [];

  // Split by common conjunctions
  const parts = sentence.split(/\s*(?:,|and|&|plus|also)\s*/i);

  for (const part of parts) {
    const cleaned = part
      .replace(/^(?:the|a|an|some)\s+/i, '')
      .replace(/\s+(?:too|as well)$/i, '')
      .trim();

    if (cleaned.length > 1) {
      items.push(cleaned);
    }
  }

  return items;
}

/**
 * Extract member references from a sentence
 */
export function extractMemberReferences(sentence: string): string[] {
  const members: string[] = [];

  // Split by common conjunctions
  const parts = sentence.split(/\s*(?:,|and|&)\s*/i);

  for (const part of parts) {
    const cleaned = part.trim();
    // Check if it looks like a name (capitalized or pronoun)
    if (
      cleaned.length > 0 &&
      (cleaned.match(/^[A-Z]/) || PRONOUN_MAPPINGS[cleaned.toLowerCase()])
    ) {
      members.push(cleaned);
    }
  }

  return members;
}
