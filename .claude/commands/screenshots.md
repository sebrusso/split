# Screenshot Capture and Marketing Update Workflow

Capture app screenshots for marketing materials including the website and App Store listings.

## Prerequisites
- iPhone or iOS Simulator running the app
- Run `/demo` to start the development server

## Step 1: Taking Screenshots

### On Physical iPhone (Recommended for App Store)
1. Run the app via Expo Go or a TestFlight/development build
2. Navigate to the screen you want to capture
3. Press **Side button + Volume Up** simultaneously
4. Screenshots save to Photos app

### On iOS Simulator
1. Run `npx expo start --ios` to launch in simulator
2. Navigate to the screen you want to capture
3. Press **Cmd + S** to save screenshot
4. Screenshots save to Desktop

### Recommended Screens to Capture
- **Friends/Balances view** (home tab showing who owes whom)
- **Group detail view** (members, balances button, expenses)
- **Add expense screen** (with receipt scanning option)
- **Receipt split options** (Split Evenly vs Claim Items)
- **Receipt claim items** (individual line items claimed by users)
- **Edit group settings** (emoji picker, currency, share code)
- **QR code sharing** (group invite screen)

## Step 2: Transferring Screenshots

### From iPhone
1. AirDrop screenshots to Mac
2. Or use iCloud Photos sync
3. Screenshots typically land in `~/Downloads`

### From Simulator
Screenshots save to Desktop by default.

## Step 3: Organizing Screenshots

Copy screenshots to the assets folder with descriptive names:

```bash
# Create assets directory if needed
mkdir -p docs/images/assets

# Copy and rename screenshots (example)
cp ~/Downloads/IMG_XXXX.PNG docs/images/assets/friends-balances.png
cp ~/Downloads/IMG_YYYY.PNG docs/images/assets/group-detail.png
cp ~/Downloads/IMG_ZZZZ.PNG docs/images/assets/receipt-split-options.png
cp ~/Downloads/IMG_AAAA.PNG docs/images/assets/receipt-claim-items.png
cp ~/Downloads/IMG_BBBB.PNG docs/images/assets/edit-group.png
```

### Naming Convention
- Use lowercase, kebab-case names
- Be descriptive: `receipt-claim-items.png` not `IMG_7612.png`
- Include feature name: `friends-balances.png`, `group-detail.png`

## Step 4: Updating Website

Screenshots are used in these locations:
- **Hero image**: `docs/index.html` line ~69 (main phone mockup)
- **Gallery section**: `docs/index.html` lines ~171-195 (4 phone mockups)

The gallery currently shows:
1. Group overview (`group-detail.png`)
2. Smart receipt splitting (`receipt-split-options.png`)
3. Claim what you ordered (`receipt-claim-items.png`)
4. Customize your groups (`edit-group.png`)

To update, edit the `src` attributes in `docs/index.html`.

## Step 5: Updating App Store Screenshots

App Store requires specific dimensions:
- **6.7" (iPhone 15 Pro Max)**: 1290 x 2796 px
- **6.5" (iPhone 14 Plus)**: 1284 x 2778 px
- **5.5" (iPhone 8 Plus)**: 1242 x 2208 px

### Using Simulator for Exact Dimensions
```bash
# iPhone 15 Pro Max simulator
xcrun simctl boot "iPhone 15 Pro Max"
npx expo start --ios
# Take screenshots with Cmd + S
```

App Store screenshots location: `assets/app-store/` (create if needed)

## Step 6: Commit Changes

```bash
# Stage screenshot assets
git add docs/images/assets/

# Commit with descriptive message
git commit -m "Update app screenshots for website and marketing"
```

## Current Screenshot Inventory

| File | Description | Used In |
|------|-------------|---------|
| `friends-balances.png` | Home screen showing balances | Hero image |
| `group-detail.png` | Group view with members | Gallery |
| `receipt-split-options.png` | Split Evenly vs Claim Items | Gallery |
| `receipt-claim-items.png` | Claiming line items | Gallery |
| `edit-group.png` | Group settings with emoji | Gallery |

## Tips

- Ensure the status bar shows a realistic time (e.g., 9:41 AM is Apple's demo time)
- Use test data that looks realistic (real names, reasonable amounts)
- Avoid showing personal information or sensitive data
- Screenshots should highlight the feature being demonstrated
- For App Store, consider adding promotional text overlays
