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

Populated from the 12.2 inventory pass against the 16 mocks. Each entry
includes the three-way audit (mock says / code currently does / gap or
proposed resolution) that drove its inclusion. "Used in" lists populate
as screens migrate in sub-phase 12.6 — empty for now.

**Currently shipped** (Phase 1, migrated to `primitives/` in sub-phase 12.1a;
to be redesigned in 12.4): `Button.tsx`, `Input.tsx`.

**Build order** (later compose earlier — do not reorder without surfacing
it): Text → Icon → Pressable → Button + IconButton → Card → Input +
Textarea → HelpText → Pill + Chip → Avatar → Toggle → ProgressBar →
Spinner → BottomSheet → Slider → SegmentedToggle → Divider.

---

#### `Text`

- **Tier:** primitive
- **Location:** `src/components/primitives/Text.tsx`
- **Variants:** `display`, `heading`, `body`, `caption`, `mono-caption`, `mono-label`
- **Sizes:** baked into variants (no separate `size` prop)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** all text in the app — highest blast radius
- **Last reviewed:** 2026-05-29

**Mock says:** Two type families pair universally. **Inter Tight (sans)**
for content text in 4 weights × 4 size roles: large display (26–32px / 600),
heading (16–22px / 600), body (13–15px / 500), small caption (11–12px / 500).
**JetBrains Mono** for tracked-out caps labels (10–11px / 500 / letter-spacing
0.12–0.16em / UPPERCASE), value readouts, and timestamps. Tabular-numeric
variant for numeric values that need vertical alignment.

**Code does:** No `Text` primitive. RN `<Text>` with inline
`theme.typography.X` spread.

**Gap / proposal:** Extract `Text` primitive whose variant prop encodes the
type role; each variant pulls from semantic typography tokens (12.3). Raw
pixel values never appear in consumer code. The sans/mono pair is
system-wide; mono variants pre-set `letterSpacing` + `textTransform: 'uppercase'`
where appropriate.

---

#### `Icon`

- **Tier:** primitive
- **Location:** `src/components/primitives/Icon.tsx`
- **Variants:** `currentColor` (inherits from parent text color)
- **Sizes:** sm (10–12px), md (14–18px), lg (22–28px)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every icon in the app
- **Last reviewed:** 2026-05-29

**Mock says:** Linear monoline SVG icons (stroke-only, 1.6–1.8 stroke
width). Universal stroke-rounded line-cap and line-join. Icons always
inherit `currentColor` so they tint with the parent's text token. Common
sizes: 10–12px (badge / accent), 14–18px (button + control), 22–28px
(hero illustration like the permission-pre-prompt bell).

**Code does:** `@expo/vector-icons` (Feather + others) used inline with
explicit color values.

**Gap / proposal:** Wrap a curated icon set in an `Icon` primitive that
accepts `name` + `size` + (optional) `color` props. Default color is
`currentColor` (inheritance). Set TBD — the mock SVGs are bespoke, and
`@expo/vector-icons` Feather covers ~80% of them; gaps go in
`src/components/primitives/icons/` as one-off SVG components rendered by
the same wrapper. No raw `<Svg>` in consumer code.

---

#### `Pressable`

- **Tier:** primitive
- **Location:** `src/components/primitives/Pressable.tsx`
- **Variants:** `default`, `subtle` (smaller scale), `none` (no press feedback)
- **Sizes:** N/A (sizing is the consumer's responsibility)
- **States:** default, pressed
- **Used in:** populated in 12.6
- **Tweak impact:** every pressable surface in the app

**Mock says:** Universal press affordance is `transform: scale(0.94–0.98)`
on `:active`, with 180ms ease-out transition out. Larger surfaces use
0.98–0.99; smaller buttons use 0.94–0.96.

**Code does:** RN `Pressable` used directly with inline opacity changes.

**Gap / proposal:** Wrap RN `Pressable` with a consistent press-scale
animation driven by motion tokens (12.3). All higher-tier interactive
primitives (Button, IconButton, Chip, Card-as-pressable, etc.) compose
this one — never go through RN's raw Pressable.

---

#### `Button`

- **Tier:** primitive (composes Pressable + Text + Icon)
- **Location:** `src/components/primitives/Button.tsx`
- **Variants:** `primary`, `secondary`, `skip`, `social` (with `Apple` / `Google` / `Email` sub-variants)
- **Sizes:** `md` (h:44, content actions) and `lg` (h:54, primary CTAs)
- **States:** default, pressed, disabled, loading
- **Used in:** populated in 12.6
- **Tweak impact:** every CTA in the app

**Mock says:** **Primary** is accent fill with `#0a0c10` text, glow
box-shadow (`0 0 30px rgba(accent, 0.18)`), h:54 / r:20 for top-level CTAs,
h:48 / r:14 for sheet actions. **Secondary** is panel-hi surface with line
border, same dimensions, no glow. **Skip** is type-only, hairline-underline,
h:44, no fill. **Social** has brand-color background (Apple white-on-black
per HIG, Google/Email panel-hi). Disabled = opacity 0.32, no glow.
Optional leading-icon slot. Loading state replaces label with a Spinner of
matching color.

**Code does:** Existing `Button.tsx` has primary / secondary / ghost
variants + disabled prop. No skip, no social, no loading, no leading-icon
slot.

**Gap / proposal:** Extend Button to the 4 documented variant families
(primary / secondary / skip / social). Loading state added (inline spinner
replaces label). Leading-icon slot via optional `icon` prop. Glow is a
token-driven property on the primary variant — toggleable per surface via
the `glow` boolean if it ends up too noisy at scale (see principle-conflict
#6 in 12.2 calibration). Per principle ruling, button radius is `r:4` from
tokens regardless of what the mocks render (mocks use r:20).

---

#### `IconButton`

- **Tier:** primitive (composes Pressable + Icon)
- **Location:** `src/components/primitives/IconButton.tsx`
- **Variants:** `ghost` (transparent), `surface` (panel background), `accent` (filled)
- **Sizes:** sm (32×32), md (36×36 — default), lg (44×44), xl (48×48 — Viewer Sheet action bar)
- **States:** default, pressed, on, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** every icon-only button — back, close, kebab, save, share, settings, etc.

**Mock says:** Circular icon-only button used universally for top-bar
navigation (back, close, kebab), settings entry, action-bar items
(save/share heart on Viewer Sheet, with `on` state colored live red), and
sheet headers. Glass `backdrop-filter:blur(10–14px)` on transparent or
panel-tinted backgrounds. Hit target is at least 36×36 throughout.

**Code does:** None as a standalone primitive. Inline RN `Pressable` +
`<View>` wrappers in screens.

**Gap / proposal:** New primitive that composes Pressable + Icon with a
guaranteed circular hit target. The `on` state is opt-in via prop; tone
is consumer-driven (typically `accent` or `live`).

---

#### `Card`

- **Tier:** primitive
- **Location:** `src/components/primitives/Card.tsx`
- **Variants:** `panel` (semi-transparent + backdrop blur), `solid` (opaque panel-solid), `elevated` (panel-hi with stronger border), `accent` (accent-tinted glass)
- **Sizes:** N/A (sizing is consumer)
- **States:** default, pressed (if `pressable` prop set)
- **Used in:** populated in 12.6
- **Tweak impact:** every panel surface — stats card, filters card, passport card, wallet hero, alert banners, etc.

**Mock says:** Pervasive container pattern: rounded rectangle, thin line
border (1px `rgba(255,255,255,0.08)`), backdrop-blur for glass effect on
the `panel` variant. r:14–22 depending on size. Padded interior. Sometimes
pressable (acts as a hit target); often just decorative wrapping.

**Code does:** Inline `<View>` + `StyleSheet.create({ card: {...} })`
patterns scattered across screens — no shared primitive.

**Gap / proposal:** Extract Card primitive with the 4 variant families. Per
principle ruling, radius is r:4 from tokens (mocks render r:14–22; tokens
override). Glass blur is opt-in via the `panel` variant — `solid` and
`elevated` have no backdrop blur.

---

#### `Input`

- **Tier:** primitive
- **Location:** `src/components/primitives/Input.tsx`
- **Variants:** `default`, `prefix` (e.g. `@` for handle), `multiline` (delegates to Textarea — see below)
- **Sizes:** `md` (h:52, standard) and `lg` (h:60, hero like handle picker)
- **States:** default, focus, valid, error, loading, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** every form field in the app

**Mock says:** 5 documented states. **Default** placeholder visible.
**Focus** accent border + 4px accent glow + animated cursor. **Valid**
right-affordance check icon + accent-tinted border. **Error**
right-affordance X icon + live-tinted border + error helper underneath.
**Loading** right-affordance spinner + dim helper. Right-affordance slot
universally available. Pixel-font cursor blinks at 1s steps.

**Code does:** Existing `Input.tsx` supports default + focused. No valid /
error / loading affordance. No right-icon slot.

**Gap / proposal:** Extend to 5 states. Add right-affordance slot
(generic, accepts icon | spinner). Loading-in-input is the documented
pattern for all async validation (handle uniqueness, email check, etc.) —
never a screen-blocking spinner. HelpText (next entry) is a separate
primitive composed *below* the Input by the consumer.

---

#### `Textarea`

- **Tier:** primitive
- **Location:** `src/components/primitives/Textarea.tsx`
- **Variants:** `default`
- **Sizes:** `md` (min-height 96px, resize-vertical)
- **States:** default, focus, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** multi-line input surfaces (Report flow notes, future moderation tools, etc.)

**Mock says:** Multi-line variant of Input. Min-height 96px, resizable
vertical. Same border + focus + radius treatment as Input. No right
affordance (icons don't make sense in multi-line).

**Code does:** None.

**Gap / proposal:** Separate primitive (not an Input variant) because the
multi-line interaction model is distinct: no right-affordance slot,
different state set (loading isn't really a thing for textareas), and the
resize ergonomics matter. Shares its visual treatment with Input via
shared token consumption.

---

#### `HelpText`

- **Tier:** primitive
- **Location:** `src/components/primitives/HelpText.tsx`
- **Variants:** `dim`, `ok`, `err`, `warn`
- **Sizes:** uses `mono-caption` from Text primitive
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every form-field helper, validation message, instructional caption

**Mock says:** Small mono-caps caption rendered immediately under a form
field. Four tones: `dim` (ink-faint, neutral instruction like "3–20
CHARACTERS"), `ok` (accent, "EMAIL LOOKS GOOD"), `err` (live, "TOO SHORT
— 8 CHARACTERS MINIMUM"), `warn` (warn, "ADD A NUMBER OR SYMBOL").
Universal pattern: tone matches the Input's state on the same field.

**Code does:** None. Helper text inline as `<Text style={styles.help}>`.

**Gap / proposal:** Extract HelpText with 4 tone variants. Token-driven
colors. Pairs naturally with Input + Textarea.

---

#### `Pill`

- **Tier:** primitive
- **Location:** `src/components/primitives/Pill.tsx`
- **Variants:** `default` (line border, transparent), `live` (live fill), `accent` (accent fill), `jurisdiction` (accent-tinted bg + accent text), `count-badge` (small numeric overlay)
- **Sizes:** sm (h:22), md (h:28), lg (h:32)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** LIVE indicators, channel chips (CH 12), AcctID badge, follower-count badge, viewers chip, jurisdiction badges (EU · GDPR), recommended pill, anon pill, draft pill, peak count

**Mock says:** Display-only marker — never interactive. Compact rounded
shape (`r:5–8` mini, `r:999` pill). Wide use across mocks for status,
identity, metadata. The Live variant has an animated pulsing dot inside.
Some variants include a leading icon, some are pure text.

**Code does:** Inline `<View>` with various pill styles scattered across
screens — no primitive.

**Gap / proposal:** Pill is the canonical display-only marker. Optional
`leadingIcon` (defaults to no icon; LiveVariant supplies its own pulse).
Distinct from Chip (next entry) because Pill is never pressable. Token-
driven tones.

---

#### `Chip`

- **Tier:** primitive (composes Pressable + Text + optional Icon)
- **Location:** `src/components/primitives/Chip.tsx`
- **Variants:** `default` (filter), `accent-tinted` (pressed accent), `suggestion` (accent-tinted with suggestions semantic)
- **Sizes:** sm (h:28), md (h:30) — default, lg (h:36)
- **States:** default, pressed (selected), disabled
- **Used in:** populated in 12.6
- **Tweak impact:** every filter chip — Globe category chips, My Profile filter chips, Cash Out preset chips, handle suggestions, tag chips

**Mock says:** Pressable filter button. Pressed state = accent-tinted bg
+ accent border. Universal use for single-select filter rows (Globe
categories, date filters), multi-select toggles (My Profile layer
filters), and tag-style suggestions (handle picker).

**Code does:** None as a primitive.

**Gap / proposal:** Distinct from Pill because Chip is pressable and has
a pressed state with explicit visual feedback (border + bg change).
Composes Pressable + Text + optional leading-icon. Single-select vs
multi-select behavior is the consumer's responsibility (Chip itself
doesn't track group state).

---

#### `Avatar`

- **Tier:** primitive
- **Location:** `src/components/primitives/Avatar.tsx`
- **Variants:** `initials`, `image`, `live` (with live-ring indicator)
- **Sizes:** xs (24), sm (32), md (42), lg (72), xl (88)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every user avatar — chat, profile header, broadcaster row, suggestion rows

**Mock says:** Circle with either user-uploaded image or initials on a
generated gradient (orange/brown for default). Larger sizes have a 2px
inner border (`bg`) + 1px outer border (`line-2`) to set off against
backdrops. Some surfaces use a "live ring" variant — accent-tinted outer
ring with glow — to indicate the user is currently broadcasting.

**Code does:** `Avatar.tsx` exists in `src/components/features/user/`
(initials + image fallback already implemented). Needs promotion to
primitives tier — it's domain-blind (just "circular user representation").

**Gap / proposal:** Move from features → primitives. Add `live` variant
(token-driven ring). Generalize the gradient generation to be deterministic
from a seed (e.g. handle hash) so the same user gets the same fallback
gradient every time.

---

#### `Toggle`

- **Tier:** primitive
- **Location:** `src/components/primitives/Toggle.tsx`
- **Variants:** `default`
- **Sizes:** md (44×26) — single canonical size
- **States:** off, on, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** every binary switch — consent rows, layer toggles, settings notifications, Clip Edit per-layer toggles

**Mock says:** Animated track-and-thumb switch. Off = dark `#2a2e35`
track + ink thumb. On = accent track + white thumb, animated translate
(0 → +18px) with spring easing. Disabled = opacity 0.4.

**Code does:** RN `Switch` used directly in settings.

**Gap / proposal:** Wrap with custom Toggle primitive matching the mock
treatment (RN's default switch doesn't match). Spring easing comes from
motion tokens (12.3). Universal sizing.

---

#### `ProgressBar`

- **Tier:** primitive
- **Location:** `src/components/primitives/ProgressBar.tsx`
- **Variants:** `segmented` (n equal segments), `dots` (n centered dots — fallback for short flows)
- **Sizes:** md (3px height for bars, 6px for dots)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** wizard headers (Onboarding x 4 wizards), Report multi-step modal, future multi-step flows

**Mock says:** Top of every wizard step. Bar variant for ≤10 steps,
segmented and accent-filled-up-to-current. Dot variant for very short
(2–4 step) flows. Visual: thin 3px bar, line color for unfilled, accent
for filled, accent-line transition.

**Code does:** None.

**Gap / proposal:** Single ProgressBar primitive with both variants
(`mode` prop: `bars` | `dots`). Consumer passes `total` + `current`.

---

#### `Spinner`

- **Tier:** primitive
- **Location:** `src/components/primitives/Spinner.tsx`
- **Variants:** `default`
- **Sizes:** xs (12), sm (14), md (16), lg (20)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** input loading affordance, button loading state, full-screen loading, network-pending indicators

**Mock says:** Simple circular spinner — 2px stroke, accent-colored top
arc, line-colored bottom, 0.7s rotation. Inherits color via
`currentColor` so it tints with parent (e.g. Button loading uses
`#0a0c10` on accent fill).

**Code does:** RN `ActivityIndicator` used directly with `theme.colors.accent`.

**Gap / proposal:** Replace `ActivityIndicator` with the custom Spinner
primitive matching the mock's stroke treatment. The mock's spinner is
visually distinct from RN's default (which feels "iOS native"). Token-
driven color.

---

#### `BottomSheet`

- **Tier:** primitive
- **Location:** `src/components/primitives/BottomSheet.tsx`
- **Variants:** `peek` (mini, ~196–320px), `expanded` (calc(100% - safe-area)), `full` (full-height)
- **Sizes:** N/A (height is variant-driven)
- **States:** closed, peek, expanded, dismissing
- **Used in:** populated in 12.6
- **Tweak impact:** Globe trending sheet, Viewer Sheet, AuthModal, TipSheet, NearbyStreamsDrawer, Exit-intent sheet, Quality sheet, Report modal, Action sheet (kebab) — basically every modal surface

**Mock says:** Universal modal container pattern. Grabber handle
(48×5 pill at top), rounded top corners (r:18–26), optional scrim
behind, slide-up entry (translateY 100% → 0 with spring easing), swipe-
down dismiss. Backdrop blur on the sheet body for glass effect (panel
variant) or solid `panel-solid` bg. Header / body / footer scaffold.

**Code does:** `NearbyStreamsDrawer` in `features/stream/` is a bespoke
implementation. Other one-off sheet wrappers exist (AuthModal,
TipSheet). No shared primitive.

**Gap / proposal:** Extract BottomSheet primitive. Content is the
consumer's responsibility (slotted children). The primitive provides:
container + grabber + scrim + slide animation + dismiss gesture +
height-mode handling. Existing one-offs (NearbyStreamsDrawer, AuthModal,
TipSheet, Quality sheet, Action sheet) refactor to content-only callers.

---

#### `Slider`

- **Tier:** primitive
- **Location:** `src/components/primitives/Slider.tsx`
- **Variants:** `accent` (default), `live` (for cashout amount), `warn`
- **Sizes:** md (4px track, 20px thumb)
- **States:** default, pressed (thumb-drag)
- **Used in:** populated in 12.6
- **Tweak impact:** Cash Out amount selector, future quantity/range inputs

**Mock says:** Custom range input — thin track (4px), filled portion in
tone-color (accent / live), 20px thumb with 2px tone-colored border + white
fill + glow box-shadow. Min/max tick labels below in mono-caps. Snap-to-
integer step.

**Code does:** None (current `app/(app)/cashout.tsx` has its own
PanResponder-based slider — code reusable but not extracted).

**Gap / proposal:** Extract from existing Cashout slider into a primitive
with tone variants. PanResponder pattern carries forward (works on iOS +
Android). Snap-step is a consumer prop.

---

#### `SegmentedToggle`

- **Tier:** primitive (composes Pressable + Text)
- **Location:** `src/components/primitives/SegmentedToggle.tsx`
- **Variants:** `default` (pressed = ink fill), `accent` (pressed = accent fill — for ANON-tagged selection on My Profile)
- **Sizes:** md (h:30 — line-border, inside-padded pill row)
- **States:** default, pressed (selected segment)
- **Used in:** populated in 12.6
- **Tweak impact:** My Profile VIS filter (ALL / PUBLIC / ANON), future 2–4 option single-selects

**Mock says:** Multi-button row inside a single pill-shaped container.
Single-select semantics — pressing one segment unpresses the others.
Inside-padded 3px ring around the active segment. Mono-caps labels.
Distinct from Chip (Chip is independent buttons; SegmentedToggle is
mutually-exclusive group with shared container).

**Code does:** None.

**Gap / proposal:** New primitive accepting `options` (array of
`{value, label}`), `value` (currently-selected), and `onChange`. Inside-
padded animated indicator follows the selected option.

---

#### `Divider`

- **Tier:** primitive
- **Location:** `src/components/primitives/Divider.tsx`
- **Variants:** `subtle` (line color), `strong` (line-2 color), `dashed`
- **Sizes:** sm (1px) — single canonical size
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every horizontal line separator

**Mock says:** Universal horizontal hairline used to separate consent
rows, transaction rows, settings rows, action-sheet rows. Two weights
(`line` / `line-2`) plus a dashed variant for "row-actions" dividers in
Clip Edit.

**Code does:** Inline `<View style={{ height: 1, backgroundColor:
theme.colors.border }} />` patterns.

**Gap / proposal:** Tiny primitive — barely deserves its own file but
the tone variants justify the extraction. `Spacer` (flex-1 view) is
NOT extracted; consumers use raw `<View style={{ flex: 1 }} />`
inline because the abstraction value is too low.

---

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

#### `src/canvas/scenes/earth/` — scene elements (currently inlined)

After sub-phase 12.1b, the earth scene is one file (`EarthScene.tsx`) plus
its index re-export and the 8K texture. Per the reuse rule (DESIGN.md 0.5),
the within-scene splits (`elements/Globe.ts`, `elements/Pin.ts`, etc.)
weren't extracted with only one concrete case to learn from — extraction
happens on the second proven case (likely when a second scene lands in
v0.3). The scene-element entries below refer to logical pieces inside
`EarthScene.tsx`; the file path stays the same until extraction earns its
keep.

- **Globe (logical)** — the textured Earth sphere. Lives inside
  `EarthScene.tsx` as a `THREE.Mesh(SphereGeometry, MeshBasicMaterial)`
  using the 8K texture from
  `src/canvas/scenes/earth/assets/textures/earth-8k.jpg`. Currently uses
  `MeshBasicMaterial` (unlit) — no `environment/lighting.ts` exists or is
  needed yet. Reads no token-derived colors today.

- **Pin (logical)** — sprite-based stream pins on the globe. Lives inside
  `EarthScene.tsx` as `makePinTexture(count)` (the DataTexture builder
  with the pixel-font cluster-count rasteriser) plus the sprite pool
  refs and the per-frame scale loop. **Principle conflict flagged
  (carry-over from pre-Section-0 inventory):** today uses two saturated
  colors (`#5B8CFF` for clusters, `#FF3B5C` for singletons / `live`).
  This conflicts with Principle 2 (single neon accent is the only
  saturated element) and Principle 3 (one thing in focus). **Proposed
  resolution (pending Ben's sign-off in 12.2):** collapse to a single
  accent state, differentiate by _count_ not color, plus a subtle scale
  step. The resolution wires Pin into `src/canvas/stage/tokens.ts`
  (which exists as a stub specifically to host the consumer).

  Note this is a **scene element**, not a feature component. The earlier
  `GlobePin` waffle ("currently inline in globe.tsx — sprite-based, may
  stay so") is resolved by Section 0: it's correctly classified as a
  canvas-tier scene element, even though it's inlined in `EarthScene.tsx`
  for now rather than living in its own file.

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

### 2026-05-29 — v0.2 wallet model: Space Bucks + Star Dust, 30% transfer fee

The 12.2 inventory pass against the Wallet v2 / Top Up / Cash Out mocks
surfaced a dual-currency system. Settled as follows, superseding the
"Phase 13 Stardust, no real money" framing in CLAUDE.md.

**Currencies (v0.2):**
- **Space Bucks** — purchase / spend currency, $0.01 per unit
  (`SPACE_BUCKS_PER_DOLLAR = 100`, the existing Phase 13 constant stays).
- **Star Dust** — receive currency, also $0.01 per unit
  (`STAR_DUST_PER_DOLLAR = 100`).
- Both currencies have the same USD value per unit.

**Transfer model:**
- A tip of 100 Space Bucks → platform takes 30 Space Bucks worth as a
  fee → recipient receives 70 Star Dust.
- The 30% platform fee accrues as platform balance during v0.2 (no real
  money is actually moving — see below).

**Real-money interfaces — v0.2 = components built, behavior stubbed:**
- **Top Up (IAP)** UI ships from mocks. Real payment processor (Stripe /
  Apple IAP / Google Pay) is NOT wired in v0.2. Space Bucks remain
  admin-seeded.
- **Cash Out (ACH + KYC)** UI ships from mocks. Real bank payout is NOT
  wired in v0.2. Star Dust balance accrues with no payout path.
- **30% platform fee** is logical bookkeeping only — no actual money
  flows.

**Transaction kinds — v0.2 scope:**
- Tipping (existing Phase 13) — only active transaction kind in v0.2.
- Monthly subscriptions to creators — components built (TransactionRow
  variants visible in mocks), NOT functional in v0.2. v0.3.
- Pay-per-view (PPV) — same: components only, NOT functional in v0.2.
  v0.3.

**Rationale:** Aaron's monetization work continues in parallel. Per the
"build components anyway" rule, all wallet UI in the mocks lands in v0.2
even where the underlying real-money infrastructure is v0.3. The
naming reverts to existing Phase 13 names (Space Bucks / Star Dust)
rather than the mocks' Tokens / Diamonds — minimizes backend churn while
the mocks' visual treatment carries forward.

**Imposes:** CLAUDE.md's "No real-money payments" stays accurate for
v0.2 (still no real money moves). CLAUDE.md's Phase 13 entry needs
updating to reflect Star Dust as receive-side currency with 30% fee.
Aaron's working agreement note in CLAUDE.md needs updating to reflect
the new wallet shape. Section 3 inventory entries for wallet components
flag the v0.3 boundary (which TransactionRow variants are mock-only).

### 2026-05-29 — v0.2 sensor model: full 7-layer + anonymous broadcasts

The Go Live, Viewer Sheet, My Profile, and Clip Edit mocks consistently
show a 7-layer broadcaster model that expands `SourceType` significantly
beyond camera/audio.

**The 7 layers (v0.2):**
- **Camera** — already supported.
- **Audio** — already supported.
- **Screen share** — iPhone whole-screen capture.
- **Location** — GPS coords (already captured for globe placement, now
  exposed as a toggleable layer).
- **Gyro** — accelerometer + gyro at 60 Hz.
- **Compass** — heading (true north).
- **Profile (ID)** — the broadcaster identity layer. ID-off = anonymous
  broadcast.

**Anonymous broadcasts:** Turning ID off makes the broadcast private —
visible only to the broadcaster on their own profile (My Profile, with
the ANON visibility filter). Excluded from public Profile entirely.
This is a privacy feature in the ID layer; not a new sensor.

**Rationale:** The 5-layer model (CAM/AUD/LOC/ID/GYR) appears
canonically across My Profile (filter chips), Viewer Sheet (sensor
strip), and Clip Edit (post-edit layer toggle). Anon broadcasts are
inseparable from the ID layer. Adding 5/7 layers post-v0.2 means
restructuring the broadcaster data model twice. Better to land the
expanded model once.

**Imposes:** `SourceType = 'camera' | 'audio'` expands to a 7-element
enum (or string union) in shared types. Broadcaster wiring
(`useMediasoup`, Go Live arming UI, broadcast websocket payload, stream
metadata) expands to support the new layers. CLAUDE.md's "No broadcaster
sensor sources beyond audio/video" v0.2 non-goal is REMOVED. The v0.3
commitment to broadcaster sensors is also REMOVED (it's now v0.2). Anon
broadcast feature joins the v0.2 backlog.

### 2026-05-29 — v0.2 clips: full recording + editor + per-layer post-edit

The My Profile and Clip Edit mocks centre on "clips" — recorded
segments of streams that persist on profile grids. Resolved as full
v0.2 scope.

**v0.2 clip surface:**
- **Recording** — server-side capture of stream segments (likely HLS
  via a mediasoup sidecar). Storage, retrieval, expiry policy all
  v0.2 concerns.
- **Clip metadata** — duration, peak viewer count, venue, layer-set
  (which of the 7 layers were active during the recording).
- **ClipCard / ClipGrid** — profile components rendering real clip data.
  Anonymous clips visible only on My Profile, never on public Profile.
- **Clip Edit** — full editor: video preview with playback controls,
  timeline track with waveform, trim handles (active region + scrubber),
  per-layer toggle (post-recording you can turn off CAM / AUD / LOC /
  GYR / etc., or mark a layer "permanent cut"), tag editor, save state.

**Rationale:** Clips are central to the creator value loop the mocks
imply — broadcasts are no longer purely ephemeral. The components,
recording infrastructure, and editor all couple tightly; deferring
just the editor leaves a half-built clips feature in v0.2.

**Imposes:** CLAUDE.md's "No recording / replay / playback" v0.2
non-goal is REMOVED. CLAUDE.md's v0.3 "Recording / replay" commitment
is REMOVED (now v0.2). v0.3 "Time machine" remains separately scoped
(historical state of a stream, distinct from clips). Storage costs +
hosting infrastructure are real v0.2 concerns. Section 3 inventory
entries for ClipCard, Timeline, LayerPanel, and Clip Edit's
screen-specific composition all reflect v0.2 functional state.

### 2026-05-29 — Asset folder split: `mocks/` vs `references/`

The original "Figma asset transport" decision (2026-05-27, below) named one
folder — `docs/design/figma-exports/` — for "PNG/SVG exports from Figma."
That framing was too narrow: design inputs include mood-board imagery, type
specimens, color references, inspiration shots, and reference photography,
none of which are mock screen frames and none of which earn an audit row
in Section 3. **New layout:** `docs/design/mocks/` holds finished screen
frames that drive the 12.2 three-way inventory pass; `docs/design/references/`
holds everything else (mood-board, type, color, inspiration, photos).
**Rationale:** the inventory pass scans only `mocks/`, so the parts list
stays clean of unrelated reference imagery; `references/` is browseable
context that informs token/aesthetic decisions without polluting the audit
target. **Imposes:** mocks are named identifiably
(`globe-portrait.png`, `stream-view-portrait.png`); references can use
freer naming. Supersedes the location/scope clause of the 2026-05-27
entry; the file-drop + pasted-mock-code transport itself is unchanged.

### 2026-05-29 — Sub-phase 12.2 runs on a `design` branch

CLAUDE.md's working style says all commits go directly to `main`. 12.2 is
an explicit exception: the inventory pass iterates (Ben drops assets, I
audit, principle conflicts surface, Ben resolves, audit re-runs) and may
need force-pushes or rewrites mid-flight. Doing that on `main` would
pollute history for Aaron. **New rule for 12.2 only:** the inventory work
happens on Ben's `design` branch (tracked at `origin/design`). When the
parts list and conflict resolutions are signed off, `design` merges into
`main` as a single coherent step and the inventory work becomes shared
ground. **Imposes:** Aaron continues working off `main` and is unaffected
until the merge; `design` is Ben's exclusive editing surface for
DESIGN.md until 12.2 ships. The convention reverts after merge — 12.3+
go back to direct-to-main per the working style.

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

Ben drops finished screen frames (and/or Claude-mock code) into
`wrld-app/docs/design/mocks/`; mood-board, type, color, inspiration, and
reference photography go in `wrld-app/docs/design/references/`. The
inventory pass scans only `mocks/`. Three-way audit (mock / current code /
gap) for every distinct visual element in each mock. Populate Section 3
with one row per primitive, feature, section, and scene element
discovered. Surface principle conflicts as a separate list for Ben's
decision before any code changes (carry-over: the globe pin two-color
conflict is already on this list — see Section 3). 12.2 runs on the
`design` branch — see the 2026-05-29 decision-log entry for the why and
the merge rule.
**Gate to 12.3:** Ben approves the parts list and resolves the principle-
conflict list. The `design` branch then merges into `main` and the
inventory work becomes shared ground.

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
