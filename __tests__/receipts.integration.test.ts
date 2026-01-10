/**
 * Receipt Integration Tests
 *
 * Tests for receipt CRUD operations, item claiming,
 * and database constraints.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzwuknfycyqitcbotsvx.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d3VrbmZ5Y3lxaXRjYm90c3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Nzc0MTcsImV4cCI6MjA4MzE1MzQxN30.TKXVVOCaiV-wX--V4GEPNg2yupF-ERSZFMfekve2yt8';

let supabase: SupabaseClient;
let testGroupId: string;
let testMemberIds: string[] = [];
let testReceiptId: string;
let testItemIds: string[] = [];

beforeAll(() => {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
});

// Setup: Create test group and members
beforeAll(async () => {
  // Create test group
  const { data: group } = await supabase
    .from('groups')
    .insert({
      name: 'Receipt Test Group',
      emoji: '🧾',
      share_code: 'RCPT' + Date.now(),
    })
    .select()
    .single();

  testGroupId = group!.id;

  // Create test members
  const { data: members } = await supabase
    .from('members')
    .insert([
      { group_id: testGroupId, name: 'Receipt Alice' },
      { group_id: testGroupId, name: 'Receipt Bob' },
      { group_id: testGroupId, name: 'Receipt Charlie' },
    ])
    .select();

  testMemberIds = members!.map((m) => m.id);
});

// Cleanup
afterAll(async () => {
  // Delete in correct order (respecting foreign keys)
  if (testItemIds.length > 0) {
    await supabase.from('item_claims').delete().in('receipt_item_id', testItemIds);
    await supabase.from('receipt_items').delete().in('id', testItemIds);
  }

  if (testReceiptId) {
    await supabase.from('receipt_member_totals').delete().eq('receipt_id', testReceiptId);
    await supabase.from('receipts').delete().eq('id', testReceiptId);
  }

  if (testMemberIds.length > 0) {
    for (const id of testMemberIds) {
      await supabase.from('members').delete().eq('id', id);
    }
  }

  if (testGroupId) {
    await supabase.from('groups').delete().eq('id', testGroupId);
  }
});

describe('Receipts CRUD', () => {
  it('should create a receipt', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .insert({
        group_id: testGroupId,
        uploaded_by: testMemberIds[0],
        image_url: 'https://example.com/test-receipt.jpg',
        ocr_status: 'pending',
        status: 'draft',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.group_id).toBe(testGroupId);
    expect(data.uploaded_by).toBe(testMemberIds[0]);
    expect(data.ocr_status).toBe('pending');
    expect(data.status).toBe('draft');

    testReceiptId = data.id;
  });

  it('should read a receipt with uploader info', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*, uploader:members!uploaded_by(id, name)')
      .eq('id', testReceiptId)
      .single();

    expect(error).toBeNull();
    expect(data.uploader.name).toBe('Receipt Alice');
  });

  it('should update receipt with OCR results', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .update({
        ocr_status: 'completed',
        ocr_provider: 'claude',
        ocr_confidence: 0.95,
        merchant_name: 'Test Restaurant',
        receipt_date: '2026-01-10',
        subtotal: 80.00,
        tax_amount: 6.40,
        tip_amount: 16.00,
        total_amount: 102.40,
        status: 'claiming',
      })
      .eq('id', testReceiptId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.ocr_status).toBe('completed');
    expect(data.merchant_name).toBe('Test Restaurant');
    expect(parseFloat(data.total_amount)).toBe(102.40);
  });

  it('should enforce valid ocr_status', async () => {
    const { error } = await supabase
      .from('receipts')
      .update({ ocr_status: 'invalid_status' })
      .eq('id', testReceiptId);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23514'); // Check constraint violation
  });

  it('should enforce valid status', async () => {
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'invalid_status' })
      .eq('id', testReceiptId);

    expect(error).not.toBeNull();
  });

  it('should enforce unique share_code', async () => {
    // First, set a share code
    await supabase
      .from('receipts')
      .update({ share_code: 'UNIQUE123' })
      .eq('id', testReceiptId);

    // Create another receipt and try to use the same share code
    const { data: receipt2 } = await supabase
      .from('receipts')
      .insert({
        group_id: testGroupId,
        uploaded_by: testMemberIds[0],
        image_url: 'https://example.com/receipt2.jpg',
      })
      .select()
      .single();

    const { error } = await supabase
      .from('receipts')
      .update({ share_code: 'UNIQUE123' })
      .eq('id', receipt2!.id);

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23505'); // Unique constraint violation

    // Cleanup
    await supabase.from('receipts').delete().eq('id', receipt2!.id);
  });
});

describe('Receipt Items CRUD', () => {
  it('should create receipt items', async () => {
    const items = [
      {
        receipt_id: testReceiptId,
        description: 'Burger Deluxe',
        quantity: 1,
        unit_price: 18.99,
        total_price: 18.99,
        line_number: 1,
      },
      {
        receipt_id: testReceiptId,
        description: 'Fish & Chips',
        quantity: 1,
        unit_price: 16.50,
        total_price: 16.50,
        line_number: 2,
      },
      {
        receipt_id: testReceiptId,
        description: 'Margherita Pizza',
        quantity: 1,
        unit_price: 22.00,
        total_price: 22.00,
        line_number: 3,
      },
      {
        receipt_id: testReceiptId,
        description: 'Craft Beer x2',
        quantity: 2,
        unit_price: 9.00,
        total_price: 18.00,
        line_number: 4,
      },
    ];

    const { data, error } = await supabase
      .from('receipt_items')
      .insert(items)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(4);

    testItemIds = data!.map((i) => i.id);
  });

  it('should read items by receipt_id', async () => {
    const { data, error } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', testReceiptId)
      .order('line_number');

    expect(error).toBeNull();
    expect(data).toHaveLength(4);
    expect(data![0].description).toBe('Burger Deluxe');
  });

  it('should enforce non-empty description', async () => {
    const { error } = await supabase.from('receipt_items').insert({
      receipt_id: testReceiptId,
      description: '',
      total_price: 10.00,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23514'); // Check constraint
  });

  it('should enforce non-negative total_price', async () => {
    const { error } = await supabase.from('receipt_items').insert({
      receipt_id: testReceiptId,
      description: 'Negative Item',
      total_price: -10.00,
    });

    expect(error).not.toBeNull();
  });

  it('should enforce positive quantity', async () => {
    const { error } = await supabase.from('receipt_items').insert({
      receipt_id: testReceiptId,
      description: 'Zero Quantity',
      quantity: 0,
      total_price: 10.00,
    });

    expect(error).not.toBeNull();
  });
});

describe('Item Claims CRUD', () => {
  it('should create a claim for an item', async () => {
    const { data, error } = await supabase
      .from('item_claims')
      .insert({
        receipt_item_id: testItemIds[0],
        member_id: testMemberIds[0],
        claim_type: 'full',
        share_fraction: 1.0,
        split_count: 1,
        claimed_via: 'app',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.share_fraction).toBe('1.0000'); // DECIMAL(5,4)
    expect(data.claimed_via).toBe('app');
  });

  it('should create split claims', async () => {
    // Split item between two members
    const claims = [
      {
        receipt_item_id: testItemIds[1],
        member_id: testMemberIds[1],
        claim_type: 'split',
        share_fraction: 0.5,
        split_count: 2,
      },
      {
        receipt_item_id: testItemIds[1],
        member_id: testMemberIds[2],
        claim_type: 'split',
        share_fraction: 0.5,
        split_count: 2,
      },
    ];

    const { data, error } = await supabase
      .from('item_claims')
      .insert(claims)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('should read claims with member info', async () => {
    const { data, error } = await supabase
      .from('item_claims')
      .select('*, member:members(id, name)')
      .eq('receipt_item_id', testItemIds[0]);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].member.name).toBe('Receipt Alice');
  });

  it('should enforce unique claim per member per item', async () => {
    const { error } = await supabase.from('item_claims').insert({
      receipt_item_id: testItemIds[0],
      member_id: testMemberIds[0], // Already claimed by this member
      share_fraction: 0.5,
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23505'); // Unique constraint
  });

  it('should enforce valid claim_type', async () => {
    const { error } = await supabase.from('item_claims').insert({
      receipt_item_id: testItemIds[2],
      member_id: testMemberIds[0],
      claim_type: 'invalid_type',
      share_fraction: 1.0,
    });

    expect(error).not.toBeNull();
  });

  it('should enforce valid claimed_via', async () => {
    const { error } = await supabase.from('item_claims').insert({
      receipt_item_id: testItemIds[2],
      member_id: testMemberIds[0],
      claimed_via: 'invalid_source',
      share_fraction: 1.0,
    });

    expect(error).not.toBeNull();
  });

  it('should enforce share_fraction between 0 and 1', async () => {
    // Test > 1
    const { error: overError } = await supabase.from('item_claims').insert({
      receipt_item_id: testItemIds[2],
      member_id: testMemberIds[0],
      share_fraction: 1.5,
    });

    expect(overError).not.toBeNull();

    // Test <= 0
    const { error: zeroError } = await supabase.from('item_claims').insert({
      receipt_item_id: testItemIds[2],
      member_id: testMemberIds[0],
      share_fraction: 0,
    });

    expect(zeroError).not.toBeNull();
  });
});

describe('Receipt Member Totals', () => {
  it('should auto-calculate member totals after claim', async () => {
    // Wait a moment for the trigger to execute
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { data, error } = await supabase
      .from('receipt_member_totals')
      .select('*')
      .eq('receipt_id', testReceiptId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    // Should have entries for members who have claims
    expect(data!.length).toBeGreaterThan(0);
  });

  it('should have correct items_total for Alice', async () => {
    const { data } = await supabase
      .from('receipt_member_totals')
      .select('*')
      .eq('receipt_id', testReceiptId)
      .eq('member_id', testMemberIds[0])
      .single();

    // Alice claimed the Burger Deluxe ($18.99)
    expect(parseFloat(data?.items_total || '0')).toBe(18.99);
  });

  it('should update totals when claims change', async () => {
    // Add another claim for Alice
    await supabase.from('item_claims').insert({
      receipt_item_id: testItemIds[2], // Pizza
      member_id: testMemberIds[0],
      share_fraction: 1.0,
    });

    // Wait for trigger
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { data } = await supabase
      .from('receipt_member_totals')
      .select('*')
      .eq('receipt_id', testReceiptId)
      .eq('member_id', testMemberIds[0])
      .single();

    // Alice now has Burger ($18.99) + Pizza ($22.00)
    expect(parseFloat(data?.items_total || '0')).toBe(40.99);
  });
});

describe('Foreign Key Constraints', () => {
  it('should not allow receipt with invalid group_id', async () => {
    const { error } = await supabase.from('receipts').insert({
      group_id: '00000000-0000-0000-0000-000000000000',
      uploaded_by: testMemberIds[0],
      image_url: 'https://example.com/invalid.jpg',
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23503'); // Foreign key violation
  });

  it('should not allow receipt with invalid uploaded_by', async () => {
    const { error } = await supabase.from('receipts').insert({
      group_id: testGroupId,
      uploaded_by: '00000000-0000-0000-0000-000000000000',
      image_url: 'https://example.com/invalid.jpg',
    });

    expect(error).not.toBeNull();
  });

  it('should not allow item with invalid receipt_id', async () => {
    const { error } = await supabase.from('receipt_items').insert({
      receipt_id: '00000000-0000-0000-0000-000000000000',
      description: 'Invalid',
      total_price: 10.00,
    });

    expect(error).not.toBeNull();
  });

  it('should not allow claim with invalid receipt_item_id', async () => {
    const { error } = await supabase.from('item_claims').insert({
      receipt_item_id: '00000000-0000-0000-0000-000000000000',
      member_id: testMemberIds[0],
      share_fraction: 1.0,
    });

    expect(error).not.toBeNull();
  });

  it('should not allow claim with invalid member_id', async () => {
    const { error } = await supabase.from('item_claims').insert({
      receipt_item_id: testItemIds[3],
      member_id: '00000000-0000-0000-0000-000000000000',
      share_fraction: 1.0,
    });

    expect(error).not.toBeNull();
  });
});

describe('Cascade Deletes', () => {
  let tempReceiptId: string;
  let tempItemId: string;

  beforeAll(async () => {
    // Create temp receipt and item
    const { data: receipt } = await supabase
      .from('receipts')
      .insert({
        group_id: testGroupId,
        uploaded_by: testMemberIds[0],
        image_url: 'https://example.com/temp.jpg',
      })
      .select()
      .single();

    tempReceiptId = receipt!.id;

    const { data: item } = await supabase
      .from('receipt_items')
      .insert({
        receipt_id: tempReceiptId,
        description: 'Temp Item',
        total_price: 10.00,
      })
      .select()
      .single();

    tempItemId = item!.id;

    // Add a claim
    await supabase.from('item_claims').insert({
      receipt_item_id: tempItemId,
      member_id: testMemberIds[0],
      share_fraction: 1.0,
    });
  });

  it('should cascade delete claims when item is deleted', async () => {
    // Delete the item
    await supabase.from('receipt_items').delete().eq('id', tempItemId);

    // Verify claims are gone
    const { data: claims } = await supabase
      .from('item_claims')
      .select('*')
      .eq('receipt_item_id', tempItemId);

    expect(claims).toHaveLength(0);
  });

  it('should cascade delete items and totals when receipt is deleted', async () => {
    // Delete the receipt
    await supabase.from('receipts').delete().eq('id', tempReceiptId);

    // Verify items are gone
    const { data: items } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', tempReceiptId);

    expect(items).toHaveLength(0);

    // Verify totals are gone
    const { data: totals } = await supabase
      .from('receipt_member_totals')
      .select('*')
      .eq('receipt_id', tempReceiptId);

    expect(totals).toHaveLength(0);
  });
});

describe('Receipt Claiming Flow - Full Scenario', () => {
  let scenarioReceiptId: string;
  let scenarioItemIds: string[];

  beforeAll(async () => {
    // Create a complete receipt scenario
    const { data: receipt } = await supabase
      .from('receipts')
      .insert({
        group_id: testGroupId,
        uploaded_by: testMemberIds[0],
        image_url: 'https://example.com/scenario.jpg',
        merchant_name: 'Scenario Restaurant',
        subtotal: 100.00,
        tax_amount: 8.00,
        tip_amount: 20.00,
        total_amount: 128.00,
        status: 'claiming',
        ocr_status: 'completed',
      })
      .select()
      .single();

    scenarioReceiptId = receipt!.id;

    // Create items
    const { data: items } = await supabase
      .from('receipt_items')
      .insert([
        { receipt_id: scenarioReceiptId, description: 'Item A', total_price: 40.00, line_number: 1 },
        { receipt_id: scenarioReceiptId, description: 'Item B', total_price: 30.00, line_number: 2 },
        { receipt_id: scenarioReceiptId, description: 'Item C', total_price: 30.00, line_number: 3 },
      ])
      .select();

    scenarioItemIds = items!.map((i) => i.id);
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from('item_claims').delete().in('receipt_item_id', scenarioItemIds);
    await supabase.from('receipt_items').delete().in('id', scenarioItemIds);
    await supabase.from('receipt_member_totals').delete().eq('receipt_id', scenarioReceiptId);
    await supabase.from('receipts').delete().eq('id', scenarioReceiptId);
  });

  it('should handle complex claiming scenario', async () => {
    // Alice claims Item A ($40)
    await supabase.from('item_claims').insert({
      receipt_item_id: scenarioItemIds[0],
      member_id: testMemberIds[0],
      share_fraction: 1.0,
    });

    // Bob claims Item B ($30)
    await supabase.from('item_claims').insert({
      receipt_item_id: scenarioItemIds[1],
      member_id: testMemberIds[1],
      share_fraction: 1.0,
    });

    // Alice and Bob split Item C ($30)
    await supabase.from('item_claims').insert([
      { receipt_item_id: scenarioItemIds[2], member_id: testMemberIds[0], share_fraction: 0.5, split_count: 2 },
      { receipt_item_id: scenarioItemIds[2], member_id: testMemberIds[1], share_fraction: 0.5, split_count: 2 },
    ]);

    // Wait for triggers
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify totals
    const { data: totals } = await supabase
      .from('receipt_member_totals')
      .select('*')
      .eq('receipt_id', scenarioReceiptId);

    expect(totals).toHaveLength(2);

    // Alice: $40 + $15 = $55 items (55% of $100)
    // Tax share: 55% of $8 = $4.40
    // Tip share: 55% of $20 = $11.00
    // Total: $55 + $4.40 + $11 = $70.40
    const alice = totals!.find((t) => t.member_id === testMemberIds[0]);
    expect(parseFloat(alice!.items_total)).toBe(55.00);
    expect(parseFloat(alice!.tax_share)).toBe(4.40);
    expect(parseFloat(alice!.tip_share)).toBe(11.00);
    expect(parseFloat(alice!.grand_total)).toBe(70.40);

    // Bob: $30 + $15 = $45 items (45% of $100)
    // Tax share: 45% of $8 = $3.60
    // Tip share: 45% of $20 = $9.00
    // Total: $45 + $3.60 + $9 = $57.60
    const bob = totals!.find((t) => t.member_id === testMemberIds[1]);
    expect(parseFloat(bob!.items_total)).toBe(45.00);
    expect(parseFloat(bob!.tax_share)).toBe(3.60);
    expect(parseFloat(bob!.tip_share)).toBe(9.00);
    expect(parseFloat(bob!.grand_total)).toBe(57.60);
  });

  it('should verify totals sum to receipt total', async () => {
    const { data: totals } = await supabase
      .from('receipt_member_totals')
      .select('grand_total')
      .eq('receipt_id', scenarioReceiptId);

    const sum = totals!.reduce((acc, t) => acc + parseFloat(t.grand_total), 0);

    // Should equal receipt total ($128.00)
    expect(sum).toBe(128.00);
  });
});
