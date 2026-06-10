# DESIGN.md — WRLD Design System

Living reference for the WRLD app's design system. Read alongside
[CLAUDE.md](CLAUDE.md). This doc is for both human collaborators (Ben, Aaron)
and any Claude instance working on visual / component code.

The four mechanical criteria for "Phase 12 done":

1. All screens use only colors from `theme.colors` (no hex literals in
   `src/components/screens/`). ✅ as of 2026-05-31 with **three documented
   exceptions** — `'rgba(0,0,0,...)'` for the GlobeScreen empty-card backdrop
   and the StreamScreen room-info overlay + paused banner. These are
   dark-glass surfaces that sit over the GL globe / live video where the
   cream palette doesn't apply; the gap closes when a `bg.darkGlass` token
   (or equivalent over-content tone) lands. Each call site flags the
   exception in a comment.
2. No `StyleSheet` in screens contains hardcoded font sizes or spacing values. ✅
3. Every primitive has a corresponding entry in Section 3 with current "Used in" sites. ✅
4. Dev galleries (`src/components/screens/_dev/PrimitiveGallery.tsx`,
   `FeatureGallery.tsx`, `SectionGallery.tsx` — split into three pages
   2026-05-30 as tier counts grew past comfortable single-page scroll)
   render without errors and cover every primitive / feature / section
   variant (default, pressed, disabled, loading where applicable). ✅

The "feels like the same product" judgment is the _outcome_ of hitting those
four — not a separate criterion.

**Phase 12 status (2026-06-01):** sub-phases 12.0–12.7 ✅ done. 12.5/12.6
merged to `main` at `f18bd48` (2026-05-31); 12.7 motion pass on `design`
and pending merge.

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

| Category   | Status   | Source of truth                                                |
| ---------- | -------- | -------------------------------------------------------------- |
| Colors     | ✅ shipped | `src/tokens/theme.ts` populated in sub-phase 12.3 (2026-05-29) |
| Typography | ✅ shipped | Inter Tight + JetBrains Mono pair; 9 named roles                |
| Spacing    | ✅ shipped | 4-grid scale: xxs/xs/sm/md/lg/xl/xxl/xxxl                       |
| Radius     | ✅ shipped | Strict r:4 (`radius.md`) per principle ruling + `radius.full`   |
| Motion     | ✅ shipped | timing (5 levels) + easing (3) + press (3 scales)               |
| Elevation  | ✅ shipped | card / panel / sheet + opt-in glow (accent + live)              |

The populated theme ships per the locked decisions in Section 6
(2026-05-29 entries: radius / glow / warn / two-accents). Consumers
import only `theme.*` — the palette layer is internal to `theme.ts`.

### Font loading (12.4 pre-flight)

The typography tokens reference Google Fonts family names
(`InterTight_500Medium`, `InterTight_600SemiBold`, `IBMPlexMono_500Medium`).
Before primitives can render text correctly in 12.4, the fonts need to
be loaded via `expo-font`:

```bash
npx expo install @expo-google-fonts/inter-tight @expo-google-fonts/ibm-plex-mono expo-font
```

Then in `_layout.tsx` or a root font-loading boundary:

```tsx
import { useFonts, InterTight_500Medium, InterTight_600SemiBold } from '@expo-google-fonts/inter-tight'
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono'

const [fontsLoaded] = useFonts({
  InterTight_500Medium,
  InterTight_600SemiBold,
  IBMPlexMono_500Medium,
})
if (!fontsLoaded) return null  // splash
```

This is a 12.4 pre-flight task — primitives won't render typography
correctly without it. **IBM Plex Mono** was chosen over JetBrains Mono
because it reads as "engineering document / architectural drawing"
rather than "code editor" — aligns with the references' technical-
drawing aesthetic.

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
Spinner → BottomSheet → Slider → SegmentedToggle → Divider → BrandMark.

---

#### `Text`

- **Tier:** primitive
- **Location:** `src/components/primitives/Text.tsx`
- **Variants:** `display`, `heading`, `body`, `bodyEmphasized`, `caption`, `monoLabel`, `monoCaption`, `monoValue`
- **Sizes:** baked into variants (no separate `size` prop)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** all text in the app — highest blast radius
- **Shipped:** 2026-05-29 (sub-phase 12.4 — first primitive)
- **Last reviewed:** 2026-05-29

**Mock says:** Two type families pair universally. **Inter Tight (sans)**
for content text across display (28/32 · 600), heading (20/24 · 600),
body (14/20 · 500), bodyEmphasized (14/20 · 600), caption (11/16 · 500).
**IBM Plex Mono** for monoLabel (10/14 · 500 · letter-spacing 1.6 ·
UPPERCASE), monoCaption (11/16 · 500 · letter-spacing 0.4), and monoValue
(11/16 · 500 · letter-spacing 0.4 · `fontVariant: ['tabular-nums']`)
for numeric values that need vertical alignment.

**Code does (shipped):** `variant` prop indexes `theme.typography.*` keys
1:1; raw pixel values never appear in consumer code. Default color =
`theme.colors.text.primary`; override via the `color` prop or
`style.color`. All other RN `<Text>` props (`numberOfLines`, `onPress`,
accessibility, etc.) pass through. Inline `theme.typography.X` spreads
in pre-12.4 screens stay as-is until those screens migrate in 12.6.

**Gap / proposal:** None — shipped.

---

#### `Icon`

- **Tier:** primitive
- **Location:** `src/components/primitives/Icon.tsx`
- **Variants:** Feather glyph set (~280 monoline icons)
- **Sizes:** sm (12px), md (16px, default), lg (24px); raw number accepted for fine control
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every icon in the app
- **Shipped:** 2026-05-29 (sub-phase 12.4 — second primitive)
- **Last reviewed:** 2026-05-29

**Mock says:** Linear monoline SVG icons (stroke-only, ~1.6–1.8 stroke
width). Universal stroke-rounded line-cap and line-join. Common sizes:
10–12px (badge / accent), 14–18px (button + control), 22–28px (hero
illustration like the permission-pre-prompt bell). Icons inherit the
parent's text color so they tint with their surrounding context.

**Code does (shipped):** Wraps `Feather` from `@expo/vector-icons`
(installed 2026-05-29 via `npx expo install`). API: `name` (Feather
glyph key) + `size` (`'sm' | 'md' | 'lg' | number`, default `'md'`) +
`color` (default `theme.colors.text.primary`) + `accessibilityLabel`.
Numeric sizes are accepted but should be rare — reach for sm/md/lg
first. Pre-12.4 screens using `@expo/vector-icons` directly stay as-is
until they migrate in 12.6.

**Gap / proposal:** Bespoke icons not in Feather (the brand mark, gyro
grid, etc.) will land in `src/components/primitives/icons/` as one-off
SVG components and slot into this same wrapper via a type-union on
`name`. **Reuse rule (Section 0.5):** the folder + type-union exist only
when the first bespoke icon ships. `BrandMark` is already its own
primitive (drawn-with-Views) and is NOT routed through `Icon`.

---

#### `Pressable`

- **Tier:** primitive
- **Location:** `src/components/primitives/Pressable.tsx`
- **Variants:** `default` (scale 0.96 — buttons, chips), `subtle` (scale 0.98 — cards, rows, larger surfaces), `none` (no scale feedback — for surfaces with their own press response)
- **Sizes:** N/A (sizing is the consumer's responsibility)
- **States:** default, pressed, disabled (opacity 0.5)
- **Used in:** populated in 12.6
- **Tweak impact:** every pressable surface in the app
- **Shipped:** 2026-05-30 (sub-phase 12.4 — third primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Universal press affordance is `transform: scale(0.94–0.98)`
on `:active`, with 180ms ease-out transition out. Larger surfaces use
0.98–0.99; smaller buttons use 0.94–0.96.

**Code does (shipped):** Wraps RN `Pressable`. Press feedback is an
`Animated.timing` on a scale transform — duration =
`motion.timing.fast` (180ms), easing = `Easing.out(Easing.quad)`. Scale
magnitude comes from `motion.press.scaleMid` / `scaleLarge` per variant.
`none` variant skips the animation entirely. `disabled` halves opacity
on the animated view and forwards to the underlying Pressable so taps
don't fire. API accepts `onPress`, `onPressIn`, `onPressOut`,
`onLongPress`, `hitSlop`, `accessibility*`, `testID`, `style`,
`children`. Higher-tier primitives (Button, IconButton, Chip, Card-as-
pressable) **must** compose this — never reach for RN's raw `Pressable`
once they migrate in 12.6.

**Gap / proposal:** None — shipped.

---

#### `Button`

- **Tier:** primitive (composes Pressable + Text + Icon)
- **Location:** `src/components/primitives/Button.tsx`
- **Variants:** `primary`, `secondary`, `skip`, `social` (with `apple` / `google` / `email` sub-variants via the `social` prop)
- **Sizes:** `md` (h:44, content actions) and `lg` (h:54, primary CTAs)
- **States:** default, pressed, disabled, loading
- **Used in:** populated in 12.6
- **Tweak impact:** every CTA in the app
- **Shipped:** 2026-05-30 (sub-phase 12.4 — fourth primitive; redesign of the Phase 1 placeholder)
- **Last reviewed:** 2026-05-30

**Mock says:** **Primary** is accent fill with cream label, optional glow
box-shadow, h:54 for top-level CTAs / h:48 for sheet actions. **Secondary**
is panel-hi surface with line border, no glow. **Skip** is type-only,
hairline-underline, h:44, no fill. **Social** has brand-color background
(Apple cream-on-ink per HIG-flipped-for-light, Google/Email panel-hi).
Disabled = opacity 0.32, no glow. Optional leading-icon slot. Loading
state replaces label with a Spinner of matching color.

**Code does (shipped):** Composes `Pressable` (variant `default` for the
filled buttons, `none` for `skip`), `Text` (`bodyEmphasized` for filled,
`body` with underline for `skip`), and `Icon` (md size for the optional
leading slot). Heights h:44 (md) / h:54 (lg). **Radius locked at
`radius.md` (r:4)** regardless of what the mocks render (mocks use
r:14–20). `glow` is an opt-in boolean on `primary` — applies
`elevation.glow.accent` shadow only when set so we don't auto-glow every
CTA in the app. Loading state replaces the label with an
`ActivityIndicator` tinted to the label color (will swap to the `Spinner`
primitive when it lands later in 12.4).

The Phase 1 `Button.tsx` had `primary | secondary | danger` variants;
`danger` is removed — the locked single-accent rule has `primary`
covering destructive too. Two existing callers (SettingsScreen sign-out
+ StreamScreen leave) migrated to `primary` in this commit.

**Gap / proposal:** None — shipped. ✓ `Spinner` swap landed 2026-05-30.

---

#### `IconButton`

- **Tier:** primitive (composes Pressable + Icon)
- **Location:** `src/components/primitives/IconButton.tsx`
- **Variants:** `ghost` (transparent), `surface` (panel background), `accent` (filled)
- **Sizes:** sm (32×32 / icon 14), md (36×36 / icon 16 — default), lg (44×44 / icon 20), xl (48×48 / icon 22 — action bars)
- **States:** default, pressed, on, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** every icon-only button — back, close, kebab, save, share, settings, etc.
- **Shipped:** 2026-05-30 (sub-phase 12.4 — fifth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Circular icon-only button used universally for top-bar
navigation (back, close, kebab), settings entry, action-bar items
(save / share / heart with `on` state colored), and sheet headers. Hit
target is at least 32×32 throughout.

**Code does (shipped):** Composes `Pressable` (always `default` variant
press feedback) + `Icon`. Border-radius = `dim / 2` so it stays a
perfect circle at any size. The `on` state overrides the variant's
surface treatment with `accent.surface` + `accent.border` + accent icon
color — used by reactions, save, heart. Glass blur from the mocks is NOT
the default (per the flat-surfaces locked ruling); a consumer can wrap
the IconButton in a glassy parent if needed. Icon size scales
proportionally with hit target — roughly 40–50% of the button dimension.
Mandatory `accessibilityLabel` since the button is icon-only.

**Gap / proposal:** None — shipped.

---

#### `Card`

- **Tier:** primitive
- **Location:** `src/components/primitives/Card.tsx`
- **Variants:** `panel` (bg.panel + subtle border — default), `solid` (bg.elevated + subtle border — lightest), `elevated` (bg.panelHi + strong border — strongest contrast), `accent` (accent.surface + accent.border)
- **Sizes:** N/A (sizing is consumer)
- **States:** default, pressed (if `pressable` prop set)
- **Used in:** populated in 12.6
- **Tweak impact:** every panel surface — stats card, filters card, passport card, wallet hero, alert banners, etc.
- **Shipped:** 2026-05-30 (sub-phase 12.4 — sixth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Pervasive container pattern: rounded rectangle, thin line
border, backdrop-blur for glass effect over the globe. r:14–22 in mocks,
padded interior. Sometimes pressable; often just decorative wrapping.

**Code does (shipped):** Four flat-surface variants, 1px border,
`radius.md` (r:4 — tokens win over the mocks' r:14–22 per the locked
principle ruling), `padding: spacing.lg` (16) by default. The
`pressable` prop wraps the contents in `Pressable` (subtle variant —
scale 0.98, appropriate for larger surfaces). Otherwise renders a plain
`View`. **Glass blur is NOT shipped in v0.2** — per the 12.3 locked
ruling, flat surfaces with hairline borders are the default panel
treatment. An over-globe glass opt-in lands later once `expo-blur` is
wired up.

**Gap / proposal:** None for v0.2. Glass blur is a v0.3 opt-in (via a
`blur` boolean prop or a separate variant) once `expo-blur` is added.

---

#### `Input`

- **Tier:** primitive
- **Location:** `src/components/primitives/Input.tsx`
- **Variants:** `default`, `prefix` (e.g. `@` for handle)
- **Sizes:** `md` (h:52, standard) and `lg` (h:60, hero like handle picker)
- **States:** default, focus (auto-tracked), valid, error, loading, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** every form field in the app
- **Shipped:** 2026-05-30 (sub-phase 12.4 — seventh primitive; redesign of the Phase 1 placeholder)
- **Last reviewed:** 2026-05-30

**Mock says:** 5 documented states. **Default** placeholder visible.
**Focus** accent border + accent glow. **Valid** right-affordance check
icon + accent border. **Error** right-affordance X icon + accent border
(single-accent rule: error distinguishes by icon, not by a separate
color). **Loading** right-affordance spinner — for async validation
(handle uniqueness, email check), never a screen-blocking modal.

**Code does (shipped):** Extends RN `TextInputProps` so every native prop
(value, onChangeText, keyboardType, autoCapitalize, secureTextEntry,
autoComplete, …) keeps working unchanged for existing callers. `state`
prop drives the border color + right-affordance slot. Focus state is
tracked internally via the native focus/blur events. `prefix` prop
+ `variant='prefix'` renders an inline leading token (e.g. `@`).
`rightAffordance` prop overrides the state-derived affordance. `style`
applies to the outer wrapper (layout/positioning); the inner TextInput
draws from theme typography directly.

**`leading` slot added 2026-06-05.** An optional `leading?: ReactNode` rendered
inside the field before the text — the symmetric counterpart to the right
affordance. This is what lets `SearchBar` compose `Input` (leading = 🔍, right
= clear-X) instead of re-implementing the field, so the search box and the
"What's happening" title field now share one look. See the decision-log entry
"Search ↔ title field harmonised; shared ScreenHeader".

**Focus-driven shadow removed 2026-05-30** (see decision-log entry
"CALayer reconfiguration on focus-driven shadows"). The original spec
called for `theme.elevation.glow.accent` to appear on focus (and on
`valid`/`error`/`loading` states). Adding shadow properties to a
`UIView` on iOS triggers a CALayer reconfiguration whose bounds
recalculation is interpreted by UIKit as a "focused field moved" signal
mid-keyboard-animation — iOS cancels keyboard appearance partway and
the field blurs. Visual indication on focus is now the accent
**border color** alone (cheap property update, no layer recalc).
**Future Claude / collaborator must NOT re-add a state-conditional
shadow to this primitive's wrapper style array.**

Phase 1 callers continue to work: they pass plain TextInputProps and
get the new visual treatment. Caller-side custom border / bg styling
(AuthModal) will sit over the new wrapper until those screens migrate
in 12.6.

**Gap / proposal:** None — shipped. ✓ `Spinner` swap landed 2026-05-30.

---

#### `Textarea`

- **Tier:** primitive
- **Location:** `src/components/primitives/Textarea.tsx`
- **Variants:** `default`
- **Sizes:** `md` (min-height 96px)
- **States:** default, focus (auto-tracked), disabled
- **Used in:** populated in 12.6
- **Tweak impact:** multi-line input surfaces (Report flow notes, future moderation tools, etc.)
- **Shipped:** 2026-05-30 (sub-phase 12.4 — eighth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Multi-line variant of Input. Min-height 96px. Same
border + focus + radius treatment as Input. No right affordance (icons
don't make sense inline with multi-line content).

**Code does (shipped):** Separate primitive (not an Input variant)
because the multi-line interaction model is distinct: no right
affordance slot, no loading state, no prefix. Min-height 96. Focus
state is auto-tracked; accent border on focus matches Input. Shares
visual treatment via the same token consumption. Vertical resize is
delegated to the consumer (pass `style={{ height }}` or similar).

**Focus-driven shadow removed 2026-05-30 — same fix as `Input`**
(see decision-log entry "CALayer reconfiguration on focus-driven
shadows" and the `Input` Section 3 entry for the full rationale).

**Gap / proposal:** None — shipped.

---

#### `HelpText`

- **Tier:** primitive (composes `Text`)
- **Location:** `src/components/primitives/HelpText.tsx`
- **Tones:** `dim` (default), `ok`, `err`, `warn`
- **Sizes:** uses `monoLabel` from the Text primitive (10/14, IBM Plex Mono 500, letter-spacing 1.6, UPPERCASE)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every form-field helper, validation message, instructional caption
- **Shipped:** 2026-05-30 (sub-phase 12.4 — ninth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Small mono-caps caption rendered immediately under a form
field. Four tones: `dim` (ink-faint, neutral instruction like "3–20
CHARACTERS"), `ok` (accent, "EMAIL LOOKS GOOD"), `err` (live, "TOO SHORT
— 8 CHARACTERS MINIMUM"), `warn` (warn, "ADD A NUMBER OR SYMBOL").

**Code does (shipped):** Thin wrapper around `<Text variant="monoLabel">`
that picks the color from the `tone` prop. Color map:

| Tone | Token |
|---|---|
| `dim` | `text.subtle` |
| `ok` | `accent.default` |
| `err` | `accent.default` |
| `warn` | `warn` |

**Single-accent rule applied:** `ok` and `err` render with the same
color. Differentiation is the *content* and the paired Input's
affordance icon (check vs x), not a separate red/green pair. `warn` is
the only non-accent tone (amber, used sparingly — PasswordStrengthMeter
mid-tier, LegalAcceptanceCard CCPA jurisdiction badge).

Pairs naturally with Input + Textarea — consumer composes inline (e.g.
`<View style={{ gap: spacing.xs }}><Input state="error" /><HelpText
tone="err">…</HelpText></View>`). Not built into Input itself.

**Gap / proposal:** None — shipped.

---

#### `Pill`

- **Tier:** primitive
- **Location:** `src/components/primitives/Pill.tsx`
- **Variants:** `default` (transparent + line border), `live` (accent fill), `accent` (accent fill), `jurisdiction` (accent.surface + accent.border + accent.default label), `countBadge` (small numeric badge — ignores `size` prop)
- **Sizes:** sm (h:22), md (h:28), lg (h:32). `countBadge` is its own 18px size.
- **States:** default (never interactive — use `Chip` for pressable surfaces)
- **Used in:** populated in 12.6
- **Tweak impact:** LIVE indicators, channel chips (CH 12), AcctID badge, follower-count badge, viewers chip, jurisdiction badges (EU · GDPR), recommended pill, anon pill, draft pill, peak count
- **Shipped:** 2026-05-30 (sub-phase 12.4 — tenth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Display-only marker — never interactive. Compact rounded
shape. Wide use across mocks for status, identity, metadata. The Live
variant has an animated pulsing dot inside (added by the `LivePill`
feature, which composes Pill.live + the dot). Some variants include a
leading icon.

**Code does (shipped):** Composes `Text variant="monoLabel"` + optional
`Icon size="sm"`. Border-radius `radius.full`. Single-accent rule:
`live` and `accent` are visually identical — both render with
`accent.default` fill + cream label. The semantic split is preserved
so `LivePill` (feature) can reference `variant="live"` even though
under the locked tokens it equals `accent`. `countBadge` is its own
mode: 18×18 minimum (grows for multi-digit), ignores `size`, accent
fill, used for notification dots and unread counts. `jurisdiction`
uses `accent.surface` + `accent.border` + `accent.default` label —
the only variant that doesn't invert the label to cream.

**Leading slot extension (2026-05-30, alongside LivePill ship):**
added a generic `leading?: ReactNode` prop that takes precedence over
the existing `leadingIcon` prop. `LivePill` uses it to pass an
`Animated.View` (pulsing dot) where an `Icon` glyph would otherwise
live. The `leadingIcon` shortcut stays for Feather-icon callers.

**Gap / proposal:** None — shipped. The animated pulsing dot is the
`LivePill` feature's job, not Pill's.

---

#### `Chip`

- **Tier:** primitive (composes Pressable + Text + optional Icon)
- **Location:** `src/components/primitives/Chip.tsx`
- **Variants:** `default` (neutral filter), `suggestion` (subtle accent tint by default)
- **Sizes:** sm (h:28), md (h:30 — default), lg (h:36)
- **States:** default, selected, disabled (pressed scale comes from Pressable)
- **Used in:** populated in 12.6
- **Tweak impact:** every filter chip — Globe category chips, My Profile filter chips, Cash Out preset chips, handle suggestions, tag chips
- **Shipped:** 2026-05-30 (sub-phase 12.4 — eleventh primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Pressable filter button. Selected state = accent-tinted
bg + accent border + accent label. Universal use for single-select
filter rows (Globe categories), multi-select toggles (sensor layer
filters), and tag-style suggestions (handle picker).

**Code does (shipped):** Composes `Pressable variant="default"` (scale
0.96) + `Text variant="bodyEmphasized"` + optional `Icon size="sm"`.
The `selected` prop overrides the variant's resting surface with
`accent.surface` + `accent.border` + `accent.default` label. The
`accessibilityState.selected` flag is set so screen readers announce
the selection. Single-select vs multi-select is the consumer's job —
Chip itself doesn't track group state.

**Gap / proposal:** None — shipped. The spec's third variant
(`accent-tinted`) collapsed into the `selected` state: it's the same
visual treatment, and decoupling state from variant matches how the
filter rows actually work in the mocks.

---

#### `Avatar`

- **Tier:** primitive
- **Location:** `src/components/primitives/Avatar.tsx`
- **Variants:** inferred from props — `image` (when `avatarUrl` set), `initials` (fallback), plus `live` boolean adds an accent ring + glow around either
- **Sizes:** xs (24), sm (32), md (42 — default), lg (72), xl (88); raw number accepted for one-off cases
- **States:** default
- **Used in:** Phase 8 callers (MeScreen, OnboardingScreen, SearchScreen, ProfileScreen, StreamScreen, CreatorOnboardingScreen, GlobeScreen) — imports migrated in this commit
- **Tweak impact:** every user avatar — chat, profile header, broadcaster row, suggestion rows
- **Shipped:** 2026-05-30 (sub-phase 12.4 — twelfth primitive; promoted from `features/user/`)
- **Last reviewed:** 2026-05-30

**Mock says:** Circle with either user-uploaded image or initials on a
generated gradient (orange/brown for default). Larger sizes have a thin
border ring to set off against backdrops. Some surfaces use a "live
ring" variant — accent-tinted outer ring with glow — to indicate the
user is currently broadcasting.

**Code does (shipped):** Composes `Image` for the image variant and
`View` + `Text` for the initials fallback. Initials derived from the
first letters of up to two displayName words (`'Ben Wylie'` → `'BW'`,
empty/whitespace → `'?'`). `px >= 42` adds a hairline border for
larger surfaces. The `live` prop wraps either variant in an outer
`View` with `accent.default` border + `elevation.glow.accent`,
preserving the inner avatar's intrinsic size.

**Gradient deferred:** the mock's "generated gradient (orange/brown)"
was specced before the 2026-05-29 light-pivot locked the single warm-
crimson accent. Multi-color gradients per user would violate the
single-accent rule. Initials use a solid `text.primary` warm-ink
background with cream initials; per-user differentiation is the
*initials themselves*. Revisits in v0.3 if the friends-and-family group
actively misses it.

The seven Phase 8 callers migrated from
`@/components/features/user/Avatar` → `@/components/primitives/Avatar`
in this commit. Existing numeric size calls (38, 44, 88) keep working
via the `size: Size | number` API. The old feature file was deleted.

**Gap / proposal:** None — shipped.

---

#### `Toggle`

- **Tier:** primitive (composes Pressable + Animated)
- **Location:** `src/components/primitives/Toggle.tsx`
- **Variants:** `default`
- **Sizes:** single canonical size (track 44 × 26, thumb 22 × 22, padding 2)
- **States:** off, **armed** (cued on-position — added 2026-06-03), on, disabled (opacity 0.4)
- **Used in:** `SettingsScreen` (notification preferences); `FeedRow` Air/Rec affordances (armed state — 2026-06-03)
- **Tweak impact:** every binary switch — consent rows, layer toggles, settings notifications, Clip Edit per-layer toggles, capture Air/Rec
- **Shipped:** 2026-05-30 (sub-phase 12.4 — thirteenth primitive). **`armed` state added 2026-06-03** (clips capture model).
- **Last reviewed:** 2026-06-03

**Mock says:** Animated track-and-thumb switch. Off = dark track + ink
thumb. On = accent track + cream thumb, animated translate (0 → +18px)
with spring easing.

**Code does (shipped):** Composes `Pressable` (`variant="none"` so the
scale animation doesn't fight the thumb motion) wrapping a single
`Animated.View` thumb. Off: `border.strong` track + `text.primary`
thumb. On: `accent.default` track + `text.inverse` thumb. Thumb
translateX runs on `Animated.spring` (native driver, stiffness 220,
damping 22, mass 0.9) for a tactile-but-quick flip. Track color flips
synchronously since the eye follows the thumb. `accessibilityRole`
`switch` and `accessibilityState.checked` are set so screen readers
announce the state.

SettingsScreen's two RN `Switch` callers (notification prefs) migrated
to `Toggle` in this commit. RN `Switch` imports removed from the
screen.

**`armed` state (2026-06-03, clips capture model).** A third appearance
between off and on, for "configured but not yet committed" — the Go Live
& Record source toggles use it so the toggles are set-it-and-forget-it
and the single Go Live button never flips them. With `armed` + `value`
true the thumb sits in the on-position, but the **trough keeps the
off-state gray** (`border.strong`) with a **1px `accent.default` outline
ring**, and the **thumb is ink/black** (`text.primary`) with a **1px
`accent.default` stroke**. The accent ring + accent-stroked thumb carry
the "cued" signal; the gray trough says "not yet live." On commit the
consumer drops `armed` and the toggle fills the track accent (the
existing `on` look). The track outline is an **absolutely-positioned
overlay ring** (not a `borderWidth` on the track) so it adds zero box
geometry — thumb travel and vertical fit stay a clean 2px all around in
every state. (Treatment revised 2026-06-03: was a dark trough + light
thumb; now gray-trough + accent-thumb. An earlier implementation used a
track border that shrank the thumb's travel — replaced by the overlay
ring.)

**Gap / proposal:** None — shipped.

---

#### `ProgressBar`

- **Tier:** primitive
- **Location:** `src/components/primitives/ProgressBar.tsx`
- **Modes:** `bars` (default — segmented thin bars across width) | `dots` (centered row of small dots — short flows)
- **Sizes:** bars 3px tall (rounded ends); dots 6px diameter
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** wizard headers (Onboarding x 4 wizards), Report multi-step modal, future multi-step flows
- **Shipped:** 2026-05-30 (sub-phase 12.4 — fourteenth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Top of every wizard step. Bar mode for ≤10 steps,
segmented and accent-filled-up-to-current. Dot mode for very short
(2–4 step) flows. Visual: thin bar, line color for unfilled, accent
for filled.

**Code does (shipped):** Single primitive, two modes. `bars` renders
`total` flex-1 items in a row with a 4px gap, each 3px tall; `dots`
renders `total` 6×6 circles centered with an 8px gap. Filled items
take `accent.default`, unfilled take `border.strong`. Consumer passes
`total` and `current` (number of completed steps; 0 = nothing, `total`
= done). `total < 1` renders nothing.

**Gap / proposal:** None — shipped.

---

#### `Spinner`

- **Tier:** primitive
- **Location:** `src/components/primitives/Spinner.tsx`
- **Variants:** `default`
- **Sizes:** xs (12), sm (14), md (16 — default), lg (20); raw number accepted
- **States:** default
- **Used in:** `Button.loading`, `Input.state="loading"` — both swapped from RN `ActivityIndicator` in this commit
- **Tweak impact:** input loading affordance, button loading state, full-screen loading, network-pending indicators
- **Shipped:** 2026-05-30 (sub-phase 12.4 — fifteenth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Simple circular spinner — 2px stroke, accent-colored top
arc, line-colored bottom, 0.7s linear rotation. Color overridable so it
reads against any surface (e.g. Button primary loading uses
`text.inverse` on the accent fill).

**Code does (shipped):** The classic "border ring with one colored side
rotating" trick — no SVG, no native module, works under New
Architecture. A single `Animated.View` with `borderWidth: 2`,
`borderColor: border.strong`, `borderTopColor: <color>`, rotated via
`Animated.timing` on the native driver in a 700ms linear loop. Default
color is `accent.default`. The loop is stopped on unmount.

Button + Input swapped from RN `ActivityIndicator` to `Spinner` in this
commit — the pending notes on those two Section 3 entries are now
resolved.

**Gap / proposal:** None — shipped.

---

#### `BottomSheet`

- **Tier:** primitive (composes RN Modal + Animated + PanResponder + Pressable)
- **Location:** `src/components/primitives/BottomSheet.tsx`
- **Variants:** `peek` (mini, ~280 default — overridable via `peekHeight` prop), `expanded` (screen height minus top safe-area minus 40), `full` (screen height minus top safe-area)
- **Sizes:** N/A (height is variant-driven)
- **States:** closed, opening, open, dismissing
- **Used in:** populated in 12.6
- **Tweak impact:** Globe trending sheet, Viewer Sheet, AuthModal, TipSheet, NearbyStreamsDrawer, Exit-intent sheet, Quality sheet, Report modal, Action sheet (kebab) — basically every modal surface
- **Shipped:** 2026-05-30 (sub-phase 12.4 — sixteenth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Universal modal container pattern. Grabber handle
(48×5 pill at top), rounded top corners, optional scrim behind,
slide-up entry with spring easing, swipe-down dismiss. Header / body /
footer scaffold is the consumer's.

**Code does (shipped):** Wraps RN `Modal` (`transparent` +
`animationType="none"` so we drive our own animation). Inner stack:
scrim (`bg.overlay`, fade) → sheet (`bg.elevated`, hairline border,
`elevation.sheet` shadow, top-rounded `radius.md`) → grabber row +
slotted children. The sheet slides via `Animated.spring` on
`translateY` (stiffness 220, damping 24) on the native driver;
`PanResponder` on the grabber row lets the user swipe-down — beyond
80px or velocity > 0.5 closes, else springs back. Scrim is tap-to-
close (composes `Pressable variant="none"` to avoid scale animation).

**Radius locked at `radius.md` (r:4)** — the mocks rendered r:18–26 but
tokens win per the same precedent set by Card and Input. The sheet's
visual identity is its bottom-anchored geometry + grabber, not corner
radius.

Existing one-offs (`NearbyStreamsDrawer`, `AuthModal`, `TipSheet`) keep
their inline implementations until 12.6 migration — refactor to
content-only callers of this primitive at that point.

**Gap / proposal:** None — shipped. Backdrop blur for over-globe
contexts is a v0.3 follow-on (matches Card's deferred blur plan), to be
added via a `blur` prop once `expo-blur` lands.

---

#### `Slider`

- **Tier:** primitive
- **Location:** `src/components/primitives/Slider.tsx`
- **Tones:** `accent` (default), `live` (semantic alias of accent under single-accent rule), `warn` (amber)
- **Sizes:** md (4px track, 20px thumb) — single canonical size
- **States:** default, pressed (thumb-drag), disabled (opacity 0.4)
- **Used in:** populated in 12.6
- **Tweak impact:** Cash Out amount selector, future quantity/range inputs
- **Shipped:** 2026-05-30 (sub-phase 12.4 — seventeenth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Custom range input — thin track (4px), filled portion in
tone-color, 20px thumb with 2px tone-colored border + cream fill + glow
box-shadow. Optional min/max tick labels below in mono-caps. Snap-to-
integer step.

**Code does (shipped):** PanResponder-driven. `onLayout` captures track
width into a ref; drag is computed as `startValue + (dx / trackWidth)
* range`, then snapped to `step` (defaults to 1, set ≤0 to disable
snapping), then clamped to `[min, max]`. Filled portion's width
follows the value/range ratio. Thumb absolute-positioned at
`filledPx - THUMB/2` (centered on the leading edge), with the tone
color as its border and `text.inverse` (cream) as its fill +
`elevation.glow.accent`. Optional `minLabel`/`maxLabel` render below
in `Text variant="monoLabel"`.

The current `CashoutScreen` inline slider keeps its bespoke
implementation until 12.6 migration — refactors to a caller of this
primitive at that point.

**Gap / proposal:** None — shipped.

---

#### `SegmentedToggle`

- **Tier:** primitive (composes Pressable + Text)
- **Location:** `src/components/primitives/SegmentedToggle.tsx`
- **Variants:** `default` (active indicator `text.primary` warm-ink), `accent` (active indicator `accent.default` warm-crimson — for ANON-tagged segments on My Profile)
- **Sizes:** single canonical h:30 (segments h:24 after 3px inner padding)
- **States:** default, selected (per segment), disabled
- **Used in:** populated in 12.6
- **Tweak impact:** My Profile VIS filter (ALL / PUBLIC / ANON), future 2–4 option single-selects
- **Shipped:** 2026-05-30 (sub-phase 12.4 — eighteenth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Multi-button row inside a single pill-shaped container.
Single-select semantics — pressing one segment unpresses the others.
Inside-padded ring around the active segment. Mono-caps labels.

**Code does (shipped):** Outer pill: `View` with `borderRadius: full`,
line-strong border, 3px inner padding. Inside: equal-width segments
(each `Pressable variant="none"` so the scale press feedback doesn't
fight the indicator glide). Active indicator is an
`Animated.View` absolutely positioned within the inner padding,
animated via `Animated.spring` on `translateX` (native driver,
stiffness 220, damping 22, mass 0.9) to `activeIndex * segWidth`.
Active label = `text.inverse` (cream — reads on both ink and crimson
indicators). Inactive label = `text.muted`.

Generic over the option value type (`Props<T extends string>`) so
consumers get exhaustive type safety on their unions
(`'all' | 'public' | 'anon'`, etc.).

Container is `alignSelf: 'stretch'` — width is the parent's. Wrap in a
fixed-width parent for a compact pill, leave alone for a full-row
segmented control.

**Gap / proposal:** None — shipped.

---

#### `Divider`

- **Tier:** primitive
- **Location:** `src/components/primitives/Divider.tsx`
- **Tones:** `subtle` (border.subtle, default), `strong` (border.strong), `dashed` (dashed border.subtle)
- **Sizes:** sm (1px) — single canonical size
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every horizontal line separator
- **Shipped:** 2026-05-30 (sub-phase 12.4 — nineteenth primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Universal horizontal hairline. Two solid weights plus a
dashed variant for "row-actions" dividers in Clip Edit.

**Code does (shipped):** Tiny `<View>` wrapper. Solid tones use
`backgroundColor` on a 1px-tall View. Dashed tone uses
`borderBottomWidth: 1` + `borderStyle: 'dashed'` (RN's dashed border
renders consistently across iOS/Android with this pattern).

`Spacer` (flex-1 View) is NOT extracted — consumers use raw
`<View style={{ flex: 1 }} />` inline because the abstraction value
is too low.

**Gap / proposal:** None — shipped.

---

#### `BrandMark`

- **Tier:** primitive
- **Location:** `src/components/primitives/BrandMark.tsx`
- **Variants:** color-via-prop (defaults to `text.primary`; pass `color` to override)
- **Sizes:** sm (18px), md (22px — default), lg (26px), hero (32px); raw number accepted
- **States:** default
- **Used in:** populated in 12.6 (GlobeScreen header — first migrant)
- **Tweak impact:** GlobeScreen header, splash screen, share thumbnails, future logo composition
- **Shipped:** 2026-05-30 (sub-phase 12.4 — twentieth and final primitive)
- **Last reviewed:** 2026-05-30

**Mock says:** Hollow outer circle + two crossing inner ellipses (one
scaled to ~0.35 on X, one on Y). Reads as meridian + parallel through a
globe — a literal-but-fitting brand mark for a planet-of-streams product.
Border-width scales with size (1.5px at sm/md, 2px at lg/hero).

**Code does (shipped):** Three nested `View`s with `borderRadius: 50%`
and `scaleX` / `scaleY` transforms. No SVG dependency. Color defaults
to `text.primary` so the mark inherits the surface's ink color;
consumers pass `color` to override (e.g. accent for hero CTAs). A
`Logo` composition (BrandMark + wordmark Text) isn't extracted as a
feature until a second header demands the same pairing — for now,
inline in the GlobeScreen header during 12.6 migration.

**Gap / proposal:** None — shipped.

---

### Features (`src/components/features/`)

Populated from the 12.2 inventory pass. Features represent one domain
thing each — a stream, a user, a clip, a wallet transaction, a wizard
step affordance. They compose primitives and never compose other features
(per Section 0's no-self-composition rule). Domain types are accepted as
props; data fetching belongs to screens, not features.

**Carried forward from pre-Phase-12 work** (migrated to `features/` in 12.1a):
`NearbyStreamsDrawer`, `NearbyStreamThumbnail`, `NearbyStreamRow`,
`Avatar` (promoted to primitives in 12.4 — see Avatar primitive entry),
`FollowButton`, `AuthModal`, `ChatOverlay`, `ReactionLayer`, `TipSheet`.
Several of these refactor as the inventory below lands: `NearbyStream*`
collapses into the new `StreamCard`; `ChatOverlay` splits into
`ChatMessage` + `ChatComposer`; `ReactionLayer` becomes `ReactionRail` +
`FloatingHearts`; `TipSheet` becomes a BottomSheet caller composing
`AmountInput` and `PursesCard`.

The 38 entries below are grouped by domain. Build order isn't strictly
serial — features build after their primitives ship but otherwise can
land in any order. Each entry includes the three-way audit.

#### Stream / Discovery

##### `LivePill`

- **Tier:** feature (composes `Pill.live` + animated dot)
- **Location:** `src/components/features/stream/LivePill.tsx`
- **Sizes:** sm (h:22, dot 6) | md (h:28, dot 8 — default). The mock's
  `compact` variant collapses into `size="sm"`.
- **States:** default (always pulsing)
- **Used in:** populated in 12.6
- **Tweak impact:** every LIVE marker — top strips, video thumbs, broadcast HUDs, banners
- **Shipped:** 2026-05-30 (sub-phase 12.5 — second section/feature; LivePill is the first feature row)
- **Last reviewed:** 2026-05-30

**Mock says:** Iconic LIVE marker. Live-tone fill, pulsing white square
inside (~1.6s animation), all-caps mono "LIVE" label with tracked
letter-spacing.

**Code does (shipped):** Composes `Pill` with `variant='live'` (accent
fill, cream label, monoLabel typography) and passes an
`Animated.View` (cream square, `borderRadius: 1`) to the new
`leading` slot on Pill. Pulse animation is `Animated.timing` opacity
1 → 0.3 → 1 in 800ms-per-step loop, native driver, cleaned up on
unmount.

**Opacity-only animation per the 2026-05-30 CALayer rule** — pulse
doesn't touch shadow / mask / transform / layout properties, so it's
safe to compose inside any focusable scroll context without affecting
keyboard behavior.

**Gap / proposal:** None — shipped.

---

##### `StreamCard`

- **Tier:** feature (composes Pressable + Image + Text + Icon + LivePill)
- **Location:** `src/components/features/stream/StreamCard.tsx`
- **Variants:** `trending` (158-wide vertical card, 88-tall thumb on top), `preview` (16:10 hero — thin wrapper around `VideoPreviewTile.live`/`play` since 2026-05-31), `compact` (full-width row with 72×48 thumb)
- **Sizes:** controlled by variant
- **States:** default, pressed (Pressable variant `subtle` — scale 0.98)
- **Used in:** populated in 12.6 (replaces `NearbyStreamThumbnail` + `NearbyStreamRow`)
- **Tweak impact:** Globe trending rail, Viewer Sheet preview, search results, future feed surfaces
- **Shipped:** 2026-05-30 (sub-phase 12.5 — second feature). Refactored 2026-05-31 to compose `VideoPreviewTile` for the preview variant.
- **Last reviewed:** 2026-05-31

**Mock says:** Thumbnail with overlay metadata (LivePill top-left,
viewer count overlay, channel label corner). Title + city/channel meta
underneath or alongside.

**Code does (shipped):** Three variant render fns inside the file.
Each wraps content in `Pressable` (variant `subtle`) so the whole card
gets the scale press feedback. Common shared helpers:
- `Thumbnail` — uses RN `Image` with `resizeMode='cover'` when
  `thumbnailUrl` is set; falls back to a `bg.panel` placeholder with a
  small `Icon name='video'` center.
- `formatCount(n)` — 1234 → "1.2k", 12345 → "12k".

Overlays sit absolutely-positioned within an `overflow: hidden`
thumbnail wrap. `LivePill` renders only when `isLive` (default true).

API: consumer-flat props, not a `Stream` object — keeps the feature
domain-blind. Consumer screens (`GlobeScreen`, `SearchScreen`, future
trending rail) read from their query/store and pass `thumbnailUrl`,
`title`, `viewerCount`, `channel`, `city`, `isLive`, `onPress`.

**Composition note (2026-05-31):** `preview` no longer carries its own
overlay code — it now delegates entirely to `VideoPreviewTile` (passing
through `thumbnailUrl`, `viewerCount`, `channel`, `onPress`, picking
variant `live`/`play` from `isLive`). Previously the overlay logic was
duplicated; consolidating into VideoPreviewTile keeps Clip Edit hero
and future replay thumbnails sharing the same tile.

**Gap / proposal:** None — shipped. `NearbyStreamThumbnail` and
`NearbyStreamRow` retire in 12.6 when callers (`GlobeScreen`,
`NearbyStreamsDrawer`) migrate to `StreamCard.trending` /
`StreamCard.compact` respectively.

---

##### `ClipCard`

- **Tier:** feature (composes Pressable + Image + Text + Icon)
- **Location:** `src/components/features/clip/ClipCard.tsx`
- **Variants:** `public` (Profile grid), `owner` (My Profile — adds layer badge row + supports anon + draft flags)
- **Sizes:** controlled by variant; thumb is 16:11
- **States:** default, pressed, anon (owner only — dark overlay + lock pill + "ONLY VISIBLE TO YOU"), draft (owner only — DRAFT pill replaces viewer count)
- **Used in:** populated in 12.6
- **Tweak impact:** Profile clip grid, My Profile clip grid, any future replay surface
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Thumbnail (16:11 aspect) with overlay metadata. Duration
pill top-left, peak-viewer-count or anon-lock or draft pill top-right or
bottom-right. Title + venue + date underneath. **Owner variant** adds a
layer-badge row (5 small icon tiles showing which of CAM / AUD / LOC /
ID / GYR were active during the recording). **Anon owner clips** get a
desaturated + diagonal-stripe overlay and "ONLY VISIBLE TO YOU" caption.

**Code does (shipped):** 16:11 thumbnail with placeholder fallback +
overlays: duration pill (top-left), and one of viewer-count pill /
DRAFT pill / lock pill in the top-right by priority. Meta block under
the thumb carries title, optional venue · date, and (owner only) a
5-tile layer badge row + "ONLY VISIBLE TO YOU" caption when `anon`.

**Anon treatment.** Diagonal stripes from the spec are simplified to
a 35%-black overlay (cheap to render, communicates the "private" tone).
Real diagonal-stripes can swap into the `anonOverlay` style without API
change. Public-side excludes anon clips entirely — that's the parent's
responsibility.

---

##### `StreamTile`

- **Tier:** feature (composes Pressable + Feather Icon + Text)
- **Location:** `src/components/features/stream/StreamTile.tsx`
- **Variants:** `default` (Viewer Sheet sensor row)
- **Sizes:** md (84×80)
- **States:** active (2px accent border, accent-tinted icon, primary text), inactive (1px subtle border, muted icon/text, opacity 0.45), pressed (Pressable variant `subtle`)
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet's STREAMS strip, future stream-source display surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Vertical tile with icon-square (28×28) on top, mono-caps
label in middle, value/spec below (e.g. "1080p", "48 kHz", "GPS", "192°"
for compass heading, "OFF" for inactive). On-state: line-2 border tinted
accent. Off-state: opacity 0.45.

**Code does (shipped):** Vertical 84×80 tile. Icon-square (28×28, 1px
border) on top — border swaps to `accent.default` when active, stays
`border.subtle` when inactive. Inner glyph (16px Feather icon) tints
`accent.default` when active, `text.muted` when inactive. Mono-caps
label (`monoLabel`) center, value/spec (`monoCaption`) below. Whole
tile dims to `opacity: 0.45` when inactive. Pressable wrapper supplies
scale press feedback.

**API:** consumer-flat — `iconName` (Feather glyph), `label`, `value`,
`active?`, `onPress?`. The Viewer Sheet section will map a domain
layer (e.g. `{ kind: 'cam', resolution: '1080p' }`) into
`{ iconName: 'video', label: 'CAM', value: '1080p', active: true }`
before passing in. Bespoke per-layer icons (Phase 14 sensor model) can
later live in `src/components/primitives/icons/` and be plumbed
through the same `iconName` slot.

---

##### `CoordHUD`

- **Tier:** feature (composes Text only)
- **Location:** `src/components/features/stream/CoordHUD.tsx`
- **Variants:** `viewer-sheet` (4-column inline grid, label above value, centered), `broadcast-live` (right-justified panel with rgba(0,0,0,0.45) backdrop, label left / value right per row)
- **Sizes:** controlled by variant
- **States:** default, pending (per item — value rendered in `text.subtle` for in-flight reads)
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet meta block, Broadcast Live HUD overlay
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Grid of label/value pairs (LAT / LON / ELEV / UPTIME,
sometimes more). All mono, tabular-numeric values. Label is dim and
small caps. Value is brighter, monospace.

**Code does (shipped):** Renders an array of `{ label, value, pending? }`.
`viewer-sheet` lays cells out in a flex row with `flex: 1` per column —
4-up is the design intent but it gracefully degrades to N cells. Label
uses `monoCaption` in `text.subtle`; value uses `monoValue` in
`text.primary` (or `text.subtle` when `pending`). `broadcast-live`
swaps in a translucent panel + `text.inverse` for value (so it reads
against arbitrary camera footage), label stays `text.subtle`.

**API:** consumer-flat — feature stays domain-blind. The Viewer Sheet
and Broadcast HUD screens format their own `{ label, value }` items
from coordinates / uptime / heading.

---

##### `VideoPreviewTile`

- **Tier:** feature (composes Pressable + Image + Text + Icon + LivePill)
- **Location:** `src/components/features/stream/VideoPreviewTile.tsx`
- **Variants:** `live` (LivePill top-left, no play button — tappable to join live), `play` (centered play button, no LivePill — for clip / replay heros)
- **Sizes:** controlled by `aspectRatio` prop (default 16/10)
- **States:** default, pressed (via Pressable variant=subtle when onPress provided)
- **Used in:** `StreamCard.preview` (composed, not duplicated); Clip Edit hero + future replay thumbnails next
- **Tweak impact:** Viewer Sheet preview, Clip Edit preview hero, future replay thumbnails
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Aspect-ratio container with simulated camera/scene
content. Grain texture overlay. Overlay metadata pills (LIVE top-left,
viewer-count top-right, channel-label bottom-left). Optional center play
button (semi-transparent circle + play icon).

**Code does (shipped):** Consumer-flat props (`thumbnailUrl`,
`viewerCount`, `channel`, `aspectRatio`, `onPress`, `accessibilityLabel`)
keep the feature domain-blind. Placeholder fallback when no
`thumbnailUrl`: `bg.panel` background + `video` icon. `StreamCard.preview`
now thin-wraps this tile (passes through `thumbnailUrl`/`viewerCount`/
`channel`/`onPress` + chooses variant by `isLive`), eliminating the
duplicated overlay code that previously lived inside StreamCard.

**Note:** Real-live broadcast uses Phase 7 `RTCView` directly — this tile
is for paused / preview / thumbnail states only.

---

##### `ReactionRail`

- **Tier:** feature (composes Pressable + Text + Animated burst overlay + count-badge chip)
- **Location:** `src/components/features/stream/ReactionRail.tsx`
- **Variants:** `default`
- **Sizes:** md (44×44 per reaction button)
- **States:** default (glass backdrop, subtle border), pressed (scale 1.15), on (accent border + accent surface), with optional count badge
- **Used in:** populated in 12.6 (replaces Phase-10 `ReactionLayer` once stream view migrates)
- **Tweak impact:** Broadcast Live HUD, any future live reaction surface
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Vertical column of round reaction buttons (44×44, glass
backdrop). Each button has a small count-badge in the corner. On press,
emits a FloatingHearts animation that drifts upward (Periscope-style).
Active reaction state: live-tinted border + icon.

**Code does (shipped):** Consumer-driven reactions list (`{ kind,
emoji, count?, on? }[]`) — no hardcoded set, so any future
reaction-set works without code changes here. Buttons render emoji
directly via RN `<Text>` (Periscope-style); the `burst` queue is owned
by the screen, this feature renders each `BurstEntry` as a
`FloatingReaction` (translateY -160 over 2.2s, opacity fades out at
1.4s) and dismisses via `onBurstDismiss(id)`. Unauthenticated mode
routes presses to `onAuthRequest` so the screen can present the
Phase-10 AuthModal at the point of attempt.

**API:** consumer-flat — `reactions`, `burst`, `authenticated?`,
`onReact(kind)`, `onAuthRequest?`, `onBurstDismiss(id)`.

**Composition note:** DESIGN.md proposed `IconButton + count-badge
Pill`, but IconButton is Feather-glyph-only today and reactions are
emoji. The rail builds its own 44-round button; the count badge is an
inline chip with `monoCaption` text. If reactions ever migrate to
bespoke icons (`src/components/primitives/icons/`), the rail can swap
to IconButton without API changes.

---

##### `DiscoveryHandoffCard`

- **Tier:** feature (composes Avatar + Text + Button + Pressable + Icon + LivePill + StreamStrip section)
- **Location:** `src/components/features/stream/DiscoveryHandoffCard.tsx`
- **Variants:** `single` (one pin tap), `cluster` (multi-pin tap) — inferred from prop shape (`{ stream }` vs `{ streams }`)
- **Sizes:** controlled by variant
- **States:** default; optional `onDismiss` shows a close X
- **Used in:** populated in 12.6 (GlobeScreen replaces inline `<View>` blocks)
- **Tweak impact:** discovery→watching seam (canonical Section 0.7 example) — every globe tap-to-preview surface
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says (C1=C):** Inline floating card at the bottom of the
GlobeScreen — `single` is a Card with Avatar + title + handle + viewer
count + Join button; `cluster` is a Card with a small header ("N live
streams here · LOCATION") and N rows of compact stream-row items.
**Not** a bottom-sheet pattern in v0.2 — the rich Viewer Sheet mock is
deferred (see C1 in the 2026-05-29 12.2 decision-log entry). The single
variant gains a second-row `StreamStrip` of 5 chips per C2=A.

**Code does (shipped):** Variant inferred from prop shape — `isCluster`
narrowing checks for a `streams` array. Single renders Avatar md +
title/handle/viewer count column + LivePill + optional StreamStrip
+ primary Join Button. Cluster renders a header ("N live streams here
· LOCATION") + a max-220-tall scroll of compact rows (Avatar sm +
title/handle/viewers/distance + accent "JOIN" chip). Both variants
support an optional dismiss X in the top-right.

**Section seam.** This is the canonical place where a feature composes
a section — single variant passes `stream.layers` directly into
`StreamStrip` per the C2=A spec.

---

##### `SearchBar`

- **Tier:** feature (composes the `Input` primitive)
- **Location:** `src/components/features/discovery/SearchBar.tsx`
- **States:** default, focused, with-clear (when `onClear` is set and value is non-empty)
- **Used in:** Globe overlay search slot; any future search surface
- **Tweak impact:** Globe overlay search slot; any future search surface
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-06-05

**Mock says (C3=A):** leading mag-glass Icon + field, placeholder, optional
clear. Sits below the WRLD + LIVE header, above the CategoryChipRow.

**Rebuilt on `Input` 2026-06-05.** Was a bespoke 40-tall glass pill (radius:full,
`bg.panel`) with its own bare `TextInput` — it diverged from `Input` only
because `Input` lacked a leading-icon slot and the pill geometry differed. With
the new `Input.leading` slot, `SearchBar` now **composes `Input`**
(`leading`=🔍, `rightAffordance`=clear-X, `returnKeyType='search'` + `onSubmit`)
and inherits the title field's exact look (rectangle, `radius.md`, h:52,
`bg.elevated`, 16px). The search box and the "What's happening" title field are
now one source of truth. Same public API — existing callers are unchanged, they
just render as the rectangle field now.

**Composition note.** Built with a bare `TextInput` rather than
wrapping the Input primitive — Input has no leading-icon slot, and
the pill geometry (radius `full`, 40 tall) doesn't match Input's
default rectangle. Keeping Input untouched + building a small custom
pill is the cheaper composition. Backdrop-blur from the spec is
deferred — the panel-tinted background is good enough on the cream
canvas, and `BlurView` introduces ios-only behavior we'd rather adopt
behind a primitive when a second blur surface needs it.

**API:** spreads `TextInputProps` minus `style`; required `value`,
`onChangeText`; optional `onSubmit`, `onClear`, `placeholder` (default
"Search handle, title, or city").

**Code does (legacy):** None on globe; `SearchScreen.tsx` has a standalone Input
hitting the existing handle/title search endpoint.

**Gap / proposal:** Lifts the existing search endpoint onto the globe
overlay. Reuses the `Input` primitive inside a glass-pill container.
SearchScreen may eventually merge into Globe per Section 4 TBD —
this feature is the lift target either way.

---

##### `TimeScrubber`

- **Tier:** feature (composes Pressable + Text + PanResponder + Animated)
- **Location:** `src/components/features/discovery/TimeScrubber.tsx`
- **Variants:** `default` (the running WRLD clock / time machine bar)
- **Sizes:** collapsed (~50 tall) / expanded (~104 tall)
- **States:** live (offset 0 — ticking, "● NOW" tag), scrubbed (offset > 0 — playback playhead + muted tappable "● THEN" button); collapsed (transparent band-only over the globe) / expanded (solid `bg.glassPanel` + per-field ghosts); **passive (`interactive=false`)** — live readout only, no tap-to-expand / no scrub (see `LiveClockBar`)
- **Used in:** `GlobeScreenMapbox` (pinned bottom, drawer rides flush on it) + `ClipEditScreen` (docked buffer clock, `playback=false`) — both interactive. The **passive live-readout** (`interactive=false`) is wrapped by `LiveClockBar` on Dashboard + Stream — 2026-06-04, repositioned 2026-06-05, `interactive` mode 2026-06-09
- **Tweak impact:** the globe time-machine bar
- **Shipped:** 2026-06-04 (Time Machine initiative · UI v1)

**Mock says:** No mock — designed from the brief. A long thin horizontal
"running clock" above the globe drawer; scrubbing back replays surviving
clips at that time; six fields (YR · MO · DY · HR · MIN · SEC) each
spinnable; default reads as a ticking clock, taps to expand with ghosted
neighbours hinting spinnability.

**Code does (shipped):** Controlled by a single `offsetMs` (0 = live).
Playhead = `Date.now() - offsetMs`, recomputed every second via an
interval `setTick`, so it reads as a ticking clock live and as a 1×
playback playhead when scrubbed. Six `Field` columns, each with a
`PanResponder` (active only when expanded) that scrubs **absolute from
gesture start** (captures the playhead on grant, applies the total
`round(dy / STEP_PX)` delta each move — no drift from stale offset reads).
`stepDate` uses native `Date` setters so carry/borrow is correct across
all fields + variable month/year lengths. Clamped to `[0, now-minYear]`
(no future, floor at `minYear`, default 2026).

**Dial treatment (2026-06-04).** Each field is a vertical dial. The
**selection band** — a centred strip with a top + bottom `border.strong`
line — is the **only filled surface** (`bg.glass`), identical in blurred
and focused states. A fixed **WINDOW** of cells (±3) renders per field;
`text.primary` ink in the `monoLabel` font (IBM Plex Mono caps, the
"nearby now" type), centre at full opacity, neighbours dimmed by distance
(0.5 / 0.28 / 0.12). Month is a 3-letter abbreviation (JAN…DEC);
hours 24h. **Blurred clips to the single band row** (no peeking
neighbours); tap expands (`motion.patterns.overlay`) to 5 rows so the ±2
neighbours come into view above/below the band (over the globe).
**Future cells are greyed** (`text.subtle`) — values after the present are
unreachable, and the cue says so. **Focused, the centre value goes bold**
via the real `IBMPlexMono_700Bold` face (`styles.boldCentre`, not a
`fontWeight` override — static fonts don't synthesise); blurred it reverts
to `IBMPlexMono_500Medium`, and the ghost neighbours are never bold.
**Status slot:** "● LIVE" in **accent**
(the one electric element, non-interactive) when live; "● PAST" muted +
tappable (→ `onOffsetChange(0)`, jump back to live) when scrubbed. LIVE
and PAST are both 4-char mono in a fixed slot, so the swap never reflows.

**Spacing (2026-06-04).** Equal fixed gaps between every wheel — the `:`
colons sit centred *inside* the hour-minute and minute-second gaps (a
`Gap` slot), so they don't get their own column; the gap there equals the
year-month gap. The whole content is centred (`justifyContent: 'center'`)
so the margin left-of-year equals the margin right-of-status. **Fixed
per-field widths** (`FIELD_W`) + a fixed-width status slot mean a value
change (e.g. JUL→AUG, or the live/NOW swap) never reflows the row. Every
cell is `numberOfLines={1}` as a backstop. `FIELD_W` is sized for **IBM
Plex Mono** (now bundled — see Section 6 / decision log): monospace gives
every month + digit a single, uniform advance that the bold focused face
shares, so the bold centre never gets wider than its field — no wrap,
clip, or guesswork.

**Animated tick / dial slide.** Every value change — a live tick or a
scrub step — animates the field's cell column by one row: newer scrolls
**down**, older scrolls **up** (the OLD value starts at the band and the
new one slides home). So the motion itself cues which way to spin, and
dragging reads as dialling. `useLayoutEffect` seeds the start offset
before paint (no flash); only fields whose value actually changed animate.

**Gesture.** Each field owns **one** `PanResponder` handling both tap and
drag — a near-still release toggles expand, a vertical drag (when
expanded) dials. There is **no wrapping Pressable**: an earlier version
wrapped the bar in one for tap-to-expand, and it swallowed the touch so
the dials wouldn't scroll. The scrub clamps at the present, so you can't
dial into the future — and that clamp is the **only** way one wheel moves
the others: dialling forward past now snaps the whole clock back to live.
(`onPanResponderTerminationRequest: false` keeps a parent scroll from
stealing a drag mid-gesture.) Touch targets are widened with `HIT_SLOP`
(±12 horizontal ≈ half the gap, ±18 vertical) so the narrow wheels are
easy to grab.

**Playback pause.** When a scrub lands in the **past** and the finger
lifts, the clock holds for ~0.5 s before real-time playback resumes —
`paused` freezes the displayed playhead at `frozenRef`, then a timer
rebases `offsetMs` so playback continues from exactly where it was held
(no time jump). Scrubbing all the way to **live** ticks with real time
immediately, even mid-drag (no hold). A fresh scrub cancels a pending
resume.

**Blur on outside interaction.** The dial collapses as soon as *any other*
UI is touched — but not the globe. A `collapseSignal` prop (a counter)
collapses the dial whenever it increments; `GlobeScreenMapbox` bumps it
from an `onTouchStart` on each overlay group (top stack, banner, pin
cards, drawer) but **not** on the `MapView` or the scrubber itself, so
spinning/zooming the globe leaves an expanded dial alone.

**Carry is intentional.** The dial uses native `Date` arithmetic
(`stepDate`), so scrolling a wheel past its boundary **carries into the
wheel on its left** — dialling the month back past JAN rolls to DEC *and*
ticks the year down; hour past 00 borrows a day. Ben likes this; don't
"fix" it into independent wheels. The YEAR wheel needs multi-year range to
move, so `minYear` defaults to **10 years back** (`DEFAULT_MIN_YEAR`) —
the real data floor (WRLD launched 2026) is the backend's call.

**Surface.** No bar background — the band is the only fill (over the globe,
the neighbours sit on the transparent area when expanded). The earlier
center-out gradient was dropped per Ben.

**Passive mode (`interactive=false`, 2026-06-09).** Each `Field`'s
`PanResponder` is only attached when `interactive` — so passing
`interactive={false}` makes the dial a pure live readout: it still ticks
every second (reads "● NOW"), but it can't be tapped to expand or dragged
to scrub. This is what the clock-as-footer-chrome pattern wants on screens
with no time-travel surface; `LiveClockBar` is the thin wrapper for it.

**Seam (Aaron / backend).** The component only emits `offsetMs`;
`GlobeScreenMapbox` holds it and carries a commented TIME-MACHINE seam at
`useDiscoverySocket()` where the live feed swaps to a historical
"surviving clips near, at playhead" query. Until then the globe stays live
regardless of the clock. See CLAUDE.md "Time Machine initiative."

---

##### `LiveClockBar`

- **Tier:** feature (wraps `TimeScrubber` in its `interactive=false` mode)
- **Location:** `src/components/features/discovery/LiveClockBar.tsx`
- **Variants:** `default` (passive live-readout clock)
- **Sizes:** fixed collapsed band height (`LIVE_CLOCK_BAR_H` = `CLOCK_COLLAPSED_H`)
- **States:** live (ticking "● NOW") only — non-interactive
- **Used in:** Dashboard (flush above the footer, Go Live bar bumped up by its height) + Stream (pinned `bottom:0` over the camera in every mode) — the predictable "WRLD clock above the footer" pattern
- **Tweak impact:** the persistent clock chrome on Dashboard / Stream
- **Shipped:** 2026-06-09

**Why it exists:** the WRLD clock should sit above the footer on every main
surface as a predictable pattern. On the globe + clip editor the clock is
*interactive* (it drives the globe replay / the buffer playhead). On the
Dashboard + Stream there's nothing to time-travel, so the clock is a passive
live readout — `LiveClockBar` is that one-liner (`TimeScrubber offsetMs={0}
interactive={false}`) so screens don't repeat the boilerplate, and it exports
`LIVE_CLOCK_BAR_H` so hosts can offset a docked Go Live / End Stream button up
over it. See CLAUDE.md "5-item footer / clock-above-footer pattern."

---

##### `StreamStateBanner`

- **Tier:** feature (composes Pressable + Text + Icon + ActivityIndicator)
- **Location:** `src/components/features/stream/StreamStateBanner.tsx`
- **Variants:** `disconnected` (muted card, spinner + "waiting to reconnect" copy), `ended` (muted card; auto-dismisses after 8s by default), `resumed` (accent-tinted, tappable to rejoin via `onTap`), `kicked` (muted card; "You have been removed from this stream"; auto-dismisses after 8s — added 2026-05-31 in the main-merge integration for Aaron's Phase 5/22 admin-kick handling)
- **Sizes:** md
- **States:** visible (the only render state); auto-dismiss timer per variant (defaults: ended 8s, disconnected 5min cap, resumed never)
- **Used in:** populated in 12.6 (GlobeScreen replaces inline banner)
- **Tweak impact:** GlobeScreen post-stream-exit notifications
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says (C6 = extract):** Top-of-globe banner that surfaces
stream-lifecycle state to viewers after they exit a stream. Three
variants cover the lifecycle: broadcaster reconnecting, broadcaster
gone, broadcaster back online.

**Code does (shipped):** Presentational layer + per-variant auto-dismiss
timer (configurable via `autoDismissMs` — pass 0 to disable). The
`resumed` variant uses `accent.surface` background + `accent.default`
border; the others use the muted `bg.elevated` card treatment. A
dismiss X is always present.

**API:** `variant`, `onDismiss`, `onTap?` (resumed), `autoDismissMs?`.

**Where the state machine lives.** DESIGN.md originally proposed the
feature also own polling + `consumeStreamSignal()` consumption. We
kept those at the screen level (GlobeScreen reads
`consumeStreamSignal()` in a focus effect and polls `streamsApi.near`)
so this feature stays domain-blind — no API client or signal-store
import. The feature owns timers + visuals; the screen owns transitions.
**Complexity-bounding exception to Section 0.5:** one caller today
(`GlobeScreen`), but the banner's three-variant visual contract + the
auto-dismiss timer earns its own feature file even before a second
caller arrives.

---

#### User / Identity

##### `BroadcasterRow`

- **Tier:** feature (composes Avatar + Text + FollowButton + Pressable)
- **Location:** `src/components/features/user/BroadcasterRow.tsx`
- **Variants:** `default` (full row: Avatar md + name + @handle · followers + FollowButton), `chip` (32-tall rounded pill: Avatar xs + name + @handle, dark backdrop, no Follow)
- **Sizes:** controlled by variant
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet, Broadcast Live HUD, Profile header, stream view broadcaster identity row
- **Shipped:** 2026-05-30 (sub-phase 12.5 — third feature)
- **Last reviewed:** 2026-05-30

**Mock says:** Avatar (sm/md) + name (sans) + handle alias (mono) +
optional follower count + FollowButton on the right. The `chip` variant
is rounded-pill, everything inline, used in Broadcast Live's HUD
overlay.

**Code does (shipped):** Two variant render fns inside the file. The
`default` variant lays out Avatar md + (name + `@handle · NK followers`
two-line column) + optional FollowButton via a flex row. The `chip`
variant is a 32-tall rounded pill (`radius.full`, `rgba(0,0,0,0.45)`
backdrop for legibility on top of arbitrary video) with Avatar xs +
inline name + @handle in cream text.

Data is consumer-flat (not a `User` object) so the feature stays
domain-blind. `FollowButton` reads its own follow state internally via
`useUserProfile(handle)` — BroadcasterRow only forwards `handle` and
`onAuthRequest`. The optional `showFollowButton` prop hides Follow when
the row is the viewer's own identity or when Follow lives elsewhere on
the surface (e.g. Profile header).

Optional `onPress` makes the whole row tappable via Pressable
(`variant='subtle'`); without `onPress` it renders as a plain View.

**Gap / proposal:** None — shipped. The inline-composition broadcaster
header in `StreamScreen` retires in 12.6 when the screen migrates.

---

##### `MetaStrip`

- **Tier:** feature (composes Text)
- **Location:** `src/components/features/user/MetaStrip.tsx`
- **Variants:** `default`
- **Sizes:** md (~28px per row)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Profile header, My Profile header, future identity-with-metadata cards
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** 2-row dot-separated info pattern. Row 1: followers count
+ joined date. Row 2: region + pronouns (or any optional metadata). Mono
font, dim ink, mid-dot separators.

**Code does (shipped):** Accepts `rows: MetaItem[][]` where
`MetaItem = { label?, value }`. Each row renders non-empty items joined
by " · " using `monoCaption` in `text.muted`. Rows whose items are
all empty are skipped entirely so a user without pronouns simply
doesn't render that segment.

---

##### `PassportCard`

- **Tier:** feature (composes Text + Icon + SocialChip)
- **Location:** `src/components/features/user/PassportCard.tsx`
- **Variants:** `default`
- **Sizes:** N/A (consumer)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Profile, My Profile, future user-detail surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** A "passport" panel showing bio (sans body), social chips
(SocialChip array), and a region row (icon + "FROM" label + value).
Optional pronouns row. Missing fields just don't render. Composes Card
+ Text + the SocialChip feature.

**Code does (shipped):** Bordered card containing four optional
blocks: bio paragraph, region row (`map-pin` icon + "FROM" mono label
+ region value), pronouns row, and a wrapped row of SocialChip items.
Missing fields render nothing — a user without socials just doesn't
get the chip row. Consumer passes a flat `{ bio, region, pronouns,
socials }` shape; the feature stays domain-blind (no `User` import).

---

##### `SocialChip`

- **Tier:** feature (composes Pressable + Icon + Text)
- **Location:** `src/components/features/user/SocialChip.tsx`
- **Variants:** `ig` (Instagram), `tt` (TikTok), `sc` (SoundCloud), `x` (Twitter/X)
- **Sizes:** md (h:30)
- **States:** default, pressed (opacity 0.7)
- **Used in:** populated in 12.6 (PassportCard composes a wrap-row of these)
- **Tweak impact:** PassportCard, future identity surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Chip with brand icon + handle. Each kind has its own
brand glyph (Instagram circle-square, TikTok stylized "S", SoundCloud
bars). Tap = opens platform's app or web fallback.

**Code does (shipped):** 30-tall pill — brand glyph (sm) + handle
(`caption`). `@` prefix is auto-applied for ig/tt/x; sc gets no
prefix. URL resolution is the consumer's job — the chip emits
`onPress` only so the feature stays domain-blind.

**Brand-icon caveat.** Feather doesn't ship true brand marks for
TT/SC/X; v1 uses neutral fallbacks (`music`, `volume-2`, `twitter`).
The `kind → iconName` map is internal; swapping in bespoke brand
glyphs from `src/components/primitives/icons/` later requires no API
change.

---

##### `AvatarPicker`

- **Tier:** feature (composes Avatar + Button + ActivityIndicator)
- **Location:** `src/components/features/user/AvatarPicker.tsx`
- **Variants:** `default`
- **Sizes:** md (72px avatar + side buttons)
- **States:** default, uploading (spinner over avatar; buttons disabled)
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding wizards (Viewer + Creator), Settings change-avatar flow
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Avatar (lg) on left + a column of two action buttons on
the right ("Take a photo" with camera icon, "Choose from photos" with
gallery icon). Picker invokes `expo-image-picker` and shows uploading
state in-place.

**Code does (shipped):** Row with `Avatar` (size `lg`) on the left
(spinner overlay when `uploading`) and two `secondary` buttons stacked
on the right ("Take a photo" / "Choose from photos") with camera + image
icons. Buttons disabled while `uploading`.

**Domain-blind scope.** The feature does NOT call
`expo-image-picker` — it only emits `onTake` / `onPick`. The 12.6
migration moves the existing `OnboardingScreen.tsx` image-picker calls
into the consumer wiring; the feature stays free of `expo-*` imports.

---

##### `AccountIDPill`

- **Tier:** feature (composes Text)
- **Location:** `src/components/features/user/AccountIDPill.tsx`
- **Variants:** `default`
- **Sizes:** sm (~h:22)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Settings (SettingsRow `right` slot), Change Handle confirm + success screens
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Small mono-caps pill showing the user's internal account
ID (e.g. "ACCT 0042-887-1156"). Line border, ink-faint background.
Reinforces the identity-model framing that handle is changeable but
account ID is permanent.

**Code does (shipped):** Pill — `monoLabel` "ACCT" + auto-formatted
id. The formatter strips non-alphanumeric, uppercases, then splits
into 4-char groups (short ids) or `XXXX-XXX-XXXX` (long cuids). Border-
subtle ring on `bg.elevated`.

---

#### Onboarding / Wizard

##### `ContextBanner`

- **Tier:** feature (composes Icon + Text)
- **Location:** `src/components/features/onboarding/ContextBanner.tsx`
- **Variants:** `accent` (default — accent.surface tint), `warn` (amber tint — computed inline from palette.amber400, same hex pattern as ToastBanner)
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every wizard top — Viewer Onboarding, Creator Onboarding, gated-action flows
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Top-of-wizard banner that acknowledges the user's entry
context. E.g. "SIGN UP TO CHAT IN @KAI.DC'S STREAM" or "BECOME A CREATOR
· 10 STEPS · ~3 MIN". Accent-tinted glass, mono-caps text, optional
leading icon. Warn variant for higher-stakes flows.

**Code does (shipped):** Tinted row — optional leading icon + mono-caps
label in the variant ink. Two-line truncation on the label. The warn
tint uses the same inline rgba values from `palette.amber400` as
ToastBanner (still no `warn.surface` token).

---

##### `AuthChoiceList`

- **Tier:** feature (composes SocialAuthButton + Divider + Text)
- **Location:** `src/components/features/auth/AuthChoiceList.tsx`
- **Variants:** `default` (platform-ordered: iOS = Apple → Google → email; Android = Google → email)
- **Sizes:** N/A
- **States:** default; per-kind `loadingKind` highlights an in-flight choice
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer step 1, Onboarding Creator step 1, AuthModal
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Vertical stack of SocialAuthButton items, an "OR" divider
mid-stack, then a "Continue with email" Button. iOS shows Apple first
(HIG); Android shows Google first.

**Code does (shipped):** Reads `Platform.OS` once; renders the social
list (Apple+Google on iOS, Google only on Android), then a labelled
"OR" divider (Divider primitive on either side of a `monoLabel`),
then the email button. Emits `onChoose(kind)`. Backend wiring for
each provider is the consumer's job — this feature only handles the
UI choice + ordering.

---

##### `SocialAuthButton`

- **Tier:** feature (thin wrapper around Button)
- **Location:** `src/components/features/auth/SocialAuthButton.tsx`
- **Variants:** `apple`, `google`, `email` (all map to Button's `social` variant + matching `social` kind)
- **Sizes:** md (h:54 — inherited from Button)
- **States:** default, pressed, loading (Button owns the spinner swap)
- **Used in:** AuthChoiceList (so far)
- **Tweak impact:** Auth flows
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** See the variants. Brand icons baked in. Loading state
replaces label with Spinner (matching icon color).

**Code does (shipped):** Defaults the label per kind ("Continue with
Apple/Google/email") and passes through to Button. The Button
primitive's social variant already paints the right per-kind surface
+ brand glyph, so this feature is effectively a label/order helper.

---

##### `PasswordStrengthMeter`

- **Tier:** feature (composes Text + bespoke 3-segment indicator)
- **Location:** `src/components/features/auth/PasswordStrengthMeter.tsx`
- **Variants:** `default`
- **Sizes:** md (3 segments, 3px height)
- **States:** 0 (empty — neutral) / 1 (weak — accent fill) / 2 (ok — warn fill) / 3 (strong — accent fill)
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer / Creator step 2, Settings password change
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** 3-segment indicator under the password Input. **Weak**
(live red) = <8 chars or single class. **Ok** (warn yellow) = mid
strength. **Strong** (accent) = 12+ chars + mixed classes. Paired with
HelpText giving tone-matching feedback ("TOO SHORT — 8 CHARACTERS
MINIMUM" / "ADD A NUMBER OR SYMBOL" / "STRONG").

**Code does (shipped):** Bespoke 3-segment row (not ProgressBar — that
primitive shares one fill color across segments, but score=2 needs
warn amber). Segments fill up to `score`; fill color is accent for
1/3 and warn for 2 (so the meter telegraphs progress AND quality at
once). Helper line uses `monoLabel` in the matching tone; default
copy provided per score (overridable via `helper` prop).

**API:** `score: 0|1|2|3`, `helper?: string`. Score computation
belongs in `@/lib/passwordStrength.ts` (not yet shipped — the consumer
inlines until then).

---

##### `RulesChecklist`

- **Tier:** feature (composes Icon + Text)
- **Location:** `src/components/features/onboarding/RulesChecklist.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** per-rule — `met` (accent dot + check, primary label), `bad` (accent dot + x, accent label — single-accent rule), `neutral` (outline dot, muted label)
- **Used in:** populated in 12.6 (handle + password rules)
- **Tweak impact:** Handle picker rule visualization, password rule guidance
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Vertical list of rule rows, each with a small status dot
+ label. **Met** = accent dot with check icon, ink label. **Bad** = live
dot with X icon, live label. **Neutral** (not-yet-evaluated) = empty
line dot, dim label. Compact mono labels in tracked caps.

**Code does (shipped):** Stack of rows — 18-circle status dot +
`monoLabel`. Met and bad share the accent fill; the inner glyph
distinguishes them (single-accent rule). Neutral renders as an outline
dot only.

---

##### `SuggestionChipRow`

- **Tier:** feature (composes Pressable + Text)
- **Location:** `src/components/features/onboarding/SuggestionChipRow.tsx`
- **Variants:** `default` (handle suggestions with @ prefix)
- **Sizes:** md
- **States:** default, pressed (opacity 0.7)
- **Used in:** populated in 12.6 (handle picker + future tag suggestions)
- **Tweak impact:** Handle picker (Onboarding + Change Handle), future tag-suggestion surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Horizontal-wrapping row of suggestion chips. Each chip
has an accent @ prefix + the suggested handle. Tap = fills the Input
above.

**Code does (shipped):** `flex-wrap` row of pressable chips. Each chip
combines an accent-colored `@` with the suggestion text. Tap calls
`onPick(value)`.

---

##### `ReassuranceCard`

- **Tier:** feature (composes Icon + Text)
- **Location:** `src/components/features/onboarding/ReassuranceCard.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Handle wizard, Change Handle, Permission flows, any place a small reassuring info card belongs
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Small card with icon-circle on left + body text on right.
Reassuring messaging like "Your handle is changeable. Your account
identity is permanent."

**Code does (shipped):** Bordered `bg.elevated` row — 36-circle icon
tile on `bg.panel` + body text in `text.primary`. Consumer passes
`iconName` (Feather glyph) + `body`.

---

##### `DOBWheel`

- **Tier:** feature (composes Text + FlatList per column)
- **Location:** `src/components/features/onboarding/DOBWheel.tsx`
- **Variants:** `default`
- **Sizes:** md (h:180, 3 columns of 36-tall rows × 5 visible rows)
- **States:** default; center band fixed; neighbors dim by distance (1 = 0.55, 2 = 0.3)
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding age step (Viewer + Creator wizards)
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** iOS-style scroll wheel picker. 3 columns: month / day /
year. Center selection band (line-2 borders top + bottom). Top + bottom
fade gradient. Sans font, tabular-numeric. Selected center value is
bright ink + 600 weight; neighbors are dimmed (opacity 0.55, 0.3).

**Code does (shipped):** Each column is a `ScrollView` (not FlatList —
see note below) with `snapToInterval={ROW_HEIGHT}` and
`decelerationRate='fast'` so RN's native snap handles the gesture
without bespoke PanResponder code. Selected index is recomputed from
`contentOffset.y` in `onMomentumScrollEnd`. The center band (2px
borders top + bottom in `border.strong`) is a non-interactive overlay;
soft fade at the top and bottom uses a translucent `bg.primary` strip
rather than a real gradient (acceptable on a cream canvas; SkiaGradient
or `expo-linear-gradient` can swap in later if needed).

**Why ScrollView, not FlatList.** Initial 2026-05-31 ship used
`FlatList<T>`, which triggered RN's "VirtualizedLists should never be
nested inside plain ScrollViews with the same orientation" warning
whenever DOBWheel rendered inside a vertical-scrolling parent
(WizardShell / ScreenScroll / FeatureGallery). Switched to `ScrollView`
the same day. Each column has ≤100 rows; virtualization is not needed.

**Day-month coupling.** Changing month or year clamps the day to the
new month's max (e.g. picking Feb on Mar 31 lands on Feb 28/29).

**API:** `value: Date`, `onChange(next: Date)`, `minYear?`, `maxYear?`
(defaults: today − 100 .. today).

---

##### `PermissionPrePromptCard`

- **Tier:** feature (composes Icon + Text + Button)
- **Location:** `src/components/features/permissions/PermissionPrePromptCard.tsx`
- **Variants:** `location`, `notifications`, `camera`, `microphone` (each provides default icon + title + bullets + allow-label)
- **Sizes:** N/A
- **States:** default, loading (Button.loading)
- **Used in:** populated in 12.6
- **Tweak impact:** Pre-prompt sequences before any OS permission ask
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Card with a large permission illustration (icon-in-frame
with optional ping animation) + plain title + 2–3 bullet reasons in a
list. Sets context before the OS prompt fires. Never manipulative —
copy says what we want and what users get back.

**Code does (shipped):** Bordered card — 64-circle accent-surface icon
frame, centered heading title, 2–3 bullet rows (6-circle accent dot +
text), primary Allow CTA, optional skip Button. Default title +
bullets + allow-label are baked per kind and overridable via props
when the surface needs more specific copy. The OS prompt fires via
the consumer's `onAllow` handler — this feature does not call
expo-permissions directly.

**Ping animation deferred.** The static accent-bordered icon frame
reads as the "permission illustration" without motion in v1.

---

##### `LegalAcceptanceCard`

- **Tier:** feature (composes Text + Button + ConsentRow + LegalLinkList section)
- **Location:** `src/components/features/onboarding/LegalAcceptanceCard.tsx`
- **Variants:** `default` (US / ROW — no consent toggles), `eu-gdpr` (Essential locked-on + Analytics + Personalization), `ca-ccpa` (Essential locked-on + Do Not Sell)
- **Sizes:** N/A
- **States:** default, loading (button.loading)
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer step 7, Onboarding Creator final, future legal-acceptance surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Card containing 3 link-rows (Terms of service / Community
rules / Privacy policy), jurisdiction-detection badge, then jurisdiction-
specific consent toggles, then "Agree & Continue" button. Three full
variants for the three legal contexts.

**Code does (shipped):** Bordered card hosting an accent jurisdiction
pill ("US / REST OF WORLD" / "EU · GDPR" / "CA · CCPA"), `LegalLinkList`
section with the docs array, variant-specific ConsentRow stack
(Essential is locked-on across the two non-default variants), and an
"Agree & Continue" primary Button.

**Jurisdiction detection** is the consumer's job — locale + IP
heuristic lives outside this feature. Resolved consent settings are
emitted on each toggle change via `onConsentsChange(LegalConsents)`;
on submit, the consumer calls `onAgree()`.

---

##### `ConsentRow`

- **Tier:** feature (composes Text + Toggle)
- **Location:** `src/components/features/onboarding/ConsentRow.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** off, on, locked-on (Toggle forced on + disabled)
- **Used in:** populated in 12.6 (LegalAcceptanceCard rows + Settings)
- **Tweak impact:** LegalAcceptanceCard, Settings notification preferences, future consent surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Row with title (sans body, ink) + description (mono caps,
dim) on the left, Toggle on the right. Locked variant has the Toggle
disabled in the on state.

**Code does (shipped):** Title + optional description column + Toggle
on the right. When `locked` is true the Toggle is forced to `true` and
disabled regardless of the `on` prop.

---

##### `AgeGateCard`

- **Tier:** feature (composes Icon + Text + Button)
- **Location:** `src/components/features/onboarding/AgeGateCard.tsx`
- **Variants:** `default`
- **Sizes:** lg (full-width centered)
- **States:** default — only render state, the card itself is the
  terminal state
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding age step refusal (terminal state — no retry)
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Card with clock icon-circle (line-2 border) + heading
("Wrld is 18+") + body explaining the refusal + secondary "Take me
back" button. Centered, respectful tone. **Terminal — no retry, no
"try a different date" link, no joke.**

**Code does (shipped):** Bordered card — 72-circle clock icon frame
(line-2 border in `border.strong`), display title centered, muted body
centered, single secondary "Take me back" Button. The
terminal-no-retry behavior is structural — the parent wizard doesn't
allow re-entry; this card surfaces no alternative path.

---

##### `LocationGranularityPicker`

- **Tier:** feature (composes Pressable + Text + Icon + inline preview helpers)
- **Location:** `src/components/features/onboarding/LocationGranularityPicker.tsx`
- **Variants:** `default`
- **Sizes:** N/A
- **States:** selected option drives visual; bluedot adds a warn-toned "HIGHEST PRIVACY COST" caption + warn border when selected
- **Used in:** populated in 12.6
- **Tweak impact:** Creator wizard location step, future privacy-granularity surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** 4 radio cards (Bluedot — exact pin, City — fuzzy circle,
Country — big shape, Private — eye-off). Each card has a map-style
visual preview, title, description, and a radio bullet. Selected card
has accent border + glow + accent radio fill. Bluedot warns
(`data-tone="warn"`).

**Code does (shipped):** 4 cards (Pressable) stacked. Each row has a
64-square preview frame (inline `GranularityPreview` helpers with a
faint map grid + per-kind glyph) + title + mono description + 22-radio
bullet. Selected card swaps border + bg to accent + fills the bullet.
Bluedot adds a warn-toned subtitle and (when selected) a warn-colored
border to telegraph the privacy cost.

**Inline previews.** The grid + pin / circle / shape / eye-off are
drawn from primitives, no SVG yet. Real map illustrations can swap
into the `GranularityPreview` switch later without API change.

**API:** `value`, `onChange(next)` where the union is
`'bluedot' | 'city' | 'country' | 'private'`.

---

#### Settings / Identity Management

##### `SettingsRow`

- **Tier:** feature (composes Pressable + Icon + Text)
- **Location:** `src/components/features/settings/SettingsRow.tsx`
- **Variants:** `default`, `highlight` (accent-tinted background + accent icon-tile, for primary identity row)
- **Sizes:** md
- **States:** default, pressed (via Pressable variant `subtle`)
- **Used in:** populated in 12.6 (Settings + Me migrations)
- **Tweak impact:** Settings, Me, Wallet header (Top Up / Cash Out tiles share patterns), future config surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Grid: icon-tile (36×36) + col (title + value + optional
AccountIDPill) + chevron arrow. Border-top separates from previous row.
The **highlight** variant is accent-tinted background for the primary
identity row (Handle).

**Code does (shipped):** Row layout — optional 36×36 icon-tile on the
left (in `bg.panel`, or accent surface + border when `variant=highlight`),
title + optional value column in the middle, right slot on the right.
Right slot is configurable: pass `right` for any node (Toggle,
AccountIDPill, custom), or `arrow` for a chevron — chevron is also
auto-supplied when `onPress` is set with no explicit right slot.
Border-top hairline by default (opt-out with `showBorderTop={false}`
on the first row of a group) so a stack of rows reads as a grouped
list without the parent rendering its own dividers. Grouping rows into
cards/sections remains the parent's job.

**API:** `variant?`, `iconName?` (Feather glyph or omitted for
text-only), `title`, `value?`, `right?`, `arrow?`, `showBorderTop?`,
`onPress?`. AccountIDPill (when shipped) drops into the `right` slot
or alongside the title via the consumer's layout — the row stays
domain-blind.

---

##### `SwapCard`

- **Tier:** feature (composes Text + Icon)
- **Location:** `src/components/features/identity/SwapCard.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6 (Change Handle confirm step)
- **Tweak impact:** Change Handle confirm step, future FROM/TO confirmation surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Accent-tinted card showing "FROM" with strikethrough old
value + accent arrow + "TO" with new value. Used when confirming a
mutation that swaps one value for another.

**Code does (shipped):** Row layout — FROM column (mono-caps label
in `text.subtle` + value in `text.muted` with line-through), accent
`arrow-right` icon, TO column (mono-caps label in `accent.default` +
value in `text.primary`). Card itself is the accent-tinted surface
(`accent.surface` bg + `accent.border` border). Both value lines use
`numberOfLines: 1` so long values truncate rather than wrap and break
the layout.

**API:** `fromLabel?` (default "FROM"), `fromValue`, `toLabel?` (default
"TO"), `toValue`. Strikethrough applied to `fromValue` automatically.

---

##### `ToastBanner`

- **Tier:** feature (composes Pressable + Icon + Text + Animated)
- **Location:** `src/components/features/feedback/ToastBanner.tsx`
- **Variants:** `accent` (default — accent.surface tint, info glyph), `warn` (amber tint, alert-triangle), `err` (accent.surface, alert-circle — single-accent rule), `success` (accent.surface, check-circle — single-accent rule)
- **Sizes:** md
- **States:** entering (animated slide-down + fade-in on mount), visible, auto-dismiss timer
- **Used in:** populated in 12.6 (post-handle-change confirmation, post-tip broadcaster toast, post-report submission, etc.)
- **Tweak impact:** post-action confirmations, viewer-side ephemeral notices, post-tip broadcaster toast (Phase 13)
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Accent-tinted card with icon + body + optional bold
emphasis. Auto-dismiss after 3–5s. Floats above content.

**Code does (shipped):** Row layout — leading icon + body + dismiss X.
On mount, slides down 8px while fading from 0→1 over 180ms
(`theme.motion.timing.fast`). Auto-dismiss timer fires `onDismiss`
after `autoDismissMs` (default 3500; pass 0 to disable for
persistent-until-tap rows). Per-variant icon glyph + tint resolved
internally; consumers can override the glyph via `iconName`.

**API:** `variant?`, `body`, `iconName?`, `onDismiss`, `autoDismissMs?`.
The consumer owns mount/unmount + position (top of screen, inside a
sheet, etc.).

**Exit animation deferred.** v1 disappears instantly when the consumer
unmounts after `onDismiss`. Adding a fade-out is a one-line follow-up
if the abrupt removal reads poorly in practice.

**Warn tint hex.** `rgba(200,134,30,0.10)` surface + `rgba(200,134,30,0.32)`
border are computed inline from `palette.amber400` (#c8861e). A
`warn.surface` / `warn.border` token pair would belong in the theme
if a second warn-tinted surface appears.

---

#### Monetization

##### `PursesCard`

- **Tier:** feature (composes Text)
- **Location:** `src/components/features/wallet/PursesCard.tsx`
- **Variants:** `dual` (Space Bucks + Star Dust hero, side-by-side), `single-sb`, `single-sd`
- **Sizes:** md (hero)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 hero, Top Up context strip, Cash Out hero
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Dual-currency hero card showing Space Bucks balance and
Star Dust balance side-by-side. Each side: accent-tinted (SB) or
live-tinted (SD) glow, currency glyph (4-point star for SB, rose-cut
gem for SD), big numeric balance (tabular), bottom row with $ equivalent
+ rate hint.

**Code does (shipped):** Card with two Purse columns (or one for the
single variants) separated by a hairline. Each Purse renders a
mono-caps label ("SPACE BUCKS" / "STAR DUST") + glyph (🚀 / ✨ — copy
glyphs; bespoke currency icons can swap in via the same purse-internal
helper later), a display-variant tabular balance, and a mono caption
"$X.YZ · $0.01/unit". Both currencies are $0.01/unit per the
2026-05-29 re-baseline; the 30% platform fee on transfer is invisible
here (handled in TransactionRow / tip flow).

---

##### `TransactionRow`

- **Tier:** feature (composes Pressable + Icon + Text)
- **Location:** `src/components/features/wallet/TransactionRow.tsx`
- **Variants (`kind`):** `tip-sent`, `tip-received`, `sub-paid`, `sub-earned`, `ppv-paid`, `ppv-earned`, `topup`, `cashout`, `promo`, `refund`, `hold`
- **Sizes:** md
- **States:** default, pending (PENDING label below amount), pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 transaction list, future transaction-detail surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Grid: thumbnail-tile (40×40, colored by kind + currency
direction) + meta column (title + sub) + amount column (mono, signed,
USD equivalent below). Pending state shows "PENDING" label below
amount.

**Code does (shipped):** 40-square icon tile (Feather glyph picked by
kind) + meta column (title + optional sub) + right-aligned amount
column (signed unit qty + glyph, USD line, optional PENDING in warn).
Direction (+/−) is fixed per kind. Currency glyph baked into the
amount line for visual scan.

**API:** `{ kind, title, sub?, amount, currency: 'sb'|'sd', pending?,
onPress? }` — consumer-flat. Subs/PPV/topup/cashout kinds ship in
v0.2 per the re-baseline but emit no real transactions yet.

---

##### `BundleCard`

- **Tier:** feature (composes Pressable + Text)
- **Location:** `src/components/features/wallet/BundleCard.tsx`
- **Variants:** `default`, plus optional `badge` prop ('best-value' / 'most-popular' / 'vip')
- **Sizes:** md
- **States:** default, selected (accent border + accent.surface bg + filled bullet), disabled (opacity 0.45)
- **Used in:** populated in 12.6
- **Tweak impact:** Top Up bundle picker, future bundle surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Radio card: pick bullet (22×22, animated fill) + body
(token glyph + qty + per-token meta) + price column (USD price + per-
unit savings %). Selected = accent border + glow. Optional corner badge
(BEST VALUE accent / MOST POPULAR accent-hot / VIP ink).

**Code does (shipped):** 22-circle bullet (accent fill when selected)
+ body (qty 🚀 + optional "N% off vs. base") + price column. Selected
state managed by parent — passed in via `selected`. Corner badge
positioned absolute top-right; vip uses ink surface + cream label,
others use accent. Animated bullet fill is deferred (instant swap on
selection) — not visually missed.

---

##### `AmountInput`

- **Tier:** feature (composes Text + TextInput + Slider)
- **Location:** `src/components/features/wallet/AmountInput.tsx`
- **Variants:** `tip` (🚀 SPACE BUCKS), `cashout` (✨ STAR DUST + net-after-fee line when `platformFeePct` is set)
- **Sizes:** md
- **States:** default, invalid (consumer provides `invalidReason`; rendered in accent)
- **Used in:** populated in 12.6
- **Tweak impact:** TipSheet, Cash Out screen, future amount-entry surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Large numeric input (40px, sans 600) with currency glyph
prefix + unit pill suffix. USD equivalent shown below. Fee breakdown for
Cash Out variant (shows net amount after platform fee). Slider beneath
for snap-to-step adjustment. Preset chips (4-up grid) for quick amounts.

**Code does (shipped):** Glyph + 40px numeric `TextInput` (number-pad
keyboard, digits-only sanitizer) + mono-caps unit label, USD line
below, optional net-after-fee line for cashout, optional invalid
message in accent. Slider primitive handles snap-to-step adjustment.

**API:** `variant`, controlled `value` + `onValueChange`, `max`,
`min?`, `step?`, `platformFeePct?`, `invalidReason?`. Preset chips
live in a sibling section (PresetGrid) rather than inside this
feature.

---

##### `BankCard`

- **Tier:** feature (composes Pressable + Icon + Text)
- **Location:** `src/components/features/wallet/BankCard.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, pressed (Change link)
- **Used in:** populated in 12.6
- **Tweak impact:** Cash Out payee selection, future linked-account surfaces (stubbed v0.2 per re-baseline)
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Card with bank icon-tile (38×38), meta column (bank name
masked + last 4 digits), and a "Change" link button on the right.

**Code does (shipped):** 38-square icon tile (`credit-card` glyph) +
meta column (bank name + masked "•••• XXXX") + optional "Change"
link-style Pressable in accent. Card surface = `bg.elevated` with
subtle border. Component ships v0.2 per re-baseline; bank-linking
itself is v0.3.

---

#### Broadcasting / Live

##### `FeedRow`

- **Tier:** feature (composes FeedThumb + Text + Toggle)
- **Location:** `src/components/features/broadcast/FeedRow.tsx`
- **Variants:** one per layer (`cam`, `audio`, `screen`, `loc`, `gyro`, `compass`)
- **Sizes:** md
- **States:** per-affordance air on/off + rec on/off (all four combinations valid); availability `available` / `denied` ("PERMISSION DENIED ·" prefix) / `disabled` (dimmed 0.55, toggles locked — the detail text carries the status, e.g. "capture pending" / "v0.3+")
- **Slots/props:** `showRec` / `showAir` (hide either affordance); `leading`
  (replace FeedThumb with a custom icon tile); `trailing` (replace the
  affordances entirely); `footer` (full-width sub-control under the row)
- **Used in:** `DashboardScreen` (Go Live arming — full source suite; the
  Location + Identity rows use `leading` icon tile + `footer` segment with
  `showAir={false}`) — 2026-06-05
- **Tweak impact:** Go Live arming screen
- **Shipped:** 2026-05-31 (sub-phase 12.5). **Redesigned 2026-06-03** to the two-affordance capture model (clips initiative · C2). **Sensitivity badges + record-consent lock-hint removed 2026-06-03** (see decision log). **`showAir` + `leading` added 2026-06-05** (Location/Identity no-Air-toggle layout).

**Mock says:** Row: thumb + meta (label + detail) + TWO affordances per
source — **Air** (broadcast live) and **Rec** (save to device). Location
carries a precision-ceiling sub-control below the row.

**Code does (shipped 2026-06-03):** Self-contained bordered card
(FeedThumb + meta column with label + detail + the two labelled `AIR` /
`REC` Toggles); the consumer stacks cards with a gap. `availability`
(`denied` / `disabled`) dims the card and locks both toggles. The
optional `footer` slot renders a full-width sub-control under the row
(DashboardScreen passes a 4-segment precision ceiling for `loc`). The
`trailing` slot **replaces** the Air/Rec affordances entirely — the
Identity row uses it for an inline Public/Anon `SegmentedToggle`,
since identity is a flag, not a capturable track (air/rec props become
optional when `trailing` is set). The `live` prop (default false)
renders on-toggles in the Toggle `armed` (cued, outline-not-fill) state
until the broadcast actually goes live — so the toggles are
set-it-and-forget-it and the commit button never flips them.

**Sensitivity friction removed (2026-06-03).** The SENSITIVE/BENIGN tag,
the Rec consent lock-hint, and the `sensitivity` / `recNeedsConsent`
props are gone for now — Rec flips directly for every source and the
Dashboard no longer presents `RecordConsentSheet`. The feature (and its
gallery entry) survive for when the consent flow returns.

**Composition note.** The 2026-06-03 plan proposed building the two
affordances from `SegmentedToggle`; the chosen go-live-record mock uses
two independent Toggles (air can be on without rec and vice versa — a
segmented Live/Vault/Off control can't express air-without-record), so
the shipped row composes two `Toggle`s. The location ceiling reuses
`SegmentedToggle` (4 options) rather than the full
`LocationGranularityPicker` card — the picker is too heavy for an inline
footer.

**Rec affordance now optional (2026-06-04).** Recording moved off the dashboard
to a single Record button on the stream view (see the decision log). `FeedRow`
gained a **`showRec`** prop (default `true`) — the Rec Toggle only renders when
`showRec`. `DashboardScreen` passes `showRec={false}` (it arms **Air only**
now); the gallery keeps the default so the two-affordance capability stays
documented for a future per-source record surface (e.g. the clip editor).

---

##### `FeedThumb`

- **Tier:** feature (sub-component of FeedRow; usable standalone)
- **Location:** `src/components/features/broadcast/FeedThumb.tsx`
- **Variants:** sensor model — `cam` (viewfinder corners), `audio` (animated bars), `screen` (mock device + traffic lights), `loc` (ping ring + pin on grid), `gyro` (rotating cube), `compass` (oscillating needle), `profile` (avatar silhouette); v0.3+ earmarked (static Feather glyph) — `speed`, `torch`, `temp`, `motion`
- **Sizes:** md (76×60), lg (160×110 — Clip Edit preview hero)
- **States:** active (default), paused (opacity 0.45 + animations frozen)
- **Used in:** populated in 12.6
- **Tweak impact:** Go Live FeedRow thumbs, Clip Edit preview fallbacks, future broadcast-layer visualizations
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Per-layer animated mini visualization. Each layer has a
distinct visual treatment that suggests its data shape (waveform for
audio, ping-on-grid for location, rotating cube for gyro, etc.).

**Code does (shipped):** Per-kind renderer composing primitives + RN
`Animated.View` patterns (no SVG yet). Audio bars vary height in a
loop; loc pulses a ring outward while opacity fades; gyro rotates 360°;
compass needle oscillates. When `active=false` the outer frame dims to
opacity 0.45 and the per-kind animation effects are not started (or
freeze at their last frame). v1 fidelity is "design-system motion"
rather than exact mock illustration — real illustration assets can
swap into the per-kind renderers without API change.

---

##### `GoBar`

- **Tier:** feature (composes Pressable + Text + Icon + Animated)
- **Location:** `src/components/features/broadcast/GoBar.tsx`
- **Variants:** `idle`, `armed`, `counting`, `live`, `disabled`
- **Sizes:** lg (h:64, full-width, r:20)
- **States:** managed by variant; `live` adds a slow knob-pulse loop
- **Used in:** populated in 12.6
- **Tweak impact:** Go Live docked bottom CTA
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Big docked-bottom CTA with label + knob on the right.
**Armed** = accent-tinted bg + glow. **Counting** = countdown ring
overlay. **Live** = live-tinted bg + live-knob + intense glow. State
transitions are dramatic.

**Code does (shipped):** 64-tall bar with rounded-20 corners. Label
column on the left, 48-circle knob on the right. Variants drive bg
tint + label + knob copy:
- idle: neutral bg, "READY WHEN YOU ARE", knob = GO
- armed: accent.surface, "GO LIVE", knob = GO
- counting: accent.surface, "GOING LIVE…" + "STARTING IN Ns" mono
  caption (consumer passes `countdownSec`), knob = …
- live: accent.surface, "LIVE · TAP TO STOP", knob = square icon with
  slow opacity pulse (800ms ↑/↓ Animated.loop)
- disabled: opacity 0.45, non-interactive, "CHECK YOUR SOURCES"

A full countdown ring overlay was scoped out for v1 — the mono caption
carries the seconds and the live-state pulse covers the dramatic tone.

**Clips-initiative resolution (shipped 2026-06-03 · C2):** GoBar gained
optional `label` / `knobLabel` overrides so the same `armed` bar can read
"START RECORDING" / "REC" for a record-only commit. **Single-button
update (2026-06-03, same day):** the Dashboard consolidated to a single
docked GoBar — the per-source Air/Rec toggles are the source of truth
(armed → live via the Toggle `armed` state) and one button commits
whatever they say. The `ArmButton` pair is no longer used on the
Dashboard (kept as a feature for any future dual-intent surface).

**Superseded on the Dashboard (2026-06-04):** the single GoBar was replaced
by `GoLiveRecordBar` (two matched buttons: Go Live + Record). GoBar stays in
the library + gallery for any future single-CTA surface.

---

##### `GoLiveRecordBar`

- **Tier:** feature (composes `Pressable` + `Text`)
- **Location:** `src/components/features/broadcast/GoLiveRecordBar.tsx`
- **Props:** `isLive`, `liveDisabled?`, `onLivePress`, `style?`; plus
  `isRecording?` / `recordDisabled?` / `onRecordPress?` kept optional for when
  the Record button returns (currently unused)
- **States:** single full-width button, two looks driven by `isLive` —
  **Go Live** (light accent-tint fill + accent border/label) → **End Stream**
  (solid accent/red fill + cream label)
- **Used in:** `DashboardScreen` (docked footer) + `StreamScreen` (preview +
  live), with shared state from `broadcastStore` so both read identically
- **Tweak impact:** the shared broadcast control on both surfaces
- **Shipped:** 2026-06-04

**Code does:** one full-width button built from `Pressable` + `Text` (not the
Button primitive — it needs accent-tint fill *with* an accent label, which
Button doesn't expose). Not-live = `accent.surface` fill + `accent.border` +
`accent.default` label; live = `accent.default` fill + `text.inverse` label.
State is the global `broadcastStore` (`isLive`), so the dashboard and the
stream view never disagree; when live, the dashboard's press acts on the
mounted StreamScreen via the store `command`.

**Record verb retired (Rolling Buffer, 2026-06-05).** Originally two matched
buttons (Go Live + Record), then the Record button was pulled (2026-06-04). The
rolling-buffer model makes that permanent: going live *is* recording (into the
buffer), so there is no Record button by design — the durable verb is "Save a
clip" (`SaveClipButton`). The `isRecording?` / `recordDisabled?` / `onRecordPress?`
props are now a vestigial compat shim, ignored by the component; they keep the
Dashboard / StreamScreen consumers type-checking until Aaron removes the wiring
there (the design→main seam).

---

##### `BufferWindowLabel`

- **Tier:** feature (composes `Icon` + `Text`)
- **Location:** `src/components/features/broadcast/BufferWindowLabel.tsx`
- **Props:** `reachesBack` (Date | epoch ms), `floorHours?`, `now?`, `style?`
- **States:** reach-only, or reach + a quiet max-quality floor caption
- **Used in:** clip editor / profile (Aaron, R5) — shows how far back the live
  rewind currently reaches as a concrete timestamp, not a bare duration
- **Tweak impact:** the rolling-buffer reach readout
- **Shipped:** 2026-06-05 (Rolling Buffer · R4)

**Code does:** cream-palette card — accent-tint icon tile (`rotate-ccw`) + a
mono `REWIND AVAILABLE` eyebrow, `Reaches back to ~Tue 3:00 PM` (today/yesterday/
weekday + 12h time, formatted from `reachesBack` vs `now`), and an optional
`At least ~Nh even at max quality` caption from `floorHours`. Presentational;
the host supplies the backend's earliest-available instant.

---

##### `SaveClipButton`

- **Tier:** feature (composes `Pressable` + `Icon` + `Text`)
- **Location:** `src/components/features/broadcast/SaveClipButton.tsx`
- **Props:** `onPress`, `disabled?`, `label?` (default "Save a clip"), `hint?`, `style?`
- **States:** default, with-hint (second line), disabled
- **Used in:** stream view / library (Aaron, R5) — the durable capture verb that
  replaces the retired Record button / `RecordCircle`
- **Tweak impact:** the only capture CTA under the rolling-buffer model
- **Shipped:** 2026-06-05 (Rolling Buffer · R4)

**Code does:** sibling of `GoLiveRecordBar`'s idle button — `accent.surface`
fill + `accent.border` + `accent.default` label (built from `Pressable` + `Text`,
not Button, for the accent-label-on-accent-tint look) with a `scissors` icon and
optional `hint` caption.

---

##### `RewindLadder`

- **Tier:** feature (composes `Icon` + `Text`; reads `@/lib/tierCaps`)
- **Location:** `src/components/features/broadcast/RewindLadder.tsx`
- **Props:** `currentTier?` (`'free' | 'plus' | 'pro'`), `style?`
- **States:** per-tier rows; the current tier gets accent surface/border + a
  `Current` mono tag
- **Used in:** `SubscriptionScreen` (Aaron) — the rewind window + capture
  resolution ladder (Free 24h/720p · Plus 3 days/1080p · Pro 7 days/1440p)
- **Tweak impact:** the subscription rewind/resolution comparison
- **Shipped:** 2026-06-05 (Rolling Buffer · R4)

**Code does:** maps `TIER_LADDER` from `@/lib/tierCaps` (the single source of
truth Aaron's `getUserMedia` cap also reads) to a column of bordered rows —
tier label on the left, `rotate-ccw` window + `video` resolution mono values on
the right. No tier numbers live in the component.

---

##### `ArmButton`

- **Tier:** feature (composes Pressable + Icon + Text)
- **Location:** `src/components/features/broadcast/ArmButton.tsx`
- **Variants:** Go Live (passes `iconName`) · Record (omits `iconName` → renders a filled accent dot)
- **States:** `idle` (neutral surface, hollow dot), `armed` (accent.surface + accent.border, accent state label), `active` (accent fill + cream content — committed/live/recording)
- **Used in:** none currently (Dashboard consolidated to a single GoBar 2026-06-03; kept for future dual-intent surfaces)
- **Tweak impact:** dual-intent arming surfaces
- **Shipped:** 2026-06-03 (clips initiative · C2)

**Mock says (A1):** Two tall arming cards at the top — Go Live (left)
and Record (right) — each idle / armed (cued) / active (firing), since
going live and recording are independent intents.

**Code does (shipped):** Tall (min-h 96) card composing an icon-or-dot +
label ledge, a state dot top-right, and a mono-caps state label.
`armed` swaps to accent surface + border; `active` fills accent with
cream (`text.inverse`) content. Consumer-flat — `label`, `stateLabel`,
`state`, optional `iconName`, `onPress`. DashboardScreen derives state
from the per-source air/rec sets and uses each button as a master
arm/disarm of its intent's defaults.

---

##### `RecordConsentSheet` — PARKED (retired by rolling buffer, 2026-06-05)

**Retired (Rolling Buffer · R4).** Under capture ⊆ broadcast there is no
record-without-broadcast path, so the record-consent step has nothing to gate
("nothing you didn't broadcast is ever kept"). The component is kept **parked**
(not deleted) for a possible future non-friends-and-family return; it is wired
into no screen and shown in the gallery as parked. The SENSITIVE/BENIGN tiering
it depended on is likewise retired. Original spec below.

- **Tier:** feature (composes BottomSheet + Icon + Text + Button)
- **Location:** `src/components/features/broadcast/RecordConsentSheet.tsx`
- **Variants:** `default` (per-source copy defaulted from `sourceLabel`, fully overridable)
- **States:** visible / hidden (consumer-driven)
- **Used in:** `DashboardScreen` (sensitive-source record gate) — 2026-06-03
- **Tweak impact:** Go Live & Record arming — sensitive-source record consent
- **Shipped:** 2026-06-03 (clips initiative · C2)

**Mock says (A2):** Bottom sheet shown when Record is enabled for a
sensitive source. Lock icon-frame + title + lede + a "what's saved"
list (each row: accent dot + bold line + mono sub-caption) + accent
"Turn on recording" / quiet "Not now" + fine print. Non-manipulative,
easy decline.

**Code does (shipped):** `BottomSheet` (`expanded`) hosting the
accent-framed lock icon, heading, muted lede, a bordered bullet list
(`{ text, caption }[]` with per-source defaults), the confirm + "Not
now" Buttons, and the mono fine-print line. Confirm flips the source's
Rec on and records consent so it won't re-prompt. The capture guardrail
("nothing recorded silently") is realised here.

---

##### `BroadcastStatusIndicator`

- **Tier:** feature (composes Text + Icon)
- **Location:** `src/components/features/broadcast/BroadcastStatusIndicator.tsx`
- **Variants:** none — the header + note are derived from the air/rec asymmetry (`live + recording same set` / `recording more than airing` / `recording but not live`), both overridable
- **States:** per-source AIR / REC chips (accent fill for on, outline + red dot for rec, dim for off)
- **Used in:** `StreamScreen` (broadcaster live overlay, while recording) — 2026-06-03
- **Tweak impact:** broadcaster live overlay
- **Shipped:** 2026-06-03 (clips initiative · C2). Resolves the "(planned)" feature-or-inline question — shipped as a reusable feature.

**Mock says (A3):** Persistent during-broadcast readout distinguishing
what's **on air** from what's **only recording**, over the live video.
Translucent dark panel; header + "● REC"; per-source rows with AIR / REC
chips; a note line explaining the asymmetry.

**Code does (shipped):** Dark-glass panel (documented `rgba(...)`
exception to criterion 1, pending a `bg.darkGlass` token — same
treatment as StreamScreen's other over-video surfaces) with a header
(auto or overridden) + REC badge, per-source rows (Icon + label + AIR/REC
chips), and a derived note. Consumer-flat `sources: { label, iconName,
air, rec }[]`. **Faithful-state note:** the shipped backend records the
aired set as a whole, so StreamScreen renders the "on air is also saved"
case while recording; the per-source asymmetry cases (rec-only sensitive
source) are exercised in the gallery and light up when backend supports
per-source record (Aaron's lane).

---

##### `ChatMessage`

- **Tier:** feature (composes Text)
- **Location:** `src/components/features/chat/ChatMessage.tsx`
- **Variants:** `self` (your own handle — primary accent `accent.default`), `user` (everyone else — secondary accent `accent.bright`; 2026-06-09, was `text.muted`), `mod` (handle in `warn` amber), `host` (handle in `accent.default`), `system` (no handle — full mono caps line in `text.inverse`)
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6 (ChatOverlay refactor)
- **Tweak impact:** Broadcast Live chat list, viewer chat overlay
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Inline message: bold colored handle (role-coded) + plain
body. **System** messages are full mono caps. Text-shadow for legibility
over video.

**Code does (shipped):** Inline row using nested RN `<Text>` so handle +
body wrap naturally as one line. Handle uses Text variant
`bodyEmphasized` in the role color; body uses Text variant `body` in
`text.inverse` (cream). System rows render a single `monoLabel` line
(no handle slot). Every text span carries a uniform text-shadow
(`rgba(0,0,0,0.6)`, offset 0/1, radius 2) so the message stays legible
when overlaid on the live video.

**API:** consumer-flat — `{ role, handle, body }`. The feature does
not own scrolling, virtualization, or send semantics; those belong to
the section that wraps it (12.6 ChatOverlay refactor).

---

##### `ChatComposer`

- **Tier:** feature (composes Input + IconButton + Spinner)
- **Location:** `src/components/features/chat/ChatComposer.tsx`
- **Variants:** `default`
- **Sizes:** 44-tall rectangle Input + 44-circle send button (on one line with the live camera-flip + chat-close buttons)
- **States:** empty (send disabled), has-text (send enabled), sending (input non-editable, send swaps to spinner-in-accent-disc), unauthenticated (input shows "Sign in to chat" placeholder, whole row is a Pressable that fires `onAuthRequest`)
- **Used in:** populated in 12.6 (ChatOverlay refactor)
- **Tweak impact:** Broadcast Live composer, ChatOverlay refactor
- **Shipped:** 2026-05-31 (sub-phase 12.5)
- **Last reviewed:** 2026-05-31

**Mock says:** Round 999-radius Input + circular accent send button. The
input has a placeholder. Send disabled when empty.

**Restyled to the rectangle field 2026-06-05.** The pill was retired so the
chat input matches the harmonised search / title fields: it now inherits the
Input primitive's `radius.md` + `bg.elevated` + border, with only a compact
44-tall height overridden via `style` (no new variant). On the live stream this
sits on one line with the circular `accent` send button and the `surface`
camera-flip + chat-close buttons (all 44px), per the "rectangle field + round
buttons" decision.

**Code does (shipped):** Controlled feature — `value`, `onChangeText`,
`onSubmit` passed in. Send is an IconButton variant `accent` size `lg` (44px).
Spinner replaces the send button while `sending`. Unauth mode wraps the row in a Pressable
that calls `onAuthRequest`, so the screen can present the Phase 10
AuthModal at the point of attempt.

**API:** consumer-flat — `value`, `onChangeText`, `onSubmit`,
`sending?`, `authenticated?`, `onAuthRequest?`, `placeholder?`. Send
enabled iff `authenticated && !sending && value.trim().length > 0`.

---

#### Clip Editor

##### `ClipPreview`

- **Tier:** feature (composes VideoPreviewTile + FeedThumb + Pressable + Icon + Text)
- **Location:** `src/components/features/clip/ClipPreview.tsx`
- **Variants:** `camera` (composes VideoPreviewTile.play), `audio-only` (FeedThumb.audio lg + "AUDIO ONLY"), `map-only` (FeedThumb.loc lg + "LOCATION ONLY")
- **Sizes:** lg (16:11 hero)
- **States:** playing / paused (consumer drives via `playing`), progress (consumer drives via `progressPct`)
- **Used in:** populated in 12.6
- **Tweak impact:** Clip Edit hero, future clip-detail surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** 16:11 hero preview. Three fallback states based on which
layers were captured: camera (default), audio-only (animated waveform +
"AUDIO ONLY" label), map-only (gridded background + pinging location pin).
Always has playback controls overlaid (play button + progress bar +
scrubber).

**Code does (shipped):** 16:11 framed container. Camera variant lets
VideoPreviewTile own the thumb + play affordance; fallback variants
reuse FeedThumb (lg) for the visualization. Bottom-docked control
strip (rgba(0,0,0,0.45) backdrop) carries a 36-circle play/pause
button and a 3px progress track filled in `accent.bright`. Scrubber
gesture is not yet implemented — `onTogglePlay` is the only
interaction surfaced. Scrub handling lives in the parent Timeline
feature when the consumer needs it.

---

##### `Timeline`

- **Tier:** feature (composes Text + bespoke track + PanResponder)
- **Location:** `src/components/features/clip/Timeline.tsx`
- **Variants:** `default` (trim handles opt-in via `trimStart` + `trimEnd` + `onTrimChange`)
- **Sizes:** md (h:44)
- **States:** scrub-only (no trim handles), trim (handles visible + draggable)
- **Used in:** populated in 12.6
- **Tweak impact:** Clip Edit timeline, future video-editing surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Track with waveform bars in the background, current
playhead scrubber, optional trim handles defining the "active" region
with accent borders + handles. Trimmed-out regions get a dark overlay
with a hatched pattern.

**Code does (shipped):** 44-tall track with a row of waveform bars
(default seed + `waveformPeaks?` override). Three independent
PanResponders — one for the scrubber (clamped to `[trimStart,
trimEnd]`), one per trim handle (clamped to keep them apart and inside
`[0, duration]`). Trim regions outside `[trimStart, trimEnd]` get a
30%-black overlay; the active region gets accent top/bottom borders
inside the band. Time labels below the track (current / total).

**Hatched pattern deferred.** Mock calls for diagonal-stripe overlay
on the trimmed-out regions; v1 uses a flat black-overlay because RN
has no built-in striped fill. A pattern primitive can swap into
`trimOverlay` later without API change.

---

##### `LayerEditorRow`

- **Tier:** feature (composes Pressable + Text + Icon + IconButton + Toggle)
- **Location:** `src/components/features/clip/LayerEditorRow.tsx`
- **Variants:** `default`, `id-layer` (consumer-driven anonymize semantics; UI parity with default in v0.2)
- **Sizes:** md
- **States:** on, off, deleted (dashed accent border + strikethrough name + RESTORE button)
- **Used in:** populated in 12.6
- **Tweak impact:** Clip Edit layers panel
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Row: icon-tile (34×34, accent-tinted when on) + col (name
+ tone-status pill + dim description) + Toggle + row-menu IconButton.
**Deleted** state has live-tinted icon + strikethrough name + dashed
hide-affordance. Permanent-cut action (live-tone outline button) appears
when the row is selected.

**Code does (shipped):** 34-square icon tile (accent surface + border
when on), name + optional inline status pill + optional description
column, Toggle (hidden in `deleted`), optional row-menu IconButton
(`more-vertical`, ghost). Deleted state replaces the Toggle with a
RESTORE link-style Pressable that emits `onUndelete`.

**id-layer variant.** v0.2 ships with the same UI as default — the
distinguishing behavior (anonymize retroactively) lives in the
consumer's `onToggle` handler. When the anonymize confirm flow lands
the variant can hook a deeper UI in.

**Planned (clips initiative · C2 · Ben / `design`):** the per-source manifest model
needs two state clarifications. (1) Add a **not-captured** state — a source that
wasn't in the record set (disabled / greyed, nothing to enable). (2) Distinguish
the reversible hide (shipped `deleted` + RESTORE, i.e. manifest `off`) from an
**irreversible delete-permanently** (removes the track from disk, reclaims quota,
confirm dialog, no RESTORE). Revealing a record-only source is the `off → on`
transition. See the 2026-06-03 decision-log entry.

---

##### Buffer-trim clip editor (proposed · clips initiative · C2 · Ben / `design`)

The eight elements below are the **buffer-trim clip editor** (Aaron's 2026-06-06
handoff brief). **Status: built on `design` 2026-06-06 (C2)** against mock /
stubbed buffer data + gallery entries (Feature gallery). Screen wiring
(`ClipEditScreen` / `LibraryScreen`) is Aaron's later step. Mocks:
[`clip-editor-buffer-trim-portrait.html`](docs/design/mocks/clip-editor-buffer-trim-portrait.html)
(screen 1, 6 frames) +
[`saved-clips-list-portrait.html`](docs/design/mocks/saved-clips-list-portrait.html)
(screen 2, 3 frames). They **supersede** the single-track `Timeline` trimmer
(above) for the clip-from-rolling-buffer flow — `Timeline` stays as the conceptual
ancestor for non-buffer / future video-edit surfaces. Reused unchanged:
`ClipPreview`, `VideoPreviewTile`, `FeedThumb`, `StreamTile`, `BottomSheet`,
`BufferWindowLabel`, `SaveClipButton`, `Input`, `Button`, `Toggle`, `Pill`,
`IconButton`, `Divider`.

**Build notes:** the timeline interaction was reworked 2026-06-06 (see the
`BufferTimeline` row) — continuous two-finger pinch-zoom + one-finger pan + tap-to-
position + an off-screen-capable playhead + a `TimelineScrollbar`, all via
PanResponder multitouch (no `react-native-gesture-handler` dep). The discrete
`TimelineZoomControl` toggle was removed. Saved-region hatch is a flat accent fill
(same RN-pattern deferral as `Timeline`'s `trimOverlay`). Field-swipe direction
(drag-right = earlier) is trivially flippable. `ClipBracket` is presentational —
`BufferTimeline` owns all time math and supplies its three PanResponder handler sets.

##### `BufferTimeline`

- **Tier:** feature (composes `GapMarker` + `ClipBracket` + `SavedClipRegion` + `TimelineScrollbar` + PanResponder)
- **Location:** `src/components/features/clip/BufferTimeline.tsx` *(built 2026-06-06 · C2)*
- **Variants:** `default`
- **Sizes:** md (track h:52 — single track, **no axis/date row**; matches the Input `md` "What's happening" field — + the scrollbar below)
- **States:** zoom = continuous `pxPerMs` (fit … fit×max, max raised so Sec is reachable on a multi-day buffer); pan = `scrollOffset`; playhead may be on- or off-screen
- **Props (built):** `segments` (recorded spans; each may carry a `posterUrl`), `savedRegions?`, `playheadMs`, `nowMs?`, `streaming?`, `leadingGap?` (oldest-edge eviction span), `bracket?`, `thumbnails?` (per-instant frame overlay), `onScrub` (continuous drag), `onSeek?` (discrete TAP — host keeps playing from there), `onScrubStart?` / `onScrubEnd?` (drag activate/release — pause-while / resume-on-lift), `onBracketChange?`, `onZoomChange?` (px/ms → field scrub rate), `onVisibleRangeChange?` (debounced visible window) (zoom/pan are internal view state)

**Mock says (Frames 1–4):** Horizontal full-bleed timeline of the buffer with
**collapsed gaps** — recorded segments render as a repeating **filmstrip** (a fixed
24px film cell tiled across the segment, longer segment → more cells, last cell
cropped); every real-time gap is a thin fixed **10px** `GapMarker` (no label). Saved
clips appear as read-only hatched bands. No date/axis row
(the overlaid `TimeScrubber` clock carries absolute time).

**Code does — interaction model (2026-06-06 rework):**
- **Tap** → the playhead snaps to where you tap (`onScrub(absoluteMs)`).
- **One-finger drag** → pans the timeline (`scrollOffset`) when zoomed past the
  viewport. The playhead does **not** move on scroll — it stays pinned to its time
  and may travel **off-screen** (content is `overflow:hidden`, translated by
  `-scrollOffset`).
- **Two-finger horizontal pinch** → continuous zoom (`pxPerMs`), anchored on the
  pinch midpoint. Clamp `[fit, fit×12]` (can't zoom out past the whole buffer).
  **The live pinch (and pan) drive `Animated` `scaleX`/`translateX` on the native
  thread — no React re-render per move (2026-06-06 smoothness fix); the real
  `pxPerMs` + offset are committed once on release (a single re-layout).** scaleX is
  about the view centre, so `translateX` compensates to keep the midpoint put; the
  brief during-gesture scale of gaps/handles snaps correct on release.
- A thin **`TimelineScrollbar`** below the track shows the whole buffer (thumb
  length = visible fraction = zoom; position = scroll; drag to pan).
- **Recorded content renders as a repeating filmstrip** (24px cell, cropped at the
  segment edge); gaps are thin **10px** `GapMarker`s (no label).
- **Trailing gap + auto-follow (2026-06-06):** `nowMs` + `streaming` props. Not
  streaming + now past the last segment → a trailing 10px gap (last-recorded → now);
  the playhead at now sits in it. When the playhead is at the live head and the user
  isn't gesturing, the timeline **auto-follows the leading edge** (pins scroll to the
  end), so live filmstrip growth reveals at the edge.
- Gestures via PanResponder multitouch (no gesture-handler dep). Brackets keep
  their own handles (parent owns time math); pinned to in/out **times**, so they
  stretch/contract with zoom + pan. Saved-region no-overlap clamp unchanged.

**Code does — 2026-06-07 refinements:**
- **Smooth gaps (no snapping).** `timeToX`/`xToTime` now interpolate **linearly across
  a collapsed gap marker's pixels** ↔ the gap's wall-clock span (inter-session, leading,
  and trailing). Tapping/dragging glides the playhead through `[prevEnd → nextStart]`
  instead of snapping to the next clip's head.
- **Zoom-level toggle** below the scrollbar (`SegmentedToggle`: All · Days · Hours · Min ·
  Sec) — a non-pinch way to snap the zoom to a span, centred on the playhead; the
  highlighted segment tracks the live zoom. Reports zoom up via `onZoomChange`.
- **Adaptive level count (2026-06-09).** The toggle only renders the levels that are
  *meaningful for the current footage extent*: `All` always, and each of `Days`/`Hours`/
  `Min`/`Sec` only once its target scale beats the fit scale by `LEVEL_MEANINGFUL_FACTOR`
  (1.25) — i.e. snapping to it is a real zoom-**in** from "All" rather than clamping back
  to fit. Derived from the existing `levelToPx` vs `fit` math (keyed on `totalSegMs`, the
  recorded footage with gaps collapsed), so it stays in sync with pinch. A short buffer
  collapses to **All · Sec** (or just `All`, in which case the toggle is **hidden** — no
  dead single chip); as footage grows, `Min → Hours → Days` cross the threshold and appear
  in turn. `currentLevel` highlights the nearest *visible* level so pinch never targets a
  hidden chip.
- **Stateful edge indicators (`BufferEdge`, 15px) replace the head/tail `GapMarker`s.**
  Idle → darkest token (`text.primary`); **head evicting** (buffer full) → `accent` with
  a **right-edge zigzag**; **tail live** (streaming) → `accent` with a **left-edge
  zigzag** — "the buffer eating the footage." Zigzag = `ZIGZAG_TEETH` (4) evenly spaced ×
  `ZIGZAG_DEPTH` (5px) biting into the footage. Fit subtracts both edges + inter gaps so
  **"All" shows the whole buffer** (footage + both edges) within the viewport.
- **Leading eviction gap.** `leadingGap` (oldest-edge headroom span) renders a scrub-
  reachable leading marker; the parent shows a **"FOOTAGE CLEARS IN" countdown** while
  the playhead is over it (no `atCapacity` needed — derived from `windowHours` + earliest
  footage). When full, the head flips to the accent eviction zigzag.
- **Real frames over the filmstrip.** Each segment's `posterUrl` (the session poster)
  cover-fills its segment (expo-image), falling back to sprockets on load error (backend
  poster currently 404s — graceful, auto-upgrades). `thumbnails` (per-instant frames) is
  the denser server-filmstrip path; **client-side `generateThumbnailsAsync` is OFF** (it
  hangs on the `-c:v copy` HLS VOD — see CLAUDE.md / wrld-backend item 6).

---

##### `GapMarker`

- **Tier:** feature (View only)
- **Location:** `src/components/features/clip/GapMarker.tsx` *(built 2026-06-06 · C2)*
- **Variants:** `default`
- **Sizes:** fixed **10px** wide × full track height (`GAP_MARKER_WIDTH`)
- **States:** static (presentational, no gesture)
- **Props (built):** `style?` only

**Code does (built):** A thin **10px** break between recorded filmstrip segments —
`bg.primary` fill bracketed by `border.strong` rules. **No duration label**
(2026-06-06): the gap's duration is surfaced in the scrub field's **gap card** while
the playhead crosses it, not on the timeline. Width is constant across zoom (gaps
never scale — only the filmstrip segments do).

---

##### `ClipBracket`

- **Tier:** feature (composes Text + PanResponder; rendered as a `BufferTimeline` overlay)
- **Location:** `src/components/features/clip/ClipBracket.tsx` *(built 2026-06-06 · C2)*
- **Variants:** `default`
- **Sizes:** spans the track height (top:18 → bottom)
- **States:** active (dragging an edge) · moving (center drag) · `blocked` (clamped at a saved region — warn-tinted edge)
- **Proposed props:** `inMs`, `outMs`, `pxPerMs`, `onChangeIn`, `onChangeOut`, `onMove`, `blocked?`

**Mock says (Frames 2–4):** 2px accent frame with accent-tinted fill; left edge =
in-point, right edge = out-point, both with large finger-friendly grip handles.
**No time readout on the selection (removed 2026-06-10)** — the only pill is the
transient "Blocked · saved region" warning when an edge drag clamps at a saved region.

**Proposed behavior:** Drag a handle to set in/out; press-drag the center zone
moves the whole selection **without** changing duration. Clamps at saved-region
boundaries with a resist/blocked affordance (warn tint, "Blocked · saved
region"). One active pending bracket at a time. "New clip" drops it centered on
the playhead at a default width.

---

##### `SavedClipRegion`

- **Tier:** feature (or a `BufferTimeline` sub-part) (composes Text)
- **Location:** `src/components/features/clip/SavedClipRegion.tsx` *(built 2026-06-06 · C2)*
- **Variants:** `default`
- **Sizes:** spans the track height; width = the saved span at current zoom
- **States:** static, read-only
- **Proposed props:** `startMs`, `endMs`, `label?`

**Mock says (Frame 3):** Read-only band over a taken span — diagonal
`accent.surface` hatch + a 3px `accent` top band + a "SAVED" mono micro-label.
Reads clearly as "this region is taken; brackets won't enter it".

**Proposed behavior:** One band per already-saved clip. New brackets clamp at its
edges (no overlap). Deleting that clip (screen 2) removes the band, freeing the
span for reuse.

---

##### `TimelineScrollbar`

- **Tier:** feature (composes View + PanResponder)
- **Location:** `src/components/features/clip/TimelineScrollbar.tsx` *(built 2026-06-06 · C2)*
- **Variants:** `default`
- **Sizes:** thin (track h:22 touch area, 4px rail, 8px thumb)
- **States:** scrollable (draggable thumb) / inactive (fully zoomed out → full-width thumb, quieter)
- **Props (built):** `contentWidth`, `viewport`, `scrollOffset`, `onScrollTo`

**Code does (built):** The thin scrollbar under the `BufferTimeline` that **replaced
the discrete zoom toggle** (2026-06-06). Represents the whole buffer: the thumb
**length is the visible fraction** (viewport / content) so a short thumb = zoomed
in, a full thumb = fully zoomed out; thumb **position** is the scroll offset.
Dragging the thumb pans the timeline (`onScrollTo`). Flat hairline styling — rail
`border.subtle`, thumb `text.muted` (no accent; it's a control, not a "look here").
Presentational + gesture-emitting; `BufferTimeline` owns the geometry.

> **Note (2026-06-06):** the earlier `TimelineZoomControl` (a `SegmentedToggle`
> All/Hours/Min/Sec preset) was **removed** — the timeline zoom is now continuous
> pinch + this scrollbar.

---

##### `BufferScrubField`

- **Tier:** feature (composes Image / `FeedThumb` + Text + Icon + RNGH `Gesture.Pan`)
- **Location:** `src/components/features/clip/BufferScrubField.tsx` *(built 2026-06-06 · C2)*
- **Variants:** `camera` (thumbnail/placeholder) · `audio-only` (`FeedThumb.audio`) · `map-only` (`FeedThumb.loc`)
- **Sizes:** lg (≈9:11 portrait, near-full-bleed hero)
- **States:** scrubbing (frame re-renders under playhead) · idle
- **Props (built):** `variant?`, `thumbnailUrl?`, `frameSlot?` (the live `VideoView`), `reachLabel?`, `card?` (`{title,detail}` — shown over a gap instead of video: static gap duration, running "since last broadcast", or "footage clears in"), `showScrubHint?`, `onScrub?`, `onScrubStart?` / `onScrubEnd?` (drag activate/release — lets the host pause while scrubbing and resume on lift). The play/pause button was removed 2026-06-07 (the transport owns it).

**Code does (built):** Portrait near-full-bleed field — **just the frame + the swipe
gesture** (2026-06-06). No on-field playhead line and **no on-field clock**: the
timeline carries the playhead marker, and the editor overlays the time-machine
`TimeScrubber` at the field's bottom as the buffer clock (expand to spin-scrub). The
field keeps an optional buffer-reach hint (top-right) + a centered "Swipe to scrub"
hint. Audio/map spans fall back to `FeedThumb` (lg).

**Behavior:** Owns the swipe-to-scrub gesture — an **RNGH horizontal-only `Pan`**
(`activeOffsetX` / `failOffsetY`, matching `BufferTimeline`) so a sideways drag locks
the page scroll and scrubs, while a vertical drag yields to the ScrollView. Emits
incremental px deltas via `onScrub` (`changeX`); the parent maps px → ms against the
current zoom and advances the shared playhead (which also drives `BufferTimeline` and
the `TimeScrubber` clock — one current-time for all three). The field is time-agnostic.
Direction (drag-right = earlier) is flippable. (Was PanResponder pre-2026-06-07.)

---

##### `BufferTransport`

- **Tier:** feature (composes Pressable + Icon)
- **Location:** `src/components/features/clip/BufferTransport.tsx` *(built 2026-06-07)*
- **Variants:** `default`
- **Sizes:** row of five; 44 step buttons + a 52 accent play/pause circle
- **States:** `playing` (glyph) · prev/next `disabled` at the buffer edges
- **Props (built):** `playing`, `onToStart`, `onPrev`, `onTogglePlay`, `onNext`, `onToEnd`, `canPrev?`, `canNext?`

**Code does (built):** The transport row beneath the buffer field (above the clock):
**|◀ beginning of buffer · ‹ previous clip · ▶/❚❚ · next clip › · end of buffer ▶|**.
Presentational — the host (`ClipEditScreen`) owns where each jump lands (clip heads =
session starts; beginning = the leading eviction-gap edge when present, else oldest
footage; end = the live edge) and the play-state. Prev/next disable at the edges; the
outer two never do. Jumps keep playing across them (the host re-anchors the wall clock).

---

##### `SavedClipRow`

- **Tier:** feature (composes `ClipPreview` + Pill + IconButton + Button + Text)
- **Location:** `src/components/features/clip/SavedClipRow.tsx` *(proposed — not built; alternative: a `row` + `expanded` variant on `ClipCard`)*
- **Variants:** `collapsed` · `expanded` (inline player)
- **Sizes:** full-width row; collapsed ≈82 tall (104×62 poster), expanded adds a 16:9 player + action strip
- **States:** collapsed · expanded-playing; pill state `draft` (default) · `anon` · `public`
- **Props (built):** consumer-flat — `name`, `capturedAt`, `durationSec`, `thumbnailUrl?`, `variant?`, `sourcesLabel?`, `visibility?` (`draft`/`anon`/`public`), `expanded?`, `playing?`, `progressPct?`, `onToggleExpand?`, `onTogglePlay?`, `onShare?`, `onPublish?`, `onDelete?`, plus three escape hatches added when `LibraryScreen` adopted it for recordings: `tags?` (override the visibility+sources tag row with explicit `{label,tone}[]`), `onKebabPress?` (makes the kebab a real button — recordings delete menu), `showPlayGlyph?` (hide the poster play affordance where playback isn't wired)

**Mock says (saved-clips Frames 1–2):** Horizontal row card (dashboard `FeedRow`
proportions, `ClipCard` content): poster thumb (duration overlay + play
affordance) + name + capture timestamp (`monoValue`) + state/source pills +
kebab. Tap → **expands in place** to an inline player (`ClipPreview` play
variant) + actions (Share · Publish · Delete) — no full-screen nav.

**Proposed behavior:** Owner-only treatments carry over from `ClipCard`; new
clips arrive as **private drafts**, so the `Draft` pill is the default with a
Publish affordance. Delete removes the clip (and frees its `SavedClipRegion` on
screen 1).

**Recommendation:** Build as a **new `SavedClipRow`** rather than overloading
`ClipCard` — the inline-expand player + owner action strip diverge enough from
`ClipCard`'s `trending` / `preview` / `compact` card variants that a
`row` + `expanded` variant would bloat `ClipCard`'s API. Reuse `ClipCard`'s
pill / meta sub-styling where practical.

---

##### `ClipSourcesDrawer`

- **Tier:** feature (thin assembly — composes `BottomSheet` + `StreamTile` grid + Text)
- **Location:** `src/components/features/clip/ClipSourcesDrawer.tsx` *(built 2026-06-06 · C2)*
- **Variants:** `default`
- **Sizes:** bottom drawer (the `NearbyStreamsDrawer` / `BottomSheet` pattern)
- **States:** open / dismissed; per-tile active / inactive (reuses `StreamTile` states)
- **Proposed props:** `visible`, `sources` (recorded layers + active flags), `onToggleSource`, `onDismiss`

**Mock says (Frame 5):** Slide-up drawer (globe `NearbyStreamsDrawer` pattern) of
the **recorded-source** `StreamTile`s (CAM 1080p, AUDIO 48 kHz, LOC GPS, COMPASS
192°, GYRO …) in a wrapped grid. Tap a tile to toggle it active/inactive for the
clip — reuses `StreamTile`'s active (2px accent) vs inactive (subtle border, 0.45
opacity) states. Header "Sources in this clip · N of M active"; "Done" dismisses.

**Proposed behavior:** Replaces the inline `LayerPanel` / `LayerEditorRow` for
this editor. Selection is **reversible active/inactive only** —
**delete-permanently is NOT in this drawer** (out of scope here). Choices persist
into the saved clip. **No new primitive** — assembly of two existing ones.

---

##### Buffer viewer source switcher (built 2026-06-10 · clips initiative · Ben / `design`)

A column of source icons overlaid on the scrub field that switches **which captured
track the field renders** — a VIEW switch, distinct from `ClipSourcesDrawer` (the
**save-set**). The rail lists the **full dashboard capture suite in the same
top-to-bottom order** (identity · location · cam · audio · screen · compass · gyro ·
motion · speed · temp · torch); sources this buffer didn't capture (incl. the v0.3+
ones) render greyed + unselectable. The rail emits a selected source; the parent renders the matching view
into the field's `frameSlot`. Camera + identity are shaped for real data today;
audio / location / telemetry render against mock until the buffer descriptor exposes
those tracks (Aaron — same component-ahead-of-data pattern as the timeline thumbnails).
Demoed together in the gallery's **"SourceRail + source views"** section.

###### `SourceRail`

- **Tier:** feature (composes `Pressable` + `Icon`)
- **Location:** `src/components/features/clip/SourceRail.tsx` *(built 2026-06-10)*
- **Variants:** `default` · **Sizes:** 36px icon buttons in a translucent-ink rounded column
- **States:** per-item active (accent fill, inverse icon) / inactive (light icon) / **disabled** (dimmed icon, non-selectable — a source this buffer didn't capture)
- **Props:** `sources` (`SourceRailItem[]` = `{ key, iconName, label, disabled? }`), `value`, `onChange`, `style?`

**Code does:** A self-contained `rgba(20,16,12,0.55)` column (reads over dark video, a
light map, or a paper identity card). The rail shows the **full** source set; items with
`disabled: true` (not captured) render greyed and ignore taps. Tapping an enabled item
calls `onChange(key)`. Positioning (right-overlay on the field) is the composer's job.

###### `SourceWaveform`

- **Tier:** feature (pure Views — no chart lib / native module)
- **Location:** `src/components/features/clip/SourceWaveform.tsx` *(built 2026-06-10)*
- **Props:** `peaks` (0..1, oldest→newest), `progress?` (0..1 playhead), `label?`, `style?`

**Code does:** A centred amplitude waveform on a warm-ink media backdrop; bars left of
the playhead read accent ("played"), the rest a muted cream. Mic + label tag bottom-centre.

###### `SourceTelemetryGraph`

- **Tier:** feature (pure Views)
- **Location:** `src/components/features/clip/SourceTelemetryGraph.tsx` *(built 2026-06-10)*
- **Props:** `values` (0..1), `progress?`, `label`, `reading?` (preformatted value at playhead), `iconName?`, `style?`

**Code does:** A bottom-anchored bar sparkline of one data channel (gyro / compass /
speed / temp …) on the ink backdrop, with a header (icon + label + the live reading at
the playhead). Played portion accent.

###### `SourceLocationTrail`

- **Tier:** feature (composes `@rnmapbox/maps`)
- **Location:** `src/components/features/clip/SourceLocationTrail.tsx` *(built 2026-06-10)*
- **Props:** `path` (`[lng,lat][]`, oldest→newest), `position?` (playhead point), `style?`

**Code does:** A static (non-interactive) Mapbox `Light` mini-map. If the track moved
(>~11m span) it draws a **slug trail** (`LineLayer`) + a position dot and fits the
bounds; if stationary, a single **pin** centred at zoom 14. Empty track → a neutral
"No location track" placeholder. TRAIL/LOCATION tag bottom-left. **Native module — rides
the existing dev client (the globe uses it); no extra rebuild.**

###### `SourceIdentityCard`

- **Tier:** feature (composes `Avatar` + Text + `Icon`)
- **Location:** `src/components/features/clip/SourceIdentityCard.tsx` *(built 2026-06-10)*
- **Props:** `displayName`, `handle`, `avatarUrl?`, `attributed` (false → anon), `meta?` (`{label,value}[]`), `style?`

**Code does:** A paper (`panelHi`) card — avatar + name + @handle, an **Attributed**
(accent, `user-check`) / **Anonymous** (muted, `eye-off`) flag pill, and a capture-meta
list (resolution / when / sources). Identity is metadata, so it's a light surface, not media.

###### `ClipToolRail`

- **Tier:** feature (composes `Pressable` + `Icon`)
- **Location:** `src/components/features/clip/ClipToolRail.tsx` *(built 2026-06-10)*
- **Variants:** `default` · **Sizes:** 30px icon buttons in a translucent-ink column (pairs with `SourceRail` on the opposite edge)
- **States:** per-item default / **warn** (destructive — accent icon) / disabled (dimmed, inert)
- **Props:** `tools` (`ClipToolItem[]` = `{ key, iconName, label, onPress, disabled?, tone? }`), `style?`

**Code does:** An **action** rail (vs `SourceRail`'s view switch) — the buffer editor's
clip tools as a left-edge column: **select current clip · set in · set out · delete ·
trim · save · clear (✕)**. Each button fires `onPress`; destructive tools (`tone: 'warn'`)
tint the icon accent; disabled tools grey out. The parent (`ClipEditScreen`) owns the
in/out bracket logic: select = bracket to the clip under the playhead; set-in/out = move
that edge to the playhead (out-before-in pulls the in back); delete/trim = confirm →
**backend buffer mutation (Aaron)**; save = opens the `SaveClipSheet`; clear = drop the
bracket. These replace the old below-field New clip / Reset / Save buttons.

###### `SaveClipSheet`

- **Tier:** feature (composes `Input` + `Button` + `Text` in a `Modal` + `KeyboardAvoidingView`)
- **Location:** `src/components/features/clip/SaveClipSheet.tsx` *(built 2026-06-10)*
- **Props:** `visible`, `defaultName?`, `durationLabel?`, `onSave(name)`, `onCancel`

**Code does:** The name-this-clip modal — a keyboard-aware bottom sheet opened by the tool
rail's **Save** (replacing the persistent below-field name input). Auto-focuses the name
field so the keyboard rises and the sheet floats above it (the `AuthModal` Modal +
`KeyboardAvoidingView` pattern); optional duration line under the title; Save confirms,
Cancel / backdrop dismisses. The **`ClipSourcesDrawer` save-set is retired from the editor**
— a saved clip just carries the sources its footage captured (derived at save time).

---

**Screen assemblies (screens tier — not Section-3 component rows):**

- **`ClipEditScreen`** *(built 2026-06-06 · route `app/(app)/clip-editor.tsx`,
  reached from **Me → Clip editor**)*: `ScreenHeader` ("Clip editor", back
  chevron) + `ScreenScroll` + a `PageTabs` pager (**Editor ↔ Saved clips**).
  Editor page = `BufferScrubField` + `BufferTimeline`
  (+ `ClipBracket` / `SavedClipRegion` / `GapMarker` / `TimelineScrollbar`) +
  New-clip/Reset + Sources buttons + name `Input` + `SaveClipButton`
  + `ClipSourcesDrawer`; Saved page =
  `SavedClipRow` list with empty state. The **time-machine `TimeScrubber` is
  overlaid at the field's bottom as the buffer clock** — expand it to spin-scrub the
  buffer; the field swipe and the timeline scrub drive the same value. All three
  share one `offsetMs` (0 = live head; a 1s tick keeps the timeline playhead in
  lockstep with the clock). Field + timeline are full-bleed so the clock's six
  wheels fit. **While the clock is expanded the screen scroll is locked** (so the
  wheels spin without the page scrolling — via `ScreenScroll`'s `scrollEnabled`);
  touching the image or anything below the clock collapses it (`collapseSignal`) and
  restores scroll. Save = private draft, appends a `SavedClipRegion` + auto-advances
  to the Saved page. **Runs on mock buffer data**
  (a clearly-marked `MOCK SEAM` / `useMockBuffer` — Aaron's C1 substrate swaps in
  there).
- **`LibraryScreen`** *(reskinned 2026-06-06 · existing route, Me → Library)*:
  the real recordings list (`useRecordings` / `recordingsApi`, unchanged) now
  renders each `Recording` as a `SavedClipRow` (date→title, status→tags, meta line,
  delete via the kebab; collapsed-only, no play glyph since recording playback
  isn't wired). Loading / error+offline / storage-quota / signed-out / empty
  states + optimistic delete all preserved.

---

##### Interaction notes — buffer-trim editor

Gesture/motion behaviors the static frames can't fully convey (deliverable 3 of
the handoff):

- **Shared playhead.** One current-time drives both `BufferScrubField` and
  `BufferTimeline`; scrubbing either moves the other. Re-evaluated continuously;
  the field frame re-renders to the moment under the playhead.
- **Playhead — tap to position, off-screen-capable.** Tapping the timeline snaps
  the playhead there. **Panning (scroll) does NOT move the playhead** — it stays
  pinned to its time and can travel off-screen (content `overflow:hidden`,
  translated by `-scrollOffset`).
- **Bracket drag — edge vs center.** Edge handle = set in/out (duration changes);
  center press-drag = move the whole selection (duration fixed). Live duration +
  timecodes update in `monoValue` tabular throughout.
- **Pan + zoom.** One-finger horizontal drag pans (when zoomed past the viewport);
  two-finger horizontal pinch zooms continuously, anchored on the pinch midpoint
  (clamp `[fit, fit×12]`); the `TimelineScrollbar` thumb (length = zoom) also pans.
  Brackets are pinned to in/out **times**, so they stretch/contract with zoom + pan
  — never pixel-locked.
- **No-overlap clamp.** Brackets cannot enter a `SavedClipRegion`; the moving edge
  resists at the boundary with a warn-tinted blocked affordance. Only one pending
  bracket at a time; saved clips coexist as read-only regions. Deleting a saved
  clip frees its span.
- **Motion tokens.** Drawer = `overlay` (250ms easeOutQuad) slide-up + swipe-down
  dismiss; button/handle presses = `press` (180ms). No decorative motion.

---

#### Trust / Safety

##### `ContextStrip`

- **Tier:** feature (composes Image + Avatar + Text + Icon + LivePill)
- **Location:** `src/components/features/report/ContextStrip.tsx`
- **Variants:** `default`; the `kind` prop picks the thumb behavior — `broadcast` (Image or `video` placeholder), `clip` (Image or `film` placeholder), `user` (Avatar)
- **Sizes:** md (48-square thumb)
- **States:** default; `isLive` adds a LivePill on the right
- **Used in:** populated in 12.6
- **Tweak impact:** Report flow context header, future "what you're reporting" surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Card surfacing what's being reported: thumb (48×48 of the
broadcast/clip) + meta column (title + sub) + LivePill on the right.

**Code does (shipped):** 48-square thumb (Image / Avatar / placeholder
depending on `kind`) + title + optional sub + LivePill when `isLive`.
Consumer-flat shape — `kind`, `title`, `sub?`, `thumbnailUrl?`,
`displayName?`, `isLive?`.

---

##### `ReasonRow`

- **Tier:** feature (composes Pressable + Text + Icon)
- **Location:** `src/components/features/report/ReasonRow.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, selected (accent border + accent.surface bg + accent chevron), pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Report flow step 1 (reason picker), future reason-picker surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Selectable row: title (sans, bold) + description (mono
caps, dim) + chevron. Selected = accent-tinted background + accent border
+ accent chevron.

**Code does (shipped):** Row layout — title + optional description
column + `chevron-right` icon. Selected swaps the border + bg to
accent + tints the chevron. Selection state is parent-owned via
`selected` + `onPress`.

---

##### `PageTabs`

- **Tier:** feature (composes `Pressable` + `Text`)
- **Location:** `src/components/features/navigation/PageTabs.tsx`
- **Props:** `tabs` (`{ key, label }[]`, generic over the key union), `value`,
  `onChange`, `style?`
- **States:** per-tab active / inactive (active = emphasized label + accent
  underline)
- **Used in:** `WalletScreen` (Balance / Top Up / Cash Out), `MonetizeScreen`
  (Subscriptions / Events) — the hybrid-nav sibling-cluster control
- **Tweak impact:** in-place tab navigation on any clustered area
- **Shipped:** 2026-06-05 (hybrid nav)

**Code does:** an underline tab strip — a row of content-sized tabs (gap `lg`,
bottom hairline border) that swap content **in place** (no route push, no back
arrow), distinct from `SegmentedToggle` (a pill filter). Active tab gets a
`bodyEmphasized` label + an accent underline flush on the row border; the host
owns the active key + the content swap. Generic so callers keep a typed key
union.

### Sections (`src/components/sections/`)

Populated from the 12.2 inventory pass. Sections are regional patterns
that repeat across two or more screens. The 16 entries below all meet
that bar. Several patterns that *don't* meet it stay inline in their
single home screen — flagged at the end.

##### `ScreenHeader`

- **Tier:** section (composes `BrandMark` + `Text`; optional Pill via `right`)
- **Location:** `src/components/sections/ScreenHeader.tsx`
- **Props:** `title?` (right-justified page name), `right?` (custom right slot,
  e.g. the globe LIVE Pill — takes precedence over `title`), `onBack?` (renders a
  compact back chevron left of the wordmark — the up-affordance for drill-down
  screens), `pointerEvents?` (the globe overlays it on the map and passes
  `box-none`), `style?`
- **States:** brand-only, brand + page-name, brand + custom right, ± back chevron
- **Used in:** Globe (LIVE pill), Dashboard/Stream/Me/Library/Events/Wallet
  (page name), Settings/Subscription/Profile/Monetize (page name + `onBack`)
- **Tweak impact:** the top header on every screen
- **Shipped:** 2026-06-05

**Code does:** logo + WRLD wordmark left, right slot right, in a row with
`paddingHorizontal: lg` and a pinned `minHeight: 32` (the brand-row height) so
the header is the SAME height regardless of the right slot. Each screen renders
its field (search / "What's happening") in a `paddingTop: sm` row directly
below, and since all three headers start at `safe-area-top + sm`, the field
lands at an identical Y — it doesn't jump on tab switch. See the decision-log
entry "Search ↔ title field harmonised; shared ScreenHeader".

##### `ScreenScroll`

- **Tier:** section (composes `SafeAreaView` + `KeyboardAwareScrollView`)
- **Location:** `src/components/sections/ScreenScroll.tsx`
- **Variants:** `default`
- **Sizes:** N/A (full-screen wrapper)
- **States:** default, keyboard-open
- **Used in:** `ComponentGallery` (first migrant, 2026-05-30); rest populate as form-bearing screens migrate in 12.6
- **Tweak impact:** every scrollable screen with focusable inputs — Gallery, Onboarding, Dashboard, Settings, Wallet, Profile editing, Report, Change Handle, AuthModal contents, etc.
- **Shipped:** 2026-05-30 (sub-phase 12.5 — first section)
- **Last reviewed:** 2026-06-05

**`header` slot added 2026-06-05.** Optional `header?: ReactNode` rendered
**fixed** inside the SafeAreaView, above the scroll, at `safe-area-top + sm` (so
it doesn't scroll and lands at the same Y as the globe/dashboard headers). Pass
a `ScreenHeader` here — it's how page-level screens (Me, Library, Events) get the
shared header in one prop without restructuring. Body content scrolls beneath it.

**`scrollEnabled` passthrough added 2026-06-06.** Optional `scrollEnabled?: boolean`
forwarded to the `KeyboardAwareScrollView` — an opt-in scroll lock for screens with
a vertical-drag control that would otherwise lose its gesture to the scroll view.
`ClipEditScreen` sets `scrollEnabled={!clockExpanded}` so the expanded `TimeScrubber`
wheels spin without the page scrolling.

**Mock says:** Implicit — every form-bearing screen needs the keyboard
to lift over content rather than crop the focused input, **without
repositioning the rest of the screen**, plus tap-on-adjacent-input
behavior that doesn't dismiss the keyboard first. Not a visual concern;
a behavior concern.

**Code does (shipped — minimal-config rewrite 2026-05-30):**

```tsx
<SafeAreaView style={[styles.root, style]}>
  <KeyboardAwareScrollView
    contentContainerStyle={contentContainerStyle}
    keyboardShouldPersistTaps="handled"
    bottomOffset={bottomOffset}              // opt-in, no default
    keyboardDismissMode={keyboardDismissMode} // opt-in, no default
  >
    {children}
  </KeyboardAwareScrollView>
</SafeAreaView>
```

**Design rule: trust the library, don't fight it.** Three rounds of
keyboard regressions taught us that layering hidden defaults on top of
`KeyboardAwareScrollView` fights its internal animation timing and
causes stutter. The wrapper applies exactly ONE
universally-useful prop (`keyboardShouldPersistTaps="handled"`) and
otherwise passes through to the library with its own defaults.

`bottomOffset`, `keyboardDismissMode`, `paddingBottom`, and
`backgroundColor` (via `style`) are opt-in via props. Consumers that
need them set them per-use; the wrapper never silently injects them.

The single defaulted-in prop:
- `backgroundColor` = `bg.primary` via `styles.root` (overridable via
  `style` — but every form-bearing screen wants this, and override is
  cheap when needed)

`KeyboardAwareScrollView` comes from `react-native-keyboard-controller`
— purpose-built for RN's New Architecture (Fabric) and properly handles
single-line UITextField first-responder behavior, which plain
ScrollView + various RN-built-in options could not. Requires
`KeyboardProvider` at the root layout (wired in `app/_layout.tsx`).

**Why not plain `ScrollView` + RN built-ins?** Tried `KeyboardAvoiding-
View` with `behavior='padding'` (reflow bug — scroll resets to 0),
`automaticallyAdjustKeyboardInsets` (no-op for UITextField under
Fabric), and a manual scroll-restore via keyboard listeners (partially
worked). None handled UITextField cleanly under New Architecture. The
library is the right level of abstraction for this problem.

**Reuse-rule note:** Section 0.5 normally says wait for the second
proven case. Here the second case was on the immediate horizon (real
screens during 12.6 will need it) and Ben flagged the inline pattern
as work he'd rather not have to do per-screen. The section landed as
**ahead-of-12.6 work in 12.5** per the 2026-05-30 decision-log entry.

**Gap / proposal:** None — shipped. Future additions when proven:
`scrollRef` forwarding, `onScroll` passthrough, refresh-control slot.
Add as the first 12.6 migrant or future consumer needs them.

---

##### `WizardShell`

- **Tier:** section (composes ScreenScroll + IconButton + ProgressBar + ContextBanner + Text + Button)
- **Location:** `src/components/sections/WizardShell.tsx`
- **Variants:** `default`
- **Sizes:** N/A (full-screen)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer (8 steps), Onboarding Creator (10 steps), Onboarding Handle (existing), Change Handle (2-step), future wizards
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Universal wizard chrome. **Top nav** = IconButton (back) +
ProgressBar (centered) + IconButton (close, ghost). Optional
ContextBanner below. **Head** = h2 (display) + p (body). **Body** =
slotted children. **Footer / ctas** = primary CTA + optional skip.
Skip lives directly under the primary CTA — never above it, never in
the header.

**Code does (shipped):** ScreenScroll-wrapped scaffold with the four
slots from the mock — top nav row, optional ContextBanner, heading
row, slotted children body, footer with primary CTA + optional skip.
Back / close IconButtons render only when their handlers are passed
(missing handler renders a 36-square spacer to keep the progress bar
centered).

---

##### `CategoryChipRow`

- **Tier:** section (composes Chip in a horizontal scroll)
- **Location:** `src/components/sections/CategoryChipRow.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, with-selection
- **Used in:** populated in 12.6
- **Tweak impact:** Globe top, search results (future), any horizontally-scrollable single-select filter
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Horizontally-scrollable row of Chip items. Single-select
semantics — only one active at a time. Optional first chip is the
"All" reset.

**v0.2 trim (C3, 2026-05-29):** the Globe Mobile mock's 6 chips
(All / Cities / Weather / Nature / Events / Landmarks) reduce to **2 for
now: All (default, null) + Cities.** Backend `Stream.category` enum
ships with a single value (`cities`); categories grow as v0.3+ adds
value lines. Section keeps its full shape; only the data passed in is
trimmed.

**Code does (shipped):** Horizontal ScrollView of `Chip` items. Each
chip's selected state is computed from the controlled `value` prop;
tapping the "all" id chip sets value to `null`, any other chip sets
value to its id. Consumer-flat — `categories: { id, label }[]`.

---

##### `TrendingRail`

- **Tier:** section (composes Text + Pressable + StreamCard.trending in a horizontal scroll)
- **Location:** `src/components/sections/TrendingRail.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, empty (renders `emptyLabel` instead of the scroll)
- **Used in:** populated in 12.6
- **Tweak impact:** Globe Mobile bottom sheet, future discovery / "for you" surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Section header ("Trending now" + "See all") + horizontal
scroll of StreamCard items (158×~140). Tapping a card opens its stream.
Empty state = "No streams nearby" message.

**Code does (shipped):** Header row (title heading + optional "See all"
accent link) + horizontal ScrollView of `StreamCard` trending-variant
items keyed by id. Empty state replaces the scroll with a muted caption.
Loading state is not yet a render mode — the consumer can swap the
section out for a Spinner during fetch.

---

##### `StreamStrip`

- **Tier:** section (composes Text + StreamTile in a horizontal scroll)
- **Location:** `src/components/sections/StreamStrip.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet sensor strip, future per-broadcast layer surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Header ("STREAMS" + "X OF Y" count) + horizontal scroll
of StreamTile items showing per-layer status (CAM 1080p, AUDIO 48 kHz,
LOC GPS, etc.). Used to display which layers a broadcast is delivering.

**Code does (shipped):** Header row (mono-caps title + "N OF M" active
count, both in dim tones) + horizontal ScrollView of StreamTile items.
Each `StreamStripLayer` carries id, iconName (Feather glyph), label,
value, optional active flag (default true), optional onPress.

---

##### `FilterCard`

- **Tier:** section (composes SegmentedToggle + Chip + Pressable + Text)
- **Location:** `src/components/sections/FilterCard.tsx`
- **Variants:** generic — the consumer assembles the row mix; the spec's `wallet` / `profile` "variants" become preset row arrays at the call site
- **Sizes:** md
- **States:** default, with-results-summary, with-clear (shown when `onClear` is set)
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 transaction filters, My Profile clip filters, future complex-filter surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Card containing multiple filter rows. **My Profile**
variant: VIS (segmented ALL/PUBLIC/ANON) + LAYERS (multi-select chip
row) + DATE (single-select chip row) + clear-filters action. **Wallet**
variant: currency + kind + date row. Applied-state shows "X OF Y
results" + Clear link.

**Code does (shipped):** Bordered card hosting an optional header
(title + results summary + Clear link) and a stack of `FilterRow`
items. Three row kinds are built in:
- `segmented` — composes `SegmentedToggle` (single-select)
- `chip-single` — horizontal Chip scroll, tap toggles to selected /
  back to null
- `chip-multi` — horizontal Chip scroll, tap toggles in/out of an
  id array

The "wallet" / "profile" variants from the spec are just preset row
arrays at the call site; the section itself stays generic.

---

##### `DayGroup`

- **Tier:** section (composes Text + slotted children)
- **Location:** `src/components/sections/DayGroup.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 transaction grouping, future timeline grouping surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Day header (TODAY / YESTERDAY / APR 22) + summary on
right (e.g. "+ 12.4K SB · - 4.2K SB") + slotted child rows (typically
TransactionRow). Border-top separates from previous day's group.

**Code does (shipped):** Header row (mono-caps `label` left, optional
`summary` right) + slotted children. Border-top hairline by default
(opt-out with `showBorderTop={false}` on the first group of a list).

---

##### `ActionTilesRow`

- **Tier:** section (composes Pressable + Icon + Text)
- **Location:** `src/components/sections/ActionTilesRow.tsx`
- **Variants:** `default` (3-up), `2-up` and `4-up` via the `cols` prop
- **Sizes:** md
- **States:** default; per-tile `primary` adds accent border + accent.surface bg + accent icon
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 quick actions (Top up / Cash out / Send), future shortcut surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Equal-width grid of action tiles. Each tile = Card +
icon + title + small descriptor. One tile in the grid may be marked
`primary` (accent glow + tinted bg).

**Code does (shipped):** flex-wrap row with `flexBasis: 100/cols%`
per tile so 3-up and 4-up share one layout path. Tile = Pressable
wrapping Icon (md) + title (bodyEmphasized) + optional descriptor
(monoCaption). `primary` flag swaps to the accent treatment.

---

##### `PresetGrid`

- **Tier:** section (composes Chip in a 4-up grid)
- **Location:** `src/components/sections/PresetGrid.tsx`
- **Variants:** `default`
- **Sizes:** md (4-up gridded chips)
- **States:** default, with-selection
- **Used in:** populated in 12.6
- **Tweak impact:** Cash Out preset amounts, TipSheet preset amounts, Top Up bundle quick-picks (potentially), future quantity-preset surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** 4-up grid of Chip items showing preset values. Selected
state = accent-tinted (or tone-tinted) chip. Tapping = sets a parent
value (typically the AmountInput sibling).

**Code does (shipped):** Generic `PresetGrid<T extends string | number>`
— flex-wrap row of Chip items at 24% width. Optional `format(v)` to
turn raw values into chip labels (e.g. `${n} 🚀`). Selection lives in
the parent.

---

##### `ActionSheet`

- **Tier:** section (composes BottomSheet + Pressable + Icon + Text)
- **Location:** `src/components/sections/ActionSheet.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** open, closed
- **Used in:** populated in 12.6
- **Tweak impact:** Profile kebab actions, Wallet v2 menus (potential), Clip Edit row-menus, future contextual-menu surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Bottom sheet containing a header row (e.g. "@KAI.DC") +
list of action rows (icon + label, optional warn-tone for destructive
actions) + Cancel row at the bottom. Tap outside closes.

**Code does (shipped):** BottomSheet hosting a header row, a hairline-
divided list of action rows, and a separate Cancel row pinned below.
Actions are `{ id, label, iconName?, tone?, onPress }`. Tapping an
action closes the sheet first, then fires the action's `onPress`.
`tone='warn'` (single-accent rule: destructive = accent) paints the
row in accent ink + icon.

---

##### `SettingsGroup`

- **Tier:** section (composes Text + slotted SettingsRow children)
- **Location:** `src/components/sections/SettingsGroup.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Settings screen, Change Handle entry point, future settings-like surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Section header (mono caps, dim — e.g. "IDENTITY",
"VERIFICATION") + Card containing SettingsRow children with borders
between them. Multiple groups stacked on a screen.

**Code does (shipped):** Optional title above a bordered, hidden-
overflow card container that hosts SettingsRow children. The rows
themselves own their border-top hairlines (per the SettingsRow
contract — first child opts out via `showBorderTop={false}`).

---

##### `InfoList`

- **Tier:** section (composes Icon + Text)
- **Location:** `src/components/sections/InfoList.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** per-row tone — `keep` (accent badge + accent ink), `change` (warn badge + warn ink), `hold` (neutral badge + muted ink)
- **Used in:** populated in 12.6
- **Tweak impact:** Change Handle "what changes" panel, future consequence-disclosure surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** List of tonal info rows (keep / change / hold tones,
each with a tone-colored badge + title + description). Used to disclose
consequences of an action ("What stays with you / What's different /
What's held").

**Code does (shipped):** Stack of rows — 32-circle tone badge with
glyph (`check` / `edit-3` / `pause` by default; consumer can override)
+ title + optional body. Tones map directly to existing tokens
(`accent.default` / `accent.surface` for keep; `warn` + inline amber
tint for change; muted ink + `bg.panel` for hold).

---

##### `LegalLinkList`

- **Tier:** section (composes Pressable + Text + Icon)
- **Location:** `src/components/sections/LegalLinkList.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, pressed (Pressable variant subtle)
- **Used in:** populated in 12.6 (LegalAcceptanceCard composes one)
- **Tweak impact:** All 3 LegalAcceptanceCard variants (US/ROW, EU, CA), future legal-disclosure surfaces
- **Shipped:** 2026-05-31 (sub-phase 12.5)

**Mock says:** Vertical list of legal-document link rows: "Terms of
service" / "Community rules" / "Privacy policy" — each as a tappable
row with right chevron. Opens the document in a reader.

**Code does (shipped):** Bordered card hosting Pressable rows
(label + chevron). Border-top hairline between rows after the first.
Consumer passes `docs: { id, label, onPress }[]`.

---

#### Sections that stay inline (single-screen only)

These patterns appeared in only one mock and don't justify section-tier
extraction. They live inline in their home screen until a second use case
emerges:

- **LayerPanel** (Clip Edit only — composes LayerEditorRow rows in a Card)
- **TagsCard** (Clip Edit only — TagEditor in a Card)
- **AgeGateRefusal** (single-screen, terminal state; the AgeGateCard
  feature is the entire surface)
- **StreamGrid** (was a candidate; mocks don't actually show a grid of
  live streams — Globe is spatial, Profile clips are grid but those use
  ClipGrid which is just a 2-column grid of ClipCard, simple enough to
  stay inline)
- **ProfileHeader** (was a candidate; the bcaster-row + meta-strip
  combination doesn't reuse outside Profile / My Profile, and those two
  screens have meaningfully different headers anyway)

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

---

##### `TopUpPanel` / `CashOutPanel`

- **Tier:** section (compose wallet features — `PursesCard` / `BundleCard`,
  `AmountInput` / `PresetGrid` / `Chip` — + their own buy/cash-out logic)
- **Location:** `src/components/sections/TopUpPanel.tsx`, `CashOutPanel.tsx`
- **Props:** `onDone: () => void` (where Done / post-action goes)
- **States:** picker (default), submitting, success; `CashOutPanel` also loading
- **Used in:** the Wallet **Top Up / Cash Out page-tabs** AND the standalone
  `/topup` `/cashout` routes (now thin `SafeAreaView` + back-arrow wrappers) —
  one body, two hosts, no duplicated logic
- **Tweak impact:** the top-up / cash-out flow wherever it appears
- **Shipped:** 2026-06-05 (hybrid nav — Wallet)

**No inline gallery preview** (same as `ScreenScroll` / `WizardShell`): these are
host-chrome-less screen bodies that drive real wallet data (`useWallet`,
`usersApi`) + a docked footer CTA — previewed in-context, not as a card. The
host provides `SafeAreaView` / header; the panel owns scroll + footer.

### Screens (`src/components/screens/`)

See Section 4.

### Pre-captured findings (carry-over)

These were noted before Section 0 existed; both are now resolved.
Kept here for traceability:

1. **Globe pin two-color conflict** — resolved by the 12.3 single-accent
   locking (see `Pin.ts` entry above and the 2026-05-29 light-first-pivot
   decision-log entry). Differentiation between cluster and singleton is
   now size + count text only.

2. **Discovery→watching transition surface** (the tap-to-preview card
   over the globe). This is the canonical example of the **seam** (0.3).
   Realized today as `DiscoveryHandoffCard.tsx` in features (0.7) — see
   the new Section 3 entry above. **C1 (12.2) locked the inline-card
   pattern** for both single-pin and cluster taps; the rich bottom-sheet
   pattern from the Viewer Sheet mock is deferred. It is **not** a
   violation of Principle 1's mode handoff — it _is_ the handoff, and
   the principle's mode note (Section 1) explicitly accommodates it.

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

| Route (shim)                          | Implementation                       | Purpose                                                                        | Migrated |
| ------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ | -------- |
| `app/index.tsx`                       | (auth-aware redirect, no impl)       | Auth-aware redirect                                                            | n/a      |
| `app/onboarding.tsx`                  | `OnboardingScreen.tsx`               | Handle picker, avatar (Phase 8) — composes WizardShell + RulesChecklist + AvatarPicker | 2026-05-31 |
| `app/(auth)/login.tsx`                | `LoginScreen.tsx`                    | Clerk sign-in — BrandMark + Text variants + Button                              | 2026-05-31 |
| `app/(auth)/signup.tsx`                | `SignupScreen.tsx`                    | Clerk sign-up + verify — adds PasswordStrengthMeter                             | 2026-05-31 |
| `app/(app)/globe.tsx`                  | `GlobeScreen.tsx`                     | Globe (mounts `EarthScene`) — overlay layer composes StreamStateBanner + DiscoveryHandoffCard + Pill (LIVE count) | 2026-05-31 |
| `app/(app)/dashboard.tsx`              | `DashboardScreen.tsx`                 | Go Live & Record arming — **rewritten 2026-06-03/04 (clips C2)** to the two-affordance capture model. **Sticky title (top) + single sticky GoBar (bottom)**, source suite scrolls between. Per-source Air/Rec toggles are the source of truth (armed→live via Toggle `armed`); the single GoBar goes live **in place** (headless broadcast on the dashboard — no StreamScreen hop) and flips to **STOP STREAM**. All 11 sources interactive (Divider-grouped: identity/location · cam/audio/screen · compass/gyro/motion/speed/temp · torch) + location precision ceiling (EXACT/CITY/COUNTRY/PRIVATE) + Identity (Public/Anon) row. No sensitivity badges / record consent (removed for now). Capture config (Air/Rec/precision/identity/subscribers, **not** the title) auto-persists across launches via `src/lib/captureConfig.ts` (AsyncStorage) — no save button. Only cam/audio Air streams today; rec/identity/precision/extra sensors carried forward (backend follow-up) | 2026-05-31 · 2026-06-04 |
| `app/(app)/stream/[id].tsx`            | `StreamScreen.tsx`                    | Broadcaster (id=new) / viewer (id=room) — ChatOverlay + ReactionLayer retire in favor of ChatMessage/Composer + ReactionRail | 2026-05-31 |
| `app/(app)/me.tsx`                     | `MeScreen.tsx`                        | Own profile / account settings — AvatarPicker + PursesCard dual + Input prefix '@' | 2026-05-31 |
| `app/(app)/profile/[handle].tsx`       | `ProfileScreen.tsx`                   | Public profile + follow — Avatar xl + MetaStrip 'Joined ...' + Text-variant stats; PassportCard deferred until PublicUser shape grows | 2026-05-31 |
| `app/(app)/search.tsx`                 | `SearchScreen.tsx`                    | User search — SearchBar + BroadcasterRow rows                                  | 2026-05-31 |
| `app/(app)/settings.tsx`               | `SettingsScreen.tsx`                  | Account + notifications — SettingsGroup + SettingsRow + AccountIDPill highlight identity row | 2026-05-31 |
| `app/(app)/subscription.tsx`           | `SubscriptionScreen.tsx`              | Tier picker — Card + Pill + Button + Icon for the comparison matrix; hex literals retire | 2026-05-31 |
| `app/(app)/wallet.tsx`                 | `WalletScreen.tsx`                    | Wallet v2 — PursesCard dual + ActionTilesRow cols=2 + CategoryChipRow filter + TransactionRow rows | 2026-05-31 |
| `app/(app)/topup.tsx`                  | `TopUpScreen.tsx`                     | Top Up bundle picker — PursesCard single-sb + BundleCard per bundle; gold treatment retires | 2026-05-31 |
| `app/(app)/cashout.tsx`                | `CashoutScreen.tsx`                   | Cash Out flow — AmountInput cashout variant + PresetGrid + status cards; gold treatment retires | 2026-05-31 |
| `app/(app)/creator-onboarding.tsx`     | `CreatorOnboardingScreen.tsx`         | Creator wizard (Phase 13) — 10-step WizardShell composing DOBWheel + LocationGranularityPicker + PermissionPrePromptCard + ConsentRow + LegalLinkList | 2026-05-31 |
| `app/(app)/broadcaster-onboarding.tsx` | `BroadcasterOnboardingScreen.tsx`     | Redirect shim (legacy) — kept as 9-line useEffect redirect to creator-onboarding | n/a      |
| `app/(app)/change-handle.tsx`          | `ChangeHandleScreen.tsx`              | **New** — settings flow for handle changes (4 frames; mock + Section 3 features) | no       |
| `app/(app)/onboarding-viewer.tsx`      | `OnboardingViewerScreen.tsx`          | **New** — viewer-path wizard (anon → registered viewer, 8 steps)               | no       |
| `app/(app)/clip-edit.tsx`              | `ClipEditScreen.tsx`                  | **New** — post-stream clip editor (per re-baseline 2026-05-29)                 | no       |
| `app/(app)/report.tsx`                 | `ReportScreen.tsx`                    | **New** — user/stream reporting modal (multi-step)                             | no       |

All existing screens migrated in 12.6 (2026-05-31 close). **New** screens
(ChangeHandle, OnboardingViewer, ClipEdit, Report) build in 12.7 / v0.3
when their parent features become user-reachable; they have no existing
implementations to refactor.

---

## 5. Motion patterns

Three named patterns ship in sub-phase 12.7, exposed via
`theme.motion.patterns.*`. Each pattern is a `{ duration, easing }` pair
that consumers spread into `Animated.timing()`. Consumers compose by
pattern name, not raw duration. Resist animating everything — the patterns
exist to unify motion that already had to exist, not to invite new motion.

The `screen-transition` pattern from the 12.0 draft list is deferred:
expo-router handles route motion via the underlying navigator, and no
WRLD screen currently animates its own entry/exit. If we ever need a
custom route transition, the pattern goes here.

### Pattern: `press`

- **Token:** `theme.motion.patterns.press`
- **Timing:** 180ms (`motion.timing.fast`)
- **Easing:** `Easing.out(Easing.quad)` (the `standard` easing)
- **What animates:** scale (1 → `motion.press.scaleMid/Large/Small`)
- **Used in:** [Pressable](src/components/primitives/Pressable.tsx) — every
  higher-tier interactive primitive composes Pressable, so this is the
  universal tap feedback across the app.

Press feedback is fast and decisive — the goal is "I tapped it" confirmation,
not a flourish. Anything slower feels sluggish; anything snappier feels
janky on slower hardware.

### Pattern: `overlay`

- **Token:** `theme.motion.patterns.overlay`
- **Timing:** 250ms (`motion.timing.base`)
- **Easing:** `Easing.out(Easing.quad)` (the `standard` easing)
- **What animates:** opacity (0 → 1) + translateY (slide-in)
- **Used in:**
  [BottomSheet](src/components/primitives/BottomSheet.tsx) — sheet body
  scrim opacity (sheet body itself rides a spring, not a tween) ·
  [ToastBanner](src/components/features/feedback/ToastBanner.tsx) —
  banner opacity + translateY entry

Overlay enter/exit shares one duration so the AuthModal / TipSheet /
ActionSheet / ToastBanner family all feel like they belong to the same
overlay layer. Slightly slower than `press` because there's more visual
weight settling into place.

### Pattern: `pulse`

- **Token:** `theme.motion.patterns.pulse`
- **Timing:** 1600ms (`motion.timing.pulse`) — full cycle. Consumers split
  in half (down + up) for a symmetric pulse.
- **Easing:** `Easing.inOut(Easing.quad)` — symmetric, never reaches "rest"
- **What animates:** opacity (1 ↔ 0.3) inside an `Animated.loop`
- **Used in:**
  [LivePill](src/components/features/stream/LivePill.tsx) — the leading
  dot inside the LIVE pill ·
  [GoBar](src/components/features/broadcast/GoBar.tsx) — the knob opacity
  while the bar is in its `live` variant

Pulse is reserved for "this is happening right now" markers. Resist
applying it to anything else — overuse drains its meaning.

### Why not `screen-transition`?

The fourth name from the 12.0 placeholder is deliberately not shipped.
expo-router uses React Navigation's underlying stack/tab transitions,
which already feel right for our routes. Reaching into them to override
would mean writing platform-specific animator code with no visible
benefit. The token slot is reserved if a future screen needs custom
transition behaviour (e.g. a wizard step animation between handle / avatar
/ choice that's currently a hard cut).

### Springs

Two primitives use `Animated.spring` instead of a tween: BottomSheet's
sheet-body translateY and Toggle / SegmentedToggle indicator translateX.
Springs are not tokenized — they live as inline `{ stiffness, damping }`
because RN's spring model is fundamentally different from a duration +
easing pair, and the values are tuned per-component to the visual weight
of the element being moved. If a third spring use case appears, we'll
reconsider tokenizing spring profiles.

### Decorative motion (not in patterns)

Some motion is bespoke and lives outside the pattern system:

- **Spinner rotation** — continuous `Easing.linear` loop, not a transient
  state change
- **FeedThumb mini-animations** — per-thumb decor (dial sweeps, waveform
  jitter) tied to the kind of sensor; not a reusable pattern
- **ReactionRail floaters** — Periscope-style upward decay with random
  drift; one-off motion
- **Tip burst** in StreamScreen — same pattern as ReactionRail
- **GlobeScreen camera ad-hoc pans** — gesture-driven, not a tokenized
  transition

These intentionally stay outside the patterns block because they're
decorative motion that's part of a specific component's identity. If
they migrate to a shared pattern, they get a new entry here.

### At the seam

Motion at the seam (overlays appearing/transitioning over GL scenes — e.g.
DiscoveryHandoffCard fading in over the globe) uses the same patterns
above. The seam is not a separate motion category.

---

## 6. Decision log

Append-only. Most recent first. Each entry: date, decision, rationale,
constraint it imposes downstream.

### 2026-06-09 — Clock-above-footer pattern; Stream ⇄ Dashboard layout parity; footer reshuffle

A run of layout/pixel work on `design` (footer `_layout`, `DashboardScreen`, `StreamScreen`,
`ClipEditScreen`, `TimeScrubber`, new `LiveClockBar`; all pure JS, hot-reloadable):

- **Footer reshuffle (5 slots).** Globe · Dashboard · [Stream] · **Clips** · **Me**. The clip
  editor earned a permanent footer slot (4th); **Me** moved to 5th; **Events** left the footer for
  a link on the Me screen (with Wallet · Library). The clip-editor link was dropped from Me (it's
  the footer now). *Imposes:* `clip-editor` is a footer tab; `ppv` is `href:null`.

- **The WRLD clock is now a predictable pattern: sticky, flush above the footer, on Globe ·
  Dashboard · Stream · Clips.** On the globe + clip editor it stays **interactive** (drives the
  replay / the buffer playhead). On Dashboard + Stream there's no time-travel surface, so it's a
  **passive live readout** (decision, Ben: live-readout only, not a scrubber). *Imposes:*
  `TimeScrubber` gained an **`interactive`** prop (default true; false detaches the per-field
  PanResponders → no tap-to-expand / no scrub, still ticks). New thin wrapper **`LiveClockBar`**
  (`TimeScrubber offsetMs={0} interactive={false}`) is the productised live readout and exports
  `LIVE_CLOCK_BAR_H` so hosts can offset a docked button up over it.

- **Stream ⇄ Dashboard layout parity (broadcaster).** The stream page now reads the same as the
  dashboard top-to-bottom: **header → middle region → Go Live/End Stream button → clock**, same
  gaps — the button sits at the dashboard's screen offset so it doesn't jump between pages. The
  **header is unified**: always `ScreenHeader` (page name **"Go Live" → "Live"** when live), and
  the row beneath swaps the **title input** (pre-live) for a **live-info row** (`LivePill` +
  `Avatar` + viewer count) when live. Both rows are pinned to the input's 52px height, so the
  header — and the camera crop below it — **never moves on go-live** (decision: no jumping crop).
  Added the dashboard's faint **bottom border + sm space** to the header (broadcaster + viewer).
  Pre-live hints ("Arm a source…", "Detecting location…") moved out of the header into floating
  chips over the camera so they can't change its height.

- **Camera is a bounded box, not full-bleed.** The camera renders in a box from below the header to
  just above the button (broadcaster) / the clock top (viewer), so it sits *above* the clock
  (decision: don't paint the camera behind the clock). Shown `objectFit="contain"` (full frame +
  letterbox) on **Android broadcaster + viewer**; the **iOS broadcaster keeps `CameraPreview`** —
  see the gimbal-revert bullet.

- **Bottom control line moved inside the camera frame.** Chat input · send · flip used to float in
  the button/clock zone; they're now just inside the frame's bottom edge. **Flip → top-right of the
  frame** (off the line). The **chat toggle moved to the far left**, **mirroring the send at the
  far right** (both at the `lg` margin), input centred between them (equal `sm` gaps); the message
  list aligns to the toggle's left edge. *Imposes:* the chat toggle needs `zIndex: 20` (above the
  panel's 10) or the panel — which now starts at that same left margin — swallows the ✕-to-close tap.

- **Gimbal revert (iOS broadcaster).** Reversed the earlier RTCView-`contain` swap on the iOS
  broadcaster preview — it broke preview orientation on tilt (RTCView shows the raw, rotating
  stream; `CameraPreview`'s AVCaptureVideoPreviewLayer stays vertical). So iOS broadcaster is back
  on `CameraPreview` (cover + native pinch-zoom). *Trade-off:* the iOS broadcaster preview is
  cover-cropped (not full-frame); Android + viewer still contain. Full-frame **and** orientation on
  iOS would need a `resizeMode`/contain option on the native `WRLDCameraPreview` (deferred).

- **Cleanup.** Registered `LiveClockBar` + the `TimeScrubber` `interactive` mode in Section 3 and
  the FeatureGallery; swept orphaned `StreamScreen` styles (`broadcasterTopLeft`, `previewControls`).

*Not device-tested yet:* the clock spacing parity, the stable crop across go-live, the in-frame
control line + mirrored toggle/send, the top-right flip, and the iOS gimbal orientation all need an
on-device pass.

### 2026-06-07 — Buffer editor: transport, tap-to-seek, scrub/clock pause-resume, gap collapse

A second clip-editor round (all on `design`; `ClipEditScreen` + `BufferTransport` (new) +
`BufferTimeline` / `BufferScrubField` / `TimeScrubber`, pure JS):

- **`BufferTransport`** — a new five-button row under the field (beginning of buffer · prev
  clip · play/pause · next clip · end of buffer). Presentational; the host owns the jump
  targets (clip heads = session starts; beginning = the leading eviction-gap edge when
  present; end = live). *Imposes:* play/pause now lives on the transport, so the field's
  centered play button was **removed**.
- **Tap-to-seek vs drag-scrub split.** `BufferTimeline` gained `onSeek` (TAP) distinct
  from `onScrub` (drag). Tap honours play state (keeps playing / stays paused); drag
  pauses while held.
- **Scrub + clock pause-on-grab / resume-on-lift.** Timeline drag, field drag, and clock
  spin all pause playback while the finger is down and resume ~250ms after lift if it was
  playing (play-intent carries across a burst of adjustments). Added `onScrubStart` /
  `onScrubEnd` to `BufferTimeline`, `BufferScrubField`, and `TimeScrubber` (globe usage
  unaffected — it doesn't pass them).
- **Field scrub collapses gaps.** The field swipe crosses an entire gap in a small fixed
  finger distance (`GAP_SCRUB_PX`, ≈ the timeline's collapsed gap at the field's half
  rate) — no slowdown over long gaps, no skip; footage stays zoom-relative. (Reverses the
  earlier "plain uniform rate," which dragged over long gaps.)
- **Smooth playback gap-rush.** The playback follow runs on `requestAnimationFrame`: a gap
  rush updates the clock every frame (smooth, like the scrub) over a **fixed 3s**
  (`GAP_RUSH_MS`) — long gap → fast, 3s → ~1×, <3s → slows; footage stays throttled to
  ~200ms (the video is the visual there).
- **Field ↔ scroll arbitration.** `BufferScrubField` moved from PanResponder to the same
  RNGH horizontal-only `Pan` as the timeline (sideways locks page scroll, vertical yields).
- **Layout:** the `TimeScrubber` clock sits **above** the transport and **flush** under the
  field (no gap). Edge zigzag teeth finalised at `ZIGZAG_TEETH` 4 × `ZIGZAG_DEPTH` 5px,
  edges 15px.

### 2026-06-07 — Buffer-trim editor: smooth gaps, wall-clock playback, eviction edge, real frames

A round of clip-editor refinements (all on `design`; `BufferTimeline` feature +
`ClipEditScreen` screen, pure JS):

- **Smooth scrub over gaps (no snapping).** `timeToX`/`xToTime` interpolate across the
  collapsed gap markers instead of snapping to a clip head; the field scrub dropped its
  quarter-screen gap handling for one plain zoom-relative rate everywhere. *Rationale:*
  the snap felt broken; gaps should glide. *Imposes:* gap regions are now scrub-reachable
  time, not dead pixels.
- **Wall-clock playback.** Playback drives the playhead by real elapsed time (video
  follows: plays over footage, holds over gaps), so it crosses gaps in real-time and only
  stops at the live edge — never at a clip end. *Rationale:* media time collapses gaps, so
  a media-driven follow couldn't traverse them. *Imposes:* touches the shared playback
  follow (Aaron's group engine) — only the follow loop, via a wall-clock anchor + a
  footage/gap helper; his load/play-pause/group-advance effects are untouched.
- **Head/tail = stateful `BufferEdge` (15px), replacing the edge `GapMarker`s.** Darkest
  token when idle; `accent` + a footage-facing **zigzag** when head-evicting / tail-live
  ("buffer eating the footage"). Teeth: `ZIGZAG_TEETH` (4) × `ZIGZAG_DEPTH` (5px). Fit
  subtracts both edges so **"All" truly fits** (the trailing gap used to spill past the
  edge). Inter-session gaps stay the 10px `GapMarker`.
- **Leading eviction gap + "FOOTAGE CLEARS IN" countdown** — derived from `windowHours` +
  earliest footage (no `atCapacity` needed; that's still the refinement for countdown-vs-
  consuming). Head/tail counting clocks now show **d · h · m · s** (seconds always).
- **Real frames:** per-session `posterUrl` cover-fills each segment (expo-image), falling
  back to sprockets on error. The advertised poster (`…/camera/thumb.jpg`) currently
  **404s** server-side → handed to Aaron (wrld-backend item 6). **Client `generateThumbnailsAsync`
  confirmed non-viable** (hangs on the `-c:v copy` HLS VOD, even on codec-uniform groups)
  → gated off; server frames feed the `thumbnails` prop later.
- **Layout:** the `TimeScrubber` clock now sits **below** the field (not overlaid), and
  the field/clock/timeline are inset to line up with the "name this clip" input (no
  full-bleed).

### 2026-06-06 — Timeline gestures → react-native-gesture-handler; drag=scrub; playhead holds

Adopts **`react-native-gesture-handler`** (`~2.28`, + the already-installed reanimated)
for the clip-editor timeline, replacing the PanResponder approach that kept fighting
us (flaky pinch, unreliable tap, no clean horizontal-only). **Native module → needs an
EAS rebuild** (rides Aaron's pending `expo-video` rebuild). `GestureHandlerRootView`
added at the app root.

- **`BufferTimeline`** gestures are now RNGH: **`Tap`** (playhead lands where you tap),
  **`Pan`** `.activeOffsetX([-8,8]).failOffsetY([-12,12])` (**horizontal-only** — scrubs
  the PLAYHEAD; vertical falls through to the page scroll → "lock vertical during the
  gesture" for free), **`Pinch`** (continuous zoom on the UI thread via reanimated
  shared values `sx`/`tx` + `useAnimatedStyle`, committed to `pxPerMs`/offset on end).
  `Gesture.Race(pinch, pan, tap)`.
- **Drag = scrub the playhead** (decision 2026-06-06), NOT scroll. Scrolling the
  timeline is the `TimelineScrollbar`'s job; pinch zooms.
- **Bracket handles** are RNGH `Pan` gestures too (built in `BufferTimeline`, passed to
  `ClipBracket` which wraps each zone in a `GestureDetector`); each
  `.blocksExternalGesture(panRef)` so an edge drag resizes instead of scrubbing. (No
  PanResponder↔RNGH interop.)
- **Playhead holds, except at 'now'.** `ClipEditScreen`'s playhead is now an **absolute
  held instant** (no drift) + a `following` flag; the 1s tick only advances it when at
  the live edge. `TimeScrubber` gained **`playback?: boolean`** — `false` (editor) =
  controlled hold (no internal freeze/resume); `true` (globe) unchanged.

**Imposes:** EAS dev-client rebuild before the timeline works on device (RNGH native).
Not yet device-tested. Globe `TimeScrubber` keeps `playback` default true (no change).

### 2026-06-06 — BufferTimeline interaction rework: pan / pinch / tap + scrollbar

Replaced the timeline's interaction model. **Before:** discrete zoom toggle
(`TimelineZoomControl`), playhead kept centered/edge-released (content scrolled
under a fixed playhead), a date/axis row. **Now:**
- **Tap to position** the playhead (snaps to the tapped time).
- **One-finger drag pans** the timeline; the **playhead no longer moves on scroll**
  — it stays pinned to its time and may go **off-screen**.
- **Two-finger horizontal pinch** = continuous zoom (anchored on the midpoint,
  clamp `[fit, fit×12]`).
- New **`TimelineScrollbar`** (thin; thumb length = visible fraction = zoom; drag to
  pan) **replaces the `TimelineZoomControl` toggle**, which is **deleted** (file +
  galleries + row).

**Rationale:** a standard pannable/zoomable editor timeline reads more naturally
than a fixed-centered playhead + discrete zoom steps; the scrollbar doubles as the
zoom indicator. Gestures use PanResponder multitouch — **no
`react-native-gesture-handler` dependency** (none installed; FD/dep budget).

**Imposes:** zoom/pan are now `BufferTimeline`-internal view state (no `zoom` prop);
`ClipEditScreen` dropped its zoom state + the toggle; the field-swipe scrub uses a
fixed coarse sensitivity (no longer zoom-keyed). Not yet device-tested — the
multitouch pinch + tap-vs-pan disambiguation want a real-hardware pass.

### 2026-06-06 — Buffer-trim clip editor: app side done, handed to Aaron

Milestone marker (details in the three entries below). The buffer-trim clip editor
is built and merged to `main`: the C2 component library, `ClipEditScreen` (on a mock
buffer seam) with the `TimeScrubber` overlaid as the buffer clock, and the
`LibraryScreen` reskin. **C1 (substrate) was already Aaron's and is done;** what
remains is backend wiring — swap `ClipEditScreen`'s `useMockBuffer` seam for real
data, the manifest `Clip` model, the R2 `/auth/me` dual-pool, R3/R5. Full handoff
checklist lives in CLAUDE.md ("Buffer-trim clip editor BUILT — handoff to Aaron").
Design-system follow-up still in Ben's lane: an optional `TimeScrubber`
`playback`/hold-position prop if a frozen scrub reads better for picking a clip.
Nothing here is device-tested yet.

### 2026-06-06 — Buffer-trim clip editor: screens built (ClipEditScreen + Library reskin)

Follows the same-day C2 component build. At Ben's direction, the two screens were
built too — crossing into `screens/` (normally Aaron's lane) so the gestures are
testable on a real page, not just the gallery. **Coordinate the `design → main`
merge** since this edits files in Aaron's lane.

- **`ClipEditScreen`** — new route `app/(app)/clip-editor.tsx`, reached from
  **Me → Clip editor**. `PageTabs` pager (Editor ↔ Saved clips) composing all the
  C2 components. **Mock buffer data** behind a clearly-marked `MOCK SEAM`
  (`useMockBuffer`) — Aaron's C1 substrate (per-source record-to-disk + the
  segments / saved-regions / recorded-layers contract) swaps in there; component
  props are already shaped for it.
- **`LibraryScreen` reskinned** — the existing real recordings list
  (`useRecordings` / `recordingsApi`, untouched) now renders each `Recording` as a
  `SavedClipRow`. Recordings ≠ clips, so: date→title, status→tags, meta line,
  delete via the kebab, collapsed-only, no play glyph (playback not wired). All
  prior states (loading / error+offline / quota / signed-out / empty / optimistic
  delete) preserved.
- **`SavedClipRow` gained three backward-compatible escape hatches** so it serves
  both the clip Library and the recordings Library: `tags?` (override the tag row),
  `onKebabPress?` (real kebab button), `showPlayGlyph?`.
- **Me** gained a "Clip editor" button (per Ben's call to surface it there, not in
  Settings/DEV).
- **Buffer clock = the time-machine `TimeScrubber`** (refinement, same day). The
  field's static bottom clock + on-field playhead were dropped; `BufferScrubField`
  is now just frame + swipe. `ClipEditScreen` overlays `TimeScrubber` at the field
  bottom (expand to spin-scrub the buffer) and unifies the clock + image swipe +
  timeline scrub on one `offsetMs` (0 = live head; 1s tick). `TimeScrubber` is
  reused as-is, so its playback-after-scrub behavior carries over — a `playback`/
  hold-position prop is the follow-up if a frozen scrub reads better in the editor.
  Field + timeline are full-bleed so the six-wheel clock fits.

**Verification:** tsc-clean (the only 4 errors are the pre-existing
`stream/${string}` typed-route baseline in `app/_layout.tsx` +
`GlobeScreenMapbox.tsx`). **Not yet exercised on device.**

**Imposes:** Aaron swaps the `ClipEditScreen` mock seam for the real substrate and
wires real save/delete/publish; the `LibraryScreen` data path is unchanged so it
keeps working as-is. Merge needs Aaron-coordination (screens lane).

### 2026-06-06 — Buffer-trim clip editor: two-zone editor + standalone Library

Adopts the buffer-trim model for the clip editor (Aaron's handoff brief). A clip
is a non-destructive manifest cut out of the rolling buffer; this editor picks the
in/out. Two screens, mocks shipped on `design`:
[`clip-editor-buffer-trim-portrait.html`](docs/design/mocks/clip-editor-buffer-trim-portrait.html)
(6 frames) +
[`saved-clips-list-portrait.html`](docs/design/mocks/saved-clips-list-portrait.html)
(3 frames).

**Decided:**
- **Two-zone editor** — a full-bleed swipe-to-scrub `BufferScrubField` over a
  collapsed-gap, zoomable `BufferTimeline` with drag `ClipBracket`s. Supersedes
  the single-waveform `Timeline` trimmer (`clip-editor-portrait.html`) for the
  buffer flow; `Timeline` stays as the ancestor for non-buffer surfaces.
- **Collapsed gaps** — real-time gaps render as fixed 50px `GapMarker`s (segments
  scale with zoom, gaps don't) so skipped time stays legible.
- **No overlap** — already-saved spans are read-only `SavedClipRegion` bands;
  brackets clamp at their edges. Deleting a clip frees its span.
- **Per-source layers = bottom `ClipSourcesDrawer`** (the `NearbyStreamsDrawer`
  pattern + `StreamTile` grid), reversible active/inactive only — no inline
  LayerPanel here, no delete-permanently in this editor.
- **Save = private draft** — new clips land in the Library as drafts (publish is a
  separate affordance).
- **Library, not profile-as-library** — screen 2 is a standalone off-footer
  Library (reached from Me / after save). Resolves the open clips-initiative
  "profile vs library" question in favour of a standalone Library.

**Components (Section 3 → Clip Editor — built on `design` 2026-06-06, C2 · Ben):**
`BufferTimeline`, `GapMarker`, `ClipBracket`, `SavedClipRegion`,
`BufferScrubField`, `SavedClipRow`, `ClipSourcesDrawer`, `TimelineScrollbar`
(features under `features/clip/`). All token-clean, in the galleries, tsc-clean.
`ClipEditScreen` / `LibraryScreen` assemblies + screen wiring are Aaron's later
step. *(The `TimelineZoomControl` toggle from the first cut + the
centered/edge-release playhead were superseded by the 2026-06-06 timeline-gesture
rework — see that decision-log entry.)*

**Imposes:** the components are built against a stubbed/mock buffer; Aaron's
substrate + the backend contract for buffer segments / saved regions / per-source
recorded layers lands separately, then the screens compose these. `LibraryScreen`
extends the existing screen; the profile screens no longer need a library surface.
Not yet exercised on device (gesture feel — scrub, bracket drag, the
centered/edge-released playhead — needs an on-device pass).

### 2026-06-05 — Globe time-machine clock: below the drawer, solid panel, independent

Reworks the `TimeScrubber` ↔ drawer ↔ planet coupling on the globe.

- **Swapped positions.** The clock is now pinned at the very bottom (above the
  tab bar); the **drawer rides on top of it** — the drawer's `bottom` tracks the
  clock's animated height, mirroring the old drawer→clock coupling. (`TimeScrubber`
  exports `CLOCK_COLLAPSED_H` / `CLOCK_EXPANDED_H` + an `onExpandedChange` callback
  the globe uses to animate the drawer + planet.)
- **Expanded = solid panel.** The bar was transparent (band only). Expanded it
  now gets a solid `bg.glassPanel` (new token — paper80 / `panel` at the drawer's
  0.82 opacity, a step darker than `glass`). The panel stays on through the whole
  collapse animation (dropped only once fully collapsed) so the band's lighter
  paper can't flicker through mid-collapse.
- **Independent of the drawer.** Touching the drawer no longer collapses the
  clock (it now behaves like the globe); only other UI (search / chips / cards)
  collapses it. So the clock and drawer expand/collapse independently.
- **Four planet positions.** Because the two are independent, the planet
  `translateY` is now `Animated.add(drawerContribution, clockContribution)` —
  distinct positions for each (clock × drawer) collapsed/expanded combo. The
  clock's frac-shift (`GLOBE_FRAC_CLOCK_SHIFT` ≈ 0.07) is proportional to its
  growth vs the drawer's (same shift-per-pixel of bottom-UI growth).
- **Relabelled** the status tag LIVE / PAST → **NOW / THEN**.

Supersedes the 2026-06-04 "clock rides above the drawer / band-only, no
background" model. Cross-repo (Aaron's backend replay seam) unchanged.

### 2026-06-05 — Search ↔ title field harmonised; shared ScreenHeader

Three coupled changes so the globe, dashboard, and stream-preview tops read as
one system and the field below doesn't jump when switching tabs.

- **`Input.leading` slot.** Added an optional leading slot to the `Input`
  primitive (symmetric to the right affordance). Removes the reason `SearchBar`
  was a separate component.
- **`SearchBar` rebuilt on `Input`.** Was a bespoke 40-tall glass pill with its
  own `TextInput`; now composes `Input` (leading 🔍 + clear-X + search keyboard)
  and inherits the "What's happening" title field's exact look (rectangle,
  `radius.md`, h:52, `bg.elevated`, 16px). One source of truth for the field.
  Same public API — callers unchanged. The globe's pill aesthetic becomes a
  solid field (chosen).
- **`ScreenHeader` section.** New shared top header — logo + WRLD left, right
  slot right (globe = LIVE pill; every other page = the page name, right-
  justified). Pinned `minHeight: 32` + each screen putting its field in a
  `paddingTop: sm` row below means the search / title field lands at an
  identical Y on every screen (all headers start at `safe-area-top + sm`).

**Scope this pass:** Globe, Dashboard, and the Stream **preview** (the live
over-camera view is untouched — its floating LivePill / identity / viewer-count
cluster stays). Roll `ScreenHeader` out to the remaining screens next.

**Rollout — page-level screens (2026-06-05).** `ScreenHeader` now also on **Me ·
Events · Library · Wallet** (all back-arrow-free), via a new fixed `header` slot
on `ScreenScroll` (Wallet renders it above its FlatList directly).

**Hybrid nav rollout (2026-06-05) — complete across all 9 detail screens.** The
chosen direction — **page-tabs for sibling clusters + a header up-affordance for
linear drill-downs**:
- **Page-tabs (`PageTabs` feature):** **Wallet** → Balance / Top Up / Cash Out and
  **Monetize** → Subscriptions / Events — in-place tabs (no route push, no back
  arrow). Wallet's Top Up / Cash Out bodies live in the `TopUpPanel` /
  `CashOutPanel` sections so the `/topup` `/cashout` routes (now thin wrappers)
  still work without duplicated logic.
- **Up-affordance (`ScreenHeader.onBack`):** **Settings, Subscription ("Plans"),
  Profile, Monetize, PPV Create/Manage/EventDetail** — bespoke back-arrow headers
  (and inline "Back" buttons on the PPV screens) replaced by the unified header
  with a back chevron (still `router.back()` under the hood).
- **Remaining:** formal `PageTabs` / panel register entries + gallery page (a docs
  pass). Auth/onboarding flows remain out of scope.

**Imposes:** new screens use `ScreenHeader` at the top + a `paddingTop: sm`
field row to stay aligned; `SearchBar`'s look now changes wherever `Input`'s
field styling changes.

### 2026-06-05 — Rolling buffer (always-on rewind): going live = buffering

Adopts the rolling-buffer recording model. Going live continuously records the
stream into a self-overwriting buffer; there is no Record button (recording is
implicit while live). The only durable verb is "Save a clip," retroactive over
the buffer (writes a manifest per the existing clips model + promotes segments).

**Decided:** ring-buffer model; time is the user-facing contract, bytes the
enforced backstop (cap sized for all-sources-max-quality so the window can only
under-spend); two pools (rolling buffer auto-managed + saved clips as a curated
GB quota, permanent-until-deleted); per-tier resolution caps now load-bearing —
Free 24h/720p, Plus 72h/1080p, Pro 7d/1440p (the 1440p Pro cap differentiates the
paid tiers on resolution as well as window); **capture ⊆ broadcast** (no record-
without-broadcast); scheduled **into v0.2**. Dollar viability confirmed on Hetzner.

**R0 resolved (Aaron, 2026-06-05):** G4 = **cap produce** (cap on the phone —
the app sets `getUserMedia` height from `wrldUser.tier`; sidecar stays
`-c:v copy`, no server transcode). G5 = ladder numbers unchanged (Free 24h/720p ·
Plus 72h/1080p · Pro 7d/1440p hold); per-tier byte caps live in backend
RemoteConfig (Aaron's lane).

**Shipped on `design` (R4 — component lane):**
- `src/lib/tierCaps.ts` — single source of truth for the rewind/resolution
  ladder + `maxCaptureHeight(tier)` (the seam Aaron's `getUserMedia` cap reads).
- `BufferWindowLabel` (feature) — rewind reach as a concrete timestamp
  ("Reaches back to ~Tue 3:00 PM") + optional max-quality floor.
- `SaveClipButton` (feature) — the durable "Save a clip" verb replacing Record.
- `RewindLadder` (feature) — the subscription-screen window + resolution ladder.
- `GoLiveRecordBar` — Record verb retired permanently (recording implicit); the
  optional record props are now a vestigial compat shim pending Aaron's
  Dashboard / StreamScreen rewire (the seam — Ben does NOT edit those screens).
- `RecordConsentSheet` + SENSITIVE/BENIGN — parked/retired (capture ⊆ broadcast
  removes the record-without-broadcast path the consent step guarded).

**Imposes:** Aaron (`main`) removes the `RecordCircle` button + rewires the
"save a clip" verb in `StreamScreen` after the merge, and reads
`maxCaptureHeight` in `useMediasoup` (G4 = cap produce). Cross-repo model in
the Rolling Buffer initiative in CLAUDE.md. Supersedes the 2026-06-04 "Record button on the
stream view" model.

### 2026-06-05 — Dashboard Location/Identity rows: state-driven icon + subtitle, no Air toggle

- **Location Air toggle removed.** It was redundant — the precision multistate
  (EXACT / CITY / COUNTRY / **PRIVATE = off**) is the single source of truth, and
  the actual sharing is governed by `locationPrecision`, not `air.loc`. The row
  now has no Air toggle (`showAir={false}`); "location aired" is derived from
  `precision !== private` (so location-only go-live still works).
- **Location icon + subtitle track the precision** — `map-pin` / `map` / `globe`
  / `eye-off` (muted) with a matching one-line subtitle, content adapted from the
  `LocationGranularityPicker`.
- **Settings privacy section removed.** Location precision is chosen on the
  dashboard now, so the Settings PRIVACY block (the `LocationGranularityPicker`)
  is gone. The picker component stays (still used in creator onboarding + gallery).
- **Identity row restyled to match Location** — the Public/Anon multistate moved
  from the `trailing` slot to the full-width `footer`; the row gained a
  state-driven leading icon (`user` / `user-x`) and clearer subtitles ("Shown as
  your @handle with your avatar" / "Anonymous — no handle or avatar shown").
- **FeedRow** gained `showAir` (hide the Air toggle) and `leading` (replace the
  FeedThumb with a custom icon tile); both documented in the gallery.

### 2026-06-04 — Broadcaster live view: cleaner overlay layout + circular record

The broadcaster's live `StreamScreen` is restyled to float its UI directly over
the camera (no boxes):

- **Top-left cluster** (in the header, where the back button was): `LivePill` +
  identity chip (`BroadcasterRow`) + tappable viewer count. The old translucent
  black box (`roomInfoOverlay`) is **viewer-only** now.
- **No back button** for the broadcaster — they leave via the tab bar or End
  Stream (in-app nav keeps the broadcast alive anyway).
- **Camera/audio "BROADCASTING" pills removed.** The `BroadcastStatusIndicator`
  is dropped from the live view (the record circle conveys recording).
- **Circular record button** (`RecordCircle`, inline in StreamScreen) docked
  above the End Stream button. Two states mirroring the Go Live button: off =
  light accent-tint circle + red dot (ghosted); recording = solid red circle +
  white stop square. Wires to the existing `startRecording`/`stopRecording`.
- **Reaction rail moved higher** on the right (`bottom: '38%'`) so it clears the
  bottom controls.
- **Both broadcaster buttons docked at the dashboard's Go Live offset** — the
  live End Stream button *and* the preview (not-live) Go Live button use the
  same screen-bottom offset (`Math.max(spacing.sm, insets.bottom + spacing.md -
  30)`, the shared `FOOTER_DROP`) so the shared control doesn't jump when
  navigating between the dashboard and the stream view in either state.
- **Preview armed-source pills removed** too — the not-live preview is just the
  title field + camera, with the docked Go Live button.

**Constraint / follow-up:** `RecordCircle` is inline in StreamScreen for now —
promote to a `features/broadcast/` component + gallery entry if it sticks. The
viewer live view is unchanged (keeps its box + back button + Leave). **Needs an
on-device pass** (over-camera contrast of the top-left chip/text, the record
circle, and the button alignment between pages).

### 2026-06-04 — Go Live button: Record removed for now; full-width two-state

Trimming the shared control (entry below) back to a **single full-width Go Live
button** for now — the Record button is removed. The record *functionality*
(start/stop, the store `command`, `pendingRecord` in StreamScreen) is untouched;
only the button is gone, and `GoLiveRecordBar`'s record props stay optional so
it can return cheaply.

The button now has **two visual states** driven by the shared
`broadcastStore.isLive`: **not live = light accent-tint fill** (`accent.surface`
+ `accent.border` + `accent.default` label) so it reads as ready/on without
shouting; **live = solid red** (`accent.default` fill + cream label) as before.
Built from `Pressable` + `Text` rather than the Button primitive, which can't do
a tint fill with an accent label. Because the state is shared, the button shows
the same thing on the dashboard and the stream view as you move between them.

### 2026-06-04 — Shared Go Live / Record control; separate live + recording lifecycles

The Go Live and Record actions are now a **single shared control** —
`GoLiveRecordBar` (feature, `features/broadcast/`): two matched side-by-side
buttons rendered identically on the **dashboard** and the **stream view**, with
state driven by the global `broadcastStore` so they never disagree (previously
the dashboard said "Go Live" while the stream view said "Leave"). Same shared-
state pattern as the "what's happening" title.

**Labels / semantics.** Live button: **Go Live** (idle) → **End Stream** (live).
Record button: **Record** (idle) → **Stop Recording** (recording).
- **Go Live** — start the stream, no recording.
- **Record** — start the stream (if needed) **and** start recording.
- **Stop Recording** — stop recording only; the stream keeps running.
- **End Stream** — stop recording (if any) **and** the stream.

**The room is created on Go Live, not on navigation.** Opening the stream view
(center tab) only starts a local preview; `createRoom` happens in `handleGoLive`.

**Leave no longer kicks you off the page.** Pressing **End Stream** stops the
broadcast but **stays on the stream view** (drops back to the armed preview).
The header back arrow leaves to the globe but **keeps a live broadcast running**
(in-app nav never ends it); only End Stream / background / close stop it.

**Constraints / wiring.**
- `broadcastStore` gained `isRecording` + a one-shot `command`
  (`endStream` / `startRecording` / `stopRecording`, with a nonce). The
  dashboard's buttons act on the **mounted** StreamScreen's running broadcast
  via `command` when already live, or start a new broadcast by navigating
  (`stream/new?go=1`, `&rec=1` for Record) when idle. StreamScreen consumes the
  command; recording start/stop is split into `startRecording` / `stopRecording`
  and a `pendingRecord` ref starts recording once `streamId` resolves after a
  go-live-and-record.
- End-Stream-from-dashboard is guarded by an `isFocusedRef` so it doesn't turn
  the preview camera on in the background.
- `GoBar` is retired from the dashboard (still in the library). **Follow-up:**
  add `GoLiveRecordBar` to the feature gallery + Section 3 register.
- **Needs on-device testing** (button parity across screens, go-live-and-record
  timing, End-Stream-stays-on-page, dashboard commanding a live stream).

### 2026-06-04 — 5-item footer + center Stream tab with a live preview

The footer is restructured to **5 items** with the stream view in the centre:
**Globe · Dashboard · [Stream] · Me · Events**. Library + Wallet leave the
footer (reached from the Me screen). The footer is a **fully custom bar**
(`AppTabBar` in `app/(app)/_layout.tsx`, not React Navigation's
`BottomTabBar`) so we control exactly five slots; it navigates via the
imperative `router` and highlights from `usePathname`.

**Center "Stream" icon.** An accent **dot** — static when idle, **two
concentric rings pulsing outward while live** (radar ping; `isLive` from
`useBroadcastStore`, opacity/scale only so it stays on the native driver and
off CALayer-affecting properties per the focus-shadow rule). Tapping it opens
the broadcaster's own stream view (`stream/new`).

**Stream view becomes preview + go-live.** Tapping the centre tab shows a
**live preview of the armed sources without going live** — if camera is armed
you see your own feed (`useMediasoup.startPreview` acquires getUserMedia with
no transport/produce; `startBroadcasting` later reuses that same stream). The
preview has a shared **title input** and a **GO LIVE** button. You can go live
from **either** the dashboard (navigates `stream/new?go=1`, auto-goes-live) or
the preview's button — both funnel through one `handleGoLive`.

**Shared title.** Per the title decision (shared input on both), `captureConfig`
gained a persisted **`title`** and is now the single source of truth for arming
+ title; the dashboard reloads it on focus so the two surfaces stay in sync.

**Replaces the live-return bar** (entry below) — the animated centre icon is the
way back to a running broadcast now. In-app navigation still keeps the broadcast
alive (the stream tab never unmounts); background/close still end it.
`useBroadcastStore` now carries `{ isLive, sources }` (live source set read by
the live view so tab re-entry doesn't depend on route params).
`activeBroadcast` is trimmed to `{ ppvEventId }`. **Needs on-device testing**
(preview feel, the dot/rings animation, footer vs. dashboard GoBar / stream
overlays).

### 2026-06-04 — Record moves off the dashboard to the stream view; headless broadcast reversed

The dashboard's **per-source Air/Rec two-affordance model is reversed**. The
dashboard now arms **Air only** (plus the Identity flag and Location precision
controls); there is no Rec toggle on it anymore. Recording is now a **single
Record button on the stream view** — pressing it records whatever is on air;
each recording becomes a clip in the user's Library (the recordings → Library
pipeline already existed and is unchanged).

In the same change, the **headless dashboard broadcast is reversed**: Go Live no
longer goes live in place on the dashboard. It now **navigates to the stream
view** (`stream/new`), which **auto-goes-live on arrival** — there is no
intermediate "Start stream" step. The broadcaster lands on their live stream
page, where the Record button lives.

**Rationale (Ben):** the capture model is simpler as "arm what airs, then
record what airs" — one record control in one place, at the moment of
broadcast, instead of a second per-source dimension set-and-forgotten on the
dashboard. Putting the Record button on the stream view requires the broadcaster
to actually be there, which is why headless is reversed.

**Constraints downstream:**
- `FeedRow` keeps its two-affordance capability behind a new **`showRec` prop**
  (default `true`, so the gallery still documents Air+Rec); `DashboardScreen`
  passes `showRec={false}`. `Toggle.armed` is unaffected.
- `captureConfig` dropped its `rec` set (Air-only now). `activeBroadcast` dropped
  `record` and gained `ppvEventId` (so the rerouted go-live still links PPV
  events — previously only the headless path forwarded it).
- `StreamScreen` auto-goes-live on focus (guarded so refocusing while live
  doesn't restart); data-only broadcasts (no camera/audio) are allowed; the
  broadcaster is sent to the dashboard on app-background so the screen never
  sits stuck on the "Going live…" frame. `CoordHUD` / the idle arming preview on
  StreamScreen are retired.
- The on-air-vs-recording indicator (`BroadcastStatusIndicator`) and the Record
  button itself were already on the stream view — only the dashboard side and
  the navigation changed. **Needs on-device testing** (auto-go-live timing,
  re-entry after a drop, background→dashboard nav).

**Live-return bar (same day).** Navigating to another page in-app must NOT end
the broadcast — only the stream view's Leave, app-background, and close do. The
stream tab never unmounts, so the broadcast already survives in-app navigation;
the missing piece was a way back. A persistent **`LiveReturnBar`** now sits
directly above the tab bar (rendered via the `Tabs` `tabBar` prop wrapping
`BottomTabBar`) whenever a broadcast is live — a `LivePill` + "Return to your
stream" + chevron, tapping it navigates back to `stream/new` (which sees the
stream still in-room and does not restart it). Backed by a new reactive
`useBroadcastStore` (`isLive`), set by `StreamScreen` while the broadcaster is
in-room and cleared on every end path. Hidden while already on the stream view.
The navigation is shared via `returnToActiveBroadcast()` in `lib/activeBroadcast`.

**Own stream on the globe (same day).** A streamer never sees their own stream in
the globe drawer or the pin cards (filtered by `hostId === my user id` in
`GlobeScreenMapbox`). Their own pin still shows, rendered **black**
(`#111111`, via an `isSelf` GeoJSON property added to each of the exact/city/
country single-pin layers) — tapping it calls `returnToActiveBroadcast()` (same
path as the tab-bar link) instead of opening a join card. Self is also filtered
out of cluster-leaf cards. All other drawer curation rules are unchanged.

**Pin numbers are clusters-only (same day).** The single-pin viewer-count label
was removed — numbers on the globe now appear only on clusters. The cluster
count excludes the viewer's own stream (a `selfCount` cluster property is
subtracted from `point_count` in the `cluster-count` label).

### 2026-06-04 — Sans weight scale dialled down one step

Immediately after bundling the real fonts (entry below), the app read heavier
everywhere — because the previously-unloaded families had all fallen back to
system *regular*, so `bodyEmphasized`/`heading`/`display` (chips, cards,
pressable labels, …) had been silently rendering at ~400 instead of their
specified 600. Bundling made them their real SemiBold, which looked "bolder."

**Decision (Ben):** keep the real fonts but **lighten the sans scale one step**
so it reads close to the look the app was developed against — hierarchy now
leans on size, not weight:

| Variant | Was | Now |
|---|---|---|
| `display`, `heading` | InterTight_600SemiBold | **InterTight_500Medium** |
| `bodyEmphasized` | InterTight_600SemiBold | **InterTight_500Medium** |
| `body`, `caption` | InterTight_500Medium | **InterTight_400Regular** |

**Constraints:** added `InterTight_400Regular` to the bundle (now 5 faces).
`InterTight_600SemiBold` stays bundled — still used directly by `AmountInput`.
**Mono is unchanged** (monoLabel/Caption/Value at 500; the TimeScrubber clock
keeps its 500 neighbours + 700 bold centre) — mono wasn't part of the heavy
read. Tunable per-variant in `theme.ts` if any spot wants more/less weight.

### 2026-06-04 — Design fonts actually bundled (Inter Tight + IBM Plex Mono)

The design-system fonts were never loaded — `theme.typography.*` names families
like `InterTight_600SemiBold` / `IBMPlexMono_500Medium`, but nothing registered
them, so the whole app silently fell back to the system font. Bundled the **4
weights actually referenced** (Inter Tight 500/600, IBM Plex Mono 500/700) via
**runtime `useFonts`** in `app/_layout.tsx`, folded into the splash gate so
there's no flash of fallback.

**Decisions / constraints:**
- **Runtime `useFonts`, not the native config-plugin.** The `useFonts` keys
  *are* the family names, so they match the theme with zero token churn, and
  there's **no EAS rebuild** (works in the existing dev client). Native embed
  (which would need a rebuild) stays a v0.3 option — the family names don't
  change, so it's a non-breaking swap later. `expo-font` is a declared direct
  dep but is **NOT** in `app.json` plugins (that's the native-embed path).
- **Files committed to `assets/fonts/`** (4 `.ttf`, ~890KB), sourced from the
  `@expo-google-fonts/*` packages which were then removed — so no font npm deps
  and nothing extra for Metro to watch (Ben's EMFILE budget).
- **IBM Plex Mono 700 is a real face**, so the TimeScrubber bold focused centre
  is `fontFamily: 'IBMPlexMono_700Bold'` (not a `fontWeight` override — static
  fonts don't synthesise). Monospace ⇒ bold shares the medium advance ⇒ the
  MAR/MAY wrap is gone and `FIELD_W` is exact (no longer provisional).
- **Global visual shift:** every screen now renders the real design fonts
  instead of system fallback — intended (the system was designed for them), but
  worth eyeballing a few screens on device.

### 2026-06-04 — Time Machine: running-clock scrubber on the globe (UI v1)

Shipped `TimeScrubber` (Section 3) — a long thin running-WRLD-clock bar above
the globe drawer — and wired it into `GlobeScreenMapbox`. Kicks off the Time
Machine initiative (was a v0.3 backlog line).

**Decisions:** a single `offsetMs` behind the present (0 = live); scrubbing
back gives **real-time playback** (the playhead ticks forward at 1× from the
scrubbed instant and the globe replays surviving clips as it advances), with a
**NOW** button to return to live. Six independently-spinnable fields
(YR/MO/DY/HR/MIN/SEC) carry correctly via native `Date`. Collapsed = ticking
clock; tap to expand → ghosted neighbours + per-field drag. Accepted caveat:
the past is built from *surviving clips only*, thinner than live.

**Rationale.** Ben wants time travel to read as a clock you can spin — minimal
chrome, in-place on the globe, no separate mode/screen.

**Imposes:**

- The component is the UI half only. The historical replay is the backend
  seam in `GlobeScreenMapbox` (`useDiscoverySocket()` → time-indexed clip
  query) — Aaron's lane. Until then the globe stays live regardless of the
  clock; documented in CLAUDE.md "Time Machine initiative."
- New time-on-globe surfaces should reuse `TimeScrubber` / its `offsetMs`
  contract rather than a parallel time control.
- Needs on-device testing (gesture feel + drawer-tracking position). Scrub
  direction (drag-down = newer) is a one-line flip if it reads wrong.

### 2026-06-03 (late) — Dashboard goes live in place (headless broadcast)

Go Live now starts the broadcast **on the dashboard** — no navigation to
`StreamScreen`. The armed source toggles flip to the live (filled) state,
the button becomes **STOP STREAM**, and stopping reverts the toggles to
armed. Reuses the existing hooks: `useSignaling` (`connect` → `createRoom`
→ `disconnect`) + `useMediasoup` (`startBroadcasting` → `cleanup`).

**Rationale.** Ben wants arming and going live to be one in-place flow
with immediate visual confirmation (toggles fill, button flips), rather
than a hop to a separate broadcaster screen.

**Imposes / caveats (v1, headless):**

- **No preview / viewer count / chat / reactions / recording on the
  dashboard.** Those remain `StreamScreen`'s domain (which still owns
  viewing + the rich broadcaster UI). The dashboard is a headless
  broadcast *control*. Record-to-disk and the non-AV layers are still the
  backend follow-ups noted in CLAUDE.md.
- **The armed set is locked while live** — toggling mid-stream isn't wired
  to add/remove producers yet (the on-toggle handlers no-op while live).
- **AppState `background` stops the stream** (so viewers aren't stuck on a
  frozen frame); a server end (`broadcasterLeft` / admin) also stops it.
- **Singleton `signalingClient` is shared** with the never-unmounted
  `StreamScreen`. A broadcast-stop ripples to StreamScreen's `onClose`,
  but its `navigatingRef` guard (true after any prior stream exit, reset
  only on refocus) blocks a spurious globe navigation in the normal flow.
  You cannot view a stream and broadcast simultaneously (one WS) — same
  pre-existing limitation as before. **Needs on-device testing** (mediasoup
  can't run in CI): start/stop, and the "view a stream → back to dashboard
  → broadcast → stop" sequence.
- The dashboard no longer sets `activeBroadcast` or navigates to
  `/(app)/stream/new`; that broadcaster entry path is unused from the
  dashboard now (StreamScreen's `isNew` path stays for any other caller).

### 2026-06-03 (late) — Capture sensitivity friction removed (for now)

Stripped the sensitivity layer from the Go Live & Record surface: the
**SENSITIVE/BENIGN badges**, the **Rec consent lock-hint**, and the
**record-consent disclaimer** (`RecordConsentSheet`) are all disabled.
`FeedRow` dropped its `sensitivity` / `recNeedsConsent` props (and its
`Icon` compose); the Dashboard's `requestRec` consent branch, `consented`
state, and `RecordConsentSheet` render are gone — Rec flips directly for
every source.

**Rationale.** For the v0.2 friends-and-family dogfood the consent step +
badges were friction without payoff at this stage; Ben opted to remove
them for now and revisit. The two-affordance model, the precision ceiling,
and the on-air-vs-recording indicator (the *visible* half of the capture
guardrail) all remain.

**Imposes:**

- This **temporarily relaxes** the "nothing recorded silently" guardrail
  documented as *non-negotiable* in [CLAUDE.md](CLAUDE.md) (clips section):
  the consent step is the part removed; the during-broadcast indicator
  stays. Re-enabling is the path back to the full guardrail before any
  non-friends-and-family exposure.
- `RecordConsentSheet` stays a shipped feature (gallery entry intact),
  unused by the Dashboard — the runway for bringing consent back.
- Don't reintroduce sensitivity badges or per-source consent without a
  decision-log entry flipping this one.

### 2026-06-03 (evening) — Go Live & Record dashboard built (clips C2 + dashboard); two model refinements

The clips capture surface shipped on `design` this session. Built: `FeedRow`
two-affordance redesign (Air/Rec, sensitivity tag, consent lock-hint, `footer`
+ `trailing` slots, `live`/armed), `FeedThumb` v0.3+ glyph kinds
(speed/torch/temp/motion), `ArmButton`, `RecordConsentSheet`,
`BroadcastStatusIndicator`, `Toggle.armed`, `GoBar` label/knob overrides, and a
full `DashboardScreen` rewrite (Section 3 + 4 carry the entries). Two refinements
to the 2026-06-03 plan entry below:

- **One commit button, not two.** The per-source Air/Rec toggles are the single
  source of truth (set-it-and-forget-it); a single docked GoBar commits whatever
  they say and never flips them. The `Toggle` `armed` state (on-position,
  outline-not-fill) marks "cued, not yet live"; on commit it fills accent. This
  retires the `ArmButton` pair from the Dashboard (kept as a feature). The
  underlying **two source sets** (per-source broadcast + record) are unchanged —
  this is only the control surface. **Rationale:** the toggles already carry the
  full intent; a second pair of arming buttons duplicated state and could fight
  the toggles. Less chrome, one focal commit (Principles 2 + 3).
- **Any armed source can go live → data-only streams.** Go-live no longer
  requires camera/audio — any armed source (Air or Rec, any kind) enables the
  commit. Enables location-only shares, telemetry feeds, torch channels, and
  record-only sessions. The Dashboard shows all 11 sources interactive (the full
  model), with honest per-source status in the detail text.

**Imposes:**

- New focal-commit surfaces compose `GoBar` + the `Toggle` `armed` state, not a
  separate arming control, unless a genuine dual-intent case appears (then
  `ArmButton` is there).
- The `armed` Toggle state is opt-in (`armed` prop); existing toggles are
  unaffected. Don't make it the default.
- Layout: sticky title (top) + sticky single commit (bottom) is the arming-screen
  pattern — header / scroll / footer column, not a single ScreenScroll.
- App UI now runs ahead of the media backend: a no-AV (data-only) stream is live
  but transmits nothing yet, and record-only still creates a public room.
  Backend follow-ups (non-AV layer producers, data-only room support,
  private record-only, per-source record-to-disk) are tracked in
  [CLAUDE.md](CLAUDE.md) "Backend follow-ups this build assumes."
- The build advanced into Aaron's scoped C3 (`DashboardScreen`) + touched
  `hooks/useMediasoup` — both normally `main`/Aaron lane — at Ben's direction.
  The `design → main` merge needs coordination so C3 isn't rebuilt; see
  CLAUDE.md "App-side build (Ben, `design`, 2026-06-03)."

### 2026-06-03 — Clips initiative: per-source manifest model + two-button capture (DECIDED)

Builds on the 2026-05-29 clips + sensor entries. Those established the 7-layer
model, anon-on-My-Profile, and per-layer post-edit intent; this entry settles the
**data model** behind them and the **capture UX**, reconciled across all three
repos (see the DECIDED sections in `wrld-backend/CLAUDE.md` and
`wrld-mediasoup/CLAUDE.md`).

**Decision — per-source manifest.** A Recording is **per-source tracks**
(non-baked); a Clip is a **non-destructive manifest** over a recording. Editing
writes the manifest — no re-encode. This supersedes the shipped backend's
single-output recording + baked-clip approach for new work. Per-layer post-edit
(the 2026-05-29 intent) is realized as manifest source-state: on / off (reversible)
/ delete-permanently (irreversible — removes the track from disk, reclaims quota) /
not-captured (the source wasn't recorded).

**Decision — two buttons, two source sets.** Going live and recording are
independent. **Go Live** publishes the broadcast set; **Record** captures the
record set. Per source, a broadcast affordance and a record affordance, set
independently (all four combinations valid). A source can be recorded without being
broadcast and vice versa.

**Decision — capture privacy tiers.** Sensitive sources (camera, audio, location;
**screen OPEN**) require an explicit, visible consent step to **record** —
especially record-without-broadcast — plus a persistent during-broadcast
on-air-vs-recording indicator. Benign sources (gyro, compass) record-on by default.
Identity is an Attributed / Anon flag, not a track. Guardrail: nothing captured
silently. The durable user-facing version is the Capture Privacy Constitution
(CLAUDE.md pre-launch backlog).

**Open — profile vs library.** Where editable material lives (a separate Library
page vs profile-as-library + preview-public-view) is **not decided** — pending the
Claude Design comparison mocks. Don't bake either into components yet.

**Imposes (this doc / `design` lane, clips C2):**
- **FeedRow** gains a two-dimension control — broadcast + record toggles (built
  from `SegmentedToggle`), sensitive-tier consent treatment, and a
  location-precision sub-control (reusing `LocationGranularityPicker`).
- **Record button states** alongside GoBar's Go Live states.
- **During-broadcast on-air-vs-recording indicator** — new; Ben's inventory call
  whether it's a reusable feature or stays inline in StreamScreen.
- **LayerEditorRow** gains a **not-captured** state and a distinct, irreversible
  **delete-permanently** treatment (the shipped `deleted` + RESTORE is the
  reversible hide, not permanent deletion).
- The Section 3 entries above carry "Planned (clips initiative · C2)" notes. The
  clip mock set (Go Live & Record, consent sheet, indicator, clip editor, and the
  profile-vs-library comparison) lands in `docs/design/mocks/` and feeds the
  inventory pass.
- Phasing + the Ben/Aaron lane split live in `CLAUDE.md` ("Clips initiative —
  model, working split & rollout"). Ben owns these component additions on `design`;
  Aaron composes them into screens on `main`.

### 2026-06-01 — Sub-phase 12.7 (motion pass) shipped

Three named motion patterns ship in `theme.motion.patterns`: `press`,
`overlay`, `pulse`. Each is a `{ duration, easing }` pair consumed by
spreading into `Animated.timing()`. The `screen-transition` pattern from
the 12.0 placeholder list is deferred — expo-router covers route motion
and no consumer needs it today.

Two ancillary cleanups landed alongside the patterns:

- **Easing tokens converted from CSS strings to RN `Easing` references.**
  The 12.3 token shape stored easings as `'cubic-bezier(...)'` strings,
  which RN's `Animated` API can't consume. They were never imported by
  any code. Replaced with `Easing.out(Easing.quad)`,
  `Easing.inOut(Easing.quad)`, `Easing.linear`. This couples `theme.ts`
  to `react-native` via one named import — acceptable since the codebase
  is RN-only.
- **The dropped `spring` easing token** (`cubic-bezier(0.4, 1.4, 0.6, 1)`)
  had no consumer — RN's `Animated.spring` is its own thing, not a tween
  easing, so a tween token for it was always nonsensical. Removed.

Adoption:
- [Pressable](src/components/primitives/Pressable.tsx) → `patterns.press`
- [BottomSheet](src/components/primitives/BottomSheet.tsx) → `patterns.overlay`
- [ToastBanner](src/components/features/feedback/ToastBanner.tsx) → `patterns.overlay`
- [LivePill](src/components/features/stream/LivePill.tsx) → `patterns.pulse` (half-cycle each direction)
- [GoBar](src/components/features/broadcast/GoBar.tsx) → `patterns.pulse` (half-cycle each direction)

Motion left outside the pattern system: Spinner rotation, FeedThumb
sensor-decor, ReactionRail floaters, StreamScreen tip burst, GlobeScreen
ad-hoc camera pans, the two `Animated.spring` indicators
(BottomSheet sheet-body, Toggle / SegmentedToggle indicator). Documented
in Section 5.

**Imposes:**

- New motion that fits one of the three patterns must compose through
  `theme.motion.patterns.*`, not via raw `duration:` literals.
- Adding a new pattern requires a Section 5 entry + this section
  (justify the new role, list adopters from day one).
- Phase 12 is now complete. Next Phase 12-style cascade work (DESIGN.md
  / token / primitive iteration) carries the same merge protocol via the
  `design` branch.

### 2026-05-31 (evening) — `design` branch re-spun for 12.7+

Same-day reversal of the working-agreement note in the morning's
"Sub-phases 12.5 + 12.6 shipped" entry, which had floated the idea of
retiring the design branch now that 12.5/12.6 closed. Ben elected
instead to keep the high-churn isolation alive for 12.7 (motion pass)
plus any near-term DESIGN.md / token / primitive iteration that
benefits from the same pattern.

Mechanics: the morning's design → main merge (commit `f18bd48`) had
already advanced `main` to carry every 12.5/12.6 commit + the
back-merge of Aaron's Phase 17 / Phase 5/22 work. The design branch
got reset to that same `f18bd48` HEAD (deleted + re-checked out from
main) so the two branches diverge from the shared close-out state, not
from the older pre-12.5 split point.

Aaron stays on `main` (he's actively shipping Phase 5/22 follow-ups
plus whatever monetization iteration comes next). Ben works on
`design`. Merge protocol and conflict-resolution rules unchanged.

**Imposes:**

- The same merge protocol applies: pull `main` HEAD into `design`
  before any design → main push; theme-codemod Aaron's net-new code
  for the (now well-established) token shape; explicit Ben sign-off
  for the merge direction back.
- "Convention reverts after merge" lines from earlier entries are
  superseded here. The branch convention should be assumed active
  unless an explicit entry retires it.

### 2026-05-31 — Sub-phases 12.5 + 12.6 shipped on `design`

Single intensive working session. Tally on close:

- **47 features** shipped under `src/components/features/`, each with
  a Section 3 register entry carrying a **Shipped:** metadata line.
  Built in roughly thematic clusters (identity, onboarding info-cards,
  auth, wallet, broadcasting, clip editor, trust/safety, permissions +
  age gate). Complex features (DOBWheel, LocationGranularityPicker,
  Timeline, DiscoveryHandoffCard, LegalAcceptanceCard) each shipped
  as their own commit.
- **13 sections** under `src/components/sections/` (ScreenScroll +
  12 new). Batch 1: small composers — TrendingRail, CategoryChipRow,
  StreamStrip, DayGroup, ActionTilesRow, PresetGrid, SettingsGroup,
  InfoList, LegalLinkList. Batch 2: heavier — ActionSheet (BottomSheet-
  based), FilterCard (3 row kinds), WizardShell (canonical wizard
  scaffold). ActionTilesRow later grew a `cols=2` option mid-12.6 when
  Wallet's two-action row needed it.
- **15 screens** migrated. Settings, Me, Subscription, Dashboard,
  Onboarding, Login, Signup, Globe, Stream, Search, Profile,
  CreatorOnboarding, Wallet, TopUp, Cashout. Plus a header-comment
  pass on FollowButton + BroadcasterOnboardingScreen (already clean,
  just needed the explanatory header for consistency).
- **4 legacy features retired** (deleted from disk): ChatOverlay,
  ReactionLayer, NearbyStreamRow, NearbyStreamThumbnail. Each replaced
  by a design-system equivalent in the screens that consumed them.
- **3 surviving legacy features kept with token cleanup:** AuthModal
  (retirement runway: when AuthChoiceList + social-auth backends land,
  the whole modal gets rewritten as a BottomSheet wrapping
  AuthChoiceList), TipSheet (Aaron's Phase 13 domain — may evolve),
  FollowButton (already clean — composes Button primitive, no hex,
  no fontSize/fontWeight; got a header comment only).
- **1 surviving feature refactored internally:** NearbyStreamsDrawer
  (Phase 7 multi-angle hop UX shell stays; internals now compose
  StreamCard.compact + StreamCard.trending; distance lives in the
  city slot since StreamCard's consumer-flat API doesn't surface
  stream.distanceMeters directly).

Per the sub-phase 7 entry below, the mechanical 12.5/12.6 gates are
passed. Only 12.7 (motion pass) remains in Phase 12.

**Per-screen LOC deltas** for the substantial migrations:
- CreatorOnboardingScreen: 1046 → 517 net (−529) — every step had a
  feature match
- CashoutScreen: 511 → 286 (−225) — AmountInput + PresetGrid did the
  heavy lifting
- StreamScreen: 923 → 342 (−581) — ChatOverlay + ReactionLayer
  retirements + token consistency
- Total wallet trio: 1202 → 752 (−450)

**Imposes:**

- The next merge `design` → `main` will be the largest of the Phase 12
  era. Aaron has been on unrelated work during this stretch
  (confirmed by Ben at session close), so merge conflicts are expected
  to be minimal but the diff will be large by volume. The merge
  protocol (pull main HEAD into design first, theme-codemod for
  pre-12.3 token shape, explicit Ben sign-off) still applies.
- AuthModal + TipSheet stay on retirement runways. AuthModal retires
  when AuthChoiceList lands with social-auth backend wiring (no work
  scheduled — depends on Apple / Google credentials and either
  Aaron's or a future contributor's backend pass). TipSheet evolves
  with Aaron's Phase 13 monetization iterations; the token-clean
  baseline lets him compose AmountInput + PresetGrid in place when
  he revisits it.
- The 12.6 commit-message convention from the original sub-phase
  spec (`Phase 12: migrate <screen-name> to ui primitives`) was
  superseded mid-flight by the simpler `12.6: migrate <screen-name>
  to the design system` form. Both produce the same intent in
  `git log`; no need to rewrite history.

### 2026-05-30 — `design` branch revived for 12.5+

The 2026-05-30 "Sub-phase 12.4 shipped" entry said the design-branch
convention would revert after the merge and both Ben and Aaron would
return to direct-to-main. In practice the 12.5 work (sections +
features + screen migrations) is going to involve another high-churn
stretch of DESIGN.md edits, primitive tweaks, and on-device iteration
cycles. Aaron's parallel work on `main` (Phase 3 subscriptions,
stream/admin features) is meanwhile cleaner — fewer doc rewrites, more
discrete commits.

**Decision:** the `design` branch is back, tracked at `origin/design`,
and Ben works there for the rest of Phase 12. Aaron continues on
`main`. Periodic merges keep the two streams in sync (the 2026-05-30
merge proved this is a manageable amount of work — one textual
conflict + a 3-line theme codemod for a ~14-commit gap).

**Convention:** same as the 12.2 round. Ben's exclusive editing
surface for `DESIGN.md` is the design branch; `CLAUDE.md` is shared —
whoever ships a phase updates it. Aaron is unaffected until the next
merge; `design` may force-push or rewrite mid-flight without disturbing
`main`'s history.

**Imposes:**

- `design` branch tracking ref reset to `main` HEAD at `c37266b` so
  the two diverge from the latest shared state, not from the old 12.2
  `d25eeeb` merge commit.
- Merges from `design` → `main` continue to require:
  (a) `main` HEAD pulled into `design` first, with theme-codemod for
      any of Aaron's net-new code that uses pre-12.3 token shape;
  (b) explicit Ben sign-off before pushing to `main`.
- The "convention reverts" sentence in the 2026-05-30 12.4 close-out
  entry is superseded by this entry — call out the design branch as
  active when the next pulls happen.

### 2026-05-30 — CALayer reconfiguration on focus-driven shadows

Symptom: tapping any `Input` or `Textarea` in the app caused the
keyboard to start sliding up, retreat ~30ms later, and the field to
blur. Looked like an animation stutter; was actually a focus/blur
race.

Diagnostic path that found it:

1. Read `react-native-keyboard-controller`'s source
   (`KeyboardAwareScrollView`, `useSmoothKeyboardHandler`,
   `KeyboardProvider`). Nothing in the library calls `.blur()` or
   `Keyboard.dismiss()`; it only tracks keyboard events via worklets
   and adjusts scroll position.
2. Grep'd app + node_modules for `.blur()` and `Keyboard.dismiss()`
   calls. Nothing in app code.
3. Examined `Input.tsx`'s wrapper style array. Found that on focus,
   `glowStyle` flips between `null` and `theme.elevation.glow.accent`
   (a shadow object: `shadowColor`, `shadowOpacity`, `shadowRadius`,
   `shadowOffset`).

The root cause: on iOS, adding shadow properties to a `UIView` triggers
CALayer reconfiguration. The layer's bounds recalculation includes the
shadow's rendering area, which expands the view's effective visual
rect. UIKit reads the focused-input frame to size keyboard adjustments;
when the frame appears to change mid-keyboard-animation, UIKit
interprets it as a "focused field moved" event and cancels the
keyboard appearance. The TextInput inside the wrapper loses
first-responder status as a side effect.

**Decision:** Focus-driven shadows on focusable wrappers are forbidden.
The visual indication for focus is the **border color change** alone
(cheap property update on the layer, no recalc). Both `Input` and
`Textarea`'s focus-state-derived glow was removed in commits `7294983`
and `4c0b45a`.

Audited the other primitives that consume `theme.elevation.glow.accent`:
`Slider` (thumb, always-present), `Avatar` (live ring, prop-driven not
focus-driven), `Button` (`glow` prop, consumer-set). All stable
per-render — none have the CALayer issue. Decision applies only to
focusable wrappers (i.e. Input + Textarea today).

**Imposes:**

- Future Claude / collaborator MUST NOT re-add a state-conditional
  shadow to `Input` or `Textarea`'s wrapper style array. Section 3
  entries for both primitives carry the warning.
- New focusable primitives (none planned today, but if a future
  primitive composes a `TextInput` inside a wrapper) follow the same
  rule: state changes don't toggle shadows on the wrapper.
- The principle generalizes: any state-conditional style on a focusable
  wrapper should be inspected for whether it touches CALayer-affecting
  properties (shadows, masks, transform layers). Bounds-affecting style
  changes mid-keyboard-animation cancel the keyboard. Color-only
  changes are safe.
- If we ever want a focus glow back: render the shadow always (stable
  CALayer) and animate `shadowOpacity` from 0 → non-zero on focus.
  Don't add/remove the shadow style entry.

This entry is paired with the same-day "12.5 / ScreenScroll
form-screen migrations" work. The migrations exposed inputs in real
form contexts where the bug was visible; ScreenScroll itself wasn't
the cause.

### 2026-05-30 — Sub-phase 12.4 shipped + `design` branch merged back to `main`

20 primitives shipped on-device-reviewed in build order: `Text`, `Icon`,
`Pressable`, `Button`, `IconButton`, `Card`, `Input`, `Textarea`,
`HelpText`, `Pill`, `Chip`, `Avatar`, `Toggle`, `ProgressBar`,
`Spinner`, `BottomSheet`, `Slider`, `SegmentedToggle`, `Divider`,
`BrandMark`. `ComponentGallery` reachable in dev via Settings →
DEVELOPMENT row. Section 3 entries all moved from gap to shipped.

Mid-phase course corrections recorded:

- **Keyboard story** (separate entry below). Single-line `TextInput`
  focus broke under New Architecture; adopted
  `react-native-keyboard-controller` after four in-house attempts
  failed. Brought peer-chain deps `react-native-reanimated` v4 and
  `react-native-worklets` + a `babel.config.js` with the worklets
  plugin.
- **Button + Input loading affordance** swapped from RN's
  `ActivityIndicator` to the shipped `Spinner` primitive.
- **`Switch` → `Toggle`**: SettingsScreen migrated its two notification
  preference toggles.
- **`Avatar`** promoted from features → primitives; 7 Phase 8 callers
  migrated; old `src/components/features/user/Avatar.tsx` deleted.

**Design branch merged to main.** The `design` branch (created
2026-05-29 per the "Sub-phase 12.2 runs on a `design` branch" entry)
merged back into `main` after 12.4 close-out. Aaron's 14 main-side
commits (Phase 3 subscriptions + admin-ended stream flow +
broadcaster orientation through mediasoup + wallet refetch + view-shot
Metro stub) integrated with one textual conflict (`SettingsScreen.tsx`
— both sides added new entries near each other) and one 3-line theme-
shape codemod (`StreamScreen.tsx` `theme.colors.bg|text|textMuted` →
new nested shape). The flat-to-nested theme codemod that landed
atomically with 12.3 covered the existing tree; Aaron's net-new code
on top of main re-used the flat shape, hence the small post-merge
codemod. Aaron's `SubscriptionScreen.tsx` uses hardcoded hex values
rather than tokens — a 12.6 migration target, not a 12.4 blocker.

**Convention reverts.** Per the 2026-05-29 design-branch decision-log
entry, the branch was a 12.2-only exception; with the merge, both Ben
and Aaron return to writing directly to `main` (per CLAUDE.md working
style). The `design` branch tracking ref stays on `origin` for history
but isn't the default flow going forward.

**Imposes:**

- Aaron's next pull on `main` requires a dev client rebuild (`eas
  build --profile development --platform android`) because four new
  native modules landed (`@expo/vector-icons`,
  `react-native-keyboard-controller`, `react-native-reanimated`,
  `react-native-worklets`). Ben's iOS dev client was rebuilt during
  12.4 and is current.
- New `babel.config.js` at repo root (required by reanimated 4's
  worklets plugin). Future dep audits should not delete it.
- 12.5 starts now. First row is `ScreenScroll` (ahead-of-schedule per
  the prior 2026-05-30 entry).
- 12.6 screen migration scope grows by `SubscriptionScreen` (Aaron's
  hex-value-styled screen converts to token + primitive composition).

### 2026-05-30 — Adopt `react-native-keyboard-controller` for keyboard handling

Four rounds of RN-built-in attempts to make single-line `Input` focus
behave like multi-line `Textarea` focus all failed under the app's
New Architecture (`newArchEnabled: true` in `app.json`):

| Round | Approach | Result |
|---|---|---|
| 1 (`4c391a4`) | `KeyboardAvoidingView` w/ `behavior='padding'` | Textarea OK; Input still snapped to top — KAV padding reflow invalidated saved scroll position |
| 2 (`5419a9d`) | `automaticallyAdjustKeyboardInsets` on ScrollView, no KAV | Textarea OK; Input still snapped — no-op for UITextField under Fabric |
| 3 (`12c39f5`) | Plain ScrollView, no special props | Textarea OK; Input still snapped — UIKit's built-in scrollRectToVisible on UITextField focus was the actual culprit |
| 4 (`c2dcace`) | Manual scroll capture/restore via Keyboard.addListener | "A little better but still buggy" per Ben — iOS's scroll-to-(0,0) sometimes beats the willShow → didShow window |

The root cause: under RN New Architecture on iOS, single-line
TextInputs (UITextField) call UIKit's `scrollRectToVisible` on
becomeFirstResponder. In nested layout contexts that calculation
miscalculates as (0,0) — the page snaps to top. Multi-line TextInputs
(UITextView) don't trigger the same call, which is why Textarea worked
the whole time. RN's built-in keyboard tools all sit OUTSIDE this call
path.

**Decision:** Adopt `react-native-keyboard-controller` (v1.18.5,
installed via `npx expo install`). It's purpose-built for the New
Architecture and handles UITextField properly. Gallery's ScrollView
becomes `KeyboardAwareScrollView`; `KeyboardProvider` lands at the
root in `app/_layout.tsx`. Option 1 manual workaround is removed.

**Imposes:**

- **Dev client rebuild required.** The library has native iOS + Android
  code; Ben must run `eas build --profile development --platform ios`
  (and android) and reinstall before testing. From here on, dev clients
  carry this dep.
- `KeyboardProvider` stays at root indefinitely — every screen in the
  app inherits the keyboard-handling foundation, not just form-bearing
  ones.
- The 12.5 `ScreenScroll` section now wraps `KeyboardAwareScrollView`
  instead of plain `ScrollView`. The section gets `bottomOffset` and
  `scrollRef` props.
- During 12.6 migration, every form-bearing screen uses ScreenScroll
  and drops its bespoke keyboard handling (no remaining KAV usages
  anywhere in the app).
- **Anti-pattern flag (updated):** `<KeyboardAvoidingView>` wrapping a
  `<ScrollView>` AND plain `<ScrollView>` with single-line TextInputs
  are both smells. Use ScreenScroll (or the library's
  `KeyboardAwareScrollView` directly) instead.

### 2026-05-30 — `ScreenScroll` planned as a 12.5 section (ahead of 12.6 migration)

Surfaced during 12.4 Input + Textarea review: tapping the Textarea in
the deep-scroll ComponentGallery caused the screen to reposition to the
top, hiding the focused field. Two debug rounds:

- **Round 1 (commit `4c391a4`):** added `KeyboardAvoidingView` with
  `behavior='padding'` + `keyboardShouldPersistTaps='handled'` +
  `keyboardDismissMode='interactive'` + scroll paddingBottom. Fixed
  Textarea (which sits at the visible bottom), but Input rows in the
  middle of the scroll still snapped to top on focus.
- **Round 2 (this entry):** removed `KeyboardAvoidingView` entirely;
  switched to `automaticallyAdjustKeyboardInsets` on the ScrollView
  (iOS, RN 0.71+). This adjusts the ScrollView's content **inset** —
  a virtual offset — instead of reflowing layout via padding. Focused
  input scrolls into view; nothing else moves. Android's default
  `windowSoftInputMode=adjustResize` handles itself. Both Inputs and
  Textareas now behave correctly without screen reposition.

**Root cause locked in for posterity:** KAV-with-`padding` around a
ScrollView is the documented source of "screen jumps to top when
keyboard opens." KAV's added bottom padding reflows the content layout,
which on some RN versions invalidates the saved scroll position.
`automaticallyAdjustKeyboardInsets` avoids the reflow entirely.

**Decision:** `ScreenScroll` is added as a planned section (see
Section 3) using the Round 2 config and ships in 12.5 ahead of 12.6
migration. The Gallery becomes the first migrant; the 7 existing
Input-using screens (Login, Signup, Onboarding, Dashboard, Me, Search,
AuthModal) consume it during 12.6 instead of each rolling its own.

**Reuse-rule note:** Section 0.5 normally says wait for the second
proven case. Here the second case is imminent (12.6 migration would
otherwise force the same inline pattern across many screens) and Ben
explicitly opted for the abstraction. Worth recording as an
intentional, named exception rather than letting it look like the rule
was violated by accident.

**Imposes:**

- 12.5 gains a one-row scope addition (`ScreenScroll`) ahead of
  WizardShell, CategoryChipRow, and the rest.
- During 12.6, every form-bearing screen wraps in `<ScreenScroll>` and
  drops its bespoke keyboard handling.
- The Gallery's `automaticallyAdjustKeyboardInsets` ScrollView gets
  refactored to use the section once it ships — first-migrant test.
- **Anti-pattern flag:** future Claude / collaborator code-review should
  treat `<KeyboardAvoidingView>` wrapping a `<ScrollView>` as a
  smell — that combination IS the bug. Use ScreenScroll instead.

### 2026-05-29 — Sub-phase 12.2 resolved: 7 conflict decisions for Globe + Viewer Sheet

The inventory pass on `Globe Mobile.html` + `Viewer Sheet.html` surfaced
seven conflicts requiring resolution before the `design` branch could
merge into `main`. Outcomes below; "for now" qualifiers preserve a
future revisit window without re-opening the gate.

- **C1 = inline card for both pin and cluster.** The rich Viewer Sheet
  bottom-sheet pattern is deferred. Sheet-internal features
  (`VideoPreviewTile`, `CoordHUD.viewer-sheet` variant, full
  `BroadcasterRow` with Follow + follower count, 3-button action bar)
  stay in Section 3 for their other surfaces (broadcast HUD, clip
  editor, profile) but don't compose against the discovery→watching
  seam in v0.2. `DiscoveryHandoffCard` ships with two variants:
  `single` and `cluster`, both inline floating cards. Matches what's
  in `GlobeScreen.tsx` today; the v0.2 work is feature-extraction
  rather than redesign.

- **C2 = 5-chip streams strip lives as second row of the single inline
  card; v0.3 sensors render OFF (for now).** `StreamTile` returns to
  the v0.2 critical path. Caveat recorded: the OFF state advertises
  v0.3+ scope (LOC / GYRO / CMP) to v0.2 testers — switching to
  "only what's armed" is a one-line CSS change + dropping data rows,
  so the cost of reversal is near-zero.

- **C3 = search + chips on the globe overlay.** Backend gains a
  `Stream.category` column. **Category enum trimmed from the mock's
  6 to 2 for now: `All` (default, null) + `Cities`.** Single real
  enum value; Go Live flow gains a "city stream?" toggle. Search
  reuses the existing handle/title endpoint. Pattern ships; the enum
  grows as v0.3+ adds value lines.

- **C4 = no HUD on the globe.** `CoordHUD.globe` variant drops from
  v0.2. The variant entry stays in Section 3 for `broadcast-live`
  use; the globe's geographic self-orientation reads on its own.

- **C5 = WRLD hero + brand mark (hybrid).** New `BrandMark` primitive
  added (drawn-with-Views: concentric outer circle + scaleX + scaleY
  inner ellipses — globe as meridian + parallel). All-caps wordmark
  stays everywhere (header, splash, share thumbnails, app icon).
  GlobeScreen header composes inline: `<BrandMark size="hero" />` +
  `<Text variant="display">WRLD</Text>` + `<LivePill />`. A `Logo`
  composition feature isn't extracted until a second header needs it.

- **C6 = extract `StreamStateBanner` as a feature** with three
  variants (`disconnected`, `ended`, `resumed`). Complexity-bounding
  exception to the Section 0.5 reuse rule: one caller today
  (`GlobeScreen`), but the banner is a small state machine whose
  tracking, polling, transition, and dismiss logic earns its own
  feature file even before a second caller arrives.

- **C7 = empty state stays inline.** Section 0.5 reuse rule held:
  "No streams nearby" UI lives inside `GlobeScreen` until a second
  screen (Search empty result, Profile new-user, Wallet empty, Clip
  grid empty) proves the case. Promotion to an `EmptyState` primitive
  happens at that point.

**Imposes:**

- **New Section 3 rows landed in 12.2:** `BrandMark` (primitive);
  `DiscoveryHandoffCard`, `SearchBar`, `StreamStateBanner` (features).
  `CategoryChipRow` entry updated to record the v0.2 enum trim.
  Pre-captured findings (carry-over) marked resolved.
- **Backend (wrld-backend):** `Stream.category` enum column +
  migration + optional filter on `GET /streams/near`. Drives the C3
  cascade. Aaron's lane.
- **Go Live flow** ([DashboardScreen.tsx](src/components/screens/DashboardScreen.tsx))
  needs a Cities yes/no toggle.
- Sheet-internal features stay in Section 3 but aren't 12.5 priorities
  unless their other surfaces (broadcast HUD, profile, clip editor)
  also land.
- "For now" qualifiers on C2 (chip count) and C3 (category list) are
  binding for v0.2 ship but explicitly easy-to-reverse — flag a
  revisit if either chafes during testing.

This entry closes 12.2. The `design` branch merges into `main` once
this lands, after which 12.4 (build primitives bottom-up) resumes on
direct-to-main per [CLAUDE.md](CLAUDE.md) working style. The
"Sub-phase 12.2 runs on a `design` branch" entry below codifies the
branch convention; the merge undoes it.

### 2026-05-29 — Light-first pivot: v0.2 ships light mode only

The reference material in `docs/design/references/` (12 architectural
drawings + 7 brutalist UI compositions) is **inherently light** —
warm cream paper backgrounds, dark ink line work, photo-composited
architectural elements, warm crimson accents. The first 12.3 pass
derived a dark theme from these references by mentally inverting the
palette. Ben flagged this as drift: building dark from inverted light
is a guess at where the inversion needs care. **Building light first
is faithful — the references are directly inhabitable as UI surfaces.**

**v0.2 scope shift:**

- **`theme.ts` ships light mode only.** Single export, no `lightTheme` /
  `darkTheme` pair in v0.2. Adding a dark theme on the same semantic
  keys is a v0.3 follow-on (Section 8 updated).
- **EarthScene gets a light variant.** Clear color = cream paper
  (`#ece6d6`). Pin sprites render in warm crimson `#d92e3a` with cream
  borders that match the background — pins "punch through" the paper.
  Cluster glyph text in cream. Earth fallback color shifts from dark
  blue to warm sepia. Single-accent rule absorbed: no cluster-vs-single
  color split — differentiation by size + count only, per the
  carry-over Pin resolution from Section 3.
- **Section 8 (Out of scope) updated.** Old "Light mode is v0.3" line
  removed; replaced with "Dark mode is v0.3."

**Imposes:**

- Existing screens render in light mode as soon as they next mount.
  The visual shift from the previous (cool-blue, glass, dark) state is
  dramatic — that's the intent landing as a single step.
- `EarthScene` cream background means cards over the globe need either
  flat-surface treatment that reads on cream, or the opt-in `colors.bg.glass`
  blur. Existing globe overlay cards (banner, tap-to-preview) work as-is
  visually because they consume tokens; the radii / colors / contrast
  flip with the theme.
- **Dark-mode follow-on in v0.3:** same semantic keys, inverted palette
  values (cream → sepia near-black, dark ink → warm cream, accent
  unchanged). EarthScene also needs a dark variant. Both should be
  designed against the same reference set + Section 1 principles, not
  by mechanical inversion of light tokens (light was inverted from a
  light-reference set; dark should be re-derived).

**Methodological note carried forward:** every aesthetic decision
traces back to references + Section 1 principles. The mocks
(`docs/design/mocks/`) are inventory inputs only.

### 2026-05-29 — Sub-phase 12.3 shipped: `src/tokens/theme.ts` populated

The hybrid model is now real: internal `palette` (raw values), exported
`theme.*` semantic layer. Components import only the semantic layer.

**Course-correction surfaced mid-12.3** (recorded for posterity): The
first draft of `theme.ts` derived aesthetic values from the 12.2 mocks —
cool blue accent, two saturated colors (blue + red), cool-tinted
panels with glass-blur defaults. That was wrong. **Mocks inform layout,
functionality, and the component inventory; aesthetic comes from
references + principles.** The corrected derivation comes from
`docs/design/references/` (12 architectural drawings + 7 brutalist UI
compositions) plus Section 1 principles. The references' palette is
consistent across the set: warm cream backgrounds, dark ink line work,
warm wood / rust / amber tones, **single saturated color = warm
crimson red**, hairline grids + flat surfaces, no glass blur.

**Locked rulings (aesthetic — references + principles win; mocks deviate):**

- **Single accent = warm crimson red `#d92e3a`.** Used for every "look
  here" role: LIVE indicator, primary CTA, focus rings, danger /
  destructive treatments, accent badges. No separate `colors.live`
  token. The mocks' two-color treatment (blue accent + red live) was
  incorrect aesthetic input — references consistently show ONE
  saturated color, and Section 1 Principle 2 says exactly that.
- **Warm undertone.** Background, text, borders all have sepia / cream
  tints (not cool white-grey). `bg.primary = #0d0b08` (sepia near-black);
  `text.primary = #ece6d6` (warm cream). Border lines are warm cream
  rgba, not cool white rgba.
- **Flat surfaces with hairline borders are the default panel
  treatment.** Glass `backdrop-filter:blur` exists as `colors.bg.glass`
  for surfaces overlaying the globe (where dynamic backgrounds genuinely
  need legibility help) but is NOT the default. References show flat
  cream/charcoal surfaces with thin warm-tinted borders.
- **Typography = Inter Tight (sans) + IBM Plex Mono (mono).** IBM Plex
  Mono replaces JetBrains Mono — the references' technical-drawing
  aesthetic reads as engineering-document, not code-screen.
- **No #000 / no #fff** confirmed — every reference's palette stays
  inside the inverted-newspaper rule.

**Locked rulings (structural — unchanged from earlier rulings):**

- **Radius scale:** strict `radius.md = 4` for all chrome surfaces;
  `radius.full` for pills + circular buttons. Mocks render r:14–22 on
  cards, buttons, and sheets; references show hard rectangular shapes.
  Both inputs agree on the tight scale; tokens override the mocks'
  visual radii.
- **Glow:** opt-in per surface. `elevation.glow.accent` exists for
  consumers to wire on specific CTAs (Go Live, hero onboarding steps);
  `Button` primary does NOT default-glow. Avoids the "everything is
  glowing" failure mode at scale.
- **Warn:** kept as dedicated `colors.warn` (amber `#e6a23d`). Used by
  PasswordStrengthMeter mid-tier + LegalAcceptanceCard CCPA jurisdiction
  badge. Two surfaces today; reserves the slot.

**Existing flat-access usages migrated atomically (same commit):** ~25
files updated. Pattern: `theme.colors.bg` → `theme.colors.bg.primary`;
`theme.colors.textMuted` → `theme.colors.text.muted`;
`theme.colors.accent` → `theme.colors.accent.default`. Critically:
`theme.colors.danger` AND `theme.colors.live` (both gone now) →
`theme.colors.accent.default` (single-accent rule).
`theme.typography.title` → `theme.typography.display`;
`theme.radius.{sm,lg}` → `theme.radius.md` (strict r:4). Spacing scale
shifted: `spacing.md` is now `12` (was `16`); existing surfaces using
`md` get tighter padding. tsc baseline of 12 pre-existing errors
unchanged (three.js types + Expo Router typed-route literals).

**Imposes:**

- Font loading (`expo-font` + Google Fonts) is a 12.4 pre-flight — see
  Section 2's "Font loading" block. Without it, typography tokens
  reference unloaded family names and fall back to system fonts.
- Aaron's monetization-UI work is **green-lit** to start now per the
  working agreement in Section 7. Compose either directly from tokens
  (for surfaces shipping before 12.4 primitives) or from primitives
  once 12.4 lands.
- Existing screens visually shift dramatically when they next render:
  blue → warm red, cool → warm undertones, large radii → r:4, glass
  → flat. This is the design-system intent landing as a single visual
  step; screen-level refinement happens during 12.6 migration.
- **Methodological note:** future aesthetic decisions trace back to
  `docs/design/references/` + Section 1 principles, NOT to
  `docs/design/mocks/`. Mocks are inventory inputs only.

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

### 12.4 — Build primitives, bottom-up ✅ shipped 2026-05-30

20 primitives shipped, in build order: `Text`, `Icon`, `Pressable`,
`Button`, `IconButton`, `Card`, `Input`, `Textarea`, `HelpText`,
`Pill`, `Chip`, `Avatar`, `Toggle`, `ProgressBar`, `Spinner`,
`BottomSheet`, `Slider`, `SegmentedToggle`, `Divider`, `BrandMark`.
Each landed with a `ComponentGallery` entry and a Section 3 row, and
Ben reviewed each on device before the next. `ComponentGallery`
reachable via Settings → DEVELOPMENT row (gated on `__DEV__`).

Mid-phase course correction recorded in the 2026-05-30 decision-log
entry ("Adopt `react-native-keyboard-controller`"): RN's New
Architecture broke the single-line `TextInput` focus story; four
in-house attempts failed before the library landed. `KeyboardProvider`
at root + `KeyboardAwareScrollView` in the gallery; `ScreenScroll`
ships first in 12.5 as the canonical screen-level wrapper.

**Gate to 12.5:** ✅ passed. All 20 primitives shipped, Section 3
populated, gallery renders cleanly, Ben signed off on device.

### 12.5 — Build features and sections ✅ shipped 2026-05-31

47 features + 13 sections shipped on the `design` branch, in roughly
clustered batches. Every Section 3 entry carries a **Shipped:**
metadata line. Gallery split into three pages per the tier model
(`PrimitiveGallery` / `FeatureGallery` / `SectionGallery`), each
linked from Settings → DEVELOPMENT.

Major mid-phase decisions captured in decision-log entries on the
same day: file-header CALayer rule generalisation, single-accent rule
applied to monetization (Stardust loses bespoke gold), composition-
note pattern for features that deviated from their initial DESIGN.md
draft (e.g. StreamStateBanner kept polling state at the screen level,
DOBWheel swapped FlatList for ScrollView to silence the nested-
virtualization warning).

**Gate to 12.6:** ✅ passed. All features + sections shipped, Section 3
populated, three galleries render cleanly, Ben signed off on device.

### 12.6 — Migrate screens, one per commit ✅ shipped 2026-05-31

15 screens migrated:
- **Settings** (highlight IDENTITY group added free via SettingsRow +
  AccountIDPill)
- **Me** (AvatarPicker + PursesCard dual)
- **Subscription** (3 tier cards via Card primitive, comparison
  matrix expansion, full 23-row feature spec applied via Ben's
  2026-05-31 spec drop)
- **Dashboard** (FeedRow × 7 layers; cam + audio armable today, other
  5 ship as `disabled` per the re-baselined 7-layer model)
- **Onboarding** (WizardShell + RulesChecklist + AvatarPicker + skip
  CTA fork on the choice step)
- **Login + Signup** (BrandMark + PasswordStrengthMeter; AuthChoiceList
  intentionally deferred until social-auth backends land)
- **Globe** (StreamStateBanner + DiscoveryHandoffCard for single + cluster
  taps; BrandMark + Pill header; EarthScene + Mapbox untouched)
- **Stream** (BroadcasterRow + ChatMessage/Composer + ReactionRail +
  CoordHUD + LivePill; ChatOverlay + ReactionLayer retire)
- **Search** (SearchBar + BroadcasterRow row)
- **Profile** (Avatar xl + MetaStrip "Joined ..." + Text-variant stats)
- **CreatorOnboarding** (10-step WizardShell composing DOBWheel +
  LocationGranularityPicker + PermissionPrePromptCard + ConsentRow +
  LegalLinkList — every feature found a use)
- **Wallet + TopUp + Cashout** (PursesCard + ActionTilesRow +
  BundleCard + AmountInput + TransactionRow + CategoryChipRow +
  PresetGrid; gold treatment for Stardust retires per single-accent
  rule)

Plus cleanup:
- ChatOverlay, ReactionLayer, NearbyStreamRow, NearbyStreamThumbnail
  deleted (replaced by design-system equivalents)
- NearbyStreamsDrawer survives — internals refactored to compose
  StreamCard.compact / .trending
- AuthModal + TipSheet kept (on retirement runways) with token
  cleanup pass
- FollowButton confirmed already clean (composes Button primitive)
- BroadcasterOnboardingScreen confirmed as 9-line redirect shim

The work also extended one section: ActionTilesRow grew a `cols=2`
option (Wallet's two-action row needed it).

**Gate to 12.7:** ✅ passed. All screens migrated; mechanical criteria
1–3 met. Design branch ready to merge to main after Ben's full-sweep
device review.

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

- **Dark mode.** v0.2 ships **light mode only** (cream paper aesthetic
  derived from references). Dark mode follows in v0.3 — same semantic
  keys, inverted palette values, with EarthScene also getting a dark
  variant. No theme toggle in v0.2. See DESIGN.md Section 6 decision-log
  entry 2026-05-29 "Light-first pivot" for rationale.
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
