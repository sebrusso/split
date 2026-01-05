# Format Code

Run Prettier to format all source files.

## Commands

### Check formatting (dry run)
```bash
npx prettier --check "**/*.{ts,tsx,js,json,md}"
```

### Fix formatting
```bash
npx prettier --write "**/*.{ts,tsx,js,json,md}"
```

## Prettier Config
Uses default Prettier settings. Key rules:
- 2 space indentation
- Single quotes for strings
- No trailing commas in ES5
- 80 character line width

## Pre-commit
Always run format before committing to ensure CI passes.
