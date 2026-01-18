# SplitFree E2E Testing with Maestro

## Quick Start

```bash
# Run all happy-path tests
bash .maestro/run-maestro.sh test .maestro/

# Run stress tests (adversarial testing)
bash .maestro/run-maestro.sh test .maestro/stress/

# Run a single test
bash .maestro/run-maestro.sh test .maestro/stress/deep-link-malformed.yaml
```

## Setup Requirements

### 1. Install Maestro
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### 2. Install Java 17
```bash
brew install openjdk@17
```

### 3. Create Test Account (One-time Manual Setup)

The stress tests require an authenticated user. Create a test account:

1. **Open the app** in the iOS Simulator
2. **Skip the welcome carousel** (tap Skip or swipe through)
3. **Tap "Sign Up"** on the sign-in screen
4. **Create account** with these test credentials:
   - Email: `splitfree.test@example.com`
   - Phone: `+15555550100` (Clerk test number)
   - Password: `TestPassword123!`
5. **Verify email**: Use code `424242` (Clerk test code)
6. **Verify phone**: Use code `424242` (Clerk test code)

### 4. Configure Test Credentials

Edit `.maestro/config.yaml` and update the credentials:

```yaml
env:
  TEST_EMAIL: "splitfree.test@example.com"
  TEST_PASSWORD: "TestPassword123!"
```

## Test Structure

```
.maestro/
├── config.yaml              # Test configuration
├── run-maestro.sh          # Wrapper script with Java 17
├── README.md               # This file
├── flows/                  # Reusable sub-flows
│   ├── auth-signin.yaml    # Sign-in flow
│   └── skip-welcome.yaml   # Skip welcome carousel
├── create-group-expense.yaml   # Happy path test
├── receipt-scanning.yaml       # Happy path test
├── settlement-flow.yaml        # Happy path test
└── stress/                 # Adversarial stress tests
    ├── boundary-amounts.yaml       # Edge case amounts
    ├── currency-chaos.yaml         # Multi-currency precision
    ├── deep-link-malformed.yaml    # Invalid deep links ✅
    ├── double-settlement.yaml      # Duplicate settlements
    ├── member-claim-collision.yaml # Race conditions
    ├── offline-online-chaos.yaml   # Network failures
    ├── rapid-expense-creation.yaml # Rapid operations
    ├── rapid-navigation.yaml       # Fast navigation
    ├── receipt-claim-race.yaml     # Claim race conditions
    └── receipt-ocr-timeout.yaml    # OCR timeouts
```

## Running Tests

### Without Authentication (Works Now)
```bash
# Deep link validation - tests malformed input handling
bash .maestro/run-maestro.sh test .maestro/stress/deep-link-malformed.yaml
```

### With Authentication (Requires Test Account)
```bash
# Run all stress tests
bash .maestro/run-maestro.sh test .maestro/stress/
```

## Speed Optimization Tips

1. **Run in parallel** using Maestro Cloud:
   ```bash
   maestro cloud app.ipa .maestro/stress/
   ```

2. **Preserve app state** between tests by setting:
   ```yaml
   onFlowStart:
     clearState: false
   ```

3. **Skip welcome once** by running auth flow first:
   ```bash
   bash .maestro/run-maestro.sh test .maestro/flows/auth-signin.yaml
   bash .maestro/run-maestro.sh test .maestro/stress/
   ```

4. **Use shorter timeouts** for faster failures:
   ```yaml
   defaultTimeout: 5000  # Instead of 10000
   ```

## Test Results

Test results are saved to:
- Screenshots: `~/.maestro/tests/<timestamp>/`
- JUnit XML: Specify with `--format junit --output results.xml`

## Troubleshooting

### "Java 17 required"
Use the wrapper script: `bash .maestro/run-maestro.sh test <file>`

### Expo debugger toast blocking touches
Build and run a production build:
```bash
npx expo run:ios --configuration Release
```

### Tests fail on "Create Group" not visible
The app requires authentication. Create a test account first (see Setup).

### Simulator not responding
```bash
xcrun simctl shutdown all
xcrun simctl boot <device-id>
```
