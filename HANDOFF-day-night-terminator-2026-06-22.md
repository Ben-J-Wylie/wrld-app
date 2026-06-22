# HANDOFF — Day/night terminator on the globe (Jira ticket draft)

> Created by Ben, for Ben (2026-06-22). This is the ready-to-file Jira ticket for the
> day/night terminator work, plus everything a fresh Claude instance needs to continue.
> File it in Jira (Project WRLD, Type: Task) — or hand this doc to a new session and say
> "file this in Jira" once the Jira MCP is loaded.

> **✅ FILED 2026-06-22 — [KAN-52](https://aaronwyliework.atlassian.net/browse/KAN-52)**
> (project **KAN** "Aaron and Ben" — there is no `WRLD` project on the site; KAN is the
> team project). Type: Task · Status: To Do · Assignee/Reporter: Ben · Labels: `globe`,
> `mapbox`, `day-night`, `tech-decision`. The full body below was carried over verbatim.
> This doc stays as the working technical context for whoever picks the ticket up; the
> day/night diff remains **uncommitted** in `GlobeScreenMapbox.tsx` pending the decision.

**Title:** Day/night terminator on the globe — land a clean solution (Mapbox fill vs. three.js shell)

**Project:** WRLD · **Type:** Task · **Reporter / Assignee:** Ben · **Labels:** `globe`, `mapbox`, `day-night`, `tech-decision`

---

## Summary

We want a day/night terminator (and shaded night side) on the discovery globe
(`GlobeScreenMapbox.tsx`). A working version exists but has a residual artifact near the
poles, and the cleaner approach forces an architecture decision. This ticket is to either
(a) ship the Mapbox-fill version (as-is or polished), or (b) move the globe to three.js
where the "right" geometry is trivial. **Decision needed before more effort.**

## Current state (UNCOMMITTED, branch `planet`)

All day/night work is **uncommitted in the working tree** of
`src/components/screens/GlobeScreenMapbox.tsx` on branch `planet` (currently == `main` @
`e32e7fb`, plus this uncommitted diff). Nothing day/night is committed yet. To revert:
`git checkout -- src/components/screens/GlobeScreenMapbox.tsx`.

Implemented and working on-device:

- **Terminator line** — `terminatorGeoJSON(date)` builds the great circle 90° from the
  subsolar point as a **parametric ring** (NOT latitude-as-a-function-of-longitude — that
  form is degenerate at equinox/poles), sampled at 0.5°, split at the antimeridian (with a
  ±180 stitch), rendered as a soft `LineLayer` (`TERMINATOR_COLOR = '#3a3a5c'`, width 1.4,
  blur 2, opacity 0.5, round caps). Clipped at `POLE_CLIP = 85`.
- **Night fill** — `nightGeoJSON(date)` shades the night hemisphere: lat-per-lng
  terminator closed around the **winter pole**, edge clamped to ±85°, rendered as a
  translucent `FillLayer` (`NIGHT_COLOR = '#10162e'`, `fillOpacity = 0.15`). Drawn under the
  graticule / line / pins.
- Both driven by `Date.now() - timeOffsetMs`, so they track the live WRLD clock (30s tick)
  **and** the time-machine scrub. Renders on both planets (Earth + Haven).
- `subsolarPoint(date)` — solar declination (obliquity approximation) + UTC-driven subsolar
  longitude (equation-of-time ignored, <4° error).

## The core blocker — why it's not perfect (a known hard limit)

The artifact is **structural to Mapbox's globe**, not our geometry. Mapbox renders Web
Mercator tiles warped onto a sphere; Web Mercator **cannot represent latitudes beyond
±85.0511°** (the projection diverges at the poles), so above that latitude Mapbox fills a
**degenerate "pole cap" fan** of triangles. Any thin line drawn in that cap inherits the
degeneracy → the "semicircle at the cap" artifact. Findings:

- Clipping the line *below* 85.05° (the tile limit) keeps it clean — hence `POLE_CLIP = 85`
  (the smallest clean cap). Going *closer* to the pole makes it **worse**, not better
  (confirmed on-device).
- A **fill** hides this better than a line: the winter pole is always fully dark, so filling
  its degenerate cap reads as uniform shading (no visible glitch). The crisp day/night
  *edge* lives on the summer side, below 85° most of the year. Near equinox the boundary
  hugs the poles briefly but is mostly hidden under the wash.
- We **cannot** move/shrink that 85.05° boundary — it's intrinsic to the Mercator tile
  pyramid, and Mapbox's pole-cap handling is not exposed in `@rnmapbox/maps`.

## The architecture fork (the actual decision)

Ben's preferred mental model is a true **3D hemisphere shell** ("ND filter") oriented at the
sun, tilting with the seasons (its poles float over the Arctic/Antarctic circles at
solstice) — geometrically ideal, zero pole/lat-lng problems. The blocker: **`@rnmapbox/maps`
(native RN) exposes no custom-3D / GL-injection layer.** Mapbox GL JS (web) has
`CustomLayerInterface` (three.js/threebox works there); the RN binding does **not** bridge
it. `ModelLayer` (glTF) won't do it (surface-anchored, not a core-centered planet-scale
shell). So a real shell requires one of:

1. **Composite a three.js / `expo-gl` hemisphere over the MapView**, camera-synced every
   frame. Fragile — Mapbox's globe projection morphs to Mercator ~zoom 6 and its matrices
   aren't exposed; this is the fragility we migrated *away* from.
2. **Replace the Mapbox globe with a pure three.js globe.** Shell becomes trivial/perfect,
   but **loses Mapbox tiles + street-level zoom** and requires rebuilding everything built on
   Mapbox: the **Haven planet switcher** (just shipped), **viewport-tile discovery** (P4,
   just landed), location-precision halos, native clustering, pin hit-testing. Large
   project; reverses the deliberate Mapbox decision in `CLAUDE.md`. (Old `EarthScene`
   three.js exists but predates all of the above.)
3. **Stay on Mapbox** → the draped fill is the only mechanism; accept the minor
   near-equinox pole compromise.

Ben leaned toward "no tiles" (three.js) for the geometry, but the scope (unwinding Haven +
viewport discovery + street zoom) makes it a real project — hence this ticket instead of a
quiet change. **Recommended first step: prototype a standalone three.js globe + day/night
shell on a dev route (leave the live Mapbox globe untouched), evaluate the look, then decide
on migration.**

## Key files

- `src/components/screens/GlobeScreenMapbox.tsx` — all globe + day/night code (helpers near
  the graticule block ~L115–270; render ~L1480; memos `terminatorShape` / `nightShape`).
- `src/canvas/scenes/earth/EarthScene.tsx` — the legacy three.js globe (pre-Mapbox), a
  starting point for option 2.
- `CLAUDE.md` → "Plan — Mapbox globe replacement" + "Second-planet initiative (Haven)" +
  "P4 — globe on the viewport tile-subscription protocol" for the Mapbox-dependent surface
  area that would need rebuilding under option 2.

## Gotchas for a new instance

- `noUncheckedIndexedAccess` is on — avoid `array[i]` on vectors (use scalars / `for...of`).
- `npx tsc --noEmit` trips a harness ENOSPC wrapper bug in this environment; use
  `node_modules/.bin/tsc --noEmit` instead. IDE live diagnostics are a reliable stand-in.
- Tunable dials in the working tree: `POLE_CLIP` (85), `NIGHT_CLAMP` (85), `fillOpacity`
  (0.15), `TERMINATOR_COLOR`, `NIGHT_COLOR`, `GLOBE_MIN_ZOOM` (1.5), `GLOBE_FIT_SCALE` (0.65).
- Pure JS — hot-reloads, no EAS rebuild needed for any of the day/night work.

## Acceptance criteria

- Decision recorded: Mapbox-fill (ship) vs. three.js (migrate / prototype-first).
- If Mapbox: commit the line + fill, tuned; verify equinox scrub on-device on both planets.
- If three.js: a prototype proving the shell, plus a migration plan for the Mapbox-dependent
  features before any swap.
