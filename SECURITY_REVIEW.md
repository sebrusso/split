# Security Review - SplitFree

**Review Date:** 2026-01-06
**Reviewer:** Claude Code Security Analysis
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

This security review identified **11 security concerns** across the SplitFree codebase. The most critical issues relate to **hardcoded API credentials**, **SQL injection vulnerabilities**, and **insufficient authorization controls** in database access.

---

## Critical Issues

### 🔴 1. Hardcoded Supabase Credentials in Source Code

**File:** `lib/supabase.ts:3-5`

```typescript
const supabaseUrl = "https://rzwuknfycyqitcbotsvx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

**Risk:** The Supabase URL and anonymous key are hardcoded directly in the source code. While the anonymous key is designed to be public, this approach:
- Makes key rotation difficult (requires app update)
- Exposes the exact Supabase project URL
- Prevents different configurations for dev/staging/prod environments

**Recommendation:**
- Move credentials to environment variables using `expo-constants` or `react-native-config`
- Use different keys for development and production
- Configure Expo's `app.config.js` for dynamic configuration

---

### 🔴 2. Hardcoded Clerk Publishable Key

**File:** `lib/clerk.ts:11`

```typescript
export const CLERK_PUBLISHABLE_KEY: string = "pk_test_cHJvbW90ZWQtcmF0dGxlci03Ni5jbGVyay5hY2NvdW50cy5kZXYk";
```

**Risk:**
- Using a `pk_test_` key indicates this is a **test/development key** that should not be used in production
- Hardcoding prevents environment-specific configurations
- Key rotation requires code changes and app updates

**Recommendation:**
- Use environment variables for Clerk keys
- Ensure production builds use `pk_live_` keys
- Add build-time validation to prevent test keys in production builds

---

### 🔴 3. SQL Injection via String Interpolation in Supabase Queries

**File:** `lib/friends.ts:77-79`

```typescript
.or(
  `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetClerkId}),and(requester_id.eq.${targetClerkId},addressee_id.eq.${currentUserId})`
)
```

**Also found at:** `lib/friends.ts:173-174`, `lib/friends.ts:401-402`

**Risk:** User IDs are directly interpolated into the query string without sanitization. While Clerk IDs are typically UUIDs, this pattern is dangerous because:
- Malformed or malicious IDs could modify query behavior
- This bypasses Supabase's parameterized query protection

**Recommendation:**
- Use separate `.eq()` calls or Supabase's proper filter syntax
- Validate ID format before use (UUID regex validation)
- Example safe pattern:
```typescript
.or(`requester_id.eq.${validateUUID(currentUserId)},addressee_id.eq.${validateUUID(targetClerkId)}`)
```

---

### 🔴 4. SQL Injection in Search Functionality

**File:** `lib/search.ts:50-53`

```typescript
const searchPattern = `%${query.trim()}%`;
queryBuilder = queryBuilder.or(
  `description.ilike.${searchPattern},merchant.ilike.${searchPattern},notes.ilike.${searchPattern}`
);
```

**Also found at:** `lib/search.ts:120-125`, `lib/friends.ts:377`

**Risk:** User search input is directly interpolated into query strings. Special characters in search queries could:
- Escape the ILIKE pattern
- Cause query errors or unexpected behavior
- Potentially expose data through pattern manipulation

**Recommendation:**
- Sanitize search input to escape special SQL/regex characters
- Use parameterized queries where possible
- Add input validation and length limits

---

## High Severity Issues

### 🟠 5. Overly Permissive RLS Policies

**Referenced in:** `CLAUDE.md` - "All tables have RLS enabled with public read/write policies for MVP"

**Risk:** The documentation explicitly states that Row Level Security policies allow public read/write access. This means:
- Any authenticated user can read ALL data across ALL groups
- Any authenticated user can modify ANY record
- No user isolation or authorization checking at the database level
- Users can access other users' expense data, settlements, and personal information

**Recommendation:**
- Implement proper RLS policies immediately:
  - Groups: Only members can read/write their group data
  - Members: Only group members can see other members
  - Expenses/Splits: Only group members can access
  - Friendships: Only participants can access their relationships
- Add `user_id` column to relevant tables for ownership tracking
- Create policies based on authenticated user's JWT claims

---

### 🟠 6. No Authorization Checks on API Operations

**Files:** `app/group/[id]/add-expense.tsx`, `app/create-group.tsx`, various lib files

**Risk:** The application performs database operations without verifying:
- User is authenticated before making requests
- User has permission to access/modify the specific resource
- User is a member of the group being accessed

**Example in `add-expense.tsx`:**
```typescript
const { data: expense, error: expenseError } = await supabase
  .from("expenses")
  .insert({
    group_id: id,  // No check if user is member of this group
    ...
  })
```

**Recommendation:**
- Add authorization checks before all database operations
- Verify group membership before allowing expense creation
- Implement RLS policies as the primary authorization layer
- Add application-level checks as defense in depth

---

### 🟠 7. Weak Share Code Generation

**File:** `lib/utils.ts:153-160`

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

**Risk:**
- Uses `Math.random()` which is not cryptographically secure
- 6-character code with 32 possible characters = ~1 billion combinations
- Susceptible to brute-force attacks to discover valid group codes
- No rate limiting mentioned for code validation

**Recommendation:**
- Use `expo-crypto` or `expo-random` for secure random generation
- Consider longer codes (8-10 characters)
- Implement rate limiting on join attempts
- Add expiration for share codes
- Log and alert on multiple failed join attempts

---

## Medium Severity Issues

### 🟡 8. Sensitive Data in Console Logs

**Files:** Multiple locations throughout the codebase

```typescript
// lib/friends.ts:102
console.error("Error sending friend request:", error);

// app/auth/sign-up.tsx:116-117
console.log("Sign-up result status:", result.status);
console.log("Missing fields:", result.missingFields);
```

**Risk:**
- Error objects may contain sensitive information (stack traces, user data)
- Authentication flow logs could expose session details
- Logs may be captured in crash reporting tools or device logs

**Recommendation:**
- Remove or gate console.log statements for production builds
- Use a logging library that respects environment (development vs production)
- Sanitize error objects before logging
- Never log tokens, passwords, or personal data

---

### 🟡 9. Missing Input Validation on Client Side

**File:** `components/ui/Input.tsx`

The Input component has no built-in sanitization or validation.

**Risk:**
- While React Native's TextInput is generally safe from XSS, malicious input could:
  - Cause display issues with special characters
  - Be stored and later displayed in problematic ways
  - Affect other users viewing shared data

**Recommendation:**
- Add input sanitization at the component level
- Implement max length restrictions
- Strip or escape potentially problematic characters for stored data
- Validate input format where applicable (emails, phone numbers, amounts)

---

### 🟡 10. Receipt Storage Without Access Control

**File:** `lib/storage.ts:35-39`

```typescript
const { data: urlData } = supabase.storage
  .from(RECEIPTS_BUCKET)
  .getPublicUrl(filename);
```

**Risk:**
- Receipts are stored with public URLs
- Anyone with the URL can access the receipt image
- Receipt URLs follow predictable pattern: `{groupId}/{expenseId}.{extension}`
- Could expose sensitive financial documents

**Recommendation:**
- Use signed URLs with expiration instead of public URLs
- Implement storage bucket RLS policies
- Consider encrypting sensitive uploads
- Add access logging for receipt downloads

---

## Low Severity Issues

### 🟢 11. Missing Security Headers for Web Build

**File:** `app.json`

The web configuration doesn't specify security-related settings.

**Risk:** If deployed as a web app, missing security headers could allow:
- Clickjacking attacks
- MIME type sniffing
- XSS attacks (if vulnerabilities exist)

**Recommendation:**
- Add Content Security Policy headers
- Configure X-Frame-Options, X-Content-Type-Options
- Use HTTPS-only cookies
- Consider web-specific security configurations

---

## Additional Recommendations

### Environment Configuration
1. Create `.env.example` with placeholder values
2. Use `expo-constants` for environment variables
3. Never commit actual credentials to version control
4. Set up different environments (dev, staging, prod)

### Authentication Hardening
1. Implement session timeout/refresh logic
2. Add biometric authentication option for sensitive actions
3. Implement account lockout after failed attempts
4. Add 2FA for account recovery

### Data Protection
1. Encrypt sensitive data at rest in local SQLite cache
2. Clear cached data on logout
3. Implement secure key storage using `expo-secure-store` (already used for Clerk)
4. Add data export/deletion functionality for GDPR compliance

### Monitoring & Alerting
1. Implement security event logging
2. Set up alerts for suspicious activity
3. Monitor for unusual API usage patterns
4. Add crash reporting with privacy consideration

---

## Immediate Action Items (Priority Order)

1. **[CRITICAL]** Fix RLS policies - implement proper user-based access control
2. **[CRITICAL]** Move credentials to environment variables
3. **[CRITICAL]** Fix SQL injection in friend search and queries
4. **[HIGH]** Add authorization checks at application level
5. **[HIGH]** Replace `Math.random()` with secure random generation
6. **[MEDIUM]** Implement signed URLs for receipt storage
7. **[MEDIUM]** Remove/gate debug logging for production
8. **[LOW]** Add input validation and sanitization

---

## Files Reviewed

- `lib/supabase.ts`
- `lib/clerk.ts`
- `lib/auth-context.tsx`
- `lib/storage.ts`
- `lib/offline.ts`
- `lib/sync.ts`
- `lib/friends.ts`
- `lib/search.ts`
- `lib/export.ts`
- `lib/utils.ts`
- `lib/types.ts`
- `app/auth/sign-in.tsx`
- `app/auth/sign-up.tsx`
- `app/join/[code].tsx`
- `app/group/[id]/add-expense.tsx`
- `app/create-group.tsx`
- `components/ui/Input.tsx`
- `app.json`
- `CLAUDE.md`
