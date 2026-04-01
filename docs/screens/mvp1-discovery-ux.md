# MVP 1 — Discovery: Screen Flows & UX Design

> User goal: "Find a local merchant who can do the thing I need."
> Shortest path: Open app → See nearby merchants → Tap one → View services

---

## 1. Master Flow

```
App Launch
    │
    ├─ No session → Auth Flow
    │   Phone → OTP → Location Permission → Near Me Feed
    │
    └─ Has session → Location Check
        │
        ├─ Permission granted → Near Me Feed
        └─ No permission → Permission Prompt → Near Me Feed (degraded)
```

```
Bottom Tab Bar (4 tabs)
    │
    ├─ Feed (default)    → Near Me feed
    ├─ Search            → Category grid + text search
    ├─ Chat (greyed)     → "Coming soon" placeholder
    └─ Profile           → User profile + become merchant
```

---

## 2. Screen-by-Screen Breakdown

### Screen A: Phone Entry (`(auth)/phone.tsx`)

**What user sees:**
- App logo + tagline: "Discover services near you"
- Phone input with `+91` prefix pre-filled
- "Send OTP" button (primary, full-width)
- Fine print: "By continuing, you agree to Terms"

**Interactions:**
- Numeric keypad auto-opens on mount
- Phone field: 10-digit validation, inline error below field
- "Send OTP" disabled until 10 digits entered
- Tap "Send OTP" → button shows spinner → navigates to verify

**States:**

| State | What user sees |
|-------|---------------|
| Empty | Cursor in phone field, keypad open |
| Typing | Digits appear, button enables at 10 |
| Sending | Button: spinner + "Sending..." (disabled) |
| Error | Red text below field: "Invalid number" or "Too many attempts" |
| Rate limited | "Try again in 60s" + countdown timer |

---

### Screen B: OTP Verify (`(auth)/verify.tsx`)

**What user sees:**
- "Enter the code sent to +91 98765..." (masked)
- 6 individual digit boxes (auto-focus first)
- "Resend code" link (greyed 30s, then tappable)
- Back arrow to return to phone screen

**Interactions:**
- Auto-advance: type a digit → cursor jumps to next box
- Paste support: paste full 6-digit code fills all boxes
- Auto-submit on 6th digit (no submit button needed)
- Backspace: clears current box, jumps back

**States:**

| State | What user sees |
|-------|---------------|
| Waiting | 6 empty boxes, keypad open, "Resend in 0:30" |
| Entered | All 6 filled, auto-verifying spinner |
| Wrong code | Boxes shake + turn red, "Incorrect code" text, boxes clear |
| Resend ready | "Resend code" turns blue/tappable |
| Expired | "Code expired. Resend a new one." |

---

### Screen C: Location Permission (one-time, post-auth)

**What user sees:**
- Illustration: map pin on a neighborhood
- "Enable location to see merchants near you"
- "Allow Location" button (primary)
- "Skip for now" link (secondary)

**Interactions:**
- "Allow" → triggers `expo-location` OS permission prompt
- Granted → navigates to Near Me feed
- Denied/Skipped → navigates to feed with "Search by area" fallback
- This screen only shows ONCE (first login)

**Why not ask before auth:** Show value proposition first. User has committed by entering OTP — now location ask has context.

---

### Screen D: Near Me Feed (`(app)/feed/index.tsx`) — PRIMARY SCREEN

**What user sees:**
- Top: "Near Me" header + current area name (e.g., "Jayanagar")
- Scrollable vertical list of merchant cards
- Each card: avatar, name, category badge, distance, rating stars, neighborhood
- Pull-to-refresh gesture
- Bottom tab bar (Feed highlighted)

**Merchant Card anatomy:**

```
┌─────────────────────────────────────┐
│ [Avatar]  Lakshmi's Kitchen         │
│           ⭐ 4.8 (23) · Food       │
│           Jayanagar 4th Block · 450m│
└─────────────────────────────────────┘
```

**Interactions:**
- Scroll: infinite scroll (cursor pagination, 20 per page)
- Pull down: refreshes location + reloads feed
- Tap card → navigates to Merchant Profile
- No "Following" tab in MVP 1 (hidden entirely)

**States:**

| State | What user sees |
|-------|---------------|
| Loading | 4-5 skeleton cards (pulsing rectangles) |
| Loaded | Merchant cards sorted by distance |
| Empty (no merchants nearby) | Illustration + "No merchants near you yet. Try expanding your search." + link to Search tab |
| No location | Banner at top: "Enable location for nearby results" + list shows all merchants unsorted |
| Error | "Couldn't load feed. Pull to retry." |
| Refreshing | Pull-to-refresh spinner at top |
| End of list | "You've seen all nearby merchants" footer |

---

### Screen E: Search (`(app)/search/index.tsx`)

**What user sees:**
- Search bar at top (auto-focus when tab tapped)
- Below search bar: Category grid (2 columns)
- Categories: Food, Tailoring, Beauty, Home Services, Events, Other
- Each category: icon + label in a card

**Interactions:**
- Tap search bar → keyboard opens, type query
- Type 2+ chars → debounced search results replace category grid
- Tap category card → shows filtered merchant list (same card format as feed)
- Back from results → returns to category grid
- Search results: same merchant card format, sorted by relevance then distance

**Search Results Layout:**

```
┌─ "tailoring" ─────────────────────────┐
│ [X clear]                             │
├───────────────────────────────────────┤
│ 3 results near Jayanagar              │
│                                       │
│ [Merchant Card]                       │
│ [Merchant Card]                       │
│ [Merchant Card]                       │
│                                       │
│ No more results                       │
└───────────────────────────────────────┘
```

**States:**

| State | What user sees |
|-------|---------------|
| Default | Search bar + category grid |
| Typing | Search bar active, results appear below |
| Searching | Skeleton cards below search bar |
| Results | Merchant cards with query match highlighted |
| No results | "No merchants found for '{query}'. Try a different search." |
| Category selected | Category name as header + filtered merchant list |
| Category empty | "No {category} merchants near you yet." |

---

### Screen F: Merchant Profile (`(app)/merchant/[id].tsx`)

**What user sees (scrollable single page):**

```
┌───────────────────────────────────────┐
│ ← Back                                │
│                                       │
│ [Large Avatar]                        │
│ Lakshmi's Kitchen                     │
│ ⭐ 4.8 (23 reviews) · Food           │
│ Jayanagar 4th Block · 450m away       │
│                                       │
│ "Homemade sweets and snacks for 15y"  │
│                                       │
│ [WhatsApp]  [Call]  (masked in MVP1)  │
│                                       │
│ ── Services (3) ──────────────────── │
│ [Service Card] [Service Card]         │
│ [Service Card]                        │
│                                       │
│ ── Portfolio ────────────────────── │
│ [Photo] [Photo] [Photo] [Photo]      │
│ (horizontal scroll)                   │
│                                       │
│ ── Reviews (23) ─────────────────── │
│ [Review] [Review] [Review]           │
│ "See all reviews →"                  │
└───────────────────────────────────────┘
```

**Sections:**

1. **Header**: Avatar, name, rating, category, distance, bio
2. **Contact**: WhatsApp + Call buttons (phone masked: "*****3210" — no chat in MVP 1)
3. **Services**: Horizontal scroll or 2-col grid of service cards (name, price, image)
4. **Portfolio**: Horizontal scrollable photo gallery (tap to full-screen)
5. **Reviews**: Latest 3 reviews preview + "See all" link (expandable or bottom sheet)

**Interactions:**
- Swipe back or tap ← to return to feed/search
- Tap service card → expands inline or navigates to service detail
- Tap portfolio image → full-screen gallery with swipe
- Tap "See all reviews" → scrolls to full review list or opens bottom sheet
- WhatsApp/Call: shows masked number notice ("Chat coming soon — share via WhatsApp link")

**States:**

| State | What user sees |
|-------|---------------|
| Loading | Skeleton: large rect + text lines + card placeholders |
| Loaded | Full profile with all sections |
| No services | "No services listed yet" placeholder in services section |
| No portfolio | Section hidden entirely |
| No reviews | "No reviews yet" (no review input in MVP 1) |
| Error | "Couldn't load this merchant. Go back and try again." |

---

### Screen G: User Profile (`(app)/profile/index.tsx`)

**What user sees:**
- Avatar (or initial circle) + name + phone number
- "Edit Profile" button
- "Become a Merchant" card (if not merchant) — prominent, with illustration
- Settings list: Language, Notifications, About, Logout

**Interactions:**
- Tap "Edit Profile" → inline edit: name + avatar upload
- Tap "Become a Merchant" → navigates to merchant creation flow
- Tap "Logout" → confirmation → returns to auth screen

**States:**

| State | What user sees |
|-------|---------------|
| Loaded | Profile info + options |
| Editing | Name field editable, avatar tappable for camera/gallery |
| Is merchant | "Manage your business →" replaces "Become a Merchant" |

---

## 3. Interaction Notes

### Navigation
- **Tab bar**: 4 icons with labels — Feed (home), Search (magnifier), Chat (bubble, greyed), Profile (person)
- **Back navigation**: swipe-back on iOS, ← arrow on all screens
- **Deep links**: each merchant profile has a shareable URL (WhatsApp cold-start strategy)

### Performance
- **Skeleton screens everywhere** — never show blank white or spinners
- **Image loading**: thumbnail placeholder → progressive load
- **Feed prefetch**: load next page when user scrolls to 80% of current page

### Location
- Location refreshed on: app foreground, pull-to-refresh, tab switch to Feed
- Stale location (>10 min): auto-refresh silently
- No location: feed degrades to "Search by area" — show search prompt at top

### Accessibility
- All tap targets: minimum 44x44pt
- Star ratings: include text equivalent ("4.8 out of 5")
- Category icons: include text labels (not icon-only)
- Distance: readable text, not just number ("450m away")

---

## 4. Edge Cases

| Scenario | Decision |
|----------|----------|
| User denies location permanently | Banner: "Go to Settings to enable" + allow area-based browsing |
| Merchant has no avatar | Colored initial circle (first letter of name) |
| 0 merchants in 5km radius | "No merchants nearby. Try expanding to 10km?" with action button |
| Search returns mixed categories | Show category badge on each card for disambiguation |
| Phone OTP not received | "Resend" after 30s + "Try a different number" link |
| App killed during OTP flow | On reopen: restore to phone entry (don't half-authenticate) |
| Merchant profile shared via WhatsApp | Deep link → if not logged in, auth first → then merchant profile |
| First-time user sees empty following tab | Hide following tab entirely in MVP 1 |

---

## 5. Screen Transition Map

```
phone.tsx ──OTP sent──→ verify.tsx ──verified──→ location permission
                                                      │
                                                      ▼
                                              feed/index.tsx (Near Me)
                                              │       │        │
                                    scroll + tap    pull-refresh  tab switch
                                              │                    │
                                              ▼                    ▼
                                    merchant/[id].tsx      search/index.tsx
                                    │         │                    │
                              tap service  tap portfolio   tap category / search
                                    │         │                    │
                                    ▼         ▼                    ▼
                              service detail  fullscreen     filtered merchants
                              (inline/sheet)  gallery        (same card layout)
                                                                   │
                                                              tap card
                                                                   │
                                                                   ▼
                                                         merchant/[id].tsx
```
