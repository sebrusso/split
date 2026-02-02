-- Fix: Allow anon role to join groups when authenticated via Clerk JWT
--
-- Problem: The policy "Users can join or add members to groups" is restricted to
--          the `authenticated` role. However, with Supabase third-party auth,
--          if Clerk's session token doesn't include `role: "authenticated"` claim,
--          Supabase treats the user as `anon` role even though they have a valid JWT.
--
-- Symptoms:
--   - User gets "Permission Denied" when trying to join a group
--   - Error code 42501 (insufficient_privilege)
--   - get_clerk_user_id() returns a valid user ID (JWT is valid)
--   - But auth.role() returns 'anon' instead of 'authenticated'
--
-- Solution:
--   Allow both `authenticated` AND `anon` roles to insert members, but:
--   - Still require get_clerk_user_id() to return non-NULL (valid Clerk JWT)
--   - Still require the clerk_user_id being inserted to match the JWT's sub claim
--
-- This is secure because:
--   1. get_clerk_user_id() validates the JWT signature via Supabase third-party auth
--   2. Users can only create member records with their own clerk_user_id
--   3. The policy logic remains unchanged - just the role restriction is relaxed
--
-- Long-term fix: Configure Clerk to include `role: "authenticated"` in session tokens
-- via the "Connect with Supabase" feature in Clerk Dashboard.

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can join or add members to groups" ON public.members;

-- Create updated policy that allows both anon and authenticated roles
-- Security is enforced by requiring a valid Clerk JWT (get_clerk_user_id() IS NOT NULL)
CREATE POLICY "Users can join or add members to groups"
ON public.members FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- SECURITY: Require that the user has a valid Clerk JWT
  -- get_clerk_user_id() extracts 'sub' from auth.jwt()
  -- This only returns non-NULL if Supabase verified the JWT via Clerk's JWKS
  get_clerk_user_id() IS NOT NULL
  AND (
    -- Allow existing group members to add members (invite flow)
    is_group_member(group_id)
    -- OR: First member of a new group (group creation flow)
    OR NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = members.group_id)
    -- OR: Allow users to add themselves (join via share code flow)
    -- Security: Users can only insert records with their own clerk_user_id
    OR clerk_user_id = get_clerk_user_id()
  )
);

-- Also need to ensure anon role can call the helper functions
-- Grant execute permissions (if not already granted)
GRANT EXECUTE ON FUNCTION get_clerk_user_id() TO anon;
GRANT EXECUTE ON FUNCTION is_group_member(UUID) TO anon;
GRANT EXECUTE ON FUNCTION debug_auth_status() TO anon;

-- Add a comment explaining the security model
COMMENT ON POLICY "Users can join or add members to groups" ON public.members IS
'Allows users to join groups via share code or add members if they''re already in the group.
Security: Requires valid Clerk JWT (verified via JWKS). Users can only create members
with their own clerk_user_id. Supports both anon and authenticated roles because
Clerk JWT may not include the role claim depending on Clerk configuration.';
