/**
 * Receipt Scanning Flow Integration Tests
 *
 * Tests the group-agnostic scanning workflow:
 * Scan → Upload (no group) → Assign Group → Share
 *
 * Tests both:
 * 1. Database constraints for nullable group_id
 * 2. RLS policies for unassigned receipts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateShareCode } from '../lib/utils';

const supabaseUrl = 'https://rzwuknfycyqitcbotsvx.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d3VrbmZ5Y3lxaXRjYm90c3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Nzc0MTcsImV4cCI6MjA4MzE1MzQxN30.TKXVVOCaiV-wX--V4GEPNg2yupF-ERSZFMfekve2yt8';

let supabase: SupabaseClient;

// Test data - will be cleaned up
let testGroupId: string;
let testMemberIds: string[] = [];
let testUnassignedReceiptId: string;
let testAssignedReceiptId: string;
const testClerkUserId = 'test_clerk_user_' + Date.now();
const testClerkUserId2 = 'test_clerk_user_2_' + Date.now();

beforeAll(() => {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
});

// Setup: Create test group and members
beforeAll(async () => {
  // Create test group
  const shareCode = await generateShareCode();
  const { data: group } = await supabase
    .from('groups')
    .insert({
      name: 'Scan Flow Test Group',
      emoji: '📷',
      share_code: shareCode,
    })
    .select()
    .single();

  testGroupId = group!.id;

  // Create test members (one linked to our test clerk user)
  const { data: members } = await supabase
    .from('members')
    .insert([
      { group_id: testGroupId, name: 'Scanner User', clerk_user_id: testClerkUserId },
      { group_id: testGroupId, name: 'Other User', clerk_user_id: testClerkUserId2 },
    ])
    .select();

  testMemberIds = members!.map((m) => m.id);
});

// Cleanup
afterAll(async () => {
  // Delete receipt items first
  if (testUnassignedReceiptId) {
    await supabase.from('receipt_items').delete().eq('receipt_id', testUnassignedReceiptId);
    await supabase.from('receipt_member_totals').delete().eq('receipt_id', testUnassignedReceiptId);
  }
  if (testAssignedReceiptId) {
    await supabase.from('receipt_items').delete().eq('receipt_id', testAssignedReceiptId);
    await supabase.from('receipt_member_totals').delete().eq('receipt_id', testAssignedReceiptId);
  }

  // Delete receipts
  if (testUnassignedReceiptId) {
    await supabase.from('receipts').delete().eq('id', testUnassignedReceiptId);
  }
  if (testAssignedReceiptId) {
    await supabase.from('receipts').delete().eq('id', testAssignedReceiptId);
  }

  // Delete members
  for (const id of testMemberIds) {
    await supabase.from('members').delete().eq('id', id);
  }

  // Delete group
  if (testGroupId) {
    await supabase.from('groups').delete().eq('id', testGroupId);
  }
});

describe('Unassigned Receipt Creation', () => {
  it('should create receipt with null group_id and uploaded_by', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .insert({
        group_id: null,
        uploaded_by: null,
        uploaded_by_clerk_id: testClerkUserId,
        image_url: 'https://example.com/unassigned-receipt.jpg',
        ocr_status: 'pending',
        status: 'draft',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.group_id).toBeNull();
    expect(data.uploaded_by).toBeNull();
    expect(data.uploaded_by_clerk_id).toBe(testClerkUserId);
    expect(data.status).toBe('draft');

    testUnassignedReceiptId = data.id;
  });

  it('should set uploaded_by_clerk_id for ownership tracking', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('uploaded_by_clerk_id')
      .eq('id', testUnassignedReceiptId)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.uploaded_by_clerk_id).toBe(testClerkUserId);
  });

  it('should allow reading unassigned receipts', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', testUnassignedReceiptId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.id).toBe(testUnassignedReceiptId);
  });

  it('should allow updating unassigned receipts', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .update({
        merchant_name: 'Test Merchant',
        total_amount: 42.50,
        ocr_status: 'completed',
      })
      .eq('id', testUnassignedReceiptId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.merchant_name).toBe('Test Merchant');
    expect(parseFloat(data.total_amount)).toBe(42.50);
    expect(data.ocr_status).toBe('completed');
  });
});

describe('Receipt Items on Unassigned Receipts', () => {
  let testItemId: string;

  it('should allow creating items on unassigned receipt', async () => {
    const { data, error } = await supabase
      .from('receipt_items')
      .insert({
        receipt_id: testUnassignedReceiptId,
        description: 'Test Item 1',
        quantity: 2,
        unit_price: 5.00,
        total_price: 10.00,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.description).toBe('Test Item 1');
    expect(parseFloat(data.total_price)).toBe(10.00);

    testItemId = data.id;
  });

  it('should allow reading items on unassigned receipt', async () => {
    const { data, error } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', testUnassignedReceiptId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].description).toBe('Test Item 1');
  });

  afterAll(async () => {
    // Clean up test item
    if (testItemId) {
      await supabase.from('receipt_items').delete().eq('id', testItemId);
    }
  });
});

describe('Receipt Group Assignment', () => {
  it('should create a new unassigned receipt for assignment test', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .insert({
        group_id: null,
        uploaded_by: null,
        uploaded_by_clerk_id: testClerkUserId,
        image_url: 'https://example.com/to-be-assigned.jpg',
        merchant_name: 'Assignment Test Store',
        total_amount: 100.00,
        ocr_status: 'completed',
        status: 'draft',
      })
      .select()
      .single();

    expect(error).toBeNull();
    testAssignedReceiptId = data.id;
  });

  it('should assign group_id to unassigned receipt', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .update({
        group_id: testGroupId,
      })
      .eq('id', testAssignedReceiptId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.group_id).toBe(testGroupId);
  });

  it('should set uploaded_by (member_id) when assigning group', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .update({
        uploaded_by: testMemberIds[0],
      })
      .eq('id', testAssignedReceiptId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.uploaded_by).toBe(testMemberIds[0]);
  });

  it('should generate share_code on assignment', async () => {
    const shareCode = await generateShareCode();

    const { data, error } = await supabase
      .from('receipts')
      .update({
        share_code: shareCode,
        status: 'claiming',
      })
      .eq('id', testAssignedReceiptId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.share_code).toBe(shareCode);
    expect(data.status).toBe('claiming');
  });

  it('should allow reading assigned receipt by group member', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*, uploader:members!uploaded_by(name)')
      .eq('id', testAssignedReceiptId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.group_id).toBe(testGroupId);
    expect(data.uploader).toBeDefined();
    expect(data.uploader.name).toBe('Scanner User');
  });
});

describe('Receipt Status Transitions', () => {
  it('should transition from draft to claiming when group assigned', async () => {
    // First verify draft status
    const { data: beforeData } = await supabase
      .from('receipts')
      .select('status')
      .eq('id', testUnassignedReceiptId)
      .single();

    expect(beforeData?.status).toBe('draft');

    // Update status to claiming
    const { data, error } = await supabase
      .from('receipts')
      .update({ status: 'claiming' })
      .eq('id', testUnassignedReceiptId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.status).toBe('claiming');
  });

  it('should allow valid status values', async () => {
    const validStatuses = ['draft', 'processing', 'claiming', 'settled', 'archived'];

    for (const status of validStatuses) {
      const { error } = await supabase
        .from('receipts')
        .update({ status })
        .eq('id', testUnassignedReceiptId);

      expect(error).toBeNull();
    }
  });
});

describe('Edge Cases', () => {
  it('should allow receipt with only clerk_user_id (no group, no member)', async () => {
    const { data, error } = await supabase
      .from('receipts')
      .insert({
        group_id: null,
        uploaded_by: null,
        uploaded_by_clerk_id: 'edge_case_user_' + Date.now(),
        image_url: 'https://example.com/edge-case.jpg',
        ocr_status: 'pending',
        status: 'draft',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.group_id).toBeNull();
    expect(data.uploaded_by).toBeNull();
    expect(data.uploaded_by_clerk_id).toBeDefined();

    // Clean up
    await supabase.from('receipts').delete().eq('id', data.id);
  });

  it('should enforce unique share_code constraint', async () => {
    const shareCode = 'UNIQUE' + Date.now().toString().slice(-4);

    // First receipt with share code
    const { data: first } = await supabase
      .from('receipts')
      .insert({
        group_id: testGroupId,
        uploaded_by: testMemberIds[0],
        image_url: 'https://example.com/first.jpg',
        share_code: shareCode,
        ocr_status: 'completed',
        status: 'claiming',
      })
      .select()
      .single();

    // Second receipt with same share code should fail
    const { error: duplicateError } = await supabase
      .from('receipts')
      .insert({
        group_id: testGroupId,
        uploaded_by: testMemberIds[0],
        image_url: 'https://example.com/second.jpg',
        share_code: shareCode,
        ocr_status: 'completed',
        status: 'claiming',
      });

    expect(duplicateError).not.toBeNull();
    expect(duplicateError?.code).toBe('23505'); // Unique violation

    // Clean up
    if (first) {
      await supabase.from('receipts').delete().eq('id', first.id);
    }
  });

  it('should handle receipt with items and totals correctly', async () => {
    // Create receipt
    const { data: receipt, error } = await supabase
      .from('receipts')
      .insert({
        group_id: testGroupId,
        uploaded_by: testMemberIds[0],
        uploaded_by_clerk_id: testClerkUserId,
        image_url: 'https://example.com/with-items.jpg',
        total_amount: 25.00,
        subtotal: 20.00,
        tax_amount: 3.00,
        tip_amount: 2.00,
        ocr_status: 'completed',
        status: 'claiming',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(receipt).not.toBeNull();

    // Verify amounts
    expect(parseFloat(receipt!.total_amount)).toBe(25.00);
    expect(parseFloat(receipt!.subtotal)).toBe(20.00);
    expect(parseFloat(receipt!.tax_amount)).toBe(3.00);
    expect(parseFloat(receipt!.tip_amount)).toBe(2.00);

    // Clean up
    await supabase.from('receipts').delete().eq('id', receipt!.id);
  });
});
