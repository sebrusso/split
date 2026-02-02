# split it. Marketing Website - Design Document

## Overview

A simple, single-page marketing website to promote the split it. mobile app. The site will highlight the app's core value proposition (100% free expense splitting) and drive downloads from the App Store and Google Play.

---

## Goals

1. **Primary**: Drive app downloads via App Store and Play Store links
2. **Secondary**: Communicate the "100% free" value proposition clearly
3. **Tertiary**: Build trust and explain how the app works

---

## Target Audience

- Roommates splitting rent/utilities
- Friends traveling together
- Couples managing shared expenses
- Anyone frustrated with Splitwise's paywalls

---

## Page Structure

### 1. Hero Section
- **Headline**: "Split expenses. 100% free."
- **Subheadline**: "The expense-splitting app without paywalls, transaction limits, or hidden fees."
- **CTA Buttons**: App Store + Google Play download buttons
- **Visual**: App mockup/screenshot showing the main interface

### 2. Problem/Solution Section
- **Problem**: "Tired of hitting paywalls just to split a dinner bill?"
- **Solution**: Brief explanation of how split it. solves this
- Why free? Ad-supported model explanation (transparent)

### 3. Features Section (4-5 key features) ✅ SHIPPED
- **Unlimited Groups & Expenses** - No transaction limits
- **Smart Debt Simplification** - Minimize payments needed
- **Easy Sharing** - QR codes and deep links to invite friends
- **Works Offline** - Track expenses anywhere, sync later
- **Receipt Scanning** - Snap a photo, we extract items with AI (Gemini)

### 4. How It Works (3 steps)
1. Create a group
2. Add expenses as they happen
3. Settle up when ready

### 5. Social Proof (optional for MVP)
- Placeholder for future testimonials/reviews
- App Store rating badge (once available)

### 6. Download CTA (repeated)
- Final call-to-action with store buttons
- "Join X users splitting expenses the free way"

### 7. Footer
- Links: Privacy Policy, Terms of Service, Contact
- Copyright notice
- Social links (optional)

---

## Technical Implementation

### Stack
- **Framework**: Plain HTML/CSS/JS (simple, fast, no build step)
- **Alternative**: Could use Next.js static export if more pages needed later
- **Hosting**: GitHub Pages (free, simple deployment from repo)
- **Domain**: Can use custom domain later

### File Structure
```
website/
├── index.html          # Main landing page
├── css/
│   └── styles.css      # All styles
├── js/
│   └── main.js         # Minimal JS (smooth scroll, etc.)
├── images/
│   ├── app-mockup.png  # Phone mockup with app screenshot
│   ├── icon.png        # App icon (copy from assets/)
│   ├── app-store.svg   # App Store badge
│   └── play-store.svg  # Google Play badge
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
└── DESIGN_DOC.md       # This file
```

### Design System (matching app)
- **Primary Color**: #10B981 (emerald green)
- **Primary Dark**: #059669
- **Text Color**: #1F2937
- **Background**: #FAFAFA
- **Font**: Inter (Google Fonts)

### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

## Content

### Headlines & Copy

**Hero**
- H1: "Split expenses. 100% free."
- Subhead: "Create groups, track expenses, and settle up with friends—without paywalls or transaction limits."

**Features**
- "Unlimited Everything" - Create as many groups and expenses as you need. No premium tier required.
- "Smart Settlements" - Our algorithm minimizes the number of payments needed to settle up.
- "Share Instantly" - Invite friends with a QR code or link. No account required to join.
- "Works Offline" - Track expenses on a camping trip or flight. Syncs when you're back online.

**How It Works**
1. "Create a Group" - Start a group for your trip, apartment, or dinner.
2. "Add Expenses" - Log who paid and split it equally or custom.
3. "Settle Up" - See exactly who owes whom and mark debts as paid.

**CTA**
- "Download Free" / "Get the App"

---

## App Store Links

**Domain:** split-it.net (custom domain configured)

Placeholder URLs (update when live):
- iOS: `https://apps.apple.com/app/split-it/id[APP_ID]`
- Android: `https://play.google.com/store/apps/details?id=com.splitit.app`

For MVP, buttons can link to `#coming-soon` or show "Coming Soon" state.

**Bundle ID:** `com.splitit.app` (as configured in app.json)

---

## SEO Considerations

- Title: "split it. - Split Expenses 100% Free | No Paywalls"
- Meta description: "The free expense-splitting app for roommates, trips, and friends. No transaction limits, no premium tiers. Download for iOS and Android."
- Keywords: expense splitting app, split bills, splitwise alternative, free expense tracker
- Open Graph tags for social sharing

---

## Performance Goals

- Lighthouse score: 90+ on all metrics
- Page load: < 2 seconds on 3G
- No JavaScript frameworks (vanilla JS only)
- Optimized images (WebP with PNG fallback)

---

## Future Enhancements (Post-MVP)

1. App Store review integration
2. Animated feature demos
3. Blog/content section
4. Localization (Spanish, French, etc.)
5. Comparison page (split it. vs Splitwise)
6. Voice expense entry (planned - not yet built)

---

## Timeline

1. **Phase 1** (Now): Build MVP landing page with placeholder store links
2. **Phase 2** (App Launch): Update with real store links and screenshots
3. **Phase 3** (Post-Launch): Add testimonials, reviews, blog

---

## Success Metrics

- Click-through rate on store buttons
- Bounce rate < 50%
- Time on page > 30 seconds
- Conversion tracking via UTM parameters
