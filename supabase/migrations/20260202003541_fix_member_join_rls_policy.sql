-- Fix: Allow users to join groups via share code
--
-- Problem: The existing INSERT policy on members table only allows:
--   1. Existing group members to add others (invite flow)
--   2. First member of a new group (creation flow)
--
-- Missing: Users trying to join an existing group via share code are blocked
--          because they're not yet members and the group already has members.
--
-- Solution: Add condition allowing users to insert a member record with their
--           own clerk_user_id (self-join via share code flow).

-- Drop the existing policy
DROP POLICY IF EXISTS "Group members can add members" ON public.members;

-- Create updated policy with self-join support
CREATE POLICY "Users can join or add members to groups"
ON public.members FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow existing group members to add members (invite flow)
  is_group_member(group_id)
  -- OR: First member of a new group (group creation flow)
  OR NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id = members.group_id)
  -- OR: Allow users to add themselves (join via share code flow)
  -- Security: Users can only insert records with their own clerk_user_id
  OR clerk_user_id = get_clerk_user_id()
);
