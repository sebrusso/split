-- Fix: Allow authenticated users to read their own member records
--
-- This fixes the 42501 "Permission Denied" error when joining groups.
-- The issue was that INSERT with .select() (RETURNING clause) requires
-- both INSERT and SELECT permissions. The existing SELECT policy for
-- authenticated users required is_group_member(group_id), which fails
-- for newly joined members since the row doesn't exist yet during
-- policy evaluation.
--
-- This policy allows users to read any member record that belongs to them
-- (where clerk_user_id matches their authenticated user ID).

-- Ensure the get_clerk_user_id function exists (idempotent)
CREATE OR REPLACE FUNCTION public.get_clerk_user_id()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'sub',
    current_setting('request.jwt.claims', true)::json ->> 'sub'
  );
END;
$function$;

-- Create the policy (DROP first if exists for idempotency)
DROP POLICY IF EXISTS "Users can read own member records" ON members;

CREATE POLICY "Users can read own member records"
ON members
FOR SELECT
TO authenticated
USING (clerk_user_id = get_clerk_user_id());
