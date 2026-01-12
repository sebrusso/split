# Receipt Splitting UX Improvements

> Recommendations for reducing friction in the receipt upload → payment flow

## Current State

### User Journey (11 steps)
1. Open camera
2. Take/select photo
3. Confirm photo
4. Wait for upload
5. Wait for OCR
6. Navigate to claiming screen
7. Claim your items
8. Click "Finalize"
9. Navigate to settlement screen
10. Click payment buttons one by one
11. Click "Done"

### Pain Points
- Too many screens and navigation steps
- Payment buttons are non-functional without pre-collected payment info
- No shortcuts for common scenarios (equal splits)
- Edit screen is a full navigation when inline editing would suffice

---

## North Star

**Get users paid in 3 taps: Snap → Claim → Pay**

---

## Suggestions

### Suggestion A: Unified Claim + Settle Screen

**Combine the Claiming and Settlement screens into one.**

Instead of navigating from "Claim" → "Finalize" → "Settle", show:
- Items with claim UI at top
- Running totals with payment buttons always visible at bottom
- When you claim, your total updates instantly; pay when ready

```
┌─────────────────────────────┐
│  Joe's Diner - $85.00       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                             │
│  □ Burger         $15.00    │
│  ☑ Salad (You)    $12.00    │
│  □ Fries          $8.00     │
│  ☑ Drink (You)    $4.00     │
│  ...                        │
│                             │
├─────────────────────────────┤
│  Your Total: $18.42         │
│  (includes tax/tip share)   │
│                             │
│  [Pay $18.42 via Venmo]     │
└─────────────────────────────┘
```

**Pros:**
- Eliminates 2 navigation steps
- Always see how much you owe
- Reduces cognitive load

**Cons:**
- More complex UI
- May be overwhelming on smaller screens

**Implementation Notes:**
- Merge `receipt/[receiptId]/index.tsx` and `settle.tsx`
- Keep settlement logic but render inline
- Add collapsible "Payment Options" section

---

### Suggestion B: Quick Split Shortcuts

**Add one-tap shortcuts for common scenarios.**

When a receipt is uploaded, show quick actions before item claiming:

| Shortcut | Description |
|----------|-------------|
| **Split Evenly** | Divide total by number of members, skip item claiming |
| **I'll Pay for Mine** | Auto-assign items round-robin based on count |
| **2-Way Split** | When exactly 2 people, offer 50/50 with one tap |

```
┌─────────────────────────────┐
│  How do you want to split?  │
│                             │
│  [Split Evenly - $21.25 ea] │
│  [Claim Individual Items →] │
│                             │
└─────────────────────────────┘
```

**Pros:**
- Huge time saver for 80% of use cases
- Perfect for casual dinners with friends
- Reduces the "tedious" feeling of claiming

**Cons:**
- Less granular control
- May confuse users who want exact splits

**Implementation Notes:**
- Add a "split method picker" screen after OCR completes
- "Split Evenly" creates auto-claims for all members
- Still allow "Edit" to fall back to manual claiming

---

### Suggestion C: Inline OCR Review

**Replace the separate Edit screen with inline editing.**

Show OCR results on the claiming screen with subtle edit icons. Tap an item to fix its name/price in-place. Only show full edit modal for adding missing items.

```
┌─────────────────────────────┐
│  Burger         $15.00  ✏️  │  ← Tap pencil to edit inline
│  Salad          $12.00  ✏️  │
│  [+ Add Missing Item]       │  ← Opens modal only for new items
└─────────────────────────────┘
```

**Pros:**
- Reduces one full screen navigation
- Fixes are made in context
- Feels faster

**Cons:**
- Slightly more cluttered claiming screen
- Need to handle keyboard interactions carefully

**Implementation Notes:**
- Add `isEditing` state per item
- Replace item row with inline `TextInput` when editing
- Keep "Add Item" as modal for consistency

---

### Suggestion D: Pre-collect Payment Info (CRITICAL)

**Prompt for Venmo/PayPal/CashApp during onboarding or group join.**

Currently, payment buttons show "Not Set" because usernames aren't collected. This makes the entire settlement flow broken.

**Where to add:**
1. During initial onboarding (after account creation)
2. When first uploading a receipt (prompt uploader)
3. In user profile settings

```
┌─────────────────────────────┐
│  Connect Payment Apps       │
│                             │
│  Venmo: @yourname           │
│  PayPal: your@email.com     │
│  Cash App: $yourcashtag     │
│                             │
│  [Save & Continue]          │
└─────────────────────────────┘
```

**Pros:**
- Makes the entire settlement flow functional
- One-time setup, permanent benefit
- Enables auto-populated payment links

**Cons:**
- Adds friction to initial setup
- Some users may not have all payment apps

**Implementation Notes:**
- Extend `user_profiles` table (already has `venmo_username`)
- Add `paypal_email` and `cashapp_tag` columns
- Update `app/onboarding/venmo.tsx` to include all three
- Fetch in `settle.tsx` via `getVenmoUsernameForMember()` pattern

---

## Priority Recommendation

| Priority | Suggestion | Impact | Effort |
|----------|------------|--------|--------|
| 1 | **D - Payment Info** | Critical | Low |
| 2 | **B - Quick Splits** | High | Medium |
| 3 | **A - Unified Screen** | High | High |
| 4 | **C - Inline Edit** | Medium | Medium |

### Rationale

1. **Suggestion D is essential** - Without payment info collection, the feature is fundamentally broken. Users tap "Venmo" and nothing works.

2. **Suggestion B has highest ROI** - "Split Evenly" alone would save most users significant time. Many groups just want to divide the bill and don't care about exact item attribution.

3. **Suggestion A is the long-term vision** - Combining screens provides the best UX but requires more architectural changes.

4. **Suggestion C is polish** - Nice refinement once the core flow is solid.

---

## Files to Modify

| Suggestion | Primary Files |
|------------|---------------|
| A | `app/group/[id]/receipt/[receiptId]/index.tsx`, `settle.tsx` |
| B | New: `app/group/[id]/receipt/[receiptId]/split-method.tsx` |
| C | `app/group/[id]/receipt/[receiptId]/index.tsx` |
| D | `lib/user-profile.ts`, `app/onboarding/`, `app/profile/edit.tsx` |

---

## Related Bug Fixes

The following bugs were fixed in commit `c4bdbd8`:

- Edit screen missing `is_discount` filter
- Hardcoded payment usernames (now fetches from user_profiles)
- Missing error handling for receipt status update
- Missing error handling for member fetch in claiming screen
- Documented real-time subscription limitation
