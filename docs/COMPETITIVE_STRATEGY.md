# split it. Competitive Strategy
**January 2026** | Updated February 2026

---

> **Feature Status Note:** Voice input is a planned differentiator but **not yet built**.
> Current shipped features focus on receipt scanning, unlimited expenses, and the "100% free" value proposition.
> See [MASTER_PRD.md](./MASTER_PRD.md) for authoritative feature status.

---

## Executive Summary

The expense-splitting market is dominated by Splitwise (~500K monthly iOS downloads, $400K/month revenue), but user revolt over aggressive monetization creates a clear opportunity. Our planned differentiator: **voice-first expense entry**—a feature no major competitor offers for group expense splitting. *(Coming soon - not yet shipped)*

---

## Part 1: Market Analysis

### The Competitive Landscape

| App | Monthly Downloads | Key Strength | Key Weakness |
|-----|-------------------|--------------|--------------|
| **Splitwise** | 500K (iOS US) | Brand recognition, network effects | Aggressive paywalling, 64% 1-star Trustpilot |
| **Tricount** | 280K | Strong in Europe, bunq backing | Sync issues since acquisition, limited US presence |
| **Splid** | ~50K | Offline-first, no signup | Small team, limited features |
| **Settle Up** | ~30K | Simple interface | Dated design, minimal marketing |
| **Spliit** | Growing | Open source, free | No mobile app (web only) |

**Market Size:** Splitwise alone has 29M+ Android downloads. Tricount processed €16.4B in shared expenses in 2024. This is a large, active market.

### User Pain Points (from Trustpilot, Reddit, App Store reviews)

**The Splitwise Backlash (Our Opportunity):**
1. **Daily limits kill usability:** 3-4 free expenses/day makes trips impossible
2. **10-second cooldown:** Artificial friction infuriates users
3. **Paywalling betrayal:** "Features I've used free for years suddenly locked"
4. **Price perception:** $5/month ($40/year) feels expensive for occasional use
5. **Poor support:** "14 emails, no phone number, no resolution"
6. **Trust erosion:** Payment processing issues, calculation bugs

> "I went on a trip in July and it took ages after the trip before we could finally get all our purchases added in and settled up." — Reddit user

**What Users Actually Want:**
- Quick expense entry (< 5 seconds)
- Works offline reliably
- No daily limits
- Simple debt settlement
- Works without everyone needing accounts

---

## Part 2: Positioning Strategy

### Position: "The Anti-Splitwise"

Don't compete on features. Compete on values.

**Our Promise:** "Expense splitting that respects your time and your wallet."

| Splitwise | split it. |
|-----------|-----------|
| 3 expenses/day | Unlimited |
| 10-second cooldown | Instant |
| $40/year | Free forever |
| Account required to join | Join via link, no account |
| Receipt scan (Pro only) | Receipt scan (free) |
| No voice input | **Voice-first expense entry** *(coming soon)* |

### The Voice Differentiator *(Planned Feature)*

**This will be your unfair advantage once shipped.** No major expense-splitting app offers voice input.

Voice-enabled budget trackers exist (TalkieMoney, Voicash AI, ReceiptIQ Pro) but they're personal finance apps, not group expense splitters. You're combining two proven categories:

```
Group Expense Splitting + Voice AI = Untapped Market
```

**Use Cases That Sell Voice:**
- Driving back from dinner: "Add dinner at Mario's, $127, split with Sarah and Jake"
- At checkout: Hands full, just say the expense
- End of trip: Rapid-fire catch-up on missed expenses
- Accessibility: Users with mobility limitations

**Marketing Hook (for launch):** "Just say it. We'll split it."

> **Note:** Use this tagline only after voice feature ships. Current marketing should focus on "100% free" and "receipt scanning" differentiators.

---

## Part 3: Feature Prioritization

### Must-Have for Launch (You Have These) ✅
- [x] Unlimited expenses
- [x] No daily limits
- [x] Group sharing via link/QR
- [x] Balance calculations
- [x] Debt simplification
- [x] Receipt scanning (with Gemini OCR)
- [x] Offline support with sync
- [x] Multi-currency support
- [x] Push notifications
- [x] Payment reminders
- [x] Friends system

### The Voice Advantage (Future Roadmap)
- [ ] Voice expense entry ("$45 dinner at Olive Garden, split with Mike")
- [ ] Natural language processing for amount, description, participants
- [ ] Works in multiple languages (English, Spanish initially)
- [ ] Offline voice capture, process when online

> **Status:** Voice feature is NOT YET BUILT. Focus current marketing on shipped features.

### Phase 2 Differentiators
- [ ] Voice commands for queries ("How much does Sarah owe?")
- [ ] Smart receipt voice annotation ("Scan receipt, I paid for Sarah's items 2-4")
- [ ] Expense reminders via voice ("Remind me to add parking later")

---

## Part 4: Pricing Strategy

### Recommendation: **Free + Ethical Ads**

**Why Not Freemium:**
- Splitwise proved freemium creates resentment
- Users feel "bait and switched"
- Artificial limits frustrate power users during peak usage (trips)

**Why Free + Ads Works:**
- Moral high ground: "Actually free, not 'free until you need it'"
- Trip users (your best marketers) never hit a wall
- Ad timing matters: Show ads on close, not during expense entry

**Revenue Model:**
```
100K DAU × 1.2 sessions/day × $2 CPM interstitials = ~$240/day = $87K/year
```

Scale to 500K DAU (10% of Splitwise) = $435K/year

**Optional Premium (v2):**
- Ad-free experience: $9.99/year (deliberately cheaper than Splitwise)
- Export to CSV/PDF
- Custom categories
- But NEVER limit core functionality

---

## Part 5: User Acquisition

### Phase 1: Capture the Angry (Month 1-2)

**Reddit Guerrilla Marketing:**
- r/Splitwise (16K members): Primary target
- r/Frugal, r/personalfinance: "Free alternative" angle
- r/travel, r/backpacking: Trip use case

**Post Template:**
```
Title: Built a 100% free Splitwise alternative after hitting the daily limit on a trip

[Personal frustration story]
- Unlimited expenses, no daily caps
- No account needed to join groups
- Voice input—just say your expense
- Ad-supported (only when you close the app)

Link in comments. Feedback welcome.
```

**Why This Works:**
- Authentic frustration resonates
- "Built it myself" creates goodwill
- Voice feature is genuinely new/interesting
- Timing: Post when Splitwise frustration threads appear

### Phase 2: Social Proof (Month 2-3)

**ProductHunt Launch:**
- Tagline: "Split expenses by voice. 100% free."
- First comment: Founder story + Splitwise frustration
- Demo GIF: Voice expense entry in action
- Launch Tuesday-Thursday, 12:01 AM PT

**TikTok Content:**
1. "Splitwise wants $40/year for THIS?" (show limits)
2. "I just say my expenses now" (voice demo)
3. "POV: Trip dinner split without the drama"

### Phase 3: Viral Loops (Month 3+)

**Network Effects:**
- Every group invite = potential new user
- Shareable settlement summaries
- "Powered by split it." on shared receipts

**Referral Mechanics:**
- "Your friend joined! You both get ad-free for a week"
- Leaderboard: "Top expense splitters this month"

---

## Part 6: Branding

### Current Positioning (Good)
- Name: "split it." — Simple, memorable, action-oriented
- Tagline: "Split expenses. 100% free." — Clear value prop

### Recommendations

**Double Down on "Free":**
- Make "100% free" unavoidable in all marketing
- Use it as a weapon: "No limits. No subscriptions. No BS."

**Voice Identity:**
- Secondary tagline: "Just say it. We'll split it."
- Voice waveform as visual motif
- Demo voice feature in first 5 seconds of any video

**Tone:**
- Not corporate, not cutesy
- Direct, confident, slightly irreverent
- "We're not Splitwise. That's the point."

**Color/Visual (Current is Good):**
- Green (#10B981) = money/trust
- Clean, minimal UI
- Don't over-design—simplicity is a feature

---

## Part 7: Competitive Moat

### Short-Term (6 months)
1. **Voice-first:** First mover in voice + group expense splitting
2. **Goodwill:** "Actually free" builds trust while Splitwise has trust deficit
3. **Speed:** Small team can ship faster than incumbents

### Long-Term (12+ months)
1. **Data advantage:** Voice interactions = rich training data
2. **Network effects:** Groups stick once established
3. **Integration play:** Venmo, Zelle, Apple Pay settlement

### Risks
| Risk | Mitigation |
|------|------------|
| Splitwise adds voice | They're slow; you'll have 6+ months head start |
| Tricount/bunq aggression | They're EU-focused; own US/NA market |
| Ad revenue insufficient | Keep burn low; premium tier as backup |
| Voice accuracy issues | Use proven APIs (Whisper, Gemini); fail gracefully |

---

## Immediate Action Items

1. **Ship receipt scanning** — ✅ DONE - This is your current differentiator
2. **Polish for App Store** — Screenshots showing receipt scan + "100% free" prominently
3. **Reddit launch post** — Ready when approved (focus on unlimited + free, not voice yet)
4. **Record TikTok demos** — Receipt scanning is great for short-form video
5. **Monitor r/Splitwise** — Jump on frustration threads with helpful alternative
6. **Future: Ship voice expense entry** — This will be the next major differentiator

---

## Success Metrics (6-Month Targets)

| Metric | Target |
|--------|--------|
| App Store downloads | 50,000 |
| Monthly Active Users | 20,000 |
| Groups created | 30,000 |
| Voice expenses logged | 10,000 |
| App Store rating | 4.5+ stars |
| Reddit mentions | 100+ |

---

**Bottom Line:** The market is primed for disruption. Splitwise created enemies. Voice input is your wedge. Ship fast, stay free, own the narrative.
