# Testing Suite Improvement Proposal

**Goal**: Expose critical UX bugs that would actually impact users, not trivial bugs.

---

## Summary of Changes Made

### Deleted Tests
- **`navigation.test.ts`** (1,132 lines) - This file tested static hardcoded data structures defined within the test file itself. It didn't test actual navigation behavior—just that its own test data was internally consistent. When actual navigation changes occur, these tests would never catch real bugs.

---

## Critical Bugs Already Documented in Test Suite

The `storage.integration.test.ts` file already documents several **real bugs** that haven't been fixed:

### 1. Extension Extraction Bug (CRITICAL - Security/UX)
**File**: `lib/storage.ts`
**Lines**: Documented in `__tests__/storage.integration.test.ts:507-515`

```typescript
// Current logic: uri.split(".").pop()?.toLowerCase() || "jpg"
// For URL: "https://example.com/image" (no extension)
// Returns: "com/image" instead of "jpg"
```

**Impact**:
- Files uploaded without extensions get wrong content types
- Could cause image display failures
- Breaks validation logic

### 2. File Size Validation Bypass (CRITICAL - Security)
**File**: `lib/storage.ts`
**Lines**: Documented in `__tests__/storage.integration.test.ts:493-505`

```typescript
// getFileSize returns 0 on fetch failure
// 0 < MAX_RECEIPT_SIZE (5MB), so validation passes
// Invalid/malicious files could bypass size checks
```

**Impact**:
- Size validation can be bypassed entirely
- Could allow uploading oversized or malformed files

### 3. Receipt Overwrite Vulnerability (SECURITY)
**File**: `lib/storage.ts`
**Lines**: Documented in `__tests__/storage.integration.test.ts:535-545`

```typescript
// uploadReceipt uses upsert:true
// If path isn't user-scoped, one user could overwrite another's receipt
```

**Impact**:
- Potential data integrity issues
- Security vulnerability if not properly scoped

### 4. HEIC Content-Type Bug (UX)
**File**: `lib/storage.ts`
**Lines**: Documented in `__tests__/storage.integration.test.ts:518-533`

```typescript
// HEIC files should be "image/heic" or "image/heif"
// Current logic may produce wrong content type
```

**Impact**:
- iPhone photos may not display correctly
- Download/share issues for HEIC images

---

## Missing Critical Test Coverage

### 1. No End-to-End (E2E) Tests
**Current State**: Zero E2E tests
**Risk Level**: HIGH

The app has no tests that verify complete user flows work correctly. Critical flows that need E2E testing:

| Flow | Why Critical |
|------|--------------|
| Create group → Add expense → Split → View balances | Core business logic |
| Scan receipt → Claim items → Settle up | Receipt OCR is error-prone |
| Payment deep links (Venmo/PayPal/Cash App) | Money is involved |
| Sign up → Create group → Invite friend → Friend joins | Onboarding completion |
| Offline add expense → Come online → Sync | Data integrity |

### 2. No Real Device Testing
**Current State**: Tests only run in Node.js environment
**Risk Level**: MEDIUM-HIGH

Missing tests for:
- Camera/photo library permissions
- Deep link handling on actual devices
- Push notification behavior
- Background app state transitions
- Actual OCR integration with camera

### 3. Race Condition Testing
**Current State**: No concurrent operation tests
**Risk Level**: HIGH for payment apps

Missing tests for:
- Two users claiming same receipt item simultaneously
- Payment marked complete while app backgrounded
- Network timeout during settlement recording
- Rapid consecutive expense additions

### 4. Offline/Online Sync Testing
**Current State**: `offline.test.ts` exists but is limited
**Risk Level**: HIGH

Missing scenarios:
- Conflict resolution when offline changes sync
- Partial sync failures
- Queue corruption recovery
- Data consistency after extended offline period

### 5. Deep Link Edge Cases
**Current State**: Basic URL generation tested
**Risk Level**: MEDIUM

Missing tests for:
- Malformed deep link handling
- Deep link when app is killed vs backgrounded
- Deep link with expired/invalid group codes
- Universal links vs custom schemes

---

## Recommended Testing Strategy

### Phase 1: Fix Documented Bugs (Week 1)
Convert the documented bugs in `storage.integration.test.ts` from documentation to assertions that will fail until fixed:

```typescript
// BEFORE (documents bug)
it("BUG: Extension extracted incorrectly...", () => {
  expect(extension).not.toBe("jpg"); // This passes, bug exists
});

// AFTER (enforces fix)
it("should extract extension correctly for URLs without extension", () => {
  expect(getExtension("https://example.com/image")).toBe("jpg");
});
```

### Phase 2: Add E2E Tests with Maestro
Based on industry research, **Maestro** is recommended over Detox for this codebase because:

1. Simpler setup (YAML-based tests)
2. Works well with Expo
3. No native build dependencies
4. Handles async waits automatically

**Priority E2E Flows**:
1. Happy path: Create group → Add expense → View balances
2. Receipt scanning: Scan → OCR → Claim → Split
3. Payment: View debt → Open Venmo → Return to app
4. Onboarding: Sign up → First group → Invite

### Phase 3: Property-Based Testing for Core Logic
The split calculation logic is critical. Add property-based tests using `fast-check`:

```typescript
import fc from 'fast-check';

test('splits should always sum to expense amount', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 0.01, max: 10000 }),
      fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
      (amount, memberIds) => {
        const splits = calculateEqualSplit(amount, memberIds);
        const total = splits.reduce((sum, s) => sum + s.amount, 0);
        return Math.abs(total - amount) < 0.01;
      }
    )
  );
});
```

### Phase 4: Add Error Boundary Tests
React Native apps can crash silently. Add tests that verify error boundaries catch and handle:
- Network failures during critical operations
- Malformed API responses
- Invalid state combinations

---

## Recommended Tools

| Tool | Purpose | Priority |
|------|---------|----------|
| **Maestro** | E2E testing | HIGH |
| **fast-check** | Property-based testing | MEDIUM |
| **Sentry** | Production error monitoring | HIGH |
| **React Native Testing Library** | Component testing | Already used |

---

## Testing Pyramid Recommendation

```
        /\
       /  \  E2E (Maestro) - 10%
      /----\  Critical user flows only
     /      \
    /--------\  Integration - 30%
   /          \  API calls, storage, auth
  /------------\
 /              \  Unit Tests - 60%
/________________\  Business logic, utils
```

**Current State**: 90% unit tests, 10% integration, 0% E2E
**Target State**: 60% unit, 30% integration, 10% E2E

---

## Bug Severity Ranking

| # | Bug | Severity | UX Impact |
|---|-----|----------|-----------|
| 1 | File size validation bypass | Critical | Security hole |
| 2 | Receipt overwrite vulnerability | Critical | Data loss |
| 3 | Extension extraction bug | High | Image display failures |
| 4 | HEIC content-type | Medium | iPhone photo issues |
| 5 | No E2E for payment flows | High | Money-related bugs undetected |
| 6 | No offline sync tests | High | Data loss on poor connectivity |

---

## Quick Wins (Implement This Week)

1. **Fix the 4 documented bugs** in storage.integration.test.ts
2. **Add Maestro** and write 3 critical flow tests
3. **Add Sentry** for production error monitoring
4. **Add property tests** for calculateBalances and simplifyDebts

---

## References

- [Testing React Native Applications - Best Practices](https://dev.to/aimes/testing-react-native-applications-best-practices-and-frameworks-5hca)
- [React Native Official Testing Guide](https://reactnative.dev/docs/testing-overview)
- [Maestro E2E Testing](https://dev.to/tuantvk/mobile-app-testing-easier-with-maestro-react-native-9kl)
- [Jupiter Fintech - Maestro vs Detox Comparison](https://life.jupiter.money/choosing-between-maestro-and-detox-on-jupiter-qa-automation-7b94e6f8759d)
- [BlueSky Social App](https://github.com/bluesky-social/social-app) - Well-tested Expo app
- [Obytes React Native Starter](https://github.com/obytes/react-native-template-obytes) - Testing patterns
