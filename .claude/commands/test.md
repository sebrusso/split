# Run Tests

Run the test suite with optional focus on specific test types.

## Arguments
- `$ARGUMENTS` - Optional: "unit", "integration", or "coverage"

## Commands

### Run all tests (default)
```bash
npm test
```

### Run unit tests only
If `$ARGUMENTS` contains "unit":
```bash
npm run test:unit
```

### Run integration tests only
If `$ARGUMENTS` contains "integration":
```bash
npm run test:integration
```

### Run with coverage
If `$ARGUMENTS` contains "coverage":
```bash
npm run test:coverage
```

## Test Files
- `__tests__/utils.test.ts` - Unit tests for utility functions
- `__tests__/supabase.integration.test.ts` - Database integration tests

## Notes
- Integration tests require network access to Supabase
- Unit tests run in isolation with mocked timers
- Coverage reports are generated in `coverage/` directory
