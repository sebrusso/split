/**
 * Receipt Claiming Flows - Comprehensive Tests
 *
 * Tests all claiming/unclaiming scenarios including:
 * - Basic claim/unclaim operations
 * - Split item flows
 * - Edge cases and race conditions
 * - Validation logic
 * - Optimistic UI state management
 */

import {
  createClaim,
  canClaimItem,
  isItemFullyClaimed,
  getItemRemainingFraction,
  getItemClaimedAmount,
  calculateMemberTotals,
  validateAllItemsClaimed,
  generateReceiptSummary,
} from '../lib/receipts';

import {
  Receipt,
  ReceiptItem,
  ItemClaim,
  Member,
} from '../lib/types';

// ============================================
// Test Data Factories
// ============================================

const createMockReceipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  id: 'receipt-1',
  group_id: 'group-1',
  uploaded_by: 'member-uploader',
  image_url: 'https://example.com/receipt.jpg',
  ocr_status: 'completed',
  status: 'claiming',
  currency: 'USD',
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
  tax_amount: 0,
  tip_amount: 0,
  total_amount: 0,
  ...overrides,
});

const createMockItem = (overrides: Partial<ReceiptItem> = {}): ReceiptItem => ({
  id: `item-${Math.random().toString(36).substr(2, 9)}`,
  receipt_id: 'receipt-1',
  description: 'Test Item',
  quantity: 1,
  total_price: 10.00,
  is_tax: false,
  is_tip: false,
  is_discount: false,
  is_subtotal: false,
  is_total: false,
  created_at: '2026-01-10T00:00:00Z',
  claims: [] as ItemClaim[],
  ...overrides,
});

const createMockClaim = (overrides: Partial<ItemClaim> = {}): ItemClaim => ({
  id: `claim-${Math.random().toString(36).substr(2, 9)}`,
  receipt_item_id: 'item-1',
  member_id: 'member-1',
  claim_type: 'full',
  share_fraction: 1,
  split_count: 1,
  claimed_at: '2026-01-10T00:00:00Z',
  claimed_via: 'app',
  ...overrides,
});

const createMockMember = (overrides: Partial<Member> = {}): Member => ({
  id: `member-${Math.random().toString(36).substr(2, 9)}`,
  group_id: 'group-1',
  name: 'Test User',
  user_id: null,
  clerk_user_id: null,
  created_at: '2026-01-10T00:00:00Z',
  ...overrides,
});

// ============================================
// FLOW 1: Basic Claim Tests
// ============================================

describe('Flow 1: Basic Claim (Single User, Single Item)', () => {
  describe('canClaimItem validation', () => {
    it('allows claiming an unclaimed regular item', () => {
      const item = createMockItem({ id: 'item-1', claims: [] });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('allows claiming an item with no claims array', () => {
      const item = createMockItem({ id: 'item-1' });
      delete item.claims;
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(true);
    });

    it('rejects claiming a tax item', () => {
      const item = createMockItem({ is_tax: true, claims: [] });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('This item cannot be claimed');
    });

    it('rejects claiming a tip item', () => {
      const item = createMockItem({ is_tip: true, claims: [] });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('This item cannot be claimed');
    });

    it('rejects claiming a subtotal item', () => {
      const item = createMockItem({ is_subtotal: true, claims: [] });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
    });

    it('rejects claiming a total item', () => {
      const item = createMockItem({ is_total: true, claims: [] });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
    });
  });

  describe('createClaim', () => {
    it('creates a full claim by default', () => {
      const claim = createClaim('item-1', 'member-1');

      expect(claim.receipt_item_id).toBe('item-1');
      expect(claim.member_id).toBe('member-1');
      expect(claim.claim_type).toBe('full');
      expect(claim.share_fraction).toBe(1);
      expect(claim.split_count).toBe(1);
      expect(claim.claimed_via).toBe('app');
    });

    it('creates a claim with custom share fraction', () => {
      const claim = createClaim('item-1', 'member-1', { shareFraction: 0.5 });

      expect(claim.share_fraction).toBe(0.5);
      // claim_type is 'split' when share_fraction < 1 (correct behavior)
      expect(claim.claim_type).toBe('split');
    });

    it('creates a split claim with calculated fraction', () => {
      const claim = createClaim('item-1', 'member-1', { splitCount: 3 });

      expect(claim.claim_type).toBe('split');
      expect(claim.share_fraction).toBeCloseTo(1/3, 5);
      expect(claim.split_count).toBe(3);
    });

    it('uses custom claim source', () => {
      const claim = createClaim('item-1', 'member-1', { claimedVia: 'web' });

      expect(claim.claimed_via).toBe('web');
    });

    it('respects maxFraction to prevent over-claiming', () => {
      // When item has 20% remaining, a new claim should be capped at 0.2
      const claim = createClaim('item-1', 'member-1', { maxFraction: 0.2 });

      expect(claim.share_fraction).toBe(0.2);
      expect(claim.claim_type).toBe('split'); // Not full since < 1
    });

    it('does not cap when maxFraction >= requested fraction', () => {
      // When item has 50% remaining and we request 50%, should get 50%
      const claim = createClaim('item-1', 'member-1', {
        shareFraction: 0.5,
        maxFraction: 0.5,
      });

      expect(claim.share_fraction).toBe(0.5);
    });

    it('caps at maxFraction when shareFraction exceeds it', () => {
      // When item has 30% remaining but we try to claim full, should cap at 0.3
      const claim = createClaim('item-1', 'member-1', {
        shareFraction: 1,
        maxFraction: 0.3,
      });

      expect(claim.share_fraction).toBe(0.3);
      expect(claim.claim_type).toBe('split');
    });
  });
});

// ============================================
// FLOW 2: Basic Unclaim Tests
// ============================================

describe('Flow 2: Basic Unclaim (Single User Removes Their Claim)', () => {
  describe('finding member claim', () => {
    it('finds existing claim by member_id', () => {
      const claim = createMockClaim({
        receipt_item_id: 'item-1',
        member_id: 'member-1'
      });
      const item = createMockItem({
        id: 'item-1',
        claims: [claim]
      });

      const memberClaim = item.claims?.find((c: ItemClaim) => c.member_id === 'member-1');
      expect(memberClaim).toBeDefined();
      expect(memberClaim?.member_id).toBe('member-1');
    });

    it('returns undefined when member has no claim', () => {
      const claim = createMockClaim({
        receipt_item_id: 'item-1',
        member_id: 'member-other'
      });
      const item = createMockItem({
        id: 'item-1',
        claims: [claim]
      });

      const memberClaim = item.claims?.find((c: ItemClaim) => c.member_id === 'member-1');
      expect(memberClaim).toBeUndefined();
    });

    it('handles empty claims array', () => {
      const item = createMockItem({ id: 'item-1', claims: [] as ItemClaim[] });

      const memberClaim = item.claims?.find((c: ItemClaim) => c.member_id === 'member-1');
      expect(memberClaim).toBeUndefined();
    });

    it('handles undefined claims', () => {
      const item = createMockItem({ id: 'item-1' });
      (item as any).claims = undefined;

      const memberClaim = (item.claims as ItemClaim[] | undefined)?.find((c: ItemClaim) => c.member_id === 'member-1');
      expect(memberClaim).toBeUndefined();
    });
  });
});

// ============================================
// FLOW 3: Split Item Tests
// ============================================

describe('Flow 3: Split Item (Multiple Users Share One Item)', () => {
  describe('createClaim with splitCount', () => {
    it('creates correct fraction for 2-way split', () => {
      const claim = createClaim('item-1', 'member-1', { splitCount: 2 });

      expect(claim.share_fraction).toBe(0.5);
      expect(claim.split_count).toBe(2);
      expect(claim.claim_type).toBe('split');
    });

    it('creates correct fraction for 3-way split', () => {
      const claim = createClaim('item-1', 'member-1', { splitCount: 3 });

      expect(claim.share_fraction).toBeCloseTo(0.333, 2);
      expect(claim.split_count).toBe(3);
    });

    it('creates correct fraction for 4-way split', () => {
      const claim = createClaim('item-1', 'member-1', { splitCount: 4 });

      expect(claim.share_fraction).toBe(0.25);
      expect(claim.split_count).toBe(4);
    });
  });

  describe('isItemFullyClaimed with splits', () => {
    it('returns true when 2-way split sums to 1', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 0.5 }),
          createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.5 }),
        ],
      });

      expect(isItemFullyClaimed(item)).toBe(true);
    });

    it('returns true when 3-way split sums to ~1 (with rounding tolerance)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 0.333 }),
          createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.333 }),
          createMockClaim({ id: 'claim-3', member_id: 'member-3', share_fraction: 0.334 }),
        ],
      });

      expect(isItemFullyClaimed(item)).toBe(true);
    });

    it('returns false when splits do not sum to 1', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 0.5 }),
        ],
      });

      expect(isItemFullyClaimed(item)).toBe(false);
    });
  });

  describe('getItemRemainingFraction with splits', () => {
    it('returns 0.5 after one 50% claim', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 0.5 }),
        ],
      });

      expect(getItemRemainingFraction(item)).toBe(0.5);
    });

    it('returns 0.25 after 75% claimed', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 0.5 }),
          createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.25 }),
        ],
      });

      expect(getItemRemainingFraction(item)).toBe(0.25);
    });

    it('returns 0 when fully claimed', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 1 }),
        ],
      });

      expect(getItemRemainingFraction(item)).toBe(0);
    });

    it('handles over-claimed scenario (returns 0, not negative)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 0.6 }),
          createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.6 }),
        ],
      });

      // 1.2 claimed, so remaining should be 0, not -0.2
      expect(getItemRemainingFraction(item)).toBe(0);
    });
  });
});

// ============================================
// FLOW 6: Claim While Item is Already Fully Claimed
// ============================================

describe('Flow 6: Claim While Item is Already Fully Claimed', () => {
  it('rejects claim when item is fully claimed by another user', () => {
    const item = createMockItem({
      id: 'item-1',
      claims: [
        createMockClaim({ member_id: 'member-other', share_fraction: 1 }),
      ],
    });

    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(false);
    expect(result.reason).toBe('Item is fully claimed');
  });

  it('rejects claim when item is fully claimed by multiple splits', () => {
    const item = createMockItem({
      id: 'item-1',
      claims: [
        createMockClaim({ member_id: 'member-a', share_fraction: 0.5 }),
        createMockClaim({ id: 'claim-2', member_id: 'member-b', share_fraction: 0.5 }),
      ],
    });

    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(false);
    expect(result.reason).toBe('Item is fully claimed');
  });
});

// ============================================
// FLOW 7: Claim Item Partially Claimed by Others
// ============================================

describe('Flow 7: Claim Item Partially Claimed by Others', () => {
  it('allows claiming when item is only partially claimed', () => {
    const item = createMockItem({
      id: 'item-1',
      claims: [
        createMockClaim({ member_id: 'member-other', share_fraction: 0.5 }),
      ],
    });

    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(true);
  });

  it('BUG: does not limit new claim to remaining fraction', () => {
    // This test documents a potential bug:
    // canClaimItem returns true but doesn't indicate the maximum allowed fraction
    // The caller could create a claim with share_fraction: 1, exceeding 100%

    const item = createMockItem({
      id: 'item-1',
      claims: [
        createMockClaim({ member_id: 'member-other', share_fraction: 0.75 }),
      ],
    });

    const result = canClaimItem(item, 'member-1');
    expect(result.canClaim).toBe(true);

    // The remaining fraction is 0.25, but nothing prevents creating a claim with 1.0
    const remainingFraction = getItemRemainingFraction(item);
    expect(remainingFraction).toBe(0.25);

    // This claim would be invalid but createClaim doesn't validate
    const invalidClaim = createClaim('item-1', 'member-1', { shareFraction: 1 });
    expect(invalidClaim.share_fraction).toBe(1); // No validation!
  });
});

// ============================================
// FLOW 8: Member Already Claimed (Full Claim)
// ============================================

describe('Flow 8: Member Already Claimed Full Item', () => {
  it('rejects when member already has full claim', () => {
    const item = createMockItem({
      id: 'item-1',
      claims: [
        createMockClaim({ member_id: 'member-1', share_fraction: 1 }),
      ],
    });

    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(false);
    expect(result.reason).toBe('You already claimed this item');
  });

  it('allows claiming when member has partial claim and item not full', () => {
    // Member has 50% claim, item is 50% claimed total
    // Can they claim more?
    const item = createMockItem({
      id: 'item-1',
      claims: [
        createMockClaim({ member_id: 'member-1', share_fraction: 0.5 }),
      ],
    });

    const result = canClaimItem(item, 'member-1');

    // Current implementation: share_fraction < 1, so "You already claimed" check passes
    // Item is not fully claimed, so can claim
    expect(result.canClaim).toBe(true);
  });
});

// ============================================
// EDGE CASE: Multiple Claims by Same Member
// ============================================

describe('Edge Case: Multiple Claims by Same Member', () => {
  it('calculates total fraction when member has multiple claims on same item', () => {
    // This shouldn't happen due to unique constraint, but test the calculation
    const item = createMockItem({
      id: 'item-1',
      claims: [
        createMockClaim({ id: 'claim-1', member_id: 'member-1', share_fraction: 0.3 }),
        createMockClaim({ id: 'claim-2', member_id: 'member-1', share_fraction: 0.3 }),
      ],
    });

    // Note: The unique constraint should prevent this in the database
    // But the calculation functions don't validate this
    const claimed = getItemClaimedAmount(item);
    expect(claimed).toBe(6); // 10 * 0.3 + 10 * 0.3 = 6

    const remaining = getItemRemainingFraction(item);
    expect(remaining).toBe(0.4); // 1 - 0.6 = 0.4
  });
});

// ============================================
// CALCULATION TESTS: calculateMemberTotals
// ============================================

describe('calculateMemberTotals', () => {
  const receipt = createMockReceipt({
    id: 'receipt-1',
    tax_amount: 10,
    tip_amount: 20,
    total_amount: 130,
  });

  const member1 = createMockMember({ id: 'member-1', name: 'Alice' });
  const member2 = createMockMember({ id: 'member-2', name: 'Bob' });
  const members = [member1, member2];

  it('calculates totals for single member with all items', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
      createMockItem({ id: 'item-2', total_price: 50 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-1', share_fraction: 1 }),
    ];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    expect(totals.length).toBe(1);
    expect(totals[0].memberId).toBe('member-1');
    expect(totals[0].itemsTotal).toBe(100);
    expect(totals[0].taxShare).toBe(10);
    expect(totals[0].tipShare).toBe(20);
    expect(totals[0].grandTotal).toBe(130);
  });

  it('distributes tax/tip proportionally between members', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 75 }),
      createMockItem({ id: 'item-2', total_price: 25 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-2', share_fraction: 1 }),
    ];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    // Alice: 75% of items, so 75% of tax/tip
    const alice = totals.find(t => t.memberId === 'member-1')!;
    expect(alice.itemsTotal).toBe(75);
    expect(alice.taxShare).toBe(7.5);  // 75% of 10
    expect(alice.tipShare).toBe(15);    // 75% of 20
    expect(alice.grandTotal).toBe(97.5);

    // Bob: 25% of items
    const bob = totals.find(t => t.memberId === 'member-2')!;
    expect(bob.itemsTotal).toBe(25);
    expect(bob.taxShare).toBe(2.5);   // 25% of 10
    expect(bob.tipShare).toBe(5);      // 25% of 20
    expect(bob.grandTotal).toBe(32.5);
  });

  it('handles split items correctly', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 100 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 0.6 }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-1', member_id: 'member-2', share_fraction: 0.4 }),
    ];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    const alice = totals.find(t => t.memberId === 'member-1')!;
    expect(alice.itemsTotal).toBe(60);
    expect(alice.taxShare).toBe(6);  // 60% of 10
    expect(alice.tipShare).toBe(12); // 60% of 20

    const bob = totals.find(t => t.memberId === 'member-2')!;
    expect(bob.itemsTotal).toBe(40);
    expect(bob.taxShare).toBe(4);  // 40% of 10
    expect(bob.tipShare).toBe(8);  // 40% of 20
  });

  it('excludes tax/tip/subtotal/total items from calculation', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 100 }),
      createMockItem({ id: 'tax-item', total_price: 10, is_tax: true }),
      createMockItem({ id: 'tip-item', total_price: 20, is_tip: true }),
      createMockItem({ id: 'subtotal-item', total_price: 100, is_subtotal: true }),
      createMockItem({ id: 'total-item', total_price: 130, is_total: true }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
      // These claims should be ignored
      createMockClaim({ id: 'claim-2', receipt_item_id: 'tax-item', member_id: 'member-1', share_fraction: 1 }),
      createMockClaim({ id: 'claim-3', receipt_item_id: 'tip-item', member_id: 'member-1', share_fraction: 1 }),
    ];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    expect(totals.length).toBe(1);
    expect(totals[0].itemsTotal).toBe(100); // Only regular item counted
  });

  it('returns empty array when no claims', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 100 }),
    ];

    const totals = calculateMemberTotals(receipt, items, [], members);

    expect(totals.length).toBe(0);
  });

  it('handles unclaimed items (not included in totals)', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
      createMockItem({ id: 'item-2', total_price: 50 }), // Unclaimed
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
    ];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    expect(totals.length).toBe(1);
    expect(totals[0].itemsTotal).toBe(50); // Only claimed item
    // Tax/tip distributed based on claimed subtotal only
    expect(totals[0].taxShare).toBe(10);  // 100% of tax (only claimer)
    expect(totals[0].tipShare).toBe(20);  // 100% of tip
  });
});

// ============================================
// VALIDATION: validateAllItemsClaimed
// ============================================

describe('validateAllItemsClaimed', () => {
  it('returns valid when all items are fully claimed', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
      createMockItem({ id: 'item-2', total_price: 50 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-2', share_fraction: 1 }),
    ];

    const result = validateAllItemsClaimed(items, claims);

    expect(result.isValid).toBe(true);
    expect(result.unclaimedItems).toHaveLength(0);
  });

  it('returns invalid with list of unclaimed items', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
      createMockItem({ id: 'item-2', total_price: 50 }),
      createMockItem({ id: 'item-3', total_price: 25 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
    ];

    const result = validateAllItemsClaimed(items, claims);

    expect(result.isValid).toBe(false);
    expect(result.unclaimedItems).toHaveLength(2);
    expect(result.unclaimedItems.map(i => i.id)).toContain('item-2');
    expect(result.unclaimedItems.map(i => i.id)).toContain('item-3');
  });

  it('treats partially claimed items as unclaimed', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 0.5 }),
    ];

    const result = validateAllItemsClaimed(items, claims);

    expect(result.isValid).toBe(false);
    expect(result.unclaimedItems).toHaveLength(1);
  });

  it('ignores tax/tip/subtotal/total items', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
      createMockItem({ id: 'tax-item', total_price: 5, is_tax: true }),
      createMockItem({ id: 'tip-item', total_price: 10, is_tip: true }),
      createMockItem({ id: 'subtotal-item', total_price: 50, is_subtotal: true }),
      createMockItem({ id: 'total-item', total_price: 65, is_total: true }),
      createMockItem({ id: 'discount-item', total_price: -5, is_discount: true }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
    ];

    const result = validateAllItemsClaimed(items, claims);

    expect(result.isValid).toBe(true);
    expect(result.unclaimedItems).toHaveLength(0);
  });

  it('considers split items that sum to >= 0.99 as claimed', () => {
    const items = [
      createMockItem({ id: 'item-1', total_price: 30 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 0.33 }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-1', member_id: 'member-2', share_fraction: 0.33 }),
      createMockClaim({ id: 'claim-3', receipt_item_id: 'item-1', member_id: 'member-3', share_fraction: 0.34 }),
    ];

    const result = validateAllItemsClaimed(items, claims);

    expect(result.isValid).toBe(true);
  });
});

// ============================================
// RECEIPT SUMMARY
// ============================================

describe('generateReceiptSummary', () => {
  it('generates correct summary with mixed claimed/unclaimed items', () => {
    const receipt = createMockReceipt({
      id: 'receipt-1',
      merchant_name: 'Test Restaurant',
      receipt_date: '2026-01-10',
      tax_amount: 8,
      tip_amount: 15,
      total_amount: 123,
      subtotal: 100,
    });

    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
      createMockItem({ id: 'item-2', total_price: 50 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 1 }),
    ];

    const members = [
      createMockMember({ id: 'member-1', name: 'Alice' }),
    ];

    const summary = generateReceiptSummary(receipt, items, claims, members);

    expect(summary.receiptId).toBe('receipt-1');
    expect(summary.merchantName).toBe('Test Restaurant');
    expect(summary.itemCount).toBe(2);
    expect(summary.claimedItemCount).toBe(1);
    expect(summary.unclaimedItemCount).toBe(1);
    expect(summary.subtotal).toBe(100);
    expect(summary.tax).toBe(8);
    expect(summary.tip).toBe(15);
    expect(summary.total).toBe(123);
    expect(summary.memberTotals).toHaveLength(1);
  });

  it('counts split items as claimed when fully split', () => {
    const receipt = createMockReceipt({ id: 'receipt-1' });

    const items = [
      createMockItem({ id: 'item-1', total_price: 30 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 0.5 }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-1', member_id: 'member-2', share_fraction: 0.5 }),
    ];

    const members = [
      createMockMember({ id: 'member-1', name: 'Alice' }),
      createMockMember({ id: 'member-2', name: 'Bob' }),
    ];

    const summary = generateReceiptSummary(receipt, items, claims, members);

    expect(summary.claimedItemCount).toBe(1);
    expect(summary.unclaimedItemCount).toBe(0);
  });

  it('excludes special items from item count', () => {
    const receipt = createMockReceipt({ id: 'receipt-1' });

    const items = [
      createMockItem({ id: 'item-1', total_price: 50 }),
      createMockItem({ id: 'item-2', total_price: 50 }),
      createMockItem({ id: 'tax-item', total_price: 8, is_tax: true }),
      createMockItem({ id: 'tip-item', total_price: 15, is_tip: true }),
      createMockItem({ id: 'total-item', total_price: 123, is_total: true }),
    ];

    const claims: ItemClaim[] = [];
    const members = [createMockMember()];

    const summary = generateReceiptSummary(receipt, items, claims, members);

    expect(summary.itemCount).toBe(2); // Only regular items
    expect(summary.unclaimedItemCount).toBe(2);
  });
});

// ============================================
// EDGE CASES AND BUG SCENARIOS
// ============================================

describe('Edge Cases and Potential Bugs', () => {
  describe('Over-claiming scenario', () => {
    it('BUG: createClaim does not validate against remaining fraction', () => {
      // Document the bug: createClaim allows creating claims that exceed 100%
      const existingClaim = createMockClaim({
        member_id: 'member-other',
        share_fraction: 0.8
      });

      const item = createMockItem({
        id: 'item-1',
        claims: [existingClaim],
      });

      // Item has 0.2 (20%) remaining
      expect(getItemRemainingFraction(item)).toBeCloseTo(0.2, 10);

      // canClaimItem says yes (there is remaining fraction)
      const canClaim = canClaimItem(item, 'member-1');
      expect(canClaim.canClaim).toBe(true);

      // But createClaim creates a full 100% claim by default
      const newClaim = createClaim(item.id, 'member-1');
      expect(newClaim.share_fraction).toBe(1); // Bug: Should be limited to 0.2

      // This would result in 180% total claiming
      // The database unique constraint would prevent duplicate member claims,
      // but would allow this overclaim if it's a new member
    });
  });

  describe('Rounding errors in split calculations', () => {
    it('handles 3-way split rounding', () => {
      const item = createMockItem({
        id: 'item-1',
        total_price: 10.00,
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 1/3 }),
          createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 1/3 }),
          createMockClaim({ id: 'claim-3', member_id: 'member-3', share_fraction: 1/3 }),
        ],
      });

      const totalClaimed = getItemClaimedAmount(item);
      // 3 * (10 * 1/3) should be ~10
      expect(totalClaimed).toBeCloseTo(10, 5);
    });

    it('handles 7-way split rounding', () => {
      const claims = [];
      for (let i = 1; i <= 7; i++) {
        claims.push(createMockClaim({
          id: `claim-${i}`,
          member_id: `member-${i}`,
          share_fraction: 1/7
        }));
      }

      const item = createMockItem({
        id: 'item-1',
        total_price: 100.00,
        claims,
      });

      const totalClaimed = getItemClaimedAmount(item);
      expect(totalClaimed).toBeCloseTo(100, 2);

      // Check if considered fully claimed
      expect(isItemFullyClaimed(item)).toBe(true);
    });
  });

  describe('Empty and null handling', () => {
    it('handles item with undefined claims array', () => {
      const item = createMockItem({ id: 'item-1' });
      delete item.claims;

      expect(getItemClaimedAmount(item)).toBe(0);
      expect(isItemFullyClaimed(item)).toBe(false);
      expect(getItemRemainingFraction(item)).toBe(1);
    });

    it('handles item with null claims', () => {
      const item = createMockItem({ id: 'item-1' });
      (item as any).claims = null;

      expect(getItemClaimedAmount(item)).toBe(0);
      expect(isItemFullyClaimed(item)).toBe(false);
      expect(getItemRemainingFraction(item)).toBe(1);
    });

    it('handles empty claims array', () => {
      const item = createMockItem({ id: 'item-1', claims: [] });

      expect(getItemClaimedAmount(item)).toBe(0);
      expect(isItemFullyClaimed(item)).toBe(false);
      expect(getItemRemainingFraction(item)).toBe(1);
    });
  });

  describe('Zero and negative prices', () => {
    it('handles zero-price items', () => {
      const item = createMockItem({
        id: 'item-1',
        total_price: 0,
        claims: [createMockClaim({ share_fraction: 1 })],
      });

      expect(getItemClaimedAmount(item)).toBe(0);
      expect(isItemFullyClaimed(item)).toBe(true);
    });

    it('handles discount items (negative prices)', () => {
      const item = createMockItem({
        id: 'discount-1',
        description: '10% Discount',
        total_price: -10.00,
        is_discount: true,
      });

      // Discount items should be filtered out from claiming (fixed!)
      const result = canClaimItem(item, 'member-1');
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('This item cannot be claimed');
    });
  });

  describe('Member totals with no tax/tip', () => {
    it('handles receipt with zero tax and tip', () => {
      const receipt = createMockReceipt({
        tax_amount: 0,
        tip_amount: 0,
        total_amount: 100,
      });

      const items = [createMockItem({ id: 'item-1', total_price: 100 })];
      const claims = [createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' })];
      const members = [createMockMember({ id: 'member-1', name: 'Alice' })];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals[0].taxShare).toBe(0);
      expect(totals[0].tipShare).toBe(0);
      expect(totals[0].grandTotal).toBe(100);
    });

    it('handles receipt with null tax and tip', () => {
      const receipt = createMockReceipt({
        tax_amount: undefined,
        tip_amount: undefined,
        total_amount: 100,
      });

      const items = [createMockItem({ id: 'item-1', total_price: 100 })];
      const claims = [createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' })];
      const members = [createMockMember({ id: 'member-1', name: 'Alice' })];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals[0].taxShare).toBe(0);
      expect(totals[0].tipShare).toBe(0);
      expect(totals[0].grandTotal).toBe(100);
    });
  });

  describe('Very small fractions', () => {
    it('handles very small share fractions', () => {
      const item = createMockItem({
        id: 'item-1',
        total_price: 100,
        claims: [createMockClaim({ share_fraction: 0.001 })],
      });

      expect(getItemClaimedAmount(item)).toBe(0.1);
      expect(isItemFullyClaimed(item)).toBe(false);
      expect(getItemRemainingFraction(item)).toBe(0.999);
    });

    it('handles fraction at edge of tolerance (0.999)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [createMockClaim({ share_fraction: 0.999 })],
      });

      // isItemFullyClaimed uses tolerance of < 0.002
      // 1 - 0.999 = ~0.001 which IS < 0.002, so it IS fully claimed (fixed!)
      expect(isItemFullyClaimed(item)).toBe(true);
    });

    it('handles fraction within tolerance (0.9995)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [createMockClaim({ share_fraction: 0.9995 })],
      });

      // 1 - 0.9995 = 0.0005 which IS <= 0.001, so this IS fully claimed
      expect(isItemFullyClaimed(item)).toBe(true);
    });

    it('handles fraction just below tolerance (0.997)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [createMockClaim({ share_fraction: 0.997 })],
      });

      // 1 - 0.997 = 0.003 which is NOT < 0.002, so NOT fully claimed
      expect(isItemFullyClaimed(item)).toBe(false);
    });
  });
});

// ============================================
// CONCURRENT OPERATIONS SIMULATION
// ============================================

describe('Concurrent Operations Scenarios', () => {
  describe('Two users claiming same item simultaneously', () => {
    it('both canClaimItem checks pass if item initially unclaimed', () => {
      const item = createMockItem({ id: 'item-1', claims: [] });

      // Both users check at the same time
      const user1Check = canClaimItem(item, 'member-1');
      const user2Check = canClaimItem(item, 'member-2');

      expect(user1Check.canClaim).toBe(true);
      expect(user2Check.canClaim).toBe(true);

      // Note: The database unique constraint (receipt_item_id, member_id)
      // would allow both claims if they're different members
      // This could result in over 100% claimed
    });

    it('demonstrates potential overclaim with concurrent claims', () => {
      // Initial state: item unclaimed
      const initialItem = createMockItem({ id: 'item-1', claims: [] });

      // Both users create full claims
      const claim1 = createClaim(initialItem.id, 'member-1');
      const claim2 = createClaim(initialItem.id, 'member-2');

      // If both claims succeed, item would have 200% claimed
      const resultItem = createMockItem({
        id: 'item-1',
        total_price: 100,
        claims: [
          { ...claim1, id: 'claim-1', claimed_at: new Date().toISOString() } as ItemClaim,
          { ...claim2, id: 'claim-2', claimed_at: new Date().toISOString() } as ItemClaim,
        ],
      });

      // This results in over-claiming
      const totalFraction = resultItem.claims!.reduce((sum, c) => sum + c.share_fraction, 0);
      expect(totalFraction).toBe(2); // 200% claimed - this is a problem!

      const claimedAmount = getItemClaimedAmount(resultItem);
      expect(claimedAmount).toBe(200); // $200 claimed on $100 item
    });
  });
});

// ============================================
// UI STATE SCENARIOS
// ============================================

describe('UI State Scenarios', () => {
  describe('Optimistic UI edge cases', () => {
    it('scenario: claim succeeds but real-time update delayed', () => {
      // This tests the logic pattern, not actual hooks
      const pendingClaims = new Set<string>(['item-1']);
      const successfulClaims = new Set<string>(['item-1']);

      // Item in pending and successful, but DB data not yet received
      const item = createMockItem({ id: 'item-1', claims: [] });

      const isPendingClaim = pendingClaims.has(item.id);
      const hasDbClaim = item.claims?.some(c => c.member_id === 'member-1') ?? false;

      expect(isPendingClaim).toBe(true);
      expect(hasDbClaim).toBe(false);

      // UI should show as claimed (optimistic)
      const showAsClaimedByMe = isPendingClaim || hasDbClaim;
      expect(showAsClaimedByMe).toBe(true);
    });

    it('scenario: unclaim succeeds but real-time update delayed', () => {
      const pendingUnclaims = new Set<string>(['item-1']);
      const successfulUnclaims = new Set<string>(['item-1']);

      // Item in pending unclaim, but DB still has claim
      const item = createMockItem({
        id: 'item-1',
        claims: [createMockClaim({ member_id: 'member-1' })],
      });

      const isPendingUnclaim = pendingUnclaims.has(item.id);
      const hasDbClaim = item.claims?.some(c => c.member_id === 'member-1') ?? false;

      expect(isPendingUnclaim).toBe(true);
      expect(hasDbClaim).toBe(true);

      // UI should show as unclaimed (optimistic)
      const showAsClaimedByMe = isPendingUnclaim ? false : hasDbClaim;
      expect(showAsClaimedByMe).toBe(false);
    });

    it('scenario: user cancels pending claim that already succeeded', () => {
      // User tapped claim, then tapped again to "cancel"
      // But the DB operation had already completed

      // This documents the bug where canceling a pending claim
      // doesn't cancel the DB operation that's already in flight

      // Expected behavior: should either:
      // 1. Not allow cancel if operation started, OR
      // 2. Issue a delete if claim succeeded

      // Current behavior: just removes from pendingClaims,
      // leaving desync between UI and DB
    });
  });
});
