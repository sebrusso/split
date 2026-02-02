# Database Environment Setup

This guide explains how to set up separate development and production database environments using Supabase Branching and Clerk authentication.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Codebase                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  supabase/migrations/  ← Single source of truth            ││
│  │  supabase/seed.sql     ← Auto-seeds branches               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Local Dev    │    │  Staging      │    │  Production   │
│  (supabase    │    │  Branch       │    │  (main)       │
│   start)      │    │  (persistent) │    │               │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ Clerk Dev     │    │ Clerk Dev     │    │ Clerk Prod    │
│ instance      │    │ instance      │    │ instance      │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
   Expo Go /             TestFlight            App Store /
   Dev Client            Internal              Play Store
```

---

## Phase 1: Enable Supabase Branching & GitHub Integration

### 1.1 Enable GitHub Integration

1. Go to **Supabase Dashboard** → Your Project → **Settings** → **Integrations**
2. Click **Connect** next to GitHub
3. Authorize Supabase to access your GitHub account
4. Select repository: `sebrusso/split`
5. Set production branch: `main`

This enables automatic deployment of migrations when you merge to main.

### 1.2 Create Persistent Staging Branch

1. In Supabase Dashboard, click **Branches** in the sidebar
2. Click **Create Branch**
3. Name: `staging` (or `develop`)
4. Check **Persistent branch** (prevents auto-deletion)
5. Click **Create**

The staging branch will have:
- Its own database instance
- Unique API endpoints (different URL!)
- Separate Auth settings
- Independent Storage buckets

### 1.3 Get Staging Branch Credentials

1. In Supabase Dashboard, use the branch switcher (top-left) to select **staging**
2. Go to **Settings** → **API**
3. Copy:
   - **Project URL**: `https://xxxx-staging.supabase.co`
   - **anon public key**: Different from production!

---

## Phase 2: Configure Clerk for Both Environments

### 2.1 Configure Clerk for Production (Main Branch)

1. Go to **Clerk Dashboard** → Select your **Production** instance
2. Navigate to **Integrations** → **Supabase**
3. Enable the integration
4. Copy the Clerk domain (e.g., `clerk.split-it.net`)
5. In **Supabase Dashboard**:
   - Switch to **main** branch (production)
   - Go to **Authentication** → **Third Party Auth**
   - Click **Add provider** → **Clerk**
   - Paste the production Clerk domain: `clerk.split-it.net`

### 2.2 Configure Clerk for Staging Branch

1. Go to **Clerk Dashboard** → Select your **Development** instance
2. Navigate to **Integrations** → **Supabase**
3. Enable the integration
4. Copy the Clerk domain (e.g., `promoted-rattler-76.clerk.accounts.dev`)
5. In **Supabase Dashboard**:
   - Switch to **staging** branch
   - Go to **Authentication** → **Third Party Auth**
   - Click **Add provider** → **Clerk**
   - Paste the dev Clerk domain

---

## Phase 3: Environment Variables Setup

### 3.1 EAS Development Environment

Set up environment variables for development builds:

```bash
# Create development environment if it doesn't exist
eas env:create development

# Point to staging branch
eas env:create development --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://<STAGING_BRANCH_URL>.supabase.co" --visibility plaintext

eas env:create development --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "<STAGING_BRANCH_ANON_KEY>" --visibility sensitive

eas env:create development --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --value "pk_test_cHJvbW90ZWQtcmF0dGxlci03Ni5jbGVyay5hY2NvdW50cy5kZXYk" \
  --visibility plaintext
```

### 3.2 Verify Production EAS Environment

```bash
# List production environment variables
eas env:list production

# Should show:
# EXPO_PUBLIC_SUPABASE_URL = https://rzwuknfycyqitcbotsvx.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY = (production anon key)
# EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_... (production Clerk)
```

### 3.3 Local Development (.env.local)

Update `.env.local` with staging branch credentials:

```bash
# Point to staging branch for local development
EXPO_PUBLIC_SUPABASE_URL=https://<STAGING_BRANCH_URL>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<STAGING_BRANCH_ANON_KEY>
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cHJvbW90ZWQtcmF0dGxlci03Ni5jbGVyay5hY2NvdW50cy5kZXYk
```

---

## Phase 4: Database Seeding

### How Seeding Works

The `supabase/seed.sql` file automatically runs when:
- Creating a new Supabase branch (seeds once on creation)
- Running `supabase db reset` locally

### Seed Locally

```bash
# Reset local database and apply seed data
npm run db:seed

# Or directly with Supabase CLI
supabase db reset
```

### Reseed a Remote Branch

To reseed a remote branch, you need to delete and recreate it:

1. In Supabase Dashboard → Branches
2. Delete the branch
3. Recreate it (seed runs automatically on creation)

Or, for the staging branch (if you want to keep it):
```bash
# Reset linked branch (WARNING: destroys all data)
npm run db:seed:remote
```

---

## Phase 5: Migration Workflow

With GitHub integration enabled, migrations flow automatically:

```
1. Create feature branch from `develop` in git
           ↓
2. Make schema changes: `supabase migration new <name>`
           ↓
3. Test locally: `supabase db reset`
           ↓
4. Push to GitHub → Opens PR
           ↓
5. Supabase creates preview branch (or uses staging)
           ↓
6. Merge PR to develop → Migrations deploy to staging
           ↓
7. Test on Expo Go with staging database
           ↓
8. Merge develop to main → Migrations deploy to production
```

### Creating New Migrations

```bash
# Create a new migration file
supabase migration new add_user_preferences

# Edit the migration file in supabase/migrations/
# Then test locally
supabase db reset

# Push to GitHub when ready
git add supabase/migrations/
git commit -m "Add user preferences table"
git push
```

---

## Verification Checklist

After setup, verify each component works:

- [ ] **Local dev works**: `supabase start && supabase db reset` loads seed data
- [ ] **Staging branch has data**: Check Supabase dashboard → staging branch → Table Editor
- [ ] **Expo Go connects to staging**: Sign in with dev Clerk, see test data
- [ ] **TestFlight connects to prod**: Sign in with prod Clerk (`clerk.split-it.net`)
- [ ] **Migrations flow**: Create migration locally, push, verify in staging, merge to main, verify in production

---

## Build Profiles Summary

| Profile | Environment | Database | Clerk | Use Case |
|---------|-------------|----------|-------|----------|
| `development` | development | Staging branch | Dev instance | Expo Go / Dev Client |
| `preview` | development | Staging branch | Dev instance | Internal testing |
| `testflight` | production | Main (prod) | Prod instance | TestFlight builds |
| `production` | production | Main (prod) | Prod instance | App Store / Play Store |

---

## Cost Estimate (Supabase Pro Plan)

| Item | Cost |
|------|------|
| Pro Plan Base | $25/month |
| Staging Branch (~24/7) | ~$10/month |
| Preview Branches (ephemeral) | Minimal |
| **Total Estimate** | ~$35-40/month |

---

## Troubleshooting

### "Invalid API key" errors
- Verify you're using the correct anon key for the environment
- Check `.env.local` matches the Supabase branch you're connecting to

### Authentication not working
- Ensure Clerk third-party auth is configured in Supabase for BOTH branches
- Verify the Clerk domain matches (dev vs prod instance)

### Seed data not appearing
- Run `supabase db reset` to apply seed.sql
- For remote branches, delete and recreate to reseed

### Migrations not applying to production
- Check GitHub integration is connected in Supabase dashboard
- Verify the PR was merged to `main` (not just `develop`)
