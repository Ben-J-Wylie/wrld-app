# HANDOFF — Ben, front-end components needed (2026-06-13)

**From:** Aaron (`main` + `wrld-backend` + `wrld-mediasoup`) · **To:** Ben (`primitives`/`features`/`sections` + DESIGN.md)

Aaron's pass through `HANDOFF-aaron-2026-06-13.md` items 1–5 is done — all the **backend +
data wiring** is in (clip-editor manifest edits, chat/telemetry/location now record + play
back, reversible precision, `clips/discover` rewritten). A few pieces are **presentation,
your lane**. Each is a real seam Aaron has already wired the data for — you build the control,
Aaron forwards it (usually one line). Listed by priority.

> Seam reminder (CONTENT.md §10): you own `primitives/`/`features/`/`sections/` + DESIGN.md;
> Aaron owns `screens/`/`hooks/`/`api/`. These are the points where new presentation is needed.

---

## 1. Clip privacy editor — `SaveClipSheet` (Decision A: reversible precision/identity) 🔑

**Why:** location precision + identity (attributed/anon) are now **reversible** display
choices — blur OR sharpen, any time (CONTENT.md §1.4/§7/§8). The backend stores full
fidelity and has **no ≤-ceiling** — a clip can be set to *any* precision/identity, both
directions. There's nowhere in the app to set them on a clip today (only `visibility`).

**Build:** extend **`src/components/features/clip/SaveClipSheet.tsx`** (the sheet that opens
on Save) to surface, alongside the name field:
- a **location-precision control** — `LocationGranularityPicker`
  (`features/onboarding/LocationGranularityPicker.tsx`) already exists; compose it in.
- a **Public / Anon identity segment** (see component #2).

**Emit them via `onSave`.** Today `onSave: (name: string) => void`. Widen to
`onSave: (name: string, privacy?: { locDisplayPrecision?: 'exact'|'city'|'country'|'off'; attributed?: boolean }) => void`.

**Aaron's side is ready:** `ClipEditScreen.saveClip(name, privacy?)` already accepts +
persists `{ locDisplayPrecision, attributed }` via `patchClip` (omitted = leave the clip's
current value, so it never clobbers the go-live default a fresh draft inherits). When your
sheet emits them, the call site becomes a one-liner: `onSave={(n, privacy) => saveClip(n, privacy)}`.

**Vocabulary / mapping:**
- Precision: the backend uses `'exact' | 'city' | 'country' | 'off'`; the picker speaks
  `'bluedot' | 'city' | 'country' | 'private'`. The `precisionToGranularity` /
  `granularityToPrecision` helpers at the top of `SettingsScreen.tsx` already do this map —
  lift/reuse them.
- Identity: `attributed: boolean` — **true = Public, false = Anon** (same concept as the
  dashboard's identity flag / `captureConfig.identity`).

**Editing an already-saved clip:** the same sheet path re-patches a saved clip (the editor
sets `editingSavedId`), so this also covers "change a saved clip's privacy later." If you
want the sheet to **pre-fill** the clip's current precision/identity when re-editing, tell
Aaron — he'll pass the current values in as props (the SavedClip carries `locDisplayPrecision`
+ `attributed`).

---

## 2. Reusable Public / Anon identity segment (small) 

**Why:** #1 needs an identity-edit control and there isn't a reusable one — only
`SourceIdentityCard` (read-only view) and an inline Public/Anon segment buried in a dashboard
`FeedRow`. 

**Build:** a small `features/` segment (or just compose the `SegmentedToggle` primitive)
with **Public / Anon** options driving an `attributed: boolean`. Reuse it in `SaveClipSheet`
(#1) and, ideally, factor the dashboard's inline one onto it so there's one control. Low effort.

---

## 3. `DiscoveryHandoffCard` — `kind: 'clip'` variant (time-machine globe)

**Why:** `clips/discover` is rewritten and now returns **clip pins** (both buffer-promoted
and legacy, honouring the clip's current visibility/precision/identity). The card only has
`kind: 'stream'` (a **Join** button) today.

**Build:** a `kind: 'clip'` variant of `DiscoveryHandoffCard`:
- a **Watch** CTA (vs Join) → navigates to the clip viewer with a `seekSec` (the screen +
  `useHistoricalClips` consumer is Aaron's, pending — see note).
- render an **anonymous host gracefully**: an unattributed clip comes back with
  `host = { handle: 'anonymous', displayName: 'Anonymous', avatarUrl: null }` (no real id) —
  show "Anonymous" with the initials/placeholder avatar, no `@handle` link.

**Timing:** this is gated on Aaron wiring the app clip-pin consumer (`useHistoricalClips` +
the `DiscoveryPin` `kind:'clip'` union + the `/(app)/clips/[id]` viewer) — not built yet. So
it's **"next, when the time-machine clip seam lands,"** not blocking. Flagged now so the card
variant is on your radar and we build the consumer + card together.

---

## Not needing a component (FYI)

- **Sensor visualizers / `SourceStage` / scissor-snip / C6 renderers** — all already yours and
  shipped; Aaron just fed them real data (telemetry relay, `.jsonl` playback). Nothing to do.
- **Live-viewer chat / location source-*views*** — the views exist (`SourceChatLog`,
  `SourceLocationTrail`); wiring them into the live stream rail is Aaron data-wiring, not a
  component.
- **Item 6 (moderation hold)** — the review/takedown UI is v0.3 (admin portal, `wrld-admin`);
  v0.2 is backend retention only. No `wrld-app` component.

---

## Quick reference — the seams Aaron already wired
| # | Your component | Aaron's ready side |
|---|---|---|
| 1 | `SaveClipSheet` precision picker + identity segment + `onSave` emit | `saveClip(name, privacy?)` persists `{locDisplayPrecision, attributed}`; `patchClip` + backend unbounded |
| 2 | Public/Anon `SegmentedToggle` | consumed by #1 |
| 3 | `DiscoveryHandoffCard` `kind:'clip'` (Watch + anon host) | `clips/discover` returns clip pins (anon host placeholder); app consumer pending (Aaron) |
