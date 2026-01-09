-- Fix members UPDATE policy that uses auth.jwt()
-- Since app uses Clerk (not Supabase Auth), auth.jwt() returns null

-- Drop the problematic policy
DROP POLICY IF EXISTS "Members can update own record" ON members;

-- Create a permissive update policy (consistent with other member policies)
-- Application-level security validates user ownership via clerk_user_id
CREATE POLICY "Allow public update access to members"
  ON members FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON POLICY "Allow public update access to members" ON members IS 'Permissive policy for Clerk auth. App validates ownership via clerk_user_id.';
