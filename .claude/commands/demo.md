# Start Demo Environment

Start the Expo development server for testing on a physical device via Expo Go.

## Steps
1. Kill any existing Metro bundler processes on port 8081
2. Start Expo in LAN mode for local network access
3. Display connection info for Expo Go app

## Commands

```bash
# Kill existing Metro process if running
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
```

```bash
# Start Expo dev server
cd /Users/sebastianrusso/projects/split/splitfree && npx expo start --lan
```

## After Running
- Open **Expo Go** on your iPhone
- Scan the QR code displayed in terminal
- Or manually enter the `exp://` URL shown

## Troubleshooting
If the device can't connect:
- Ensure phone and Mac are on same WiFi network
- Try `npx expo start --tunnel` for remote access (requires ngrok)
