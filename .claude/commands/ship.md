# Ship Changes (Commit, Push, PR)

Commit staged changes, push to remote, and optionally create a pull request.

## Arguments
- `$ARGUMENTS` - Optional: commit message or "pr" to create a pull request

## Pre-flight Checks

```bash
# Check for uncommitted changes
git status --short
```

```bash
# Run unit tests before shipping (skip integration tests that require live Supabase)
npm run test:unit
```

```bash
# Type check
npx tsc --noEmit
```

## Workflow

1. If tests pass, stage all changes:
```bash
git add -A
```

2. Show what will be committed:
```bash
git diff --cached --stat
```

3. Create commit with provided message or generate one based on changes:
```bash
git commit -m "Your commit message here"
```

4. Push to origin:
```bash
git push origin main
```

5. If "pr" was specified, create a pull request:
```bash
gh pr create --fill
```

## Notes
- Ensure your GitHub credentials are configured via `git config credential.helper osxkeychain`
- If push fails with auth error, run `npm run setup:token` to configure PAT
- Tests must pass before committing
