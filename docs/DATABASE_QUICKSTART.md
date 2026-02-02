# Database Quick Reference

Copy-paste commands for split it. database operations.

---

## Environments

| Environment | Supabase Project | Supabase URL |
|-------------|------------------|--------------|
| **Staging** | `odjvwviokthebfkbqgnx` | `https://odjvwviokthebfkbqgnx.supabase.co` |
| **Production** | `rzwuknfycyqitcbotsvx` | `https://rzwuknfycyqitcbotsvx.supabase.co` |

| Environment | Clerk Instance | Clerk Domain |
|-------------|----------------|--------------|
| **Staging** | Development | `promoted-rattler-76.clerk.accounts.dev` |
| **Production** | Production | `clerk.split-it.net` |

---

## Local Development

```bash
# Start local Supabase
supabase start

# Reset database + apply seed
supabase db reset

# Stop Supabase
supabase stop
```

---

## Migrations

```bash
# Create new migration
supabase migration new <migration_name>

# List migrations
supabase migration list

# Push to staging (linked branch)
supabase db push --linked

# Check diff before pushing
supabase db diff
```

---

## Staging Branch

```bash
# Link to staging project
supabase link --project-ref odjvwviokthebfkbqgnx

# Push migrations to staging
supabase db push --linked

# Reset staging branch (WARNING: destroys data)
supabase db reset --linked

# Execute SQL on staging
supabase db execute --sql "SELECT * FROM groups LIMIT 5;"
```

---

## Production

```bash
# Link to production
supabase link --project-ref rzwuknfycyqitcbotsvx

# Push to production (be careful!)
supabase db push --linked
```

---

## Seed Data

```bash
# Seed local
supabase db reset

# Seed staging (uses scripts/seed-staging.js)
node scripts/seed-staging.js

# Apply baseline schema to new branch
node scripts/apply-baseline.js
```

---

## Quick SQL Queries

```bash
# Check RLS policies
supabase db execute --sql "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';"

# Check table counts
supabase db execute --sql "
SELECT 'groups' as t, COUNT(*) FROM groups
UNION SELECT 'members', COUNT(*) FROM members
UNION SELECT 'expenses', COUNT(*) FROM expenses
UNION SELECT 'receipts', COUNT(*) FROM receipts;
"

# Check indexes
supabase db execute --sql "SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';"
```

---

## EAS Environment Variables

```bash
# List all environments
eas env:list

# List development env vars
eas env:list development

# List production env vars
eas env:list production

# Set environment variable
eas env:create <environment> --name <NAME> --value "<value>" --visibility plaintext
```

---

## .env.local Template

```bash
# Staging (development)
EXPO_PUBLIC_SUPABASE_URL=https://odjvwviokthebfkbqgnx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging_anon_key>
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cHJvbW90ZWQtcmF0dGxlci03Ni5jbGVyay5hY2NvdW50cy5kZXYk

# PostHog
EXPO_PUBLIC_POSTHOG_API_KEY=<posthog_key>
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Sentry
EXPO_PUBLIC_SENTRY_DSN=<sentry_dsn>

# Gemini (OCR)
EXPO_PUBLIC_GEMINI_API_KEY=<gemini_key>
```

---

## Supabase Dashboard Links

- **Staging**: https://supabase.com/dashboard/project/odjvwviokthebfkbqgnx
- **Production**: https://supabase.com/dashboard/project/rzwuknfycyqitcbotsvx

---

## Clerk Dashboard Links

- **Development**: https://dashboard.clerk.com (select Development instance)
- **Production**: https://dashboard.clerk.com (select Production instance)

---

## Build Commands

```bash
# Development build (uses staging DB)
eas build --profile development --platform ios

# TestFlight build (uses production DB)
eas build --profile testflight --platform ios --auto-submit

# Production build
eas build --profile production --platform ios --auto-submit
```

---

## Troubleshooting

### Invalid API key
```bash
# Verify which project you're linked to
supabase projects list
supabase status
```

### RLS blocking queries
```bash
# Check policies for a table
supabase db execute --sql "SELECT * FROM pg_policies WHERE tablename = 'groups';"
```

### Migration conflicts
```bash
# List applied migrations
supabase migration list --linked

# Check migration history
supabase db execute --sql "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"
```
