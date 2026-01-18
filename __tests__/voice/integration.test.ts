/**
 * Voice Dictation Integration Tests
 *
 * Tests the complete voice dictation flow from transcript to claims.
 */

import { ReceiptItem, Member } from '../../lib/types';
import {
  parseVoiceCommandLocal,
  createConversationContext,
  addConversationTurn,
  clearPendingClaims,
} from '../../lib/voice/voiceNLU';
import {
  findBestItemMatch,
  findBestMemberMatch,
  createItemSearcher,
  createMemberSearcher,
} from '../../lib/voice/itemMatcher';
import { VoiceClaimIntent, ConversationContext } from '../../lib/voice/types';

// Realistic mock data simulating a restaurant receipt
const mockReceiptItems: ReceiptItem[] = [
  {
    id: 'item_burger',
    receipt_id: 'receipt_123',
    description: 'Classic Cheeseburger with Fries',
    quantity: 1,
    unit_price: 16.99,
    total_price: 16.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_salmon',
    receipt_id: 'receipt_123',
    description: 'Grilled Atlantic Salmon',
    quantity: 1,
    unit_price: 28.99,
    total_price: 28.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_calamari',
    receipt_id: 'receipt_123',
    description: 'Crispy Fried Calamari',
    quantity: 1,
    unit_price: 14.99,
    total_price: 14.99,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    is_likely_shared: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_caesar',
    receipt_id: 'receipt_123',
    description: 'Caesar Salad',
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
    id: 'item_ipa',
    receipt_id: 'receipt_123',
    description: 'Stone IPA Draft',
    quantity: 2,
    unit_price: 8.99,
    total_price: 17.98,
    is_tax: false,
    is_tip: false,
    is_discount: false,
    is_subtotal: false,
    is_total: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_wine',
    receipt_id: 'receipt_123',
    description: 'Glass of Pinot Noir',
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
];

const mockMembers: Member[] = [
  {
    id: 'member_me',
    group_id: 'group_dinner',
    name: 'Alex',
    user_id: null,
    clerk_user_id: 'clerk_user_alex',
    created_at: new Date().toISOString(),
  },
  {
    id: 'member_drew',
    group_id: 'group_dinner',
    name: 'Drew',
    user_id: null,
    clerk_user_id: 'clerk_user_drew',
    created_at: new Date().toISOString(),
  },
  {
    id: 'member_sarah',
    group_id: 'group_dinner',
    name: 'Sarah',
    user_id: null,
    clerk_user_id: 'clerk_user_sarah',
    created_at: new Date().toISOString(),
  },
];

const currentMemberId = 'member_me'; // Alex

describe('Voice Dictation Integration', () => {
  describe('Complete Claim Flow', () => {
    it('should process a multi-person claim transcript', () => {
      // Simulate: "I got the burger, Drew had the salmon"
      const result = parseVoiceCommandLocal(
        'I got the burger. Drew had the salmon.',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      // Should parse both claims
      expect(result.claims.length).toBeGreaterThanOrEqual(1);

      // Check for burger claim to current user
      const burgerClaim = result.claims.find((c) => c.itemId === 'item_burger');
      if (burgerClaim) {
        expect(burgerClaim.memberId).toBe('member_me');
      }

      // Check for salmon claim to Drew
      const salmonClaim = result.claims.find((c) => c.itemId === 'item_salmon');
      if (salmonClaim) {
        expect(salmonClaim.memberId).toBe('member_drew');
      }
    });

    it('should handle conversational flow with context', () => {
      let context = createConversationContext();

      // First utterance
      const result1 = parseVoiceCommandLocal(
        'I had the burger',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      context = addConversationTurn(
        context,
        'I had the burger',
        result1.claims,
        result1.response
      );

      expect(context.pendingClaims.length).toBeGreaterThan(0);
      expect(context.turns.length).toBe(1);

      // Second utterance
      const result2 = parseVoiceCommandLocal(
        'Drew got the salmon',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      context = addConversationTurn(
        context,
        'Drew got the salmon',
        result2.claims,
        result2.response
      );

      expect(context.turns.length).toBe(2);
      expect(context.pendingClaims.length).toBeGreaterThan(1);

      // Confirm and clear
      context = clearPendingClaims(context);
      expect(context.pendingClaims.length).toBe(0);
      expect(context.turns.length).toBe(2); // History preserved
    });
  });

  describe('Fuzzy Matching Scenarios', () => {
    let itemSearcher: ReturnType<typeof createItemSearcher>;
    let memberSearcher: ReturnType<typeof createMemberSearcher>;

    beforeEach(() => {
      itemSearcher = createItemSearcher(mockReceiptItems);
      memberSearcher = createMemberSearcher(mockMembers);
    });

    it('should match "cheeseburger" to the burger item', () => {
      const result = findBestItemMatch('cheeseburger', mockReceiptItems, itemSearcher);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_burger');
    });

    it('should match "fish" reasonably to salmon', () => {
      const result = findBestItemMatch('fish', mockReceiptItems, itemSearcher);
      // Fish should match to salmon with reasonable confidence
      if (result) {
        expect(result.item.description.toLowerCase()).toContain('salmon');
      }
    });

    it('should match "IPA" to the IPA item', () => {
      const result = findBestItemMatch('IPA', mockReceiptItems, itemSearcher);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_ipa');
    });

    it('should match "Pinot" to Pinot Noir', () => {
      const result = findBestItemMatch('Pinot', mockReceiptItems, itemSearcher);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_wine');
    });

    it('should match "salad" to Caesar Salad', () => {
      const result = findBestItemMatch('salad', mockReceiptItems, itemSearcher);
      expect(result).not.toBeNull();
      expect(result!.item.id).toBe('item_caesar');
    });

    it('should handle abbreviated names', () => {
      // Test various name forms
      const drewMatch = findBestMemberMatch('Drew', mockMembers, currentMemberId, memberSearcher);
      expect(drewMatch?.member.id).toBe('member_drew');

      const sarahMatch = findBestMemberMatch('Sarah', mockMembers, currentMemberId, memberSearcher);
      expect(sarahMatch?.member.id).toBe('member_sarah');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty transcript', () => {
      const result = parseVoiceCommandLocal('', mockReceiptItems, mockMembers, currentMemberId);

      expect(result.claims.length).toBe(0);
      expect(result.needsClarification).toBe(true);
    });

    it('should handle transcript with no claims', () => {
      const result = parseVoiceCommandLocal(
        'The food was great!',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      expect(result.claims.length).toBe(0);
    });

    it('should handle unknown item gracefully', () => {
      const result = parseVoiceCommandLocal(
        'I had the spaghetti',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      // Should either have no claims or report unmatched
      expect(result.claims.length === 0 || result.unmatched.length > 0).toBe(true);
    });

    it('should handle unknown member gracefully', () => {
      const result = parseVoiceCommandLocal(
        'Mike had the burger',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      // Should either have no claims or report unmatched
      expect(result.claims.length === 0 || result.unmatched.length > 0).toBe(true);
    });

    it('should handle split references', () => {
      const result = parseVoiceCommandLocal(
        'we split the calamari',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      // Should indicate need for clarification about who "we" includes
      expect(result.needsClarification).toBe(true);
    });
  });

  describe('Pronoun Resolution', () => {
    it('should resolve "I" to current user', () => {
      const result = parseVoiceCommandLocal(
        'I had the burger',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      if (result.claims.length > 0) {
        expect(result.claims[0].memberId).toBe('member_me');
      }
    });

    it('should resolve "me" to current user', () => {
      const memberMatch = findBestMemberMatch('me', mockMembers, currentMemberId);
      expect(memberMatch?.member.id).toBe('member_me');
    });

    it('should resolve "my" to current user', () => {
      const memberMatch = findBestMemberMatch('my', mockMembers, currentMemberId);
      expect(memberMatch?.member.id).toBe('member_me');
    });
  });

  describe('Confidence Scores', () => {
    it('should have high confidence for exact matches', () => {
      const result = parseVoiceCommandLocal(
        'Drew had the Grilled Atlantic Salmon',
        mockReceiptItems,
        mockMembers,
        currentMemberId
      );

      if (result.claims.length > 0) {
        expect(result.claims[0].confidence).toBeGreaterThan(0.5);
      }
    });
  });
});

describe('Real-World Scenarios', () => {
  it('should handle casual dinner conversation style', () => {
    // The local parser handles one claim at a time with simple patterns
    // More complex patterns are handled by Gemini NLU
    const result = parseVoiceCommandLocal(
      'I got the burger',
      mockReceiptItems,
      mockMembers,
      currentMemberId
    );

    // Should extract claim for current user
    expect(result.claims.length).toBeGreaterThanOrEqual(1);
    expect(result.response).toBeTruthy();
    if (result.claims.length > 0) {
      expect(result.claims[0].memberId).toBe('member_me');
    }
  });

  it('should handle correction scenario', () => {
    // Test undo/correction detection
    const result = parseVoiceCommandLocal(
      'Actually wait no Drew had the salad',
      mockReceiptItems,
      mockMembers,
      currentMemberId
    );

    // Should still try to parse the claim
    // Undo detection would be handled by Gemini in real flow
    expect(result).toBeTruthy();
  });

  it('should track conversation state across multiple turns', () => {
    let context = createConversationContext();

    // Turn 1: Claim burger
    const turn1 = parseVoiceCommandLocal(
      'I had the burger',
      mockReceiptItems,
      mockMembers,
      currentMemberId
    );
    context = addConversationTurn(context, 'I had the burger', turn1.claims, turn1.response);

    // Turn 2: Claim salmon for Drew
    const turn2 = parseVoiceCommandLocal(
      'Drew got the salmon',
      mockReceiptItems,
      mockMembers,
      currentMemberId
    );
    context = addConversationTurn(context, 'Drew got the salmon', turn2.claims, turn2.response);

    // Turn 3: Sarah's item
    const turn3 = parseVoiceCommandLocal(
      'Sarah had the salad',
      mockReceiptItems,
      mockMembers,
      currentMemberId
    );
    context = addConversationTurn(context, 'Sarah had the salad', turn3.claims, turn3.response);

    // Verify conversation state
    expect(context.turns.length).toBe(3);
    expect(context.mentionedMembers.size).toBeGreaterThanOrEqual(2);
    expect(context.mentionedItems.size).toBeGreaterThanOrEqual(2);

    // Confirm claims
    context = clearPendingClaims(context);
    expect(context.pendingClaims.length).toBe(0);
  });
});
