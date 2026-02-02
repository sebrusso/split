# split it. - CLAUDE.md

## Project Overview

**split it.** is a 100% free, ad-supported expense-splitting mobile app built as a Splitwise alternative. Users frustrated with paywalls and transaction limits can create groups, track shared expenses, and settle debts without restrictions.

### Tech Stack
- **Framework**: React Native + Expo (SDK 54)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based)
- **State**: React hooks + useFocusEffect for screen refreshes
- **Styling**: StyleSheet + custom theme system

---

## Architecture

### File Structure
```
splitfree/
├── app/                      # Expo Router screens
│   ├── _layout.tsx          # Root navigation + fonts
│   ├── index.tsx            # Home - groups list
│   ├── create-group.tsx     # Group creation modal
│   └── group/[id]/          # Dynamic group routes
│       ├── index.tsx        # Group detail
│       ├── add-expense.tsx  # Expense entry modal
│       └── add-member.tsx   # Add member modal
├── components/ui/           # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Avatar.tsx
│   └── index.ts             # Barrel export
├── lib/                     # Core utilities
│   ├── supabase.ts         # Supabase client
│   ├── types.ts            # TypeScript interfaces
│   ├── theme.ts            # Design system
│   └── utils.ts            # Helpers (balance calc, formatting)
├── __tests__/              # Jest test files
│   ├── utils.test.ts       # Unit tests
│   └── supabase.integration.test.ts
├── assets/                 # Images, splash screens
├── app.json               # Expo config
├── package.json
├── jest.config.js
└── tsconfig.json
```

### Database Schema (Supabase)
```sql
groups (id, name, emoji, currency, share_code, created_at)
members (id, group_id, name, user_id, created_at)
expenses (id, group_id, description, amount, paid_by, created_at)
splits (id, expense_id, member_id, amount)
```

All tables have RLS enabled with Clerk JWT-based policies.

---

## Database Environments

Uses Supabase Branching (Pro plan) for staging/production separation.

| Environment | Supabase Project | Clerk Instance | EAS Env | Build Profiles |
|-------------|------------------|----------------|---------|----------------|
| **Staging** | `odjvwviokthebfkbqgnx` | Development (`pk_test_...`) | development | development, preview |
| **Production** | `rzwuknfycyqitcbotsvx` | Production (`pk_live_...`) | production | testflight, production |

### Key Files
- `supabase/config.toml` - Branch refs, seeding config
- `supabase/seed.sql` - Test data (5 groups, 16 members, 17 expenses)
- `.env.local` - Local dev uses STAGING credentials

### Database Commands
```bash
# Seed staging database
node scripts/apply-baseline.js

# Create new migration
npx supabase migration new <name>

# Push migrations
npx supabase db push --linked
```

### Clerk Third-Party Auth
- **Staging**: `promoted-rattler-76.clerk.accounts.dev` → Supabase staging branch
- **Production**: `clerk.split-it.net` → Supabase main branch

---

## Development Patterns

### Parallel Operations
When implementing features, create related files simultaneously:
- Screen component + styles
- Corresponding test file
- Type definitions
- Navigation configuration

### Screen Data Fetching
Use `useFocusEffect` for screens that need to refetch on navigation return:
```typescript
import { useFocusEffect } from '@react-navigation/native';

useFocusEffect(
  useCallback(() => {
    fetchData();
  }, [fetchData])
);
```

### Supabase Queries
```typescript
// Fetch with joins
const { data, error } = await supabase
  .from('expenses')
  .select(`*, payer:members!paid_by(id, name)`)
  .eq('group_id', id);

// Insert with return
const { data, error } = await supabase
  .from('groups')
  .insert({ name, emoji, share_code })
  .select()
  .single();
```

### Component Patterns
- Use `SafeAreaView` with specific edges
- `KeyboardAvoidingView` for forms
- `FlatList` with `RefreshControl` for lists
- Modals via `presentation: 'modal'` in Stack.Screen

---

## Commands

```bash
# Development
npm start              # Start Expo dev server
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
npm run web           # Run in browser

# Testing
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Supabase integration tests
npm run test:coverage # With coverage report

# Type checking
npx tsc --noEmit
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/utils.ts` | Balance calculation, debt simplification, formatting |
| `lib/theme.ts` | Colors, typography, spacing, shadows |
| `lib/types.ts` | Group, Member, Expense, Split, Balance, Settlement |
| `lib/supabase.ts` | Supabase client initialization |
| `app/_layout.tsx` | Navigation config, font loading, screen options |

---

## Balance Calculation Algorithm

```typescript
// Core logic in lib/utils.ts
calculateBalances(expenses, members) → Map<memberId, balance>
// Positive balance = owed money
// Negative balance = owes money

simplifyDebts(balances, members) → Settlement[]
// Minimizes number of transactions needed to settle
```

---

## Testing Strategy

### Unit Tests (`__tests__/utils.test.ts`)
- `generateShareCode()` - format validation, uniqueness
- `formatCurrency()` - USD/EUR, decimals, edge cases
- `formatRelativeDate()` - today, yesterday, days ago
- `getInitials()` - single/multi-word names
- `calculateBalances()` - equal/unequal splits, multiple expenses
- `simplifyDebts()` - debt minimization, rounding

### Integration Tests (`__tests__/supabase.integration.test.ts`)
- CRUD operations for all tables
- Foreign key constraint enforcement
- Check constraints (amount > 0, splits >= 0)
- Unique share_code enforcement
- Cascade deletes
- Full balance calculation scenario

---

## Design System

### Colors
```typescript
primary: '#10B981'     // Green - money/trust
primaryLight: '#D1FAE5'
text: '#1F2937'
textSecondary: '#6B7280'
background: '#F9FAFB'
card: '#FFFFFF'
```

### Typography
- Font: Inter (400, 500, 600, 700)
- h1: 28px bold, h2: 24px bold, h3: 18px semibold
- body: 16px, small: 14px, caption: 12px

### Spacing
- xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32

---

## Day 2 TODO (Current Sprint)

- [ ] Balances Screen - "Who owes whom" summary UI
- [ ] Settle Up - Mark debts as settled
- [ ] Group Sharing - Deep links + QR codes
- [ ] Join Group Flow - Enter name via share link
- [ ] Offline Support - SQLite cache + sync queue

## Day 3 TODO (Next Sprint)

- [ ] AdMob integration (interstitials on app close)
- [ ] App Store assets (icon, screenshots, description)
- [ ] App Store submission
- [ ] Marketing launch (Reddit, TikTok, ProductHunt)

---

## Security Notes

### Supabase Security
- RLS enabled on all tables
- Anonymous key used (not service role)
- No sensitive data stored locally yet
- Share codes are 6-char alphanumeric (no confusing chars)

### GitHub Fine-grained PAT Configuration

**CRITICAL**: Use Fine-grained PATs instead of classic tokens or SSH keys for Claude Code integration.

#### Token Naming Convention
```
claude-code-splitfree-YYYY-MM
```
Example: `claude-code-splitfree-2026-01`

#### Required Repository Permissions
```json
{
  "repository_permissions": {
    "actions": "read",
    "contents": "write",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write"
  },
  "account_permissions": {}
}
```

#### Token Settings
- **Expiration**: 60 days maximum (shorter is better)
- **Repository access**: Only `sebrusso/split` (never "All repositories")
- **Resource owner**: Your personal account

#### Creating a New Token
1. GitHub.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Name: `claude-code-splitfree-YYYY-MM`
4. Expiration: 60 days
5. Repository access: "Only select repositories" → `sebrusso/split`
6. Permissions:
   - Contents: Read and write
   - Pull requests: Read and write
   - Issues: Read and write
   - Actions: Read-only
   - Metadata: Read-only (auto-selected)

#### Local Token Storage (macOS)
```bash
# Store token securely in Keychain
security add-generic-password \
  -a "$USER" \
  -s "claude-github-pat-splitfree" \
  -w "github_pat_YOUR_TOKEN_HERE"

# Retrieve token when needed
export GITHUB_TOKEN=$(security find-generic-password \
  -a "$USER" \
  -s "claude-github-pat-splitfree" \
  -w)
```

#### Token Rotation Schedule
- Rotate every 60 days (before expiration)
- Set calendar reminder for day 50
- Never commit tokens to git
- Revoke old tokens immediately after rotation

### Secrets Management

| Secret | Storage Location | Used For |
|--------|------------------|----------|
| GitHub PAT | macOS Keychain / GitHub Secrets | Git operations |
| Supabase Anon Key | `lib/supabase.ts` (public, safe) | Client API calls |
| Supabase Service Key | GitHub Secrets only | CI/CD migrations |
| Anthropic API Key | GitHub Secrets | Claude Code Actions |

---

## Performance Considerations

- Use `FlatList` for all lists (virtualized)
- Implement `useFocusEffect` (not `useEffect`) for screen data
- Consider image caching if adding avatars
- Bundle size: Currently minimal, monitor with expo-updates

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Check `lib/supabase.ts` has correct anon key |
| Screen data stale after navigation | Use `useFocusEffect` instead of `useEffect` |
| Back button shows "Index" | Set `title: 'Home'` on index screen in layout |
| TypeScript errors in tests | Add `!` for nullable Supabase responses |

---

## Related Documentation

- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/)
- [React Navigation Focus Events](https://reactnavigation.org/docs/function-after-focusing-screen/)
- [THREE_DAY_LAUNCH_PLAN.md](../THREE_DAY_LAUNCH_PLAN.md) - Full project roadmap
