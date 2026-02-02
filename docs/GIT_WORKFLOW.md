# Git Workflow for split it.

> **Critical for mobile apps:** Unlike web apps, mobile apps can't be rolled back once released. Users stay on old versions for weeks. This workflow protects against shipping broken builds.

---

## Branch Strategy: GitHub Flow (Simplified)

We use a simplified GitHub Flow optimized for small teams:

```
main (protected)
  │
  ├── feature/add-voice-input
  ├── fix/venmo-onboarding-loop
  ├── chore/update-dependencies
  └── hotfix/critical-auth-fix
```

### Branch Types

| Prefix | Purpose | Example | Merges To |
|--------|---------|---------|-----------|
| `feature/` | New functionality | `feature/receipt-voice-claiming` | `main` via PR |
| `fix/` | Bug fixes | `fix/navigation-loop` | `main` via PR |
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

### Deploying Migrations

1. **Commit and push** to GitHub
2. **Supabase GitHub integration** auto-deploys to production
3. **Verify** migration applied in Supabase dashboard

### Critical: Never Have Uncommitted Migrations

Uncommitted migrations = production doesn't have them = features break.

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

## Protecting Main Branch (GitHub Settings)

Configure these rules in GitHub repo settings:

### Branch Protection Rules for `main`

- [x] Require pull request reviews before merging (1 approval)
- [x] Require status checks to pass (TypeScript, tests)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
- [ ] Require signed commits (optional, nice to have)

### Status Checks to Require

Set up GitHub Actions (`.github/workflows/ci.yml`):

```yaml
name: CI

on:
  pull_request:
    branches: [main]

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

## Handling the Current State (127 Uncommitted Changes)

You have significant uncommitted work. Here's how to clean it up:

### Option A: Batch Commit by Category

```bash
# See what's changed
git status

# Group related changes and commit separately:

# 1. Test file updates
git add __tests__/
git commit -m "Update integration tests for new RLS policies"

# 2. App screen changes
git add app/
git commit -m "Fix navigation and auth flows across screens"

# 3. Library changes
git add lib/
git commit -m "Update user-profile and payment libraries"

# 4. Config changes
git add *.json .env.example
git commit -m "Update project configuration"

# 5. Documentation
git add docs/ CLAUDE.md DEVELOPER_GUIDE.md
git commit -m "Update documentation and guides"

# Push all commits
git push origin main
```

### Option B: Feature Branches (If Changes Are Unrelated)

If the changes represent different features that should be reviewed separately:

```bash
# Stash everything
git stash

# Create branch for feature 1
git checkout -b feature/auth-improvements
git stash pop
git add app/auth/ lib/auth*
git commit -m "Improve auth flow and session handling"
git push -u origin feature/auth-improvements

# Go back to main, create branch for feature 2
git checkout main
git stash pop
# ... repeat for other features
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
