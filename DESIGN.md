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

#### `BrandMark`

- **Tier:** primitive
- **Location:** `src/components/primitives/BrandMark.tsx`
- **Variants:** `currentColor` (inherits parent text color)
- **Sizes:** sm (18px), md (22px), lg (26px), hero (32px)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** GlobeScreen header, splash screen, share thumbnails, future logo composition
- **Last reviewed:** 2026-05-29

**Mock says:** Hollow outer circle + two crossing inner ellipses (one
scaled to ~0.35 on X, one on Y). Reads as meridian + parallel through a
globe — a literal-but-fitting brand mark for a planet-of-streams product.
Border-width scales with size (1.5px at sm, 2px at lg+).

**Code does:** None. GlobeScreen header today is wordmark-only ("WRLD"
Text display, no mark).

**Gap / proposal:** Drawn-with-Views primitive — three nested `View`s
with `borderRadius: 50%` and `scaleX` / `scaleY` transforms. No SVG
dependency. Color inherits via parent text token; consumers can override
by wrapping in a `<Text>` with a custom color. A `Logo` composition
(BrandMark + wordmark Text) isn't extracted as a feature until a second
header demands the same pairing — for now, inline in the GlobeScreen
header.

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

- **Tier:** feature (composes Pill + animated dot)
- **Location:** `src/components/features/stream/LivePill.tsx`
- **Variants:** `default` (live fill + pulsing white dot), `compact` (smaller, for thumb overlays)
- **Sizes:** sm (h:22), md (h:28)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every LIVE marker — top strips, video thumbs, broadcast HUDs, banners

**Mock says:** Iconic LIVE marker. Live-tone fill, pulsing white square
or dot inside (1.4–1.6s animation), all-caps mono "LIVE" label with
tracked letter-spacing. Appears in every mock that involves an active
broadcast.

**Code does:** Inline `<View>` + `<Text>` with `theme.colors.live` in
several screens.

**Gap / proposal:** Single feature owns the pulse animation +
visual treatment. Composes Pill (live variant) + bespoke animated dot.

---

##### `StreamCard`

- **Tier:** feature
- **Location:** `src/components/features/stream/StreamCard.tsx`
- **Variants:** `trending` (Globe bottom sheet — w:158), `preview` (Viewer Sheet — 16:10 hero), `compact` (sheet row)
- **Sizes:** controlled by variant
- **States:** default, pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Globe trending rail, Viewer Sheet preview, search results, future feed surfaces

**Mock says:** Thumbnail with overlay metadata (LivePill top-left,
viewer count bottom-right, channel label bottom-left optional). Title +
city/channel underneath. The `trending` variant is a 158×~140 card in a
horizontal scroll. The `preview` variant is a 16:10 hero with a play
button center + channel label corner.

**Code does:** `NearbyStreamThumbnail` + `NearbyStreamRow` in
`features/stream/`. Bespoke implementations. No shared shape.

**Gap / proposal:** Unified StreamCard with the 3 variant families
above. Old `NearbyStream*` components retire when callers migrate.

---

##### `ClipCard`

- **Tier:** feature
- **Location:** `src/components/features/clip/ClipCard.tsx`
- **Variants:** `public` (Profile grid), `owner` (My Profile, with anon treatment + layer badges)
- **Sizes:** controlled by variant
- **States:** default, pressed, anon (owner only), draft (owner only)
- **Used in:** populated in 12.6
- **Tweak impact:** Profile clip grid, My Profile clip grid, any future replay surface

**Mock says:** Thumbnail (16:11 aspect) with overlay metadata. Duration
pill top-left, peak-viewer-count or anon-lock or draft pill top-right or
bottom-right. Title + venue + date underneath. **Owner variant** adds a
layer-badge row (5 small icon tiles showing which of CAM / AUD / LOC /
ID / GYR were active during the recording). **Anon owner clips** get a
desaturated + diagonal-stripe overlay and "ONLY VISIBLE TO YOU" caption.

**Code does:** None — clips are new (v0.2 per re-baseline 2026-05-29).

**Gap / proposal:** New feature. ClipCard renders a `Clip` domain object.
Anon treatment is owner-variant-only (public-side excludes anon clips
entirely — that's a parent's responsibility).

---

##### `StreamTile`

- **Tier:** feature
- **Location:** `src/components/features/stream/StreamTile.tsx`
- **Variants:** `default` (Viewer Sheet sensor row)
- **Sizes:** md (h:~80, min-width 84)
- **States:** on (active layer), off (faded), pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet's STREAMS strip, future stream-source display surfaces

**Mock says:** Vertical tile with icon-square (28×28) on top, mono-caps
label in middle, value/spec below (e.g. "1080p", "48 kHz", "GPS", "192°"
for compass heading, "OFF" for inactive). On-state: line-2 border tinted
accent. Off-state: opacity 0.45.

**Code does:** None — current Viewer Sheet feature is `NearbyStream*`
patterns; no per-sensor tile.

**Gap / proposal:** New feature. Renders a layer descriptor object
(`{ kind, label, value, active }`). Composed by Viewer Sheet's
`StreamStrip` section.

---

##### `CoordHUD`

- **Tier:** feature
- **Location:** `src/components/features/stream/CoordHUD.tsx`
- **Variants:** `viewer-sheet` (4-column inline), `broadcast-live` (right-justified panel)
- **Sizes:** controlled by variant
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet meta block, Broadcast Live HUD overlay

**Mock says:** Grid of label/value pairs (LAT / LON / ELEV / UPTIME,
sometimes more). All mono, tabular-numeric values. Label is dim and
small caps. Value is brighter, monospace.

**Code does:** None.

**Gap / proposal:** New feature accepting an array of `{ label, value }`
+ optional `pending` flag (renders dim). Variant controls layout
(inline grid vs right-justified panel).

---

##### `VideoPreviewTile`

- **Tier:** feature
- **Location:** `src/components/features/stream/VideoPreviewTile.tsx`
- **Variants:** `play` (with center play button), `live` (no play button, LivePill instead)
- **Sizes:** controlled by aspect (16:10 default)
- **States:** default, pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet preview, Clip Edit preview hero, future replay thumbnails

**Mock says:** Aspect-ratio container with simulated camera/scene
content. Grain texture overlay. Overlay metadata pills (LIVE top-left,
viewer-count top-right, channel-label bottom-left). Optional center play
button (semi-transparent circle + play icon).

**Code does:** None as feature; Phase 7's `RTCView` is the real
broadcast surface (not a preview).

**Gap / proposal:** New feature for paused / preview / thumbnail states.
Real-live broadcast uses Phase 7 `RTCView` directly (not VideoPreviewTile).

---

##### `ReactionRail`

- **Tier:** feature (composes IconButton + count-badge Pill + animated FloatingHearts overlay)
- **Location:** `src/components/features/stream/ReactionRail.tsx`
- **Variants:** `default`
- **Sizes:** md (44×44 per reaction button)
- **States:** default, pressed (per button), on (per button — colored)
- **Used in:** populated in 12.6
- **Tweak impact:** Broadcast Live HUD, any future live reaction surface

**Mock says:** Vertical column of round reaction buttons (44×44, glass
backdrop). Each button has a small count-badge in the corner. On press,
emits a FloatingHearts animation that drifts upward (Periscope-style).
Active reaction state: live-tinted border + icon.

**Code does:** `ReactionLayer` in `features/stream/` (Phase 10) handles
hearts. No rail UI — current code has inline reaction buttons in
stream view. Refactor merges into one feature.

**Gap / proposal:** New combined feature replacing ReactionLayer +
inline buttons. Composes the icon column + the floating animation overlay
as one cohesive surface.

---

##### `DiscoveryHandoffCard`

- **Tier:** feature (composes Avatar + Text + Button + StreamTile)
- **Location:** `src/components/features/stream/DiscoveryHandoffCard.tsx`
- **Variants:** `single` (one pin tap — Avatar + title + handle + meta + Join, with optional 5-chip streams strip as second row per C2), `cluster` (multi-pin tap — small header + scrollable rows, each Avatar + title + meta + Join chip)
- **Sizes:** controlled by variant
- **States:** default, dismissing
- **Used in:** populated in 12.6
- **Tweak impact:** discovery→watching seam (the canonical Section 0.7 example) — every globe tap-to-preview surface

**Mock says (C1=C):** Inline floating card at the bottom of the
GlobeScreen — `single` is a Card with Avatar + title + handle + viewer
count + Join button; `cluster` is a Card with a small header ("N live
streams here · LOCATION") and N rows of compact stream-row items.
**Not** a bottom-sheet pattern in v0.2 — the rich Viewer Sheet mock is
deferred (see C1 in the 2026-05-29 12.2 decision-log entry). The single
variant gains a second-row `StreamStrip` of 5 chips per C2=A.

**Code does:** Inline `<View>` blocks in `GlobeScreen.tsx` for both
single (`selectedStream`) and cluster (`selectedClusterStreams`) cases.

**Gap / proposal:** Extract as feature accepting either `{ stream }` or
`{ streams }` (variant inferred from prop shape). Composes `Avatar`,
`Text`, `Button` primitives + the `StreamStrip` section for the single
variant's sensor row.

---

##### `SearchBar`

- **Tier:** feature (composes Input + Icon)
- **Location:** `src/components/features/discovery/SearchBar.tsx`
- **Variants:** `default` (globe overlay — glass pill with mag-glass icon + Input)
- **Sizes:** md
- **States:** default, focused
- **Used in:** populated in 12.6
- **Tweak impact:** Globe overlay search slot; any future search surface

**Mock says (C3=A):** Glass pill (radius:full, panel bg, line border,
backdrop-blur) with leading mag-glass Icon + Input. Placeholder
"Search handle, title, or city". Sits below the WRLD + LIVE header,
above the CategoryChipRow.

**Code does:** None on globe; `SearchScreen.tsx` has a standalone Input
hitting the existing handle/title search endpoint.

**Gap / proposal:** Lifts the existing search endpoint onto the globe
overlay. Reuses the `Input` primitive inside a glass-pill container.
SearchScreen may eventually merge into Globe per Section 4 TBD —
this feature is the lift target either way.

---

##### `StreamStateBanner`

- **Tier:** feature (composes Card + Icon + Spinner + Text + dismiss)
- **Location:** `src/components/features/stream/StreamStateBanner.tsx`
- **Variants:** `disconnected` (spinner + waiting-to-reconnect message; polls), `ended` (auto-dismisses after 8s), `resumed` (accent-tinted, tappable to rejoin)
- **Sizes:** md
- **States:** entering, visible, dismissing
- **Used in:** populated in 12.6
- **Tweak impact:** GlobeScreen post-stream-exit notifications

**Mock says (C6 = extract):** Top-of-globe banner that surfaces
stream-lifecycle state to viewers after they exit a stream. Three
variants cover the lifecycle: broadcaster reconnecting, broadcaster
gone, broadcaster back online.

**Code does:** Inline composition in `GlobeScreen.tsx` (Phase 9) with
local state for the banner, polling timer for reconnection, and
auto-dismiss timer for ended. Real implementation — extraction is a
straight lift.

**Gap / proposal:** Extract as a feature managing the small state
machine internally. Globe consumes via `<StreamStateBanner signal={...} />`
that derives the variant from the `StreamSignal` from
`src/lib/streamSignals.ts`. The 10s polling for the `resumed` transition
lives inside the feature (still uses `streamsApi.near`).
**Complexity-bounding exception to Section 0.5:** one caller today
(`GlobeScreen`), but the banner is a small state machine whose tracking,
polling, transition, and dismiss logic earns its own feature file even
before a second caller arrives.

---

#### User / Identity

##### `BroadcasterRow`

- **Tier:** feature (composes Avatar + Text + FollowButton)
- **Location:** `src/components/features/user/BroadcasterRow.tsx`
- **Variants:** `default` (full row with Avatar + name + alias + follower-count + Follow), `chip` (compact rounded-pill version for HUD overlays)
- **Sizes:** controlled by variant (default ~50px row, chip ~32px)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet, Broadcast Live, Profile, stream view broadcaster identity row

**Mock says:** Avatar (sm/md) + name (sans) + handle alias (mono) +
optional follower count + FollowButton on the right. The **chip**
variant is a rounded-pill version with everything inline + glass blur,
used in Broadcast Live's HUD.

**Code does:** Inline composition in stream view's broadcaster identity
header (Phase 8). No shared feature.

**Gap / proposal:** Extract as feature. Variant prop controls the
layout. `User` domain object passed as prop.

---

##### `MetaStrip`

- **Tier:** feature
- **Location:** `src/components/features/user/MetaStrip.tsx`
- **Variants:** `default`
- **Sizes:** md (2-row, ~28px tall)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Profile header, My Profile header, future identity-with-metadata cards

**Mock says:** 2-row dot-separated info pattern. Row 1: followers count
+ joined date. Row 2: region + pronouns (or any optional metadata). Mono
font, dim ink, mid-dot separators.

**Code does:** None.

**Gap / proposal:** Accepts an array of `{ label, value }` pairs and
renders them as dot-separated rows. Empty rows hidden (a user without
pronouns just doesn't render that segment).

---

##### `PassportCard`

- **Tier:** feature (composes Card + Text + SocialChip)
- **Location:** `src/components/features/user/PassportCard.tsx`
- **Variants:** `default`
- **Sizes:** N/A (consumer)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Profile, My Profile, future user-detail surfaces

**Mock says:** A "passport" panel showing bio (sans body), social chips
(SocialChip array), and a region row (icon + "FROM" label + value).
Optional pronouns row. Missing fields just don't render. Composes Card
+ Text + the SocialChip feature.

**Code does:** None — current Profile screen has inline bio rendering.

**Gap / proposal:** Extract as feature that takes a `Passport` shape
(`{ bio, region, pronouns, socials[] }`) and renders conditionally.

---

##### `SocialChip`

- **Tier:** feature (composes Chip + brand-icon)
- **Location:** `src/components/features/user/SocialChip.tsx`
- **Variants:** `ig` (Instagram), `tt` (TikTok), `sc` (SoundCloud), `x` (Twitter/X — future)
- **Sizes:** md (h:30)
- **States:** default, pressed
- **Used in:** populated in 12.6
- **Tweak impact:** PassportCard, future identity surfaces

**Mock says:** Chip with brand icon + handle. Each kind has its own
brand glyph (Instagram circle-square, TikTok stylized "S", SoundCloud
bars). Tap = opens platform's app or web fallback.

**Code does:** None.

**Gap / proposal:** Feature wrapping the Chip primitive with brand icon
selection. Brand icons live in this feature's adjacent assets dir.

---

##### `AvatarPicker`

- **Tier:** feature (composes Avatar + Button + image-picker logic)
- **Location:** `src/components/features/user/AvatarPicker.tsx`
- **Variants:** `default`
- **Sizes:** md (72px avatar + side buttons)
- **States:** default, picking (camera/gallery sheet visible), uploading
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding wizards (Viewer + Creator), Settings change-avatar flow

**Mock says:** Avatar (lg) on left + a column of two action buttons on
the right ("Take a photo" with camera icon, "Choose from photos" with
gallery icon). Picker invokes `expo-image-picker` and shows uploading
state in-place.

**Code does:** Inline avatar picker in `OnboardingScreen.tsx`.

**Gap / proposal:** Extract as feature. Owns the image-picker integration
and upload-state UI. Emits the resulting URL/file via callback.

---

##### `AccountIDPill`

- **Tier:** feature
- **Location:** `src/components/features/user/AccountIDPill.tsx`
- **Variants:** `default`
- **Sizes:** sm (h:22)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Settings, Change Handle confirm step, Change Handle success screen, future account-detail surfaces

**Mock says:** Small mono-caps pill showing the user's internal account
ID (e.g. "ACCT 0042-887-1156"). Line border, ink-faint background.
Reinforces the identity-model framing that handle is changeable but
account ID is permanent.

**Code does:** None — current code doesn't surface account IDs to users.

**Gap / proposal:** New feature. Accepts a `User` (uses `id` or
generated display-format thereof). Surfaces in Settings + Change Handle
flow per the re-baselined identity model (DESIGN.md decision log
2026-05-29 indirectly via the handle-change mock).

---

#### Onboarding / Wizard

##### `ContextBanner`

- **Tier:** feature (composes Card + Icon + Text)
- **Location:** `src/components/features/onboarding/ContextBanner.tsx`
- **Variants:** `accent` (default, tinted accent), `warn` (warn-tinted, for stakes-raising context)
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** every wizard top — Viewer Onboarding, Creator Onboarding, gated-action flows

**Mock says:** Top-of-wizard banner that acknowledges the user's entry
context. E.g. "SIGN UP TO CHAT IN @KAI.DC'S STREAM" or "BECOME A CREATOR
· 10 STEPS · ~3 MIN". Accent-tinted glass, mono-caps text, optional
leading icon. Warn variant for higher-stakes flows.

**Code does:** None.

**Gap / proposal:** Feature accepting `{ icon, label, tone }`. Sits
above the wizard's Head/Body/CTA scaffolding.

---

##### `AuthChoiceList`

- **Tier:** feature (composes SocialAuthButton + Divider + Text)
- **Location:** `src/components/features/auth/AuthChoiceList.tsx`
- **Variants:** `default` (auto-selects platform order: iOS = Apple → Google → Email; Android = Google → Email)
- **Sizes:** N/A
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer step 1, Onboarding Creator step 1, AuthModal

**Mock says:** Vertical stack of SocialAuthButton items, an "OR" divider
mid-stack, then a "Continue with email" Button. iOS shows Apple first
(HIG); Android shows Google first.

**Code does:** AuthModal currently has email-only sign-up (no social).

**Gap / proposal:** New feature. Auto-detects platform via
`Platform.OS`. Emits a callback with the chosen kind. Backend wiring
for Apple / Google auth is a separate Aaron task; this feature only
handles the UI.

---

##### `SocialAuthButton`

- **Tier:** feature (composes Button primitive)
- **Location:** `src/components/features/auth/SocialAuthButton.tsx`
- **Variants:** `apple` (white-on-black per HIG), `google` (panel surface + brand icon), `email` (panel surface + generic mail icon)
- **Sizes:** md (h:54)
- **States:** default, pressed, loading
- **Used in:** AuthChoiceList only (so far)
- **Tweak impact:** Auth flows

**Mock says:** See the variants. Brand icons baked in. Loading state
replaces label with Spinner (matching icon color).

**Code does:** None.

**Gap / proposal:** Feature. Composes Button primitive with brand icon
fixed by variant.

---

##### `PasswordStrengthMeter`

- **Tier:** feature (composes ProgressBar variant + HelpText)
- **Location:** `src/components/features/auth/PasswordStrengthMeter.tsx`
- **Variants:** `default`
- **Sizes:** md (3 segments, 3px height)
- **States:** weak, ok, strong (driven by password input)
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer / Creator step 2, Settings password change

**Mock says:** 3-segment indicator under the password Input. **Weak**
(live red) = <8 chars or single class. **Ok** (warn yellow) = mid
strength. **Strong** (accent) = 12+ chars + mixed classes. Paired with
HelpText giving tone-matching feedback ("TOO SHORT — 8 CHARACTERS
MINIMUM" / "ADD A NUMBER OR SYMBOL" / "STRONG").

**Code does:** None.

**Gap / proposal:** New feature with `score: 0 | 1 | 2 | 3` prop.
Renders the segment fill + helper text. Score computation is the
consumer's responsibility (or a separate exported util in
`@/lib/passwordStrength.ts`).

---

##### `RulesChecklist`

- **Tier:** feature
- **Location:** `src/components/features/onboarding/RulesChecklist.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Handle picker rule visualization, password rule guidance

**Mock says:** Vertical list of rule rows, each with a small status dot
+ label. **Met** = accent dot with check icon, ink label. **Bad** = live
dot with X icon, live label. **Neutral** (not-yet-evaluated) = empty
line dot, dim label. Compact mono labels in tracked caps.

**Code does:** None.

**Gap / proposal:** New feature accepting `rules: { label, status }[]`
where status is `'met' | 'bad' | 'neutral'`. Used universally for any
multi-rule validation visualization.

---

##### `SuggestionChipRow`

- **Tier:** feature (composes Chip)
- **Location:** `src/components/features/onboarding/SuggestionChipRow.tsx`
- **Variants:** `default` (handle suggestions with @ prefix)
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Handle picker (Onboarding + Change Handle), future tag-suggestion surfaces

**Mock says:** Horizontal-wrapping row of suggestion chips. Each chip
has an accent @ prefix + the suggested handle. Tap = fills the Input
above.

**Code does:** None.

**Gap / proposal:** New feature accepting `suggestions: string[]` +
`onPick`. Used wherever suggestion UI exists.

---

##### `ReassuranceCard`

- **Tier:** feature (composes Card + Icon + Text)
- **Location:** `src/components/features/onboarding/ReassuranceCard.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Handle wizard, Change Handle, Permission flows, any place a small reassuring info card belongs

**Mock says:** Small card with icon-circle on left + body text on right.
Reassuring messaging like "Your handle is changeable. Your account
identity is permanent."

**Code does:** None.

**Gap / proposal:** New feature. Accepts `{ icon, body }` slot. Used
wherever small inline info needs to land.

---

##### `DOBWheel`

- **Tier:** feature
- **Location:** `src/components/features/onboarding/DOBWheel.tsx`
- **Variants:** `default`
- **Sizes:** md (h:178, 3 columns)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding age step (Viewer + Creator wizards)

**Mock says:** iOS-style scroll wheel picker. 3 columns: month / day /
year. Center selection band (line-2 borders top + bottom). Top + bottom
fade gradient. Sans font, tabular-numeric. Selected center value is
bright ink + 600 weight; neighbors are dimmed (opacity 0.55, 0.3).

**Code does:** None.

**Gap / proposal:** New feature. Custom RN implementation (no native
DatePicker — the design wants this specific aesthetic). PanResponder-
driven scroll on each column.

---

##### `PermissionPrePromptCard`

- **Tier:** feature (composes Card + Icon + Text)
- **Location:** `src/components/features/permissions/PermissionPrePromptCard.tsx`
- **Variants:** `location`, `notifications`, `camera`, `microphone` (each provides default icon + default copy)
- **Sizes:** N/A
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Pre-prompt sequences before any OS permission ask

**Mock says:** Card with a large permission illustration (icon-in-frame
with optional ping animation) + plain title + 2–3 bullet reasons in a
list. Sets context before the OS prompt fires. Never manipulative —
copy says what we want and what users get back.

**Code does:** None. Current code calls expo-permissions APIs directly
with no pre-prompt.

**Gap / proposal:** New feature. Variants come with default icon + body
copy that can be overridden via props. The OS prompt fires when the
user taps the primary CTA ("Allow notifications"). Denial = wizard
advances; never re-prompts.

---

##### `LegalAcceptanceCard`

- **Tier:** feature (composes Card + Text + LegalLinkRow + ConsentRow)
- **Location:** `src/components/features/onboarding/LegalAcceptanceCard.tsx`
- **Variants:** `default` (US / ROW), `eu-gdpr` (with Essential/Analytics/Personalization toggles), `ca-ccpa` (with Do Not Sell toggle)
- **Sizes:** N/A
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer step 7, Onboarding Creator final, future legal-acceptance surfaces

**Mock says:** Card containing 3 link-rows (Terms of service / Community
rules / Privacy policy), jurisdiction-detection badge, then jurisdiction-
specific consent toggles, then "Agree & Continue" button. Three full
variants for the three legal contexts.

**Code does:** None.

**Gap / proposal:** New feature. Detects jurisdiction via locale + IP
heuristic at runtime (delegated to a helper). Renders the right variant.
Emits resolved consent settings on submit.

---

##### `ConsentRow`

- **Tier:** feature (composes Text + Toggle)
- **Location:** `src/components/features/onboarding/ConsentRow.tsx`
- **Variants:** `default`, `locked` (Essential, always-on, can't toggle off)
- **Sizes:** md
- **States:** off, on, locked-on
- **Used in:** populated in 12.6
- **Tweak impact:** LegalAcceptanceCard, Settings notification preferences, future consent surfaces

**Mock says:** Row with title (sans body, ink) + description (mono caps,
dim) on the left, Toggle on the right. Locked variant has the Toggle
disabled in the on state.

**Code does:** None as feature.

**Gap / proposal:** Extract as feature. `{ title, description, on,
onToggle, locked }` props.

---

##### `AgeGateCard`

- **Tier:** feature (composes Card + Icon + Text + Button)
- **Location:** `src/components/features/onboarding/AgeGateCard.tsx`
- **Variants:** `default`
- **Sizes:** lg (full-width centered)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding age step refusal (terminal state — no retry)

**Mock says:** Card with clock icon-circle (line-2 border) + heading
("Wrld is 18+") + body explaining the refusal + secondary "Take me
back" button. Centered, respectful tone. **Terminal — no retry, no
"try a different date" link, no joke.**

**Code does:** None — current age gate is just a date input with no
explicit refusal surface.

**Gap / proposal:** New feature. Wraps the design's refusal pattern
verbatim. The terminal-no-retry behavior is structural — the parent
wizard doesn't allow re-entry.

---

##### `LocationGranularityPicker`

- **Tier:** feature (composes Card + GranularityCard sub-components)
- **Location:** `src/components/features/onboarding/LocationGranularityPicker.tsx`
- **Variants:** `default`
- **Sizes:** N/A
- **States:** selected option determines visual
- **Used in:** populated in 12.6
- **Tweak impact:** Creator wizard location step, future privacy-granularity surfaces

**Mock says:** 4 radio cards (Bluedot — exact pin, City — fuzzy circle,
Country — big shape, Private — eye-off). Each card has a map-style
visual preview, title, description, and a radio bullet. Selected card
has accent border + glow + accent radio fill. Bluedot warns
(`data-tone="warn"`).

**Code does:** None.

**Gap / proposal:** New feature. The map-visual sub-components live as
internal helpers (Bluedot pin, City fuzzy circle, Country shape, Private
eye-off). Emits the chosen granularity (`'bluedot' | 'city' | 'country'
| 'private'`).

---

#### Settings / Identity Management

##### `SettingsRow`

- **Tier:** feature (composes Icon + Text)
- **Location:** `src/components/features/settings/SettingsRow.tsx`
- **Variants:** `default`, `highlight` (accent-tinted background for primary identity row)
- **Sizes:** md
- **States:** default, pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Settings, Wallet header (Top Up / Cash Out tiles also share patterns), future config surfaces

**Mock says:** Grid: icon-tile (36×36) + col (title + value + optional
AccountIDPill) + chevron arrow. Border-top separates from previous row.
The **highlight** variant is accent-tinted background for the primary
identity row (Handle).

**Code does:** Settings screen has bespoke row rendering.

**Gap / proposal:** Extract feature. Rows accept `{ icon, title, value,
arrow }` plus optional `highlight` flag. Grouping into cards is the
parent's responsibility.

---

##### `SwapCard`

- **Tier:** feature (composes Card + Text + Icon)
- **Location:** `src/components/features/identity/SwapCard.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Change Handle confirm step, future FROM/TO confirmation surfaces

**Mock says:** Accent-tinted card showing "FROM" with strikethrough old
value + accent arrow + "TO" with new value. Used when confirming a
mutation that swaps one value for another.

**Code does:** None.

**Gap / proposal:** New feature. Accepts `{ fromLabel, fromValue,
toLabel, toValue }`. Strikethrough applied to old value automatically.

---

##### `ToastBanner`

- **Tier:** feature (composes Card + Icon + Text + dismiss)
- **Location:** `src/components/features/feedback/ToastBanner.tsx`
- **Variants:** `accent` (default), `warn`, `err`, `success`
- **Sizes:** md
- **States:** entering, visible, dismissing
- **Used in:** populated in 12.6
- **Tweak impact:** post-action confirmations, viewer-side ephemeral notices, post-tip broadcaster toast (Phase 13)

**Mock says:** Accent-tinted card with icon + body + optional bold
emphasis. Auto-dismiss after 3–5s. Floats above content.

**Code does:** Phase 13 has a broadcaster-side post-tip toast inline in
stream view. Refactor would consolidate.

**Gap / proposal:** New shared feature. Single instance per surface
(queues messages). Used for: post-handle-change confirmation, post-tip
broadcaster toast, post-report submission, etc.

---

#### Monetization

##### `PursesCard`

- **Tier:** feature (composes Card + Text + currency glyphs)
- **Location:** `src/components/features/wallet/PursesCard.tsx`
- **Variants:** `dual` (Space Bucks + Star Dust hero), `single-sb`, `single-sd`
- **Sizes:** md (hero), sm (context strip in Top Up / Cash Out)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 hero, Top Up context strip, Cash Out hero

**Mock says:** Dual-currency hero card showing Space Bucks balance and
Star Dust balance side-by-side. Each side: accent-tinted (SB) or
live-tinted (SD) glow, currency glyph (4-point star for SB, rose-cut
gem for SD), big numeric balance (tabular), bottom row with $ equivalent
+ rate hint.

**Code does:** Current Me screen surfaces Space Bucks balance inline. No
dual-currency UI; no Star Dust yet.

**Gap / proposal:** New feature. Both currencies = $0.01/unit per
re-baseline. The 30% platform fee on transfer is invisible here (handled
in TransactionRow / tip flow). Variant selects 1- or 2-currency
display.

---

##### `TransactionRow`

- **Tier:** feature
- **Location:** `src/components/features/wallet/TransactionRow.tsx`
- **Variants:** `tip-sent`, `tip-received`, `sub-paid` (mock-only v0.2), `sub-earned` (mock-only v0.2), `ppv-paid` (mock-only v0.2), `ppv-earned` (mock-only v0.2), `topup` (stubbed v0.2), `cashout` (stubbed v0.2), `promo`, `refund`, `hold`
- **Sizes:** md
- **States:** default, pending, pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 transaction list, future transaction-detail surfaces

**Mock says:** Grid: thumbnail-tile (40×40, colored by kind + currency
direction) + meta column (title + sub) + amount column (mono, signed,
USD equivalent below). Pending state shows "PENDING" label below
amount.

**Code does:** None.

**Gap / proposal:** New feature. Variant kinds match the v0.2 + v0.3
wallet model (see DESIGN.md decision log 2026-05-29 wallet entry).
Subs + PPV variants ship but emit no real transactions in v0.2.

---

##### `BundleCard`

- **Tier:** feature (composes Card + Pill + Text)
- **Location:** `src/components/features/wallet/BundleCard.tsx`
- **Variants:** `default`, `with-badge` (BEST VALUE / MOST POPULAR / VIP corner badge)
- **Sizes:** md
- **States:** default, selected, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** Top Up bundle picker, future bundle surfaces

**Mock says:** Radio card: pick bullet (22×22, animated fill) + body
(token glyph + qty + per-token meta) + price column (USD price + per-
unit savings %). Selected = accent border + glow. Optional corner badge
(BEST VALUE accent / MOST POPULAR accent-hot / VIP ink).

**Code does:** None — Top Up screen is a Phase 13 placeholder.

**Gap / proposal:** New feature. Variants control the corner badge.
Selected state managed by parent.

---

##### `AmountInput`

- **Tier:** feature (composes Text + Slider + Pill — semantic numeric input)
- **Location:** `src/components/features/wallet/AmountInput.tsx`
- **Variants:** `tip` (uses Space Bucks glyph + accent), `cashout` (uses Star Dust glyph + live)
- **Sizes:** md
- **States:** default, focused, invalid (below min)
- **Used in:** populated in 12.6
- **Tweak impact:** TipSheet, Cash Out screen, future amount-entry surfaces

**Mock says:** Large numeric input (40px, sans 600) with currency glyph
prefix + unit pill suffix. USD equivalent shown below. Fee breakdown for
Cash Out variant (shows net amount after platform fee). Slider beneath
for snap-to-step adjustment. Preset chips (4-up grid) for quick amounts.

**Code does:** TipSheet (Phase 13) has inline amount picker. Cashout has
its own bespoke slider.

**Gap / proposal:** Consolidate into one feature with variants for
purpose. The slider primitive (12.4) handles the bar. Preset chips are
external — passed as a separate prop or rendered alongside.

---

##### `BankCard`

- **Tier:** feature (composes Card + Icon + Text + Button)
- **Location:** `src/components/features/wallet/BankCard.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, pressed (Change button)
- **Used in:** populated in 12.6
- **Tweak impact:** Cash Out payee selection, future linked-account surfaces (stubbed v0.2 per re-baseline)

**Mock says:** Card with bank icon-tile (38×38), meta column (bank name
masked + last 4 digits), and a "Change" link button on the right.

**Code does:** None — Cash Out is mock-only in v0.2 per re-baseline.

**Gap / proposal:** New feature. Component ships v0.2; underlying bank-
linking is v0.3.

---

#### Broadcasting / Live

##### `FeedRow`

- **Tier:** feature (composes Card + Icon-thumb + Text + Toggle)
- **Location:** `src/components/features/broadcast/FeedRow.tsx`
- **Variants:** one per layer (`cam`, `audio`, `screen`, `loc`, `gyro`, `compass`, `profile`)
- **Sizes:** md (h:~80)
- **States:** armed, broadcasting, denied, disabled
- **Used in:** populated in 12.6
- **Tweak impact:** Go Live arming screen

**Mock says:** Row: animated thumb (76×60, layer-specific
visualization — see `FeedThumb` next) + meta (label + detail) + Toggle.
**Armed** state has accent-tinted border + tinted background. **Broadcasting**
state has live-tinted border. **Denied** opacity 0.55 (OS permission
declined).

**Code does:** Current Dashboard has source-arming tiles for camera +
audio (Phase 6). Refactor expands to 7 layers per re-baseline.

**Gap / proposal:** New feature. Variant determines the thumb
visualization (see FeedThumb sub-feature) + default detail copy.

---

##### `FeedThumb`

- **Tier:** feature (sub-component of FeedRow; usable standalone)
- **Location:** `src/components/features/broadcast/FeedThumb.tsx`
- **Variants:** `cam` (viewfinder), `audio` (waveform bars), `screen` (mock device with traffic lights), `loc` (ping on grid), `gyro` (rotating 3D cube), `compass` (rotating rose), `profile` (avatar silhouette)
- **Sizes:** md (76×60), lg (Clip Edit preview hero — uses larger variant)
- **States:** default, paused (when parent is armed=false)
- **Used in:** populated in 12.6
- **Tweak impact:** Go Live FeedRow thumbs, Clip Edit preview fallbacks, future broadcast-layer visualizations

**Mock says:** Per-layer animated mini visualization. Each layer has a
distinct visual treatment that suggests its data shape (waveform for
audio, ping-on-grid for location, rotating cube for gyro, etc.).

**Code does:** None.

**Gap / proposal:** New feature. Variant selects the SVG/Animated
treatment. Pause behavior: when parent component prop `active=false`,
animation freezes.

---

##### `GoBar`

- **Tier:** feature (composes Pressable + Text + Icon)
- **Location:** `src/components/features/broadcast/GoBar.tsx`
- **Variants:** `default` (idle), `armed`, `counting` (countdown), `live`, `disabled`
- **Sizes:** lg (h:64, full-width, r:20)
- **States:** managed by variant
- **Used in:** populated in 12.6
- **Tweak impact:** Go Live docked bottom CTA

**Mock says:** Big docked-bottom CTA with label + knob on the right.
**Armed** = accent-tinted bg + glow. **Counting** = countdown ring
overlay. **Live** = live-tinted bg + live-knob + intense glow. State
transitions are dramatic.

**Code does:** None — Phase 6 Dashboard has a simpler Go Live button.

**Gap / proposal:** New feature. Manages own state via variant prop.

---

##### `ChatMessage`

- **Tier:** feature (composes Text)
- **Location:** `src/components/features/chat/ChatMessage.tsx`
- **Variants:** `user` (default — dim handle), `mod` (accent-hot handle), `host` (live handle), `system` (mono caps, full-mono row)
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Broadcast Live chat list, viewer chat overlay

**Mock says:** Inline message: bold colored handle (role-coded) + plain
body. **System** messages are full mono caps. Text-shadow for legibility
over video.

**Code does:** `ChatOverlay` in features renders chat messages inline.
Refactor splits ChatOverlay into ChatMessage (this) + ChatComposer (next).

**Gap / proposal:** New feature. Accepts `{ role, handle, body }`.

---

##### `ChatComposer`

- **Tier:** feature (composes Input + IconButton)
- **Location:** `src/components/features/chat/ChatComposer.tsx`
- **Variants:** `default`
- **Sizes:** md (h:40 round input + 40×40 send)
- **States:** empty, has-text, sending, disabled (unauthenticated → AuthModal on tap)
- **Used in:** populated in 12.6
- **Tweak impact:** Broadcast Live composer, ChatOverlay refactor

**Mock says:** Round 999-radius Input + circular accent send button. The
input has a placeholder. Send disabled when empty.

**Code does:** `ChatOverlay` inline composer. Refactor.

**Gap / proposal:** Extract as feature.

---

#### Clip Editor

##### `ClipPreview`

- **Tier:** feature (composes Card + VideoPreviewTile + sub-fallbacks)
- **Location:** `src/components/features/clip/ClipPreview.tsx`
- **Variants:** `camera` (default video), `audio-only` (waveform fallback), `map-only` (loc fallback — no cam)
- **Sizes:** lg (16:11 hero)
- **States:** loading, playing, paused
- **Used in:** populated in 12.6
- **Tweak impact:** Clip Edit hero, future clip-detail surfaces

**Mock says:** 16:11 hero preview. Three fallback states based on which
layers were captured: camera (default), audio-only (animated waveform +
"AUDIO ONLY" label), map-only (gridded background + pinging location pin).
Always has playback controls overlaid (play button + progress bar +
scrubber).

**Code does:** None — clips are new per re-baseline.

**Gap / proposal:** New feature. Variant determined by clip's
`layerSet` (which layers were captured). Composes VideoPreviewTile for
camera case; bespoke for fallbacks.

---

##### `Timeline`

- **Tier:** feature
- **Location:** `src/components/features/clip/Timeline.tsx`
- **Variants:** `default`
- **Sizes:** md (h:44)
- **States:** default, scrubbing, trimming
- **Used in:** populated in 12.6
- **Tweak impact:** Clip Edit timeline, future video-editing surfaces

**Mock says:** Track with waveform bars in the background, current
playhead scrubber, optional trim handles defining the "active" region
with accent borders + handles. Trimmed-out regions get a dark overlay
with a hatched pattern.

**Code does:** None.

**Gap / proposal:** New feature. PanResponder-driven scrubber + trim-
handle dragging. State tuple: `{ duration, scrub, trimStart, trimEnd }`.

---

##### `LayerEditorRow`

- **Tier:** feature (composes Icon-tile + Text + Pill + Toggle + IconButton)
- **Location:** `src/components/features/clip/LayerEditorRow.tsx`
- **Variants:** `default`, `id-layer` (special treatment for ID layer toggling)
- **Sizes:** md
- **States:** on, off, deleted (perm-cut)
- **Used in:** populated in 12.6
- **Tweak impact:** Clip Edit layers panel

**Mock says:** Row: icon-tile (34×34, accent-tinted when on) + col (name
+ tone-status pill + dim description) + Toggle + row-menu IconButton.
**Deleted** state has live-tinted icon + strikethrough name + dashed
hide-affordance. Permanent-cut action (live-tone outline button) appears
when the row is selected.

**Code does:** None.

**Gap / proposal:** New feature. Accepts a `Layer` + `onToggle` +
`onDelete`. ID-layer variant treats the toggle differently (anonymizes
the clip retroactively).

---

#### Trust / Safety

##### `ContextStrip`

- **Tier:** feature (composes Card + Avatar + Text + LivePill)
- **Location:** `src/components/features/report/ContextStrip.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Report flow context header, future "what you're reporting" surfaces

**Mock says:** Card surfacing what's being reported: thumb (48×48 of the
broadcast/clip) + meta column (title + sub) + LivePill on the right.

**Code does:** None.

**Gap / proposal:** New feature. Accepts a `ReportTarget` (broadcast |
clip | user). Renders summary.

---

##### `ReasonRow`

- **Tier:** feature
- **Location:** `src/components/features/report/ReasonRow.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, selected, pressed
- **Used in:** populated in 12.6
- **Tweak impact:** Report flow step 1 (reason picker), future reason-picker surfaces

**Mock says:** Selectable row: title (sans, bold) + description (mono
caps, dim) + chevron. Selected = accent-tinted background + accent border
+ accent chevron.

**Code does:** None.

**Gap / proposal:** New feature. Used inside Report's reason list
section.

### Sections (`src/components/sections/`)

Populated from the 12.2 inventory pass. Sections are regional patterns
that repeat across two or more screens. The 12 entries below all meet
that bar. Several patterns that *don't* meet it stay inline in their
single home screen — flagged at the end.

##### `WizardShell`

- **Tier:** section (composes IconButton + ProgressBar + ContextBanner + Text + ctas footer)
- **Location:** `src/components/sections/WizardShell.tsx`
- **Variants:** `default`
- **Sizes:** N/A (full-screen)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Onboarding Viewer (8 steps), Onboarding Creator (10 steps), Onboarding Handle (existing), Change Handle (2-step), future wizards

**Mock says:** Universal wizard chrome. **Top nav** = IconButton (back) +
ProgressBar (centered) + IconButton (close, ghost). Optional
ContextBanner below. **Head** = h2 (display) + p (body). **Body** =
slotted children. **Footer / ctas** = primary CTA + optional skip.
Skip lives directly under the primary CTA — never above it, never in
the header.

**Code does:** OnboardingScreen has bespoke wizard chrome inline.

**Gap / proposal:** Extract as the canonical wizard section. Children
slot is the per-step content. ProgressBar driven by `{ total, current }`.
Footer accepts primary CTA + optional `onSkip`. Used by all 4+ wizards.

---

##### `CategoryChipRow`

- **Tier:** section (composes Chip in a horizontal scroll)
- **Location:** `src/components/sections/CategoryChipRow.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Globe top, search results (future), any horizontally-scrollable single-select filter

**Mock says:** Horizontally-scrollable row of Chip items. Single-select
semantics — only one active at a time. Optional first chip is the
"All" reset.

**v0.2 trim (C3, 2026-05-29):** the Globe Mobile mock's 6 chips
(All / Cities / Weather / Nature / Events / Landmarks) reduce to **2 for
now: All (default, null) + Cities.** Backend `Stream.category` enum
ships with a single value (`cities`); categories grow as v0.3+ adds
value lines. Section keeps its full shape; only the data passed in is
trimmed.

**Code does:** None.

**Gap / proposal:** Generic section accepting `categories: { id, label }[]`
+ `value` + `onChange`. Used by Globe Mobile's category filter; same
shape works for future search-result filter chips.

---

##### `TrendingRail`

- **Tier:** section (composes StreamCard in a horizontal scroll + section header)
- **Location:** `src/components/sections/TrendingRail.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default, loading, empty
- **Used in:** populated in 12.6
- **Tweak impact:** Globe Mobile bottom sheet, future discovery / "for you" surfaces

**Mock says:** Section header ("Trending now" + "See all") + horizontal
scroll of StreamCard items (158×~140). Tapping a card opens its stream.
Empty state = "No streams nearby" message.

**Code does:** None.

**Gap / proposal:** Section accepting `streams: Stream[]` + `title` +
`onTapAll`. Cards rendered via StreamCard (trending variant).

---

##### `StreamStrip`

- **Tier:** section (composes StreamTile in a horizontal scroll + small header)
- **Location:** `src/components/sections/StreamStrip.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Viewer Sheet sensor strip, future per-broadcast layer surfaces

**Mock says:** Header ("STREAMS" + "X OF Y" count) + horizontal scroll
of StreamTile items showing per-layer status (CAM 1080p, AUDIO 48 kHz,
LOC GPS, etc.). Used to display which layers a broadcast is delivering.

**Code does:** None.

**Gap / proposal:** Section accepting `layers: Layer[]` (where `Layer
= { kind, label, value, active }`). Renders header + horizontal
StreamTile row.

---

##### `FilterCard`

- **Tier:** section (composes Card + SegmentedToggle + Chip rows + clear control)
- **Location:** `src/components/sections/FilterCard.tsx`
- **Variants:** `default`, `wallet` (with currency dimension), `profile` (with VIS / LAYERS / DATE rows)
- **Sizes:** md
- **States:** default, has-filters-applied
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 transaction filters, My Profile clip filters, future complex-filter surfaces

**Mock says:** Card containing multiple filter rows. **My Profile**
variant: VIS (segmented ALL/PUBLIC/ANON) + LAYERS (multi-select chip
row) + DATE (single-select chip row) + clear-filters action. **Wallet**
variant: currency + kind + date row. Applied-state shows "X OF Y
results" + Clear link.

**Code does:** None.

**Gap / proposal:** Generic FilterCard accepting filter-row definitions.
Each row type (segmented / chip-multi / chip-single) is a primitive
composition. Variant determines pre-set row structure.

---

##### `DayGroup`

- **Tier:** section (composes Divider + Text + slotted children)
- **Location:** `src/components/sections/DayGroup.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 transaction grouping, future timeline grouping surfaces

**Mock says:** Day header (TODAY / YESTERDAY / APR 22) + summary on
right (e.g. "+ 12.4K SB · - 4.2K SB") + slotted child rows (typically
TransactionRow). Border-top separates from previous day's group.

**Code does:** None.

**Gap / proposal:** Generic section accepting `{ label, summary,
children }`. Used by Wallet v2; same shape would work for chat-by-day,
notifications-by-day, etc.

---

##### `ActionTilesRow`

- **Tier:** section
- **Location:** `src/components/sections/ActionTilesRow.tsx`
- **Variants:** `default` (3-up grid), `4-up`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Wallet v2 quick actions (Top up / Cash out / Send), future shortcut surfaces

**Mock says:** Equal-width grid of action tiles. Each tile = Card +
icon + title + small descriptor. One tile in the grid may be marked
`primary` (accent glow + tinted bg).

**Code does:** None.

**Gap / proposal:** Section accepting `tiles: ActionTile[]`. Tile shape
= `{ icon, title, descriptor, onPress, primary }`. Generic enough to
serve Wallet, Settings shortcuts, or any compact action shelf.

---

##### `PresetGrid`

- **Tier:** section (composes Chip in a 4-up grid)
- **Location:** `src/components/sections/PresetGrid.tsx`
- **Variants:** `default`
- **Sizes:** md (4-up gridded chips)
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Cash Out preset amounts, TipSheet preset amounts, Top Up bundle quick-picks (potentially), future quantity-preset surfaces

**Mock says:** 4-up grid of Chip items showing preset values. Selected
state = accent-tinted (or tone-tinted) chip. Tapping = sets a parent
value (typically the AmountInput sibling).

**Code does:** TipSheet has inline preset chips (Phase 13).

**Gap / proposal:** Extract as generic preset picker. `presets: number[]`
+ `value` + `onChange`. Often paired with an AmountInput feature.

---

##### `ActionSheet`

- **Tier:** section (composes BottomSheet + action rows + Cancel)
- **Location:** `src/components/sections/ActionSheet.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** open, closed
- **Used in:** populated in 12.6
- **Tweak impact:** Profile kebab actions, Wallet v2 menus (potential), Clip Edit row-menus, future contextual-menu surfaces

**Mock says:** Bottom sheet containing a header row (e.g. "@KAI.DC") +
list of action rows (icon + label, optional warn-tone for destructive
actions) + Cancel row at the bottom. Tap outside closes.

**Code does:** Profile has bespoke kebab sheet inline.

**Gap / proposal:** Section composing BottomSheet primitive + a list of
ActionSheetRow features (defined as part of the section's API). Actions
are passed as an array of `{ icon, label, onPress, tone }`.

---

##### `SettingsGroup`

- **Tier:** section (composes Card + SettingsRow rows + section header)
- **Location:** `src/components/sections/SettingsGroup.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Settings screen, Change Handle entry point, future settings-like surfaces

**Mock says:** Section header (mono caps, dim — e.g. "IDENTITY",
"VERIFICATION") + Card containing SettingsRow children with borders
between them. Multiple groups stacked on a screen.

**Code does:** Settings screen has inline group rendering.

**Gap / proposal:** Section accepting `{ title, rows }`. Rows are an
array of SettingsRow descriptors.

---

##### `InfoList`

- **Tier:** section (composes Card + tonal info rows)
- **Location:** `src/components/sections/InfoList.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** Change Handle "what changes" panel, future consequence-disclosure surfaces

**Mock says:** List of tonal info rows (keep / change / hold tones,
each with a tone-colored badge + title + description). Used to disclose
consequences of an action ("What stays with you / What's different /
What's held").

**Code does:** None.

**Gap / proposal:** Section accepting `rows: { tone, icon, title, body }[]`.
Each row tone uses a token-driven color (accent for "keep", warn for
"change", neutral for "hold").

---

##### `LegalLinkList`

- **Tier:** section (composes link rows)
- **Location:** `src/components/sections/LegalLinkList.tsx`
- **Variants:** `default`
- **Sizes:** md
- **States:** default
- **Used in:** populated in 12.6
- **Tweak impact:** All 3 LegalAcceptanceCard variants (US/ROW, EU, CA), future legal-disclosure surfaces

**Mock says:** Vertical list of legal-document link rows: "Terms of
service" / "Community rules" / "Privacy policy" — each as a tappable
row with right chevron. Opens the document in a reader.

**Code does:** None.

**Gap / proposal:** Section accepting `docs: { label, onPress }[]`.
Used by LegalAcceptanceCard variants and any future legal-link surfaces.

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
| `app/onboarding.tsx`                  | `OnboardingScreen.tsx`               | Handle picker, avatar (Phase 8) — refactor to compose WizardShell + steps      | no       |
| `app/(auth)/login.tsx`                | `LoginScreen.tsx`                    | Clerk sign-in                                                                  | no       |
| `app/(auth)/signup.tsx`                | `SignupScreen.tsx`                    | Clerk sign-up + verify                                                          | no       |
| `app/(app)/globe.tsx`                  | `GlobeScreen.tsx`                     | Globe (mounts `EarthScene`) + banners + categories (new) + search bar (new)    | no       |
| `app/(app)/dashboard.tsx`              | `DashboardScreen.tsx`                 | Source arming + Go Live — refactor to 7-layer (per re-baseline) + GoBar        | no       |
| `app/(app)/stream/[id].tsx`            | `StreamScreen.tsx`                    | Broadcaster (id=new) / viewer (id=room) — broadcaster HUD overhauled           | no       |
| `app/(app)/me.tsx`                     | `MeScreen.tsx`                        | Own profile / account settings + clip grid (new) + filters (new)               | no       |
| `app/(app)/profile/[handle].tsx`       | `ProfileScreen.tsx`                   | Public profile + follow + clip grid (new)                                      | no       |
| `app/(app)/search.tsx`                 | `SearchScreen.tsx`                    | User search (may merge into Globe search bar — TBD in 12.6)                    | no       |
| `app/(app)/settings.tsx`               | `SettingsScreen.tsx`                  | Account + notifications — refactor to SettingsGroup pattern                     | no       |
| `app/(app)/wallet.tsx`                 | `WalletScreen.tsx`                    | Wallet v2 — Space Bucks + Star Dust hero + transactions (Phase 13 → updated)   | no       |
| `app/(app)/topup.tsx`                  | `TopUpScreen.tsx`                     | Top Up bundle picker (Phase 13 placeholder; IAP wiring v0.3)                    | no       |
| `app/(app)/cashout.tsx`                | `CashoutScreen.tsx`                   | Cash Out amount + bank + KYC steps (Phase 13 placeholder; payout wiring v0.3) | no       |
| `app/(app)/creator-onboarding.tsx`     | `CreatorOnboardingScreen.tsx`         | Creator wizard (Phase 13) — refactor to 10-step WizardShell + LocationGranularityPicker | no       |
| `app/(app)/broadcaster-onboarding.tsx` | `BroadcasterOnboardingScreen.tsx`     | Redirect shim (legacy) — keep as-is                                            | n/a      |
| `app/(app)/change-handle.tsx`          | `ChangeHandleScreen.tsx`              | **New** — settings flow for handle changes (4 frames; mock + Section 3 features) | no       |
| `app/(app)/onboarding-viewer.tsx`      | `OnboardingViewerScreen.tsx`          | **New** — viewer-path wizard (anon → registered viewer, 8 steps)               | no       |
| `app/(app)/clip-edit.tsx`              | `ClipEditScreen.tsx`                  | **New** — post-stream clip editor (per re-baseline 2026-05-29)                 | no       |
| `app/(app)/report.tsx`                 | `ReportScreen.tsx`                    | **New** — user/stream reporting modal (multi-step)                             | no       |

Existing screens above are migrated in 12.6 (refactored to compose the new
primitives / features / sections). **New** screens are built in 12.6 as
well — they have no existing implementations to refactor.

Migration order recommendation:
1. Start with the most visually opinionated existing screens (GlobeScreen,
   StreamScreen) since they expose the most token coverage.
2. Then settings + identity surfaces (SettingsScreen, MeScreen,
   ProfileScreen, OnboardingScreen).
3. Then monetization (WalletScreen, TopUpScreen, CashoutScreen).
4. New screens (ChangeHandle, OnboardingViewer, ClipEdit, Report) build
   in dependency order — they need primitives + features + sections from
   12.4 / 12.5 in place first.

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
