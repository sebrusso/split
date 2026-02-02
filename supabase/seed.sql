-- =============================================================================
-- SplitFree Database Seed Data
-- =============================================================================
-- This file automatically runs when:
-- - Creating a new Supabase branch (seeds once on creation)
-- - Running `supabase db reset` locally
--
-- To regenerate: Run `npm run db:seed` (generates from seed.ts if using Snaplet)
-- To reseed a branch: Delete and recreate the branch
-- =============================================================================

-- Clear existing data (in correct order due to foreign keys)
TRUNCATE TABLE item_claims CASCADE;
TRUNCATE TABLE receipt_member_totals CASCADE;
TRUNCATE TABLE receipt_items CASCADE;
TRUNCATE TABLE receipts CASCADE;
TRUNCATE TABLE splits CASCADE;
TRUNCATE TABLE settlements CASCADE;
TRUNCATE TABLE expenses CASCADE;
TRUNCATE TABLE members CASCADE;
TRUNCATE TABLE groups CASCADE;

-- =============================================================================
-- TEST GROUPS
-- =============================================================================
-- Using fixed UUIDs for easier testing and references

INSERT INTO groups (id, name, emoji, currency, share_code, created_at, pinned, notes) VALUES
  ('11111111-1111-1111-1111-111111111111', 'NYC Trip 2024', '🗽', 'USD', 'NYC24X', NOW() - INTERVAL '30 days', false, 'Spring break trip to NYC'),
  ('22222222-2222-2222-2222-222222222222', 'Roommates 2024', '🏠', 'USD', 'ROOM24', NOW() - INTERVAL '60 days', true, 'Shared house expenses'),
  ('33333333-3333-3333-3333-333333333333', 'Dinner Club', '🍕', 'USD', 'DINNER', NOW() - INTERVAL '15 days', false, NULL),
  ('44444444-4444-4444-4444-444444444444', 'Europe Backpack', '✈️', 'EUR', 'EUR24B', NOW() - INTERVAL '7 days', false, 'Summer Europe trip'),
  ('55555555-5555-5555-5555-555555555555', 'Office Lunch', '💼', 'USD', 'OFLUNC', NOW() - INTERVAL '3 days', false, 'Daily office lunches');

-- =============================================================================
-- TEST MEMBERS
-- =============================================================================
-- Note: clerk_user_id is NULL for test data (simulates unlinked members)
-- In real usage, this would be populated when users link their accounts

INSERT INTO members (id, group_id, name, user_id, clerk_user_id, created_at) VALUES
  -- NYC Trip members
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Alice Chen', NULL, NULL, NOW() - INTERVAL '30 days'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Bob Smith', NULL, NULL, NOW() - INTERVAL '30 days'),
  ('a3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Carol Davis', NULL, NULL, NOW() - INTERVAL '29 days'),
  ('a4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Dan Wilson', NULL, NULL, NOW() - INTERVAL '29 days'),

  -- Roommates members
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Emma Johnson', NULL, NULL, NOW() - INTERVAL '60 days'),
  ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Frank Lee', NULL, NULL, NOW() - INTERVAL '60 days'),
  ('b3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Grace Kim', NULL, NULL, NOW() - INTERVAL '55 days'),

  -- Dinner Club members
  ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Henry Brown', NULL, NULL, NOW() - INTERVAL '15 days'),
  ('c2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Ivy Martinez', NULL, NULL, NOW() - INTERVAL '15 days'),
  ('c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Jack Taylor', NULL, NULL, NOW() - INTERVAL '14 days'),
  ('c4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Kate Anderson', NULL, NULL, NOW() - INTERVAL '14 days'),

  -- Europe Backpack members
  ('d1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Liam Garcia', NULL, NULL, NOW() - INTERVAL '7 days'),
  ('d2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'Maya Patel', NULL, NULL, NOW() - INTERVAL '7 days'),

  -- Office Lunch members
  ('e1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Noah Williams', NULL, NULL, NOW() - INTERVAL '3 days'),
  ('e2222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'Olivia Jones', NULL, NULL, NOW() - INTERVAL '3 days'),
  ('e3333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'Peter Chen', NULL, NULL, NOW() - INTERVAL '2 days');

-- =============================================================================
-- TEST EXPENSES
-- =============================================================================

INSERT INTO expenses (id, group_id, description, amount, paid_by, created_at, category, expense_date, notes, merchant) VALUES
  -- NYC Trip expenses
  ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Hotel - 3 nights', 450.00, 'a1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '28 days', 'accommodation', (NOW() - INTERVAL '28 days')::date, 'Midtown hotel', 'Marriott Times Square'),
  ('e1222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Dinner at Carbone', 285.50, 'a2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '27 days', 'food', (NOW() - INTERVAL '27 days')::date, 'Italian dinner', 'Carbone'),
  ('e1333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Broadway tickets', 640.00, 'a3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '26 days', 'entertainment', (NOW() - INTERVAL '26 days')::date, 'Hamilton show', NULL),
  ('e1444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Uber rides', 125.75, 'a4444444-4444-4444-4444-444444444444', NOW() - INTERVAL '25 days', 'transportation', (NOW() - INTERVAL '25 days')::date, 'Airport + around city', 'Uber'),

  -- Roommates expenses
  ('e2111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Rent - January', 2400.00, 'b1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '50 days', 'housing', (NOW() - INTERVAL '50 days')::date, 'Monthly rent', NULL),
  ('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Groceries', 156.78, 'b2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '45 days', 'groceries', (NOW() - INTERVAL '45 days')::date, 'Weekly groceries', 'Whole Foods'),
  ('e2333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Electric bill', 145.32, 'b3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '40 days', 'utilities', (NOW() - INTERVAL '40 days')::date, 'January electric', 'ConEd'),
  ('e2444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Internet', 89.99, 'b1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '35 days', 'utilities', (NOW() - INTERVAL '35 days')::date, 'Monthly internet', 'Verizon'),
  ('e2555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Cleaning supplies', 45.67, 'b2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '30 days', 'household', (NOW() - INTERVAL '30 days')::date, NULL, 'Target'),

  -- Dinner Club expenses
  ('e3111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Pizza night', 78.50, 'c1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '12 days', 'food', (NOW() - INTERVAL '12 days')::date, 'Weekly pizza', 'Lucali'),
  ('e3222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Sushi dinner', 156.00, 'c2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '8 days', 'food', (NOW() - INTERVAL '8 days')::date, 'Omakase night', 'Sushi Nakazawa'),
  ('e3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Wine for dinner', 65.00, 'c3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '5 days', 'drinks', (NOW() - INTERVAL '5 days')::date, '2 bottles', 'Wine Shop'),

  -- Europe Backpack expenses
  ('e4111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'Train tickets Paris-Amsterdam', 89.00, 'd1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '6 days', 'transportation', (NOW() - INTERVAL '6 days')::date, 'Eurostar', 'Eurostar'),
  ('e4222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'Hostel Amsterdam - 2 nights', 78.00, 'd2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '5 days', 'accommodation', (NOW() - INTERVAL '5 days')::date, NULL, 'Flying Pig Hostel'),
  ('e4333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'Van Gogh Museum', 38.00, 'd1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '4 days', 'entertainment', (NOW() - INTERVAL '4 days')::date, '2 tickets', 'Van Gogh Museum'),

  -- Office Lunch expenses
  ('e5111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'Team lunch - Chipotle', 45.67, 'e1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 days', 'food', (NOW() - INTERVAL '2 days')::date, NULL, 'Chipotle'),
  ('e5222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'Coffee run', 23.50, 'e2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '1 day', 'drinks', (NOW() - INTERVAL '1 day')::date, '3 coffees', 'Starbucks');

-- =============================================================================
-- TEST SPLITS (Equal splits for simplicity)
-- =============================================================================

-- NYC Trip splits (4 members, equal split)
INSERT INTO splits (id, expense_id, member_id, amount) VALUES
  -- Hotel split
  (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 112.50),
  (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 112.50),
  (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 112.50),
  (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444', 112.50),
  -- Carbone dinner split
  (gen_random_uuid(), 'e1222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 71.38),
  (gen_random_uuid(), 'e1222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 71.37),
  (gen_random_uuid(), 'e1222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 71.38),
  (gen_random_uuid(), 'e1222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', 71.37),
  -- Broadway tickets split
  (gen_random_uuid(), 'e1333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 160.00),
  (gen_random_uuid(), 'e1333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', 160.00),
  (gen_random_uuid(), 'e1333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 160.00),
  (gen_random_uuid(), 'e1333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 160.00),
  -- Uber rides split
  (gen_random_uuid(), 'e1444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 31.44),
  (gen_random_uuid(), 'e1444444-4444-4444-4444-444444444444', 'a2222222-2222-2222-2222-222222222222', 31.44),
  (gen_random_uuid(), 'e1444444-4444-4444-4444-444444444444', 'a3333333-3333-3333-3333-333333333333', 31.44),
  (gen_random_uuid(), 'e1444444-4444-4444-4444-444444444444', 'a4444444-4444-4444-4444-444444444444', 31.43);

-- Roommates splits (3 members, equal split)
INSERT INTO splits (id, expense_id, member_id, amount) VALUES
  -- Rent split
  (gen_random_uuid(), 'e2111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 800.00),
  (gen_random_uuid(), 'e2111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 800.00),
  (gen_random_uuid(), 'e2111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333', 800.00),
  -- Groceries split
  (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 52.26),
  (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 52.26),
  (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222222', 'b3333333-3333-3333-3333-333333333333', 52.26),
  -- Electric bill split
  (gen_random_uuid(), 'e2333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 48.44),
  (gen_random_uuid(), 'e2333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', 48.44),
  (gen_random_uuid(), 'e2333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333', 48.44),
  -- Internet split
  (gen_random_uuid(), 'e2444444-4444-4444-4444-444444444444', 'b1111111-1111-1111-1111-111111111111', 30.00),
  (gen_random_uuid(), 'e2444444-4444-4444-4444-444444444444', 'b2222222-2222-2222-2222-222222222222', 30.00),
  (gen_random_uuid(), 'e2444444-4444-4444-4444-444444444444', 'b3333333-3333-3333-3333-333333333333', 29.99),
  -- Cleaning supplies split
  (gen_random_uuid(), 'e2555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 15.23),
  (gen_random_uuid(), 'e2555555-5555-5555-5555-555555555555', 'b2222222-2222-2222-2222-222222222222', 15.22),
  (gen_random_uuid(), 'e2555555-5555-5555-5555-555555555555', 'b3333333-3333-3333-3333-333333333333', 15.22);

-- Dinner Club splits (4 members, equal split)
INSERT INTO splits (id, expense_id, member_id, amount) VALUES
  -- Pizza night split
  (gen_random_uuid(), 'e3111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 19.63),
  (gen_random_uuid(), 'e3111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 19.63),
  (gen_random_uuid(), 'e3111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 19.62),
  (gen_random_uuid(), 'e3111111-1111-1111-1111-111111111111', 'c4444444-4444-4444-4444-444444444444', 19.62),
  -- Sushi dinner split
  (gen_random_uuid(), 'e3222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 39.00),
  (gen_random_uuid(), 'e3222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 39.00),
  (gen_random_uuid(), 'e3222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333', 39.00),
  (gen_random_uuid(), 'e3222222-2222-2222-2222-222222222222', 'c4444444-4444-4444-4444-444444444444', 39.00),
  -- Wine split
  (gen_random_uuid(), 'e3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 16.25),
  (gen_random_uuid(), 'e3333333-3333-3333-3333-333333333333', 'c2222222-2222-2222-2222-222222222222', 16.25),
  (gen_random_uuid(), 'e3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 16.25),
  (gen_random_uuid(), 'e3333333-3333-3333-3333-333333333333', 'c4444444-4444-4444-4444-444444444444', 16.25);

-- Europe Backpack splits (2 members, equal split)
INSERT INTO splits (id, expense_id, member_id, amount) VALUES
  -- Train tickets split
  (gen_random_uuid(), 'e4111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 44.50),
  (gen_random_uuid(), 'e4111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', 44.50),
  -- Hostel split
  (gen_random_uuid(), 'e4222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 39.00),
  (gen_random_uuid(), 'e4222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 39.00),
  -- Museum split
  (gen_random_uuid(), 'e4333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111', 19.00),
  (gen_random_uuid(), 'e4333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222', 19.00);

-- Office Lunch splits (3 members, equal split)
INSERT INTO splits (id, expense_id, member_id, amount) VALUES
  -- Chipotle split
  (gen_random_uuid(), 'e5111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 15.22),
  (gen_random_uuid(), 'e5111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 15.22),
  (gen_random_uuid(), 'e5111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', 15.23),
  -- Coffee split
  (gen_random_uuid(), 'e5222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 7.83),
  (gen_random_uuid(), 'e5222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 7.84),
  (gen_random_uuid(), 'e5222222-2222-2222-2222-222222222222', 'e3333333-3333-3333-3333-333333333333', 7.83);

-- =============================================================================
-- TEST SETTLEMENTS (a few settled debts)
-- =============================================================================

INSERT INTO settlements (id, group_id, from_member_id, to_member_id, amount, settled_at, method, notes) VALUES
  -- Bob paid Alice back for some NYC expenses
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 100.00, NOW() - INTERVAL '20 days', 'venmo', 'Partial payback'),
  -- Grace paid Emma for utilities
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'b3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 150.00, NOW() - INTERVAL '25 days', 'bank_transfer', 'Monthly utilities share');

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Created:
-- - 5 groups (NYC Trip, Roommates, Dinner Club, Europe Backpack, Office Lunch)
-- - 16 members across all groups
-- - 17 expenses with various categories and amounts
-- - All expenses have equal splits among group members
-- - 2 settlements showing partial debt payback
-- =============================================================================
