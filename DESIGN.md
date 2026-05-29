# DESIGN.md — WRLD Design System

Living reference for the WRLD app's design system. Read alongside
[CLAUDE.md](CLAUDE.md). This doc is for both human collaborators (Ben, Aaron)
and any Claude instance working on visual / component code.

The four mechanical criteria for "Phase 12 done":

1. All screens use only colors from `theme.colors` (no hex literals in
   `src/components/screens/`).
2. No `StyleSheet` in screens contains hardcoded font sizes or spacing values.
3. Every primitive has a corresponding entry in Section 3 with current "Used in" sites.
4. Component gallery (`src/components/screens/_dev/ComponentGallery.tsx`) renders
   without errors and covers every primitive variant (default, pressed, disabled,
   loading where applicable).

The "feels like the same product" judgment is the _outcome_ of hitting those
four — not a separate criterion.

---

## 0. System structure

The system is two layers sharing a token foundation. Section 0 defines the
structure. Sections 1+ describe the principles, tokens, and inventories that
populate it.

### 0.1 — Two layers, one foundation

- **Classical layer** — React-tree UI. Everything rendered as components.
- **Canvas layer** — GL experiences rendered outside the React tree via Three.js
  in a `GLView`.
- **Tokens** — sit outside both layers, consumed by both.

Both layers read tokens. Neither layer composes the other. They meet only at
the **seam** (defined in 0.3 below).

### 0.2 — The classical layer: five tiers

Five tiers, with strictly downward dependencies and no self-composition. This is
the engine of safe cascade.

| Tier          | Folder                       | Composes                               | Represents                   |
| ------------- | ---------------------------- | -------------------------------------- | ---------------------------- |
| Tokens        | `src/tokens/`                | nothing                                | values                       |
| UI Primitives | `src/components/primitives/` | tokens, other primitives               | domain-blind building blocks |
| Features      | `src/components/features/`   | primitives, tokens, domain types       | one domain thing             |
| Sections      | `src/components/sections/`   | features, primitives, tokens           | a region of a screen         |
| Screens       | `src/components/screens/`    | sections, features, primitives, tokens | one route's implementation   |

**Critical rule:** a tier may compose only the tiers below it, and **no classical
tier composes itself**. Features do not nest in features; sections do not nest in
sections. This is what bounds nesting depth and keeps blast radius computable.

### 0.3 — The canvas layer

The canvas layer is conceptually a navigable space of GL scenes organized by
zoom-depth levels. Vocabulary:

- **Scene** — one GL world (matches `THREE.Scene`). Earth-with-pins is a scene;
  future planets, street views, vignettes will be sibling scenes.
- **Level** — the depth/zoom position a scene occupies. Earth is Level 1; a
  future system view above it would be Level 0; a venue inside Earth would be
  Level 2. Level is _metadata stored inside each scene_, not filesystem
  location. All scenes are flat siblings under `scenes/`.
- **Scene element** — a thing drawn _inside_ a scene by the GPU (Pin, Globe,
  future HUD elements). These are `.ts` files (no JSX) — they are GPU-drawn
  objects, not React components.
- **Seam** — wherever React UI overlays a GL scene. A _concept_ in the diagram
  and this doc; today realized as one feature component
  (`DiscoveryHandoffCard`) living in the classical features tier. A dedicated
  `canvas/seam/` folder will be created only when a second seam component
  justifies it. (See 0.7.)
- **Resolved token value** — the form tokens take when consumed by canvas code
  (an actual RGBA/hex value computed for a `DataTexture`, not a token-bearing
  component or style prop).

The canvas layer is a **sibling** of the classical layer, not nested above or
below it. Both consume tokens. Neither composes the other.

### 0.4 — The dependency rule (safe cascade)

> Dependencies point downward to tokens only. Classical tiers nest upward,
> with no tier composing itself. Canvas scenes nest by level (metadata) and
> read tokens directly. The classical layer and the canvas layer never
> compose each other — they meet only at the seam. Blast radius of any
> change is computed by reading **upward** via "Used in" lists.

Concrete example: changing a token may affect primitives, features, sections,
screens, _and_ canvas scenes (via resolved values). Changing a primitive may
affect features, sections, and screens — but never tokens, and never canvas.
Changing one scene affects only itself. Reading upward from any node tells you
the blast radius.

### 0.5 — The reuse rule (extract on second proven case)

> Code, assets, and resources start in the scene or component that needs them.
> They move to a shared location (`canvas/stage/` for canvas; tier promotion
> for classical) only when a second real case proves the reuse — not before.
> Empty placeholder folders for anticipated reuse are not created.

What this rule has already produced, visible in the structure:

- **No top-level `canvas/assets/`** — Earth's 8K texture lives in
  `src/canvas/scenes/earth/assets/`, colocated with the scene that uses it.
- **No `canvas/seam/` folder** — the one seam component today
  (`DiscoveryHandoffCard`) lives as a feature; the folder is created when a
  second seam component exists.
- **No `scenes/_base/` shared scene class** — extracted from two real scenes
  when both exist, not guessed from one.
- **No empty placeholder scene folders** — Mars, vignettes, street views are
  documented as anticipated, not pre-built.
- **`canvas/stage/` is minimal today** — one file (`tokens.ts`, the
  token-to-RGBA bridge). Models, rigs, shared textures, animations, font
  atlases live there _when extracted from proven reuse_.

### 0.6 — Folder structure

```
wrld-app/
│
├── app/                                ← Routing tree (Expo Router constraint)
│   ├── globe.tsx                       ← shim → GlobeScreen
│   ├── dashboard.tsx                   ← shim → DashboardScreen
│   ├── profile.tsx                     ← shim → ProfileScreen
│   ├── stream/[id].tsx                 ← shim → StreamScreen
│   ├── settings.tsx                    ← shim → SettingsScreen
│   └── _layout.tsx                     ← framework layout (stays in app/)
│
├── src/
│   │
│   ├── tokens/                         ← Tier: Tokens
│   │   └── theme.ts
│   │
│   ├── components/                     ← Classical layer
│   │   │
│   │   ├── primitives/                 ← Tier: UI Primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Text.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Icon.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Pressable.tsx
│   │   │   ├── Spacer.tsx
│   │   │   ├── Divider.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── features/                   ← Tier: Features
│   │   │   ├── StreamCard.tsx
│   │   │   ├── HandleBadge.tsx
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── DiscoveryHandoffCard.tsx   ← seam-as-feature today
│   │   │   └── index.ts
│   │   │
│   │   ├── sections/                   ← Tier: Sections
│   │   │   ├── ProfileHeader.tsx
│   │   │   ├── StreamGrid.tsx
│   │   │   ├── SettingsGroup.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── screens/                    ← Tier: Screens (implementations)
│   │       ├── _dev/
│   │       │   └── ComponentGallery.tsx
│   │       ├── GlobeScreen.tsx
│   │       ├── DashboardScreen.tsx
│   │       ├── ProfileScreen.tsx
│   │       ├── StreamScreen.tsx
│   │       ├── SettingsScreen.tsx
│   │       └── index.ts
│   │
│   └── canvas/                         ← Canvas layer (sibling to components)
│       │
│       ├── scenes/
│       │   └── earth/
│       │       ├── EarthScene.tsx      ← React mount, lifecycle, seam wiring
│       │       ├── scene.ts            ← Three.js root, camera, render loop
│       │       ├── elements/
│       │       │   ├── Globe.ts
│       │       │   └── Pin.ts
│       │       ├── environment/
│       │       │   └── lighting.ts
│       │       ├── controls/
│       │       │   └── cameraControls.ts
│       │       ├── assets/
│       │       │   └── textures/
│       │       │       └── earth-8k.jpg
│       │       └── index.ts
│       │
│       ├── stage/                      ← Cross-scene canvas resources
│       │   └── tokens.ts               ← Token-to-RGBA bridge (universal)
│       │
│       └── README.md                   ← Local index of canvas tier rules
```

**Expo Router exception (the one stated carve-out).** Screens implementations
live in `src/components/screens/` like every other classical tier. The `app/`
folder holds _thin shims_ (one-line re-exports) because Expo Router requires
routes to live there for file-based routing. Each shim looks like:

```tsx
// app/globe.tsx
export { GlobeScreen as default } from '@/components/screens/GlobeScreen'
```

This pays the migration cost once to keep the design-system structure consistent
forever after. The `app/` folder becomes a clean route declaration tree;
implementation lives where the system says it should.

### 0.7 — The seam, today

The seam is a concept named in the diagram: wherever React UI visually overlays
a GL scene. Today the seam is realized as one feature component —
`DiscoveryHandoffCard` — which is the tap-to-preview card that overlays the
globe and bridges from discovery into watching mode.

`DiscoveryHandoffCard` lives in `src/components/features/` as a normal feature
component. Per the reuse rule (0.5), a dedicated `src/canvas/seam/` folder is
not created until a second seam component exists to share it. When the second
overlay arrives — an info panel at a deeper zoom level, a transition card
between scenes, a HUD over a vignette — we revisit and decide whether they
warrant a shared structural home.

The concept is real and named. The folder is deferred.

### 0.8 — Anticipated canvas inhabitants

Documented for future R&D coherence. None are pre-built or have empty placeholder
folders today.

- **Other planets** — sibling scenes under `scenes/` (e.g. `scenes/mars/`)
- **System view (Level 0)** — a scene that contains planets at greater distance
- **Place scenes (Level 2)** — venues or regions inside a planet
- **Street-view scenes** — first-person spatial scenes at deepest zoom
- **Vignettes** — post-hoc 3D reconstructions of live events (from the product roadmap)
- **3D UI features** — GL-rendered UI inside scenes (HUDs, in-world labels,
  spatial controls). Live in their scene's `elements/` directory.

Each one, when built, slots into `scenes/<name>/` with the same internal
structure as Earth: `EarthScene.tsx`/`scene.ts`/`elements/`/`environment/`/
`controls/`/`assets/`. Reuse across scenes is extracted into `canvas/stage/` on
proven second cases.

---

## 1. Design principles

WRLD has five design principles. Each one decides something — it rules out a
reasonable alternative someone could have chosen. If a principle ever stops doing
that, cut it or rewrite it. Aesthetics (specific colors, blur, overlays, parallax)
flow _from_ these principles and live in the token reference and component specs, not
here.

---

### 1. Spin to discover — never scroll

The globe is how you find what's live. It is the product's primary metaphor and its
discovery mechanism, not decoration and not one feature among many. Discovery in WRLD
is **spatial** — you explore a place to find what's happening in it. We refuse the
feed: there is no endless vertical scroll of thumbnails. The globe leads the discovery
mode, and every path through discovery returns to it.

_Rejects:_ the scroll-feed paradigm (a wall of stream previews); burying discovery
behind a search bar; treating the globe as a hero image rather than the working core.
This is our sharpest refusal — the feed is the single thing WRLD is most defined against.

> **Mode note:** "Spin to discover" governs the **discovery mode**. It hands off to
> Principle 3 in the **watching mode** — see below. The globe leads discovery; the
> stream leads watching. The two never compete for the same screen at the same time,
> except at the seam (the discovery→watching transition surface), which is exactly
> where they are meant to meet.

---

### 2. Calm interface, hot content

The interface is cool, controlled, and quiet. The live moment is the only thing
allowed to be electric. WRLD is about live music and the buzz of real events, but the
app expresses that by _framing_ the heat, not generating it — a desaturated,
structural UI with a single neon accent, where the stream and the active moment are
where the energy lives. This is deliberately the opposite of what a live-events app is
"supposed" to look like; the restraint is the point.

**Engagement signals are present but restrained.** WRLD has the social furniture a
discovery product needs — live-viewer counts, favourites, indicators of what's worth
attention — but they inform discovery, they never manufacture urgency. A viewer count
that helps you choose what to watch is honest work; a badge engineered to pull you back
into the app is not. The signals stay cool: information, not bait.

_Rejects:_ a busy, hyped, "everything is exciting" interface; chrome that competes with
content for energy; dopamine furniture weaponized for retention.

---

### 3. One thing in focus

At any moment, a single element is sharp, lit, and forward — the live action, the active
control, the place you can go next. Everything else desaturates, softens, and recedes.
The interface is a depth of field, not a flat surface. Contrast, blur, scale, and the
neon accent all serve this one job: making it unmistakable what matters right now. In
the watching mode this principle leads — the stream takes over the screen and the globe
recedes; you got there by discovering, and watching is its own full-attention mode.

_Rejects:_ flat layouts where everything has equal weight; multiple competing calls to
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

_Rejects:_ soft, friendly, bubbly UI; heavy rounding; mascot energy; the generic
"delightful consumer app" aesthetic that would make WRLD feel like an abstract content
feed rather than a window onto the real world. This is our second-sharpest refusal.

---

### 5. Motion shows where, not show-off

Motion is justified by what it communicates — depth, hierarchy, where you came from,
what's live right now. Subtle parallax establishes near and far. A live pulse signals an
active stream. Screen transitions tell you where you are in the space. If an animation is
only there to look slick, it is cut.

_Rejects:_ decorative animation; motion for delight alone; anything that moves without
telling the user something true about the interface.

---

### Application notes

These are not separate principles — they are how the five above resolve recurring
decisions. They exist so that token and component choices trace back to the principles.

**Density — "few things, generously sized."** Calm comes from _fewer_ elements, not
smaller ones and not emptier screens. Controls are large and tactile; they fill their
space rather than floating in it. Breathing room lives _between_ focal elements, not
inside them. We reject both failure modes: dense/compact UI (many small controls to save
taps) _and_ barren minimalism (one tiny element adrift in void). When in doubt, err
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
cool, premium" _right_ — not a compliance tax bolted on.

---

## 2. Token reference

Current state: [src/tokens/theme.ts](src/tokens/theme.ts) is a Phase 1 starter —
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

Canvas code does not consume semantic tokens as style props — it consumes
**resolved token values** (computed RGBA / hex for use in `DataTexture` and
shader uniforms). The bridge utility lives at `src/canvas/stage/tokens.ts`.
See 0.3.

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

| Category   | Status  | Source of truth        |
| ---------- | ------- | ---------------------- |
| Colors     | partial | will derive from mocks |
| Typography | partial | will derive from mocks |
| Spacing    | partial | will derive from mocks |
| Radius     | partial | will derive from mocks |
| Motion     | missing | will derive from mocks |
| Elevation  | missing | will derive from mocks |

Audit blocked on first asset drop (sub-phase 12.2). Once we have one or two
key screens (globe + stream view recommended), the populated `theme.ts` is
proposed for Ben's sign-off **before** writing a single primitive (sub-phase 12.3).

---

## 3. Component inventory

One entry per primitive (`src/components/primitives/`), feature
(`src/components/features/`), section (`src/components/sections/`), and screen
implementation (`src/components/screens/`). The "Used in" lists are the heart
of this doc — they tell you the blast radius of changing a node.

**Maintenance rule:** updating "Used in" lists is part of definition-of-done
for any component change.

Scene elements (`src/canvas/scenes/<name>/elements/`) are tracked in this
section too — under their scene's heading — because their blast radius and
token dependencies matter for the same reasons. They are _not_ React
components; their entries note that.

### Entry template

```markdown
### ComponentName

**Tier:** primitive | feature | section | screen | scene element
**Location:** `src/components/...` or `src/canvas/scenes/<name>/elements/...`
**Variants:** primary, secondary, ...
**Sizes:** sm, md, lg
**States:** default, pressed, disabled, loading

**Used in:**

- `src/components/screens/GlobeScreen.tsx` — primary (Join button), ghost (Dismiss)
- ...

**Tweak impact:** Changing primary variant affects N surfaces.
**Last reviewed:** YYYY-MM-DD
```

### Primitives (`src/components/primitives/`)

Currently shipped (Phase 1, pre-design-system, to be migrated in sub-phase 12.1):

- `Button.tsx` — to be redesigned in sub-phase 12.4
- `Input.tsx` — to be redesigned in sub-phase 12.4

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

### Features (`src/components/features/`)

Currently present (carried forward from pre-Phase-12 work; locations updated
to new structure during sub-phase 12.1):

- Stream-related: `NearbyStreamsDrawer`, `NearbyStreamThumbnail`, `NearbyStreamRow`
  (Phase 7/8)
- User-related: `Avatar`, `FollowButton`

Phase 12 candidates (compose primitives):

- `StreamCard` (refactor of NearbyStream\* into a unified primitive-composed card)
- `HandleBadge`
- `ChatBubble` (Phase 10 inline → extracted)
- `ReactionBurst` (Phase 10 inline → extracted)
- `DiscoveryHandoffCard` (the tap-to-preview card; **seam-as-feature today** — see 0.7)

Entries added as feature components are migrated.

### Sections (`src/components/sections/`)

Candidates from the existing screen list — to be confirmed during the
sub-phase 12.2 inventory pass against the mocks:

- `ProfileHeader` (header band for profile / venue / artist pages, if repeated)
- `StreamGrid` (live-streams region used by dashboard / discovery surfaces)
- `SettingsGroup` (settings page section pattern)

The Sections tier is justified only if regional patterns repeat across two or
more screens. If the inventory pass finds no genuine repetition, sections
above are downgraded to inline composition in the relevant screen.

### Scene elements

#### `src/canvas/scenes/earth/elements/`

- **`Globe.ts`** — the textured Earth sphere. Consumes the 8K texture from
  `src/canvas/scenes/earth/assets/textures/`. Reads resolved token values for
  any color tinting (currently none).

- **`Pin.ts`** — sprite-based stream pins on the globe. **Principle conflict
  flagged (carry-over from pre-Section-0 inventory):** today uses two
  saturated colors (`#5B8CFF` for clusters, `#FF3B5C` for singletons / `live`).
  This conflicts with Principle 2 (single neon accent is the only saturated
  element) and Principle 3 (one thing in focus). **Proposed resolution
  (pending Ben's sign-off in 12.2):** collapse to a single accent state,
  differentiate by _count_ not color. Carries over to inventory pass.

  Note this is a **scene element**, not a feature component. The previous
  `GlobePin` entry's waffle ("currently inline in globe.tsx — sprite-based,
  may stay so") is resolved by Section 0: it's not awkwardly-inline, it's
  correctly classified as a canvas-tier scene element.

### Screens (`src/components/screens/`)

See Section 4.

### Pre-captured findings (carry-over)

These were noted before Section 0 existed; they remain valid and are
re-anchored to the locked vocabulary:

1. **Globe pin two-color conflict** — see `Pin.ts` entry above.

2. **The discovery→watching transition surface** (the tap-to-preview card
   over the globe). This is the canonical example of the **seam** (0.3).
   Realized today as `DiscoveryHandoffCard.tsx` in features (0.7). It is
   **not** a violation of Principle 1's mode handoff — it _is_ the handoff,
   and the principle's mode note (Section 1) explicitly accommodates this.

---

## 4. Screen inventory

One entry per screen implementation (`src/components/screens/`). Routes
(thin shims in `app/`) are listed in the table for reference but do not get
their own entries. Lighter than Section 3 — purpose and which components
each screen composes.

### Entry template

```markdown
### GlobeScreen (`src/components/screens/GlobeScreen.tsx`)

**Route shim:** `app/globe.tsx`
**Purpose:** One-line description.
**Composes:** Button (primary, ghost), Card, StreamCard, EarthScene, ...
**Migrated to design system:** YYYY-MM-DD
```

### Current screens

Routes (`app/`) and their implementations (`src/components/screens/`).
"Migrated" indicates whether the screen has been rewritten against the new
primitives/features/sections in sub-phase 12.6.

| Route (shim)                     | Implementation                 | Purpose                                 | Migrated |
| -------------------------------- | ------------------------------ | --------------------------------------- | -------- |
| `app/index.tsx`                  | (auth-aware redirect, no impl) | Auth-aware redirect                     | n/a      |
| `app/onboarding.tsx`             | `OnboardingScreen.tsx`         | Handle picker, avatar (Phase 8)         | no       |
| `app/(auth)/login.tsx`           | `LoginScreen.tsx`              | Clerk sign-in                           | no       |
| `app/(auth)/signup.tsx`          | `SignupScreen.tsx`             | Clerk sign-up + verify                  | no       |
| `app/(app)/globe.tsx`            | `GlobeScreen.tsx`              | Globe (mounts `EarthScene`) + banners   | no       |
| `app/(app)/dashboard.tsx`        | `DashboardScreen.tsx`          | Source arming + Go Live                 | no       |
| `app/(app)/stream/[id].tsx`      | `StreamScreen.tsx`             | Broadcaster (id=new) / viewer (id=room) | no       |
| `app/(app)/me.tsx`               | `MeScreen.tsx`                 | Own profile / account settings          | no       |
| `app/(app)/profile/[handle].tsx` | `ProfileScreen.tsx`            | Public profile + follow                 | no       |
| `app/(app)/search.tsx`           | `SearchScreen.tsx`             | User search                             | no       |
| `app/(app)/settings.tsx`         | `SettingsScreen.tsx`           | Account + notifications                 | no       |

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

Motion at the seam (overlays appearing/transitioning over GL scenes) is
handled by the same patterns; the seam is not a separate motion category.

---

## 6. Decision log

Append-only. Most recent first. Each entry: date, decision, rationale,
constraint it imposes downstream.

### 2026-05-28 — System structure formalized (Section 0)

The system is two layers (classical + canvas) sharing tokens. The classical
layer has five tiers (Tokens → Primitives → Features → Sections → Screens)
with strictly downward dependencies and **no self-composition**. The canvas
layer is a sibling of the classical layer; scenes nest by _level_ (metadata,
not filesystem); scene elements are GPU-drawn (not React components); the
seam is a named concept for where the two layers visually meet.
**Rationale:** Goals (b), (c), and (d) from the Phase 12 framing — safe
cascade, easy global settings, no black box — all reduce to "every node has
a defined tier and the dependency rule is one-directional." **Imposes:**
every component and scene element is filed into exactly one tier; the
folder name equals the tier name (modulo the `app/` Expo Router carve-out);
blast radius of any change is computed by reading "Used in" lists upward.

### 2026-05-28 — Sections tier added

The classical layer adopts a fifth tier — **Sections** — sitting between
Features and Screens. **Rationale:** without it, "features composing
features" allows unbounded nesting depth, which breaks the safe-cascade
property. Sections cap the composition chain at five levels and give
regional screen patterns (`ProfileHeader`, `StreamGrid`) a defined home.
**Imposes:** no classical tier composes itself. Features compose only
primitives; sections compose features and primitives; screens compose
sections, features, and primitives. The rule for distinguishing features
from sections: features represent a _domain thing_ (a stream, a user, a
venue); sections represent a _region of a screen_.

### 2026-05-28 — Canvas tier defined with nested-by-level model

The canvas layer is a navigable space of GL scenes organized by zoom-depth
levels. Earth-with-pins is the one current scene (Level 1). Other planets,
in-planet experiences, vignettes, street views, in-scene 3D UI are all
**anticipated future scenes** — documented but not pre-built. Vocabulary:
_scene_, _level_, _scene element_, _seam_, _resolved token value_.
**Rationale:** the canvas tier already exists (the globe) and the product
roadmap names additional GL surfaces (vignettes). Defining the _vocabulary_
(not the engine) costs paragraphs and pays off immediately by resolving the
old `GlobePin` waffle and giving future R&D a coherent home. **Imposes:**
scene elements consume _resolved token values_ (computed RGBA), not tokens
as style props. The token-to-RGBA bridge lives at
`src/canvas/stage/tokens.ts`. No shared scene abstractions are extracted
until two real scenes prove the reuse.

### 2026-05-28 — Folder structure mirrors tier names

Each classical tier is a folder of the same name under `src/components/`:
`primitives/`, `features/`, `sections/`, `screens/`. Tokens are
`src/tokens/`. Canvas is `src/canvas/` (sibling to `src/components/`).
**Rationale:** the doc and the codebase should use the same words; "what
tier is X" becomes "which folder is X in." **Imposes:** the one stated
carve-out is `app/` — Expo Router requires file-based routes to live there.
Resolved via the shim pattern (next entry).

### 2026-05-28 — Screens use shim pattern (`app/` for routing, `src/components/screens/` for implementations)

The `app/` folder holds thin one-line shims that re-export screen
implementations from `src/components/screens/`. **Rationale:** lets the
Screens tier sit as a normal sibling under `components/` with every other
classical tier, eliminating the "Screens tier lives somewhere else" carve-out
from the system docs. **Imposes:** one-time migration cost during
sub-phase 12.1 — every existing screen moves to `src/components/screens/`
and a shim takes its place in `app/`. Going forward, new screens are two
files (implementation + shim) instead of one.

### 2026-05-28 — Seam realized as feature; dedicated folder deferred

`DiscoveryHandoffCard.tsx` (the tap-to-preview card over the globe) lives in
`src/components/features/` as a normal feature component. A dedicated
`src/canvas/seam/` folder is **not** created until a second seam component
exists. **Rationale:** the reuse rule (extract on second proven case)
applies to folder structure as well as code; one component does not earn a
folder tree. **Imposes:** when the second overlay arrives (info panel,
transition card, HUD), we revisit and decide whether they warrant
`canvas/seam/overlays/`.

### 2026-05-28 — Canvas reuse rule: extract on second proven case

Scene-specific code, environment, controls, and assets live inside the scene
folder. Things move to `src/canvas/stage/` only when a second real case
proves reuse. **Rationale:** premature shared abstractions guess the wrong
shape because only one concrete case exists to learn from. **Imposes:**
Earth's 8K texture lives in `src/canvas/scenes/earth/assets/textures/`,
not in a top-level `canvas/assets/`. `canvas/stage/` is minimal today —
just `tokens.ts` (the token-to-RGBA bridge, which is universal-from-day-one
because the token-consumption rule applies to all scenes).

### 2026-05-28 — Cross-scene canvas resources folder named `stage/`

Chosen over `shared/`, `global/`, `commons/`, `studio/`, and other
candidates. **Rationale:** the metaphor matches the function — scenes are
productions, the stage holds the cross-production resources (rigs, lighting,
textures, models, animations). Reads naturally as the folder grows
(`stage/textures/`, `stage/rigs/`, `stage/models/`). **Imposes:** no other
"shared canvas stuff" folder exists. Future stage subdirectories
(`models/`, `shaders/`, `fonts/`, etc.) are created on first real use,
not pre-built.

### 2026-05-28 — Phase 12 path broken into sub-phases 12.0–12.7

Distinct gated sub-phases with explicit dependencies between them. 12.0 is
this Section 0 work; 12.1 is the folder migration; 12.2 is asset drop and
inventory; 12.3 is `theme.ts` proposal and sign-off (also the green light
for Aaron's monetization UI work); 12.4 is primitives; 12.5 is features and
sections; 12.6 is screen migration; 12.7 is the motion pass. **Imposes:**
sub-phases run sequentially with the gate at each boundary; primitives are
not built until `theme.ts` is signed off; screens are not migrated until
primitives, features, and sections exist.

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
exports must be named identifiably (e.g. `stream-view-portrait.png`); files
are re-read rather than cached across sessions.

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

Lives at `src/components/screens/_dev/ComponentGallery.tsx`. Renders every
primitive variant × state combination for visual QA. Excluded from production
builds via dev-only flag (pattern TBD — confirm with Ben before wiring).
**Imposes:** new primitives MUST add a gallery entry before they're
considered shipped.

#### Inventory maintenance: manual (Option A)

Updating Section 3 "Used in" lists is part of definition-of-done for any
component change. **Imposes:** no scripted generation in v0.2. Revisit
if doc drifts.

#### Single design doc, not Storybook

This file. Storybook deferred to v0.3+ when team size justifies it.

---

## 7. Phase 12 sub-phase path

Sub-phases run sequentially with explicit gates between them. Each gate
requires Ben's sign-off (or the listed artifact's existence in `main`)
before the next sub-phase begins.

### 12.0 — Define the system _(this section)_

Author Section 0, renumber/update existing sections, append decision log,
create `src/canvas/README.md`, update `CLAUDE.md` to reference the locked
structure. **Pure documentation. No code changes.** Fully unblocked — no
asset drop required.
**Gate to 12.1:** Ben approves the updated `DESIGN.md`.

### 12.1 — Folder structure migration

Mechanical refactor against the Section 0 target structure. Move screens
from `app/` to `src/components/screens/` and create shims in `app/`;
rename component folders (`ui/` → `primitives/`, `feature/` → `features/`);
create `src/components/sections/`; extract canvas code from the current
globe screen into `src/canvas/scenes/earth/` (`EarthScene.tsx`, `scene.ts`,
`elements/`, `environment/`, `controls/`, `assets/`); create
`src/canvas/stage/tokens.ts`; rename `src/lib/theme.ts` to
`src/tokens/theme.ts`. No new functionality, no design changes — pure
restructuring.
**Gate to 12.2:** App builds and runs on iOS and Android with no behavioral
regressions.

### 12.2 — Asset drop and inventory pass

Ben drops Figma frames (and/or Claude-mock code) into
`wrld-app/docs/design/figma-exports/`. Three-way audit (mock / current code /
gap) for every distinct visual element. Populate Section 3 with one row per
primitive, feature, section, and scene element discovered. Surface
principle conflicts as a separate list for Ben's decision before any code
changes (carry-over: the globe pin two-color conflict is already on this
list — see Section 3).
**Gate to 12.3:** Ben approves the parts list and resolves the principle-
conflict list.

### 12.3 — Token audit and `theme.ts` proposal

Extract palette, typography, spacing, radii, motion, elevation from approved
mocks. Propose `src/tokens/theme.ts` (hybrid palette + semantic layers per
Section 2 constraints). **This sub-phase landing on `main` is also the
shared green-light for Aaron's monetization screens** — until then,
monetization work stays backend-only with placeholder UI. (See "Working
agreement with Aaron" below.)
**Gate to 12.4:** Ben signs off on `theme.ts`. Aaron's UI work unblocked.

### 12.4 — Build primitives, bottom-up

Build order: `Text`, `Pressable`, `Icon`, `Button`, `Card`, `Input`,
`Badge`, `Spacer`, `Divider`. Each primitive gets a `ComponentGallery`
entry and a Section 3 row. Ben reviews each on device before the next
primitive starts.
**Gate to 12.5:** All primitives shipped, gallery renders cleanly, Section 3
populated.

### 12.5 — Build features and sections

Compose primitives. Same gallery + Section 3 discipline. Features
represent domain things; sections represent screen regions. Sections are
only built if the 12.2 inventory pass surfaced genuine regional repetition.
**Gate to 12.6:** Features and sections shipped with Section 3 entries.

### 12.6 — Migrate screens, one per commit

Each existing screen rewritten to compose from new primitives/features/sections.
Commit message: `Phase 12: migrate <screen-name> to ui primitives`. Visual
diff against Figma frame. Update Section 4's "Migrated" column with each
migration. Recommend starting with globe and stream view (highest token
coverage).
**Gate to 12.7:** All screens migrated; mechanical criteria 1–3 met.

### 12.7 — Motion pass

Apply named motion patterns consistently across screens, primitives, and
the seam. Populate Section 5 with the four anticipated patterns
(`screen-transition`, `card-press`, `modal-entry`, `live-pulse`). Resist
animating everything.
**Phase 12 complete when:** all four mechanical criteria (top of this
document) are met, and Ben judges that the app "feels like the same
product."

### Working agreement with Aaron

Aaron is on a parallel branch working on monetization plumbing — backend-only
with placeholder UI. **Aaron's real monetization screens are blocked behind
sub-phase 12.3.** When `src/tokens/theme.ts` lands on `main`, Aaron is
green-lit to build real WRLD-styled UI by composing from primitives (once
12.4 also lands) or by composing directly from tokens for any UI that ships
before primitives are complete. Until 12.3 lands, monetization UI stays as
throwaway placeholder.

Periodic merge from `main` into Ben's `design` branch keeps the two streams
in sync; the two repos and folders touched are largely non-overlapping
(Aaron is in `wrld-backend`; Ben is in `wrld-app`), so conflicts should be
minimal. The one shared file is `CLAUDE.md` — whoever ships a phase updates
it. `DESIGN.md` is Ben's exclusive on the `design` branch.

---

## 8. Out of scope (v0.2)

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
- **Canvas tier abstractions.** No shared scene base class, no scene-graph
  engine, no multi-planet implementation, no zoom-transition system, no
  canvas-vs-router navigation resolution. All deferred until at least two
  real GL scenes exist to extract from.
- **Dedicated `src/canvas/seam/` folder.** Deferred until a second seam
  component justifies it (see 0.7).
- **Future scene-folder placeholders.** No `scenes/mars/`, `scenes/system/`,
  or other empty future-scene folders. Created when each is real.

---

## 9. Architectural guardrails

These constraints prevent override-spaghetti and primitives-as-black-boxes.
They are consequences of Section 0's dependency rule applied at the
day-to-day code level.

- **One-way imports (classical layer):** screens (`src/components/screens/`)
  import from sections, features, primitives, and tokens. Sections import
  from features, primitives, and tokens. Features import from primitives,
  domain types, and tokens. Primitives import only from tokens and React
  Native. Never the reverse, never sideways within a tier.
- **One-way imports (canvas layer):** scenes import from their own
  `elements/`, `environment/`, `controls/`, and `assets/`; from
  `src/canvas/stage/`; and from `src/tokens/` via resolved token values.
  Scene elements (`.ts` files) never import React components.
- **No tier composes itself.** Features do not nest in features. Sections do
  not nest in sections. Screens do not import other screens.
- **No hex literals or magic numbers in screens, sections, or features.**
  Every color, dimension, radius, font size comes from `theme.ts`.
- **Primitives must not be overridden via `style` props from upstream
  consumers.** If a screen needs a variant a primitive doesn't expose, that's
  a signal the primitive's variant set is incomplete — extend the primitive,
  don't override it.
- **Component count discipline:** 3–4 variants per primitive max. If a
  primitive grows beyond that, it's probably doing too much and should be
  split.
- **Canvas code consumes resolved token values, not tokens as style props.**
  A scene element loads `theme.colors.accent` _through_ the
  `src/canvas/stage/tokens.ts` bridge, which returns the RGBA/hex value
  appropriate for `DataTexture` or shader uniform consumption.
- **Dark-only.** See Section 8.

---

## How to add a primitive

1. Build in isolation, in `src/components/primitives/<Name>.tsx`.
2. Add a gallery entry in `src/components/screens/_dev/ComponentGallery.tsx`
   showing every variant × size × state combination.
3. Add a Section 3 entry to this doc with the entry template, "Used in"
   empty (it'll be filled as you migrate screens).
4. Ben reviews on device before the next primitive starts.

## How to add a feature

1. Build in `src/components/features/<Name>.tsx`.
2. Composes only from primitives and tokens. Never from other features.
3. Add a Section 3 entry. "Used in" populates as screens compose it.
4. If it has more than 3 internal compositions of features, consider whether
   it should be a section instead.

## How to add a section

1. Build in `src/components/sections/<Name>.tsx`.
2. Composes from features and primitives. Never from other sections.
3. Add a Section 3 entry.
4. Justify: which two-or-more screens use this section pattern? If only one,
   the pattern likely belongs inline in that screen.

## How to migrate a screen

1. One screen per commit. Commit message: `Phase 12: migrate <screen-name> to ui primitives`.
2. Implementation lives in `src/components/screens/<Name>Screen.tsx`. The
   route shim in `app/` is a one-line re-export.
3. Visual diff against the Figma frame for that screen before committing.
4. Update Section 4's "Migrated" column with the date.
5. Update every primitive/feature/section's "Used in" list in Section 3 to
   mention the screen.

## How to add a scene

1. Create `src/canvas/scenes/<name>/` with the standard internal structure:
   `<Name>Scene.tsx` (React mount), `scene.ts` (Three.js root), `elements/`,
   `environment/`, `controls/`, `assets/`, `index.ts`.
2. The scene declares its level as exported metadata in `scene.ts`:
   `export const LEVEL: number = 2;`
3. Scene elements (`.ts` files in `elements/`) consume resolved token values
   from `src/canvas/stage/tokens.ts`, never tokens as style props.
4. Add the scene to `src/canvas/README.md`'s current-inhabitants list.
5. Update Section 3 with scene-element entries under the scene's heading.
6. If anything in the new scene duplicates code from an existing scene, that
   is the trigger for extracting to `src/canvas/stage/` — but only if the
   duplication is genuinely the same implementation, not just the same idea.

## How to add a new semantic token

1. Justify it in Section 6 with a date entry.
2. Add to the semantic layer of `theme.ts`.
3. If introducing a new palette value, add that too (palette additions
   don't need decision-log entries, only semantic ones do).
4. Update Section 2's vocabulary table if you've added a category.
