# `src/canvas/` — Canvas tier

Local index card for the canvas tier of WRLD's design system. The
authoritative spec lives in
[../../DESIGN.md Section 0](../../DESIGN.md#0-system-structure); this file
is the close-at-hand reminder of the rules for code living under this
directory.

## What this tier is

The canvas tier is a sibling of the classical layer (`src/components/`). It
holds the GL experiences that render **outside the React tree**, via
Three.js inside an Expo `GLView`. Today there is one scene — Earth — at
zoom Level 1. The product roadmap names additional GL surfaces (other
planets, in-planet vignettes, street views, deeper 3D UI); each will land
as a sibling scene under `scenes/`. The classical layer and the canvas
layer never compose each other. They share tokens and meet only at the
**seam** (defined below and in DESIGN.md 0.3 / 0.7).

## Tier rules

- **Renders outside the React tree.** Scene code is plain `.ts` modules
  (no JSX). The React mount per scene is the only React-aware file
  (`<Name>Scene.tsx`), and its job is lifecycle + seam wiring.
- **Consumes resolved token values, not tokens-as-style-props.** Scene
  elements load colors / sizes through `stage/tokens.ts`, which returns
  the RGBA / hex / numeric form a `DataTexture` or shader uniform can
  consume. Tokens never travel into shaders as semantic objects.
- **One folder per scene.** All scenes are flat siblings under `scenes/`.
- **Level is metadata, not filesystem.** Each scene exports a
  `LEVEL: number` from its `scene.ts`. Earth is Level 1; a system view
  above it would be Level 0; a venue below would be Level 2. We do not
  group scenes by level in the filesystem.
- **Scene elements are GPU-drawn objects.** Pin, Globe, future HUD
  pieces, future labels. They live under `scenes/<name>/elements/` and
  are tracked in DESIGN.md Section 3 as scene-element entries.
- **No tier composes itself.** Scenes do not import other scenes;
  elements do not import elements from other scenes. Shared code goes
  through `stage/` — under the reuse rule.

## Current inhabitants

- **`scenes/earth/`** — Level 1. The 3D globe with stream pins.
  Extracted in sub-phase 12.1b from `app/(app)/globe.tsx`. Actual files
  today:
  - `EarthScene.tsx` — React mount, GL lifecycle, scene + camera + render
    loop, sphere mesh + texture, pin sprite pool + DataTexture builder,
    geographic clustering, PanResponder, GPS auto-orient, raycaster, and
    the `LEVEL = 1` export. A single file by design: per the reuse rule
    (DESIGN.md 0.5), within-scene splits aren't extracted until a second
    scene proves the shape.
  - `index.ts` — re-exports `EarthScene`, `LEVEL`, `EarthSceneProps`.
  - `assets/textures/earth-8k.jpg` — the 8K Earth texture, colocated.

  Deferred until at least two scenes exist (then extracted on the second
  proven case):
  - `scene.ts` (Three.js root split out of `EarthScene.tsx`)
  - `elements/Globe.ts`, `elements/Pin.ts` — Pin in particular is named
    in DESIGN.md Section 3 with a principle-conflict resolution pending
    in 12.2; the conflict applies to the pin code wherever it lives, so
    the split waits.
  - `environment/lighting.ts` (no lighting today — `MeshBasicMaterial`
    is unlit; would be created only if a scene adds a light)
  - `controls/cameraControls.ts`

- **`stage/`** — minimal today.
  - `tokens.ts` — token-to-RGBA bridge (`hexToRgb`, `resolveColor`).
    Universal from day one because the token-consumption rule applies to
    every scene. No scene currently consumes it; positioned for the
    pin-color resolution in 12.2.

## Anticipated inhabitants

Documented for future R&D coherence. None are pre-built; no empty
placeholder folders.

- **System view (Level 0)** — a scene containing planets at greater
  distance.
- **Other planets** — sibling scenes (`scenes/mars/`, etc.) at Level 1.
- **Place scenes (Level 2)** — venues or regions inside a planet.
- **Street-view scenes** — first-person spatial scenes at the deepest
  zoom.
- **Vignettes** — post-hoc 3D reconstructions of live events (from the
  product roadmap).
- **In-scene 3D UI** — HUDs, in-world labels, spatial controls. Live in
  their scene's `elements/` directory.

## The reuse rule

> Code, assets, and resources start in the scene that needs them. They
> move to `stage/` only when a second real case proves the reuse — not
> before. Empty placeholder folders for anticipated reuse are not
> created.

What this rule has produced today:

- No top-level `canvas/assets/` — Earth's 8K texture lives in
  `scenes/earth/assets/textures/`.
- No `scenes/_base/` shared scene class — extracted from two real scenes
  when both exist, not guessed from one.
- No `canvas/seam/` folder — the one seam component today
  (`DiscoveryHandoffCard`) lives in `src/components/features/`. A
  dedicated folder is created when a second seam component justifies
  it.
- No future-scene placeholders — Mars, vignettes, street views are
  documented above, not pre-built.

## The seam

The seam is the conceptual zone where React UI visually overlays a GL
scene. Today it is realized as one feature component —
`DiscoveryHandoffCard` — the tap-to-preview card that overlays the
globe and bridges discovery mode into watching mode. It lives in the
classical features tier because it is a React component; its role as
the seam is captured in DESIGN.md 0.7. When a second seam component
arrives, we revisit whether `canvas/seam/` earns its own folder.

## See also

- [DESIGN.md Section 0](../../DESIGN.md#0-system-structure) — full
  system structure and dependency rule
- [DESIGN.md Section 3](../../DESIGN.md#3-component-inventory) — scene
  element inventory under `src/canvas/scenes/earth/elements/`
- [DESIGN.md Section 7](../../DESIGN.md#7-phase-12-sub-phase-path) —
  Phase 12 sub-phase path; canvas extraction happens in 12.1
