# Git Workflow for split it.

> **Critical for mobile apps:** Unlike web apps, mobile apps can't be rolled back once released. Users stay on old versions for weeks. This workflow protects against shipping broken builds.

---

## Branch Strategy: GitHub Flow with Staging

We use GitHub Flow with a staging branch for database testing:

```
main (protected) ─────────────────────► Production DB + TestFlight
  │
staging ──────────────────────────────► Staging DB (test migrations)
  │
  ├── feature/add-voice-input
  ├── fix/venmo-onboarding-loop
  ├── chore/update-dependencies
  └── hotfix/critical-auth-fix
```

### Environment Mapping

| Branch | Supabase Database | Clerk Instance | EAS Profiles |
|--------|-------------------|----------------|--------------|
| `main` | Production (`rzwuknfycyqitcbotsvx`) | Production (`pk_live_...`) | `testflight`, `production` |
| `staging` | Staging (`odjvwviokthebfkbqgnx`) | Development (`pk_test_...`) | `development`, `preview` |

### Branch Types

| Prefix | Purpose | Example | Merges To |
|--------|---------|---------|-----------|
| `feature/` | New functionality | `feature/receipt-voice-claiming` | `staging` → `main` via PR |
| `fix/` | Bug fixes | `fix/navigation-loop` | `staging` → `main` via PR |
| `chore/` | Maintenance, deps, docs | `chore/update-expo-sdk` | `main` via PR |
| `hotfix/` | Critical production fixes | `hotfix/auth-crash` | `main` via PR (expedited) |

### Branch Naming Convention

```
<type>/<short-description>

Examples:
feature/add-dark-mode
fix/balance-calculation-rounding
chore/upgrade-supabase-client
hotfix/clerk-session-crash
```

---

## The Golden Rules

### 1. Never push directly to `main`

All changes go through Pull Requests. This ensures:
- Code review happens
- TypeScript checks pass
- Tests run
- Someone else sees the changes before they ship

### 2. Keep branches short-lived

- Feature branches should live < 1 week
- If longer, break into smaller PRs
- Stale branches accumulate merge conflicts

### 3. Commit often, push daily

- Small commits are easier to review and revert
- Daily pushes prevent losing work
- Others can see progress

### 4. Never commit secrets

- `.env.local` is gitignored for a reason
- API keys go in EAS environment variables
- If you accidentally commit a secret, rotate it immediately

### 5. Test database changes on staging first

- Migrations auto-deploy when pushed to `staging` branch
- Verify on staging before merging to `main`
- Production migrations only run when merged to `main`

---

## Staging Branch: When & Why

### Purpose

The `staging` branch exists to **safely test database migrations** before they hit production. Supabase's GitHub integration automatically runs migrations when you push to this branch.

### When to Use Staging

| Scenario | Use Staging? | Why |
|----------|--------------|-----|
| Adding RLS policies | ✅ Yes | RLS bugs can lock out all users |
| Creating new tables | ✅ Yes | Verify foreign keys, constraints work |
| Modifying existing tables | ✅ Yes | Prevent data loss or corruption |
| Adding indexes | ✅ Yes | Large indexes can timeout |
| UI-only changes | ❌ No | No database impact, go direct to main |
| Bug fixes (no DB) | ❌ No | Faster iteration |

### Staging Workflow

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/new-rls-policy

# 2. Create and test migration locally
npx supabase migration new add_user_preferences
# Edit the migration file
npx supabase db reset  # Test locally

# 3. Merge to staging first
git add supabase/migrations/
git commit -m "Add user preferences table"
git push -u origin feature/new-rls-policy

# Create PR targeting staging branch
# Merge to staging

# 4. Verify on staging
#    - Check Supabase dashboard (staging project)
#    - Test with preview build or Expo Go
#    - Run integration tests against staging

# 5. If staging works, merge staging → main
git checkout main
git merge staging
git push origin main
```

### Staging vs Preview Builds

| Build Profile | Database | Use Case |
|---------------|----------|----------|
| `development` | Staging | Local Expo Go development |
| `preview` | Staging | Internal testing builds |
| `testflight` | Production | Beta testing with real users |
| `production` | Production | App Store release |

---

## Workflow: Making Changes

### Step 1: Create a Branch

```bash
# Make sure you're on latest main
git checkout main
git pull origin main

# Create your branch
git checkout -b feature/my-new-feature
```

### Step 2: Make Changes & Commit

```bash
# Stage specific files (preferred over git add .)
git add lib/balances.ts app/group/[id]/balances.tsx

# Commit with descriptive message
git commit -m "Fix balance rounding to 2 decimal places

- Update calculateBalances to use toFixed(2)
- Add unit tests for edge cases
- Fixes #42"
```

#### Commit Message Format

```
<short summary in imperative mood> (max 50 chars)

<optional body explaining WHY, not what>
<reference issue numbers>
```

Good examples:
- `Fix Venmo onboarding navigation loop`
- `Add receipt voice claiming feature`
- `Update Supabase client to v2.49.0`

Bad examples:
- `fixed stuff`
- `WIP`
- `changes`

### Step 3: Push & Create PR

```bash
# Push your branch
git push -u origin feature/my-new-feature
```

Then create a Pull Request on GitHub with:
- Clear title matching your branch purpose
- Description of what changed and why
- Screenshots for UI changes
- Link to related issues

### Step 4: Get Review & Merge

1. Request review from a team member
2. Address feedback
3. Ensure CI checks pass
4. Squash and merge (keeps main history clean)

---

## Workflow: Pushing to TestFlight

### Pre-flight Checklist

Before building for TestFlight:

- [ ] All changes committed and pushed
- [ ] PR merged to `main` (or working on `main` for solo work)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (at least unit tests)
- [ ] No uncommitted database migrations
- [ ] Tested locally in Expo Go or simulator

### Build & Submit

```bash
# Pull latest main
git checkout main
git pull origin main

# Verify clean state
git status  # Should show "nothing to commit"

# Run pre-flight checks
npm run typecheck
npm test

# Build and auto-submit to TestFlight
eas build --profile testflight --platform ios --auto-submit

# Note the build number (auto-incremented)
# Example: Build 22
```

### Post-Build

1. **Document the build** in Slack/Discord:
   ```
   🚀 TestFlight Build 22 submitted
   - Fixed: Venmo onboarding navigation loop
   - Fixed: Join group permission error
   - Added: Auto-clear stale sessions
   ```

2. **Test on device** once Apple processes (~10-15 min)

3. **If issues found**, fix and submit new build (don't patch old builds)

---

## Workflow: Database Migrations

Database changes follow special rules since they affect production data.

### Creating Migrations

```bash
# Create migration file
npx supabase migration new add_user_preferences

# Edit the file in supabase/migrations/
# Test locally
npx supabase db reset

# Commit the migration
git add supabase/migrations/
git commit -m "Add user preferences table"
```

### Deploying Migrations (Safe Path)

```bash
# 1. Push to staging first
git checkout staging
git merge feature/my-migration
git push origin staging

# 2. Verify in Supabase Dashboard
#    - Check staging project (odjvwviokthebfkbqgnx)
#    - Confirm migration applied
#    - Test the feature

# 3. If good, merge to main (production)
git checkout main
git merge staging
git push origin main

# 4. Verify in production
#    - Check production project (rzwuknfycyqitcbotsvx)
```

### Deploying Migrations (Fast Path - UI Only)

If the migration has NO production data risk:

```bash
# Direct to main (skip staging)
git checkout main
git merge feature/my-migration
git push origin main
```

### Critical: Never Have Uncommitted Migrations

Uncommitted migrations = production doesn't have them = features break.

### Emergency: Direct SQL Execution

If you must fix production immediately without waiting for GitHub integration:

```bash
# Use Supabase MCP tool (dangerous - use sparingly)
# mcp__supabase__execute_sql with the SQL statement
# ALWAYS create a matching migration file afterward
```

See `docs/DATABASE_WORKFLOW.md` for detailed migration procedures.

---

## Workflow: Hotfixes (Critical Production Bugs)

When production is broken:

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-fix

# Make minimal fix
# ... edit files ...

# Commit with urgency noted
git commit -m "Hotfix: Clear stale Clerk sessions on sign-in error

Critical fix for users unable to sign in after app update."

# Push immediately
git push -u origin hotfix/critical-auth-fix

# Create PR marked as urgent
# Get expedited review (ping team directly)
# Merge ASAP

# Build new TestFlight immediately
eas build --profile testflight --platform ios --auto-submit
```

---

## Protecting Branches (GitHub Settings)

Configure these rules in GitHub repo settings:

### Branch Protection Rules for `main`

- [x] Require pull request reviews before merging (1 approval)
- [x] Require status checks to pass (TypeScript, tests)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
- [ ] Require signed commits (optional, nice to have)

### Branch Protection Rules for `staging`

Staging can be less strict since it's for testing:

- [ ] Require pull request reviews (optional - can push directly for quick tests)
- [x] Require status checks to pass (TypeScript, tests)
- [ ] Allow force pushes (for resetting staging to match main)

### Status Checks to Require

Set up GitHub Actions (`.github/workflows/ci.yml`):

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

---

## Daily Workflow Summary

### Start of Day

```bash
git checkout main
git pull origin main
git status  # Check for uncommitted work
```

### During Development

```bash
# Work on your branch
git checkout -b feature/my-feature

# Commit frequently
git add <files>
git commit -m "Description"

# Push at least daily
git push -u origin feature/my-feature
```

### End of Day

```bash
# Ensure all work is pushed
git status
git push

# If work isn't ready for PR, that's fine
# But it should be on GitHub, not just local
```

### Before TestFlight Build

```bash
git checkout main
git pull origin main
git status  # Must be clean!
npm run typecheck
npm test
eas build --profile testflight --platform ios --auto-submit
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Create branch | `git checkout -b feature/name` |
| Stage files | `git add <files>` |
| Commit | `git commit -m "message"` |
| Push branch | `git push -u origin branch-name` |
| Switch to main | `git checkout main` |
| Update main | `git pull origin main` |
| See status | `git status` |
| See changes | `git diff` |
| See history | `git log --oneline -10` |
| Undo uncommitted changes | `git checkout -- <file>` |
| Stash work temporarily | `git stash` / `git stash pop` |

---

## Sources & Further Reading

- [A Pragmatic Git Workflow for App Development Teams](https://medium.com/@kibotu/a-pragmatic-git-workflow-for-app-development-teams-762dff6fc138)
- [A Scalable Git Workflow for Small Teams](https://medium.com/@jatinthummar/a-scalable-git-workflow-for-small-teams-that-still-works-when-you-grow-7f3cff7b635e)
- [Git Branching for Small Teams](https://dev.to/victoria/git-branching-for-small-teams-2n64)
- [Atlassian Git Workflow Comparison](https://www.atlassian.com/git/tutorials/comparing-workflows)

---

**Last Updated:** 2026-02-01
