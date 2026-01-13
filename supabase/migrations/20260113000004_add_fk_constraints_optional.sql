-- ============================================
-- OPTIONAL MIGRATION: Foreign Key Constraints
-- ============================================
--
-- WARNING: This migration is OPTIONAL and may fail if orphaned data exists.
--
-- This adds FK constraints to enforce referential integrity between:
--   - friendships.requester_id -> user_profiles.clerk_id
--   - friendships.addressee_id -> user_profiles.clerk_id
--   - push_tokens.user_id -> user_profiles.clerk_id
--
-- BEFORE RUNNING: Check for orphaned data that would violate these constraints:
--
--   -- Check for friendships with missing user profiles
--   SELECT * FROM friendships f
--   WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = f.requester_id)
--      OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = f.addressee_id);
--
--   -- Check for push tokens with missing user profiles
--   SELECT * FROM push_tokens pt
--   WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = pt.user_id);
--
-- If orphaned data exists, either:
--   1. Create the missing user_profiles records, OR
--   2. Delete the orphaned records (see cleanup section below)
--
-- ============================================

-- ============================================
-- OPTIONAL: Cleanup orphaned data before adding constraints
-- Uncomment these statements if you want to delete orphaned records
-- ============================================

-- DELETE FROM friendships f
-- WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = f.requester_id)
--    OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = f.addressee_id);

-- DELETE FROM push_tokens pt
-- WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = pt.user_id);

-- ============================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Friendships: requester_id -> user_profiles.clerk_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friendships_requester_id_fkey'
    AND table_name = 'friendships'
  ) THEN
    -- First check if there's orphaned data
    IF EXISTS (
      SELECT 1 FROM friendships f
      WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = f.requester_id)
    ) THEN
      RAISE WARNING 'Orphaned friendships found (requester_id). Skipping FK constraint. Clean up data and re-run.';
    ELSE
      ALTER TABLE public.friendships
        ADD CONSTRAINT friendships_requester_id_fkey
        FOREIGN KEY (requester_id) REFERENCES public.user_profiles(clerk_id)
        ON DELETE CASCADE;
      RAISE NOTICE 'Added friendships_requester_id_fkey constraint';
    END IF;
  ELSE
    RAISE NOTICE 'friendships_requester_id_fkey already exists';
  END IF;
END $$;

-- Friendships: addressee_id -> user_profiles.clerk_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'friendships_addressee_id_fkey'
    AND table_name = 'friendships'
  ) THEN
    -- First check if there's orphaned data
    IF EXISTS (
      SELECT 1 FROM friendships f
      WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = f.addressee_id)
    ) THEN
      RAISE WARNING 'Orphaned friendships found (addressee_id). Skipping FK constraint. Clean up data and re-run.';
    ELSE
      ALTER TABLE public.friendships
        ADD CONSTRAINT friendships_addressee_id_fkey
        FOREIGN KEY (addressee_id) REFERENCES public.user_profiles(clerk_id)
        ON DELETE CASCADE;
      RAISE NOTICE 'Added friendships_addressee_id_fkey constraint';
    END IF;
  ELSE
    RAISE NOTICE 'friendships_addressee_id_fkey already exists';
  END IF;
END $$;

-- Push tokens: user_id -> user_profiles.clerk_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'push_tokens_user_id_fkey'
    AND table_name = 'push_tokens'
  ) THEN
    -- First check if there's orphaned data
    IF EXISTS (
      SELECT 1 FROM push_tokens pt
      WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE clerk_id = pt.user_id)
    ) THEN
      RAISE WARNING 'Orphaned push_tokens found. Skipping FK constraint. Clean up data and re-run.';
    ELSE
      ALTER TABLE public.push_tokens
        ADD CONSTRAINT push_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(clerk_id)
        ON DELETE CASCADE;
      RAISE NOTICE 'Added push_tokens_user_id_fkey constraint';
    END IF;
  ELSE
    RAISE NOTICE 'push_tokens_user_id_fkey already exists';
  END IF;
END $$;

-- ============================================
-- ADD INDEXES FOR THE NEW FOREIGN KEYS
-- (improves JOIN and CASCADE DELETE performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id
ON public.friendships (requester_id);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id
ON public.friendships (addressee_id);

-- Note: idx_push_tokens_user_id already created in 20260113000001
