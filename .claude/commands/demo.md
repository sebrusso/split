# Start Demo Environment

Start the app for testing. Supports multiple modes from fast iteration to production-like testing.

## Arguments
- `$ARGUMENTS` - Optional: "expo", "release", "sim-release", or empty (default: expo)

## Build Modes

| Mode | Build Time | `__DEV__` | Matches Production | Best For |
|------|------------|-----------|-------------------|----------|
| `expo` (default) | Instant | `true` | ❌ | Fast iteration, UI work |
| `release` | ~5 min | `false` | ✅ | Catching production bugs |
| `sim-release` | ~10 min | `false` | ✅ | Full EAS parity testing |

## Commands

### Expo Go (default) - Fast iteration
If no arguments or `$ARGUMENTS` is "expo":
```bash
# Kill existing Metro process if running
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
```

```bash
# Start Expo dev server
cd /Users/sebastianrusso/projects/split/splitfree && npx expo start --lan
```

### Local Release Build - Catch production bugs
If `$ARGUMENTS` is "release":
```bash
cd /Users/sebastianrusso/projects/split/splitfree && npm run build:local-release
```

This builds a **release configuration** and runs on iOS Simulator:
- `__DEV__` = `false` (matches production)
- Native code compiled locally
- ~5 minute build time
- Best for catching bugs that only appear in TestFlight

### Simulator Release via EAS - Full production parity
If `$ARGUMENTS` is "sim-release":
```bash
cd /Users/sebastianrusso/projects/split/splitfree && npm run build:sim-release
```

This runs the EAS build process locally:
- Exact same build as TestFlight but for simulator
- ~10 minute build time
- Good for debugging env var issues

## When to Use Each Mode

| Situation | Use |
|-----------|-----|
| UI development, styling | `expo` |
| Feature development | `expo` |
| Bug appears only in TestFlight | `release` |
| Env var or build config issues | `sim-release` |
| Final validation before TestFlight | `release` |

## Common Bugs Caught by Release Builds

| Bug Type | Why Expo Go Misses It |
|----------|----------------------|
| `__DEV__` conditionals | Expo Go always has `__DEV__=true` |
| Native module behavior | Expo Go uses sandbox native code |
| Env var issues | Different build-time injection |
| Hermes bytecode issues | Release uses compiled bytecode |
| Button/touch handlers | Performance differs in release |

## After Running Expo Mode
- Open **Expo Go** on your iPhone
- Scan the QR code displayed in terminal
- Or manually enter the `exp://` URL shown

## Troubleshooting

### Expo Go can't connect
- Ensure phone and Mac are on same WiFi network
- Try `npx expo start --tunnel` for remote access

### Release build fails
- Ensure Xcode is installed and configured
- Run `xcode-select --install` if needed
- Check for CocoaPods issues: `cd ios && pod install`

### Buttons broken only in release
- Check for `__DEV__` conditionals hiding code paths
- Add `console.log` before/after handlers to debug
- Check for error boundaries swallowing errors silently
