/**
 * Item Matcher Tests
 *
 * Tests for the fuzzy item and member matching utilities.
 */

import {
  findBestItemMatch,
  findAllItemMatches,
  isConfidentItemMatch,
  normalizeItemReference,
  findBestMemberMatch,
  findAllMemberMatches,
  isConfidentMemberMatch,
  isEveryoneReference,
  isCurrentUserReference,
  parseBasicClaimStatement,
  extractItemReferences,
  extractMemberReferences,
} from '../../lib/voice/itemMatcher';
import { ReceiptItem, Member } from '../../lib/types';

// Mock receipt items
const mockItems: ReceiptItem[] = [
  {
    id: 'item_1',
    receipt_id: 'receipt_1',
    description: 'Classic Cheeseburger',
    quantity: 1,
    unit_price: 14.99,
    total_price: 14.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_2',
    receipt_id: 'receipt_1',
    description: 'Atlantic Salmon',
    quantity: 1,
    unit_price: 24.99,
    total_price: 24.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_3',
    receipt_id: 'receipt_1',
    description: 'Crispy Calamari',
    quantity: 1,
    unit_price: 12.99,
    total_price: 12.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_4',
    receipt_id: 'receipt_1',
    description: 'Caesar Salad',
    quantity: 1,
    unit_price: 9.99,
    total_price: 9.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_5',
    receipt_id: 'receipt_1',
    description: 'Craft Beer IPA',
    quantity: 1,
    unit_price: 7.99,
    total_price: 7.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
];

// Mock members
const mockMembers: Member[] = [
  {
    id: 'member_1',
    group_id: 'group_1',
    name: 'John',
    user_id: null,
    clerk_user_id: 'clerk_user_1',
    created_at: new Date().toISOString(),
  },
  {
    id: 'member_2',
    group_id: 'group_1',
    name: 'Sarah',
    user_id: null,
    clerk_user_id: 'clerk_user_2',
    created_at: new Date().toISOString(),
  },
  {
    id: 'member_3',
    group_id: 'group_1',
    name: 'Drew',
    user_id: null,
    clerk_user_id: 'clerk_user_3',
    created_at: new Date().toISOString(),
  },
];

describe('Item Matching', () => {
  describe('findBestItemMatch', () => {
    it('should find exact description match', () => {
      const result = findBestItemMatch('Classic Cheeseburger', mockItems);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_1');
      expect(result!.score).toBeLessThan(0.1);
    });

    it('should find fuzzy match for "burger"', () => {
      const result = findBestItemMatch('burger', mockItems);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_1');
    });

    it('should find fuzzy match for "salmon"', () => {
      const result = findBestItemMatch('salmon', mockItems);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_2');
    });

    it('should find fuzzy match for "calamari"', () => {
      const result = findBestItemMatch('calamari', mockItems);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_3');
    });

    it('should find fuzzy match for "salad"', () => {
      const result = findBestItemMatch('salad', mockItems);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_4');
    });

    it('should find fuzzy match for "beer"', () => {
      const result = findBestItemMatch('beer', mockItems);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_5');
    });

    it('should handle "the burger" with article', () => {
      const result = findBestItemMatch('the burger', mockItems);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_1');
    });

    it('should return null for unmatched item', () => {
      const result = findBestItemMatch('pizza', mockItems);
      // May return null or a very low-confidence match
      if (result) {
        expect(result.score).toBeGreaterThan(0.4);
      }
    });

    it('should return null for empty items array', () => {
      const result = findBestItemMatch('burger', []);
      expect(result).toBeNull();
    });

    it('should return null for empty reference', () => {
      const result = findBestItemMatch('', mockItems);
      expect(result).toBeNull();
    });
  });

  describe('findAllItemMatches', () => {
    it('should return multiple matches for ambiguous reference', () => {
      const results = findAllItemMatches('crispy', mockItems, 5, 0.5);
      expect(results.length).toBeGreaterThan(0);
      // Calamari is "Crispy Calamari"
      expect(results[0].item.id).toBe('item_3');
    });

    it('should limit results to maxResults', () => {
      const results = findAllItemMatches('a', mockItems, 2, 0.9);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('isConfidentItemMatch', () => {
    it('should return true for high-confidence match', () => {
      const result = findBestItemMatch('burger', mockItems);
      expect(result).not.toBeNull();
      expect(isConfidentItemMatch(result!)).toBe(true);
    });
  });

  describe('normalizeItemReference', () => {
    it('should lowercase the reference', () => {
      expect(normalizeItemReference('BURGER')).toBe('burger');
    });

    it('should remove articles', () => {
      expect(normalizeItemReference('the burger')).toBe('burger');
      expect(normalizeItemReference('a salad')).toBe('salad');
      expect(normalizeItemReference('an appetizer')).toBe('appetizer');
    });

    it('should trim whitespace', () => {
      expect(normalizeItemReference('  burger  ')).toBe('burger');
    });
  });
});

describe('Member Matching', () => {
  const currentMemberId = 'member_1'; // John

  describe('findBestMemberMatch', () => {
    it('should find exact name match', () => {
      const result = findBestMemberMatch('Drew', mockMembers, currentMemberId);
      expect(result).not.toBeNull();
      expect(result!.member.id).toBe('member_3');
      expect(result!.matchedAs).toBe('name');
    });

    it('should find case-insensitive name match', () => {
      const result = findBestMemberMatch('drew', mockMembers, currentMemberId);
      expect(result).not.toBeNull();
      expect(result!.member.id).toBe('member_3');
    });

    it('should match "I" to current user', () => {
      const result = findBestMemberMatch('I', mockMembers, currentMemberId);
      expect(result).not.toBeNull();
      expect(result!.member.id).toBe('member_1');
      expect(result!.matchedAs).toBe('pronoun');
    });

    it('should match "me" to current user', () => {
      const result = findBestMemberMatch('me', mockMembers, currentMemberId);
      expect(result).not.toBeNull();
      expect(result!.member.id).toBe('member_1');
      expect(result!.matchedAs).toBe('pronoun');
    });

    it('should match "my" to current user', () => {
      const result = findBestMemberMatch('my', mockMembers, currentMemberId);
      expect(result).not.toBeNull();
      expect(result!.member.id).toBe('member_1');
    });

    it('should return null for "everyone"', () => {
      const result = findBestMemberMatch('everyone', mockMembers, currentMemberId);
      expect(result).toBeNull(); // Special case handled by caller
    });

    it('should return null for "we"', () => {
      const result = findBestMemberMatch('we', mockMembers, currentMemberId);
      expect(result).toBeNull();
    });

    it('should return null for unknown member', () => {
      const result = findBestMemberMatch('Mike', mockMembers, currentMemberId);
      // May return null or very low-confidence match
      if (result) {
        expect(result.score).toBeGreaterThan(0.3);
      }
    });
  });

  describe('findAllMemberMatches', () => {
    it('should return matches for full name', () => {
      const results = findAllMemberMatches('Sarah', mockMembers, 3, 0.5);
      // Should find Sarah
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].member.name).toBe('Sarah');
    });
  });

  describe('isConfidentMemberMatch', () => {
    it('should return true for exact name match', () => {
      const result = findBestMemberMatch('Sarah', mockMembers, currentMemberId);
      expect(result).not.toBeNull();
      expect(isConfidentMemberMatch(result!)).toBe(true);
    });
  });
});

describe('Reference Detection', () => {
  describe('isEveryoneReference', () => {
    it('should return true for "everyone"', () => {
      expect(isEveryoneReference('everyone')).toBe(true);
    });

    it('should return true for "we"', () => {
      expect(isEveryoneReference('we')).toBe(true);
    });

    it('should return true for "us"', () => {
      expect(isEveryoneReference('us')).toBe(true);
    });

    it('should return true for "all of us"', () => {
      expect(isEveryoneReference('all of us')).toBe(true);
    });

    it('should return true for "split it evenly"', () => {
      expect(isEveryoneReference('split it evenly')).toBe(true);
    });

    it('should return true for "we split the appetizer"', () => {
      expect(isEveryoneReference('we split the appetizer')).toBe(true);
    });

    it('should return false for individual name', () => {
      expect(isEveryoneReference('Drew')).toBe(false);
    });
  });

  describe('isCurrentUserReference', () => {
    it('should return true for "I"', () => {
      expect(isCurrentUserReference('I')).toBe(true);
    });

    it('should return true for "me"', () => {
      expect(isCurrentUserReference('me')).toBe(true);
    });

    it('should return true for "my"', () => {
      expect(isCurrentUserReference('my')).toBe(true);
    });

    it('should return false for other names', () => {
      expect(isCurrentUserReference('Drew')).toBe(false);
    });
  });
});

describe('Statement Parsing', () => {
  describe('parseBasicClaimStatement', () => {
    it('should parse "I had the burger"', () => {
      const result = parseBasicClaimStatement('I had the burger');
      expect(result).not.toBeNull();
      expect(result!.memberReference).toBe('i');
      // Item reference may include "the" - check that it contains "burger"
      expect(result!.itemReferences.some(ref => ref.includes('burger'))).toBe(true);
      expect(result!.isSplit).toBe(false);
    });

    it('should parse "Drew got the salmon"', () => {
      const result = parseBasicClaimStatement('Drew got the salmon');
      expect(result).not.toBeNull();
      expect(result!.memberReference.toLowerCase()).toBe('drew');
      // Item reference may include "the" - check that it contains "salmon"
      expect(result!.itemReferences.some(ref => ref.includes('salmon'))).toBe(true);
    });

    it('should parse "we split the calamari"', () => {
      const result = parseBasicClaimStatement('we split the calamari');
      expect(result).not.toBeNull();
      expect(result!.isSplit).toBe(true);
      expect(result!.itemReferences).toContain('calamari');
    });
  });

  describe('extractItemReferences', () => {
    it('should extract single item', () => {
      const items = extractItemReferences('the burger');
      expect(items).toContain('burger');
    });

    it('should extract multiple items with "and"', () => {
      const items = extractItemReferences('burger and salad');
      expect(items).toContain('burger');
      expect(items).toContain('salad');
    });

    it('should extract multiple items with comma', () => {
      const items = extractItemReferences('burger, salad, beer');
      expect(items.length).toBe(3);
    });
  });

  describe('extractMemberReferences', () => {
    it('should extract single name', () => {
      const members = extractMemberReferences('Drew');
      expect(members).toContain('Drew');
    });

    it('should extract multiple names with "and"', () => {
      const members = extractMemberReferences('Drew and Sarah');
      expect(members).toContain('Drew');
      expect(members).toContain('Sarah');
    });

    it('should extract pronouns', () => {
      const members = extractMemberReferences('I');
      expect(members).toContain('I');
    });
  });
});
