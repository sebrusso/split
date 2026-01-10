# Security Review - SplitFree

**Review Date:** 2026-01-10
**Reviewer:** Security Analysis
**Codebase Version:** commit 55f5f71
**Mitigations Applied:** 2026-01-10 (commit 85f9f47)

---

## Summary

This review identified **12 security concerns** across the SplitFree codebase, categorized by severity. The most critical issues involve **hardcoded credentials**, **query injection vulnerabilities**, and **insufficient access controls**.

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 4 | 4 |
| High | 3 | 2 |
| Medium | 3 | 2 |
| Low | 2 | 0 |

### Mitigations Applied

The following security fixes have been implemented:

1. **Credentials moved to environment variables** - Supabase and Clerk credentials now loaded from `.env` file
2. **Query injection fixed** - Input validation added to `lib/friends.ts` and `lib/search.ts`
3. **Cryptographic random for share codes** - `expo-crypto` now used instead of `Math.random()`
4. **Signed URLs for receipts** - Receipt storage now uses time-limited signed URLs
5. **Authorization helpers created** - `lib/auth-helpers.ts` provides membership verification functions
6. **Production logging guards** - Console.error calls wrapped with `__DEV__` checks

---

## Critical Severity

### 1. Hardcoded Supabase Credentials

**Location:** `lib/supabase.ts:3-6`

```typescript
const supabaseUrl = "https://rzwuknfycyqitcbotsvx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

**Issue:** Database credentials are committed directly to source code.

**Impact:**
- Credentials exposed in version control history
- No separation between development and production environments
- Key rotation requires code changes and app updates

**Mitigation:**
- Use environment variables via `expo-constants` or `app.config.js`
- Store secrets in `.env` files (gitignored)
- Use Expo's EAS secrets for production builds

---

### 2. Hardcoded Clerk Test Key

**Location:** `lib/clerk.ts:11`

```typescript
export const CLERK_PUBLISHABLE_KEY: string = "pk_test_cHJvbW90ZWQtcmF0dGxlci03Ni5jbGVyay5hY2NvdW50cy5kZXYk";
```

**Issue:** A `pk_test_` prefixed key indicates test/development credentials that should never be used in production.

**Impact:**
- Test authentication backend used in production
- Different security policies than production Clerk instance
- Potential for test data to intermingle with production

**Mitigation:**
- Use environment variables for Clerk keys
- Validate key prefix at build time (reject `pk_test_` in production)
- Configure separate Clerk instances for dev/staging/prod

---

### 3. Query Injection via String Interpolation

**Location:** `lib/friends.ts:78-80, 173-175, 401-403`

```typescript
.or(
  `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetClerkId}),and(requester_id.eq.${targetClerkId},addressee_id.eq.${currentUserId})`
)
```

**Issue:** User-controlled values (Clerk IDs) are interpolated directly into query filter strings without validation.

**Impact:**
- Malformed IDs could alter query logic
- Bypasses Supabase's parameterized query protection
- Could expose unintended data or cause query errors

**Mitigation:**
- Validate UUID format before interpolation: `/^user_[a-zA-Z0-9]+$/`
- Use separate filter calls where possible
- Implement a validation helper function:
```typescript
function validateClerkId(id: string): string {
  if (!/^user_[a-zA-Z0-9]+$/.test(id)) {
    throw new Error('Invalid user ID format');
  }
  return id;
}
```

---

### 4. Query Injection in Search Functions

**Location:** `lib/search.ts:50-54, 120-125` and `lib/friends.ts:377`

```typescript
const searchPattern = `%${query.trim()}%`;
queryBuilder = queryBuilder.or(
  `description.ilike.${searchPattern},merchant.ilike.${searchPattern}`
);
```

**Issue:** User search input is interpolated directly into query strings. Special characters (`%`, `_`, `.`) have meaning in LIKE patterns and filter syntax.

**Impact:**
- Users could craft search terms that alter query behavior
- Potential for information disclosure through pattern manipulation
- Query errors from malformed input

**Mitigation:**
- Escape special characters in search input:
```typescript
function escapeSearchTerm(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&');
}
```
- Add input length limits (already limited to 50 results)
- Consider using Supabase full-text search instead of ILIKE

---

## High Severity

### 5. Overly Permissive Row Level Security

**Location:** Database configuration (referenced in `CLAUDE.md`)

> "All tables have RLS enabled with public read/write policies for MVP"

**Issue:** RLS policies allow any authenticated user to read and write all records across all tables.

**Impact:**
- User A can read User B's expense data
- Any user can modify or delete any group's data
- No data isolation between users or groups
- Complete bypass of authorization at database level

**Mitigation:**
Implement proper RLS policies:

```sql
-- Groups: Only members can access
CREATE POLICY "Users can view groups they belong to"
ON groups FOR SELECT
USING (
  id IN (SELECT group_id FROM members WHERE clerk_user_id = auth.uid())
);

-- Expenses: Only group members can access
CREATE POLICY "Group members can view expenses"
ON expenses FOR SELECT
USING (
  group_id IN (SELECT group_id FROM members WHERE clerk_user_id = auth.uid())
);
```

---

### 6. Missing Application-Level Authorization

**Locations:** `app/group/[id]/add-expense.tsx`, `app/group/[id]/add-member.tsx`, `app/group/[id]/balances.tsx`

```typescript
// add-expense.tsx - No membership verification
const { data: expense, error: expenseError } = await supabase
  .from("expenses")
  .insert({
    group_id: id,  // No check if user is member of this group
    ...
  });
```

**Issue:** Database operations are performed without verifying the current user has permission to access or modify the resource.

**Impact:**
- Users can add expenses to groups they're not members of
- Users can view balances of arbitrary groups by guessing group IDs
- No defense-in-depth if RLS policies are misconfigured

**Mitigation:**
- Verify group membership before all group-related operations:
```typescript
async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('members')
    .select('id')
    .eq('group_id', groupId)
    .eq('clerk_user_id', userId)
    .single();
  return !!data;
}
```
- Add membership check before insert/update/delete operations
- Return 403 error if user is not a member

---

### 7. Insecure Random Number Generation for Share Codes

**Location:** `lib/utils.ts:153-160`

```typescript
export function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

**Issue:** `Math.random()` is not cryptographically secure. The output is predictable if the internal state is known.

**Impact:**
- Share codes may be predictable
- Attackers could enumerate valid codes
- 6-character code with 32 chars = ~1 billion combinations (brute-forceable)

**Mitigation:**
- Use `expo-crypto` for secure random generation:
```typescript
import * as Crypto from 'expo-crypto';

export async function generateShareCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomBytes = await Crypto.getRandomBytesAsync(6);
  return Array.from(randomBytes)
    .map(byte => chars[byte % chars.length])
    .join('');
}
```
- Consider increasing code length to 8 characters
- Implement rate limiting on join attempts

---

## Medium Severity

### 8. Public Receipt Storage URLs

**Location:** `lib/storage.ts:47-51`

```typescript
const { data: urlData } = supabase.storage
  .from(RECEIPTS_BUCKET)
  .getPublicUrl(filename);
return urlData.publicUrl;
```

**Issue:** Receipt images are stored with permanent public URLs. Anyone with the URL can access the image indefinitely.

**Impact:**
- Receipt URLs follow predictable pattern: `{groupId}/{expenseId}.{ext}`
- Sensitive financial documents exposed if URL is leaked
- No access control on receipt viewing
- URLs never expire

**Mitigation:**
- Use signed URLs with expiration:
```typescript
const { data: urlData } = await supabase.storage
  .from(RECEIPTS_BUCKET)
  .createSignedUrl(filename, 3600); // 1 hour expiration
```
- Implement storage bucket RLS policies
- Verify user has access to the expense before generating signed URL

---

### 9. Sensitive Data in Console Logs

**Locations:** Multiple files including `lib/friends.ts:102`, `lib/activity.ts:64`, `app/auth/sign-up.tsx:116-117`

```typescript
console.error("Error sending friend request:", error);
console.log("Sign-up result status:", result.status);
```

**Issue:** Error objects and authentication flow details are logged to console, which may be captured by crash reporting or device logs.

**Impact:**
- Error objects may contain stack traces with sensitive paths
- Authentication logs could expose session information
- Logs accessible on device or in crash reports

**Mitigation:**
- Remove or gate debug logs for production:
```typescript
const isDev = __DEV__;
export function debugLog(...args: any[]) {
  if (isDev) console.log(...args);
}
```
- Sanitize error objects before logging
- Use a proper logging library with log levels

---

### 10. Missing Rate Limiting

**Locations:** `app/join/index.tsx`, `lib/friends.ts:363-386`

**Issue:** No rate limiting on sensitive operations like share code validation or user search.

**Impact:**
- Share codes can be brute-forced
- User enumeration through search API
- Potential for abuse of friend request system

**Mitigation:**
- Implement client-side rate limiting with exponential backoff
- Add server-side rate limiting via Supabase Edge Functions or RLS
- Log and alert on suspicious patterns (many failed join attempts)

---

## Low Severity

### 11. Missing Input Sanitization

**Location:** `components/ui/Input.tsx`

**Issue:** The Input component provides no built-in sanitization or validation beyond what React Native TextInput provides.

**Impact:**
- Special characters stored without escaping
- Potential display issues with certain character sequences
- Could affect downstream systems that consume the data

**Mitigation:**
- Add input sanitization at component level for specific use cases
- Implement max length restrictions in the component
- Strip or escape problematic characters before storage

---

### 12. Web Build Security Headers

**Location:** `app.json` web configuration

**Issue:** No security-related configuration for web builds.

**Impact:**
- If deployed as web app, missing security headers could allow:
  - Clickjacking attacks
  - MIME type sniffing
  - Improper content embedding

**Mitigation:**
- Configure Content Security Policy
- Add X-Frame-Options, X-Content-Type-Options headers
- Use HTTPS-only configuration
- Configure in hosting platform (Vercel, Netlify, etc.)

---

## Files Reviewed

| File | Security-Relevant Areas |
|------|------------------------|
| `lib/supabase.ts` | Credential storage |
| `lib/clerk.ts` | Authentication configuration |
| `lib/friends.ts` | Query construction, user search |
| `lib/search.ts` | Query construction, input handling |
| `lib/utils.ts` | Random generation, validation |
| `lib/storage.ts` | File storage, URL generation |
| `lib/auth-context.tsx` | Session management |
| `lib/offline.ts` | Local data storage |
| `lib/sync.ts` | Data synchronization |
| `lib/export.ts` | Data export |
| `app/group/[id]/add-expense.tsx` | Data operations |
| `app/group/[id]/add-member.tsx` | Data operations |
| `app/group/[id]/balances.tsx` | Data operations |
| `app/join/index.tsx` | Share code validation |
| `app/friends/add.tsx` | User search |
| `app/auth/sign-up.tsx` | Authentication flow |
| `app/_layout.tsx` | Auth guard |
| `app.json` | App configuration |

---

## Recommended Priority Order

1. **Immediate:** Fix RLS policies to implement proper user-based access control
2. **Immediate:** Move credentials to environment variables
3. **High:** Fix query injection vulnerabilities with input validation
4. **High:** Add application-level authorization checks
5. **High:** Replace `Math.random()` with cryptographically secure alternative
6. **Medium:** Implement signed URLs for receipt storage
7. **Medium:** Add rate limiting on sensitive endpoints
8. **Low:** Remove/gate debug logging for production
9. **Low:** Add input sanitization layer

---

## Additional Recommendations

### Environment Configuration
- Create `.env.example` with placeholder values
- Use different credentials for dev/staging/prod
- Never commit actual credentials to version control

### Authentication Hardening
- Implement session timeout/refresh logic
- Add biometric authentication for sensitive actions
- Implement account lockout after failed attempts

### Monitoring
- Set up alerts for unusual API usage patterns
- Log security-relevant events (failed auth, access denied)
- Monitor for brute-force attempts on share codes
