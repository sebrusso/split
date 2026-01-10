/**
 * Receipt Utilities Unit Tests
 *
 * Tests for receipt calculation functions, payment link generation,
 * and claim validation.
 */

import {
  roundCurrency,
  generateReceiptShareCode,
  getItemClaimedAmount,
  isItemFullyClaimed,
  getItemRemainingFraction,
  calculateMemberTotals,
  generateReceiptSummary,
  generateVenmoLink,
  generatePayPalLink,
  generateCashAppLink,
  generatePaymentLinks,
  formatClaimDescription,
  validateAllItemsClaimed,
  createClaim,
  canClaimItem,
  parseReceiptDate,
  formatReceiptDate,
  formatReceiptAmount,
  getItemClaimStatus,
} from '../lib/receipts';

import {
  Receipt,
  ReceiptItem,
  ItemClaim,
  Member,
} from '../lib/types';

// Mock data factories
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
  id: 'item-1',
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
  ...overrides,
});

const createMockClaim = (overrides: Partial<ItemClaim> = {}): ItemClaim => ({
  id: 'claim-1',
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
  id: 'member-1',
  group_id: 'group-1',
  name: 'Test User',
  user_id: null,
  clerk_user_id: null,
  created_at: '2026-01-10T00:00:00Z',
  ...overrides,
});

describe('roundCurrency', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundCurrency(10.126)).toBe(10.13);
    expect(roundCurrency(10.124)).toBe(10.12);
    expect(roundCurrency(10.125)).toBe(10.13);
  });

  it('handles whole numbers', () => {
    expect(roundCurrency(10)).toBe(10);
    expect(roundCurrency(0)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(roundCurrency(-10.126)).toBe(-10.13);
  });

  it('handles very small numbers', () => {
    expect(roundCurrency(0.001)).toBe(0);
    expect(roundCurrency(0.009)).toBe(0.01);
  });
});

describe('generateReceiptShareCode', () => {
  it('generates 8 character codes', () => {
    const code = generateReceiptShareCode();
    expect(code.length).toBe(8);
  });

  it('only uses uppercase letters and numbers', () => {
    const code = generateReceiptShareCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('excludes confusing characters (I, O, 0, 1)', () => {
    // Generate many codes to have a good sample
    for (let i = 0; i < 100; i++) {
      const code = generateReceiptShareCode();
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateReceiptShareCode());
    }
    expect(codes.size).toBe(100);
  });
});

describe('getItemClaimedAmount', () => {
  it('returns 0 for items with no claims', () => {
    const item = createMockItem({ claims: [] });
    expect(getItemClaimedAmount(item)).toBe(0);
  });

  it('returns 0 for items with undefined claims', () => {
    const item = createMockItem();
    delete item.claims;
    expect(getItemClaimedAmount(item)).toBe(0);
  });

  it('returns full amount for fully claimed item', () => {
    const item = createMockItem({
      total_price: 20.00,
      claims: [createMockClaim({ share_fraction: 1 })],
    });
    expect(getItemClaimedAmount(item)).toBe(20.00);
  });

  it('returns partial amount for split claims', () => {
    const item = createMockItem({
      total_price: 30.00,
      claims: [
        createMockClaim({ share_fraction: 0.5 }),
        createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.5 }),
      ],
    });
    expect(getItemClaimedAmount(item)).toBe(30.00);
  });

  it('handles partial claims that dont sum to 1', () => {
    const item = createMockItem({
      total_price: 30.00,
      claims: [createMockClaim({ share_fraction: 0.5 })],
    });
    expect(getItemClaimedAmount(item)).toBe(15.00);
  });
});

describe('isItemFullyClaimed', () => {
  it('returns false for items with no claims', () => {
    const item = createMockItem({ claims: [] });
    expect(isItemFullyClaimed(item)).toBe(false);
  });

  it('returns true for fully claimed item', () => {
    const item = createMockItem({
      claims: [createMockClaim({ share_fraction: 1 })],
    });
    expect(isItemFullyClaimed(item)).toBe(true);
  });

  it('returns true for item split between multiple people summing to 1', () => {
    const item = createMockItem({
      claims: [
        createMockClaim({ share_fraction: 0.333 }),
        createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.333 }),
        createMockClaim({ id: 'claim-3', member_id: 'member-3', share_fraction: 0.334 }),
      ],
    });
    expect(isItemFullyClaimed(item)).toBe(true);
  });

  it('returns false for partially claimed item', () => {
    const item = createMockItem({
      claims: [createMockClaim({ share_fraction: 0.5 })],
    });
    expect(isItemFullyClaimed(item)).toBe(false);
  });
});

describe('getItemRemainingFraction', () => {
  it('returns 1 for unclaimed items', () => {
    const item = createMockItem({ claims: [] });
    expect(getItemRemainingFraction(item)).toBe(1);
  });

  it('returns 0 for fully claimed items', () => {
    const item = createMockItem({
      claims: [createMockClaim({ share_fraction: 1 })],
    });
    expect(getItemRemainingFraction(item)).toBe(0);
  });

  it('returns correct fraction for partially claimed items', () => {
    const item = createMockItem({
      claims: [createMockClaim({ share_fraction: 0.5 })],
    });
    expect(getItemRemainingFraction(item)).toBe(0.5);
  });
});

describe('calculateMemberTotals', () => {
  it('calculates totals for a single member', () => {
    const receipt = createMockReceipt({
      tax_amount: 5.00,
      tip_amount: 10.00,
      total_amount: 65.00,
    });

    const items = [
      createMockItem({ id: 'item-1', total_price: 25.00 }),
      createMockItem({ id: 'item-2', total_price: 25.00 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-1' }),
    ];

    const members = [createMockMember()];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    expect(totals.length).toBe(1);
    expect(totals[0].memberId).toBe('member-1');
    expect(totals[0].itemsTotal).toBe(50.00);
    expect(totals[0].taxShare).toBe(5.00);
    expect(totals[0].tipShare).toBe(10.00);
    expect(totals[0].grandTotal).toBe(65.00);
  });

  it('distributes tax and tip proportionally', () => {
    const receipt = createMockReceipt({
      tax_amount: 8.00,
      tip_amount: 12.00,
      total_amount: 120.00,
    });

    const items = [
      createMockItem({ id: 'item-1', total_price: 60.00 }),
      createMockItem({ id: 'item-2', total_price: 40.00 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-2', member_id: 'member-2' }),
    ];

    const members = [
      createMockMember({ id: 'member-1', name: 'Alice' }),
      createMockMember({ id: 'member-2', name: 'Bob' }),
    ];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    // Alice: 60% of total, so 60% of tax/tip
    const alice = totals.find((t) => t.memberId === 'member-1')!;
    expect(alice.itemsTotal).toBe(60.00);
    expect(alice.taxShare).toBe(4.80); // 60% of 8
    expect(alice.tipShare).toBe(7.20); // 60% of 12
    expect(alice.grandTotal).toBe(72.00);

    // Bob: 40% of total
    const bob = totals.find((t) => t.memberId === 'member-2')!;
    expect(bob.itemsTotal).toBe(40.00);
    expect(bob.taxShare).toBe(3.20); // 40% of 8
    expect(bob.tipShare).toBe(4.80); // 40% of 12
    expect(bob.grandTotal).toBe(48.00);
  });

  it('handles split items correctly', () => {
    const receipt = createMockReceipt({
      tax_amount: 2.00,
      tip_amount: 4.00,
    });

    const items = [
      createMockItem({ id: 'item-1', total_price: 30.00 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1', share_fraction: 0.5 }),
      createMockClaim({ id: 'claim-2', receipt_item_id: 'item-1', member_id: 'member-2', share_fraction: 0.5 }),
    ];

    const members = [
      createMockMember({ id: 'member-1', name: 'Alice' }),
      createMockMember({ id: 'member-2', name: 'Bob' }),
    ];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    expect(totals.length).toBe(2);

    const alice = totals.find((t) => t.memberId === 'member-1')!;
    expect(alice.itemsTotal).toBe(15.00);
    expect(alice.taxShare).toBe(1.00);
    expect(alice.tipShare).toBe(2.00);

    const bob = totals.find((t) => t.memberId === 'member-2')!;
    expect(bob.itemsTotal).toBe(15.00);
    expect(bob.taxShare).toBe(1.00);
    expect(bob.tipShare).toBe(2.00);
  });

  it('ignores tax/tip items in calculation', () => {
    const receipt = createMockReceipt({ tax_amount: 5.00 });

    const items = [
      createMockItem({ id: 'item-1', total_price: 50.00 }),
      createMockItem({ id: 'item-2', total_price: 5.00, is_tax: true }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
    ];

    const members = [createMockMember()];

    const totals = calculateMemberTotals(receipt, items, claims, members);

    expect(totals[0].itemsTotal).toBe(50.00);
  });
});

describe('generateReceiptSummary', () => {
  it('generates correct summary with claimed and unclaimed items', () => {
    const receipt = createMockReceipt({
      merchant_name: 'Test Restaurant',
      receipt_date: '2026-01-10',
      subtotal: 100.00,
      tax_amount: 8.00,
      tip_amount: 15.00,
      total_amount: 123.00,
    });

    const items = [
      createMockItem({ id: 'item-1', total_price: 50.00 }),
      createMockItem({ id: 'item-2', total_price: 50.00 }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1', member_id: 'member-1' }),
    ];

    const members = [createMockMember()];

    const summary = generateReceiptSummary(receipt, items, claims, members);

    expect(summary.receiptId).toBe('receipt-1');
    expect(summary.merchantName).toBe('Test Restaurant');
    expect(summary.itemCount).toBe(2);
    expect(summary.claimedItemCount).toBe(1);
    expect(summary.unclaimedItemCount).toBe(1);
    expect(summary.subtotal).toBe(100.00);
    expect(summary.tax).toBe(8.00);
    expect(summary.tip).toBe(15.00);
    expect(summary.total).toBe(123.00);
  });
});

describe('Payment Link Generation', () => {
  describe('generateVenmoLink', () => {
    it('generates correct Venmo deep link', () => {
      const url = generateVenmoLink('testuser', 25.50, 'Dinner split');
      expect(url).toBe(
        'venmo://paycharge?txn=pay&recipients=testuser&amount=25.50&note=Dinner%20split'
      );
    });

    it('encodes special characters in note', () => {
      const url = generateVenmoLink('user', 10.00, 'Pizza & drinks');
      expect(url).toContain('note=Pizza%20%26%20drinks');
    });
  });

  describe('generatePayPalLink', () => {
    it('generates correct PayPal.me link', () => {
      const url = generatePayPalLink('testuser', 25.50);
      expect(url).toBe('https://paypal.me/testuser/25.50');
    });
  });

  describe('generateCashAppLink', () => {
    it('generates correct Cash App link', () => {
      const url = generateCashAppLink('testuser', 25.50);
      expect(url).toBe('https://cash.app/$testuser/25.50');
    });

    it('handles cashtag with $ prefix', () => {
      const url = generateCashAppLink('$testuser', 25.50);
      expect(url).toBe('https://cash.app/$testuser/25.50');
    });
  });

  describe('generatePaymentLinks', () => {
    it('generates links for all provided payment methods', () => {
      const links = generatePaymentLinks(25.00, {
        venmoUsername: 'venmouser',
        paypalUsername: 'paypaluser',
        cashAppTag: 'cashtag',
      }, 'Test payment');

      expect(links.length).toBe(3);
      expect(links.find((l) => l.provider === 'venmo')).toBeDefined();
      expect(links.find((l) => l.provider === 'paypal')).toBeDefined();
      expect(links.find((l) => l.provider === 'cashapp')).toBeDefined();
    });

    it('only generates links for provided methods', () => {
      const links = generatePaymentLinks(25.00, {
        venmoUsername: 'venmouser',
      }, 'Test');

      expect(links.length).toBe(1);
      expect(links[0].provider).toBe('venmo');
    });

    it('returns empty array when no methods provided', () => {
      const links = generatePaymentLinks(25.00, {}, 'Test');
      expect(links.length).toBe(0);
    });
  });
});

describe('formatClaimDescription', () => {
  it('returns item description for full claims', () => {
    const item = createMockItem({ description: 'Burger' });
    const claim = createMockClaim({ share_fraction: 1 });

    expect(formatClaimDescription(item, claim)).toBe('Burger');
  });

  it('shows split count for split claims', () => {
    const item = createMockItem({ description: 'Pizza' });
    const claim = createMockClaim({ share_fraction: 0.5, split_count: 2 });

    expect(formatClaimDescription(item, claim)).toBe('Pizza (1/2)');
  });

  it('shows percentage for partial claims', () => {
    const item = createMockItem({ description: 'Appetizer' });
    const claim = createMockClaim({ share_fraction: 0.25, split_count: 1 });

    expect(formatClaimDescription(item, claim)).toBe('Appetizer (25%)');
  });
});

describe('validateAllItemsClaimed', () => {
  it('returns valid when all items are claimed', () => {
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
    expect(result.unclaimedItems.length).toBe(0);
  });

  it('returns invalid with unclaimed items', () => {
    const items = [
      createMockItem({ id: 'item-1' }),
      createMockItem({ id: 'item-2' }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1' }),
    ];

    const result = validateAllItemsClaimed(items, claims);
    expect(result.isValid).toBe(false);
    expect(result.unclaimedItems.length).toBe(1);
    expect(result.unclaimedItems[0].id).toBe('item-2');
  });

  it('ignores tax/tip/subtotal/total items', () => {
    const items = [
      createMockItem({ id: 'item-1' }),
      createMockItem({ id: 'tax-item', is_tax: true }),
      createMockItem({ id: 'tip-item', is_tip: true }),
    ];

    const claims = [
      createMockClaim({ receipt_item_id: 'item-1' }),
    ];

    const result = validateAllItemsClaimed(items, claims);
    expect(result.isValid).toBe(true);
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

  it('creates a split claim with correct fraction', () => {
    const claim = createClaim('item-1', 'member-1', { splitCount: 3 });

    expect(claim.claim_type).toBe('split');
    expect(claim.share_fraction).toBeCloseTo(0.333, 2);
    expect(claim.split_count).toBe(3);
  });

  it('uses custom share fraction when provided', () => {
    const claim = createClaim('item-1', 'member-1', { shareFraction: 0.25 });

    expect(claim.share_fraction).toBe(0.25);
  });

  it('uses custom claim source', () => {
    const claim = createClaim('item-1', 'member-1', { claimedVia: 'imessage' });

    expect(claim.claimed_via).toBe('imessage');
  });
});

describe('canClaimItem', () => {
  it('returns true for unclaimed regular items', () => {
    const item = createMockItem({ claims: [] });
    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(true);
  });

  it('returns false for tax items', () => {
    const item = createMockItem({ is_tax: true });
    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(false);
    expect(result.reason).toBe('This item cannot be claimed');
  });

  it('returns false for tip items', () => {
    const item = createMockItem({ is_tip: true });
    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(false);
  });

  it('returns false for fully claimed items', () => {
    const item = createMockItem({
      claims: [createMockClaim({ share_fraction: 1 })],
    });
    const result = canClaimItem(item, 'member-2');

    expect(result.canClaim).toBe(false);
    expect(result.reason).toBe('Item is fully claimed');
  });

  it('returns false if member already claimed full item', () => {
    const item = createMockItem({
      claims: [createMockClaim({ member_id: 'member-1', share_fraction: 1 })],
    });
    const result = canClaimItem(item, 'member-1');

    expect(result.canClaim).toBe(false);
    expect(result.reason).toBe('You already claimed this item');
  });
});

describe('parseReceiptDate', () => {
  it('parses ISO date strings', () => {
    const date = parseReceiptDate('2026-01-10');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(0); // January is 0
    expect(date!.getDate()).toBe(10);
  });

  it('parses MM/DD/YYYY format', () => {
    const date = parseReceiptDate('01/15/2026');
    expect(date).not.toBeNull();
    expect(date!.getMonth()).toBe(0);
    expect(date!.getDate()).toBe(15);
    expect(date!.getFullYear()).toBe(2026);
  });

  it('returns null for invalid dates', () => {
    expect(parseReceiptDate('invalid')).toBeNull();
    expect(parseReceiptDate('')).toBeNull();
    expect(parseReceiptDate(null)).toBeNull();
    expect(parseReceiptDate(undefined)).toBeNull();
  });
});

describe('formatReceiptDate', () => {
  it('formats dates correctly', () => {
    const formatted = formatReceiptDate('2026-01-10');
    expect(formatted).toBe('Jan 10, 2026');
  });

  it('returns "Unknown date" for invalid dates', () => {
    expect(formatReceiptDate(null)).toBe('Unknown date');
    expect(formatReceiptDate(undefined)).toBe('Unknown date');
    expect(formatReceiptDate('invalid')).toBe('Unknown date');
  });
});

describe('formatReceiptAmount', () => {
  it('formats USD amounts correctly', () => {
    expect(formatReceiptAmount(25.00, 'USD')).toBe('$25.00');
    expect(formatReceiptAmount(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('formats EUR amounts correctly', () => {
    const formatted = formatReceiptAmount(25.00, 'EUR');
    expect(formatted).toContain('25');
    expect(formatted).toContain('€');
  });

  it('handles zero amounts', () => {
    expect(formatReceiptAmount(0, 'USD')).toBe('$0.00');
  });
});

describe('getItemClaimStatus', () => {
  it('returns "Unclaimed" for items with no claims', () => {
    const item = createMockItem({ claims: [] });
    expect(getItemClaimStatus(item)).toBe('Unclaimed');
  });

  it('returns claimer name for fully claimed item', () => {
    const item = createMockItem({
      claims: [createMockClaim({ member: createMockMember({ name: 'Alice' }) })],
    });
    expect(getItemClaimStatus(item)).toBe('Claimed by Alice');
  });

  it('returns split info for multi-person claims', () => {
    const item = createMockItem({
      claims: [
        createMockClaim({ share_fraction: 0.5 }),
        createMockClaim({ id: 'claim-2', member_id: 'member-2', share_fraction: 0.5 }),
      ],
    });
    expect(getItemClaimStatus(item)).toBe('Split 2 ways');
  });

  it('returns percentage for partially claimed items', () => {
    const item = createMockItem({
      claims: [createMockClaim({ share_fraction: 0.5 })],
    });
    expect(getItemClaimStatus(item)).toBe('50% claimed');
  });
});
