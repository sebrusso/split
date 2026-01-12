/**
 * Settlement Links Unit Tests
 *
 * Tests for shareable settlement link generation,
 * URL creation, and settlement summaries.
 *
 * Note: These tests only cover pure functions that don't require
 * database connections. Integration tests are in a separate file.
 */

// Mock the supabase module to prevent connection errors
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock user-profile to prevent cascading imports
jest.mock('../lib/user-profile', () => ({
  getVenmoUsernamesForMembers: jest.fn(() => Promise.resolve(new Map())),
}));

import {
  generateSettlementShareCode,
  getSettlementLinkUrl,
  getSettlementShareMessage,
  getIndividualSettlementMessage,
  generateSettlementSummary,
  getSettlementsByDebtor,
  getSettlementsByCreditor,
  type SettlementLinkData,
  type SettlementItem,
} from '../lib/settlement-links';

// ============================================
// Mock Data
// ============================================

const createMockSettlementItem = (overrides: Partial<SettlementItem> = {}): SettlementItem => ({
  fromMemberId: 'member-1',
  fromMemberName: 'Alice',
  toMemberId: 'member-2',
  toMemberName: 'Bob',
  amount: 25.00,
  paymentLinks: [],
  ...overrides,
});

const createMockSettlementLinkData = (
  overrides: Partial<SettlementLinkData> = {}
): SettlementLinkData => ({
  id: 'link-1',
  groupId: 'group-1',
  groupName: 'Test Group',
  currency: 'USD',
  createdBy: 'user-1',
  createdAt: '2026-01-12T00:00:00Z',
  expiresAt: '2026-01-19T00:00:00Z',
  shareCode: 'ABCD1234',
  settlements: [createMockSettlementItem()],
  ...overrides,
});

// ============================================
// Share Code Generation Tests
// ============================================

describe('generateSettlementShareCode', () => {
  it('generates 8 character codes', () => {
    const code = generateSettlementShareCode();
    expect(code.length).toBe(8);
  });

  it('only uses uppercase letters and numbers', () => {
    const code = generateSettlementShareCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('excludes confusing characters (I, O, 0, 1)', () => {
    // Generate many codes to have a good sample
    for (let i = 0; i < 100; i++) {
      const code = generateSettlementShareCode();
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateSettlementShareCode());
    }
    expect(codes.size).toBe(100);
  });
});

// ============================================
// URL Generation Tests
// ============================================

describe('getSettlementLinkUrl', () => {
  it('generates correct URL format', () => {
    const url = getSettlementLinkUrl('ABCD1234');
    expect(url).toBe('https://splitfree.app/settle/ABCD1234');
  });

  it('handles different share codes', () => {
    const url1 = getSettlementLinkUrl('XYZ12345');
    const url2 = getSettlementLinkUrl('TEST9876');

    expect(url1).toBe('https://splitfree.app/settle/XYZ12345');
    expect(url2).toBe('https://splitfree.app/settle/TEST9876');
  });
});

// ============================================
// Share Message Tests
// ============================================

describe('getSettlementShareMessage', () => {
  it('generates correct share message', () => {
    const linkData = createMockSettlementLinkData({
      groupName: 'Roommates',
      settlements: [
        createMockSettlementItem({ amount: 50.00 }),
        createMockSettlementItem({ amount: 25.00 }),
      ],
    });

    const message = getSettlementShareMessage(linkData);

    expect(message).toContain('Roommates - Settle Up');
    expect(message).toContain('Total outstanding: $75.00');
    expect(message).toContain('https://splitfree.app/settle/ABCD1234');
  });

  it('calculates total amount correctly', () => {
    const linkData = createMockSettlementLinkData({
      settlements: [
        createMockSettlementItem({ amount: 100.00 }),
        createMockSettlementItem({ amount: 50.00 }),
        createMockSettlementItem({ amount: 25.50 }),
      ],
    });

    const message = getSettlementShareMessage(linkData);
    expect(message).toContain('$175.50');
  });
});

describe('getIndividualSettlementMessage', () => {
  it('generates basic message', () => {
    const settlement = createMockSettlementItem({
      fromMemberName: 'Alice',
      toMemberName: 'Bob',
      amount: 50.00,
    });

    const message = getIndividualSettlementMessage(settlement, 'Dinner Group', 'USD');

    expect(message).toContain('Dinner Group');
    expect(message).toContain('You owe Bob $50.00');
  });

  it('includes Venmo link when available', () => {
    const settlement = createMockSettlementItem({
      toMemberName: 'Bob',
      amount: 50.00,
      paymentLinks: [
        {
          app: 'venmo',
          displayName: 'Venmo',
          url: 'venmo://paycharge?...',
          webUrl: 'https://venmo.com/paycharge?...',
        },
      ],
    });

    const message = getIndividualSettlementMessage(settlement, 'Test', 'USD');

    expect(message).toContain('Pay via Venmo:');
    expect(message).toContain('https://venmo.com/paycharge');
  });
});

// ============================================
// Summary Generation Tests
// ============================================

describe('generateSettlementSummary', () => {
  it('generates correct summary format', () => {
    const linkData = createMockSettlementLinkData({
      groupName: 'Weekend Trip',
      currency: 'USD',
      settlements: [
        createMockSettlementItem({
          fromMemberName: 'Alice',
          toMemberName: 'Bob',
          amount: 50.00,
        }),
        createMockSettlementItem({
          fromMemberName: 'Charlie',
          toMemberName: 'Bob',
          amount: 30.00,
        }),
      ],
    });

    const summary = generateSettlementSummary(linkData);

    expect(summary).toContain('Weekend Trip - Settlement Summary');
    expect(summary).toContain('Currency: USD');
    expect(summary).toContain('Alice → Bob: $50.00');
    expect(summary).toContain('Charlie → Bob: $30.00');
    expect(summary).toContain('Total: $80.00');
  });

  it('handles single settlement', () => {
    const linkData = createMockSettlementLinkData({
      settlements: [
        createMockSettlementItem({ amount: 100.00 }),
      ],
    });

    const summary = generateSettlementSummary(linkData);

    expect(summary).toContain('Total: $100.00');
  });

  it('handles empty settlements', () => {
    const linkData = createMockSettlementLinkData({
      settlements: [],
    });

    const summary = generateSettlementSummary(linkData);

    expect(summary).toContain('Total: $0.00');
  });
});

// ============================================
// Settlement Grouping Tests
// ============================================

describe('getSettlementsByDebtor', () => {
  it('groups settlements by debtor', () => {
    const settlements: SettlementItem[] = [
      createMockSettlementItem({
        fromMemberId: 'alice',
        fromMemberName: 'Alice',
        toMemberId: 'bob',
        amount: 50.00,
      }),
      createMockSettlementItem({
        fromMemberId: 'alice',
        fromMemberName: 'Alice',
        toMemberId: 'charlie',
        amount: 30.00,
      }),
      createMockSettlementItem({
        fromMemberId: 'bob',
        fromMemberName: 'Bob',
        toMemberId: 'charlie',
        amount: 20.00,
      }),
    ];

    const byDebtor = getSettlementsByDebtor(settlements);

    expect(byDebtor.size).toBe(2);
    expect(byDebtor.get('alice')?.length).toBe(2);
    expect(byDebtor.get('bob')?.length).toBe(1);
  });

  it('handles empty settlements', () => {
    const byDebtor = getSettlementsByDebtor([]);
    expect(byDebtor.size).toBe(0);
  });
});

describe('getSettlementsByCreditor', () => {
  it('groups settlements by creditor', () => {
    const settlements: SettlementItem[] = [
      createMockSettlementItem({
        fromMemberId: 'alice',
        toMemberId: 'bob',
        toMemberName: 'Bob',
        amount: 50.00,
      }),
      createMockSettlementItem({
        fromMemberId: 'charlie',
        toMemberId: 'bob',
        toMemberName: 'Bob',
        amount: 30.00,
      }),
      createMockSettlementItem({
        fromMemberId: 'alice',
        toMemberId: 'charlie',
        toMemberName: 'Charlie',
        amount: 20.00,
      }),
    ];

    const byCreditor = getSettlementsByCreditor(settlements);

    expect(byCreditor.size).toBe(2);
    expect(byCreditor.get('bob')?.length).toBe(2);
    expect(byCreditor.get('charlie')?.length).toBe(1);
  });

  it('handles empty settlements', () => {
    const byCreditor = getSettlementsByCreditor([]);
    expect(byCreditor.size).toBe(0);
  });
});
