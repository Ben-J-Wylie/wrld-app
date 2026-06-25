# HANDOFF — the unified manifest model (live = editing) → backend + mediasoup

**Canonical principle: `CONTENT.md` §5** ("The manifest model" → *Clip ≡ segment* · *Snips —
one boundary, planted by hand or by a live edge* · *The dashboard is the live (now-edge)
editor* · *Self-contained clips* · *One source of truth*). Read that first — this doc is the
cross-repo build plan for making it real. Decided with Ben 2026-06-24.

> **Most of this is yours, Aaron** (backend + mediasoup + screens/hooks). The app already has
> the *retrospective* half (the clip editor edits the per-range manifest). What's new is the
> **live** half: the dashboard becomes the now-edge editor, and the server snips on the fly.

---

## ⚠️ On-device findings 2026-06-25 (Ben tested U1–U3 → two BACKEND items for Aaron)

The U1–U3 app slices are wired + the app-side bugs are fixed; two issues are backend/config:

- **(2a) forward-only snip — CONFIRMED correct, no action.** A live setting change snips at the
  server's `now` and applies **forward only**; already-printed footage keeps the permissions it had
  when printed. (The app sends only the new settings, no ms.) Retrospectively editing a *past* clip
  via the settings sheet intentionally changes that range — a separate path.
- **(2b) edits not proliferating to the time-machine rewatch globe.**
  - **App half — FIXED (`cf5111e`).** The edit sites invalidated `['historical-availability']` but
    the rewatch pins come from `['historical-clips']` / `['avail-cell']`; held-instant views never
    refetched. Both sites now invalidate all three feeds. **Title now proliferates** (U5).
  - **BACKEND half — STILL OPEN (contract #13).** Per-range **location precision + identity** don't
    show on **buffer-session pins** (which are *all* current globe content — `clips` is empty). The
    `bufferPins` discover path reads **session-level** `s.locationPrecision` + is **always
    attributed**; only per-range *title* (U5) + *private* are honored. Extend the directive-at-instant
    resolution (already there for title) to precision + attributed on the buffer-pin path — see #13.
- **(2c) the systemic fix for (2b) — coalesce the directive in the LIBRARY + VIEWER too.** App side
  now dual-writes a saved-clip rename (directive + `patchClip` on `c.*`) so it reaches everywhere,
  but that's a workaround for the Clip row + the directive being separate reads. The clean fix:
  `GET /buffer/me/clips` (`name`) and `GET /clips/:id` should **coalesce the per-segment directive
  title / precision / identity at the instant** — exactly what `discover` does (U5 + #13). With that,
  the app can drop the `patchClip` dual-write and the directive is the single authority everywhere.
- **(3) save (incl. save-while-reaping) doesn't persist into the Library — BACKEND/CONFIG.** The app
  saves correctly (`POST /buffer/me/clips` with `fromReaperEdge`/`toNow`) + refetches `['buffer','clips']`;
  the clip just never becomes listable. `GET /buffer/me/clips` returns **`status:'ready'` only**, and
  a save creates `status:'processing'` that flips to `'ready'` **synchronously only when
  `PB2_RETAIN_IN_PLACE` is ON** (the decided one-store model). With the flag **OFF (default)** the
  legacy async **copy path** (`promoteBufferClip`) runs and the clip stays `processing` until the copy
  job completes — if it lags/fails, the clip never lists (matches the symptom: the optimistic pending
  shows in the saved lane, but the durable clip never appears). **Action:** turn on
  `PB2_RETAIN_IN_PLACE` (the decided retain-in-place model) **or** fix the copy-path promote job.

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
11. **Permanent delete — two missing endpoints (drawer UI is built + wired).** The clip drawer
    (`SegmentSettingsSheet`) now has a **Delete clip** button + **per-source delete** trash icons
    (built 2026-06-24, behind `onDelete`/`onDeleteSource`). Wired today: **saved-clip delete** via
    the existing `bufferApi.deleteSavedClip`. Still need:
    - **Permanent-delete of a BUFFERED clip** — drop the footage now + reclaim, *as if evicted*; a
      copy survives only via the reporting path (CONTENT.md §3). (Today buffered footage only goes
      via the reaper; the app shows a "coming soon" notice.)
    - **Per-source track delete** — remove ONE captured source's track from a clip + reclaim (the
      only destructive per-source edit, distinct from the reversible on/off visibility toggle). No
      endpoint yet; the app shows "coming soon".
12. **Expose `visibility` + `tags` on the saved-clip read (profile-drawer parity).** The profile /
    Me-tab saved-clip feed now opens the settings drawer **in place** (built 2026-06-24,
    `SavedClipSettingsSheet`) and writes via `bufferApi.patchClip`. It edits title / location
    precision / identity / per-source on/off cleanly, but **hides Visibility + Tags** because the
    `GET /buffer/me/clips` payload (`SavedClip`) doesn't return them (the backend `Clip` row has
    both; the list serializer just omits them). To unhide on the profile: add `visibility` + `tags`
    to the saved-clips list response (+ the app `SavedClip` type). Note the **vocab gap** too —
    `patchClip`'s `visibility` enum is `public|anon|draft` (pre-PB4); the drawer's axis is
    `private|public`. Reconcile when wiring (likely: map the per-range `private|public` over the
    clip-level field, or move saved-clip visibility onto the per-range directive PATCH).
13. **Buffer-pin discover honours per-range precision + identity at the instant (C4.5 completeness).**
    Audited on the deployed box 2026-06-25. `GET /clips/discover` resolves per-range correctly for
    **saved-clip pins** (the `clips` path): title (U5 `titleAt`), precision (`COALESCE(c.locDisplayPrecision,
    s.locationPrecision)`), identity (`attributed ? host : anonymous`). But **buffer-session pins**
    (the `bufferPins` path — *all current globe content*, since `clips` is empty) only honour
    **title** (U5 `titleAt(sessionTitled,…)`) + the **private-range exclusion**. Precision is still
    session-level (`COALESCE(s.locationPrecision,'exact')`) and the host is **always attributed**
    (no anon). So a per-range **blur/sharpen** or **anon** edit on a live buffer session does NOT
    show on its time-machine pin — only a per-range **title** or **private** edit does. **Fix
    (same pattern already there for title/private):** resolve the DirectiveRange covering instant T
    for the buffer pin and use its **precision** + **attributed** (fall back to session) — extend
    `fetchTitledDirectives`/`titleAt` to a `fetchDirectivesAt` returning precision/attributed too,
    and apply in the `bufferPins` map (anon → `host: anonymous`, like the clips path). This is why
    Ben sees stale precision/identity on past pins; **title is fixed (U5), precision+identity on
    buffer pins are not.**

> **✅ #13 DONE + DEPLOYED (Aaron, 2026-06-25, `wrld-backend` `5f1d5d2`).** Buffer-pin discover
> now resolves the per-range directive covering the pin's instant for the **full** settings —
> `directiveAt` + `DirAt` (title/precision/attributed) generalises U5's `titleAt`. Applied on
> all three feeds (windowed + tiled + `?at=`): per-range **precision** re-obfuscates the
> display coords (a per-range `'off'` hides the pin = the location-axis private), and
> **`attributed:false`** → anonymous host — falling back to the session level when no directive
> covers the instant. So a per-range blur/sharpen or anon edit now shows on the time-machine
> pin. On-device verify: blur/anon a live segment → its past pin reflects it. *(The clips path
> already resolved clip-level precision/identity; left as-is.)*
>
> **Finding (3) — flag is already ON:** `PB2_RETAIN_IN_PLACE`, `PB3_PER_RANGE`,
> `PUBLIC_BUFFER_ENABLED`, `AVAILABILITY_FEED` are all **`true`** in prod (verified 2026-06-25).
> So the "flag OFF → copy path → save never lists" diagnosis doesn't apply — retain-in-place is
> active and a save should flip to `ready` synchronously. If a save still doesn't list, it's a
> different bug (investigate the retain-in-place save path / `GET /buffer/me/clips` filter), not
> the flag.
>
> **Still open for me (noted, not in this commit):** #12 (expose `visibility`+`tags` on the
> saved-clip read) · (2c) (coalesce per-range title/precision/identity on `GET /buffer/me/clips`
> + `GET /clips/:id` so the app drops the dual-write) · #11 (permanent-delete endpoints:
> buffered-clip + per-source track).

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

> **✅ U4 MEDIASOUP DONE + DEPLOYED (Aaron, 2026-06-25, `wrld-mediasoup` `8857e07`) —
> pause/resume model.** Decided with Ben: AV behaves like every other source — **one track
> with a gap where it's off**, not a new track per toggle. So the AV toggle is
> `producer.pause()/resume()` (the recorder's consumer + viewers' consumers go quiet → a gap
> in the same track), NOT close/re-attach. No recorder refactor, no new codec group, no
> backend change.
> - **Wire:** `setSourcePaused { kind: 'camera'|'audio'|'screen', paused: boolean }` (WS,
>   broadcaster-only). The server pauses/resumes the producer; on resume it requests a
>   keyframe (recorder + viewers get a fresh IDR after the gap); it notifies viewers
>   **`producerPaused`** / **`producerResumed`** (so the app shows camera-off + re-renders on
>   resume). Additive + inert until the app sends it.
> - **Manifest half is U2:** mark the off range with a `sources:{kind:false}` snip
>   (`POST …/snip`) so the clip editor + replay honour it; the footage genuinely has the gap.
> - **⚠️ ON-DEVICE GATE (mediasoup is unverifiable headlessly):** confirm FFmpeg survives the
>   paused RTP gap — go live, pause camera ~30s, resume → recording continues as ONE track
>   with a gap, the session does NOT stop. (UDP input, no read timeout → should block + resume;
>   if it dies on the gap, the fallback is close/re-attach.)
>
> **App slice for U4 (Ben):** the live source-rail camera/audio toggle sends `setSourcePaused`
> (+ the U2 `sources:{kind:false}` snip), and the producer-side `produce`/`closeProducer` for
> the WebRTC track is handled by the source-rail/`useMediasoup` path; viewers handle
> `producerPaused`/`producerResumed` (show camera-off, re-render). Note: turning ON a source
> that was NEVER produced this session is a first `produce` (not pause/resume) — viewers see
> it via `newProducer`, but the recorder attaching a brand-new chain mid-session is the
> close/re-attach case, still out of scope (arm AV at go-live for the common path).

> **✅ U3 CORE DONE + DEPLOYED (Aaron, 2026-06-25, `wrld-backend` `d643bcc`).** Edge-relative
> save + server clamp + the storage-cap gate — backend-only; remaining U3 is **app** (Ben).
> - **Edge-relative save (`POST /buffer/me/clips`):** new body flags **`fromReaperEdge`** /
>   **`toNow`** → the server uses ITS live edges (`earliestAt` / `now`) instead of a stale
>   client ms. Numeric `startAtMs`/`endAtMs` are ALSO clamped to `[earliestAt, now]`, so a
>   save never over-claims evicted or future footage — **"save the remainder."** (Send a
>   numeric best-effort + the flag for the live edge; the server re-clamps. Decided over
>   strict sentinels per the handoff's robustness note.)
> - **Distinct-clips-with-gaps falls out of the primitive:** the lane toggle while reaping =
>   **successive edge-relative saves** over the saved spans; the buffer gaps between reap. No
>   new "lane toggle" endpoint — the app fires a save per saved span (`fromReaperEdge`/`toNow`
>   for the live ones). The reaper only eats from the left → no interior gaps.
> - **Storage cap:** the save returns **`409 { error: 'storage_cap', usedBytes, quotaBytes,
>   neededBytes }`** when `used + thisSave > quota`. **App:** catch it → show the warning +
>   **flip the dashboard lane back to buffer** (the broadcast keeps printing to buffer).
> - **Deferred (noted):** partial snip-AT-cap *during a live saved-lane print* + the U1
>   saved-lane real-time quota (needs a bytes↔time estimate) — for now the cap is
>   all-or-nothing per save + app-flips-to-buffer. **U4** is AV-live renegotiation.
>
> **App slice for U3 (Ben) — ✅ DONE 2026-06-25 (`fc265b2`, on `design`).** `bufferApi.saveClip`
> gains `fromReaperEdge`/`toNow`; `ClipsScreen.saveClip` computes them (start ≤ reaper edge →
> `fromReaperEdge`; live session block → `toNow`) — the save↔buffer toggle while reaping is just
> successive edge-relative saves (one per span, falls out). `409 storage_cap` → warn with the quota,
> and on the LIVE span (`toNow`) flip the dashboard go-live lane back to buffer (via captureConfig);
> a retrospective save just shows the out-of-storage notice. Reverted the reaper-disable guard — the
> sheet's Lane toggle stays enabled during reap (saving a being-reaped clip is valid via
> `fromReaperEdge`). **On-device verify owed:** save while reaping retains the remainder; toggling
> save↔buffer mid-reap yields distinct clips with gaps; hitting the cap flips to buffer with a warning.

> **✅ U2 BACKEND DONE + DEPLOYED (Aaron, 2026-06-25, `wrld-backend` `11333c3`).** The
> segmented live manifest (data/metadata) — backend-only; remaining U2 is **app** (Ben).
> - **Wire (decided):** **`POST /buffer/me/sessions/:id/snip { settings }`** (owner +
>   `PB3_PER_RANGE` gated, **live-only** — 409 once ended). The directive is backend-owned,
>   so the snip is plain HTTP (no mediasoup hop). **Send only the new settings — no `ms`;**
>   the server stamps its authoritative `now`. `settings` = the full per-range values
>   `{ visibility?, precision?, attributed?, sources?, title?, tags? }` (missing axis →
>   default). On each snip the server closes the current OPEN era at now and opens a new one.
> - **`lane` is NOT in the snip** — per-range lane + its retain+snip mechanics are **U3**;
>   AV (camera/audio) toggles are **U4**. So U2 = the data/metadata axes only.
> - **Per-snip initial state:** the **chat marker** (the one source the app can't seed) is
>   written server-side at the snip. **Client-sourced (location/sensors/torch) is yours:**
>   on a snip, re-emit each armed source's current value via the existing live channels
>   (`locationUpdate`/`telemetry`) — exactly your go-live baselines, fired again at the snip —
>   so a clip cut at the new era has initial state.
> - **Open-era detail for the app:** a live era is a directive with `endAtMs` = a max-date
>   sentinel (`8_640_000_000_000_000`). `GET /buffer/me` `directives[]` will show it; treat
>   that end as "open / to the live edge." It's clamped to the session end on stop.
> - **⚠️ Coalesce / debounce (decided open question — important):** snip-at-now fires on *any*
>   setting change, so rapid toggles spawn tiny eras → manifest + availability-feed bloat +
>   pin density (Time-Machine compat #1). **Debounce trivial changes app-side** and avoid a
>   snip when the new settings equal the current era's. (Server-side coalesce-on-equal is a
>   possible follow-up; for now the app should not fire no-op snips.)
>
> **App slice for U2 (Ben) — ✅ DONE 2026-06-25 (`24323e9`, on `design`).** `bufferApi.snipSession`
> + a `broadcastStore` snip channel (dashboard → mounted StreamScreen, reusing the command pattern)
> + `useTelemetryCapture.reemit()` (the go-live baseline, re-fired per snip). StreamScreen snips the
> OPEN buffer session (id via `useBuffer`) then re-emits; the dashboard requests a debounced (600ms)
> snip on **location-precision / identity / title** changes while live (skips the first-live baseline
> + no-ops). **Scoped to the cleanly-mapping metadata axes** — `sources` omitted (partial-map risk;
> chat + AV source toggles fold into U4), `visibility` = server default public, no tags control.
> **On-device verify owed:** change precision/identity/title mid-broadcast → the time machine shows
> distinct eras with the right settings; confirm the open-session id resolves (snip dropped silently
> in the ~secs before the backend creates the session).

> **✅ U5 DONE + DEPLOYED (Aaron, 2026-06-25, `wrld-backend` `0eadbc1`).** `GET /clips/discover`
> now coalesces the **per-segment directive title alive at the instant** over the clip/stream
> title, so an edited per-segment title shows on the time-machine pin. Resolved in the active
> windowed + tiled feed (at the pin's first visible interval start) AND the `?at=` fallback (at
> T): `directive.title (covering the instant) → existing clip/stream title`. No titled directive
> → unchanged. **App already renders `pin.title`** — no app change needed. (A pin spanning
> multiple titled segments shows the first segment's title; the finer per-range *pin split* is
> the larger Time-Machine reconciliation, not U5.) On-device verify owed: edit a segment title
> in the clip editor → its globe pin shows the new title.

> **✅ U1 BACKEND + MEDIASOUP DONE + DEPLOYED (Aaron, 2026-06-25, `wrld-backend` `3f4527c` +
> `wrld-mediasoup` `2b8be57`).** The engine half of U1 is live; remaining U1 is the **app
> dashboard toggle** (Ben).
> - **Wire:** `createRoom` accepts **`lane: 'buffer' | 'saved'`** (omitted → `'buffer'`).
>   It's stashed on `room._meta.lane` and forwarded to the backend's `allocateRecording`,
>   which tags the new **`BufferSession.lane`**. So the dashboard's only job is to send
>   `lane` on go-live (next to the existing `sources`/`subscribersOnly`/`visibility`).
> - **Retain-from-start:** a `saved`-lane session's footage is **never reaped** (live AND
>   after end) — the reaper honours the lane directly (independent of the PB2/PB3 flags).
> - **Render:** `GET /buffer/me` now returns **`session.lane`**, so the clips page can put
>   a live saved-lane session in the **saved row** from go-live.
> - **Deferred to later U-phases (so you don't expect them yet):** a saved-lane session is
>   retained but NOT yet materialised into a durable `Clip` — it won't appear in
>   `GET /buffer/me/clips` (it's a saved-lane *session* in `GET /buffer/me`); that
>   materialise + live quota accounting + the **storage cap** are **U3**, and the live
>   lane-toggle + snip-at-now is **U2/U3**. For U1, `saved` simply means "retained from
>   the start." There's also no cap yet → a saved go-live retains unbounded (fine at f&f;
>   U3 adds the cap).
>
> **App slice for U1 (Ben) — ✅ DONE 2026-06-25 (`a821d27`, on `design`/`main`).** `captureConfig.lane`
> (default buffer) + the `LaneToggle` on the dashboard + `lane` forwarded on `createRoom`
> (mediasoupSignaling/useSignaling/StreamScreen). `BufferSession.lane` + ClipsScreen renders a
> `lane:'saved'` session (live + ended) in the SAVED lane, excluded from the buffered carve (gated
> on `lane==='saved'` → existing data + the clips-timeline milestone untouched). **On-device verify
> still owed:** go live tagged `saved` → footage isn't reaped + shows in the saved lane.

---

## Open questions for Aaron (decide + pin in your CLAUDE.md)

- **Wire shape for "live settings changed."** Reuse the existing arming/`createRoom` channel, or
  a dedicated `settingsUpdate` message? It must carry the new per-range values + let the server
  stamp the boundary at its `now`.
- **Snip-at-now vs coalesce-noise.** Rapid toggles → many tiny ranges. Coalesce adjacent equal
  ranges server-side (the app already coalesces in the editor); define a min-range or debounce.
  **Ben's recommendation (2026-06-24), three layers — pick the threshold, the shape is settled:**
  1. **Coalesce-by-equality (always).** A setting change whose new value equals the adjacent
     range's value plants **no** boundary (a no-op snip). This alone kills most "bounce" — a
     toggle there-and-back nets to nothing.
  2. **Settle-debounce ~400 ms.** A flurry of changes within the window collapses to the *final*
     value before a boundary is committed (don't snip per keystroke / per rapid toggle). 300–500 ms
     is the reasonable band; 400 ms is the pick.
  3. **Min-segment floor ~1 s (backstop).** Any range shorter than ~1 s coalesces into its
     neighbour, so even a debounce miss can't leave a sub-second sliver. Ben's bar is "no clips
     that are only a few **frames** long" — a few frames at 30 fps is ~33–130 ms, so the 400 ms
     debounce **and** the 1 s floor each independently clear it with wide margin.
- **Edge-relative intent encoding.** A sentinel ("from live reaper edge" / "to now") vs a
  client-best-effort ms the server re-clamps. Recommend the sentinel for the live edges.
- **AV renegotiation recording semantics.** When a producer is removed mid-room, the recorder
  closes that source's track at the snip; re-adding opens a new one. Confirm the track/segment
  bookkeeping.
- **Storage-cap accounting during a live save.** Real-time quota check as footage prints to the
  saved lane; where the auto-flip threshold sits (hard cap vs cushion).

---

## App slice detail (Ben — for when each phase lands)

- **U1:** the **lane** control is BUILT + ready to wire — `features/broadcast/LaneToggle.tsx`
  (`BUFFER|SAVED`, flag-row idiom like Identity/Chat; in the FeatureGallery). Remaining: a
  `captureConfig.lane` field + drop `LaneToggle` into `DashboardScreen` + forward `lane` on
  `createRoom` (the screen/config wiring — pairs with Aaron's go-live-lane tag).
- **U2:** the dashboard's per-range controls emit the "settings changed" intent live (the
  dashboard *is* the now-edge editor); the existing `captureConfig` becomes the now-edge slice.
- **U3:** **revert** the reaper-disable guard (drag + sheet stay enabled during reap); the
  lane-change sends edge-relative intent; storage-cap warning UI.
- **U4:** the live source rail toggles drive AV add/remove (already part of the source-parity
  rail); reflect the renegotiation state.
- The clip editor (`SegmentSettingsSheet` + the per-range directives PATCH) already covers the
  retrospective half — no change needed there beyond honoring the new server fields.

---

## Time Machine compatibility (design the feed with this in mind)

The unified model and Time Machine ride the **same primitive** — *"public intervals over the
per-range manifest."* Time Machine already asks "what public range is alive at instant T?"; the
unified model just makes the manifest finer and live-edited. So the substrate is right
(per-range visibility = availability, the windowed/cell feed, invalidate-on-edit, the public
buffer in discovery, the universal clock). These are **refinements, not a redesign** — but design
the feed/coalescing for them:

1. **Segment-count discipline (the big one).** Snip-at-now fires on *any* setting change, so a
   long broadcast can spawn many tiny segments → manifest + availability-feed bloat + pin density.
   **Coalesce adjacent EQUAL ranges server-side, drop no-op snips, debounce trivial changes.**
   (Same as the "coalesce-noise" open question above, but it matters *doubly* here.) Co-located
   pins still **cluster** via the existing globe clustering, so visual density is handled; the
   discipline is about not exploding the data.
2. **Discovery resolves per-range, at the instant.** Since clip ≡ segment, a pin already carries
   one visibility/precision/identity, so C4.5's "read the clip's current values" holds — just
   confirm the feed resolves the **range alive at T**. No new mechanism.
3. **Live snips in the clips-page timeline (DEVICE-TEST item).** The `clips-timeline-clock-v1`
   smooth-build grows ONE now-edge segment; snip-at-now will **close it and open a new one
   mid-build**. Should be just a new boundary (build continues on the new segment), but it's a new
   dynamic vs what was tuned — **regression-pass against the milestone's device-test cases.**
4. **Replay across boundaries.** A clustered/coalesced span may cross underlying segments whose
   sources/title differ; the ClipViewer's source rail should update at those boundaries during
   replay (it already handles track/group changes for buffer VODs — minor extension).
5. **Reaping shrinks the past** — already the model (CONTENT.md §6: "the past is thinner — only
   surviving clips"); verify reaped buffer intervals **drop out of the feed** under the finer
   segmentation (the 15s refetch + the `cell_changed` push cover this — confirm).

**No fundamental conflict** — the Time Machine work holds. The reconciliation is entirely "the
feed operates per-range + coalesces by equality, and the live timeline tolerates mid-build snips."

---

## The invariants (canonical: CONTENT.md §5 "The invariants") + forward-only confirmation

The unified-manifest principles are now stated as guardrails in **CONTENT.md §5 → "The
invariants (the tight principles — guardrails)"**. Read them there; in one line each:
**(1)** one server element, rendered (not copied) by every surface; **(2)** an edit proliferates
everywhere or it's a divergent-read bug; **(3)** every preference axis is equal (one write path,
one read path); **(4)** **forward-only snips** — a snip (manual, or at the **now / reaper / storage-cap**
edge) applies to the clip **AHEAD**; the clip **behind keeps the permissions it had when printed.**

**Forward-only — confirmed 2026-06-25 (Ben's check).** All three live edges already snip forward in
the deployed model: now (`snip at now → print forward`), reaper (`from the reaper edge forward`,
"save the remainder"), storage cap (`snip at the cap, auto-flip to buffer, keep printing there`).
Nothing rewrites the range behind the edge. No code change — captured as the §5 invariant so it
can't silently regress.

## App-side threads toward the invariants (Ben's lane — NOT in the contracts above)

Beyond the backend contracts, these are the **app** gaps between today's build and the invariants.
Each lists the principle it serves, the guardrail, and its dependency. Sequencing note: #3 + #5
**dissolve** once backend (2c) lands; #1 + #2 are the real moves; #4 is the structural backstop.

1. **One drawer, not two** *(invariant 1)*. The clips-page drawer (`SegmentSettingsSheet`) and the
   library/profile drawer (`SavedClipSettingsSheet`) are two components → unify into one host both
   surfaces feed identically, so "the same clip shows the same drawer" is literal, not by
   convention. **Guardrail:** new clip-pref UI goes in the ONE drawer; don't fork a second.
   **Dep:** read-parity needs backend #12 (expose visibility/tags on the saved-clip read) before the
   library drawer can show every axis.
2. **Lane as a peer axis** *(invariant 3)*. Six axes flow through the directive edit; **lane** alone
   rides a bespoke `saveClip`/`unsaveClip` optimistic flow. Make it a directive (`retain`) edited on
   the same path. **Guardrail:** no axis gets its own write path. **Dep:** the retain-in-place
   backend (PB2) being the live model (it's flag-gated today — see finding (3)).
3. **Retire the dual-write** *(invariant 1/2, cleanup)*. `onSheetChange` currently writes a saved
   clip's title/identity/precision **twice** (the directive + `patchClip` on `c.*`) because the
   library/viewer read the Clip row, not the directive. **Once backend (2c) coalesces the directive
   in the library + viewer, delete the `patchClip` branch** → one write path. **Guardrail:** the
   dual-write is a temporary workaround — don't build on it; remove it when 2c lands.
4. **One canonical clip type** *(invariant 1, structural backstop)*. The same element is modeled as
   four app types — `LaneClip` (timeline) · `SavedClip` (library) · `ClipPin` (time machine) ·
   `ClipDetail` (viewer). A shared canonical clip + thin per-surface adapters makes "same element
   everywhere" **type-enforced** (a new field can't be shown in one place and forgotten in another).
   **Guardrail:** when adding a clip field, add it to the canonical type, not one surface's type.
   **Dep:** none (pure refactor) — do once the model stops moving.
5. **Title-default heuristic** *(minor, dissolves with 2c)*. The drawer title prefill reads
   `directive ?? saved-name ?? session-title` with string-filtering of the `'Untitled clip'`/time
   fallbacks. When backend (2c) returns the resolved title as one field, collapse to reading it.

**Done this round (app):** per-snip re-emit now covers **location + torch** too (was sensors-only —
a U2 contract miss); the drawer title **prefills** the current title; a saved-clip rename
**dual-writes** so it reaches the library + viewer + pin; all edit paths invalidate the library +
viewer + time-machine feeds.

> **✅ #12 + (2c) + #11 CODE DONE + PUSHED (Aaron, 2026-06-25, `wrld-backend` `d721f12`) — ⏳ DEPLOY PENDING.**
> Typecheck-clean (my files) + 299 tests green. **Not yet deployed:** the box's working tree has
> concurrent **M-series moderation WIP** (uncommitted `schema.prisma` + `src/services/moderation/*`
> + an untracked `20260625000000_moderation_cases` migration + modified `internal.ts`/`server.ts`/
> `env.ts`) that does **not** `tsc`-compile (4 `Buffer|undefined` errors in `moderation/scanner.ts`
> + `scanQueueService.ts`), so the Docker build fails. My changes deploy on the next clean build
> once the M-series compiles. What landed:
> - **#12** — `GET /buffer/me/clips` returns `visibility` (clip-level) + `tags` (union of the clip's
>   per-range directives) for the profile/Me drawer.
> - **(2c)** — `GET /buffer/me/clips` (name/attributed/locDisplayPrecision) + `GET /clips/:id`
>   (title/attributed/locDisplayPrecision) coalesce the per-range directive (at the clip's start)
>   over the clip-level → the directive is the single authority; the app can drop the dual-write.
> - **#11** — `DELETE /buffer/me/clips/:id/tracks/:kind` (destructive per-source delete + reclaim;
>   refuses the last track) and `DELETE /buffer/me/sessions/:id` (permanent-delete a buffered clip's
>   footage now; refuses live/retained sessions; reaper reconciles the pool).
