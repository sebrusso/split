# split it. - 4-Week Launch Plan

**Created:** February 1, 2026
**Target Launch:** Early March 2026
**Go/No-Go Decision:** April 2026

---

## Executive Summary

This plan outlines the path from current state to App Store launch over 4 weeks, followed by a 1-2 month evaluation period to make a go/no-go decision on continuing the project.

**Timeline Overview:**
| Week | Focus | Dates |
|------|-------|-------|
| Week 1 | Bug Squashing | Feb 3-5 (3 days) |
| Week 2 | New Features (incl. Voice) | Feb 6-14 |
| Week 3 | Beta Testing | Feb 15-21 |
| Week 4 | Launch Readiness | Feb 22-28 |
| Week 5 | GTM & Marketing | Mar 1-7 |
| Post-Launch | Evaluation Period | Mar-Apr |

---

## Week 1: Bug Squashing (Feb 3-5, 3 Days)

### Goals
- Zero critical bugs
- Stable receipt scanning flow
- Smooth authentication experience
- No crashes in core flows

### Known Issues to Fix

**Critical (Must Fix)**
| Bug | Status | Notes |
|-----|--------|-------|
| Receipt upload RLS error | ✅ Fixed (Feb 1) | Storage policies added |
| Gemini API key missing on staging | ✅ Fixed (Feb 1) | Secret set |
| [Add any other critical bugs discovered] | | |

**High Priority**
| Bug | Description | Fix Approach |
|-----|-------------|--------------|
| | | |
| | | |

**Medium Priority**
| Bug | Description | Defer? |
|-----|-------------|--------|
| | | |

### Bug Triage Process
1. Use app end-to-end daily
2. Check Sentry for new errors
3. Review PostHog for drop-off points
4. Prioritize by impact on core flows

### Definition of Done
- [ ] Can create group, add members, add expenses without errors
- [ ] Can scan receipt, claim items, see totals calculated
- [ ] Can record settlement, see balance update
- [ ] Can share group via QR/link, friend can join
- [ ] Push notifications work
- [ ] No crashes in Sentry for 24 hours

---

## Week 2: New Features (Feb 6-14)

### Feature 1: Voice Expense Entry (P0) - 4-5 days

**Goal:** Users can add expenses by speaking: "Add $50 dinner split with Sarah"

**Implementation Plan:**
1. **Day 1-2:** Voice capture infrastructure
   - Add `expo-speech` or similar for voice recognition
   - Create `VoiceExpenseScreen` component
   - Basic recording → text flow

2. **Day 3:** Natural language processing
   - Send transcript to Gemini with structured prompt
   - Extract: amount, description, payer, split members
   - Return structured JSON

3. **Day 4:** Integration with expense creation
   - Pre-fill expense form from voice
   - Show confirmation before saving
   - Handle errors gracefully

4. **Day 5:** Polish & edge cases
   - Multiple currency support
   - "Split equally with everyone" handling
   - Undo/correction flow

**Success Criteria:**
- [ ] Can say "Add $30 lunch split with Mike" → expense created
- [ ] Can say "I paid $100 for groceries" → expense with me as payer
- [ ] Handles common variations (twenty dollars, $20, 20 bucks)

### Feature 2: Conversational Voice Claiming (P0) - 2-3 days

**Goal:** Users can claim receipt items by speaking: "I had the burger, Drew got the salmon"

**Implementation Plan:**
1. **Day 1:** Voice capture on receipt screen
   - Add mic button to receipt claiming screen
   - Record and transcribe

2. **Day 2:** Multi-turn conversation
   - Parse claims from transcript
   - Show what was assigned
   - Prompt for remaining items

3. **Day 3:** Polish
   - "Actually X had Y" corrections
   - "Split the pizza between us" handling
   - Completion detection

**Success Criteria:**
- [ ] Can claim multiple items in one sentence
- [ ] Assistant prompts for unclaimed items
- [ ] Can correct mistakes verbally

### Feature 3: Quick Improvements (1-2 days)

**If time permits:**
- [ ] Dark mode toggle (user preference)
- [ ] Export expenses as CSV
- [ ] Notification preferences UI
- [ ] Receipt history view

### Daily Standup Format
- What did I ship yesterday?
- What am I building today?
- Any blockers?

---

## Week 3: Beta Testing (Feb 15-21)

### Goals
- Onboard 5-10 trusted testers (friends/family)
- Gather qualitative feedback
- Identify UX friction points
- Validate voice feature works in real scenarios

### Tester Recruitment

**Target Testers (5-10 people):**
| Name | Relationship | Use Case | Device |
|------|--------------|----------|--------|
| | | Roommates | iPhone |
| | | Travel group | iPhone |
| | | Couple | Android |
| | | Coworkers | iPhone |
| | | | |

**Criteria for testers:**
- Currently splits expenses with others
- Willing to use app for 1 week minimum
- Will provide honest feedback
- Mix of iOS/Android if possible

### Onboarding Process

**Day 1-2: Setup**
1. Send TestFlight invite (iOS) or APK (Android)
2. Create welcome message with:
   - What the app does
   - What we're testing
   - How to give feedback (dedicated Slack/WhatsApp group?)
3. Offer 15-min onboarding call if needed

**Onboarding Message Template:**
```
Hey! Thanks for testing split it. 🎉

It's an expense-splitting app (like Splitwise but 100% free).

What to test:
1. Create a group with your roommates/friends
2. Add some expenses
3. Try the receipt scanning (snap a photo)
4. Try the voice feature ("Add $30 dinner split with [name]")
5. Check balances and settle up

Please let me know:
- What's confusing?
- What's broken?
- What do you wish it did?

Feedback channel: [link]
```

### Feedback Collection

**Feedback Channels:**
- Dedicated group chat (WhatsApp/Slack)
- In-app feedback button → Supabase `feedback` table
- Weekly 15-min calls with 2-3 testers

**Questions to Ask:**
1. What was your first impression?
2. Did you understand how to add an expense?
3. Did receipt scanning work? Any issues?
4. Did you try voice? How did it feel?
5. Would you use this instead of Splitwise/Venmo?
6. What's missing?

**Metrics to Track:**
| Metric | Target | How to Measure |
|--------|--------|----------------|
| Groups created | 10+ | Supabase query |
| Expenses added | 50+ | Supabase query |
| Receipts scanned | 10+ | Supabase query |
| Voice expenses | 5+ | PostHog event |
| DAU | 5+ testers active | PostHog |
| Crash-free sessions | 99%+ | Sentry |

### End of Week Survey

Send survey on Feb 21:
1. How likely to recommend (1-10 NPS)?
2. What's the best feature?
3. What's the worst part?
4. What would make you use it daily?
5. Would you pay $1/month for ad-free? $5/year?

---

## Week 4: Launch Readiness (Feb 22-28)

### Goals
- App Store submission ready
- All critical feedback addressed
- Marketing assets created
- Launch checklist complete

### App Store Checklist

**iOS (App Store Connect)**
- [ ] App name: "split it."
- [ ] Subtitle: "Split expenses. 100% free."
- [ ] Description finalized (see `docs/STORE_LISTING.md`)
- [ ] Keywords optimized
- [ ] 6 iPhone screenshots (6.7" - iPhone 15 Pro Max)
- [ ] iPad screenshots (if supporting)
- [ ] App icon (1024x1024)
- [ ] Privacy policy URL: https://split-it.net/privacy.html
- [ ] Support URL: https://split-it.net/support.html
- [ ] App Review notes
- [ ] Age rating: 4+
- [ ] Build uploaded via EAS Submit

**Android (Google Play)**
- [ ] App name and short description
- [ ] Full description
- [ ] Feature graphic (1024x500)
- [ ] Phone screenshots
- [ ] Privacy policy
- [ ] Content rating questionnaire
- [ ] Build uploaded

### Screenshot Requirements

**iPhone Screenshots (6 required):**
1. Groups list - "All your groups in one place"
2. Group detail with expenses - "Track every shared expense"
3. Add expense screen - "Add expenses in seconds"
4. Receipt scanning - "Scan receipts, we do the math"
5. Balances view - "See who owes what instantly"
6. Settlement/QR code - "Settle up with one tap"

**Tools:**
- Use Figma or Screenshots.pro for device frames
- Capture on simulator with clean test data
- Use consistent color scheme (#10B981 primary)

### Feedback Integration

**From beta testing, prioritize:**
1. Critical bugs → Fix immediately
2. UX confusion → Update copy/flow
3. Missing features → Add to backlog (not launch blockers)
4. Nice-to-haves → Post-launch

### Final QA Checklist

- [ ] Fresh install flow works
- [ ] Sign up → create group → add expense → settle flow
- [ ] Receipt scanning happy path
- [ ] Voice expense happy path
- [ ] Offline mode works
- [ ] Push notifications work
- [ ] Deep links work (join via QR/link)
- [ ] No console errors in release build
- [ ] Sentry capturing errors correctly
- [ ] PostHog tracking events correctly

---

## Week 5: GTM & Marketing (Mar 1-7)

### Marketing Strategy

**Positioning:** "The expense-splitting app that's actually free"

**Key Messages:**
1. Unlimited expenses (no daily limits)
2. 100% free (ad-supported)
3. Receipt scanning included
4. Voice expense entry (differentiator)

**Target Audiences:**
1. Frustrated Splitwise users (primary)
2. Roommates
3. Travel groups
4. Couples

### Launch Channels

**Day 1: Soft Launch**
- Submit to App Store/Play Store
- Tell beta testers to leave reviews
- Personal social media post

**Week 1: Reddit**
| Subreddit | Members | Post Type |
|-----------|---------|-----------|
| r/Splitwise | 16K | "Built a free alternative after hitting limits" |
| r/Frugal | 24M | "100% free expense splitting app" |
| r/personalfinance | 20M | "Free Splitwise alternative" |
| r/roommates | 100K | "App for splitting rent/utilities" |
| r/travel | 10M | "Free app for trip expense splitting" |

**Reddit Post Template:**
```
Title: Built a 100% free Splitwise alternative after hitting the daily limit on a trip

Hey r/[subreddit],

Got frustrated with Splitwise's 3-expense daily limit during a group trip,
so I built an alternative.

split it. - completely free, no limits:
- Unlimited expenses
- Receipt scanning (snap a photo, we extract items)
- Voice input ("Add $30 dinner split with Mike")
- No premium tier, no paywalls

Ad-supported (only shows ads when you close the app, not during use).

iOS: [link]
Android: [link]

Would love feedback. What features would make you switch?
```

**Week 2: Product Hunt**
- Tagline: "Split expenses by voice. 100% free."
- First comment: Founder story
- Demo GIF: Voice expense in action
- Launch Tuesday-Thursday, 12:01 AM PT

**Week 2-4: TikTok/Reels**
- Video 1: "Splitwise wants $40/year for THIS?" (show limits)
- Video 2: Voice expense demo
- Video 3: Receipt scanning demo
- Video 4: "POV: Splitting the Airbnb with 6 people"

### Marketing Assets Needed

| Asset | Format | Purpose |
|-------|--------|---------|
| App Store screenshots | PNG | Store listing |
| Feature graphic | 1024x500 | Play Store |
| Demo video | MP4, <30s | Store listing, social |
| Voice demo GIF | GIF | Reddit, PH |
| Receipt scanning GIF | GIF | Reddit, PH |
| Social media images | 1080x1080 | Instagram, Twitter |
| Press kit | PDF | Media outreach |

### PR/Media Outreach

**Target Publications:**
- TechCrunch (unlikely but worth a pitch)
- Product Hunt newsletter
- Finance app review blogs
- Personal finance YouTubers

**Pitch Angle:**
"College student builds free Splitwise alternative after app's aggressive paywalling frustrates millions"

---

## Launch Plan & Success Metrics

### Launch Day Checklist

**T-1 Day:**
- [ ] App approved in both stores
- [ ] Marketing posts drafted
- [ ] Beta testers notified to leave reviews
- [ ] Analytics dashboards ready

**Launch Day:**
- [ ] Publish app (remove "coming soon" if applicable)
- [ ] Post to Reddit (1-2 subreddits, stagger over week)
- [ ] Personal social media
- [ ] Email beta testers asking for reviews

**T+1 Week:**
- [ ] Monitor reviews, respond to all
- [ ] Fix any critical bugs
- [ ] Post to more subreddits
- [ ] Analyze first week metrics

### Success Metrics

**Week 1 Targets:**
| Metric | Target | Stretch |
|--------|--------|---------|
| Downloads | 500 | 1,000 |
| DAU | 100 | 200 |
| Groups created | 200 | 400 |
| Expenses added | 500 | 1,000 |
| App Store rating | 4.0+ | 4.5+ |
| Crash-free rate | 99% | 99.5% |

**Month 1 Targets:**
| Metric | Target | Stretch |
|--------|--------|---------|
| Downloads | 5,000 | 10,000 |
| MAU | 1,000 | 2,000 |
| Day 7 retention | 15% | 25% |
| Day 30 retention | 5% | 10% |
| Reviews | 50+ | 100+ |
| Average rating | 4.2+ | 4.5+ |

### Tracking Setup

**PostHog Events to Track:**
```
app_opened
sign_up_completed
group_created
expense_created
receipt_scanned
voice_expense_created
settlement_recorded
friend_added
app_rated
```

**PostHog Funnels:**
1. Sign up → Create group → Add expense → (success)
2. Open receipt scanner → Scan → Claim items → Finalize → (success)
3. Install → Day 1 return → Day 7 return → Day 30 return

**Dashboards Needed:**
1. Daily active users
2. New vs returning users
3. Conversion funnel (signup → active user)
4. Feature adoption (% using receipts, voice)
5. Retention cohorts

---

## Go/No-Go Decision Framework (April 2026)

### Timeline
- **Launch:** Early March 2026
- **Evaluation Period:** March 1 - April 15 (6 weeks)
- **Decision Date:** April 15, 2026

### Decision Criteria

The go/no-go decision should be based on **quantitative metrics** and **qualitative signals**.

#### Quantitative Criteria

**Threshold for "Go" (Continue Investing):**

| Metric | Minimum | Notes |
|--------|---------|-------|
| Total downloads | 5,000+ | Shows market interest |
| MAU | 1,000+ | Enough to iterate on |
| Day 7 retention | 15%+ | Users find value |
| Day 30 retention | 5%+ | Sticky enough |
| App Store rating | 4.0+ | Quality bar |
| Organic growth | 20%+ of downloads | Word of mouth working |
| Groups with 3+ expenses | 500+ | Real usage |

**Threshold for "No-Go" (Pause/Pivot):**

| Metric | Warning Sign | Notes |
|--------|--------------|-------|
| Downloads | <1,000 in 6 weeks | No market interest |
| Day 7 retention | <10% | Users don't find value |
| App Store rating | <3.5 | Quality issues |
| Crash rate | >2% | Technical problems |
| Zero organic growth | 0% | No word of mouth |

#### Qualitative Criteria

**Positive Signals:**
- Users asking for features (engaged)
- Unprompted testimonials
- Users inviting friends (viral)
- Comparison to Splitwise in reviews
- Press/blogger interest

**Negative Signals:**
- Common complaints about core functionality
- Users churning after 1 use
- Silence (no reviews, no feedback)
- "It's fine but I'll stick with X"
- Technical issues dominating feedback

### Decision Matrix

| Scenario | Metrics | Qualitative | Decision |
|----------|---------|-------------|----------|
| A | Exceeds all thresholds | Strong positive signals | **GO** - Double down, consider funding |
| B | Meets thresholds | Mixed signals | **GO** - Continue, iterate on feedback |
| C | Meets some thresholds | Positive signals | **CONTINUE** - 4 more weeks, focus on weak areas |
| D | Below thresholds | Negative signals | **PIVOT** - Change strategy or market |
| E | Far below thresholds | Silence or negative | **NO-GO** - Pause project, learn from it |

### What "Go" Means

If decision is **Go**, next steps:
1. Continue development (3-6 month roadmap)
2. Consider monetization (ads, premium)
3. Explore funding (if ambitious growth planned)
4. Hire/outsource (design, marketing)
5. Set next milestone (10K MAU? Revenue?)

### What "No-Go" Means

If decision is **No-Go**, options:
1. **Pause:** Put project on hold, revisit in 6 months
2. **Pivot:** Change target market or value prop
3. **Open Source:** Release code, let community run with it
4. **Sell:** If there's any value, find a buyer
5. **Archive:** Learn from it, move on

### How to Make the Decision

**Week of April 15:**
1. Pull all metrics into a single dashboard
2. Read through all reviews and feedback
3. Talk to 3-5 active users (if any)
4. Compare against criteria above
5. Make decision by April 15

**Document the Decision:**
- What metrics looked like
- What qualitative feedback said
- Reasons for decision
- If continuing: next 3-month plan
- If stopping: lessons learned

---

## Appendix: Weekly Schedule

### Week 1 (Feb 3-5): Bug Squashing
| Day | Focus |
|-----|-------|
| Mon | Audit known bugs, triage |
| Tue | Fix critical/high priority |
| Wed | Fix medium, QA full app |

### Week 2 (Feb 6-14): Features
| Day | Focus |
|-----|-------|
| Thu-Fri | Voice expense infrastructure |
| Mon-Tue | Voice NLP + integration |
| Wed-Thu | Voice claiming for receipts |
| Fri | Polish, edge cases |

### Week 3 (Feb 15-21): Beta Testing
| Day | Focus |
|-----|-------|
| Mon-Tue | Onboard testers |
| Wed-Fri | Monitor usage, gather feedback |
| Sat-Sun | Summarize feedback |

### Week 4 (Feb 22-28): Launch Prep
| Day | Focus |
|-----|-------|
| Mon-Tue | Fix feedback issues |
| Wed | Screenshots, store listing |
| Thu | Submit to App Store |
| Fri | Final QA |

### Week 5 (Mar 1-7): GTM
| Day | Focus |
|-----|-------|
| Mon | App goes live |
| Tue | Reddit r/Splitwise post |
| Wed | More Reddit posts |
| Thu | Monitor, respond to reviews |
| Fri | Product Hunt prep |

---

## Notes

- This plan assumes 1 developer working ~full time
- Dates are approximate, adjust as needed
- Voice feature is ambitious for 1 week - scope down if needed
- Beta testing can overlap with feature development
- Marketing can start before official launch (build anticipation)

**Remember:** The goal isn't perfection, it's learning. Launch fast, iterate based on real feedback.
