# Clip Editor (Buffer-Trim model) — Claude Design handoff

**Status:** brief for Claude Design · **Author:** Aaron · **Date:** 2026-06-06
**Surface:** wrld-app (React Native / Expo) — **app-first**; web (wrld-web) is a
later port, design phone-first.
**Deliverable:** portrait HTML mock frames into
[`docs/design/mocks/`](./mocks/) (see *Deliverables* at the bottom) + a proposed
component library, one Section-3 row per new visual element.

This supersedes the trim interaction in the earlier
[`clip-editor-portrait.html`](./mocks/clip-editor-portrait.html) /
[`Clip Edit.html`](./mocks/Clip%20Edit.html) mocks. Those used a single waveform
`Timeline` with two trim handles. This brief introduces a **two-zone editor** — a
full-bleed buffer scrubber on top of a **collapsed-gap, zoomable timeline** with
**drag brackets** — which is the clip-from-rolling-buffer flow. Reuse what carries
over (see *Reuse map*); design the new interactions described here.

---

## 0. Context (why this exists)

WRLD continuously records a **rolling buffer** while a user is live (per tier:
Free 24h / Plus 72h / Pro 7d). A **clip** is a non-destructive manifest cut out of
that buffer — it does not re-encode. This editor is where the user picks the in/out
of a clip out of their buffer, names it, and saves it. Saved clips land in a
library list (screen 2). See the clips-initiative + rolling-buffer sections of
[`CLAUDE.md`](../../CLAUDE.md) for the full model.

Two screens in scope:
1. **Buffer Clip Editor** — scrub the buffer, set the clip in/out on a timeline, name, save.
2. **Saved Clips** — vertical list of saved clips, each a horizontal card (dashboard-style), inline-expand to play.

---

## 1. Non-negotiable design-system constraints

Everything must read as native to the existing app. Pull from
[`src/tokens/theme.ts`](../../src/tokens/theme.ts) — **no hex literals**. The
palette is locked: warm **cream canvas + warm-ink text + single crimson accent**
(an "architectural drawing / engineering document" feel, not a dark video-editor).

**Color (semantic tokens → hex for reference only):**
- Canvas `bg.primary` `#ece6d6` · panels `bg.panel` `#dbcfb6` / `bg.panelHi` `#d3c4a8` · elevated `bg.elevated` `#e5dcc8`
- Text `text.primary` `#1a1612` · `text.muted` `rgba(26,22,18,0.62)` · `text.subtle` `rgba(26,22,18,0.38)` · on-accent `text.inverse` `#ece6d6`
- Borders `border.subtle` `rgba(26,22,18,0.10)` · `border.strong` `rgba(26,22,18,0.20)`
- Accent (the one neon — LIVE, focus, primary CTA, **and** destructive) `accent.default` `#d92e3a` · `accent.bright` `#ff5060` · tint `accent.surface` `rgba(217,46,58,0.08)` · `accent.border` `rgba(217,46,58,0.32)` · glow `accent.glow`
- Warn (rare) `warn` `#c8861e`
- Modal scrim `bg.overlay` `rgba(26,22,18,0.45)`

**Type:** `InterTight` (sans) + `IBMPlexMono` (mono). Scale: display 28/32·500,
heading 20/24·500, body 14/20·400, bodyEmphasized 14/20·500, caption 11/16·400,
monoLabel 10/14·500 (uppercase, +1.6 tracking), monoValue 11/16·500
**`fontVariant: ['tabular-nums']`**.
→ **All timecodes, durations, and timeline axis labels use `monoValue` (tabular)**
so digits don't jitter while scrubbing.

**Spacing (4-grid):** xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48.
**Radius:** `md` 4 (panels/cards/inputs), `full` 9999 (pills, circular buttons).
**Motion (named patterns — compose these, don't invent durations):**
`press` 180ms easeOutQuad · `overlay` 250ms easeOutQuad · `pulse` 1600ms
easeInOutQuad (LIVE / armed). Motion must communicate state, not decorate.

**Tiering / where things live:** tokens → primitives
([`src/components/primitives/`](../../src/components/primitives/)) → features
([`src/components/features/`](../../src/components/features/), clip ones under
`features/clip/`) → sections → screens. No tier composes itself. Every new visual
element gets one row in [`DESIGN.md`](../../DESIGN.md) Section 3 + a gallery entry.

---

## 2. Navigation chrome (match exactly)

- **Header:** shared `ScreenHeader`
  ([`src/components/sections/ScreenHeader.tsx`](../../src/components/sections/ScreenHeader.tsx))
  — left: `BrandMark` (hero, 32px) + "WRLD" wordmark; right: page title (string),
  `minHeight: 32`. **No back button in the header.** Wrap screens in `ScreenScroll`
  (handles safe area + keyboard).
- **Tab bar:** custom 5-item `AppTabBar`
  ([`app/(app)/_layout.tsx`](../../app/(app)/_layout.tsx)): **Globe · Dashboard ·
  [Stream] · Me · Events**. Library + Wallet are off the footer (`href:null`),
  reached from the **Me** screen.
- **Routing for these screens:** the editor and the saved-clips list are off-footer
  routes reached via `router.push` (the same pattern as today's `library.tsx` shim →
  `LibraryScreen`). Tabs between the two pages are the feature's own concern — see
  the navigation note in screen specs below.

---

## 3. Reuse map (build on these — don't reinvent)

| Need | Reuse | Path |
|---|---|---|
| Top buffer video field (paused/preview frame) | `ClipPreview` (camera variant) → composes `VideoPreviewTile` | `features/clip/ClipPreview.tsx`, `features/stream/VideoPreviewTile.tsx` |
| Audio-only / location-only buffer states | `FeedThumb` (`audio`/`loc`, lg) via `ClipPreview` variants | `features/broadcast/FeedThumb.tsx` |
| "How far back the buffer reaches" caption | `BufferWindowLabel` | `features/broadcast/BufferWindowLabel.tsx` |
| Save action verb | `SaveClipButton` (scissors, accent-on-tint) | `features/broadcast/SaveClipButton.tsx` |
| Bottom Sources drawer | `BottomSheet` (the `NearbyStreamsDrawer` pattern) | `features/stream/NearbyStreamsDrawer.tsx`, `primitives/BottomSheet` |
| Per-source active/inactive tiles | `StreamTile` (84×80, active/inactive states) | `features/stream/StreamTile.tsx` |
| Saved-clip card (screen 2) | `ClipCard` (owner variant) — **needs a horizontal/row variant, see §5** | `features/clip/ClipCard.tsx` |
| Name input, buttons, toggles, pills | existing primitives (`Input`, `Button`, `Toggle`, `Pill`, `IconButton`) | `primitives/` |
| Storage usage (used/quota) | from `GET /auth/me` `usedStorageBytes` / `storageQuotaBytes` | — |

**Carries over but changes:** the existing `Timeline`
([`features/clip/Timeline.tsx`](../../src/components/features/clip/Timeline.tsx))
is a single-track waveform trimmer. The new **BufferTimeline** below is a different
component (collapsed gaps, zoom levels, brackets, saved-clip regions). Treat
`Timeline` as the conceptual ancestor; the new one is its own feature.

---

## 4. Screen 1 — Buffer Clip Editor

Portrait, top-to-bottom. Header (`ScreenHeader title="Edit clip"`), then:

### 4a. Buffer video field (hero, full-bleed)
- **Portrait, near-full-bleed** video frame — the dominant element of the upper screen.
- Shows a **live-updating frame**: as the user swipes left/right anywhere on this
  field, the frame re-renders to the moment under the playhead (scrubbing). Smooth,
  low-friction, the primary interaction of the page.
- Camera buffer → composed via `ClipPreview` camera (`VideoPreviewTile`).
  Audio-only buffer → `ClipPreview` audio variant; location-only → map/loc variant.
- A small **current-time / position readout** in `monoValue` (e.g. the absolute
  capture timestamp at the playhead, tabular).
- Optional: `BufferWindowLabel`-style hint of how far back the buffer reaches.

### 4b. Buffer timeline (full width, directly below the field) — **the new core component: `BufferTimeline`**
A horizontal, full-bleed timeline representing the buffer with **time gaps
collapsed**. This is where the clip in/out is defined.

- **Collapsed gaps:** every real-time gap between recorded segments is reduced to a
  **fixed 50px space** with a **labeled gap marker** — a small divider showing the
  skipped duration (e.g. a "⋮ 3h" pill / break glyph). The user must be able to tell
  time was collapsed. Segments themselves scale with zoom; gaps stay 50px.
- **Default (fully zoomed out):** spans from the **end of the buffer** (oldest) to
  **now** (newest), entire buffer visible left→right.
- **Zoom:** **pinch (continuous)** + **level buttons** (segmented control:
  All / Hours / Minutes / Seconds). Axis labels relabel as zoom changes (days →
  hours → min → sec), `monoValue` tabular.
- **Playhead + centering behavior (important):**
  - The playhead is **shared** with the buffer field — swiping the field moves the
    timeline playhead and vice-versa; one current-time drives both.
  - When the timeline is **zoomed wider than the screen**, the playhead stays
    **centered** and the timeline content scrolls under it.
  - When **either end of the timeline reaches its screen edge**, the playhead is
    released and travels **off-center** toward that edge (you can't scroll past the
    ends).
  - When zoom **fits the whole timeline** on screen, the playhead moves **freely**
    left/right toward either edge.
- **Saved-clip regions:** spans of the buffer already saved as clips show as a
  **colored marker/band** (read-only) on the timeline. **New clips may not overlap
  these.** If a clip is deleted (from screen 2), its marker disappears, freeing that
  span for reuse. Make "this region is taken" legible (tint + hatch/label), and make
  it clear the brackets won't enter it.

### 4c. Clip trim brackets — **new component: `ClipBracket` (the in/out selection on `BufferTimeline`)**
- **Create:** a **"New clip" button** drops a **default-width bracket centered on the
  playhead**; the user then refines.
- **Edges:** drag the **left bracket = in-point**, **right bracket = out-point**.
  Easy, large, finger-friendly touch targets. Show the selected **duration** and
  in/out timecodes (`monoValue`, tabular) live as you drag.
- **Move whole selection:** press-and-drag in the **center of the bracket** moves the
  entire in/out structure left/right **without changing duration**.
- **Zoom coupling:** when the user zooms the timeline while brackets are active, the
  brackets **stretch/contract with the timeline** — they stay pinned to their
  in/out times, not to pixels. This should feel intuitive and continuous during pinch.
- **No-overlap constraint:** brackets cannot cross into a saved-clip region — they
  clamp at the boundary (with a subtle resist/blocked affordance). Only one active
  pending bracket at a time (saved clips coexist as read-only regions).

### 4d. Sources drawer — **bottom drawer of recorded sources (`StreamTile`s)**
A drawer that **pops up from the bottom of this page, exactly like the globe page's
bottom drawer** (`NearbyStreamsDrawer`, a `BottomSheet` — slide-up spring entry,
swipe-down dismiss). It is opened by a control on the editor (propose the trigger —
e.g. a "Sources" button near the timeline) and is the place the user picks which
recorded layers the clip keeps.

- **Populated with `StreamTile`s** ([`features/stream/StreamTile.tsx`](../../src/components/features/stream/StreamTile.tsx),
  DESIGN.md §3) — one tile per **source that was recorded** in this buffer span
  (CAM 1080p, AUDIO 48 kHz, LOC/GPS, COMPASS 192°, GYRO, etc.). Tiles are a
  horizontal-scroll / wrapped grid of the 84×80 tiles.
- The user **taps a tile to make that source active or inactive** for the clip —
  reuse `StreamTile`'s existing **active** (2px accent border, accent-tinted icon,
  primary text) vs **inactive** (1px subtle border, muted icon/text, opacity 0.45)
  states. No new toggle UI needed.
- The user can **close the drawer** (swipe-down / dismiss) and return to scrubbing;
  the active/inactive choices persist into the saved clip.
- This is how per-source layer selection is handled in this editor (it replaces the
  inline LayerPanel from the older `Clip Edit` flow). **Delete-permanently is NOT in
  this drawer** — it's reversible active/inactive only; permanent track deletion (if
  any) stays out of scope here.

### 4e. Name + save (below the timeline)
- A **clip name `Input`** (label/placeholder e.g. "Name this clip").
- A **Save button** below it — use `SaveClipButton` (scissors, accent-on-tint), or a
  primary `Button` if the name field is the commitment point. Disabled until a valid,
  non-overlapping selection + (optionally) a name exists.
- **Saving creates a private draft** (see §7) — the clip is added to the Library list
  (screen 2) as a draft and its span becomes a saved-clip region on the timeline.

> **Design the states:** empty (no bracket yet, "New clip" prompt) · active bracket
> being dragged (edge + center) · bracket clamped against a saved region · zoomed-in
> seconds view · audio-only buffer · near-empty/short buffer · **sources drawer open**
> (some tiles active, some inactive).

---

## 5. Screen 2 — Saved Clips (the **Library**)

This is the **Library** (decided — a standalone Library surface, not profile-as-library).
- **Vertical scrolling list** of saved clips; each entry is a **horizontal row card**
  styled like the existing dashboard rows (think `FeedRow` proportions, `ClipCard`
  content).
- **Each card contains:** poster **thumbnail** · clip **name** · **duration** ·
  **capture timestamp** · **quick actions** (play, share/download, delete; rename if
  it fits). Durations/timecodes in `monoValue` tabular. Owner-only treatments from
  `ClipCard` carry over — **new clips arrive as private drafts, so the DRAFT pill is
  the default state**, with a publish affordance (anon "only visible to you" if relevant).
- **Tap → inline expand:** the card **expands in place** to play the clip without
  leaving the list (do not navigate to a full-screen player). Design collapsed and
  expanded states; expanded shows the player (reuse `ClipPreview`/`VideoPreviewTile`
  play variant) + the actions.
- **Delete** removes the clip and (on screen 1) frees its buffer region.
- **Navigation between the two screens:** saving on screen 1 should land the user on
  this list (auto-advance), with an easy way back to the editor. Propose the
  switch mechanism (paged swipe with indicator, or a two-segment control) — keep it
  consistent with the app; this list lives off-footer (reached from Me / after save),
  not as a new bottom tab.

> **Design the states:** populated list · empty ("No clips yet") · one row expanded
> playing · a draft/anon clip · a long list (scroll).

---

## 6. New component library to propose (Section-3 candidates)

Name, place in the tier, and spec states for each. At minimum:

1. **`BufferTimeline`** (feature, `features/clip/`) — collapsed-gap zoomable timeline;
   props: buffer segments, saved-clip regions, playhead time, zoom level, onScrub,
   onZoom. States: zoom levels (all/hr/min/sec), centered vs edge-released playhead.
2. **`GapMarker`** (primitive or feature) — the 50px collapsed-gap divider with
   skipped-duration label / break glyph.
3. **`ClipBracket`** (feature) — the in/out selection overlay: left/right edge handles
   + center move zone + live duration/timecode readout; clamped/blocked state.
4. **`SavedClipRegion`** (feature, or a `BufferTimeline` sub-part) — read-only colored
   band marking a taken span.
5. **`TimelineZoomControl`** (primitive) — segmented All/Hours/Minutes/Seconds (+ pinch
   is gesture, not a control).
6. **`BufferScrubField`** (feature) — the full-bleed swipe-to-scrub buffer field
   wrapping `ClipPreview`, owning the shared playhead gesture.
7. **`SavedClipRow`** (feature) — horizontal saved-clip card with thumbnail + meta +
   actions; collapsed/expanded (inline player) states. (Either a new component or a
   `row` + `expanded` variant added to `ClipCard` — propose which.)
8. **`ClipSourcesDrawer`** (feature) — the bottom drawer of recorded sources. Compose
   the existing `BottomSheet` (the `NearbyStreamsDrawer` pattern) + a grid of
   `StreamTile`s; toggles each source active/inactive. Likely no new primitive — it's
   an assembly of two existing ones; propose as a thin feature.
9. **`ClipEditScreen`** assembly + **`LibraryScreen`** (or extend the existing
   `LibraryScreen`) assembly (screens tier).

Reuse `ClipPreview`, `VideoPreviewTile`, `FeedThumb`, `StreamTile`, `BottomSheet`,
`BufferWindowLabel`, `SaveClipButton`, `Input`, `Button`, `Toggle`, `Pill`,
`IconButton`, `Divider`.

---

## 7. Resolved decisions

- **Library, not profile.** The saved-clips list (screen 2) is a standalone **Library**
  surface — reached off-footer (from Me / after save), not profile-as-library.
- **Per-source layers = the bottom Sources drawer (§4d).** No inline LayerPanel on this
  editor and no per-layer controls inside the screen-2 card. Source selection is
  active/inactive only, via `StreamTile`s in the drawer; permanent track deletion is
  out of scope here.
- **Save = private draft.** Saving always creates a **private draft** (DRAFT pill is the
  default in the Library). Publishing is a later/separate action — show the publish
  affordance but design the default state as draft.

---

## 8. Deliverables

1. **Mock frames** → [`docs/design/mocks/`](./mocks/), portrait, named per the folder
   convention ([`mocks/README.md`](./mocks/README.md)):
   `clip-editor-buffer-trim-portrait.html`, `saved-clips-list-portrait.html`, plus
   state variants as separate frames or option files (e.g.
   `clip-editor-buffer-trim — zoomed-seconds.html`,
   `saved-clips-list — row-expanded.html`).
2. **Component proposal** — the §6 list with names, tier placement, props, and states,
   ready to become Section-3 rows in [`DESIGN.md`](../../DESIGN.md).
3. **Interaction notes** — short captions on the bracket drag (edge vs center),
   zoom-coupling, playhead centering/edge-release, and the no-overlap clamp, since
   these are motion/gesture behaviors a static frame can't fully show.

Aesthetic references live in [`docs/design/references/`](./references/) (architectural
/ brutalist sets) — same vibe as the rest of the app.
