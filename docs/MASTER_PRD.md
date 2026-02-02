# split it. - Master Product Requirements Document

**Last Updated:** January 2026

This document consolidates all product requirements, feature roadmaps, and implementation status across the split it. app.

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Feature Worklog](#feature-worklog) - What's built vs. planned
3. [Core Features (Shipped)](#core-features-shipped)
4. [Phase 2 Features (In Progress)](#phase-2-features-in-progress)
5. [Phase 3 Features (Planned)](#phase-3-features-planned)
6. [Conversational Voice PRD](#conversational-voice-prd)
7. [Receipt UX Improvements](#receipt-ux-improvements)
8. [Technical Requirements](#technical-requirements)

---

## Product Overview

**split it.** is a 100% free, ad-supported expense-splitting mobile app built as a Splitwise alternative. The core value proposition:

- **Unlimited expenses** - No daily limits
- **100% free** - Ad-supported, no premium tier
- **Receipt scanning** - OCR-powered item claiming
- **Voice input** - Just say your expense (planned differentiator)

### Target Users
- Roommates splitting rent/utilities
- Friends on group trips
- Couples managing shared expenses
- Coworkers ordering lunch together

### Competitive Position
| Feature | Splitwise | split it. |
|---------|-----------|-----------|
| Daily expense limit | 3-4/day | Unlimited |
| Price | $40/year | Free |
| Receipt scan | Pro only | Free |
| Voice input | None | Planned |

---

## Feature Worklog

### ✅ SHIPPED (Production Ready)

| Feature | Status | Notes |
|---------|--------|-------|
| **Core Expense Splitting** | ✅ Complete | Groups, expenses, splits, balances |
| **Multiple Split Methods** | ✅ Complete | Equal, exact, percentage, shares |
| **Multi-Currency Support** | ✅ Complete | Per-expense currency with exchange rates |
| **Receipt Scanning (OCR)** | ✅ Complete | Gemini-powered extraction |
| **Receipt Item Claiming** | ✅ Complete | Per-item claiming with splits |
| **Receipt Metadata Extraction** | ✅ Complete | Merchant, date, tax, tip, subtotal |
| **Settlements** | ✅ Complete | Record payments, multiple methods |
| **Payment Deep Links** | ✅ Complete | Venmo, PayPal, Cash App, Zelle |
| **Payment QR Codes** | ✅ Complete | Generate QR for payment apps |
| **Group Sharing** | ✅ Complete | Share codes, QR codes |
| **Friends System** | ✅ Complete | Request, accept, block, search |
| **Push Notifications** | ✅ Complete | Expense added, settlement, member joined |
| **Payment Reminders** | ✅ Complete | Create reminders, frequency options |
| **User Profiles** | ✅ Complete | Avatar, payment usernames, currency |
| **Activity Feed** | ✅ Complete | Group and global activity streams |
| **Search & Filtering** | ✅ Complete | Search expenses, filter by category/date |
| **Soft Delete/Trash** | ✅ Complete | Recover deleted expenses |
| **Categories** | ✅ Complete | Category icons, colors |
| **Expense Ledger** | ✅ Complete | Transaction history view |
| **Offline Support** | ✅ Complete | SQLite cache, sync queue |
| **Analytics** | ✅ Complete | PostHog, Sentry integration |
| **RLS Security** | ✅ Complete | Clerk + Supabase JWKS auth |
| **Clerk Authentication** | ✅ Complete | Sign up, sign in, OAuth |

### 🔶 PARTIALLY BUILT

| Feature | Status | What's Missing |
|---------|--------|----------------|
| **Recurring Expenses** | 🔶 Infrastructure | Auto-generation logic, scheduling engine |
| **Notification Preferences** | 🔶 Backend | UI to customize which notifications to receive |
| **Export Data** | 🔶 Lib exists | Full UI integration, CSV/PDF export |

### ❌ NOT BUILT

| Feature | Priority | PRD Source |
|---------|----------|------------|
| **Voice Expense Entry** | P0 | Conversational Voice PRD |
| **Conversational Voice Assignment** | P0 | Conversational Voice PRD |
| **Voice Corrections/Undo** | P1 | Conversational Voice PRD |
| **Voice Relationships ("my wife")** | P2 | Conversational Voice PRD |
| **Receipt Pre-Assignment Suggestions** | P1 | Receipt UX Improvements |
| **Receipt History/Favorites** | P2 | Receipt UX Improvements |
| **iMessage Extension** | P2 | Receipt Architecture |
| **Web Claiming Interface** | P2 | Receipt Architecture |
| **Dark Mode Toggle** | P2 | User Request |
| **Budget Tracking** | P3 | Future |
| **Group Statistics Dashboard** | P3 | Future |
| **Expense Templates** | P3 | Future |
| **Bulk Import (CSV)** | P3 | Future |

---

## Core Features (Shipped)

### Groups & Members
- Create unlimited groups with emoji and name
- Add members by name (linked to accounts or anonymous)
- Share groups via 6-character codes or QR
- Archive groups
- Pin notes on groups

### Expense Management
- Add expenses with description, amount, category, date
- Multiple split methods: equal, exact amount, percentage, shares
- Multi-currency with exchange rate tracking
- Soft delete with trash recovery
- Edit expenses after creation
- Expense categories with icons

### Balance Calculation
- Real-time balance calculation per member
- Debt simplification algorithm (minimize transactions)
- Per-group and global balance views
- Settlement suggestions

### Receipt Scanning
- Camera capture or gallery selection
- Gemini OCR extraction (single-pass and two-pass modes)
- Line item extraction with quantities, prices
- Tax/tip/discount detection
- Item claiming interface
- Split items between multiple members
- Unassigned receipt management

### Settlements & Payments
- Record settlements with amount, method, notes
- Payment methods: Cash, Venmo, PayPal, Bank, Zelle, Other
- Deep links to payment apps
- QR code generation
- Settlement history/ledger

### Friends & Social
- Send/accept/reject friend requests
- Block/unblock users
- Search users by email or name
- Friend-to-friend balances

### Notifications
- Push notifications for: expense added, settlement recorded, member joined, friend request
- Payment reminders with frequency (once, daily, weekly)
- Local notification fallback

---

## Phase 2 Features (In Progress)

### Recurring Expenses (🔶 Partially Built)

**Current State:** Database schema and migrations exist. UI screens exist. Missing: auto-generation logic.

**Requirements:**
- [ ] Create recurring expense template
- [ ] Set frequency: daily, weekly, bi-weekly, monthly, yearly
- [ ] Set next due date
- [ ] Auto-generate expense on due date (needs edge function)
- [ ] Skip/pause recurring expense
- [ ] Edit template

**Technical:**
- Table: `recurring_expenses` (exists)
- Table: `recurring_expense_splits` (exists)
- Need: Supabase cron/edge function to generate expenses

---

## Phase 3 Features (Planned)

### Conversational Voice PRD

**Problem:** Current receipt claiming is tap-by-tap. Users want to speak naturally: "I had the burger, Drew got the salmon."

**Solution:** Transform voice dictation into multi-turn conversation where assistant tracks progress.

#### User Stories (P0)
1. ✅ See what's already assigned in session
2. Assistant tells me what's unassigned
3. Continue speaking without losing context
4. Assistant knows when all items assigned

#### User Stories (P1)
5. Say "actually Drew had the burger" to correct
6. Undo last assignment
7. See conversation transcript

#### User Stories (P2)
8. "My wife" remembers Sarah (relationship storage)
9. Suggest likely assignments from history

#### UX Flow
```
[5 items: Burger $15, Salmon $22, Salad $12, Beer $7 x2]

1. Tap mic → "I had the burger, Drew got the salmon"
2. Assistant: "Got it! Burger→You, Salmon→Drew. 2/5 done.
              Who had the salad and beers?"
   [Continue] [Done for now]
3. Tap Continue → "Sarah had salad, we split beers"
4. Assistant: "Salad→Sarah, Beers→Split 3 ways.
              All 5 assigned! Ready?"
   [Finalize] [Keep editing]
5. Tap Finalize → Saved → Return to receipt
```

#### Technical Approach
1. New `VoiceConversationScreen` component
2. State machine: idle → recording → processing → responded → (loop or finalize)
3. Context persistence across turns
4. Gemini prompt updates for conversational style
5. Completion detection algorithm

#### What Exists Today (in codebase)
- `ConversationContext` type with turn history
- `addConversationTurn()` for multi-turn state
- `generateProactivePrompt()` for remaining items
- Undo/correction detection in NLU prompt
- `continueConversation()` action in hook

**Gap:** UI doesn't surface any of this. Need new `VoiceConversationScreen` component.

#### Estimated Timeline
- P0 (Chat UI + Completion + Prompts): 3-4 days
- P1 (Corrections + Edit + Summary): 2-3 days
- P2 (Relationships + Patterns): 3-5 days

---

### Receipt UX Improvements

#### Pre-Assignment Suggestions (P1)
- Learn from past splits at same merchant
- "You usually get the salmon at this restaurant"
- One-tap accept suggestions

#### Quick Split Presets (P1)
- "Split everything equally"
- "I paid for everyone"
- "Split by what we ordered"

#### Receipt History (P2)
- View past receipts by merchant
- Favorite merchants for quick reuse
- Receipt search

#### iMessage Extension (P2)
- Share receipt to group chat
- Friends claim items in iMessage
- Real-time sync to app

#### Web Claiming Interface (P2)
- Shareable web link: split.free/r/X7kM9p
- Friends claim without app install
- Convert to app users

---

## Technical Requirements

### Authentication
- Clerk for user auth
- Supabase RLS with JWKS verification
- Native Clerk tokens (RS256)

### Database
- Supabase PostgreSQL
- 17+ tables with RLS
- Proper FK constraints
- Performance indexes

### OCR
- Google Gemini 1.5 Flash (primary)
- Hybrid two-pass mode for complex receipts
- Fallback handling for low confidence

### Offline
- SQLite (op-sqlite) for local cache
- Sync queue for offline operations
- Conflict resolution on sync

### Analytics
- PostHog for events
- Sentry for errors
- Privacy-conscious session replay

### Notifications
- Expo notifications
- Supabase edge function for delivery
- Token management per device

---

## Success Metrics

| Metric | Target |
|--------|--------|
| App Store downloads (6mo) | 50,000 |
| Monthly Active Users | 20,000 |
| Groups created | 30,000 |
| Voice expenses logged | 10,000 |
| App Store rating | 4.5+ stars |
| Day 7 retention | 20%+ |

---

## Appendix: Deleted/Archived Docs

The following docs were consolidated into this master PRD:
- `PRODUCT_REQUIREMENTS.md` - Original PRD
- `PRD_CONVERSATIONAL_VOICE.md` - Voice feature PRD
- `DESIGN_CONVERSATIONAL_VOICE.md` - Voice design doc
- `RECEIPT_SPLITTING_UX_IMPROVEMENTS.md` - UX suggestions

The following docs were deleted as outdated:
- `SETTLEMENT_ENHANCEMENTS_SUMMARY.md` - Completed implementation
- `PUSH_NOTIFICATIONS_IMPLEMENTATION.md` - Completed implementation
- `TESTING_IMPROVEMENT_PROPOSAL.md` - Stale proposal

### Still Active Reference Docs
- `CLERK_SUPABASE_RLS_SETUP.md` - Technical reference
- `DATABASE_ARCHITECTURE.md` - Schema documentation
- `RECEIPT_SPLITTING_ARCHITECTURE.md` - Technical architecture
- `SECURITY_REVIEW.md` - Security audit (actionable items)
- `DESIGN_DOC.md` - Website design
- `STORE_LISTING.md` - App store copy
- `COMPETITIVE_STRATEGY.md` - Marketing strategy
- `AD_STRATEGY_500.md` - Ad campaign plan
