/**
 * Voice NLU Tests
 *
 * Tests for the voice Natural Language Understanding service.
 */

import {
  parseVoiceCommandLocal,
  createConversationContext,
  addConversationTurn,
  clearPendingClaims,
  generateProactivePrompt,
} from '../../lib/voice/voiceNLU';
import { ReceiptItem, Member } from '../../lib/types';
import { VoiceClaimIntent } from '../../lib/voice/types';

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

const currentMemberId = 'member_1'; // John

describe('parseVoiceCommandLocal', () => {
  it('should parse "I had the burger"', () => {
    const result = parseVoiceCommandLocal(
      'I had the burger',
      mockItems,
      mockMembers,
      currentMemberId
    );

    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.claims[0].memberId).toBe('member_1');
    expect(result.claims[0].itemId).toBe('item_1');
    expect(result.claims[0].shareFraction).toBe(1.0);
  });

  it('should parse "Drew got the salmon"', () => {
    const result = parseVoiceCommandLocal(
      'Drew got the salmon',
      mockItems,
      mockMembers,
      currentMemberId
    );

    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.claims[0].memberId).toBe('member_3');
    expect(result.claims[0].itemId).toBe('item_2');
  });

  it('should parse "Sarah had the calamari"', () => {
    const result = parseVoiceCommandLocal(
      'Sarah had the calamari',
      mockItems,
      mockMembers,
      currentMemberId
    );

    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.claims[0].memberId).toBe('member_2');
    expect(result.claims[0].itemId).toBe('item_3');
  });

  it('should return unmatched for unknown item', () => {
    const result = parseVoiceCommandLocal(
      'I had the pizza',
      mockItems,
      mockMembers,
      currentMemberId
    );

    // Either no claims or unmatched items
    expect(result.claims.length === 0 || result.unmatched.length > 0).toBe(true);
  });

  it('should return unmatched for unknown member', () => {
    const result = parseVoiceCommandLocal(
      'Mike had the burger',
      mockItems,
      mockMembers,
      currentMemberId
    );

    // Either no claims or unmatched items
    expect(result.claims.length === 0 || result.unmatched.length > 0).toBe(true);
  });

  it('should handle "we split" patterns', () => {
    const result = parseVoiceCommandLocal(
      'we split the calamari',
      mockItems,
      mockMembers,
      currentMemberId
    );

    // Should indicate need for clarification
    expect(result.needsClarification).toBe(true);
  });

  it('should generate a response', () => {
    const result = parseVoiceCommandLocal(
      'I had the burger',
      mockItems,
      mockMembers,
      currentMemberId
    );

    expect(result.response).toBeTruthy();
    expect(typeof result.response).toBe('string');
  });
});

describe('Conversation Context', () => {
  describe('createConversationContext', () => {
    it('should create empty context', () => {
      const ctx = createConversationContext();

      expect(ctx.turns).toHaveLength(0);
      expect(ctx.pendingClaims).toHaveLength(0);
      expect(ctx.mentionedItems.size).toBe(0);
      expect(ctx.mentionedMembers.size).toBe(0);
    });
  });

  describe('addConversationTurn', () => {
    it('should add a turn to context', () => {
      let ctx = createConversationContext();

      const claims: VoiceClaimIntent[] = [
        {
          itemId: 'item_1',
          memberId: 'member_1',
          shareFraction: 1.0,
          confidence: 0.9,
          spokenReference: 'burger',
          spokenMember: 'I',
        },
      ];

      ctx = addConversationTurn(ctx, 'I had the burger', claims, 'Got it!');

      expect(ctx.turns).toHaveLength(1);
      expect(ctx.turns[0].userInput).toBe('I had the burger');
      expect(ctx.pendingClaims).toHaveLength(1);
      expect(ctx.mentionedItems.has('item_1')).toBe(true);
      expect(ctx.mentionedMembers.has('member_1')).toBe(true);
    });

    it('should accumulate turns', () => {
      let ctx = createConversationContext();

      const claims1: VoiceClaimIntent[] = [
        {
          itemId: 'item_1',
          memberId: 'member_1',
          shareFraction: 1.0,
          confidence: 0.9,
          spokenReference: 'burger',
          spokenMember: 'I',
        },
      ];

      const claims2: VoiceClaimIntent[] = [
        {
          itemId: 'item_2',
          memberId: 'member_3',
          shareFraction: 1.0,
          confidence: 0.9,
          spokenReference: 'salmon',
          spokenMember: 'Drew',
        },
      ];

      ctx = addConversationTurn(ctx, 'I had the burger', claims1, 'Got it!');
      ctx = addConversationTurn(ctx, 'Drew got the salmon', claims2, 'Got it!');

      expect(ctx.turns).toHaveLength(2);
      expect(ctx.pendingClaims).toHaveLength(2);
      expect(ctx.mentionedItems.size).toBe(2);
      expect(ctx.mentionedMembers.size).toBe(2);
    });
  });

  describe('clearPendingClaims', () => {
    it('should clear pending claims but keep history', () => {
      let ctx = createConversationContext();

      const claims: VoiceClaimIntent[] = [
        {
          itemId: 'item_1',
          memberId: 'member_1',
          shareFraction: 1.0,
          confidence: 0.9,
          spokenReference: 'burger',
          spokenMember: 'I',
        },
      ];

      ctx = addConversationTurn(ctx, 'I had the burger', claims, 'Got it!');
      ctx = clearPendingClaims(ctx);

      expect(ctx.turns).toHaveLength(1);
      expect(ctx.pendingClaims).toHaveLength(0);
      expect(ctx.mentionedItems.has('item_1')).toBe(true);
    });
  });
});

describe('generateProactivePrompt', () => {
  it('should generate prompt for remaining items', () => {
    const claims: VoiceClaimIntent[] = [
      {
        itemId: 'item_1',
        memberId: 'member_1',
        shareFraction: 1.0,
        confidence: 0.9,
        spokenReference: 'burger',
        spokenMember: 'I',
      },
    ];

    const existingClaims = new Set<string>();

    const prompt = generateProactivePrompt(mockItems, claims, existingClaims);

    expect(prompt).toBeTruthy();
    // Should mention the remaining items (salmon and calamari)
    expect(prompt).toContain('Atlantic Salmon');
    expect(prompt).toContain('Crispy Calamari');
  });

  it('should return undefined when all items claimed', () => {
    const claims: VoiceClaimIntent[] = [
      {
        itemId: 'item_1',
        memberId: 'member_1',
        shareFraction: 1.0,
        confidence: 0.9,
        spokenReference: 'burger',
        spokenMember: 'I',
      },
      {
        itemId: 'item_2',
        memberId: 'member_2',
        shareFraction: 1.0,
        confidence: 0.9,
        spokenReference: 'salmon',
        spokenMember: 'Sarah',
      },
      {
        itemId: 'item_3',
        memberId: 'member_3',
        shareFraction: 1.0,
        confidence: 0.9,
        spokenReference: 'calamari',
        spokenMember: 'Drew',
      },
    ];

    const existingClaims = new Set<string>();

    const prompt = generateProactivePrompt(mockItems, claims, existingClaims);

    expect(prompt).toBeUndefined();
  });

  it('should consider existing claims', () => {
    const claims: VoiceClaimIntent[] = [];
    const existingClaims = new Set(['item_1', 'item_2']);

    const prompt = generateProactivePrompt(mockItems, claims, existingClaims);

    expect(prompt).toBeTruthy();
    // Should only mention calamari
    expect(prompt).toContain('Crispy Calamari');
    expect(prompt).not.toContain('Salmon');
    expect(prompt).not.toContain('burger');
  });

  it('should show count for many items', () => {
    // Add more items to test the "X items remaining" message
    const manyItems: ReceiptItem[] = [
      ...mockItems,
      {
        id: 'item_4',
        receipt_id: 'receipt_1',
        description: 'Beer',
        quantity: 1,
        unit_price: 7.99,
        total_price: 7.99,
        sort_order: 4,
        created_at: new Date().toISOString(),
      },
      {
        id: 'item_5',
        receipt_id: 'receipt_1',
        description: 'Dessert',
        quantity: 1,
        unit_price: 8.99,
        total_price: 8.99,
        sort_order: 5,
        created_at: new Date().toISOString(),
      },
    ] as ReceiptItem[];

    const claims: VoiceClaimIntent[] = [];
    const existingClaims = new Set<string>();

    const prompt = generateProactivePrompt(manyItems, claims, existingClaims);

    expect(prompt).toBeTruthy();
    expect(prompt).toContain('items remaining');
  });
});
