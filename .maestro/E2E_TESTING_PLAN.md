# E2E Testing Plan for split it.

## Test Account Credentials
- **Email:** sebalexrusso@gmail.com
- **Password:** t5Ncuv6ZhZMXb

---

## Plan A: Maestro (Primary)

### Key Insight from Previous Attempt
The problem was trying to bypass authentication at runtime. The solution is simpler: **log in once as the test user, then run all tests without clearing state.**

### Step 1: Create a Login Flow (5 min)
Create `.maestro/flows/login.yaml` that:
1. Launches the app
2. Skips welcome carousel if shown
3. Enters test email and password
4. Taps Sign In
5. Waits for home screen ("Create Group" visible)

### Step 2: Update Existing Tests (10 min)
Modify all test files to:
- Remove `clearState: true` from `launchApp`
- Remove any auth-related steps
- Start directly with app actions (tap "Create Group", etc.)

### Step 3: Create a Test Runner Script (5 min)
Create `.maestro/run-all-tests.sh`:
```bash
#!/bin/bash
# Run login flow first
maestro test .maestro/flows/login.yaml

# If login succeeded, run all other tests
if [ $? -eq 0 ]; then
  maestro test .maestro/create-group-expense.yaml
  # Add other test files...
fi
```

### Step 4: Test Execution Order
1. `login.yaml` - Authenticates once
2. All other tests run with active session
3. Session persists between tests (no clearState)

### Step 5: Cleanup Flow (Optional)
Create `.maestro/flows/cleanup.yaml` to delete test groups/data after test run.

### Success Criteria
- [ ] Login flow completes successfully
- [ ] Home screen shows "Create Group"
- [ ] Can create a group (Supabase write works)
- [ ] Can add an expense (Supabase write works)

### Estimated Time: 20-30 minutes

---

## Plan B: Detox (Backup)

**Use this if Maestro continues to have issues after implementing Plan A.**

### Step 1: Install Detox (15 min)
```bash
npm install --save-dev detox jest-circus
npx detox init
```

### Step 2: Configure iOS Build (30 min)
1. Add Detox build scheme to `ios/` project
2. Configure `detox.config.js`:
```javascript
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 120000 }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/split it..app',
      build: 'xcodebuild -workspace ios/split it..xcworkspace -scheme split it. -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 15 Pro' }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    }
  }
};
```

### Step 3: Create Test Files (20 min)
Create `e2e/login.test.js`:
```javascript
describe('Login', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should login with test account', async () => {
    // Skip welcome if visible
    try {
      await element(by.text('Skip')).tap();
    } catch (e) {}

    // Enter credentials
    await element(by.text('your@email.com')).tap();
    await element(by.text('your@email.com')).typeText('sebalexrusso@gmail.com');

    await element(by.text('Enter your password')).tap();
    await element(by.text('Enter your password')).typeText('t5Ncuv6ZhZMXb');

    // Sign in
    await element(by.text('Sign In')).tap();

    // Verify home screen
    await waitFor(element(by.text('Create Group')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
```

### Step 4: Run Tests
```bash
npx detox build --configuration ios.sim.debug
npx detox test --configuration ios.sim.debug
```

### Estimated Time: 1-2 hours

### Detox Pros (if Plan A fails)
- Gray-box: knows when app is idle
- No flaky waits
- JavaScript - same language as app

### Detox Cons
- Significant setup overhead
- Need to rewrite all 18 Maestro tests
- More complex CI configuration

---

## Recommendation

**Start with Plan A (Maestro).** The previous failure was due to approach, not the tool. With the simple "login once, test many" approach, existing tests should work.

Only move to Plan B if:
- Login flow cannot be made reliable
- Supabase operations fail despite valid auth
- Flakiness persists after 2-3 attempts

---

## Next Action
Implement Step 1 of Plan A: Create the login flow.
