# PID: Voice Dictation for Receipt Splitting

**Document Status:** Draft
**Author:** Claude
**Created:** 2026-01-18
**Target Release:** v2.0

---

## 1. Problem Statement

### Current Pain Point
After scanning a receipt with OCR, users must manually tap through each item to assign it to group members. For a receipt with 15+ items at a group dinner, this becomes tedious:
- Tap item → Select "Drew" → Confirm
- Tap next item → Select "Sarah" → Confirm
- Repeat 15 times...

### User Insight
In real life, people naturally discuss bills verbally: *"I had the burger, Drew got the salmon, we split the appetizer three ways..."* This conversational flow is faster and more natural than tap-based UI.

### Opportunity
Enable users to **speak their bill split naturally** while viewing the scanned receipt. The AI interprets their statements, matches items to the OCR results, and confirms assignments—creating a conversational, "generative" experience.

---

## 2. Goals

| Goal | Metric |
|------|--------|
| Reduce time to assign all items | < 30 seconds for 10-item receipt (vs ~2 min manual) |
| Increase receipt completion rate | +25% receipts fully assigned |
| User satisfaction | NPS > 50 for voice feature |
| Accessibility | Enable hands-free operation |

### Non-Goals (Out of Scope)
- Voice-only receipt capture (still requires camera)
- Multi-language support (English MVP)
- Offline voice processing

---

## 3. User Stories

### MVP Stories
1. **As a user**, I can tap a microphone button while viewing my scanned receipt to start voice dictation
2. **As a user**, I can say "I got the burger" and see the burger item auto-assigned to me
3. **As a user**, I can say "Drew got the salmon and the salad" and see multiple items assigned
4. **As a user**, I can say "We split the appetizer" and see it marked as shared
5. **As a user**, I can see a real-time transcript of what I'm saying
6. **As a user**, I get confirmation feedback after each successful assignment
7. **As a user**, I can see when items couldn't be matched and manually fix them

### P1 Stories
8. **As a user**, I can have a back-and-forth conversation: "That's not right, Drew had the steak not the salmon"
9. **As a user**, I get proactive prompts: "3 items remaining: Caesar Salad, Tiramisu, and Coffee. Who had those?"
10. **As a user**, I can say "Drew and I split everything 50/50" for simple even splits
11. **As a user**, I can use nicknames that map to group members ("my wife" → Sarah)

### P2 Stories
12. **As a user**, I can dictate while the receipt is still being scanned (real-time merge)
13. **As a user**, I can say "Same as last time" for recurring group dinners
14. **As a user**, the AI remembers preferences ("Drew never drinks alcohol")

---

## 4. Technical Architecture

### 4.1 Speech-to-Text Options

| Service | Pros | Cons | Cost | Recommendation |
|---------|------|------|------|----------------|
| **Expo Speech Recognition** | Native, free, offline capable | iOS/Android differences, less accurate | Free | Good for MVP prototype |
| **Whisper API (OpenAI)** | Excellent accuracy, handles accents | Requires upload, latency | $0.006/min | **Best for MVP** |
| **Deepgram** | Real-time streaming, very accurate | More complex integration | $0.0043/min | Best for P1 streaming |
| **Google Speech-to-Text** | Streaming, good accuracy | Complex auth setup | $0.006/min | Alternative |
| **AssemblyAI** | Real-time, good accuracy | Similar to Deepgram | $0.00025/sec | Alternative |

**MVP Recommendation:** Start with **Whisper API** for best accuracy-to-complexity ratio. Record audio locally, upload for transcription. Upgrade to **Deepgram streaming** in P1 for real-time experience.

### 4.2 Natural Language Understanding

The transcribed text needs to be interpreted to extract:
- **Actions:** claim, split, assign, undo
- **People:** member names, pronouns ("I", "we"), relationships
- **Items:** fuzzy match to OCR-extracted items
- **Quantities:** "half", "split 3 ways", "one of the two burgers"

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Gemini API (existing)** | Already integrated, multimodal | May be overkill | **Use for MVP** |
| **Claude API** | Excellent reasoning | Additional vendor | Consider for P1 |
| **GPT-4o-mini** | Fast, cheap, good enough | Additional vendor | Alternative |
| **Custom NLU/Regex** | No API cost, fast | Brittle, hard to maintain | Avoid |

**MVP Recommendation:** Use **Gemini API** (already integrated for OCR) with a well-crafted prompt that includes the receipt items and member list as context.

### 4.3 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Voice Dictation Flow                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────┐
│  User    │───▶│ expo-av      │───▶│ Whisper API │───▶│ Gemini  │
│  speaks  │    │ (record)     │    │ (transcribe)│    │ (parse) │
└──────────┘    └──────────────┘    └─────────────┘    └─────────┘
                                                            │
                    ┌───────────────────────────────────────┘
                    ▼
            ┌─────────────────┐    ┌──────────────┐    ┌─────────┐
            │ Intent Parser   │───▶│ Item Matcher │───▶│ Claim   │
            │ (extract claims)│    │ (fuzzy match)│    │ Creator │
            └─────────────────┘    └──────────────┘    └─────────┘
                                                            │
                    ┌───────────────────────────────────────┘
                    ▼
            ┌─────────────────┐    ┌──────────────┐
            │ Confirmation    │───▶│ TTS Feedback │
            │ UI Update       │    │ (optional)   │
            └─────────────────┘    └──────────────┘
```

### 4.4 Data Flow

```typescript
// Input to NLU
{
  transcript: "I got the burger, Drew had the salmon, and we split the calamari",
  receipt_items: [
    { id: "item_1", description: "Classic Cheeseburger", price: 14.99 },
    { id: "item_2", description: "Atlantic Salmon", price: 24.99 },
    { id: "item_3", description: "Crispy Calamari", price: 12.99 },
    { id: "item_4", description: "Craft Beer", price: 7.99 }
  ],
  group_members: [
    { id: "mem_1", name: "Me", is_current_user: true },
    { id: "mem_2", name: "Drew" },
    { id: "mem_3", name: "Sarah" }
  ],
  existing_claims: []
}

// Output from NLU
{
  parsed_claims: [
    { item_id: "item_1", member_id: "mem_1", share_fraction: 1.0, confidence: 0.95 },
    { item_id: "item_2", member_id: "mem_2", share_fraction: 1.0, confidence: 0.92 },
    { item_id: "item_3", member_id: "mem_1", share_fraction: 0.5, confidence: 0.88 },
    { item_id: "item_3", member_id: "mem_2", share_fraction: 0.5, confidence: 0.88 }
  ],
  unmatched_references: [],
  clarification_needed: false,
  suggested_response: "Got it! I assigned the burger to you, salmon to Drew, and split the calamari between you two."
}
```

### 4.5 Required Dependencies

```json
// package.json additions
{
  "expo-av": "^14.0.0",           // Audio recording
  "expo-speech": "^12.0.0",       // Optional: TTS for confirmation
  "expo-haptics": "^13.0.0",      // Haptic feedback on success
  "fuse.js": "^7.0.0"             // Fuzzy string matching for items
}
```

---

## 5. Feature Breakdown by Phase

### MVP (P0) - "It Works"
**Goal:** Prove the concept works and users want it

| Feature | Description | Effort |
|---------|-------------|--------|
| Mic button on assign screen | Floating action button to start recording | S |
| Push-to-talk recording | Hold to record, release to process | M |
| Whisper transcription | Send audio to Whisper API | M |
| Basic NLU prompt | Gemini extracts claims from transcript | M |
| Fuzzy item matching | Match spoken items to OCR items (Fuse.js) | M |
| Claim creation | Auto-create item_claims from parsed result | S |
| Visual feedback | Highlight assigned items, show transcript | M |
| Error handling | "Couldn't find 'the pasta'" message | S |
| Loading states | Recording → Processing → Done indicators | S |

**MVP Total Effort:** ~2-3 weeks

### P1 - "It's Good"
**Goal:** Make the experience fluid and conversational

| Feature | Description | Effort |
|---------|-------------|--------|
| Streaming transcription | Real-time transcript as user speaks (Deepgram) | L |
| Conversational context | Remember previous statements in session | M |
| Undo/correction support | "Actually, Drew had the steak" | M |
| Proactive prompts | "Who had the remaining 3 items?" | M |
| Split detection | "We all split it" → equal split UI | M |
| Pronoun resolution | "My wife" → Sarah (if configured) | M |
| Audio feedback | Optional spoken confirmation | S |
| Haptic feedback | Vibrate on successful assignment | S |
| Confidence indicators | Show uncertain matches differently | S |

**P1 Total Effort:** ~3-4 weeks

### P2 - "It's Delightful"
**Goal:** Advanced AI features and learning

| Feature | Description | Effort |
|---------|-------------|--------|
| Parallel scan + dictate | Dictate while receipt still processing | L |
| Voice profiles | Train on user's voice for accuracy | L |
| Preference learning | "Drew is vegetarian" remembered | M |
| Pattern recognition | "Same as last Tuesday" | M |
| Multi-language | Spanish, French, Mandarin support | XL |
| Offline mode | On-device Whisper for offline | L |
| Group shortcuts | "The usual split" for recurring groups | M |

**P2 Total Effort:** ~6-8 weeks

---

## 6. UX/UI Specifications

### 6.1 Entry Point
- **Location:** Floating action button (FAB) on assign-receipt screen
- **Icon:** Microphone icon
- **Position:** Bottom-right, above the "Done" button
- **State:** Pulsing animation when listening

### 6.2 Recording States

```
┌─────────────────────────────────────────┐
│  IDLE                                   │
│  [🎤 Tap to speak]                      │
│                                         │
├─────────────────────────────────────────┤
│  RECORDING                              │
│  [🔴 Recording...] ← pulsing red        │
│  "I got the burger, Drew had..."        │
│  ← live waveform visualization          │
│                                         │
├─────────────────────────────────────────┤
│  PROCESSING                             │
│  [⏳ Processing...]                     │
│  "I got the burger, Drew had the salmon"│
│                                         │
├─────────────────────────────────────────┤
│  CONFIRMING                             │
│  ✓ Burger → You                         │
│  ✓ Salmon → Drew                        │
│  ⚠️ Couldn't find "pasta"               │
│  [Tap items to fix]                     │
│                                         │
└─────────────────────────────────────────┘
```

### 6.3 Visual Feedback on Items
- **Assigned by voice:** Brief green highlight animation
- **Split by voice:** Split indicator appears with member avatars
- **Failed match:** Item mentioned in transcript highlighted yellow with "?"

### 6.4 Confirmation Toast
After successful processing:
```
┌────────────────────────────────┐
│ ✓ Assigned 3 items             │
│   Burger → You                 │
│   Salmon → Drew                │
│   Calamari → Split (You, Drew) │
└────────────────────────────────┘
```

---

## 7. Gemini Prompt Design

### MVP Prompt Template

```
You are a receipt-splitting assistant. Given a voice transcript and receipt data, extract item assignments.

## Receipt Items
{{items_json}}

## Group Members
{{members_json}}
Note: "I", "me", "my" refers to the member with is_current_user: true

## Existing Claims
{{existing_claims_json}}

## Voice Transcript
"{{transcript}}"

## Instructions
1. Parse the transcript to identify who claimed which items
2. Fuzzy match spoken items to receipt items (e.g., "burger" → "Classic Cheeseburger")
3. Handle splits: "we split X" = equal split between mentioned people (or all if "we" is ambiguous)
4. Output ONLY valid JSON with this schema:

{
  "claims": [
    {
      "item_id": "string",
      "member_id": "string",
      "share_fraction": 0.0-1.0,
      "confidence": 0.0-1.0,
      "spoken_reference": "what user said"
    }
  ],
  "unmatched": [
    {
      "spoken_reference": "string",
      "reason": "no matching item found" | "ambiguous member" | "unclear quantity"
    }
  ],
  "response": "Natural language confirmation to show user"
}
```

---

## 8. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| "I got the burger" but 2 burgers on receipt | Ask "Which burger? The Classic or the Veggie?" |
| "Drew got something" - no item specified | "What did Drew get?" |
| "My friend got the salad" - unknown member | "Who is 'my friend'? [Drew] [Sarah] [Add new]" |
| Poor audio quality / no speech detected | "I couldn't hear that. Please try again." |
| Item already fully claimed | "The burger is already assigned to Sarah. Reassign?" |
| Network error during transcription | "Couldn't process audio. Check connection and retry." |
| User says something unrelated | Ignore gracefully, only process claim-like statements |

---

## 9. Privacy & Security

### Data Handling
- Audio recordings are **not stored** after transcription
- Transcripts stored temporarily in session state only
- No audio sent to analytics
- Clear user consent before first voice use

### Permissions
- Microphone permission required (standard Expo prompt)
- Explain why: "SplitFree uses your microphone to hear who got which items"

### Third-Party Data
- Whisper API: Audio processed, not stored (OpenAI policy)
- Gemini API: Text processed, not stored (Google policy)

---

## 10. Success Metrics

### MVP Launch Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Voice feature adoption | 30% of receipt assignments use voice | Analytics event |
| Completion rate | 80% of voice sessions complete assignment | Analytics event |
| Accuracy | 90% of voice claims need no manual correction | Analytics event |
| Time to assign | 50% faster than manual | A/B test |

### P1 Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Retention | +15% weekly retention for voice users | Cohort analysis |
| NPS | Score of 50+ for voice feature | In-app survey |
| Conversation turns | Avg 2+ turns per session (engagement) | Analytics |

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Poor transcription accuracy | Medium | High | Use Whisper (best-in-class), add retry UI |
| Gemini prompt failures | Low | High | Comprehensive prompt testing, fallback parsing |
| High latency (bad UX) | Medium | Medium | Show progress, optimize audio compression |
| Users don't discover feature | Medium | Medium | Onboarding tooltip, prominent FAB placement |
| Accent handling issues | Medium | Medium | Whisper handles accents well, allow text input fallback |
| API costs too high | Low | Medium | Monitor usage, add rate limiting, cache common patterns |

---

## 12. Dependencies

### Technical Dependencies
- Whisper API account and billing setup
- Expo SDK 54+ (for expo-av audio recording)
- Gemini API already integrated

### Team Dependencies
- Design: Voice UI/UX mockups
- Backend: None (client-side feature)
- QA: Test across accents, noise levels, edge cases

---

## 13. Open Questions

1. **Push-to-talk vs. auto-detect?** MVP uses push-to-talk for simplicity. P1 could add voice activity detection.

2. **Confirmation required?** Should auto-assignments require tap to confirm, or apply immediately?
   - Recommendation: Apply immediately with easy undo

3. **TTS feedback?** Should the app speak confirmations back?
   - Recommendation: Optional in P1, off by default

4. **Offline fallback?** Should we have a fallback for no connectivity?
   - Recommendation: P2, using on-device Whisper (complex)

---

## 14. Timeline & Milestones

### MVP Development
- Week 1: Audio recording + Whisper integration
- Week 2: Gemini NLU prompt + fuzzy matching
- Week 3: UI integration + error handling + testing

### P1 Development
- Weeks 4-5: Streaming transcription (Deepgram)
- Weeks 6-7: Conversational context + undo support
- Week 8: Polish, proactive prompts, audio feedback

### P2 Development
- Weeks 9-12: Preference learning, parallel processing
- Weeks 13-16: Multi-language, offline mode

---

## 15. Appendix

### A. Competitive Analysis

| App | Voice Features |
|-----|----------------|
| Splitwise | None |
| Venmo | None (has voice search for users) |
| Tab | None |
| Plates | Basic voice notes (not assignment) |

**Opportunity:** First-mover advantage in voice-based bill splitting.

### B. User Research Quotes

> "At the table we're always like 'you had the this, I had the that' - wish the app could just listen"

> "I hate tapping through 20 items after a big dinner"

> "Would be cool to just talk to it like Siri but for splitting bills"

### C. Alternative Approaches Considered

1. **Photo of handwritten notes** - User writes who got what, OCR it
   - Rejected: Still requires manual writing, not faster

2. **Pre-selection before ordering** - Claim items before meal
   - Rejected: Doesn't match real-world behavior, items change

3. **AI auto-assign based on history** - Learn patterns
   - Deferred to P2: Needs more data first

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Product | | | Pending |
| Engineering | | | Pending |
| Design | | | Pending |
