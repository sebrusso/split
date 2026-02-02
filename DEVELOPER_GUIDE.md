# split it. - Developer Onboarding Guide

> **Welcome to the team!** This guide covers everything you need to know to start contributing to the split it. codebase. Use this for onboarding or as a reference.

---

## Project Overview

**split it.** is a 100% free, ad-supported expense-splitting mobile app (Splitwise alternative). Built for iOS, Android, and web with a focus on multiplayer group expense management.

**Key Value Proposition**: No paywalls, no transaction limits, full-featured expense splitting with receipt scanning, Venmo integration, and real-time sync.

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile framework |
| Expo | SDK 54 | Development platform & build service |
| Expo Router | 6.x | File-based navigation (like Next.js) |
| TypeScript | 5.9 | Type safety |
| React | 19.1 | UI library |

### Backend & Services
| Service | Purpose | Dashboard |
|---------|---------|-----------|
| Supabase | PostgreSQL database + Auth + Realtime + Storage | [supabase.com/dashboard](https://supabase.com/dashboard) |
| Clerk | User authentication (sign-up, sign-in, OAuth) | [clerk.com/dashboard](https://dashboard.clerk.com) |
| Sentry | Error monitoring & crash reporting | [sentry.io](https://sentry.io) |
| PostHog | Product analytics & event tracking | [posthog.com](https://app.posthog.com) |
| EAS | Expo Application Services (builds, updates, submit) | [expo.dev](https://expo.dev) |

### Key Libraries
```
@clerk/clerk-expo      - Authentication
@supabase/supabase-js  - Database client
@sentry/react-native   - Error tracking
posthog-react-native   - Analytics
expo-camera            - Camera for QR/receipt scanning
expo-notifications     - Push notifications
react-native-qrcode-svg - QR code generation
```

---

## Project Structure

```
splitfree/
├── app/                           # 📱 Screens (Expo Router file-based)
│   ├── _layout.tsx               # Root layout + auth guard + providers
│   ├── index.tsx                 # Redirect to (tabs)
│   ├── (tabs)/                   # Tab navigator screens
│   │   ├── _layout.tsx           # Tab configuration
│   │   ├── index.tsx             # Home - Groups list
│   │   ├── scan.tsx              # Receipt/QR scanner
│   │   ├── balances.tsx          # Global balances
│   │   ├── activity.tsx          # Activity feed
│   │   └── profile.tsx           # User profile
│   ├── auth/                     # Authentication flows
│   │   ├── welcome.tsx           # Onboarding carousel
│   │   ├── sign-in.tsx           # Login
│   │   ├── sign-up.tsx           # Registration
│   │   └── forgot-password.tsx   # Password reset
│   ├── group/[id]/               # Dynamic group routes
│   │   ├── index.tsx             # Group detail
│   │   ├── balances.tsx          # Who owes whom
│   │   ├── add-expense.tsx       # Create expense
│   │   ├── share.tsx             # Share/QR code
│   │   └── ...
│   ├── join/                     # Join group flow
│   │   └── index.tsx             # Enter code or deep link
│   └── friends/                  # Friend system
│       ├── index.tsx             # Friends list
│       ├── add.tsx               # Search & add
│       └── requests.tsx          # Pending requests
├── components/
│   └── ui/                       # Reusable UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── Avatar.tsx
│       ├── QRCodeScanner.tsx     # QR code scanner
│       └── index.ts              # Barrel export
├── lib/                          # Core business logic
│   ├── supabase.ts              # Supabase client + auth hook
│   ├── clerk.ts                 # Clerk configuration
│   ├── auth-context.tsx         # Auth React context
│   ├── types.ts                 # TypeScript interfaces
│   ├── utils.ts                 # Balance calc, formatting
│   ├── friends.ts               # Friend operations
│   ├── notifications.ts         # Push notification helpers
│   ├── payment-links.ts         # Venmo/PayPal deep links
│   ├── sync.ts                  # Background sync logic
│   ├── result.ts                # Result<T> type for error handling
│   ├── analytics.ts             # PostHog helpers
│   ├── sentry.ts                # Sentry configuration
│   ├── logger.ts                # Logging abstraction
│   └── theme.ts                 # Colors, typography, spacing
├── supabase/
│   └── migrations/              # SQL migration files
├── __tests__/                   # Jest tests
│   ├── helpers/                 # Test utilities
│   ├── utils.test.ts            # Unit tests
│   └── *.integration.test.ts    # Integration tests
├── assets/                      # Images, icons, splash
├── app.json                     # Expo configuration
├── eas.json                     # EAS Build profiles
├── package.json                 # Dependencies
└── tsconfig.json                # TypeScript config
```

---

## Environment Configuration

### Required Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Supabase (Required)
EXPO_PUBLIC_SUPABASE_URL=https://rzwuknfycyqitcbotsvx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Clerk Authentication (Required)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_OAUTH_REDIRECT_URL=splitfree://oauth-callback

# Gemini API for Receipt OCR (Optional)
EXPO_PUBLIC_GEMINI_API_KEY=...

# PostHog Analytics (Optional)
EXPO_PUBLIC_POSTHOG_API_KEY=...
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry (Optional but recommended)
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### Environment Differences

| Feature | Development | Preview | Production |
|---------|-------------|---------|------------|
| `__DEV__` flag | `true` | `false` | `false` |
| Sentry sampling | 100% traces | 100% traces | 20% traces |
| Console logs | Visible | Visible | Filtered |
| Clerk instance | Test | Production | Production |
| EAS channel | N/A | `preview` | `production` |

### EAS Build Profiles (`eas.json`)

```bash
# Development (Expo Go compatible)
npm start

# Simulator build with prod env
eas build --profile simulator-release --platform ios

# TestFlight beta
eas build --profile testflight --platform ios
eas submit --profile testflight --platform ios

# Production release
eas build --profile production --platform all
```

---

## Authentication Architecture

### Flow: Clerk → Supabase RLS

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Clerk     │         │    App      │         │  Supabase   │
│  (Auth)     │         │  (React)    │         │  (Database) │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. User signs in     │                       │
       │<─────────────────────│                       │
       │                       │                       │
       │  2. Returns JWT       │                       │
       │─────────────────────>│                       │
       │                       │                       │
       │                       │  3. getToken()        │
       │                       │  (from Clerk)         │
       │                       │                       │
       │                       │  4. API call with     │
       │                       │  Authorization:       │
       │                       │  Bearer <clerk_jwt>   │
       │                       │─────────────────────>│
       │                       │                       │
       │                       │  5. Supabase verifies │
       │                       │  JWT via Clerk JWKS   │
       │                       │                       │
       │                       │  6. RLS policies use  │
       │                       │  auth.jwt()->'sub'    │
       │                       │<─────────────────────│
```

### Code Pattern

```typescript
// In any component:
import { useSupabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

function MyComponent() {
  const { userId } = useAuth();
  const { getSupabase } = useSupabase();

  const fetchData = async () => {
    const supabase = await getSupabase(); // Gets authenticated client
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId);
    // RLS automatically filters to user's accessible data
  };
}
```

---

## Database Schema (Key Tables)

```sql
-- Core tables
groups (id, name, emoji, currency, share_code, created_at, archived_at)
members (id, group_id, name, clerk_user_id, created_at)
expenses (id, group_id, description, amount, paid_by, category, created_at)
splits (id, expense_id, member_id, amount)
settlements (id, group_id, from_member_id, to_member_id, amount, method)

-- User & Social
user_profiles (id, clerk_id, display_name, email, venmo_username)
friendships (id, requester_id, addressee_id, status)
push_tokens (id, user_id, token, platform)

-- Receipt scanning
receipts (id, group_id, image_url, ocr_status, merchant_name, total_amount)
receipt_items (id, receipt_id, description, quantity, total_price)
item_claims (id, receipt_item_id, member_id, claim_type, share_fraction)
```

### RLS Pattern

All tables use Row Level Security. Policies verify:
- User is authenticated (`auth.jwt() IS NOT NULL`)
- User's Clerk ID matches membership (`clerk_user_id = auth.jwt()->>'sub'`)

---

## Navigation (Expo Router)

### File → Route Mapping

| File | Route | Notes |
|------|-------|-------|
| `app/index.tsx` | `/` | Redirects to `/(tabs)` |
| `app/(tabs)/index.tsx` | `/` (tabs) | Groups list |
| `app/(tabs)/scan.tsx` | `/scan` | Receipt/QR scanner |
| `app/group/[id]/index.tsx` | `/group/123` | Dynamic route |
| `app/group/[id]/expense/[expenseId].tsx` | `/group/123/expense/456` | Nested dynamic |
| `app/auth/sign-in.tsx` | `/auth/sign-in` | Auth group |

### Navigation Patterns

```typescript
import { router } from 'expo-router';

// Push (adds to stack)
router.push('/group/123');

// Replace (replaces current)
router.replace('/auth/sign-in');

// Back
router.back();

// With params
router.push(`/join?code=${shareCode}`);

// Access params
const { id } = useLocalSearchParams<{ id: string }>();
```

### Deep Links

| Scheme | Pattern | Handler |
|--------|---------|---------|
| `splitfree://` | `splitfree://join/{code}` | Opens `/join?code={code}` |
| `https://` | `splitfree.app/join/{code}` | Universal link → same handler |

---

## State Management

### No Redux/Zustand - React Patterns Only

```typescript
// 1. Local state (useState)
const [loading, setLoading] = useState(false);

// 2. Screen data with useFocusEffect
useFocusEffect(
  useCallback(() => {
    fetchData();
  }, [fetchData])
);

// 3. Global auth state (Context)
const { userId, user, signOut } = useAuth();

// 4. Supabase as source of truth
// Always fetch fresh data, sync every 10 seconds
```

### Data Fetching Pattern

```typescript
const [data, setData] = useState<Group[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

const fetchData = useCallback(async () => {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  setData(data || []);
}, [getSupabase]);

// Initial load
useEffect(() => {
  fetchData().finally(() => setLoading(false));
}, []);

// Refetch on screen focus
useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

// Pull to refresh
const onRefresh = () => {
  setRefreshing(true);
  fetchData().finally(() => setRefreshing(false));
};
```

---

## Key Development Commands

```bash
# Start development server
npm start                    # Expo Go (limited features)
npx expo run:ios            # Native build (full features)

# Type checking
npm run typecheck           # npx tsc --noEmit

# Testing
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Supabase tests
npm run test:coverage       # With coverage report

# Building
npm run build:testflight    # iOS TestFlight build
npm run build:sim-release   # Local simulator release build

# Database
# Migrations are applied via Supabase MCP or dashboard
```

---

## Error Handling Pattern

### Result Type (`lib/result.ts`)

```typescript
import { Result, ok, fail, isSuccess, PostgresErrorCodes } from '../lib/result';

async function createMember(name: string): Promise<Result<Member>> {
  const { data, error } = await supabase
    .from('members')
    .insert({ name })
    .select()
    .single();

  if (error) {
    if (error.code === PostgresErrorCodes.UNIQUE_VIOLATION) {
      return fail('Name already taken', error.code);
    }
    return fail(error.message, error.code);
  }

  return ok(data);
}

// Usage
const result = await createMember('Alice');
if (isSuccess(result)) {
  console.log(result.data);
} else {
  Alert.alert('Error', result.error);
}
```

---

## Common Patterns

### Supabase Queries

```typescript
// Select with joins
const { data } = await supabase
  .from('expenses')
  .select(`
    *,
    payer:members!paid_by(id, name),
    splits(member_id, amount)
  `)
  .eq('group_id', groupId)
  .is('deleted_at', null);

// Insert and return
const { data, error } = await supabase
  .from('groups')
  .insert({ name, emoji, share_code })
  .select()
  .single();

// Batch insert
await supabase.from('splits').insert(splitRecords);

// Update
await supabase
  .from('expenses')
  .update({ description: 'New name' })
  .eq('id', expenseId);
```

### Push Notifications

```typescript
import { notifyMemberJoined, notifySettlementRecorded } from '../lib/notifications';

// After member joins
await notifyMemberJoined(supabase, groupId, memberName, groupName, excludeUserId);

// After settlement
await notifySettlementRecorded(supabase, groupId, fromName, toName, amount, excludeUserId);
```

---

## Testing Strategy

### Unit Tests (`__tests__/utils.test.ts`)
- Pure functions: `calculateBalances`, `simplifyDebts`, `formatCurrency`
- No mocking required

### Integration Tests (`__tests__/*.integration.test.ts`)
- Require `SUPABASE_SERVICE_ROLE_KEY` for write access
- Test actual database operations
- Clean up test data in `afterAll`

### Running Tests
```bash
npm test                              # All
npm test -- --testPathPattern=utils   # Specific file
npm run test:coverage                 # With coverage
```

---

## Important Gotchas

1. **useFocusEffect vs useEffect**: Use `useFocusEffect` for screen data that needs refreshing when navigating back.

2. **Authenticated Supabase**: Always use `const supabase = await getSupabase()` for RLS-protected operations.

3. **clerk_user_id vs user_id**: The `clerk_user_id` column is the TEXT Clerk ID. Legacy `user_id` is unused.

4. **Expo Go Limitations**: Push notifications, native modules require development build (`npx expo run:ios`).

5. **Deep Link Format**: Always use `splitfree://join/{code}` format. Handle URL encoding.

6. **Currency**: Group has default currency. Individual expenses can have different currency with exchange rate.

---

## Deployment Checklist

### Before TestFlight/Production:
- [ ] All TypeScript errors resolved (`npm run typecheck`)
- [ ] Tests passing (`npm test`)
- [ ] Environment variables set in EAS dashboard
- [ ] Sentry release configured
- [ ] Privacy manifests up to date (`app.json`)
- [ ] App Store Connect build number incremented

### EAS Environment Variables (expo.dev)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_POSTHOG_API_KEY`
- `SENTRY_AUTH_TOKEN` (for source maps)

---

## External Integrations Deep Dive

### 1. Clerk (Authentication)

**Dashboard:** [dashboard.clerk.com](https://dashboard.clerk.com)

**What it does:**
- User sign-up and sign-in
- OAuth (Apple, Google)
- Password reset
- Session management
- JWT token issuance

**Why Clerk over Supabase Auth:**
- Better React Native SDK with native UI components
- Smoother OAuth flows on mobile
- We still use Supabase for everything else (RLS works with Clerk JWTs)

**Key Configuration:**
```
Staging: pk_test_... (Development instance)
Production: pk_live_... (Production instance with custom domain clerk.split-it.net)
```

**Files:**
- `lib/clerk.ts` - Configuration
- `lib/auth-context.tsx` - React context provider
- `lib/supabase.ts` - JWT integration with Supabase

**How JWT auth works:**
1. User signs in via Clerk
2. Clerk issues a JWT with user's `sub` (Clerk user ID)
3. We pass this JWT to Supabase as `Authorization: Bearer <token>`
4. Supabase verifies JWT against Clerk's JWKS endpoint
5. RLS policies use `auth.jwt()->>'sub'` to get the Clerk user ID

### 2. Supabase (Backend-as-a-Service)

**Dashboard:** [supabase.com/dashboard](https://supabase.com/dashboard)

**Components we use:**

| Component | Purpose | Key Files |
|-----------|---------|-----------|
| **PostgreSQL** | All app data (17+ tables) | `supabase/migrations/` |
| **Row Level Security** | Authorization at DB level | Policies in migrations |
| **Storage** | Receipt images | `lib/storage.ts` (if exists) |
| **Realtime** | Live updates for receipt claiming | `lib/realtime.ts` |
| **Edge Functions** | Server-side code | `supabase/functions/` |

**Environments:**

| Environment | Project Ref | Clerk Instance | Use |
|-------------|-------------|----------------|-----|
| **Staging** | `odjvwviokthebfkbqgnx` | Development | Dev, testing |
| **Production** | `rzwuknfycyqitcbotsvx` | Production | Live app |

**Edge Functions:**
- `scan-receipt` - Calls Gemini for OCR, returns structured items
- `send-push-notification` - Sends push via Expo
- `process-recurring-expenses` - (Planned) Auto-generate recurring expenses

**Secrets Management:**
```bash
# View secrets
npx supabase secrets list --project-ref <ref>

# Set a secret
npx supabase secrets set GEMINI_API_KEY=... --project-ref <ref>
```

### 3. Google Gemini (Receipt OCR)

**What it does:** Extracts items, prices, tax, tip from receipt photos using AI vision.

**Model:** Gemini 2.5 Flash (fast, cheap, good accuracy)

**How it works:**
1. User takes photo → uploaded to Supabase Storage
2. App calls `scan-receipt` Edge Function with base64 image
3. Edge Function sends to Gemini with structured prompt
4. Gemini returns JSON: `{ items: [...], subtotal, tax, tip, total, merchant }`
5. App displays items for user to claim

**Files:**
- `lib/ocr.ts` - Client-side OCR service
- `supabase/functions/scan-receipt/index.ts` - Edge Function

**API Key:** Stored as Supabase secret `GEMINI_API_KEY`

**Prompt Engineering:** The prompt in `scan-receipt/index.ts` instructs Gemini to:
- Extract line items with quantities and unit prices
- Identify modifiers (+ Bacon, Extra cheese)
- Detect shared items (Pitcher, Family Style)
- Parse tax, tip, discounts, service charges

### 4. PostHog (Analytics)

**Dashboard:** [app.posthog.com](https://app.posthog.com)

**What it does:** Event tracking, user analytics, feature flags

**Key events we track:**
```typescript
// lib/analytics.ts
trackEvent('expense_created', { groupId, amount, splitType });
trackEvent('receipt_scanned', { groupId, itemCount });
trackEvent('settlement_recorded', { groupId, amount, method });
trackEvent('group_created', { currency });
trackEvent('friend_added', {});
```

**Screen tracking:** Automatic via `trackScreen()` in screen components.

### 5. Sentry (Error Tracking)

**Dashboard:** [sentry.io](https://sentry.io)

**What it does:** Crash reporting, error monitoring, performance

**Configuration:**
- `lib/sentry.ts` - Initialization
- `app.json` - Sentry plugin config with org/project

**Sampling:**
- Development: 100% error + 100% traces
- Production: 100% errors + 20% traces (cost control)

### 6. Payment Apps (Deep Links)

**What it does:** Opens Venmo/PayPal/CashApp/Zelle with pre-filled amount

**Files:** `lib/payment-links.ts`

**URL Schemes:**
```typescript
// Venmo
`venmo://paycharge?txn=pay&recipients=${username}&amount=${amount}&note=${note}`

// PayPal
`https://paypal.me/${username}/${amount}`

// Cash App
`cashapp://cash.app/$${cashtag}/${amount}`

// Zelle (no direct deep link, opens bank app)
```

**QR Codes:** We generate QR codes with these URLs for easy payment.

---

## Roadmap & What's Next

### Currently Shipped (Production Ready)

| Feature | Status | Notes |
|---------|--------|-------|
| Core expense splitting | ✅ | Groups, members, expenses, splits, balances |
| Multiple split methods | ✅ | Equal, exact, percentage, shares |
| Multi-currency | ✅ | Per-expense currency with exchange rates |
| Receipt scanning (OCR) | ✅ | Gemini-powered extraction |
| Receipt item claiming | ✅ | Per-item claiming with splits |
| Settlements | ✅ | Record payments, multiple methods |
| Payment deep links | ✅ | Venmo, PayPal, Cash App, Zelle |
| Payment QR codes | ✅ | Generate QR for payment apps |
| Group sharing | ✅ | Share codes, QR codes |
| Friends system | ✅ | Request, accept, block, search |
| Push notifications | ✅ | Expense added, settlement, member joined |
| Payment reminders | ✅ | Create reminders, frequency options |
| User profiles | ✅ | Avatar, payment usernames, currency |
| Activity feed | ✅ | Group and global activity streams |
| Search & filtering | ✅ | Search expenses, filter by category/date |
| Soft delete/trash | ✅ | Recover deleted expenses |
| Offline support | ✅ | SQLite cache, sync queue |
| Analytics | ✅ | PostHog, Sentry integration |
| RLS security | ✅ | Clerk + Supabase JWKS auth |

### Partially Built (Needs Work)

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| **Recurring expenses** | DB schema, UI screens | Auto-generation cron/edge function |
| **Notification preferences** | Backend support | UI to customize notifications |
| **Export data** | `lib/export.ts` library | Full UI integration, CSV/PDF buttons |

### Planned Features (Not Built)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Voice expense entry** | P0 | "Add $50 dinner split with Sarah" |
| **Conversational voice claiming** | P0 | "I had the burger, Drew got salmon" |
| **Voice corrections** | P1 | "Actually Drew had the burger" |
| **Receipt pre-assignment** | P1 | Suggest assignments from history |
| **iMessage extension** | P2 | Share receipts in iMessage, friends claim |
| **Web claiming interface** | P2 | split-it.net/r/X7kM9p for friends without app |
| **Dark mode toggle** | P2 | User-controlled theme |
| **Budget tracking** | P3 | Set spending limits per category |
| **Group statistics** | P3 | Charts, spending trends |

### Technical Debt & Improvements

- [ ] Replace `Math.random()` with `expo-crypto` for share codes
- [ ] Add input validation/sanitization throughout
- [ ] Gate console.log for production builds
- [ ] Add more comprehensive unit tests
- [ ] Performance profiling on older devices

---

## Getting Started Tasks

### Day 1: Environment Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/sebrusso/split.git
   cd split/splitfree
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Ask team for staging credentials
   ```

3. **Run the app**
   ```bash
   npm start
   # Scan QR with Expo Go, or press 'i' for iOS simulator
   ```

4. **Explore the app**
   - Create a group
   - Add some expenses
   - Try scanning a receipt (take photo of any receipt)
   - Check balances

### Day 2-3: Codebase Familiarization

5. **Read the key files** (in this order):
   - `lib/types.ts` - All TypeScript interfaces
   - `lib/supabase.ts` - How we connect to backend
   - `lib/balances.ts` - Core balance calculation logic
   - `app/(tabs)/index.tsx` - Home screen
   - `app/group/[id]/index.tsx` - Group detail screen

6. **Understand the database**
   - Read `docs/DATABASE_ARCHITECTURE.md`
   - Browse migrations in `supabase/migrations/`
   - Query staging DB via Supabase dashboard

7. **Run the tests**
   ```bash
   npm test
   npm run test:coverage
   ```

### Week 1: First Contributions

8. **Pick a starter task:**

   **Easy:**
   - Add a new expense category icon (`lib/categories.ts`)
   - Fix a UI alignment issue
   - Add a missing TypeScript type

   **Medium:**
   - Write unit tests for an untested utility function
   - Implement a small UI improvement
   - Add analytics tracking to a screen that's missing it

   **Harder:**
   - Add the notification preferences UI
   - Implement CSV export button
   - Improve receipt OCR accuracy for a specific receipt type

9. **Make your first PR**
   - Create a feature branch
   - Make changes
   - Run `npm run typecheck` and `npm test`
   - Push and open PR

### Week 2+: Feature Development

10. **Work on a bigger feature:**
    - **Recurring expenses** - Add the auto-generation edge function
    - **Export UI** - Add buttons to export expenses as CSV/PDF
    - **Voice input** - Start prototyping the voice expense flow

---

## Tips for New Developers

### Code Style

- **TypeScript:** Strict mode, avoid `any`
- **Components:** One component per file, clear naming
- **State:** Prefer `useState` + `useFocusEffect` over global state
- **Errors:** Always handle loading and error states

### Common Mistakes to Avoid

| Mistake | Instead Do |
|---------|------------|
| Using `useEffect` for screen data | Use `useFocusEffect` |
| Calling Supabase without auth | Use `const supabase = await getSupabase()` |
| Forgetting to handle errors | Always check `if (error)` |
| Hardcoding user IDs | Get from `useAuth()` |
| Modifying production DB directly | Always use migrations |

### Debugging Tips

- **Supabase errors:** Check RLS policies, make sure user is authenticated
- **Receipt upload fails:** Check Storage bucket RLS, GEMINI_API_KEY secret
- **Push notifications broken:** Check `push_tokens` table, Expo push credentials
- **Navigation issues:** Check Expo Router file structure matches expected routes

### Useful Commands

```bash
# Type checking
npm run typecheck

# Run specific test
npm test -- --testPathPattern=utils

# Check what's changed
git status
git diff

# See Supabase migrations
ls -la supabase/migrations/

# Check staging secrets
npx supabase secrets list --project-ref odjvwviokthebfkbqgnx
```

---

## Key Documentation

| Document | What It Covers |
|----------|----------------|
| `CLAUDE.md` | AI assistant instructions, project context |
| `docs/MASTER_PRD.md` | Product requirements, feature status, full roadmap |
| `docs/DATABASE_ARCHITECTURE.md` | Schema docs, table relationships |
| `docs/DATABASE_WORKFLOW.md` | Migration procedures, staging vs production |
| `docs/CLERK_SUPABASE_RLS_SETUP.md` | How auth integration works |
| `docs/RECEIPT_SPLITTING_ARCHITECTURE.md` | Receipt feature technical design |
| `docs/SECURITY_REVIEW.md` | Security audit, known issues |
| `docs/COMPETITIVE_STRATEGY.md` | Market positioning, messaging |

---

## Questions?

- **Slack:** Ask in #split-dev channel
- **Code questions:** Check docs first, then ask team
- **Stuck on a bug:** Create a draft PR and ask for help

Welcome to the team! 🚀
