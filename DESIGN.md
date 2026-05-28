# DESIGN.md — WRLD Design System

Living reference for the WRLD app's design system. Read alongside
[CLAUDE.md](CLAUDE.md). This doc is for both human collaborators (Ben, Aaron)
and any Claude instance working on visual / component code.

The four mechanical criteria for "Phase 12 done":

1. All screens use only colors from `theme.colors` (no hex literals in `app/` screens).
2. No `StyleSheet` in screens contains hardcoded font sizes or spacing values.
3. Every primitive has a corresponding entry in Section 3 with current "Used in" sites.
4. Component gallery (`src/screens/_dev/ComponentGallery.tsx`) renders without
   errors and covers every primitive variant (default, pressed, disabled,
   loading where applicable).

The "feels like the same product" judgment is the *outcome* of hitting those
four — not a separate criterion.

---

## 1. Design principles

WRLD has five design principles. Each one decides something — it rules out a
reasonable alternative someone could have chosen. If a principle ever stops doing
that, cut it or rewrite it. Aesthetics (specific colors, blur, overlays, parallax)
flow *from* these principles and live in the token reference and component specs, not
here.

---

### 1. Spin to discover — never scroll
The globe is how you find what's live. It is the product's primary metaphor and its
discovery mechanism, not decoration and not one feature among many. Discovery in WRLD
is **spatial** — you explore a place to find what's happening in it. We refuse the
feed: there is no endless vertical scroll of thumbnails. The globe leads the discovery
mode, and every path through discovery returns to it.

*Rejects:* the scroll-feed paradigm (a wall of stream previews); burying discovery
behind a search bar; treating the globe as a hero image rather than the working core.
This is our sharpest refusal — the feed is the single thing WRLD is most defined against.

> **Mode note:** "Spin to discover" governs the **discovery mode**. It hands off to
> Principle 3 in the **watching mode** — see below. The globe leads discovery; the
> stream leads watching. The two never compete for the same screen at the same time.

---

### 2. Calm interface, hot content
The interface is cool, controlled, and quiet. The live moment is the only thing
allowed to be electric. WRLD is about live music and the buzz of real events, but the
app expresses that by *framing* the heat, not generating it — a desaturated,
structural UI with a single neon accent, where the stream and the active moment are
where the energy lives. This is deliberately the opposite of what a live-events app is
"supposed" to look like; the restraint is the point.

**Engagement signals are present but restrained.** WRLD has the social furniture a
discovery product needs — live-viewer counts, favourites, indicators of what's worth
attention — but they inform discovery, they never manufacture urgency. A viewer count
that helps you choose what to watch is honest work; a badge engineered to pull you back
into the app is not. The signals stay cool: information, not bait.

*Rejects:* a busy, hyped, "everything is exciting" interface; chrome that competes with
content for energy; dopamine furniture weaponized for retention.

---

### 3. One thing in focus
At any moment, a single element is sharp, lit, and forward — the live action, the active
control, the place you can go next. Everything else desaturates, softens, and recedes.
The interface is a depth of field, not a flat surface. Contrast, blur, scale, and the
neon accent all serve this one job: making it unmistakable what matters right now. In
the watching mode this principle leads — the stream takes over the screen and the globe
recedes; you got there by discovering, and watching is its own full-attention mode.

*Rejects:* flat layouts where everything has equal weight; multiple competing calls to
action; visual democracy between content and chrome.

---

### 4. Built, not bubbly
WRLD's geometry is architectural — clean straight lines, honest structure, edges that
mean something, softened just enough (a subtle 4pt rounding) to not draw blood. The
product should feel constructed and grounded, never weightless, never generic, never the
rounded-rectangle sameness of every other consumer app. The look leans deco/brutalist:
confident structure without apology.

This is not just taste. WRLD points **outward** — it is a lens, a set of windows onto
real events happening right now in real places. The structure echoes the realness of
what it frames: the app is grounded and architectural because the venues and moments it
points at are real, physical, located things. The interface is a frame around reality,
not a self-contained destination that calls attention to itself.

*Rejects:* soft, friendly, bubbly UI; heavy rounding; mascot energy; the generic
"delightful consumer app" aesthetic that would make WRLD feel like an abstract content
feed rather than a window onto the real world. This is our second-sharpest refusal.

---

### 5. Motion shows where, not show-off
Motion is justified by what it communicates — depth, hierarchy, where you came from,
what's live right now. Subtle parallax establishes near and far. A live pulse signals an
active stream. Screen transitions tell you where you are in the space. If an animation is
only there to look slick, it is cut.

*Rejects:* decorative animation; motion for delight alone; anything that moves without
telling the user something true about the interface.

---

### Application notes

These are not separate principles — they are how the five above resolve recurring
decisions. They exist so that token and component choices trace back to the principles.

**Density — "few things, generously sized."** Calm comes from *fewer* elements, not
smaller ones and not emptier screens. Controls are large and tactile; they fill their
space rather than floating in it. Breathing room lives *between* focal elements, not
inside them. We reject both failure modes: dense/compact UI (many small controls to save
taps) *and* barren minimalism (one tiny element adrift in void). When in doubt, err
toward **fewer and larger** — never toward smaller-and-more, never toward emptier.
(Flows from Principles 2 and 3.)

**Contrast & color — "newspaper, inverted."** Near-white text on a near-black field; **no
true blacks (#000) and no true whites (#fff)**. The reference is print: crisp, legible,
high-contrast, but never harsh, because neither end hits the absolute. Text hierarchy is
**confident and clear** (distinct primary / secondary / tertiary levels), print-like —
not a washed-out narrow band of grays. The single neon accent (or neon gradient) is the
only saturated element in an otherwise desaturated, ink-and-paper world, which makes it
**focal by default** — its job is to mark what matters, not to flavor the brand. A
gradient accent (vs. a flat swatch) carries direction/energy and is a deliberate
token-stage decision to make against the real mocks. (Flows from Principles 2 and 3, and
satisfies the accessibility contrast floor — the premium look and the accessible look
agree here.)

**Accessibility baseline.** Screen-reader labels on all interactive elements, minimum
44pt tap targets, and sufficient text contrast are required from the first primitive, not
retrofitted. For WRLD this is also aesthetic discipline: a desaturated, cool palette is
exactly where contrast quietly fails, so enforcing the floor is part of getting "calm,
cool, premium" *right* — not a compliance tax bolted on.

---

## 2. Token reference

Current state: [src/lib/theme.ts](src/lib/theme.ts) is a Phase 1 starter —
flat token map with no palette/semantic split, no motion tokens, no elevation
tokens. Phase 12 expands it into the hybrid model described below.

### Target model: hybrid (flat palette + semantic layer)

Components consume **only** the semantic layer. The flat palette layer
holds raw values and is not imported by components. Adding a new semantic
token requires justification in Section 6 (decision log).

```
palette/  — raw values
  blue500 = '#5B8CFF'
  red500  = '#FF3B5C'
  ...
semantic/  — what components import
  colors.bg.primary
  colors.text.muted
  colors.accent.live
  ...
```

### Tight semantic vocabulary (working draft — to confirm against mocks)

- **Backgrounds:** 3–4 (`primary`, `elevated`, `overlay`, maybe `inverse`)
- **Text:** 3 levels (`primary`, `muted`, `subtle`)
- **Borders:** 2–3 weights (`subtle`, `strong`)
- **Brand:** `accent`, `accentMuted`
- **Semantic:** `live`, `success`, `danger`

### Principle-derived constraints (locked, pre-audit)

These flow from Section 1 and are not subject to mock-driven negotiation —
the mocks must satisfy them, not the other way around.

- **No true blacks or whites.** Palette excludes `#000000` and `#FFFFFF`.
  Backgrounds and text both sit just inside the absolute ends — the
  "inverted newspaper" reference. (From Principle 2, Contrast & color note.)
- **Subtle rounding only — ~4pt working radius.** No heavy rounding, no
  pill-shaped chrome by default. Specific radius scale derives from mocks,
  but the cap is "softened just enough to not draw blood." (From Principle 4.)
- **Single accent role.** One neon accent — flat swatch vs. gradient is a
  token-stage decision against real mocks. Saturated color is reserved for
  the accent role only; everything else is desaturated. (From Principle 2
  and Contrast & color note.)
- **Confident, distinct type levels.** Primary / secondary / tertiary text
  levels must be obviously distinct — not a narrow band of greys. (From
  Contrast & color note.)
- **Density bias: fewer and larger.** When tuning density, primitives err
  toward fewer, larger, more tactile controls — never smaller-and-more,
  never barren. (From Density note.)
- **A11y is aesthetic, not bolted on.** 44pt minimum hit targets and
  contrast floor are constraints on token values, not afterthoughts. A
  text token that violates contrast against its intended background is a
  broken token. (From A11y note.)

### Token categories

| Category   | Status   | Source of truth          |
| ---------- | -------- | ------------------------ |
| Colors     | partial  | will derive from mocks   |
| Typography | partial  | will derive from mocks   |
| Spacing    | partial  | will derive from mocks   |
| Radius     | partial  | will derive from mocks   |
| Motion     | missing  | will derive from mocks   |
| Elevation  | missing  | will derive from mocks   |

Audit blocked on first asset drop. Once we have one or two key screens
(globe + stream view recommended), I'll propose the populated `theme.ts`
for your sign-off **before** writing a single primitive.

---

## 3. Component inventory

One entry per primitive (`src/components/ui/`) and feature component
(`src/components/feature/`). The "Used in" lists are the heart of this doc —
they tell you the blast radius of changing a primitive.

**Maintenance rule:** updating "Used in" lists is part of definition-of-done
for any component change.

### Entry template

```markdown
### ComponentName
**Location:** `src/components/...`
**Variants:** primary, secondary, ...
**Sizes:** sm, md, lg
**States:** default, pressed, disabled, loading

**Used in:**
- `app/(app)/globe.tsx` — primary (Join button), ghost (Dismiss)
- ...

**Tweak impact:** Changing primary variant affects N surfaces.
**Last reviewed:** YYYY-MM-DD
```

### Primitives (`src/components/ui/`)

Currently shipped (Phase 1, pre-design-system):

- `Button.tsx` — to be redesigned in Phase 12
- `Input.tsx` — to be redesigned in Phase 12

Planned bottom-up build order (later compose earlier — do not reorder
without surfacing it):

1. `Text` (consumes typography tokens)
2. `Pressable` (wraps RN Pressable with consistent press states from motion tokens)
3. `Icon` (wraps `@expo/vector-icons`, themed — set TBD pending Figma audit)
4. `Button` (composes Pressable + Text + Icon) — replaces existing
5. `Card`
6. `Input` — replaces existing
7. `Badge`
8. `Divider`, `Spacer`

Each primitive entry filled in as it ships. Empty entries until then.

### Feature components (`src/components/feature/`)

Currently present:

- `feature/stream/` — Phase 7/8 components (NearbyStreamsDrawer, NearbyStreamThumbnail, NearbyStreamRow)
- `feature/user/` — Avatar, FollowButton

Phase 12 candidates (compose primitives):

- `StreamCard` (globe tap-to-preview)
- `GlobePin` (currently inline in globe.tsx — sprite-based, may stay so)
- `HandleBadge`
- `ChatBubble` (Phase 10 inline → extracted)
- `ReactionBurst` (Phase 10 inline → extracted)

Entries added as feature components are migrated.

---

## 4. Screen inventory

One entry per screen. Lighter than Section 3 — purpose and which components
each screen composes.

### Entry template

```markdown
### app/(app)/screenName.tsx
**Purpose:** One-line description.
**Composes:** Button (primary, ghost), Card, StreamCard, ...
**Migrated to design system:** YYYY-MM-DD
```

### Current screens

| Screen                         | Purpose                                  | Migrated |
| ------------------------------ | ---------------------------------------- | -------- |
| `app/index.tsx`                | Auth-aware redirect                      | n/a      |
| `app/onboarding.tsx`           | Handle picker, avatar (Phase 8)          | no       |
| `app/(auth)/login.tsx`         | Clerk sign-in                            | no       |
| `app/(auth)/signup.tsx`        | Clerk sign-up + verify                   | no       |
| `app/(app)/globe.tsx`          | 3D globe + stream pins + banners         | no       |
| `app/(app)/dashboard.tsx`      | Source arming + Go Live                  | no       |
| `app/(app)/stream/[id].tsx`    | Broadcaster (id=new) / viewer (id=room)  | no       |
| `app/(app)/me.tsx`             | Own profile / account settings           | no       |
| `app/(app)/profile/[handle].tsx` | Public profile + follow                | no       |
| `app/(app)/search.tsx`         | User search                              | no       |
| `app/(app)/settings.tsx`       | Account + notifications                  | no       |

Migration order TBD. Recommend starting with the most visually opinionated
screens (globe, stream view) since they expose the most token coverage.

---

## 5. Motion patterns

Empty until Section 2 ships motion tokens. Resist animating everything.

Anticipated named patterns (to be defined with mocks):

- `screen-transition` — entry/exit between routes
- `card-press` — primitive press feedback
- `modal-entry` — bottom-sheet / AuthModal entry
- `live-pulse` — live indicator pulse

Each pattern when defined gets: timing token (ms), easing, opacity/transform
deltas, "Used in" sites.

---

## 6. Decision log

Append-only. Most recent first. Each entry: date, decision, rationale,
constraint it imposes downstream.

### 2026-05-27 — Design principles authored
Five principles + three application notes (density, contrast/color,
accessibility) drafted by Ben and locked into Section 1. Each principle
explicitly rejects a reasonable alternative — that's the test for whether
a principle is doing work. **Imposes:** every token-stage value, every
primitive variant, and every screen migration must trace back to a
principle. Specific hard constraints derived from principles are pinned
in Section 2's "Principle-derived constraints" block.

### 2026-05-27 — Accessibility floor: baseline-now
Screen-reader labels on interactive elements, 44pt minimum tap targets,
sufficient text contrast against the token palette. Bake into every
primitive from day one. **Rationale:** ~5–10% extra effort during primitive
design; impossible to retrofit cleanly later. **Imposes:** every primitive
must expose `accessibilityLabel` / `accessibilityRole` props and meet
44×44 minimum on its hit target.

### 2026-05-27 — Target device profile: various portrait ratios
Not a single device. Designs must work across the portrait iPhone range
(SE 375×667 → Pro Max 430×932) and Android equivalents. **Rationale:**
WRLD is a phone-only app; both Ben and Aaron carry different phones.
**Imposes:** no pixel-perfect mock matching. Use flex / percentage layouts.
Safe-area-aware. Every visual judgment is "looks right across the range,"
not "matches the mock at 390×844."

### 2026-05-27 — Figma asset transport: file drops + pasted Claude-mock code
Frames will arrive as PNG/SVG exports in `wrld-app/docs/design/figma-exports/`
(folder created when first batch is ready) and as code snippets pasted from
Claude-generated design mocks. **Rationale:** zero MCP setup on Ben's
constrained Mac dev env; most reliable on both platforms. **Imposes:**
exports must be named identifiably (e.g. `stream-view-portrait.png`); I'll
re-read files rather than caching them across sessions.

### Pre-Phase-12 locked decisions (carried in from the handoff)

#### Styling approach: `StyleSheet.create`, not NativeWind
Zero build-step dependency, Mac/Windows parity (Aaron is on Windows;
Ben's Mac has existing Metro fragility), team of two doesn't need NativeWind's
forcing function, type-safety is cleaner with native approach.
**Imposes:** every component uses `StyleSheet.create({...})` keyed off
imported theme tokens.

#### Token naming: semantic, hybrid model
Components consume only semantic layer; flat palette layer holds raw values.
Adding a new semantic token requires justification in this log.
**Imposes:** keep semantic vocabulary tight (3–4 backgrounds, 3 text levels,
2–3 border weights, brand colors, semantic colors).

#### Component gallery as permanent dev fixture
Lives at `src/screens/_dev/ComponentGallery.tsx`. Renders every primitive
variant × state combination for visual QA. Excluded from production builds
via dev-only flag (pattern TBD — confirm with Ben before wiring).
**Imposes:** new primitives MUST add a gallery entry before they're
considered shipped.

#### Inventory maintenance: manual (Option A)
Updating Section 3 "Used in" lists is part of definition-of-done for any
component change. **Imposes:** no scripted generation in v0.2. Revisit
if doc drifts.

#### Single design doc, not Storybook
This file. Storybook deferred to v0.3+ when team size justifies it.

---

## 7. Out of scope (v0.2)

Explicit deferrals. Cross-reference with [CLAUDE.md](CLAUDE.md) "v0.2
beta milestone" section.

- **Light mode.** Build tokens so a `lightTheme` could be added later (same
  semantic keys, different palette values), but do not wire a toggle in v0.2.
- **Broadcaster sensor sources beyond audio/video.** Compass, gyro,
  accelerometer, torch — all v0.3.
- **Localization / RTL.** v0.2 is English-only and LTR-only.
- **Theming per-stream / per-user.** No user-controlled theme overrides in
  v0.2.
- **Animation library.** React Native's `Animated` covers everything we need
  in v0.2. Reanimated / Skia deferred unless a specific pattern requires it.
- **Storybook.** See Section 6 decision.
- **Cross-platform testing automation.** Visual diffing tools (Chromatic,
  Percy) are v0.3+. v0.2 QA is manual via the component gallery on device.

---

## Architectural guardrails

These constraints prevent override-spaghetti and primitives-as-black-boxes.

- **One-way imports:** `app/` screens import from `feature/` and `ui/`.
  `feature/` imports from `ui/`. `ui/` imports only from `lib/theme.ts` and
  React Native. Never the reverse.
- **No hex literals or magic numbers in `app/` or `feature/`.** Every color,
  dimension, radius, font size comes from `theme.ts`.
- **Primitives must not be overridden via `style` props from screens.** If a
  screen needs a variant a primitive doesn't expose, that's a signal the
  primitive's variant set is incomplete — extend the primitive, don't
  override it.
- **Component count discipline:** 3–4 variants per primitive max. If a
  primitive grows beyond that, it's probably doing too much and should be
  split.
- **Dark-only.** See Section 7.

---

## How to add a primitive

1. Build in isolation, in `src/components/ui/<Name>.tsx`.
2. Add a gallery entry in `src/screens/_dev/ComponentGallery.tsx` showing
   every variant × size × state combination.
3. Add a Section 3 entry to this doc with the entry template, "Used in"
   empty (it'll be filled as you migrate screens).
4. Ben reviews on device before the next primitive starts.

## How to migrate a screen

1. One screen per commit. Commit message: `Phase 12: migrate <screen-name> to ui primitives`.
2. Visual diff against the Figma frame for that screen before committing.
3. Update Section 4's "Migrated" column with the date.
4. Update every primitive's "Used in" list in Section 3 to mention the screen.

## How to add a new semantic token

1. Justify it in Section 6 with a date entry.
2. Add to the semantic layer of `theme.ts`.
3. If introducing a new palette value, add that too (palette additions
   don't need decision-log entries, only semantic ones do).
4. Update Section 2's vocabulary table if you've added a category.
