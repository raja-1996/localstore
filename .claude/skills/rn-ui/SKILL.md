# React Native UI/UX Skill

You are implementing UI for a React Native (Expo) app. Follow this design system strictly and consistently across all screens.

---

## Design Philosophy — Twitter/X Inspired

**Core principles (in priority order):**
1. **Content-first, chrome-minimal** — text IS the UI; remove all visual noise
2. **Flat + monochrome + single accent** — zero elevation, no shadows on content
3. **Divider-based separation** — hairline dividers between items, NOT cards
4. **Progressive disclosure** — "Show more" for long text, truncated handles, overflow menus
5. **Dual-layer navigation** — top tabs (content filter) + bottom tabs (app sections)
6. **Social proof everywhere** — avatars, metrics, counts, badges
7. **Consistent FAB** — same blue circle with `+` across all screens
8. **High information density** — 5-6 items visible per screen; compact vertical padding
9. **Light mode only**

**Reference: 3 X screens analyzed**
- Screen 1 (Home Feed): full tweet cards with avatar, engagement row, link previews, inline images
- Screen 2 (Explore "For You"): mixed content — news headlines + trending hashtags + section headers
- Screen 3 (Explore "News"): headline-only cards with avatar stacks + meta text

---

## Design Tokens

### Colors
```ts
const colors = {
  // Base
  background: '#FFFFFF',
  surface: '#F7F9F9',          // very subtle off-white for search bars, input fields
  divider: '#EFF3F4',          // hairline separators between items
  border: '#CFD9DE',           // input borders, stronger separation

  // Text
  textPrimary: '#0F1419',      // near-black — headlines, names, primary content
  textSecondary: '#536471',    // muted gray — timestamps, meta, handles, tab labels
  textTertiary: '#8B98A5',     // lighter gray — placeholders, disabled

  // Accent (Twitter/X Blue — single accent, used sparingly)
  accent: '#1D9BF0',           // active tab underline, FAB, links, follow buttons
  accentPressed: '#1A8CD8',    // pressed state
  accentLight: '#E8F5FD',      // subtle highlight backgrounds

  // Status
  success: '#00BA7C',          // green — likes, success states
  error: '#F4212E',            // red — errors, destructive actions, notification badges
  warning: '#FFD400',          // yellow — caution states
  retweet: '#00BA7C',          // green — retweet icon when active

  // Engagement icons (default gray, colored when active)
  iconDefault: '#536471',      // reply, retweet, like, share — inactive
  iconLikeActive: '#F91880',   // pink — liked state
  iconRetweetActive: '#00BA7C',// green — retweeted state

  // Neutrals
  white: '#FFFFFF',
  grey50: '#F7F9F9',
  grey100: '#EFF3F4',
  grey200: '#CFD9DE',
  grey300: '#B4C0C8',
  grey400: '#8B98A5',
  grey500: '#6E7B86',
  grey600: '#536471',
  grey700: '#333B43',
  grey800: '#1C2733',
  grey900: '#0F1419',
}
```

### Typography
```ts
const typography = {
  // Headlines (bold, near-black — used for news headlines, section titles)
  headline: { fontSize: 20, fontWeight: '800', color: '#0F1419', lineHeight: 26 },
  headlineMd: { fontSize: 18, fontWeight: '700', color: '#0F1419', lineHeight: 24 },

  // Section headers ("Today's News", "What's happening")
  sectionHeader: { fontSize: 22, fontWeight: '800', color: '#0F1419', letterSpacing: -0.3 },

  // Names & labels
  name: { fontSize: 15, fontWeight: '700', color: '#0F1419' },
  handle: { fontSize: 15, fontWeight: '400', color: '#536471' },

  // Body (tweet text)
  body: { fontSize: 15, fontWeight: '400', color: '#0F1419', lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', color: '#0F1419', lineHeight: 18 },

  // Meta text (timestamps, categories, post counts)
  meta: { fontSize: 13, fontWeight: '400', color: '#536471' },
  metaSmall: { fontSize: 12, fontWeight: '400', color: '#536471' },

  // Tab labels
  tabActive: { fontSize: 15, fontWeight: '700', color: '#0F1419' },
  tabInactive: { fontSize: 15, fontWeight: '500', color: '#536471' },

  // Engagement counts
  engagementCount: { fontSize: 13, fontWeight: '400', color: '#536471' },

  // Trending hashtags
  hashtag: { fontSize: 16, fontWeight: '700', color: '#0F1419' },
  trendingLabel: { fontSize: 13, fontWeight: '400', color: '#536471' },

  // Link source ("From hackernoon.com")
  linkSource: { fontSize: 13, fontWeight: '400', color: '#536471' },
}
```

### Spacing
```ts
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,      // between avatar and text, between engagement icons
  lg: 16,      // horizontal screen padding, vertical item padding
  xl: 20,      // between major sections
  xxl: 32,
}
```

### Border Radius
```ts
const radius = {
  none: 0,       // list items — no rounding
  sm: 4,         // badges, chips
  md: 12,        // input fields, search bar
  lg: 16,        // link preview cards, images
  xl: 24,        // buttons
  full: 999,     // avatars, FAB, pills
}
```

---

## Navigation Patterns

### Dual Navigation (critical pattern)
```
+------------------------------------------+
| [Avatar]    [Search / Logo]    [Settings] |  <- Header bar
+------------------------------------------+
| For You | Trending | News | Sports | ...  |  <- Top tabs (scrollable)
|         ________                          |  <- Blue underline on active
+------------------------------------------+
|                                           |
|  Content list                             |  <- Flat list with dividers
|                                           |
+------------------------------------------+
|                                    [FAB]  |  <- Blue + button
+------------------------------------------+
| Home | Search | Compose | Bell | Messages |  <- Bottom tabs
+------------------------------------------+
```

### Top Tab Strip
- Horizontal `ScrollView` or `FlatList` with tabs
- Active: bold text (#0F1419) + 3px blue underline (#1D9BF0)
- Inactive: medium text (#536471), no underline
- Tab height: ~44px, horizontal padding 16px per tab

### Bottom Tab Bar
- White background, hairline top border (#EFF3F4)
- 5 icon tabs, active = filled icon (#0F1419), inactive = outline (#536471)
- Notification badge: red circle (#F4212E) with white count text
- No labels — icons only (unlike current app which uses labels)

### Header Bar
- Left: circular avatar (32px)
- Center: logo OR search bar (pill shape, grey bg #EFF3F4, rounded full)
- Right: settings gear icon

---

## Content Patterns

### Feed Item — Full Tweet (Screen 1)
```
+------------------------------------------+
| [Avatar 40px]  Name (bold) @handle · 6h  |
|                ... (overflow menu)        |
|                                           |
| Tweet body text goes here, can be         |
| multi-line with "Show more" link          |
|                                           |
| +--------------------------------------+ |
| | [Link preview image]                 | |
| | Title overlay text                   | |
| | From domain.com                      | |
| +--------------------------------------+ |
|                                           |
| reply(43) retweet(153) like(2.2K)        |
| views(8.9M) bookmark share              |
+------ hairline divider ------------------+
```

- Avatar: 40px circle, left-aligned
- Name row: name (bold) + verified badge + @handle (gray) + dot + time
- Overflow: `...` icon, right-aligned on name row
- Body: 15sp, multi-line, "Show more" link in accent color
- Link preview: rounded 16px card, image with title overlay, source below
- Engagement row: 6 icons evenly spaced with counts in gray

### Feed Item — News Headline (Screen 2 & 3)
```
+------------------------------------------+
| Bold headline text, max 2 lines          |
| wrapping allowed                         |
|                                           |
| [ava1][ava2][ava3]  16h ago · News · 1.9K|
+------ hairline divider ------------------+
```

- Headline: 18-20sp, bold (#0F1419), max 2 lines
- Avatar stack: 3 overlapping 24px circles, -8px overlap each
- Meta row: gray text — "16 hours ago · News · 1.9K posts"
- No body text, no engagement row — headline only
- Vertical padding: ~16px top and bottom

### Feed Item — Trending Hashtag (Screen 2)
```
+------------------------------------------+
| #HashtagName                         ... |
| Entertainment · Trending                  |
+------ hairline divider ------------------+
```

- Hashtag: 16sp bold (#0F1419)
- Category: 13sp gray — "Entertainment · Trending" or "Trending in India"
- Overflow menu: `...` right-aligned
- Most compact card type — high density

### Section Header
```
+------------------------------------------+
| Today's News                              |
+------------------------------------------+
```

- Bold 22sp (#0F1419), left-aligned
- 16px horizontal padding, 12px vertical padding
- Separates content groups within a tab

### Avatar Stack Component
- 3 circular avatars (24px diameter)
- Each overlaps previous by -8px (margin-left: -8px)
- White 2px border around each to create separation
- First avatar: no negative margin

---

## Component Patterns

### Divider (primary separator — replaces cards)
```tsx
<View style={{
  height: StyleSheet.hairlineWidth,
  backgroundColor: '#EFF3F4',
  marginHorizontal: 16,
}} />
```

### Search Bar (pill)
```tsx
<View style={{
  backgroundColor: '#EFF3F4',
  borderRadius: 999,
  height: 40,
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  flex: 1,
}}>
  <Ionicons name="search" size={18} color="#536471" />
  <Text style={{ color: '#536471', fontSize: 15, marginLeft: 8 }}>Search</Text>
</View>
```

### FAB (Floating Action Button)
```tsx
<Pressable style={{
  position: 'absolute',
  bottom: 80,
  right: 16,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: '#1D9BF0',
  alignItems: 'center',
  justifyContent: 'center',
  // subtle shadow on FAB only
  shadowColor: '#1D9BF0',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
}}>
  <Ionicons name="add" size={28} color="#FFFFFF" />
</Pressable>
```

### Engagement Row
```tsx
<View style={{
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingRight: 48, // don't stretch to full width
  marginTop: 12,
}}>
  {/* Each item: icon + count */}
  <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Ionicons name="chatbubble-outline" size={18} color="#536471" />
    <Text style={{ fontSize: 13, color: '#536471' }}>43</Text>
  </Pressable>
  {/* repeat for: retweet, heart, bar-chart (views), bookmark, share */}
</View>
```

### Primary Button (follow, sign in)
```tsx
<Pressable style={{
  backgroundColor: '#0F1419',
  borderRadius: 999,
  height: 36,
  paddingHorizontal: 16,
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Follow</Text>
</Pressable>
```

### Secondary / Outline Button
```tsx
<Pressable style={{
  backgroundColor: 'transparent',
  borderRadius: 999,
  borderWidth: 1,
  borderColor: '#CFD9DE',
  height: 36,
  paddingHorizontal: 16,
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <Text style={{ color: '#0F1419', fontSize: 14, fontWeight: '700' }}>Edit profile</Text>
</Pressable>
```

### Input Field
```tsx
<TextInput style={{
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#CFD9DE',
  borderRadius: 4,
  height: 52,
  paddingHorizontal: 12,
  fontSize: 16,
  color: '#0F1419',
}} />
// Focus state: borderColor = '#1D9BF0', borderWidth = 2
```

### Notification Badge
```tsx
<View style={{
  position: 'absolute',
  top: -4,
  right: -6,
  backgroundColor: '#1D9BF0',
  borderRadius: 999,
  minWidth: 18,
  height: 18,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 4,
}}>
  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>1</Text>
</View>
```

### Verified Badge
- Blue circle with white checkmark, 18px, inline after name
- `<Ionicons name="checkmark-circle" size={18} color="#1D9BF0" />`

### Overflow Menu
- `...` icon (horizontal ellipsis), right-aligned
- `<Ionicons name="ellipsis-horizontal" size={18} color="#536471" />`
- Opens bottom sheet or popup menu

### Link Preview Card
```tsx
<View style={{
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#EFF3F4',
  overflow: 'hidden',
  marginTop: 12,
}}>
  <Image source={{ uri: '...' }} style={{ width: '100%', height: 160 }} />
  <View style={{ padding: 12 }}>
    <Text style={{ fontSize: 15, fontWeight: '400', color: '#0F1419' }}>Title</Text>
    <Text style={{ fontSize: 13, color: '#536471', marginTop: 2 }}>From domain.com</Text>
  </View>
</View>
```

---

## Layout Rules

- **Screen padding**: 16px horizontal
- **Item padding**: 16px vertical within each feed item
- **Dividers**: hairline (#EFF3F4) between ALL items — no gaps, no cards
- **Safe area**: always use `SafeAreaView` or `useSafeAreaInsets`
- **No shadows on content** — shadows ONLY on FAB
- **No rounded containers** on list items — flat edges, divider-separated
- **Avatar-to-text gap**: 12px
- **Engagement icon spacing**: evenly distributed, ~48px between each
- **ScrollView**: `contentContainerStyle` with `paddingBottom: 80` (clear FAB)

---

## UX Patterns

- **Tap feedback**: `Pressable` with `opacity: 0.7` on press — not `TouchableOpacity`
- **Show more**: truncate text at 4 lines, show "Show more" link in accent color
- **Pull to refresh**: `RefreshControl` with accent color (#1D9BF0)
- **Long text**: clamp with `numberOfLines` + ellipsis, expandable on tap
- **Overflow menu**: `...` per item — opens bottom sheet with actions
- **Tab switching**: instant content swap, no animation; maintain scroll position
- **Infinite scroll**: load more on reaching end, subtle spinner at bottom
- **Notification badge**: red dot/count on bottom tab icons
- **Keyboard**: `KeyboardAvoidingView` on compose/form screens
- **Navigation header**: custom header — never default unstyled header

---

## Do's and Don'ts

**Do:**
- Use hairline dividers to separate items
- Keep typography hierarchy strict: bold headlines, gray meta
- Use accent color ONLY on: active tab indicator, FAB, links, follow buttons
- Show social proof (avatars, counts, badges)
- Maximize content density — more items visible per screen
- Use `StyleSheet.hairlineWidth` for dividers

**Don't:**
- Use cards with shadows in feed lists
- Use rounded containers around list items
- Use multiple accent colors — single blue only
- Add borders AND shadows on same element
- Use colored backgrounds on list items
- Add excessive whitespace between items (keep it compact)
- Use tab labels in bottom bar — icons only

---

## Migration Notes (from current app)

When updating the existing app to this design:
- Replace `surface` bg + `borderRadius` cards with flat items + hairline dividers
- Change primary from `#3B6FD4` to `#1D9BF0`
- Remove shadows from all content (keep only on FAB)
- Add horizontal top tab strip for content filtering
- Switch bottom tabs from labeled to icon-only
- Increase content density — reduce vertical padding
- Add avatar stacks where social proof is relevant

---

## How to use this skill

When asked to build a screen or component:
1. Apply design tokens above — do not invent new colors or sizes
2. Use flat/divider-based layouts — no cards in lists
3. Maximize content density — compact padding, more items visible
4. Use accent blue sparingly — only active states + FAB + links
5. Output complete, working React Native + `StyleSheet` code
6. Use `Pressable` not `TouchableOpacity`
7. Handle loading, empty, and error states
8. Include overflow menu (`...`) on contextual items
