# Run Tests

Run the test suite with optional focus on specific test types or build configurations.

## Arguments
- `$ARGUMENTS` - Optional: "unit", "integration", "coverage", "typecheck", "all", "maestro"

## Test Types

| Type | Command | What It Tests |
|------|---------|---------------|
| `unit` | `npm run test:unit` | Utility functions, pure logic |
| `integration` | `npm run test:integration` | Supabase, API interactions |
| `coverage` | `npm run test:coverage` | All tests + coverage report |
| `typecheck` | `npm run typecheck` | TypeScript type checking |
| `maestro` | `maestro test` | E2E UI tests |
| `all` (default) | All of the above | Full test suite |

## Commands

### Run all tests (default)
If no arguments or `$ARGUMENTS` is "all":
```bash
cd /Users/sebastianrusso/projects/split/splitfree && npm run typecheck && npm test
```

### Run unit tests only
If `$ARGUMENTS` contains "unit":
```bash
cd /Users/sebastianrusso/projects/split/splitfree && npm run test:unit
```

### Run integration tests only
If `$ARGUMENTS` contains "integration":
```bash
cd /Users/sebastianrusso/projects/split/splitfree && npm run test:integration
```

### Run with coverage
If `$ARGUMENTS` contains "coverage":
```bash
cd /Users/sebastianrusso/projects/split/splitfree && npm run test:coverage
```

### Run TypeScript check
If `$ARGUMENTS` contains "typecheck":
```bash
cd /Users/sebastianrusso/projects/split/splitfree && npm run typecheck
```

### Run Maestro E2E tests
If `$ARGUMENTS` contains "maestro":
First ensure the app is running (either via Expo or release build), then:
```bash
cd /Users/sebastianrusso/projects/split/splitfree && maestro test maestro/
```

## Testing Against Release Builds

**Important:** Jest tests run in Node.js and don't require a running app. But for catching production-specific bugs, you should:

1. Run unit/integration tests first:
   ```bash
   npm test
   ```

2. Build and run a local release build:
   ```bash
   npm run build:local-release
   ```

3. Run Maestro E2E tests against the release build:
   ```bash
   maestro test maestro/screenshots.yaml
   ```

## Test Matrix

| Test Type | Catches `__DEV__` Bugs | Catches Native Bugs | Requires Running App |
|-----------|------------------------|---------------------|---------------------|
| Unit tests | ❌ | ❌ | ❌ |
| Integration tests | ❌ | ❌ | ❌ |
| Maestro + Expo Go | ❌ | ❌ | ✅ |
| Maestro + Release | ✅ | ✅ | ✅ |

## Test Files
- `__tests__/utils.test.ts` - Unit tests for utility functions
- `__tests__/supabase.integration.test.ts` - Database integration tests
- `__tests__/receipts.integration.test.ts` - Receipt scanning tests
- `__tests__/offline-sync.integration.test.ts` - Offline sync tests
- `maestro/screenshots.yaml` - E2E screenshot capture flow

## Notes
- Integration tests require network access to Supabase
- Unit tests run in isolation with mocked modules
- Coverage reports are generated in `coverage/` directory
- Maestro tests require the app to be running on a simulator or device
- For production-bug hunting, always test with release builds
