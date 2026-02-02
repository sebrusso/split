-- Fix: Handle NULL return from get_clerk_user_id() in member INSERT policy
--
-- Problem: When get_clerk_user_id() returns NULL (e.g., due to Clerk/Supabase
--          token verification issues), the condition:
--            clerk_user_id = get_clerk_user_id()
--          evaluates to NULL (not TRUE or FALSE), causing the policy to fail.
--
--          In SQL: NULL = NULL is NULL (unknown), not TRUE.
--
-- Symptoms:
--   - User can see group details (group lookup works via permissive SELECT policy)
--   - User cannot join group (INSERT fails silently with RLS violation)
--   - Error: "Failed to join group. Please try again." with no detailed error
--
-- Solution:
--   1. Require that get_clerk_user_id() returns a non-NULL value (user must be authenticated)
--   2. Use explicit NULL-safe comparison
--
-- Additionally, add a diagnostic function to help debug auth issues.

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can join or add members to groups" ON public.members;

-- Create updated policy with proper NULL handling
CREATE POLICY "Users can join or add members to groups"
ON public.members FOR INSERT
TO authenticated
WITH CHECK (
  -- SECURITY: Require that the user is properly authenticated
  -- get_clerk_user_id() must return a non-NULL value
  get_clerk_user_id() IS NOT NULL
  AND (
    -- Allow existing group members to add members (invite flow)
    is_group_member(group_id)
    -- OR: First member of a new group (group creation flow)
    OR NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = members.group_id)
    -- OR: Allow users to add themselves (join via share code flow)
    -- Security: Users can only insert records with their own clerk_user_id
    -- Note: clerk_user_id in the INSERT must match the authenticated user
    OR clerk_user_id = get_clerk_user_id()
  )
);

-- Create a diagnostic function to help debug auth issues
-- This can be called from the app to verify the Clerk/Supabase integration
CREATE OR REPLACE FUNCTION debug_auth_status()
RETURNS TABLE (
  auth_uid UUID,
  clerk_user_id TEXT,
  jwt_sub TEXT,
  jwt_iss TEXT,
  jwt_aud TEXT,
  jwt_exp BIGINT,
  is_authenticated BOOLEAN
) AS $$
BEGIN
  RETURN QUERY SELECT
    auth.uid() as auth_uid,
    get_clerk_user_id() as clerk_user_id,
    auth.jwt() ->> 'sub' as jwt_sub,
    auth.jwt() ->> 'iss' as jwt_iss,
    auth.jwt() ->> 'aud' as jwt_aud,
    (auth.jwt() ->> 'exp')::BIGINT as jwt_exp,
    (get_clerk_user_id() IS NOT NULL) as is_authenticated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION debug_auth_status() TO authenticated;

COMMENT ON FUNCTION debug_auth_status() IS
'Diagnostic function to verify Clerk/Supabase auth integration.
Call via: supabase.rpc("debug_auth_status")
If clerk_user_id is NULL, the Clerk token is not being verified correctly.';
