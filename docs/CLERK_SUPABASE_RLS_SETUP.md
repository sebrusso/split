# Clerk + Supabase RLS Integration Guide

## Overview

This document captures the learnings from setting up Row-Level Security (RLS) policies with Clerk authentication and Supabase.

## Key Learnings

### 1. JWT Signing Algorithm Requirements

**Problem**: Supabase third-party auth requires **asymmetric JWTs** (RS256 or ES256), but Clerk JWT templates sign with **HS256** (symmetric) by default.

**Solution**:
- **Do NOT use a Clerk JWT template** for Supabase integration
- Use Clerk's native session token by calling `getToken()` without a template parameter
- Clerk's native tokens are signed with RS256, which Supabase can verify via Clerk's JWKS endpoint

```typescript
// CORRECT - Use native Clerk token (RS256)
const token = await getToken();

// WRONG - Don't use JWT template (signs with HS256)
const token = await getToken({ template: 'supabase' });
```

### 2. Supabase Configuration

In your Supabase project settings (Authentication > Providers > Third-party Auth):

1. **Enable third-party auth**
2. **JWKS URL**: `https://<your-clerk-domain>/.well-known/jwks.json`
3. **Authorized parties (aud)**: Your Clerk app's authorized parties (optional but recommended)

### 3. Accessing JWT Claims in RLS Policies

**Problem**: `current_setting('request.jwt.claim.sub')` returns NULL for third-party auth tokens.

**Solution**: Use `auth.jwt()` function instead:

```sql
-- CORRECT - Use auth.jwt() for third-party auth
CREATE OR REPLACE FUNCTION get_clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt()->>'sub';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- WRONG - current_setting doesn't work with third-party auth
SELECT current_setting('request.jwt.claim.sub', true);
```

### 4. INSERT + SELECT Policy Requirement

**Problem**: When using `.insert().select()` pattern, the operation fails even with a valid INSERT policy.

**Solution**: You need **BOTH** INSERT and SELECT policies:

```sql
-- INSERT policy alone is NOT enough for .insert().select()
CREATE POLICY "Users can create groups"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (true);

-- You ALSO need a SELECT policy
CREATE POLICY "Users can read their groups"
ON public.groups FOR SELECT
TO authenticated
USING (true);  -- Or more restrictive condition
```

### 5. Helper Function for User ID

Create a reusable helper function:

```sql
CREATE OR REPLACE FUNCTION get_clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt()->>'sub';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

Use it in policies:

```sql
CREATE POLICY "Users can only see their own data"
ON public.some_table FOR SELECT
TO authenticated
USING (user_id = get_clerk_user_id());
```

## Current RLS Policy Status

Your migration file `20260113000002_secure_rls_policies.sql` has comprehensive policies:

### Tables with RLS Enabled

| Table | INSERT | SELECT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| groups | ✅ | ✅ | ✅ | ❌ | No DELETE policy (intentional?) |
| members | ✅ | ✅ | ✅ | ❌ | No DELETE policy |
| expenses | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| splits | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| settlements | ✅ | ✅ | ✅ | ❌ | No DELETE policy |
| user_profiles | ✅ | ✅ | ✅ | ❌ | No DELETE policy |
| friendships | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| activity_log | ✅ | ✅ | ❌ | ❌ | Read/Insert only |
| push_tokens | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| receipts | ✅ | ✅ | ✅ | ❌ | No DELETE policy |
| receipt_items | ✅ | ✅ | ✅ | ❌ | No DELETE policy |
| item_claims | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| receipt_member_totals | ✅ | ✅ | ✅ | ❌ | No DELETE policy |
| recurring_expenses | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| recurring_expense_splits | ✅ | ✅ | ✅ | ✅ | Uses FOR ALL policy |
| payment_reminders | ✅ | ✅ | ✅ | ❌ | No DELETE policy |
| reminder_history | ❌ | ✅ | ❌ | ❌ | Read only for users |

### Key Security Features

1. **Membership-based access**: Uses `is_group_member(group_id)` function
2. **Anonymous access for sharing**: Groups/receipts readable by share_code
3. **Helper functions**: `get_clerk_user_id()`, `can_access_expense()`, etc.
4. **First member exception**: First member can be added to new groups

### Potential Improvements for Production

1. **Add missing DELETE policies** if needed for:
   - groups (allow group deletion?)
   - members (allow removing members?)
   - settlements (allow deleting settlements?)

2. **Consider rate limiting** at the application level

3. **Audit logging** - activity_log table captures actions

## Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export function createAuthenticatedClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

// In your hook/context:
const getSupabase = async () => {
  // Get native Clerk token (RS256 signed)
  const token = await getToken();

  if (token) {
    return createAuthenticatedClient(token);
  }

  // Return anonymous client for unauthenticated users
  return createClient(supabaseUrl, supabaseAnonKey);
};
```

## Debugging Tips

### 1. Verify JWT is being received

```sql
-- Run in Supabase SQL Editor while authenticated
SELECT auth.jwt();
```

### 2. Check specific claims

```sql
SELECT
  auth.jwt()->>'sub' as user_id,
  auth.jwt()->>'iss' as issuer,
  auth.role() as role;
```

### 3. Test RLS policies

```sql
-- Temporarily become authenticated role with a specific user
SET request.jwt.claims = '{"sub": "user_123"}';
SET ROLE authenticated;

-- Now test your queries
SELECT * FROM groups;

-- Reset
RESET ROLE;
```

## Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "JWT verification failed" | HS256 token with third-party auth | Use native Clerk token without template |
| "new row violates RLS policy" | Missing INSERT policy or wrong WITH CHECK | Verify INSERT policy exists and conditions are met |
| "permission denied for table" | Missing SELECT policy for .insert().select() | Add SELECT policy in addition to INSERT |
| `auth.jwt()` returns NULL | Token not being passed in request header | Check Authorization header is set |
| `get_clerk_user_id()` returns NULL | JWT claims not accessible | Verify auth.jwt() works, check function definition |

## TODO for Production

- [x] ~~Add UPDATE policies for all tables~~ (Done in migration)
- [ ] Review DELETE policies - decide which tables need them
- [x] ~~Restrict SELECT policies to only group members~~ (Done - uses is_group_member())
- [ ] Add rate limiting at application level
- [x] ~~Audit log for sensitive operations~~ (activity_log table exists)
- [ ] Test all policies with different user scenarios
- [ ] Verify migration has been applied to production database
- [ ] Monitor for any RLS policy errors in production logs

## Verification Checklist

Before going to production, verify in Supabase SQL Editor:

```sql
-- 1. Check that auth.jwt() returns user info
SELECT auth.jwt()->>'sub' as user_id;

-- 2. Test group membership function
SELECT is_group_member('your-group-uuid-here');

-- 3. Verify policies are active
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```
