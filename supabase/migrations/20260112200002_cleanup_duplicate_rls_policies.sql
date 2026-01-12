-- Cleanup Duplicate RLS Policies
-- Purpose: Fix multiple_permissive_policies warnings from Supabase linter
-- Strategy: Ensure simple "Allow public" policies exist, then drop complex duplicates

-- ============================================
-- EXPENSES TABLE
-- ============================================

-- Drop existing complex policies first
DROP POLICY IF EXISTS "Group members can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Group members can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Group members can read expenses" ON public.expenses;
DROP POLICY IF EXISTS "Group members can update expenses" ON public.expenses;

-- Create simple public policies (will fail silently if they already exist)
DO $$ BEGIN
  CREATE POLICY "Allow public read access to expenses"
    ON public.expenses FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public insert access to expenses"
    ON public.expenses FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public update access to expenses"
    ON public.expenses FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public delete access to expenses"
    ON public.expenses FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- GROUPS TABLE
-- ============================================

DROP POLICY IF EXISTS "Anyone can create groups" ON public.groups;
DROP POLICY IF EXISTS "Members can read their groups" ON public.groups;
DROP POLICY IF EXISTS "Members can update their groups" ON public.groups;

DO $$ BEGIN
  CREATE POLICY "Allow public read access to groups"
    ON public.groups FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public insert access to groups"
    ON public.groups FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public update access to groups"
    ON public.groups FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- MEMBERS TABLE
-- ============================================

DROP POLICY IF EXISTS "Group members can add members" ON public.members;
DROP POLICY IF EXISTS "Group members can read members" ON public.members;

DO $$ BEGIN
  CREATE POLICY "Allow public read access to members"
    ON public.members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public insert access to members"
    ON public.members FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Note: "Allow public update access to members" already exists from previous migration

-- ============================================
-- SETTLEMENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Group members can create settlements" ON public.settlements;
DROP POLICY IF EXISTS "Group members can read settlements" ON public.settlements;
DROP POLICY IF EXISTS "Group members can update settlements" ON public.settlements;

DO $$ BEGIN
  CREATE POLICY "Allow public read access to settlements"
    ON public.settlements FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public insert access to settlements"
    ON public.settlements FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public update access to settlements"
    ON public.settlements FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- SPLITS TABLE
-- ============================================

DROP POLICY IF EXISTS "Group members can delete splits" ON public.splits;
DROP POLICY IF EXISTS "Group members can create splits" ON public.splits;
DROP POLICY IF EXISTS "Group members can read splits" ON public.splits;
DROP POLICY IF EXISTS "Group members can update splits" ON public.splits;

DO $$ BEGIN
  CREATE POLICY "Allow public read access to splits"
    ON public.splits FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public insert access to splits"
    ON public.splits FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public update access to splits"
    ON public.splits FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow public delete access to splits"
    ON public.splits FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
