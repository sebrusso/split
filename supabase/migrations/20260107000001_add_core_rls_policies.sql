-- Enable Row Level Security on all core tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Helper function to check group membership
CREATE OR REPLACE FUNCTION is_group_member(group_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM members
    WHERE group_id = group_uuid
    AND clerk_user_id = auth.jwt() ->> 'sub'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GROUPS POLICIES
-- Anyone can create a group
CREATE POLICY "Anyone can create groups"
ON groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- Members can read their groups
CREATE POLICY "Members can read their groups"
ON groups FOR SELECT
TO authenticated
USING (is_group_member(id));

-- Members can update their groups
CREATE POLICY "Members can update their groups"
ON groups FOR UPDATE
TO authenticated
USING (is_group_member(id))
WITH CHECK (is_group_member(id));

-- MEMBERS POLICIES
-- Authenticated users can add members to groups they belong to
CREATE POLICY "Group members can add members"
ON members FOR INSERT
TO authenticated
WITH CHECK (is_group_member(group_id) OR NOT EXISTS (SELECT 1 FROM members WHERE group_id = members.group_id));

-- Group members can see other members
CREATE POLICY "Group members can read members"
ON members FOR SELECT
TO authenticated
USING (is_group_member(group_id));

-- Members can update their own record
CREATE POLICY "Members can update own record"
ON members FOR UPDATE
TO authenticated
USING (clerk_user_id = auth.jwt() ->> 'sub')
WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

-- EXPENSES POLICIES
-- Group members can create expenses
CREATE POLICY "Group members can create expenses"
ON expenses FOR INSERT
TO authenticated
WITH CHECK (is_group_member(group_id));

-- Group members can read expenses
CREATE POLICY "Group members can read expenses"
ON expenses FOR SELECT
TO authenticated
USING (is_group_member(group_id));

-- Group members can update expenses
CREATE POLICY "Group members can update expenses"
ON expenses FOR UPDATE
TO authenticated
USING (is_group_member(group_id))
WITH CHECK (is_group_member(group_id));

-- Group members can delete expenses
CREATE POLICY "Group members can delete expenses"
ON expenses FOR DELETE
TO authenticated
USING (is_group_member(group_id));

-- SPLITS POLICIES
-- Group members can manage splits (via expense's group)
CREATE POLICY "Group members can create splits"
ON splits FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_id
    AND is_group_member(e.group_id)
  )
);

CREATE POLICY "Group members can read splits"
ON splits FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_id
    AND is_group_member(e.group_id)
  )
);

CREATE POLICY "Group members can update splits"
ON splits FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_id
    AND is_group_member(e.group_id)
  )
);

CREATE POLICY "Group members can delete splits"
ON splits FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_id
    AND is_group_member(e.group_id)
  )
);

-- SETTLEMENTS POLICIES
CREATE POLICY "Group members can create settlements"
ON settlements FOR INSERT
TO authenticated
WITH CHECK (is_group_member(group_id));

CREATE POLICY "Group members can read settlements"
ON settlements FOR SELECT
TO authenticated
USING (is_group_member(group_id));

CREATE POLICY "Group members can update settlements"
ON settlements FOR UPDATE
TO authenticated
USING (is_group_member(group_id))
WITH CHECK (is_group_member(group_id));
