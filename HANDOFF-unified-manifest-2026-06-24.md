# HANDOFF — the unified manifest model (live = editing) → backend + mediasoup

**Canonical principle: `CONTENT.md` §5** ("The manifest model" → *Clip ≡ segment* · *Snips —
one boundary, planted by hand or by a live edge* · *The dashboard is the live (now-edge)
editor* · *Self-contained clips* · *One source of truth*). Read that first — this doc is the
cross-repo build plan for making it real. Decided with Ben 2026-06-24.

> **Most of this is yours, Aaron** (backend + mediasoup + screens/hooks). The app already has
> the *retrospective* half (the clip editor edits the per-range manifest). What's new is the
> **live** half: the dashboard becomes the now-edge editor, and the server snips on the fly.

---

## The model in one breath

There is **one footage store** and **one per-range manifest**. A **clip ≡ a segment** = a
contiguous range + a self-contained set of per-range directives (lane, sources, identity,
location precision, title, tags, visibility). **Lane (buffer/saved) is just one directive**;
the clips page renders it as two rows as a *visual cue for that one axis*, not two entity types.

Editing = **plant a snip (manifest boundary); the range forward of it carries the new
settings.** Snips come from two trigger families:
- **Manual** — the scissors at the playhead (any instant; already built, app-side).
- **Live, server-authoritative edges** — **now** (incoming), **reaper** (aging out), **storage
  cap** (length bound). These plant the same boundary *on the fly*.

The **dashboard is the now-edge editor**: go live tagged buffer or saved; change *any* per-range
setting → the server snips at **now** and keeps printing forward with the new value. The
**server does all snipping/saving/eviction/clamping** — it's the only place that sees the moving
edges authoritatively. The client sends **edge-relative intent**, never a frozen ms.

---

## Lane split

- **Ben (`design`) — app/UI.** The dashboard's **buffer/saved lane toggle**; sending
  **edge-relative intent** on go-live + on any live setting change; revert the reaper-disable
  guard; make the **live clip saveable (snip-at-now)**; surface the storage-cap warning. The
  clip editor (retrospective per-range editing) already exists.
- **Aaron (`main` + sister repos) — the engine.** Everything below: the go-live lane tag, the
  segmented live manifest (snip-at-now), AV renegotiation, server-authoritative snip-at-edge,
  reaper retain+snip, storage-cap snip+auto-flip, per-snip initial state, the discover title
  coalesce. **DECIDED bits mirror into `wrld-backend/CLAUDE.md` + `wrld-mediasoup/CLAUDE.md`.**

---

## Decided contracts

1. **Go-live lane.** The dashboard sends a starting **lane** (`buffer` | `saved`) at go-live.
   The recorder tags the incoming clip's first range accordingly: `saved` → write under the
   retain/quota accounting from the start; `buffer` → the reapable default. (App: a dashboard
   toggle next to the existing arming.)
2. **Segmented live manifest — snip at now.** While live, **any change to a per-range setting**
   (lane, a source on/off, location granularity, identity, title, tags) → the server **closes
   the current range at `now` and opens a new one** with the updated settings. The broadcast is
   a sequence of settings-eras. Wire: the app emits a "settings changed" signal with the new
   per-range values; the server stamps the boundary at its authoritative `now`.
3. **Per-snip initial state (self-contained clips).** At **every** snip (now OR reaper OR
   manual), each **state-bearing** source re-emits its **current value** as the new range's first
   sample: chat → empty-thread marker, location → current pin, compass/gyro/accel/speed →
   current reading, torch → current on/off. Continuous media (camera/audio) just continues. This
   is the go-live "nothing reads blank" first-state generalized to every boundary. (Recorder.)
4. **AV-live renegotiation (mediasoup).** Toggling **camera/audio** live = add/remove a producer
   mid-room (real renegotiation), then the recorder reflects the change forward. Data sources
   (location/sensors/chat) toggle as pure metadata. **Every source equal, each in its own way.**
5. **Server-authoritative snip-at-edge.** The client sends **edge-relative intent** ("save from
   the live reaper edge forward", "save up to now"), NOT a frozen instant. The server snips at
   **its** authoritative edge at commit time. A sliver evicted during the round-trip may be lost;
   nothing is over-claimed.
6. **Reaper retain + snip (save-the-remainder).** Saving a being-reaped clip retains
   `[currentReaperEdge → end]`. Toggling save↔buffer while reaping plants successive snips →
   **distinct saved clips with evicted gaps between them** (each gap-free internally, each its own
   editable clip). The reaper only ever eats from the left → **no interior gaps**. (Reaper honors
   the per-range `retain`; un-save releases it.)
7. **Storage cap = a snip.** Live-to-saved that hits the cap → snip at the cap, **auto-flip the
   lane to `buffer`**, keep printing there. The server reports the flip so the app can show a
   warning + reflect the dashboard lane. Trying to toggle back to saved with no room → warning.
8. **Location granularity is a per-range live setting** — snips like everything else (display
   precision, reversible per CONTENT.md §1.4).
9. **Visibility is wired but withheld from the dashboard** — live is always public (§3); the
   server treats visibility identically, the app just doesn't expose the live control. Editable
   post-hoc in the clip editor.
10. **Discover title coalesce (small, standalone).** `GET /clips/discover` should
    `COALESCE(directive.title, clip.title, stream.title)` so an edited per-segment title
    proliferates to the time-machine pin (same pattern as reversible location precision). App
    already renders `pin.title`.

---

## Suggested phasing (U-series)

| Phase | What | Repos |
|---|---|---|
| **U1** | Go-live **lane** (buffer/saved) tag + the dashboard toggle. | backend + app |
| **U2** | **Snip-at-now on data/metadata setting changes** (lane, location granularity, identity, title, tags) + **per-snip initial state** for data sources. The segmented live manifest, data-only. | backend + recorder + app |
| **U3** | **Reaper retain+snip** (save-the-remainder, distinct clips, gaps) + **storage-cap snip + auto-flip + warning** + server-authoritative edge-relative intent. | backend + app |
| **U4** | **AV-live renegotiation** (camera/audio toggle mid-room) — its own slice; the gnarliest. | mediasoup + backend + app |
| **U5** | Discover **title coalesce** (can land anytime — independent). | backend |

U1 is the smallest high-value start. U4 is separable and last.

---

## Open questions for Aaron (decide + pin in your CLAUDE.md)

- **Wire shape for "live settings changed."** Reuse the existing arming/`createRoom` channel, or
  a dedicated `settingsUpdate` message? It must carry the new per-range values + let the server
  stamp the boundary at its `now`.
- **Snip-at-now vs coalesce-noise.** Rapid toggles → many tiny ranges. Coalesce adjacent equal
  ranges server-side (the app already coalesces in the editor); define a min-range or debounce.
- **Edge-relative intent encoding.** A sentinel ("from live reaper edge" / "to now") vs a
  client-best-effort ms the server re-clamps. Recommend the sentinel for the live edges.
- **AV renegotiation recording semantics.** When a producer is removed mid-room, the recorder
  closes that source's track at the snip; re-adding opens a new one. Confirm the track/segment
  bookkeeping.
- **Storage-cap accounting during a live save.** Real-time quota check as footage prints to the
  saved lane; where the auto-flip threshold sits (hard cap vs cushion).

---

## App slice detail (Ben — for when each phase lands)

- **U1:** dashboard **lane** SegmentedToggle (BUFFER|SAVED) next to arming; pass on go-live.
- **U2:** the dashboard's per-range controls emit the "settings changed" intent live (the
  dashboard *is* the now-edge editor); the existing `captureConfig` becomes the now-edge slice.
- **U3:** **revert** the reaper-disable guard (drag + sheet stay enabled during reap); the
  lane-change sends edge-relative intent; storage-cap warning UI.
- **U4:** the live source rail toggles drive AV add/remove (already part of the source-parity
  rail); reflect the renegotiation state.
- The clip editor (`SegmentSettingsSheet` + the per-range directives PATCH) already covers the
  retrospective half — no change needed there beyond honoring the new server fields.
