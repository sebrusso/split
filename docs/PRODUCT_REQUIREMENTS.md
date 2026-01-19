# split it. Product Requirements Document

## Vision Statement

split it. is the perfect free tool for splitting expenses at dinner. The grand vision: take a picture of a receipt, the app extracts items via OCR, people select their items, and totals are calculated automatically. Share via iMessage or in-app to settle up instantly.

**Core Value Proposition**: 100% free, no account required for basic use, removes the need for a calculator entirely.

---

## Current State (Day 2 Complete)

### What Exists
- Group creation with emoji and currency
- Member management (name-based, no auth)
- Equal-only expense splitting
- Balance calculation with debt simplification
- Settlement recording
- QR code sharing and deep links
- Join group flow
- Offline infrastructure (requires dev build)

### What's Missing for Competitive Parity
- User authentication
- Multiple split methods (unequal, %, items)
- Expense categories
- Expense editing/deletion
- Receipt capture
- Notifications
- Export capabilities

---

## Feature Inventory by Priority

### Legend
- **P0 (MVP)**: Must-have for competitive product (~50% of features)
- **P1**: Important for user retention and growth
- **P2**: Aspirational features for differentiation

---

## 1) Accounts, Identity, and Onboarding

### P0 (MVP)
- [ ] Email + password signup
- [ ] Social login (Google / Apple)
- [ ] Guest mode (limited features; prompt to claim account later)
- [ ] Account recovery flows (forgot password)
- [ ] Profile basics: name, profile photo/avatar
- [ ] Preferred currency (default)

### P1
- [ ] Phone number signup (SMS OTP)
- [ ] Magic link login (email)
- [ ] Multiple login methods linked to one account
- [ ] Session management (view active sessions, log out other devices)
- [ ] Locale & language selection
- [ ] Privacy controls (who can find you, who can add you)
- [ ] Notification preferences (granular)

### P2
- [ ] Passkeys / WebAuthn
- [ ] Device trust / "remember this device"
- [ ] Time zone (manual + auto)
- [ ] Accessibility preferences (text size, contrast, reduce motion)
- [ ] "Why are you here?" onboarding wizard
- [ ] Import suggestions from contacts

---

## 2) Friend Graph and Contacts

### P0 (MVP)
- [ ] Add friend by email/phone
- [ ] Add friend by invite link / QR code
- [ ] Friend requests (approve/deny)
- [ ] Remove friend
- [ ] Search friends by name/email

### P1
- [ ] Address book sync (opt-in)
- [ ] Block user / unblock
- [ ] "Unclaimed friend" placeholder (invite not accepted yet)
- [ ] Suggest friends based on mutual groups
- [ ] "Frequent collaborators" list

### P2
- [ ] Username/handle system
- [ ] Deduplicate identities (same person via phone + email)
- [ ] Merge friend entries

---

## 3) Groups

### P0 (MVP)
- [ ] Create group: name, icon, description
- [ ] Default currency per group
- [ ] Group type presets (Trip, Roommates, Couple, Event)
- [ ] Add members via multiple methods
- [ ] Edit group name/icon/description
- [ ] Leave group (with balance settlement rules)
- [ ] Archive/unarchive group

### P1
- [ ] Member roles: Owner / Admin / Member
- [ ] Group-level permissions (who can add expenses, edit, invite)
- [ ] Pin / favorite groups
- [ ] Remove member (with settlement enforcement)
- [ ] Transfer ownership
- [ ] Group notes / shared info (WiFi password, address)

### P2
- [ ] "Viewer" role (read-only)
- [ ] Group announcements
- [ ] Temporarily inactive member (travel day 1-3 only)
- [ ] "Past member" ledger retention
- [ ] Add member mid-stream with past/future expense options
- [ ] Member-specific default split weights

---

## 4) Expenses: Create, Edit, View, Lifecycle

### P0 (MVP)
- [ ] Expense fields: amount, currency, paid by, participants, split method, description, date
- [ ] Category selection (default categories)
- [ ] Quick add (minimal fields) + "details" expand
- [ ] Edit expense (amount, payer, participants, split, metadata)
- [ ] Delete expense (soft delete with restore option)
- [ ] Attach receipt photo
- [ ] Smart defaults (last used group, "paid by me")
- [ ] Offline creation + sync queue

### P1
- [ ] Multiple payers for one expense
- [ ] Notes field
- [ ] Location (optional)
- [ ] Merchant (optional)
- [ ] Tags (custom, multi-select)
- [ ] Edit history/audit trail
- [ ] Expense templates (repeat common expense)
- [ ] Tax/tip breakdown fields
- [ ] Draft saving

### P2
- [ ] Receipt OCR extraction (total, date, merchant, line items)
- [ ] "Split by items" from receipt line items
- [ ] Auto-suggest item assignments based on history
- [ ] Crop, rotate, enhance receipt photos
- [ ] Reimbursable flag / business flag
- [ ] Recurring expense pointer
- [ ] Locking/approval model for edits
- [ ] Voided/canceled expense state
- [ ] Disputed expense flag + discussion

---

## 5) Splitting Methods

### P0 (MVP)
- [x] Equal split among selected participants (DONE)
- [ ] Unequal exact amounts per person (manual)
- [ ] Percent split
- [ ] Shares/weights split (2 shares vs 1 share)
- [ ] "Exclude" toggle per participant

### P1
- [ ] By items (line-item assignment)
- [ ] Multiple payers split
- [ ] Split tax and tip separately
- [ ] Per-person adjustments (coupons, discounts)
- [ ] Rounding handling options

### P2
- [ ] By custom formula (base + multiplier)
- [ ] "I paid, but company reimburses later"
- [ ] Minimum/maximum cap per participant
- [ ] Hybrid splits ("one person fixed, rest equal")
- [ ] Refunds / negative expenses
- [ ] Deposit and final bill (linked expenses)

---

## 6) Balances, Ledgers, and Debt Simplification

### P0 (MVP)
- [x] Per-group balances (DONE)
- [x] Per-friend balances (DONE)
- [x] Debt simplification within group (DONE)
- [ ] Global balance: net owed/owing across all groups
- [ ] Drill-down: "why do I owe this?" expense list
- [ ] Transaction ledger per group

### P1
- [ ] Statement period filters (month, trip dates, custom)
- [ ] Running balance over time
- [ ] Toggle: "Keep exact debts" vs "simplify"
- [ ] Explain simplification result (transparency UI)

### P2
- [ ] Multi-currency balances (original + converted view)
- [ ] Historical exchange rate handling
- [ ] Exportable statement (PDF/CSV)

---

## 7) Settlements and Payments

### P0 (MVP)
- [x] Record settlement with friend/group member (DONE)
- [x] Settlement amount (full or partial) (DONE)
- [ ] Settlement date selection
- [ ] Settlement note
- [ ] Settlement method label (Cash, Venmo, PayPal, etc.)
- [ ] Settlement history and audit trail
- [ ] Editable + reversible settlements

### P1
- [ ] Attach proof (screenshot/receipt)
- [ ] Deep links to payment apps (Venmo, PayPal prefill)
- [ ] "Request payment" flow with reminder
- [ ] Smart reminders (weekly, end-of-month)

### P2
- [ ] In-app payment integration
- [ ] Auto-mark settlement when confirmed
- [ ] Snooze reminders
- [ ] Overpayment/underpayment handling
- [ ] Settlement in different currency

---

## 8) Notifications and Activity Feed

### P0 (MVP)
- [ ] Activity feed per group (expenses, settlements, members)
- [ ] Push notifications (basic)
- [ ] Email notifications (expense added, settlement request)

### P1
- [ ] Personal feed across all groups
- [ ] Per-event notification toggles
- [ ] Quiet hours / do-not-disturb
- [ ] Digest emails (daily/weekly)
- [ ] @mentions in comments

### P2
- [ ] Comment thread per expense
- [ ] Emoji reactions
- [ ] "Resolve dispute" workflow

---

## 9) Search and Organization

### P0 (MVP)
- [ ] Global search (expenses by description, amount, member)
- [ ] Filter by group, category, date range
- [ ] Default categories + custom categories

### P1
- [ ] Filter by payer, participant, amount range
- [ ] Saved searches
- [ ] Category icons
- [ ] Tags (free-form)
- [ ] Pin groups/friends

### P2
- [ ] Category rules (auto-categorize by merchant)
- [ ] Expense templates
- [ ] "Split presets" (60/40 couple split)
- [ ] Batch operations (bulk edit)

---

## 10) Recurring Bills

### P0 (MVP)
- [ ] Create recurring expense series (weekly/monthly)
- [ ] Auto-post recurring expenses
- [ ] Edit/delete recurring series

### P1
- [ ] Notifications before posting ("confirm amount")
- [ ] Skip occurrence
- [ ] Edit series vs single instance
- [ ] Variable amount prompt

### P2
- [ ] Custom frequency
- [ ] Handle proration (mid-month changes)

---

## 11) Multi-Currency and Travel

### P0 (MVP)
- [x] Expense currency per expense (DONE - field exists)
- [x] Group default currency (DONE)
- [ ] User default currency
- [ ] Show both original and converted amounts

### P1
- [ ] Choose conversion mode (rate at time vs live)
- [ ] Rate source transparency
- [ ] Trip groups with dates and budget

### P2
- [ ] Photo receipt capture optimized for travel
- [ ] Trip summary at end

---

## 12) Reporting and Analytics

### P0 (MVP)
- [ ] Spend by category (basic chart)
- [ ] Export group ledger to CSV

### P1
- [ ] Spend by group/friend
- [ ] Monthly trends
- [ ] "Unsettled for > X days" insights
- [ ] PDF statement generation

### P2
- [ ] "Who paid most" leaderboard
- [ ] Per-person net contribution over time
- [ ] Forecast upcoming recurring bills
- [ ] Tax/business report mode

---

## 13) Export, Import, and Integrations

### P0 (MVP)
- [ ] Export group ledger to CSV
- [ ] Shareable link to group summary

### P1
- [ ] Export all data (GDPR-style)
- [ ] Import from Splitwise CSV
- [ ] PDF statement generation

### P2
- [ ] Public API
- [ ] Calendar integration (trip groups from events)
- [ ] Email forwarding ("email receipts to add expense")
- [ ] Slack/Discord bot

---

## 14) Privacy, Permissions, and Security

### P0 (MVP)
- [ ] Row-Level Security (RLS) on all tables
- [ ] User can only see their own groups/expenses
- [ ] Secure attachment storage
- [ ] Encryption in transit (HTTPS)

### P1
- [ ] 2FA (SMS/app)
- [ ] Search discoverability controls
- [ ] Control who can add you to groups
- [ ] Admin moderation tools

### P2
- [ ] Passkeys
- [ ] Hide amounts from non-involved members
- [ ] Private expenses within group
- [ ] Audit logs
- [ ] Download/delete my data

---

## 15) Platform and Performance

### P0 (MVP)
- [x] iOS app (DONE)
- [x] Android app (DONE)
- [ ] Web app (responsive)
- [ ] Offline + sync (reliable)
- [ ] Fast load for groups with 100+ expenses

### P1
- [ ] Pagination/infinite scroll
- [ ] Caching strategies
- [ ] Attachment thumbnailing
- [ ] Low-bandwidth mode

### P2
- [ ] Desktop-optimized web
- [ ] Screen reader support
- [ ] Keyboard navigation
- [ ] High contrast mode

---

## 16) Receipt Scanning (P2 - Vision Feature)

### P2 (Aspirational - Grand Vision)
- [ ] Camera integration for receipt capture
- [ ] OCR to extract line items and prices
- [ ] Item assignment UI (tap items to claim)
- [ ] Auto-calculate per-person totals from items
- [ ] Share item selection via iMessage
- [ ] In-app item selection for group members
- [ ] Smart tax/tip distribution based on items
- [ ] Merchant and date extraction
- [ ] Receipt storage and retrieval

---

## MVP Scope Summary (P0 Features)

### Phase 1: Authentication & Identity
1. Email/password signup + social login (Google/Apple)
2. Guest mode with account claim flow
3. Basic profile (name, photo, default currency)
4. Password recovery

### Phase 2: Enhanced Expenses
5. Multiple split methods (unequal, %, shares)
6. Categories (default set)
7. Expense editing and deletion
8. Receipt photo attachment
9. Better date/note fields

### Phase 3: Better Settlements
10. Settlement method labels
11. Settlement notes and dates
12. Settlement history improvements
13. Editable settlements

### Phase 4: Social & Discovery
14. Friend system with requests
15. Add friends by email/link
16. Global search
17. Activity feed per group

### Phase 5: Data & Export
18. CSV export
19. Global balance view
20. Drill-down expense breakdown
21. RLS security implementation

### Phase 6: Polish
22. Push notifications (basic)
23. Web app (responsive)
24. Recurring expenses (basic)
25. Multi-currency display

---

## Success Metrics

### MVP Launch Metrics
- User signup rate
- Groups created per user
- Expenses added per group
- Settlement completion rate
- 7-day retention

### Growth Metrics
- Viral coefficient (invites per user)
- Share code usage rate
- Friend request acceptance rate

### Engagement Metrics
- DAU/MAU ratio
- Expenses per active user per month
- Time to first expense
- Time to first settlement

---

## Open Questions

1. **Authentication Strategy**: Should we use Supabase Auth or a third-party (Auth0, Clerk)?
2. **Receipt OCR Provider**: Google Vision API, AWS Textract, or open-source?
3. **Payment Integration**: Partner with Venmo/PayPal or build payment rails?
4. **Monetization Timing**: When to introduce premium features vs ads?
5. **iMessage Extension**: Native extension or share sheet integration?

---

## Appendix: Feature Count by Priority

| Category | P0 (MVP) | P1 | P2 | Total |
|----------|----------|----|----|-------|
| Accounts & Identity | 6 | 7 | 6 | 19 |
| Friends & Contacts | 5 | 5 | 3 | 13 |
| Groups | 7 | 6 | 6 | 19 |
| Expenses | 10 | 9 | 10 | 29 |
| Splitting | 5 | 5 | 6 | 16 |
| Balances | 6 | 4 | 3 | 13 |
| Settlements | 7 | 4 | 5 | 16 |
| Notifications | 3 | 5 | 3 | 11 |
| Search & Org | 4 | 5 | 4 | 13 |
| Recurring | 3 | 4 | 2 | 9 |
| Multi-Currency | 4 | 3 | 2 | 9 |
| Reporting | 2 | 4 | 4 | 10 |
| Export/Import | 2 | 3 | 4 | 9 |
| Security | 4 | 4 | 5 | 13 |
| Platform | 5 | 4 | 4 | 13 |
| Receipt Scanning | 0 | 0 | 9 | 9 |
| **TOTAL** | **73** | **72** | **76** | **221** |

MVP represents ~33% of total features, focused on core functionality needed for competitive parity with Splitwise.
