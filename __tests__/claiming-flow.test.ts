/**
 * Receipt Claiming Flow Tests
 *
 * Comprehensive tests for all claiming scenarios including:
 * - Basic claim/unclaim operations
 * - Partial claims and splits
 * - Edge cases and error handling
 * - Concurrent claiming scenarios
 * - State consistency validation
 */

import {
  roundCurrency,
  getItemClaimedAmount,
  isItemFullyClaimed,
  getItemRemainingFraction,
  calculateMemberTotals,
  generateReceiptSummary,
  validateAllItemsClaimed,
  createClaim,
  canClaimItem,
} from '../lib/receipts';

import {
  Receipt,
  ReceiptItem,
  ItemClaim,
  Member,
} from '../lib/types';

// ============================================
// Mock Data Factories
// ============================================

const createMockReceipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  id: 'receipt-1',
  group_id: 'group-1',
  uploaded_by: 'member-1',
  image_url: 'https://example.com/receipt.jpg',
  ocr_status: 'completed',
  status: 'claiming',
  currency: 'USD',
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
  ...overrides,
});

const createMockItem = (overrides: Partial<ReceiptItem> = {}): ReceiptItem => ({
  id: `item-${Math.random().toString(36).substr(2, 9)}`,
  receipt_id: 'receipt-1',
  description: 'Test Item',
  quantity: 1,
  total_price: 10.0,
  is_tax: false,
  is_tip: false,
  is_discount: false,
  is_subtotal: false,
  is_total: false,
  created_at: '2026-01-10T00:00:00Z',
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
// SECTION 1: Basic Claiming Tests
// ============================================

describe('Basic Claiming Operations', () => {
  describe('createClaim', () => {
    it('should create a full claim with default values', () => {
      const claim = createClaim('item-1', 'member-1');

      expect(claim.receipt_item_id).toBe('item-1');
      expect(claim.member_id).toBe('member-1');
      expect(claim.claim_type).toBe('full');
      expect(claim.share_fraction).toBe(1);
      expect(claim.split_count).toBe(1);
      expect(claim.claimed_via).toBe('app');
    });

    it('should create a split claim with correct fraction', () => {
      const claim = createClaim('item-1', 'member-1', { splitCount: 2 });

      expect(claim.claim_type).toBe('split');
      expect(claim.share_fraction).toBe(0.5);
      expect(claim.split_count).toBe(2);
    });

    it('should create a 3-way split with correct fraction', () => {
      const claim = createClaim('item-1', 'member-1', { splitCount: 3 });

      expect(claim.claim_type).toBe('split');
      expect(claim.share_fraction).toBeCloseTo(0.333, 2);
      expect(claim.split_count).toBe(3);
    });

    it('should allow custom share fraction', () => {
      const claim = createClaim('item-1', 'member-1', { shareFraction: 0.25 });

      expect(claim.share_fraction).toBe(0.25);
    });

    it('should use custom claim source', () => {
      const claim = createClaim('item-1', 'member-1', { claimedVia: 'imessage' });

      expect(claim.claimed_via).toBe('imessage');
    });

    it('should prefer shareFraction over splitCount when both provided', () => {
      const claim = createClaim('item-1', 'member-1', {
        splitCount: 2,
        shareFraction: 0.75,
      });

      expect(claim.share_fraction).toBe(0.75);
    });
  });
});

// ============================================
// SECTION 2: canClaimItem Validation Tests
// ============================================

describe('canClaimItem Validation', () => {
  describe('Special items (should not be claimable)', () => {
    it('should reject tax items', () => {
      const item = createMockItem({ is_tax: true });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('This item cannot be claimed');
    });

    it('should reject tip items', () => {
      const item = createMockItem({ is_tip: true });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('This item cannot be claimed');
    });

    it('should reject subtotal items', () => {
      const item = createMockItem({ is_subtotal: true });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
    });

    it('should reject total items', () => {
      const item = createMockItem({ is_total: true });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
    });
  });

  describe('Unclaimed items', () => {
    it('should allow claiming unclaimed item', () => {
      const item = createMockItem({ claims: [] });
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(true);
    });

    it('should allow claiming item with undefined claims', () => {
      const item = createMockItem();
      delete item.claims;
      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(true);
    });
  });

  describe('Fully claimed items', () => {
    it('should reject claiming an item fully claimed by another user', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-2', // Different member
            share_fraction: 1,
          }),
        ],
      });

      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('Item is fully claimed');
    });

    it('should reject claiming an item you already fully claimed', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-1', // Same member
            share_fraction: 1,
          }),
        ],
      });

      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('You already claimed this item');
    });

    it('should reject when multiple claims sum to 100%', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-2',
            share_fraction: 0.5,
          }),
          createMockClaim({
            id: 'claim-2',
            receipt_item_id: 'item-1',
            member_id: 'member-3',
            share_fraction: 0.5,
          }),
        ],
      });

      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('Item is fully claimed');
    });
  });

  describe('Partially claimed items', () => {
    it('should allow claiming a partially claimed item by new member', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-2',
            share_fraction: 0.5,
          }),
        ],
      });

      const result = canClaimItem(item, 'member-1');

      expect(result.canClaim).toBe(true);
    });

    /**
     * Test: A member with a partial claim cannot claim again.
     * They must unclaim first or use split to adjust their claim.
     * This prevents the upsert from silently overwriting existing claims.
     */
    it('should reject member with partial claim from claiming again', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-1', // Same member trying to claim again
            share_fraction: 0.5,
          }),
        ],
      });

      const result = canClaimItem(item, 'member-1');

      // Fixed behavior: returns false because member already has a claim
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('You already claimed this item');
    });
  });

  describe('Edge cases with floating point precision', () => {
    it('should handle 3-way split claims (0.333... each)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-1',
            share_fraction: 0.333,
          }),
          createMockClaim({
            id: 'claim-2',
            receipt_item_id: 'item-1',
            member_id: 'member-2',
            share_fraction: 0.333,
          }),
          createMockClaim({
            id: 'claim-3',
            receipt_item_id: 'item-1',
            member_id: 'member-3',
            share_fraction: 0.334,
          }),
        ],
      });

      // Should be considered fully claimed (0.333 + 0.333 + 0.334 = 1.0)
      expect(isItemFullyClaimed(item)).toBe(true);

      const result = canClaimItem(item, 'member-4');
      expect(result.canClaim).toBe(false);
    });

    it('should handle near-complete claims (0.999)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-1',
            share_fraction: 0.999,
          }),
        ],
      });

      // 0.999 is close enough to 1.0 to be considered fully claimed
      expect(isItemFullyClaimed(item)).toBe(true);
    });

    it('should NOT consider 0.99 as fully claimed (below threshold)', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-1',
            share_fraction: 0.99,
          }),
        ],
      });

      // 0.99 is below the 0.999 threshold
      expect(isItemFullyClaimed(item)).toBe(false);
    });
  });
});

// ============================================
// SECTION 3: Claim Amount Calculations
// ============================================

describe('Claim Amount Calculations', () => {
  describe('getItemClaimedAmount', () => {
    it('should return 0 for unclaimed items', () => {
      const item = createMockItem({ total_price: 20.0, claims: [] });
      expect(getItemClaimedAmount(item)).toBe(0);
    });

    it('should return full amount for fully claimed item', () => {
      const item = createMockItem({
        total_price: 25.0,
        claims: [createMockClaim({ share_fraction: 1 })],
      });
      expect(getItemClaimedAmount(item)).toBe(25.0);
    });

    it('should return half amount for 50% claim', () => {
      const item = createMockItem({
        total_price: 30.0,
        claims: [createMockClaim({ share_fraction: 0.5 })],
      });
      expect(getItemClaimedAmount(item)).toBe(15.0);
    });

    it('should sum multiple partial claims', () => {
      const item = createMockItem({
        total_price: 60.0,
        claims: [
          createMockClaim({ share_fraction: 0.25 }),
          createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.25 }),
        ],
      });
      expect(getItemClaimedAmount(item)).toBe(30.0); // 50% claimed
    });
  });

  describe('getItemRemainingFraction', () => {
    it('should return 1 for unclaimed item', () => {
      const item = createMockItem({ claims: [] });
      expect(getItemRemainingFraction(item)).toBe(1);
    });

    it('should return 0 for fully claimed item', () => {
      const item = createMockItem({
        claims: [createMockClaim({ share_fraction: 1 })],
      });
      expect(getItemRemainingFraction(item)).toBe(0);
    });

    it('should return 0.5 for 50% claimed item', () => {
      const item = createMockItem({
        claims: [createMockClaim({ share_fraction: 0.5 })],
      });
      expect(getItemRemainingFraction(item)).toBe(0.5);
    });

    it('should not return negative for over-claimed item (defensive)', () => {
      // This shouldn't happen in practice, but testing defensive coding
      const item = createMockItem({
        claims: [
          createMockClaim({ share_fraction: 0.6 }),
          createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.6 }),
        ],
      });
      // 1.2 total claimed, should clamp to 0
      expect(getItemRemainingFraction(item)).toBe(0);
    });
  });
});

// ============================================
// SECTION 4: Member Total Calculations
// ============================================

describe('Member Total Calculations', () => {
  const members = [
    createMockMember({ id: 'member-1', name: 'Alice' }),
    createMockMember({ id: 'member-2', name: 'Bob' }),
    createMockMember({ id: 'member-3', name: 'Charlie' }),
  ];

  describe('Basic total calculation', () => {
    it('should calculate correct total for single member claiming all items', () => {
      const receipt = createMockReceipt({
        tax_amount: 10.0,
        tip_amount: 20.0,
        total_amount: 130.0,
      });

      const items = [
        createMockItem({ id: 'item-1', total_price: 50.0 }),
        createMockItem({ id: 'item-2', total_price: 50.0 }),
      ];

      const claims = [
        createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
        createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-1' }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals.length).toBe(1);
      expect(totals[0].memberId).toBe('member-1');
      expect(totals[0].itemsTotal).toBe(100.0);
      expect(totals[0].taxShare).toBe(10.0);
      expect(totals[0].tipShare).toBe(20.0);
      expect(totals[0].grandTotal).toBe(130.0);
    });

    it('should distribute tax/tip proportionally between two members', () => {
      const receipt = createMockReceipt({
        tax_amount: 10.0,
        tip_amount: 10.0,
      });

      const items = [
        createMockItem({ id: 'item-1', total_price: 60.0 }), // 60% of subtotal
        createMockItem({ id: 'item-2', total_price: 40.0 }), // 40% of subtotal
      ];

      const claims = [
        createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
        createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-2' }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      const alice = totals.find((t) => t.memberId === 'member-1')!;
      const bob = totals.find((t) => t.memberId === 'member-2')!;

      // Alice: 60% of tax/tip
      expect(alice.taxShare).toBe(6.0);
      expect(alice.tipShare).toBe(6.0);
      expect(alice.grandTotal).toBe(72.0);

      // Bob: 40% of tax/tip
      expect(bob.taxShare).toBe(4.0);
      expect(bob.tipShare).toBe(4.0);
      expect(bob.grandTotal).toBe(48.0);
    });
  });

  describe('Split item calculations', () => {
    it('should calculate correct totals for 2-way split item', () => {
      const receipt = createMockReceipt({
        tax_amount: 4.0,
        tip_amount: 6.0,
      });

      const items = [createMockItem({ id: 'item-1', total_price: 40.0 })];

      const claims = [
        createMockClaim({
          receipt_item_id: 'item-1',
          member_id: 'member-1',
          share_fraction: 0.5,
          split_count: 2,
        }),
        createMockClaim({
          id: 'claim-2',
          receipt_item_id: 'item-1',
          member_id: 'member-2',
          share_fraction: 0.5,
          split_count: 2,
        }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals.length).toBe(2);

      const alice = totals.find((t) => t.memberId === 'member-1')!;
      expect(alice.itemsTotal).toBe(20.0);
      expect(alice.taxShare).toBe(2.0);
      expect(alice.tipShare).toBe(3.0);
      expect(alice.grandTotal).toBe(25.0);

      const bob = totals.find((t) => t.memberId === 'member-2')!;
      expect(bob.grandTotal).toBe(25.0);
    });

    it('should calculate correct totals for 3-way split item', () => {
      const receipt = createMockReceipt({
        tax_amount: 3.0,
        tip_amount: 6.0,
      });

      const items = [createMockItem({ id: 'item-1', total_price: 30.0 })];

      const claims = [
        createMockClaim({
          receipt_item_id: 'item-1',
          member_id: 'member-1',
          share_fraction: 1 / 3,
        }),
        createMockClaim({
          id: 'claim-2',
          receipt_item_id: 'item-1',
          member_id: 'member-2',
          share_fraction: 1 / 3,
        }),
        createMockClaim({
          id: 'claim-3',
          receipt_item_id: 'item-1',
          member_id: 'member-3',
          share_fraction: 1 / 3,
        }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals.length).toBe(3);

      // Each person should have 1/3 of everything
      for (const total of totals) {
        expect(total.itemsTotal).toBe(10.0);
        expect(total.taxShare).toBe(1.0);
        expect(total.tipShare).toBe(2.0);
        expect(total.grandTotal).toBe(13.0);
      }
    });
  });

  describe('Mixed claiming scenarios', () => {
    it('should handle mix of full and split claims', () => {
      const receipt = createMockReceipt({
        tax_amount: 8.0,
        tip_amount: 12.0,
      });

      const items = [
        createMockItem({ id: 'item-1', total_price: 40.0 }), // Alice only
        createMockItem({ id: 'item-2', total_price: 20.0 }), // Bob only
        createMockItem({ id: 'item-3', total_price: 40.0 }), // Split Alice & Bob
      ];

      const claims = [
        // Alice full claim on item 1
        createMockClaim({
          receipt_item_id: 'item-1',
          member_id: 'member-1',
          share_fraction: 1,
        }),
        // Bob full claim on item 2
        createMockClaim({
          id: 'claim-2',
          receipt_item_id: 'item-2',
          member_id: 'member-2',
          share_fraction: 1,
        }),
        // Split item 3 between Alice and Bob
        createMockClaim({
          id: 'claim-3',
          receipt_item_id: 'item-3',
          member_id: 'member-1',
          share_fraction: 0.5,
        }),
        createMockClaim({
          id: 'claim-4',
          receipt_item_id: 'item-3',
          member_id: 'member-2',
          share_fraction: 0.5,
        }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      // Alice: 40 + 20 = 60 items (60%)
      // Bob: 20 + 20 = 40 items (40%)
      const alice = totals.find((t) => t.memberId === 'member-1')!;
      expect(alice.itemsTotal).toBe(60.0);
      // Tax/tip shares may have small rounding differences due to floor strategy
      expect(alice.taxShare).toBeCloseTo(4.8, 1); // 60% of 8
      expect(alice.tipShare).toBeCloseTo(7.2, 1); // 60% of 12

      const bob = totals.find((t) => t.memberId === 'member-2')!;
      expect(bob.itemsTotal).toBe(40.0);
      expect(bob.taxShare).toBeCloseTo(3.2, 1); // 40% of 8
      expect(bob.tipShare).toBeCloseTo(4.8, 1); // 40% of 12

      // Verify grand totals sum correctly (this is the important invariant)
      const grandSum = alice.grandTotal + bob.grandTotal;
      expect(grandSum).toBe(120.0); // 100 + 8 + 12
    });
  });

  describe('Unclaimed items handling', () => {
    it('should only calculate totals for claimed items', () => {
      const receipt = createMockReceipt({
        tax_amount: 10.0,
        tip_amount: 10.0,
      });

      const items = [
        createMockItem({ id: 'item-1', total_price: 50.0 }), // Claimed
        createMockItem({ id: 'item-2', total_price: 50.0 }), // NOT claimed
      ];

      const claims = [
        createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals.length).toBe(1);
      expect(totals[0].itemsTotal).toBe(50.0);
      // Tax/tip should be based on claimed portion only
      expect(totals[0].taxShare).toBe(10.0); // 100% of claimed goes to Alice
      expect(totals[0].tipShare).toBe(10.0);
    });

    it('should return empty array when no items are claimed', () => {
      const receipt = createMockReceipt();
      const items = [createMockItem({ id: 'item-1', total_price: 50.0 })];
      const claims: ItemClaim[] = [];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals.length).toBe(0);
    });
  });

  describe('Special items handling', () => {
    it('should ignore tax/tip line items in calculation', () => {
      const receipt = createMockReceipt({ tax_amount: 5.0 });

      const items = [
        createMockItem({ id: 'item-1', total_price: 50.0 }),
        createMockItem({ id: 'tax-line', total_price: 5.0, is_tax: true }),
      ];

      const claims = [
        createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
        // Even if someone claims the tax line (shouldn't happen), it's ignored
        createMockClaim({
          id: 'claim-2',
          receipt_item_id: 'tax-line',
          member_id: 'member-1',
        }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals[0].itemsTotal).toBe(50.0); // Tax line not included
    });
  });
});

// ============================================
// SECTION 5: Receipt Summary Generation
// ============================================

describe('Receipt Summary Generation', () => {
  const members = [
    createMockMember({ id: 'member-1', name: 'Alice' }),
    createMockMember({ id: 'member-2', name: 'Bob' }),
  ];

  it('should generate accurate summary with partial claiming', () => {
    const receipt = createMockReceipt({
      merchant_name: 'Test Cafe',
      receipt_date: '2026-01-10',
      subtotal: 100.0,
      tax_amount: 8.0,
      tip_amount: 15.0,
      total_amount: 123.0,
    });

    const items = [
      createMockItem({ id: 'item-1', total_price: 30.0 }),
      createMockItem({ id: 'item-2', total_price: 40.0 }),
      createMockItem({ id: 'item-3', total_price: 30.0 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-2' }),
      // item-3 is unclaimed
    ];

    const summary = generateReceiptSummary(receipt, items, claims, members);

    expect(summary.itemCount).toBe(3);
    expect(summary.claimedItemCount).toBe(2);
    expect(summary.unclaimedItemCount).toBe(1);
    expect(summary.subtotal).toBe(100.0);
    expect(summary.tax).toBe(8.0);
    expect(summary.tip).toBe(15.0);
    expect(summary.total).toBe(123.0);
    expect(summary.memberTotals.length).toBe(2);
  });

  it('should exclude special items from item count', () => {
    const receipt = createMockReceipt();

    const items = [
      createMockItem({ id: 'item-1', total_price: 50.0 }),
      createMockItem({ id: 'item-2', total_price: 50.0 }),
      createMockItem({ id: 'tax', total_price: 8.0, is_tax: true }),
      createMockItem({ id: 'tip', total_price: 12.0, is_tip: true }),
      createMockItem({ id: 'subtotal', total_price: 100.0, is_subtotal: true }),
      createMockItem({ id: 'total', total_price: 120.0, is_total: true }),
      createMockItem({ id: 'discount', total_price: -10.0, is_discount: true }),
    ];

    const claims: ItemClaim[] = [];

    const summary = generateReceiptSummary(receipt, items, claims, members);

    // Only 2 regular items
    expect(summary.itemCount).toBe(2);
    expect(summary.unclaimedItemCount).toBe(2);
  });
});

// ============================================
// SECTION 6: Validation Functions
// ============================================

describe('Validation Functions', () => {
  describe('validateAllItemsClaimed', () => {
    it('should return valid when all items fully claimed', () => {
      const items = [
        createMockItem({ id: 'item-1' }),
        createMockItem({ id: 'item-2' }),
      ];

      const claims = [
        createMockClaim({ receipt_item_id: 'item-1' }),
        createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2' }),
      ];

      const result = validateAllItemsClaimed(items, claims);

      expect(result.isValid).toBe(true);
      expect(result.unclaimedItems).toHaveLength(0);
    });

    it('should return invalid with list of unclaimed items', () => {
      const items = [
        createMockItem({ id: 'item-1', description: 'Claimed Item' }),
        createMockItem({ id: 'item-2', description: 'Unclaimed Item 1' }),
        createMockItem({ id: 'item-3', description: 'Unclaimed Item 2' }),
      ];

      const claims = [createMockClaim({ receipt_item_id: 'item-1' })];

      const result = validateAllItemsClaimed(items, claims);

      expect(result.isValid).toBe(false);
      expect(result.unclaimedItems).toHaveLength(2);
      expect(result.unclaimedItems.map((i) => i.id)).toContain('item-2');
      expect(result.unclaimedItems.map((i) => i.id)).toContain('item-3');
    });

    it('should treat split-claimed items as claimed', () => {
      const items = [createMockItem({ id: 'item-1' })];

      const claims = [
        createMockClaim({
          receipt_item_id: 'item-1',
          member_id: 'member-1',
          share_fraction: 0.5,
        }),
        createMockClaim({
          id: 'claim-2',
          receipt_item_id: 'item-1',
          member_id: 'member-2',
          share_fraction: 0.5,
        }),
      ];

      const result = validateAllItemsClaimed(items, claims);

      expect(result.isValid).toBe(true);
    });

    it('should detect partially claimed items as unclaimed', () => {
      const items = [createMockItem({ id: 'item-1' })];

      const claims = [
        createMockClaim({
          receipt_item_id: 'item-1',
          member_id: 'member-1',
          share_fraction: 0.5, // Only 50% claimed
        }),
      ];

      const result = validateAllItemsClaimed(items, claims);

      expect(result.isValid).toBe(false);
      expect(result.unclaimedItems).toHaveLength(1);
    });

    it('should ignore special items in validation', () => {
      const items = [
        createMockItem({ id: 'item-1' }), // Regular - claimed
        createMockItem({ id: 'tax', is_tax: true }),
        createMockItem({ id: 'tip', is_tip: true }),
        createMockItem({ id: 'discount', is_discount: true }),
      ];

      const claims = [createMockClaim({ receipt_item_id: 'item-1' })];

      const result = validateAllItemsClaimed(items, claims);

      expect(result.isValid).toBe(true);
    });
  });
});

// ============================================
// SECTION 7: Edge Cases and Bug Scenarios
// ============================================

describe('Edge Cases and Bug Scenarios', () => {
  describe('Concurrent claiming simulation', () => {
    /**
     * This tests the scenario where two users try to claim the same item.
     * In the real app, the upsert would cause issues.
     */
    it('should detect over-claiming when multiple users claim 100%', () => {
      const item = createMockItem({
        id: 'item-1',
        total_price: 50.0,
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-1',
            share_fraction: 1,
          }),
          createMockClaim({
            id: 'claim-2',
            receipt_item_id: 'item-1',
            member_id: 'member-2',
            share_fraction: 1,
          }),
        ],
      });

      // This shouldn't happen in practice, but if it does:
      const totalClaimed = getItemClaimedAmount(item);
      expect(totalClaimed).toBe(100.0); // 200% of item value!

      // isItemFullyClaimed uses sum, so 2.0 > 1.0 is still "fully claimed"
      expect(isItemFullyClaimed(item)).toBe(true);
    });
  });

  describe('Rounding scenarios', () => {
    it('should handle penny rounding correctly', () => {
      const receipt = createMockReceipt({
        tax_amount: 0.01, // 1 cent tax
        total_amount: 10.01,
      });

      const items = [createMockItem({ id: 'item-1', total_price: 10.0 })];

      const claims = [
        createMockClaim({
          receipt_item_id: 'item-1',
          member_id: 'member-1',
          share_fraction: 0.5,
        }),
        createMockClaim({
          id: 'claim-2',
          receipt_item_id: 'item-1',
          member_id: 'member-2',
          share_fraction: 0.5,
        }),
      ];

      const members = [
        createMockMember({ id: 'member-1', name: 'Alice' }),
        createMockMember({ id: 'member-2', name: 'Bob' }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      // 0.01 / 2 = 0.005, which rounds to 0.01 for one person and 0.00 for other
      // depending on rounding strategy
      const sum = totals.reduce((acc, t) => acc + t.taxShare, 0);
      expect(sum).toBe(0.01); // Should not lose or gain pennies
    });

    it('should handle large split counts (10-way split)', () => {
      const items = [createMockItem({ id: 'item-1', total_price: 33.33 })];

      const claims = Array.from({ length: 10 }, (_, i) =>
        createMockClaim({
          id: `claim-${i}`,
          receipt_item_id: 'item-1',
          member_id: `member-${i}`,
          share_fraction: 0.1,
          split_count: 10,
        })
      );

      const members = Array.from({ length: 10 }, (_, i) =>
        createMockMember({ id: `member-${i}`, name: `Person ${i}` })
      );

      const receipt = createMockReceipt({ tax_amount: 2.67, tip_amount: 5.0 });

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals.length).toBe(10);

      // Each person should have roughly equal amounts
      for (const total of totals) {
        expect(total.itemsTotal).toBeCloseTo(3.333, 1);
      }
    });
  });

  describe('Empty and null handling', () => {
    it('should handle receipt with no tax or tip', () => {
      const receipt = createMockReceipt({
        tax_amount: undefined,
        tip_amount: undefined,
      });

      const items = [createMockItem({ id: 'item-1', total_price: 50.0 })];
      const claims = [createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' })];
      const members = [createMockMember({ id: 'member-1' })];

      const totals = calculateMemberTotals(receipt, items, claims, members);

      expect(totals[0].taxShare).toBe(0);
      expect(totals[0].tipShare).toBe(0);
      expect(totals[0].grandTotal).toBe(50.0);
    });

    it('should handle item with undefined claims gracefully', () => {
      const item = createMockItem();
      // Explicitly set claims to undefined
      (item as any).claims = undefined;

      expect(() => getItemClaimedAmount(item)).not.toThrow();
      expect(getItemClaimedAmount(item)).toBe(0);
    });
  });

  describe('State consistency', () => {
    it('should ensure member totals sum equals receipt total (when fully claimed)', () => {
      const receipt = createMockReceipt({
        subtotal: 100.0,
        tax_amount: 8.25,
        tip_amount: 18.0,
        total_amount: 126.25,
      });

      const items = [
        createMockItem({ id: 'item-1', total_price: 45.0 }),
        createMockItem({ id: 'item-2', total_price: 35.0 }),
        createMockItem({ id: 'item-3', total_price: 20.0 }),
      ];

      const claims = [
        createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
        createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-2' }),
        createMockClaim({ id: 'claim-3', receipt_item_id: 'item-3', member_id: 'member-3' }),
      ];

      const members = [
        createMockMember({ id: 'member-1', name: 'Alice' }),
        createMockMember({ id: 'member-2', name: 'Bob' }),
        createMockMember({ id: 'member-3', name: 'Charlie' }),
      ];

      const totals = calculateMemberTotals(receipt, items, claims, members);
      const memberSum = totals.reduce((sum, t) => sum + t.grandTotal, 0);

      // Allow for small floating point differences (< 10 cents)
      expect(Math.abs(memberSum - receipt.total_amount!)).toBeLessThan(0.1);
    });
  });
});

// ============================================
// SECTION 8: UI State Simulation Tests
// ============================================

describe('UI State Simulation', () => {
  /**
   * These tests simulate the UI logic to verify correct behavior
   */

  describe('Item card state determination', () => {
    it('should correctly identify item states for UI rendering', () => {
      const currentMemberId = 'member-1';

      // State 1: Unclaimed item
      const unclaimed = createMockItem({ id: 'item-1', claims: [] });
      const unclaimedFullyClaimed = isItemFullyClaimed(unclaimed);
      const unclaimedClaimedByMe = unclaimed.claims?.some(
        (c) => c.member_id === currentMemberId
      );
      expect(unclaimedFullyClaimed).toBe(false);
      expect(unclaimedClaimedByMe).toBeFalsy();

      // State 2: Claimed by me (full)
      const claimedByMe = createMockItem({
        id: 'item-2',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-2',
            member_id: 'member-1',
            share_fraction: 1,
          }),
        ],
      });
      const myClaimFull = isItemFullyClaimed(claimedByMe);
      const myClaimByMe = claimedByMe.claims?.some(
        (c) => c.member_id === currentMemberId
      );
      expect(myClaimFull).toBe(true);
      expect(myClaimByMe).toBe(true);

      // State 3: Claimed by other
      const claimedByOther = createMockItem({
        id: 'item-3',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-3',
            member_id: 'member-2',
            share_fraction: 1,
          }),
        ],
      });
      const otherClaimFull = isItemFullyClaimed(claimedByOther);
      const otherClaimByMe = claimedByOther.claims?.some(
        (c) => c.member_id === currentMemberId
      );
      expect(otherClaimFull).toBe(true);
      expect(otherClaimByMe).toBe(false);

      // State 4: Split between me and others
      const splitWithMe = createMockItem({
        id: 'item-4',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-4',
            member_id: 'member-1',
            share_fraction: 0.5,
          }),
          createMockClaim({
            id: 'claim-2',
            receipt_item_id: 'item-4',
            member_id: 'member-2',
            share_fraction: 0.5,
          }),
        ],
      });
      const splitFull = isItemFullyClaimed(splitWithMe);
      const splitByMe = splitWithMe.claims?.some(
        (c) => c.member_id === currentMemberId
      );
      expect(splitFull).toBe(true);
      expect(splitByMe).toBe(true);

      // State 5: Partially claimed by others (can still claim more)
      const partialOther = createMockItem({
        id: 'item-5',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-5',
            member_id: 'member-2',
            share_fraction: 0.5,
          }),
        ],
      });
      const partialFull = isItemFullyClaimed(partialOther);
      const partialByMe = partialOther.claims?.some(
        (c) => c.member_id === currentMemberId
      );
      expect(partialFull).toBe(false);
      expect(partialByMe).toBe(false);
    });
  });

  describe('Tap action simulation', () => {
    /**
     * Simulates what happens when user taps an item in the UI
     */
    it('should allow unclaim when I have a claim', () => {
      const currentMemberId = 'member-1';
      const item = createMockItem({
        claims: [
          createMockClaim({
            member_id: currentMemberId,
            share_fraction: 1,
          }),
        ],
      });

      const isClaimedByMe = !!item.claims?.find((c) => c.member_id === currentMemberId);
      const isClaimed = isItemFullyClaimed(item);

      // UI Logic: if isClaimedByMe, tap should unclaim
      expect(isClaimedByMe).toBe(true);
      // Action: unclaim
    });

    it('should allow claim when item is not fully claimed and not mine', () => {
      const currentMemberId = 'member-1';
      const item = createMockItem({ claims: [] });

      const isClaimedByMe = !!item.claims?.find((c) => c.member_id === currentMemberId);
      const isClaimed = isItemFullyClaimed(item);

      expect(isClaimedByMe).toBe(false);
      expect(isClaimed).toBe(false);
      // Action: claim

      const { canClaim } = canClaimItem(item, currentMemberId);
      expect(canClaim).toBe(true);
    });

    it('should do nothing when item is fully claimed by others', () => {
      const currentMemberId = 'member-1';
      const item = createMockItem({
        claims: [
          createMockClaim({
            member_id: 'member-2',
            share_fraction: 1,
          }),
        ],
      });

      const isClaimedByMe = !!item.claims?.find((c) => c.member_id === currentMemberId);
      const isClaimed = isItemFullyClaimed(item);

      expect(isClaimedByMe).toBe(false);
      expect(isClaimed).toBe(true);
      // Action: nothing (tap is disabled or shows message)

      const { canClaim, reason } = canClaimItem(item, currentMemberId);
      expect(canClaim).toBe(false);
      expect(reason).toBe('Item is fully claimed');
    });
  });
});

// ============================================
// SECTION 9: Regression Tests
// ============================================

describe('Regression Tests (Bugs Fixed)', () => {
  /**
   * These tests verify that previously identified bugs are now fixed.
   */

  describe('FIX-001: Prevent partial claim overwrites', () => {
    /**
     * Previously: User A claims 50%, then claims again - upsert overwrites to 100%
     * Now: canClaimItem rejects if member has ANY existing claim
     */
    it('prevents partial claim from being overwritten via re-claim', () => {
      const item = createMockItem({
        id: 'item-1',
        claims: [
          createMockClaim({
            receipt_item_id: 'item-1',
            member_id: 'member-1',
            share_fraction: 0.5,
          }),
        ],
      });

      const result = canClaimItem(item, 'member-1');

      // Fixed: Returns false, blocking the re-claim
      expect(result.canClaim).toBe(false);
      expect(result.reason).toBe('You already claimed this item');
    });
  });

  describe('FIX-002: Over-claimed items detected as fully claimed', () => {
    /**
     * Previously: 200% claimed item was not considered "fully claimed"
     * Now: Any claim >= 99.9% is considered fully claimed
     */
    it('detects over-claimed items as fully claimed', () => {
      const item = createMockItem({
        total_price: 50.0,
        claims: [
          createMockClaim({ member_id: 'member-1', share_fraction: 1 }),
          createMockClaim({ id: 'c2', member_id: 'member-2', share_fraction: 1 }),
        ],
      });

      // Over-claimed (200%) is now properly detected
      expect(isItemFullyClaimed(item)).toBe(true);
      expect(getItemClaimedAmount(item)).toBe(100.0); // Still calculates the actual amount
    });
  });
});
