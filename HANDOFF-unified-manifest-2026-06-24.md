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

---

## STATUS ROLL-UP — Aaron → Ben (2026-06-25): unified-manifest backend, end to end

A full read of where the backend/mediasoup side of the unified manifest stands, what you can build
on now, what's still owed, and the red-flag items that would move us closer to the §5 core
principles. Companion to CONTENT.md §5 "Conformance status" + `wrld-backend/CLAUDE.md`
"Unified-manifest conformance review" (both written this pass).

### ✅ Completed (built + deployed unless noted)

- **U1 — go-live lane.** `BufferSession.lane` ('buffer'|'saved'); `createRoom`→`allocate` carries it;
  a `saved` session is retained from go-live (reaper never evicts it). `GET /buffer/me` returns
  `session.lane`. *(Deployed.)*
- **U2 — snip-at-now.** `POST /buffer/me/sessions/:id/snip` (live-only, PB3-gated): closes the open
  era at the server's `now`, opens a new era forward, seeds the chat init marker. `bufferSessionEnded`
  clamps any open era to session end. *(Deployed.)*
- **U3 — edge-relative save + storage-cap gate.** `fromReaperEdge`/`toNow` flags + always-clamp to
  `[earliest, now]`; `409 { storage_cap, usedBytes, quotaBytes, neededBytes }` replaces the coarse
  reject. *(Deployed.)*
- **U4 — AV-live toggle (mediasoup).** `setSourcePaused {kind,paused}` → producer pause/resume (one
  track with a gap, not a new track) + keyframe-on-resume + `producerPaused`/`producerResumed` to
  viewers. *(Deployed — needs the on-device gap test, see below.)*
- **U5 — discover title coalesce.** `titleAt` over the per-range directive on every feed. *(Deployed.)*
- **#13 — buffer-pin per-range precision + identity** on all three feeds (`directiveAt`). *(Deployed.)*
- **#12 / (2c) / #11 — saved-clip read parity, per-range coalesce, destructive deletes.** Code done +
  pushed (`wrld-backend d721f12`); **DEPLOY PENDING** (see red flag R1).
- **PB4 carry-through** (prior rounds): per-segment title/tags persisted on `DirectiveRange` +
  `splitRangeByDirectives` carries the full per-segment manifest through promote.

### ⏳ Pending / owed

- **DEPLOY of #12/(2c)/#11** — blocked, see R1. Once live: your app threads **#1 (one drawer)**,
  **#3 (retire the dual-write)**, **#5 (title heuristic)** are all unblocked — (2c) returns the
  resolved title/identity/precision as one field, so you can delete the `patchClip` dual-write and
  collapse the title prefill to reading the server value.
- **On-device gates (CI can't run mediasoup):** U4 pause/resume gap (go live → pause camera ~30s →
  resume → recording stays ONE track with a gap, session does NOT stop; if FFmpeg dies on the gap the
  fallback is close/re-attach); #13 blur/anon actually showing on a time-machine pin; U1/U2/U3 app
  slices.
- **Principled deferrals (not omissions):** storage-cap as a *live* server snip + the U1 saved-lane
  *real-time* quota — both need a bytes↔time estimate (R3 below). Today the cap is all-or-nothing per
  save and the client flips the lane to buffer.

### 🚩 Red flags — items that move us toward the §5 core principles

These are the gaps where the build still diverges from the invariants. Ordered by leverage.

- **R1 — DEPLOY BLOCKER (not mine to fix).** The box's working tree has concurrent **M-series
  moderation WIP** (uncommitted `schema.prisma`, untracked `src/services/moderation/*` +
  `adminModeration.ts`/`hiveWebhook.ts` + the `20260625000000_moderation_cases` migration, modified
  `internal.ts`/`server.ts`/`env.ts`/`streams.ts`/`users.ts`) that does **not** `tsc`-compile, so the
  Docker build fails. **#12/(2c)/#11 are committed + pushed and ship on the next clean build** once
  that compiles. I did not touch/commit/deploy the M-series work.
- **R2 — Lane is special-cased (the real invariant-3 break). ⬅ highest leverage.** Every other axis
  (visibility · precision · identity · sources · title · tags) is a `DirectiveRange` field on one
  write/read path; **lane is not** — it rides `BufferSession.lane` (U1) *plus* retain `Clip`/`ClipRange`
  rows (U3). The reaper honours **three** separate retain signals. The fix — a per-range `retain`/`lane`
  directive the reaper reads as *the* retain signal — collapses that duality, makes "no axis gets its
  own write path" literally true, and is the **server-side twin of your app thread #2 ("lane as a peer
  axis")**. Your #2 and this backend change should land together.
- **R3 — Storage-cap edge isn't a true forward snip (invariant 4).** It's a `409` + client lane flip,
  not a server snip-at-cap + auto-flip + print-forward. Needs the bytes↔time estimate (same one the U1
  saved-lane live quota needs).
- **R4 — A saved clip's manifest is three representations (invariant 1, structural).** `ClipRange`
  (retain body) + `DirectiveRange` (per-segment settings) + `ClipTrack` (per-source), reconciled by
  `splitRangeByDirectives`. Works, but a clip isn't *literally* "a named set of per-range directives
  over the one store." North-star refactor — pairs with your app thread #4 ("one canonical clip type").
- **R5 — `#12` tags is a union flattening.** `Clip` has no tags column, so `tags` on
  `GET /buffer/me/clips` is the union of the per-range directive tags. The real per-range truth is in
  the `directives[]` on the same read — use that when a per-segment tag view matters; the union is for
  the drawer's coarse display only.
- **R6 — Server-side coalesce-adjacent-equal directives (missing backstop).** U2 left no-op-snip
  debouncing to the app; without a server merge of adjacent ranges whose every axis matches, live
  edits can bloat eras/segments and fragment the availability feed + Time-Machine pins. Belongs
  server-side eventually.

---

## Preference unification — per-axis status + the app build plan (2026-06-25)

Canonical principle: **CONTENT.md §5 → "Preference unification — one path for every axis"** (the
3-layer rule: write the directive · server coalesces everywhere · app renders one resolved source).
The title saga is **one instance**; this is the general plan so EVERY axis proliferates to EVERY
surface. Per-axis state of the three layers:

| Axis | Server read (L2) | App render (L3) gap | Unify blocker |
|---|---|---|---|
| **title** | discover ✓ (U5) · library/viewer = `c.title` until **(2c)** | buffer-lane timeline label reads `s.title`; library drawer input empty (key bug) | (2c) deploy + app render fixes |
| **precision** | discover ✓ (#13) · library/viewer = `c.*` until (2c) | globe halos use stream precision (correct for *live*) | (2c) deploy |
| **identity** | discover ✓ (#13) · library/viewer = `c.attributed` until (2c) | — | (2c) deploy |
| **visibility** | discover ✓ · library = `c.visibility` (vocab gap) · not on viewer | hidden in the library drawer (read gap #12) | (2c)+#12 deploy + vocab unify |
| **per-source** | discover/viewer = directive `sources`/`sourceWindows` ✓ | — | mostly unified |
| **tags** | library = union (#12, R5) · per-range in `directives[]` | hidden in the library drawer | #12 deploy |
| **lane** | `BufferSession.lane` + retain rows — **NOT a directive** | timeline lanes + drawer toggle are bespoke | **R2** (server) + app thread #2 |

### App build plan (the general mechanism — supersedes title-only fixes)
1. **One resolver — `resolveClipSettings(clip)`** → the resolved `{title, visibility, precision,
   identity, sources, tags, lane}` from the server's (directive-coalesced) data. Future-proof: it
   reads whatever the server returns today and upgrades for free as (2c)/#13 land. *(Pure app, not
   blocked.)*
2. **Render from the resolver, everywhere** — timeline labels (both lanes), both drawers, the viewer
   chrome, the pin card. Kills the `s.title`/`c.name`/raw-field reads. *(Pure app, not blocked.)*
3. **One drawer** — unify the clips-page `SegmentSettingsSheet` host + the library
   `SavedClipSettingsSheet` into one (app thread #1). *(Needs #12 deploy for visibility/tags read
   parity to show every axis.)*
4. **One write path** — every edit → `patchDirectives`; the directive + `c.*` **dual-write stays as
   the temporary bridge** until (2c) deploys, then delete it (app thread #3).
5. **Invalidation** — every edit refetches every surface's query (done; keep it complete as surfaces
   are added).

### Not blocked — can land now (against the resolver, before (2c)):
- The **library-drawer empty-title key bug** (`SegmentSettingsSheet` unkeyed inside
  `SavedClipSettingsSheet` + empty-shell → `useState` never re-inits).
- The **buffer-lane timeline label reading `s.title`** → read the resolved title (directive/clip ??
  s.title fallback).
- The **library drawer not writing the directive** (so its renames reach the time-machine pin too).

### Blocked on Aaron's deploy / build:
- (2c)+#12 deploy (R1, the M-series compile) → unblocks one-drawer + dropping the dual-write + tags/
  visibility in the library drawer.
- **R2** (lane as a directive) → makes lane the 7th equal axis; pairs with app thread #2.

---

## ⛳ Rollout to complete delivery (2026-06-25) — assessed across all 3 repos

Assessed wrld-app + wrld-backend (origin/main, 32 commits ahead of the stale local) +
wrld-mediasoup. **R1 is RESOLVED** — the M-series moderation that blocked the #12/(2c)/#11 compile is
now committed to backend `origin/main` (16 moderation commits + a conformance-review doc landed
after the deploy-blocker note), so #12/(2c)/#11 are deployable/likely-deployed. The destination is
**CONTENT.md §5 "Target architecture (north star)"**; this is the phased path to it.

### State at the start line
- **Deployed:** U1–U5, #13, PB2 retain-in-place, discover/buffer-pin directive coalesce, M-series.
- **Deployable now (confirm):** #12 (saved-clip visibility/tags read) · (2c) (library+viewer coalesce
  the directive) · #11 (per-source + buffered-clip delete endpoints).
- **App, landed + pushed:** U1/U2/U3 slices; title prefill + saved-clip rename dual-write +
  library/viewer/time-machine invalidation; per-snip location/torch re-emit.

### The phases (each: goal · owner · depends · done-bar)
Ordered so **user-visible unification lands first** and the risky structural collapse is **last** —
by which point behaviour is already unified, so the collapse is invisible to users.

**P0 — Confirm deploy + verify the foundation on device.** *Owner: Aaron (deploy) + Ben (device).*
Confirm #12/(2c)/#11 live on the box. Then on-device verify the landed work: U1 saved-lane render ·
U2 snip-eras + **title rename proliferates** · U3 edge-relative save + storage-cap + **save→Library**
(PB2 flag ON) · #13 **precision/identity on a past pin**. **Done:** Ben's three bugs pass; #12/(2c)/#11
confirmed live. *(Gates dropping the dual-write.)*

**P1 — App: one resolver + retire the dual-write (the "one read/one write" realization).**
*Owner: Ben. Depends: P0 (2c live).* Build `resolveClipSettings` (§5); route EVERY surface's reads
through it (timeline labels off `Stream.title`, drawer prefill, viewer chrome, pin cards). Land the 3
not-blocked fixes: **library-drawer key bug** (unkeyed `SegmentSettingsSheet` + empty-shell → title
input stays empty) · **timeline label reads the resolved title** (not `s.title`) · **library drawer
writes the directive** (so its renames hit the pin). Once (2c) confirmed: **delete the `patchClip`
dual-write** → directive-only writes. **Done:** every surface reads the resolver; one write path; an
edit on any axis from any surface proliferates everywhere on device.

**P2 — App: one drawer.** *Owner: Ben. Depends: #12 live.* Unify the clips-page `SegmentSettingsSheet`
host + the library `SavedClipSettingsSheet` into one (app thread #1); folds in the
**`ben-frontend` SaveClip precision/identity controls** (axis editing on save) + tags/visibility now
that #12 exposes them. **Done:** the same drawer everywhere; all 7 axes editable in it.

**P3 — Lane becomes the 7th equal axis.** *Owner: Aaron (R2) + Ben (app thread #2). Highest-leverage
gap.* Backend: make lane a `DirectiveRange` axis (`retain`/`lane` field; the reaper reads it as *the*
retain signal — collapse the 3 OR'd signals). App: drop the bespoke `saveClip`/`unsaveClip`; lane
flows through `editClip` + the resolver like every axis. **Done:** lane is a directive; no save/un-save
special path; all 7 axes literally equal.

**P4 — Complete the live edges.** *Owner: Ben (U4 app) + Aaron (R3).* U4 app slice: the live
cam/audio **pause/resume** toggle (`setSourcePaused`, backend deployed) + viewer
`producerPaused`/`producerResumed` handling + the on-device FFmpeg-gap test. R3: storage-cap as a
true server **snip-at-cap + auto-flip** (the bytes↔time estimate) → invariant 4 complete. **Done:**
AV toggles live as one-track-with-a-gap; the cap snips server-side forward.

**P5 — Backstops.** *Owner: Aaron.* **R6** server-side coalesce-adjacent-equal directives (stop
live-edit era bloat) · **R5** real per-clip tags (or keep the documented union). **Done:** live edits
don't fragment the manifest / availability feed.

**P6 — The structural collapse + rename (the north star realized).** *Owner: Aaron (schema) + Ben
(types). Large; last; flag-don't-start until P1–P5 soak.* Collapse `Clip` + `ClipRange` +
`DirectiveRange` + `ClipTrack` → the one **Clip = range + axes** model (R4); rename to the clean vocab
(`precision`/`identity`/`keep`/`source`/`Track`; drop `locDisplayPrecision`/`locationPrecision`,
`visibility: public|anon|draft`, bool `attributed`, `lane`, `splitPoints`, the stale `motion`/`temp`
kinds). App: types follow; the resolver collapses to a column read (fallback chain gone); delete the
bridge scaffolding. **Done:** the schema IS §5; flip the §12 bridge table to "done."

### Adjacent open items (tracked, NOT part of this rollout)
- **Day/night terminator (KAN-52)** — architecture decision (Mapbox fill vs three.js); separate.
- **Haven viewport-tiles** — planet-keyed tile index + app subscribe; separate scaling lane.
- **PPV badge** (`ppv-badge-ben`) — small viewer-UI piece; separate.
- **DiscoveryHandoffCard `kind:'clip'` variant** (`ben-frontend`) — time-machine clip-pin card;
  lands with the Time-Machine consumer, adjacent to P1.

### Sequencing logic
P0 gates P1. P1+P2 are pure-app and deliver the unification users feel (edits proliferate, one
drawer) on the *current* schema. P3+P4 complete the axes + live edges. P5 hardens. **P6 is the only
schema migration** and is deliberately last — once P1–P5 hold, the collapse changes nothing
user-visible, just deletes the scaffolding. Each phase is independently shippable + verifiable.

---

## ⛳⛳ THE CANONICAL UNIFICATION ROLLOUT (rearchitecture — supersedes the incremental P0–P6)

> **🛑 STATUS: PAUSED — awaiting a focused Ben + Aaron joint kickoff (2026-06-25).** Do not start CU
> work or deploy more one-off coalesce fixes until then. This is a coordinated cross-repo
> rearchitecture, not parallel ad-hoc patching (this session hit 4+ push collisions patching alone).
> All repos pulled + aligned (app `b119da2` · backend `60ee42f` · mediasoup `8930ee2`). At kickoff:
> Aaron takes CU1 (this section IS his work-order) / CU3-backend / CU4-schema; Ben takes CU2 +
> CU4-app-types + the drawer unification. Read CONTENT.md §5 "Target architecture" for the WHAT, then
> this for the HOW.

**Decision 2026-06-25 (Ben):** stop patching read paths. The incremental "coalesce each feed" approach
is whack-a-mole — the time machine alone has ~4 read paths (legacy `?at=`, windowed, tiled, the
buffer-session viewer) and the title/precision/identity live in 3 places (`Stream.*` / `Clip.*` /
`DirectiveRange`) with **two** directive row-sets (`clipId=null` session vs `clipId`-set clip). Each
fix clears one path; the next reveals another. **The fragmentation is the disease.** Target =
**CONTENT.md §5 "Target architecture (north star)."** Build the canonical model and migrate onto it.

**Strategy:** unify the *behaviour* first (one authority + one shared resolver/writer → kills the
staleness everywhere at once, no feed can diverge), then do the structural collapse. This converges
fast (CU1 fixes the bugs) and lands clean (CU4 deletes the fragmentation).

### CU1 — One authority + one shared resolver/writer (backend, Aaron). ⬅ the spine; fixes the bugs.
Make the **per-range directive the single source** for all 7 axes. Write **ONE
`resolveClipAxes(session|clip, atMs)`** and route **every** read path through it — the 3 discover
feeds, `GET /buffer/me/clips` (library), `GET /clips/:id` + `GET /buffer/session/:id` (viewers).
Delete each feed's bespoke title/precision/identity resolution. Write **ONE write path** (the
directive). Pick **one** directive row-set as authority (recommend the session `clipId=null` rows; the
clip's `clipId`-set carry-through becomes a read-fallback, then dies in CU4). **Done-bar:** an edit
shows **identically** on the time-machine pin + viewer, the library, the clips page, and the live
globe — because they all call the one resolver. *(This is the systemic version of the buffer-session
fix I just pushed — that fix was one read path; CU1 makes it the only resolver.)*

### CU2 — App: one resolver + one render + one drawer (Ben).
`resolveClipSettings` (now a thin pass-through over CU1's server result) feeds **every** surface;
the two drawers (`SegmentSettingsSheet` host + `SavedClipSettingsSheet`) collapse to **one**; every
edit calls the **one** write path. Retire the `patchClip` dual-write + the `Stream.title`/`Clip.name`
reads. **Done-bar:** every app surface reads/writes the one model; no surface-specific field reads.

### CU3 — Lane as the 7th axis (R2) + live edges (U-series on the unified write).
Lane → a `DirectiveRange` axis the reaper reads as its **one** retain signal (collapse the 3 OR'd
signals); go-live / snip-at-now / reaper / storage-cap / AV-pause-resume all write the unified model.
Owner: Aaron (backend + mediasoup) + Ben (app). **Done-bar:** all 7 axes equal; live editing on the
one model; forward-only at every edge.

### CU4 — Structural collapse (R4): clip ≡ segment (Aaron schema + Ben types).
Collapse `Clip` + `ClipRange` + `DirectiveRange` + `ClipTrack` → the one **Clip = range + axes** over
`Track` footage; **one** discover feed (retire legacy/windowed/tiled split); the clean **rename**
(`precision`/`identity`/`keep`/`source`/`Track`; drop `locDisplayPrecision`/`locationPrecision`,
`visibility: public|anon|draft`, bool `attributed`, `lane`, `splitPoints`, stale `motion`/`temp`).
Backfill historical footage into the canonical model. **Done-bar:** the schema *is* §5; the
`resolveClipAxes` of CU1 collapses to a column read (no fallback).

### CU5 — Delete the old + flip the bridge (both).
Remove the legacy tables / fields / feeds / dual-write / coalesce scaffolding; flip the §5 §12 bridge
table to **done**. **Done-bar:** total canonized unification — one home per fact, one read, one write,
one render; nothing left to diverge.

### Sequencing + coordination
CU1 is the spine and **delivers the bug fix early** (behavioural unification). CU2 follows CU1. CU3
parallels. **CU4 (the risky structural migration) is deferred until CU1–CU3 prove the model**, then
CU5 deletes the old. This is a **coordinated cross-repo effort** (Aaron = the backend spine CU1/CU3/CU4;
Ben = app CU2 + CU4 types) — not ad-hoc patch-by-patch. Each CU is independently shippable + verifiable
on device. The incremental P0–P6 above is **superseded** by this (its app-side pieces fold into CU2).

---

## CU1 — THE PEDANTIC DETAIL (exact read paths, write targets, row-sets) + DO / DON'T

Everything CU1 must reconcile, from the device + deployed-code audit (2026-06-25). This is the precise
version of "one authority + one shared resolver." If anything here is wrong, fix it at the source —
don't route around it.

### A. Every axis, every field today → the one authority
Resolution today is `directive ?? clip ?? stream ?? default`. Note the **field names differ per level**
(the naming inconsistency is itself a symptom):

| Axis | Stream level | Clip level | Directive level (target) | Resolves to |
|---|---|---|---|---|
| title | `Stream.title` (go-live, NOT NULL) | `Clip.title?` | `DirectiveRange.title?` | `directive.title ?? clip.title ?? stream.title` |
| precision | `Stream.locationPrecision?` | `Clip.locDisplayPrecision?` | `DirectiveRange.precision?` | `directive.precision ?? clip.locDisplayPrecision ?? stream.locationPrecision ?? 'exact'` |
| identity | — | `Clip.attributed` (bool) | `DirectiveRange.attributed` | `directive ?? clip ?? true` → target enum `shown\|anon` |
| visibility | `Stream.visibility` (live-private gate) | `Clip.visibility` = **`public\|anon\|draft`** (3-concept tangle) | `DirectiveRange.visibility` = `public\|private` | `directive ?? clip(normalized) ?? 'public'` |
| tags | — | — (**no `Clip.tags` column**; `#12` returns the union of directive tags) | `DirectiveRange.tags[]` | `directive.tags` |
| sources | `Stream.sources[]` (armed = what EXISTS) | `ClipTrack.enabled` + `.removedRanges` | `DirectiveRange.sources` (Json) | `directive ?? clipTrack.enabled ?? all-captured-on` |
| lane/keep | `BufferSession.lane` | `Clip`/`ClipRange` retain rows | `DirectiveRange.retain` (**exists!**) | today **3 signals OR'd**; target = `directive.retain` alone |

Target name cleanups (CU4): `precision` (drop `locDisplayPrecision`/`locationPrecision`), `identity:
shown|anon` (drop bool `attributed`), `visibility: public|private` (move `anon`→identity, `draft`→keep),
`keep` (drop `lane`/retain rows), `Track` (drop `BufferTrack`/`ClipTrack`), `precision: …|private`
(drop `hidden`/`off`).

### B. The TWO directive row-sets — the root of the divergence (CRITICAL)
`DirectiveRange` exists in two flavours, written + read by **different** paths:
- **`clipId = null` (SESSION directives).** WRITTEN by the app's per-segment edit
  (`patchSessionDirectives` ← `applySegSetting`). READ by: the windowed/tiled **buffer PINS**
  (`directiveAt` over `sessionDirs`) + `GET /buffer/session/:id` (the buffer viewer, after the
  down-payment fix).
- **`clipId` set (the saved CLIP's own directives).** WRITTEN **only at promote** (carry-through —
  **FROZEN at save**, never updated by a later edit). READ by: the windowed/tiled **clip PINS**
  (`titleAt`/`clipTitled`) + the **library** (`GET /buffer/me/clips`, `c.directiveRanges`) + `GET
  /clips/:id` ((2c)).
- **THE BUG CLASS:** a post-save edit writes `clipId=null` (session) + `Clip.*` (the app dual-write),
  but the saved-clip read paths coalesce `clipId`-set (frozen) ?? `Clip.*`. Which value wins depends
  on the feed → the staleness is feed-by-feed.
- **CU1 AUTHORITY — ✅ DECIDED 2026-06-26 (Ben): `clipId = null` (session rows) is THE source.** The
  buffer is the one store; a saved clip is a retain over it. Every edit writes `clipId=null`; every
  read resolves `clipId=null`. `Clip.*` + `stream.*` + the `clipId`-set carry-through become
  **read-fallbacks only** (deleted in CU4).
  - **LIFECYCLE GUARANTEE (the condition this decision rests on):** the `clipId=null` directives (and
    their `BufferSession` row) **must survive retention** — when a range is `keep`/retained, its
    `clipId=null` directives are exempt from the reaper too, so they outlive the rolling-buffer window
    exactly as the retained footage does. This comports with the pure model (the directive *is* the
    axes; kept footage keeps its manifest) and is precisely what CU4 makes literal (the directive
    becomes the Clip's own columns). **Aaron's CU1 includes this reaper guarantee** — without it, a
    survived saved clip would lose its axes source. The earlier `clipId`-set carry-through (frozen at
    save) is then redundant → a read-fallback, deleted in CU4.

### C. Every read path + its CURRENT resolution → replace with the one resolver
| Read path | endpoint / fn | current TITLE | current PRECISION | current IDENTITY |
|---|---|---|---|---|
| Legacy `?at=` discover (`useHistoricalClips`) | `GET /clips/discover?at=` | `c.title` **raw (no coalesce)** | `COALESCE(c.locDisplayPrecision, s.locationPrecision)` | `c.attributed` |
| Windowed/tiled BUFFER pins | `windowAvailability` | `cover?.title ?? row.title` (`cover`=`directiveAt(sessionDirs[clipId=null], intervals[0].startMs)`) | `cover?.precision ?? s.locationPrecision` | `cover ? cover.attributed : true` |
| Windowed/tiled CLIP pins | `windowAvailability` | `titleAt(clipTitled[clipId-set], intervals[0].startMs) ?? row.title` | `COALESCE(c.locDisplayPrecision, s.locationPrecision)` | `c.attributed` |
| Library | `GET /buffer/me/clips` | `cover?.title ?? c.title` (`cover`=`c.directiveRanges[clipId-set]` covering start) | (2c) coalesce over `c.locDisplayPrecision` | (2c) over `c.attributed` |
| Clip viewer | `GET /clips/:id` | (2c) coalesce ?? `c.title` | `COALESCE(c.locDisplayPrecision, s.locationPrecision)` | `c.attributed` |
| Buffer viewer | `GET /buffer/session/:id` | **was `stream.title`** → now `clipId=null cover ?? stream.title` (down-payment) | (n/a in viewer) | (host shown unconditionally — anon NOT honoured yet) |

**CU1 = delete every cell above and call `resolveClipAxes(clipId=null dirs, T) ?? <fallbacks>`.**

### D. The pin COVERAGE nuance
The windowed/tiled pins resolve at **`intervals[0].startMs`** (the first PUBLIC interval), NOT the
playhead. A directive over a **sub-range** that doesn't cover `intervals[0].startMs` → `cover=null` →
stale fallback. `resolveClipAxes` must resolve at a **consistent, principled instant** — recommend the
**queried instant T** (per-instant, matches "clipAt(t) selects + axes are current"), not the first
interval. This is why a whole-clip rename showed but a sub-range edit may not.

### E. The buffer-session DEDUP (why the time machine shows the SESSION, not the saved clip)
`windowAvailability` dedups: a clip whose session is **also** a returned bufferPin is dropped (same
footage) → the time machine renders the **buffer SESSION** pin (`source=buffer`), which reads
`clipId=null`. So an edit on the saved CLIP must land on the SESSION's `clipId=null` directive — which
the CU1 single-authority guarantees (and is why authority = `clipId=null`).

### F. Write targets to consolidate (one writer)
- `applySegSetting` → `patchSessionDirectives` (`clipId=null`) — **keep as the one writer.**
- `patchClip` (`Clip.*`) — the **dual-write** — **DELETE in CU2** once reads resolve `clipId=null`.
- promote carry-through (`clipId`-set, frozen) — vestigial once reads stop using it (CU1); **deleted in CU4.**

### G. DO / DON'T
**DO:**
- Make `clipId=null` the single authority; route EVERY read through one `resolveClipAxes`.
- Resolve at the **queried instant T** (`clipAt(t)` selects WHICH clip; axes are read CURRENT — only
  footage + retained capture-fidelity coords/identity are tied to T; §1.4 reversibility).
- Keep **forward-only** snips (now/reaper/cap → the clip AHEAD, never behind).
- Honour `anon` everywhere a host renders (the buffer viewer currently doesn't).

**DON'T:**
- Don't add per-feed bespoke resolution — that's the whack-a-mole CU1 kills.
- Don't read `stream.title` / `Clip.title` / `Clip.locDisplayPrecision` in any feed once CU1 lands
  (fallback-only, then deleted in CU4).
- Don't **freeze axes at save** (the `clipId`-set carry-through is the anti-pattern that caused the
  staleness — a saved clip's axes must stay live-editable, read from the authority).
- Don't deploy more one-off coalesce patches before the joint kickoff.
- Don't start CU4 (the table collapse / rename) before CU1–CU3 prove the model on device.
- Don't break the `clips-timeline-clock-v1` milestone (the universal wall clock / smooth scrub) — the
  manifest rearchitecture is orthogonal to timeline playback; verify against its device-test cases.

---

## CU1↔CU2 CONTRACT — LOCKED (2026-06-26)

- **Authority:** `clipId=null` session `DirectiveRange` rows, **retained with the footage** (CU1 reaper
  guarantee). `Clip.*`/`stream.*`/`clipId`-set = read-fallbacks → deleted in CU4.
- **`ResolvedAxes`** (every **single-instant** backend read returns it, resolved at the queried
  instant T): `{ title, tags[], visibility:'public'|'private', identity:'shown'|'anon',
  precision:'exact'|'city'|'country'|'private', sources:{[source]:bool}, keep:'kept'|'reapable' }`.
  **AMENDED 2026-06-26 (✅ shipped `7d09d78`; see "CU1 COMPLETENESS" #1):** **window/tile** feeds
  (windowed/tiled discover) additionally carry each pin's per-range **`directives: PinDirective[]`**
  (the display subset `{startMs,endMs,title,precision,attributed}`) — a window has no single T, so the
  **app** resolves title/identity at the playhead; coords/host stay pin-level + server-obfuscated, and
  the pin-level fields are the fallback when `directives` is empty. Single-instant reads (`/clips/:id`,
  `/buffer/me/clips`, `/buffer/session/:id`, `?at=`) are unchanged (still resolved server-side).
- **App reads it via one `resolveClipSettings(serverClip) → ResolvedAxes`** — a thin pass-through;
  every surface reads *that*. (Pre-CU1 the impl maps today's per-endpoint shapes; post-CU1 it's a
  pass-through — one-place swap.)

### CU2 — app surface work-map (the mechanical change once CU1 lands)
Every app surface that reads a clip axis → route through `resolveClipSettings`. Today each reads a
raw field; after CU2 each reads the resolver. (Exact field names verify at build.)

| Surface | Component | Reads today (raw) | → CU2 |
|---|---|---|---|
| Live globe pin / Time-machine pin | `GlobeScreenMapbox` (pin geojson) | `pin.title` / `pin.locationPrecision` / host | `resolveClipSettings(pin).{title,precision,identity}` |
| Discovery card | `DiscoveryHandoffCard` | `stream.title`, host, precision caption | `resolveClipSettings(x).*` |
| Clips timeline block | `ClipBlock` / `ClipsScreen` lanes | `clip.label` (= `c.name`/`s.title`), lane | `…title`, `…keep` |
| Clip / Library drawer | `SegmentSettingsSheet` (+ the two hosts → one) | `override ?? c.name ?? s.title`, per-axis | `resolveClipSettings(clip)` for all 7 |
| Library entry | `MeProfileTab` `FeedRow` | `clip.name` | `…title` (+ `…keep`) |
| Live stream viewer | `StreamScreen` | `clip.title`, host, source rail | `…title`, `…identity`, `…sources` |
| Time-machine clip viewer | `ClipViewerScreen` | `clip.title`, host, source rail | `…title`, `…identity`, `…sources` |
| Analytics — top clips | `AnalyticsScreen` | `clip.title` | `…title` |

**Writes (CU2):** every edit → the one write path (the directive); **delete the `patchClip`
dual-write** + the clips-page `clipId`-vs-session routing in `onSheetChange`. **One drawer:** collapse
`SavedClipSettingsSheet` into the `SegmentSettingsSheet` host (the key/empty-shell quirk dies with it).

### GO state (2026-06-26)
Contract locked. **Aaron → CU1** (backend resolver + the `clipId=null`-survives-retention reaper
guarantee + route every read path; the "CU1 — THE PEDANTIC DETAIL" appendix is the work-order).
**Ben/app → CU2** lands the moment CU1 returns `ResolvedAxes` (this work-map is the mechanical
change; the throwaway pre-CU1 impl is optional — cleaner to wait for CU1's pass-through). No app code
builds on the fragmented model before CU1.

> **✅ CU1 BACKEND DONE + DEPLOYED + VERIFIED (Aaron, 2026-06-26) — ⏳ not yet committed to git.**
> Built per the work-order + the locked contract; **no schema change / no migration**
> (`DirectiveRange` already carries all 7 axes — CU1 is read-path consolidation + the reaper
> guarantee). `tsc` + `npm run build` clean · **331 tests green** (+12 resolver, +2 reaper
> guarantee). **Deployed to the box** (api rebuilt; "No pending migrations"; health 200) +
> **verified live** via a minted-JWT pass: windowed discover (11 buffer pins resolved through
> `resolveClipAxes`), `?at=` (7), tiled cell (counts), `GET /buffer/me/clips` (200 authed),
> `GET /buffer/session/:id` (200, title + identity resolved). All 200, behaviour-preserving on
> real data. *(The resolver's OVERRIDE — anon/precision/title changing the output — is unit-tested;
> live data is external-cam buffer sessions with no clipId=null directives yet, so the on-device
> proof is Ben editing a segment + watching it proliferate to pin/viewer/library identically.)*
> Detail in `wrld-backend/CLAUDE.md` "CU1 — one clip-axes resolver". What landed:
> - **`src/lib/resolveClipAxes.ts`** — the ONE pure resolver returning the LOCKED `ResolvedAxes`
>   `{ title, tags[], visibility:'public'|'private', identity:'shown'|'anon',
>   precision:'exact'|'city'|'country'|'private', sources, keep:'kept'|'reapable' }`. Authority =
>   `clipId=null` session directives at the queried instant T; clip/stream = read-fallbacks.
>   `precision:'private'` = the location-hidden (legacy 'off') state.
> - **Every read path routed through it:** windowed/tiled + legacy `?at=` discover buffer pins,
>   `GET /clips/:id`, `GET /buffer/me/clips`, `GET /buffer/session/:id` (the last now honours **anon**
>   too — closes the #13 buffer-viewer gap). Behaviour-preserving where the deployed code already
>   coalesced; adds the full-axis plumbing CU2 reads.
> - **Reaper guarantee:** a `retain:true` `clipId=null` directive + its `BufferSession` row survive
>   retention (never cascade-cleaned) — additive + inert today (no clipId=null retain rows exist yet),
>   the foundation CU3's lane-as-a-directive retain builds on.
>
> **➡️ CU2 (Ben) IS GO NOW — CU1 is live on the box.** Build `resolveClipSettings` as the thin
> pass-through over the server's `ResolvedAxes`, route EVERY surface's reads through it (the "CU2 —
> app surface work-map" table above is the mechanical change), and **delete the `patchClip`
> dual-write** + the clips-page `clipId`-vs-session routing in `onSheetChange` (CU1 resolves
> `clipId=null` as the single authority, so the library/viewer/pin all read the same value). Collapse
> `SavedClipSettingsSheet` into the one `SegmentSettingsSheet` host. **On-device proof of CU1 you can
> watch:** edit a segment's title / blur / anon on the clips page → it proliferates IDENTICALLY to the
> time-machine pin, the clip viewer, and the library (live data today is external-cam buffer sessions
> with no per-segment directives yet, so the override only shows once you make one). Backend `git
> be1e9c5` (`wrld-backend/main`).

---

## CU2 — app progress (2026-06-26, on CU1 `be1e9c5`)

CU1 is live: `resolveClipAxes` (authority `clipId=null` at T) populates the existing response fields
on every read path (discover pins, library, viewers, buffer-session) — so the app's existing reads
now get RESOLVED values. A clips-page edit (which writes `clipId=null`) proliferates to the time
machine **without an app read change**. CU2 is the write/drawer unification:

- ✅ **Dual-write deleted.** `ClipsScreen.onSheetChange` now writes ONLY the `clipId=null` directive
  (`applySegSetting` → `patchSessionDirectives`); the `patchClip` `Clip.*` sync is gone (CU1 reads
  `clipId=null ?? Clip.*`, so it was redundant). The clips page is a pure authority writer. tsc clean.
- ⏳ **Library drawer → authority (next).** `SavedClipSettingsSheet` still writes `Clip.*` via
  `patchClip` — works via CU1's fallback for library-only edits, but a clips-page edit on the same
  range would mask it. Switch it to write the `clipId=null` directive (`useBuffer` session directives
  + `segmentSettings` merge + `patchDirectives`); the two hosts then share one write path. (The
  `SegmentSettingsSheet` UI is already the single drawer; the hosts differ only because the clips page
  shares its `settingsRanges` with the timeline carve — so "one host" stays two hosts, one write.)
- 🚩 **CU1 residual for Aaron:** `GET /buffer/me` (the buffer descriptor's `session.title`, read by the
  clips-page BUFFER-lane timeline label) was NOT routed through `resolveClipAxes` — still raw
  `stream.title`. Route it too so the buffer-lane label resolves (minor; discover + viewers covered).

---

## CU1 COMPLETENESS — two backend gaps from on-device CU2 testing (2026-06-26, Aaron)

Device test (Ben): a clips-page edit (which writes the `clipId=null` directive over the clip's range)
updates everything that reads `GET /buffer/me/clips` (saved lane, library, library-drawer title) but
**NOT the time machine or the buffer-lane timeline label**. Root cause is in CU1's read routing:

1. **Windowed/tiled discover resolves at the wrong instant — ✅ DECIDED (a), 2026-06-26.**
   `windowAvailability` calls `resolveClipAxes(sessionAxes, intervals[0].startMs, …)` — the session's
   **first public interval** (≈ session start / warm-up). Edits live on the **clip's range** (later
   than `intervals[0].startMs` whenever the session has leading footage) → the covering directive at
   that instant is pre-edit/empty → the pin resolves stale. (The `?at=` path is correct —
   `resolveClipAxes(atSessionAxes, Tms)`, the playhead.) A window feed has **no single T** (it's a
   window the app scrubs within), so resolving server-side to one value can't reflect the playhead.
   The contract amendment:
   > **CONTRACT AMENDMENT (2026-06-26): window/tile feeds return the per-range directives, NOT
   > pre-resolved axes; the app resolves at the playhead. Single-instant reads (`/clips/:id`,
   > `/buffer/me/clips`, `/buffer/session/:id`, `?at=`) keep returning `ResolvedAxes` server-side.**
   - **Aaron — ✅ DONE + DEPLOYED + VERIFIED (2026-06-26, `wrld-backend 7d09d78`).** Every
     windowed/tiled discover pin (`AvailClip` + `AvailBufferPin`, so the `?from&to` feed AND the
     `?planet&t&z&x&y` tiles) now carries **`directives: PinDirective[]`** = the per-range display
     subset overlapping the feed window: `{ startMs, endMs, title, precision, attributed }`. Sourced
     from the session's `clipId=null` rows (`fetchDiscoverDirectives` `sessionAxes`; clip pins source
     from their session too). **Realized-shape notes for your wiring (read these):**
     - It's the **display subset**, NOT the full `AxisDirective` — only `title/precision/attributed`
       (the axes a pin renders). **Coords + host stay PIN-LEVEL and server-obfuscated** (the pin's
       `lat/lng/locationPrecision/host`), because re-obfuscating coords / un-anon'ing a host
       client-side would need the real values we never send → so per-range PRECISION→coords and
       host-identity stay resolved server-side at the pin level; **`directives` drives `title` (the
       reported bug) + lets you HIDE the pin's host during an `attributed:false` era at the playhead.**
     - I **kept** the pin-level resolved `title`/coords/`host` as the **fallback** (didn't "drop that
       resolve") — it's the correct single-era value and what you use when **`directives` is `[]`**
       (no per-range edits → today's behaviour, zero regression). So: **`directives.length ? resolve
       at playhead : use the pin-level fields`.**
     - Single-instant reads (`?at=`, `/clips/:id`, `/buffer/me/clips`, `/buffer/session/:id`) are
       **unchanged** — they still return resolved axes.
   - **Ben/app (CU2 follow-on, mine):** for a pin with non-empty `directives`, resolve the displayed
     **title + identity** at the **playhead** — `directives.find(d => playheadMs ∈ [startMs,endMs))`,
     then `d.title ?? pin.title` and hide the host when `d.attributed === false`. (precision/coords =
     the pin-level value — see Aaron's note.) Empty `directives` → render the pin-level fields as
     today. The app already computes the playhead + which interval is alive locally. **Verify on
     device:** edit a later segment's title/anon on the clips page → the time-machine pin reflects it
     as the playhead crosses that era (live data is external-cam sessions with empty `directives`
     today, so the override only shows once you make a per-range edit).
   *(The "pin COVERAGE nuance" from "CU1 — THE PEDANTIC DETAIL" §D.)*
2. **Buffer-lane timeline label — ✅ REASSIGNED to app (Ben), NOT Aaron.** `GET /buffer/me` ALREADY
   returns each `session.directives` (the clipId=null rows the clips page seeds `settingsRanges` from),
   so the app can resolve the buffer-lane label itself —
   `resolveClipSettings(session.directives, segmentStart).title ?? session.title` — no backend change.
   (Was filed as an Aaron routing item; the data's already on the wire.)

Write side is unified (clips page + library both write `clipId=null` after CU2 step 2). After the
amendment, **#1's backend half is ✅ DONE + DEPLOYED (`7d09d78`) and Aaron has no remaining
read-routing work** — both #1 (app: resolve pin title/identity at the playhead from `directives`) and
#2 (app: buffer-lane label from `session.directives`) are now app-side; the single-instant reads
already return `ResolvedAxes`.

### ✅ CU1 COMPLETENESS — DONE end-to-end (Ben, app side, 2026-06-26)
- **#1 app:** `resolvePinAxes(directives, playheadMs, { title })` in `src/api/clips.ts` (returns
  `{ title, anonymous }`); `GlobeScreenMapbox.resolveClip`/`resolveBuffer` override the pin's **title**
  + swap in the **Anonymous host** on an `attributed:false` era at the playhead. **Precision + coords
  stay pin-level** (per Aaron's realized-shape note — resolving precision client-side over pin-level-
  obfuscated coords would leak; identity only ever HIDES, never reveals). `clipPins`/`bufferPins`
  memos keyed on a signature encoding the resolved title/host → referentially stable across the 1s
  ticker (no card-sync loop). Empty `directives` → pin-level fields (zero regression).
- **#2 app:** `bufEntry` resolves the buffer-lane label via `settingsAt(session.directives, …)`.
- **Single-instant reads (Aaron, deployed):** `GET /clips/:id` (clip start) + `GET /buffer/session/:id`
  (session start) route through `resolveClipAxes` → BUT see #3 below — they resolve at the **raw
  start**, which is the SAME stale-instant bug #1 fixed for the pin.

**Net:** a clips-page / library-drawer edit now proliferates to saved lane · library · buffer-lane
label · clips-page viewer · **time-machine pin (title/identity playhead-resolved)**. The time-machine
viewer's **backend** now resolves at the playhead too (#3 ✅ below) — **app just needs to pass `at`**.

### #3 — Time-machine VIEWER resolves at the raw start (Aaron — the symmetric #1 fix). On-device 2026-06-26.
Device test (Ben): the time-machine **pin label updates** (title + identity, playhead-resolved) but the
**viewer it opens is stale**. Same root cause as #1, now on the single-instant viewer reads:
- `GET /buffer/session/:id` → `resolveClipAxes(axisDirs, **startAtMs**, …)` (session start)
- `GET /clips/:id` → `resolveClipAxes(sessionAxes, **startMs**, …)` (clip start)

The raw start **precedes the edited range** (encoder warm-up / leading footage / a later-segment edit),
so the covering directive at that instant is empty → it falls back to `stream.title`/`clip.*` → stale.
The pin avoids this by resolving at the **playhead** (inside the footage). This is **backend
read-routing — the viewer half of #1.** The app CANNOT fix it alone: these reads return resolved
scalars, not the directives.

**Contract (symmetric with #1):** the **app passes the viewed instant** (`?at=<absoluteMs>` — the
time-machine playhead at tap, = `clip/session.startAtMs + seekSec`), and the backend **resolves axes at
`at`** (clamped to the clip/session range) instead of the raw start; absent `at` → today's start
behaviour (no regression).
- **Aaron (backend) — ✅ DONE + DEPLOYED + VERIFIED (2026-06-26, `wrld-backend 60f7c5f`).** Both
  `GET /clips/:id` and `GET /buffer/session/:id` accept an optional **`?at=<absoluteMs>`** and resolve
  the axes there, **clamped to the clip/session range** (`/clips/:id` → `[startAtMs, endAtMs]`;
  `/buffer/session/:id` → `[session start, endedAt|now]`). Absent/invalid `at` → the raw start (today's
  behaviour, zero regression). Verified live: `?at=` accepted + clamped (mid-window / 0 / far-future /
  garbage all 200) + regression-free (same title with/without `at` on the no-edit prod sessions); the
  per-instant override is unit-tested (`resolveClipAxes` "resolves PER INSTANT"). **Note:** these reads
  still return resolved SCALARS (not directives) — single-instant, per the contract; only the
  window/tile PINS carry `directives` (#1).
- **Ben (app) — ✅ DONE (2026-06-26).** `clipsApi.get(id, atMs)` / `getBufferSession(id, atMs)` append
  `?at=`; `GlobeScreenMapbox.watchHistorical` passes `at: playheadMs` (the absolute instant tapped, which
  it already has — simpler than `start + seekSec`); `ClipViewerScreen` reads `at`, threads it into the
  query + keys on it (`['clip', source, id, atKey]`, so the edit-invalidate `['clip']` still prefix-
  matches). Non-time-machine viewer entries omit `at` → raw-start resolution (unchanged). **Verify on
  device:** edit a later segment's title/anon → open its time-machine viewer at that era → the viewer
  chrome reflects the edit (live prod data is no-edit external cams, so the change only shows once a
  per-range edit exists — same as the pin).

Minimal-fix alternative (no app change): resolve at a **footage-interior** instant (e.g. the first
public interval start, like the pin's pin-level fallback) instead of the raw start — fixes whole-clip /
first-era edits, but a later-segment edit still won't match the scrubbed instant. The `at`-param
contract is the model-true one (the viewer's chrome tracks the era you're watching, exactly like the pin).

### #4 — Sources axis → the saved-clip VIEWER rail (Aaron, backend-only; app already wired). 2026-06-26.
The last per-axis proliferation gap. Toggling a source OFF on a segment should hide it from the
time-machine **viewer rail**. The **buffer-session viewer** already does this — `GET /buffer/session/:id`
returns **`sourceWindows: [{startAtMs, endAtMs, sources}]`** (`wrld-backend buffer.ts` ~L3413) from the
session's per-range `sources` directives, and the app filters the rail by the window covering the
playhead. The **saved-clip viewer** (`GET /clips/:id`) does **not** return `sourceWindows` — it lists
`tracks where enabled:true` only, so a per-range source toggle never reaches the clip rail.
- **Aaron (backend) — ✅ DONE + DEPLOYED (2026-06-26, `wrld-backend 2dab272`).** `GET /clips/:id` now
  returns **`sourceWindows: [{startAtMs, endAtMs, sources}]`** (same shape as the buffer route) on
  **both** response paths (retain-in-place + copied), built from the clip's **authority** per-range
  `sources` directives: the `clipId=null` SESSION rows (live, retain-in-place), falling back to the
  clip's frozen `clipId`-set rows (a copied clip whose buffer session evicted). Only ranges carrying a
  `sources` map are windows; not clipped (the app reads the window covering the in-clip playhead). No
  `?at=` — per-range list, resolved app-side. tsc + build clean; 335 tests green. **Verify note:** no
  prod `Clip` rows exist to exercise the field live (same data limitation as #1/#3 — `discover.clips`
  empty platform-wide); it's additive + mirrors the proven buffer-route logic, so the on-device proof
  (below) is Ben's.
- **Ben (app) — ✅ NOTHING TO DO (verified 2026-06-26).** `ClipDetail.sourceWindows` already exists
  (`src/api/clips.ts` L134); `ClipViewerScreen` already (a) finds the `activeWindow` covering the
  playhead, (b) filters `availableViews` by `activeWindow.sources[bk] !== false` (identity always kept),
  and (c) auto-switches via `pickDefaultView` when the viewed source vanishes. `clipsApi.get` returns
  `res.data.clip` verbatim, so a `sourceWindows` field flows straight onto `ClipDetail`. The rail lights
  up the moment the backend returns the field — zero app change, zero rebuild.
- **Verify on device (after deploy):** toggle a source off on a segment → open its time-machine viewer
  at that era → the source is gone from the rail (and the view auto-switches if it was selected).
  **✅ VERIFIED ON DEVICE (Ben, 2026-06-26).**

---

## ✅ CU1 COMPLETENESS — 100% DONE + VERIFIED ON DEVICE (2026-06-26)
All four read-routing gaps from the on-device CU2 testing are closed end-to-end across both repos and
verified on device by Ben. Every clip axis now proliferates from the one `clipId=null` directive
authority to every surface, resolving consistently at the watched instant:

| # | Surface / axis | Backend | App | Verified |
|---|---|---|---|---|
| 1 | time-machine **pin** title/identity | `7d09d78` | `resolvePinAxes` @ playhead | ✅ |
| 2 | **buffer-lane** label | (directives on `GET /buffer/me`) | `sessionTitleAt` | ✅ |
| 3 | time-machine **viewer** axes | `60f7c5f` (`?at=`) | viewer passes `at` | ✅ |
| 4 | **sources** → saved-clip viewer rail | `2dab272` (`sourceWindows`) | already wired | ✅ |

Plus the write side is unified (clips page + library both write `clipId=null` via the shared
`src/lib/clipDirectives.ts` core). **What's left is the coordinated rearchitecture only** — CU3
(lane-as-axis + live edges), CU4 (structural collapse + clean rename + one discover feed), CU5 (delete
the fallbacks). Solo CU-prep available meanwhile: ✅ shared directive-edit core (done); ☐ one canonical
clip type (dep-free); ☐ one drawer host (dep: backend #12 — visibility/tags on the library read).

---

## CU3 / CU4 KICKOFF (2026-06-26) — ACTIVE

CU1 + CU2 are done + device-verified (above). Kicking off the structural phases. Same coordination
discipline as CU1: **lock the contract decisions first** (recommend → Ben/Aaron confirm), then build in
parallel lanes. CU3 first (lane-as-axis + live edges, parallels nothing left); CU4 (structural collapse
+ rename) once CU3 proves the model on device; CU5 deletes the old.

### CU3 — Lane as the 7th axis + live edges

**The goal.** `keep`/`lane` becomes a real `DirectiveRange` axis the reaper reads as its **single**
retain signal (collapsing today's 3 OR'd signals: live-tail · saved-region · `BufferSession.lane`).
Every live edge — go-live lane · snip-at-now · reaper · storage-cap · AV-pause/resume — writes the ONE
unified directive model. Then all 7 axes are equal (title/tags/visibility/identity/precision/sources/
**keep**), live editing rides the one model, and every edge is forward-only.

**Contract decisions to lock (recommend → confirm):**
- **D1 — Retain authority = `DirectiveRange.retain`.** The reaper survives a range iff a `retain:true`
  directive pins it (or it's the live tail within the window). Collapse the 3 OR'd signals to this one.
  *(retain-in-place, PB2 — saving is a `retain` flag, not a byte copy.)* → **Aaron.**
- **D2 — Go-live lane → the opening range's `retain` directive.** App keeps sending `lane` in
  `createRoom` (U1); Aaron's engine writes the initial `retain:true` directive over the opening range
  instead of stashing `BufferSession.lane`. (Atomic at go-live, minimal app change.) → **Aaron** (app
  unchanged for go-live).
- **D3 — Save / un-save = a `keep` axis edit on the directive** (drop the bespoke
  `saveClip`/`unsaveClip` + the edge-relative `fromReaperEdge`/`toNow` save endpoints). The clips-grid
  drag-to-save + the drawer Lane toggle → `persistDirectives` with `retain` set on the range; the
  reaper-edge "save the remainder" → a `retain` directive clamped server-side. *Dep: D1 live.* →
  **Ben (app)** writes it via `clipDirectives`; **Aaron** drops the copy-path + the bespoke endpoints.
- **D4 — snip-at-now (U2) + AV-pause/resume (U4) confirm-unified.** U2 already snips via `snipSession`
  (a directive write) ✅; U4's `setSourcePaused` writes a `sources` directive snip. Confirm both route
  through the unified write (no separate state). → **Aaron** (mediasoup/backend) + **Ben** (the AV-rail
  pause control, if not already a directive write).

**Work-orders:**
- **Aaron (backend + mediasoup):** D1 reaper-reads-`retain`-only (collapse the OR'd signals); D2 go-live
  writes the initial retain directive from `lane`; D3 drop the copy-path + `saveClip`/`unsaveClip`/
  edge-relative endpoints (save = a `retain` directive); D4 AV-pause → sources directive. Each
  independently shippable + device-verifiable.
- **Ben (app):** add **`keep: 'kept' | 'reapable'`** to `SegSettings` + the drawer's Lane toggle writes
  it via `persistDirectives` (the `clipDirectives` core already centralises the write); the clips-grid
  **drag-to-save / lane toggle** → a `keep` directive edit (retire the bespoke `saveClip`/`unsaveClip`
  calls); wherever the app reads `BufferSession.lane` / `captureConfig.lane` for display, read the
  resolved `keep` axis instead. **Dep: D1/D3 backend live.** Until then the app's U1 `lane`→`createRoom`
  + U3 edge-relative save stay as-is (they work; CU3 unifies their write path, not their behaviour).

### CU4 — Structural collapse (clip ≡ segment) + clean rename
Deferred until CU3 proves the model on device. **Aaron:** schema collapse (`Clip` + `ClipRange` +
`DirectiveRange` + `ClipTrack` → one `Clip = range + axes` over `Track`); one discover feed (retire the
legacy/windowed/tiled split); the rename (`precision`/`identity`/`keep`/`source`/`Track`; drop
`locDisplayPrecision`/`locationPrecision`, bool `attributed`, `lane`, `splitPoints`, stale
`motion`/`temp`); backfill. **Ben (app, dep-free prep can start now):** the **one canonical clip type**
— collapse `LaneClip`/`SavedClip`/`ClipPin`/`BufferPin`/`ClipDetail` toward one canonical `Clip` + 7-axis
`ResolvedAxes` + per-surface adapters, so "same element everywhere" is type-enforced. Done as a contained
slice (define the type + adapters, migrate one surface to prove it), NOT a big-bang. The shared
`clipDirectives` core + `resolvePinAxes` are the first pieces of this consolidation.

> **💡 CU4 design option to weigh before locking the schema — "materialized segments / resolve-at-write" (Ben, 2026-06-26, LIGHT log).**
> Instead of CU4's *resolve-at-read* (a clip's axes may be `null` → inherit the go-live default via a
> fallback chain), make every **Segment fully self-contained**: all 7 axes carry concrete values, no
> nulls, no inherit. Then:
> - **the resolver disappears** — a read is just `segment.field` (no `resolveClipAxes`, no fallback);
> - **kills the `null`-inherit bug class** (the CU3 D1 shadowing bug was exactly an inherit/coverage issue);
> - **snip = copy** the segment into two (ranges split); **mend = pick a winner WHOLESALE** (not per-field;
>   span → `[min start, max end]`; survivor's id persists);
> - **forward-only falls out for free** (each segment is an independent copy — editing one never touches another).
> Trade: resolve-at-write means a one-time **backfill** (materialise existing inherited values) + each
> segment stores its own 7 scalars (negligible). **Boundary:** footage stays SHARED under the recording —
> segments are time-ranges *pointing into* the same files; **snip/mend move ZERO bytes** (pure metadata).
> Net: the cleanest end-state — drop the inherit columns + the resolver. Revisit at the CU4 schema-lock.
>
> **Sharper framing (Ben, 2026-06-27) — "one full standalone rule object per era, always":** the rules
> layer mirrors the data layer per-era — **every era has its own complete on-disk rule object** (the 7
> flags), created at go-live and split on snip. **No snips → ONE rule object; one snip → two eras → two
> rule objects, even if their flags are identical** (no coalescing-away of identical neighbours; that's
> the whole standalone point). Each is cheap (just flags). Caveats: rules are NOT a continuous
> byte-stream like footage — it's one small row per era (the open era's end tracks the live edge; a snip
> mints the second). This **generalises D2** (which already writes the opening `retain` directive at
> go-live, but only for saved-lane) to: **always write a full opening rule object at go-live, for every
> broadcast, split on snip.** Complements but does NOT substitute for the reaper's interior-eviction fix
> (the reaper already knows per-era reap; materialising the rules doesn't punch the footage hole — see
> "D3 RE-GATE FINDINGS").

> **💡 Possible future simplification (beyond CU4) — "live gates = the live-time read of the same rules" (Ben, 2026-06-26, LIGHT log).**
> Today `Stream.subscribersOnly` (who may watch LIVE) and a clip's `visibility` (who may watch the
> REPLAY) are stored **separately** — but they're conceptually **one rule** ("who may watch this
> content?"), just **enforced at two moments**: in real time at room-join during the broadcast, and at
> read-time on every replay. The dashboard sets the value; it gates the live room; the same value seeds
> + then governs replay. So the `Stream`'s access fields could be understood as the **live-time read of
> the one rules layer**, not a separate store. **Asymmetry to respect:** the live read is *frozen
> history* once the broadcast ends (you can't re-gate a moment that already happened); the replay read
> stays editable forever. **Not in the CU plan** — a clean post-CU4 cleanup candidate (collapse the
> Stream access fields into "the rules, read live"). Logged so it's on the table.

### First moves (this kickoff)
- **Aaron:** D1 (reaper reads `retain` only) — the CU3 spine; unblocks D2/D3.
  **✅ DONE + DEPLOYED INERT (2026-06-26, `wrld-backend 8ddf95a`).** The reaper now collapses its 3
  OR'd retain signals to the single `DirectiveRange.retain` authority — **flag-gated `CU3_RETAIN_ONLY`,
  default OFF → byte-for-byte today's behaviour** (data-sensitive; PB2 cutover discipline). When ON,
  each pass first **backfills** `retain:true` clipId=null directives for every legacy-protected range
  (a saved clip's ClipRange → `[start,end]`; a saved-lane session → `[start, endedAt ?? OPEN]` covering
  the live tail; idempotent), then protects from `DirectiveRange.retain` ONLY — so the cutover loses no
  footage. migration `20260626050000` seeds the flag (admin-tunable); `backfillRetainDirectives` +
  `cu3RetainOnly.test.ts` (3 DB tests); 338 green; deployed inert (migration applied, flag OFF).
  **⛔ The flip is the on-device cutover gate (NOT done): flip `CU3_RETAIN_ONLY` on `/admin/config`,
  tighten a tier window to force a reap, and prove (a) a saved clip and (b) a saved-lane go-live both
  survive under retain-only, AND non-retained past-window footage still reaps — BEFORE leaving it on.**
  **D2/D3 are now unblocked:** D2 = go-live writes the initial `retain` directive from `lane` (retires
  the saved-lane backfill); D3 = save/un-save = a `retain`-axis directive edit (drop the copy-path +
  `saveClip`/`unsaveClip`/edge-relative endpoints — retires the ClipRange backfill). Ben's `keep`-axis
  drawer + drag-to-save retirement still wait on **D3 backend live** (D1 alone doesn't change the app's
  write path).
- **Ben (app, parallel, dep-free):** the **canonical clip type** (CU4 app prep).
  - **✅ slice 1 (2026-06-26):** `src/types/clip.ts` — the one `CanonicalClip` = range + 7-axis
    `ResolvedAxes` (§5/backend vocab) every surface projects to, the editable↔resolved vocab bridge
    (`off`↔`private`, `attributed`↔`shown`), and **compile-proven adapters** `fromClipPin`/
    `fromBufferPin`/`fromClipDetail`/`fromSavedClip` (each typechecks as a faithful projection — the
    proof). First runtime migration: `SavedClipSettingsSheet`'s seed reads its scalar axes via
    `fromSavedClip` + the bridge (behaviour-preserving). `LaneClip` adapter + the remaining surface
    migrations are the next slices.
  - **✅ slice 2 (2026-06-26):** `fromLaneClip` added — **all 5 surfaces** (ClipPin/BufferPin/
    ClipDetail/SavedClip/LaneClip) now **compile-prove** as `CanonicalClip` projections (the foundation
    is total). Local-only commits `64b0da0` etc. (holding pushes until Aaron's D1 lands).
  - **next slices (need device testing or a decision — paused until we resume pushing / D1 lands):**
    - **Discovery pins** (`clipToStream`/`bufferPinToStream`): **✅ slice 3 DONE (2026-06-26, local
      `b4f44ed`).** `CanonicalClip` gained the optional `access` projection (Aaron-confirmed);
      `fromClipPin`/`fromBufferPin` populate it; both globe mappers now route through one
      `canonicalToStream(fromClipPin/fromBufferPin(...))` — two mappers collapsed to one canonical path,
      behaviour-preserving. **OWES A DEVICE CHECK** on the time-machine pins/cards (#1 — title/anon/
      precision halo/subscription badge) when we resume pushing. (Original decision note kept below.)

      **ACCESS-FIELDS DECISION (recommendation, 2026-06-26 — confirm at CU4):** the buffer pin carries
      `subscriptionPriceUsd` · `accessTier` · `ppvEventId`. These are **NOT clip content axes** — §5
      defines a clip as range + the **7** axes (title/tags/visibility/identity/precision/sources/keep);
      monetization/access is "who may watch," derived from the host's subscription settings + the
      stream/clip gate, orthogonal to the content. **Recommend: keep the 7 axes pure; add an OPTIONAL
      `access` projection on `CanonicalClip`** (sibling to `axes`, NOT inside it), populated only by the
      discovery adapters, absent on library/viewer projections:
      ```ts
      access?: {
        tier: 'public' | 'subscriber' | 'ppv'       // BufferPin.accessTier; clip pin → from subscribersOnly
        subscriptionPriceUsd?: number | null         // host's price (card "Subscribers only · $X/mo")
        ppvEventId?: string | null
      }
      ```
      `subscribersOnly: boolean` stays a top-level resolved gate (already present, widely read). The
      `clipToStream`/`bufferPinToStream` unification then routes through `canonicalToStream(canon)`,
      mapping `access.subscriptionPriceUsd → host.subscriptionPriceUsd` etc. — behaviour-preserving.
      Rationale: keeps `ResolvedAxes` exactly the §5 seven (so CU4's schema collapse stays clean — the
      axes become columns; access stays its own concern), while letting `CanonicalClip` fully represent
      a discovery pin so every surface (incl. discovery) is one shape. *Alternative considered + rejected:
      folding access into the axes — pollutes the §5 seven and conflates content with entitlement.*

      **→ Aaron (backend / CU4-schema owner): ✅ CONFIRMED (2026-06-26).** Adopt the recommendation —
      the optional `access` sibling, NOT in the axes. **This is already how the backend is structured,
      so it's the low-friction, model-true choice:** `resolveClipAxes` returns *exactly* the §5 seven
      (`title/tags/visibility/identity/precision/sources/keep` — no access fields), and the discover
      feeds compute `accessTier`/`subscriptionPriceUsd`/`ppvEventId` **separately**, DERIVED from
      `subscribersOnly` (the gate) + the `PpvEvent`/host-subscription joins — access is "who may watch,"
      not clip content. So the app `access` projection just mirrors what the wire already carries.
      **At CU4 the schema collapse stays clean:** the 7 axes become `Clip` columns; access stays its own
      concern (the `subscribersOnly` gate + the host-subscription/`PpvEvent` derivation — never an axis
      column). No backend change needed now (the discover pins already return the access fields beside
      the axes) — this unblocks Ben's discovery-pin migration slice.
    - **Viewer chrome** (`fromClipDetail`) + **clips-grid `LaneClip` runtime**: behaviour-preserving but
      on verified/high-churn code → do with a device pass.
  - The CU3 app pieces (the `keep` axis in the drawer + retiring the bespoke save flow) wait on D1/D3.

### On-device observations during the D1 gate (Ben, 2026-06-26) — both are pre-unification seams CU3 closes
1. **Go-live-to-saved starts in the buffer lane, then flips to saved.** Cosmetic live-build lag — the
   optimistic live block renders before the real session's `lane='saved'` loads. **App, Ben's lane,
   deferred** (smooth by reading `captureConfig.lane` on the live block immediately). No data effect.
2. **"Printed to saved" doesn't show in the Library; "dragged to saved" does.** EXPECTED pre-D3:
   drag-to-save creates a durable **Clip** (→ Library); a saved-lane go-live only marks the *session*
   `lane='saved'` (retained, won't reap) but **doesn't materialise a Clip** → it lives in the clips-grid
   saved lane, not the Library. **→ Aaron: this is U3** — materialise a saved-lane (`keep`) range into a
   durable Library clip (+ quota), so "printed to saved" and "dragged to saved" surface identically. Folds
   into D3 (save = the one `keep` directive). *(Test note: verify saved-lane survival in the **clips grid**,
   not the Library.)*

### D1 CUTOVER GATE — RESULTS (Ben + Aaron on-device, 2026-06-27; playback/disk signal)
Re-ran with the corrected signal (playback "won't play" = reaped, not timeline presence). **Verdict:
the retain-only MECHANISM is proven; un-save is confirmed not-yet-wired (D3); + one new ghost-block bug.**

1. **✅ MECHANISM PROVEN.** Broadcast→buffer, saved half snipped into shown/anon eras → the **unsaved
   half was evicted** (gone), the **saved eras survived**, and the **per-range shown/anon edits were
   honored in the time machine**. So under `CU3_RETAIN_ONLY` ON: save protects · unsaved reaps · edits
   don't shadow. D1 + D2 work; the cutover *read* side is safe.
2. **🔴 Findings 2 + 4 = ONE bug: un-save isn't wired (the D3 gap, expected).** Broadcast→**saved lane**,
   snip, drag half to **buffer** → that half (a) was **NOT evicted** (#2) and (b) **reappeared in the
   saved lane** on reload (#4). Root cause: **D2 writes a `retain:true` directive at go-live, but
   un-save still uses the legacy path and never clears it** — so the stale `retain` keeps the half alive
   and the persisted truth re-renders it saved. **This is exactly what D3 builds.**
   → **D3 spec (sharpened): un-save (drag saved→buffer) must DURABLY flip the dragged range's
   `retain` → false** (Aaron backend: clear/split the retain directive over that range + drop the
   bespoke un-save endpoint; Ben app: drag-to-buffer writes the `keep` directive via `clipDirectives`).
3. **🔴 NEW BUG — ghost block + thumbnail for reaped footage (separate from CU3).** After expanding the
   window, the **correctly-evicted** buffer section reappeared as a **block with a thumbnail but no
   playable content**. The clips grid builds blocks from session *metadata* (start/end + stored
   thumbnail), not from *surviving* segments → a partially-reaped session draws a **ghost** where the
   footage is gone. Should render as a **gap / eviction edge**, no thumbnail.
   → **Fix: Ben** (clips grid: reaped ranges → gaps, no thumbnail for evicted footage) **+ Aaron**
   (`GET /buffer/me` reports each session's *surviving* range so the app knows where the hole is).
   Data-safe (footage IS gone — only the UI lies); clips-grid eviction-UX correctness.
   → **✅ DONE (2026-06-27).** **Aaron** (`wrld-backend 70a39c9`): `GET /buffer/me` reports
   `survivingStartMs`/`survivingEndMs` per session (the on-disk media window; head shrinks as the
   reaper eats; `null` = data-only) + drops `thumbnailUrl` when nothing survives. **Ben** (app):
   `BufferSession` gains the two fields; `sessionStartMs`/`sessionEndMs` now bound the buffer block by
   the surviving range (reaped head → gap; fully-reaped → zero-width → no block; thumbnail already
   nulled). Falls back to the full media bounds on an older backend / data-only. **Owes an on-device
   pass** (touches the clips-timeline carve + live build): confirm a reaped head renders as a clean
   gap/edge and a fully-reaped session shows no ghost.

**Flag decision:** the *read* side is proven, but with the flag ON **un-save is broken until D3**. So
**flip `CU3_RETAIN_ONLY` back OFF on the box for now** (un-save keeps working via the legacy path — no
regression), Aaron builds D3 + Ben wires the app un-save, **re-run this gate with D3 in place, then flip
ON for good** as part of the D3 cutover. The gate did its job: D1+D2 retain-only read proven; D3 confirmed
as the required next piece.

### ⮕ Aaron's response (2026-06-27)
- **⚑ FLAG = OFF (confirmed Ben, 2026-06-27).** `CU3_RETAIN_ONLY` history: ON for the first gate → OFF
  (2026-06-26) → ON for the 2026-06-27 re-gate (surfaced the interior-eviction "dam" bug below) → **✅
  back to OFF now** (safe 3-signal reaper). Re-flip ON only **after** the reaper interior-eviction fix +
  a clean re-gate (and heed "no-flip-back once real retain-only saves exist").
- **✅ Ghost-block, BACKEND HALF DONE + DEPLOYED (`wrld-backend 70a39c9`).** `GET /buffer/me` each
  session now reports **`survivingStartMs` / `survivingEndMs`** — the media footage window still on
  disk (`[startedAt + mediaStartOffsetMs, + mediaDurationSec]`; the reaper eats from the left → the head
  shrinks, can collapse to empty = fully evicted; `null` for a data-only session). And **`thumbnailUrl`
  is dropped when no media survives** (a fully-reaped camera session kept its `kinds`/BufferTrack rows
  but has no frame on disk → the poster was the ghost). **→ Ben (app render half):** build the clip block
  only over `[survivingStartMs, survivingEndMs]`; render `[startedAt, survivingStartMs)` (+ any tail) as
  a **gap / eviction edge**, no thumbnail; treat empty/`null` surviving range as "no media → gap" (not a
  block). Data-safe — footage IS gone, only the UI lied. On-device verify owed (a partially-reaped
  session → gap, no ghost). **⚠️ EXTENDED by the re-gate (below): a single `[start,end]` window can't
  represent INTERIOR holes (interleaved saved/buffer) — `survivingStartMs/EndMs` must become a
  `survivingRegions` LIST, and the render draws a block per region with interior gaps. See "D3 RE-GATE
  FINDINGS."**
- **✅ D3 — contract + foundation + side-effect DONE (superseded the "ready to build" note here).** The
  Library decision is locked (**option a** — keep materialising a `Clip` row); the contract is confirmed
  (single write path = `retain` on the directive); the keep-axis round-trip (Ben) + the side-effect
  (Aaron `f6fa2fa`: materialise/remove the retain-in-place Clip on the retain delta + storage cap) are
  deployed; **step 1 (drag-to-save via `patchDirectives`) is built + device-verified.** **➡ CURRENT D3
  work is in "D3 RE-GATE FINDINGS" below** (the reaper interior-eviction "dam" bug + surviving-regions),
  plus: **Ben** — step 1b (un-save → `keep:'reapable'`) + step 2 (render-by-keep); **Aaron** — drop the
  bespoke `saveClip`/`unsaveClip` once the app's fully on `patchDirectives`, then **re-gate → flag ON**.

### D3 RE-GATE FINDINGS — interior eviction (the "saved-segment dam") + surviving-regions (Ben+Aaron device, 2026-06-27, flag ON)
On-device re-test with the unified write (step 1) + flag **ON**. Setup: one buffer go-live, snipped into
4 segments; **#2 + #4 dragged to saved** (retain via the unified `patchDirectives` path); **#1 + #3 left
buffer**; #4 prefs → city/anon; reaper run.

**✅ Confirmed working:** step 1 (drag-to-save via `patchDirectives` → #2/#4 saved + protected + in the
time machine), eras carry through + the pin label updates as you scroll the clock, **no double-flash** on
save. #1 evicted (disk-confirmed gone).

**🔴 The bug — the reaper does NOT evict an INTERIOR unretained segment (a DATA-layer mechanics gap):**
#3 (buffer, no retain, past-window, between saved #2 and #4) **was not evicted** — disk-confirmed still
present; it genuinely plays; it wrongly shows in the time machine. The reaper **already knows #3 is
reapable** (retain-only checks per-range; #3 is in no `retain:true` range). The gap is the eviction
*action*: the rolling buffer **trims contiguously from the oldest end and stops at the first retained
segment** — it evicted #1, hit the #2 "dam," and never deleted #3. **Saving an interior segment thus
protects everything behind it from eviction** (unbounded growth behind any saved era) — can't be intended.

**🔑 LAYER FRAMING (decided with Ben 2026-06-27 — look here, Aaron):**
- This is a **DATA-layer reaper *capability*** gap, NOT a rules-resolution gap. The reaper must learn to
  **evict an interior segment = punch a HOLE** in a session's footage (delete middle segment files while
  keeping the retained neighbours), and then **report surviving footage as a LIST of regions**
  (`survivingRegions: [{start,end}, …]`), not a single `survivingStartMs/EndMs` window (which can't
  represent a hole). Needed regardless of how the rules are stored.
- Distinct from the **RULES-layer materialization** (the CU4 "materialized segments / resolve-at-write"
  idea — each era a complete standalone rule set). That cleanup makes "reap this middle era" unambiguous
  and pushes the implementation toward holes-as-first-class, but it is **not** what fixes this bug — the
  reaper already has the per-era reap info; it just can't punch the hole. *(So: don't reach for rule
  resolution; fix the eviction mechanics.)*

**🔴 Also (same family): the `#1` ghost — surviving range didn't advance on head eviction.** #1's footage
is gone (disk) but its box redrew, so the session's `survivingStartMs` did **not** advance after the
contiguous head trim. Folds into the **surviving-regions list** above (once that lands, the app renders a
block per region with interior gaps — my queued render follow-on).

**Owner split:** **Aaron (reaper, DATA layer):** (1) evict interior unretained segments (holes); (2)
advance/maintain surviving footage as a **regions list** (covers both #3 and the #1 ghost). **Ben (app
render):** consume `survivingRegions` → draw a block per region with interior gaps (extends the
single-window ghost fix to N regions) — waits on Aaron's list.

### ⮕ AARON — START HERE (next steps, readiness)
- **D2 — go-live `lane` → opening-range `retain` directive. ✅ DONE + DEPLOYED (2026-06-26,
  `wrld-backend 10f9349`).** A saved-lane go-live (`allocate`) writes its opening era `[start, OPEN]`
  `retain:true` with **default display axes** (invisible to reads — carries only `keep`); `snipSession`
  now **carries `retain` forward** (the new era inherits the closing open era's value, was hardcoded
  false) so a saved-lane broadcast stays retained across snips. Additive/safe with the flag OFF
  (redundant with U1; PB3 honours retain). Retires the saved-lane half of D1's backfill for new go-lives.
  - **⚠️ Found + fixed while doing D2 — a SHADOWING risk in D1's backfill (matters for the cutover).**
    D1 inserted a *separate full-span* retain row (`[start,OPEN]` / `[a,b]`). When a session ALSO has
    per-range setting eras (snips), that row OVERLAPS them and `directiveCovering` (first-cover) could
    return the retain row — whose display axes are default — **shadowing the per-range title/precision/
    identity → the CU1 staleness bug, but only once `CU3_RETAIN_ONLY` flips ON.** Hardened the backfill
    to be **shadow-safe**: it now **UPDATEs** overlapping eras to `retain:true` (the keep axis added to
    the existing era) and only **INSERTs** over a gap with no era — never an overlapping row. (D2 itself
    never shadows; it works with the era model.)
  - **⮕ Add to the D1 cutover gate, Ben:** besides "saved survives / unsaved reaps," with the flag ON
    also **edit a per-range title/anon on a saved/saved-lane clip that has snips and confirm it still
    proliferates** (pin + viewer) — i.e. the backfill didn't shadow. The shadow-safe fix is deployed but
    only exercised when the flag is ON.
- **D4 — AV-pause/resume → a `sources` directive (mediasoup). ✅ DONE + DEPLOYED (2026-06-26,
  `wrld-backend 804d6f3` + `wrld-mediasoup bf68024`).** `setSourcePaused` (the media plane — producer
  pause/resume, one track with a gap) now also fires the **manifest plane**: mediasoup calls a new
  internal route `POST /internal/buffer/sessions/:id/source-snip { kind, paused }` (fire-and-forget),
  which snips the live session through the **same era model as U2** — closes the open era at now, opens
  a new one carrying the current axes (title/precision/identity/visibility/**retain**, so the toggle
  doesn't reset them and a saved-lane session stays retained per D2) with the toggled kind merged into
  `sources` (enabled = `!paused`). PB3-gated + live-only. So the off-range is marked in the per-range
  manifest and the saved-clip rail's `sourceWindows` (#4) reads it. **No app dep — the app sends only
  `setSourcePaused`** (do NOT also send a sources snip → double-write). **On-device gate:** pause camera
  ~30s mid-broadcast → confirm a `sources:{camera:false}` era marks the gap and the clip rail hides
  camera over it. **D4 confirms snip-at-now (U2) + AV-pause are now one unified directive write.**
- **D3 — save/un-save = a `keep`/`retain` directive edit; drop the copy-path + `saveClip`/`unsaveClip`/
  edge-relative endpoints; + U3 (materialise a `keep` range into a Library clip, per obs 2).** Cutover
  *read* side is ✅ PROVEN (2026-06-27 gate, finding 1); D3 is the *write* side. The gate sharpened the
  spec via findings 2+4: **un-save (drag saved→buffer) must DURABLY flip the dragged range's `retain`
  → false** (not just a local override — today the legacy un-save leaves the D2 retain directive intact,
  so the half neither reaps nor un-saves). Per the flag decision, **`CU3_RETAIN_ONLY` is OFF until D3 is
  built** (un-save keeps working via legacy meanwhile); re-run the gate with D3, then flip ON for good.
  - **✅ DECIDED — D3 Library-surface interim = option (a) (Ben, 2026-06-27).** A `keep:kept` range
    **still materialises a `Clip` row** (it's the artifact wrapper — owns `manifestUrl`/`thumbnailUrl`/
    `status`, which the Library reads for display + playback); **un-save removes the `Clip` row AND flips
    `retain` → false.** So the Library query is **unchanged** (reads `Clip` rows). *(Rejected for now:
    Library reads `keep=kept` ranges directly — the artifact metadata has no home until CU4. CU4's
    clip ≡ segment collapse merges Clip↔directive and supersedes this interim.)*
- **Ben (app), after D3 lands:** the `keep` axis in the drawer + retire the bespoke save flow (writes via
  `clipDirectives`). In parallel now: the canonical-type discovery-pin slice (unblocked).

---

## CU3 STATUS ROLL-UP — Aaron → Ben (2026-06-26)

Where the lane-as-the-7th-axis work stands after this session. **3 of the 4 D-decisions are built +
deployed; D3 is the one gate left.** The through-line: every live edge now writes the ONE
`DirectiveRange` model, and retention is collapsing onto the single `DirectiveRange.retain` authority.

### ✅ Shipped this session (all deployed)
| | What landed | State | Repo |
|---|---|---|---|
| **D1** | Reaper reads `DirectiveRange.retain` as its single retain authority (collapses the 3 OR'd signals), with a **shadow-safe backfill** that migrates legacy ClipRange/saved-lane retention into per-range `retain` (UPDATEs eras, never inserts overlapping rows). | **DEPLOYED INERT** behind `CU3_RETAIN_ONLY` (default OFF → reaper byte-for-byte unchanged). | backend `8ddf95a`/`10f9349` |
| **D2** | A saved-lane go-live writes its opening `retain` era; `snipSession` carries `retain` forward so a saved-lane broadcast stays retained across snips. | **DEPLOYED + LIVE** (additive — safe with the flag off; redundant with U1). | backend `10f9349` |
| **D4** | AV-pause/resume writes a `sources` directive snip (the manifest plane), unified with U2's snip-at-now. | **DEPLOYED + LIVE** (additive — inert until the app sends `setSourcePaused`). | backend `804d6f3` + mediasoup `bf68024` |

CU3 invariant now true on the engine: **go-live · snip-at-now · AV-pause all write the one per-range
model**, and retention has a single authority once the flag flips.

### ⛔ The one gate left — the D1 cutover (Ben runs it; data-sensitive)
Everything above is **inert/additive** until you flip **`CU3_RETAIN_ONLY` ON** (`/admin/config`). That
flip is the irreversible-ish cutover: the reaper stops honouring ClipRange/saved-lane directly and
relies on the (backfilled) `retain` directives. **Gate checklist — prove ALL before leaving it on:**
1. Tighten a tier window (`BUFFER_WINDOW_HOURS_*`) to force a reap.
2. A **saved clip** survives the reap; a **saved-lane go-live's** footage survives.
3. **Non-retained** past-window footage still reaps (the collapse didn't over-retain everything).
4. **(the shadow check I added)** Edit a **per-range title/anon on a snipped saved/saved-lane clip** →
   it still proliferates to the pin + viewer (proves the backfill didn't shadow the setting eras).

> **🚨 No-flip-back once real retain-only saves exist** (same invariant as PB2): with the flag ON, new
> retention rides `retain` directives alone — flipping OFF later would make that footage reap. Flip back
> is only safe while the gate is still proving (no D3 saves yet). Treat the flip as the commit.

### 🔶 D3 — gated on the cutover passing (then it's Aaron + a quick call)
Once the gate is green and the flag stays ON: **D3 = save/un-save becomes a `keep`/`retain` directive
edit** — drop the copy-path + `saveClip`/`unsaveClip`/edge-relative endpoints (the protections the
cutover just proved redundant) + **U3** (materialise a `keep` range into the Library, per obs 2). The
legacy writers it removes are exactly D1's backfill sources, so the backfill then has nothing left to do.
- **✅ DECIDED — D3 Library-surface interim = option (a) (Ben, 2026-06-27):** a `keep:kept` range
  **still materialises a `Clip` row** (the artifact wrapper — owns `manifestUrl`/`thumbnailUrl`/`status`
  the Library reads); **un-save removes the `Clip` row + flips `retain` → false.** Library query
  unchanged (reads `Clip` rows). CU4's clip ≡ segment collapse supersedes this interim. (Rejected:
  Library reads `keep=kept` ranges directly — no home for the artifact metadata until CU4.)

### D3 progress (Aaron, 2026-06-27)
- **✅ FOUNDATION DONE + DEPLOYED (`wrld-backend 7be1875`): the `keep`/`retain` axis round-trips on the
  per-range directive.** `PATCH /buffer/me/sessions/:id/directives` now accepts `retain` and the
  authoritative-replace persists it (was hardcoded `false`); `GET /buffer/me` each session's
  `directives[]` now returns `retain`. Additive (omitted → `false`; redundant with the flag off, the
  single authority with it on). **This unblocks the app-driven save/un-save:** the app reads keep
  per-range and writes the full directive set with `retain` flipped over the dragged range — the
  authoritative-replace stores it, so the splitting is app-side (`clipDirectives`), no backend era-split.
  - **⚠️ Round-trip is load-bearing:** because the PATCH is a full replace, the app MUST send `retain`
    on every directive it writes (read from `GET /buffer/me`), or a saved/saved-lane range's retain is
    dropped on the next per-segment edit. (Inert today — the flag is off, U1 still protects saved-lane;
    it bites only once `CU3_RETAIN_ONLY` is on.)
- **🔶 Remaining D3 (the coordinated cutover write side) — sequence after the flag is OFF + the call:**
  1. **App (Ben):** `clipDirectives` writes the `keep` axis (`retain`) on drag-to-save (→true) /
     drag-to-buffer (→false), round-tripping `retain` on every directive; **render the saved lane by the
     per-range `keep`**, not `BufferSession.lane`/`captureConfig.lane` (this is what fixes gate finding
     #4 — a saved-lane half dragged to buffer stops showing saved).
     - **✅ keep-axis ROUND-TRIP done (Ben, 2026-06-27).** `SegSettings` gained `keep`; the seeds
       (`ClipsScreen` + `SavedClipSettingsSheet`) read it from `directive.retain`; `rangesToDirectives`
       writes it back. So a per-segment edit now **re-asserts** an existing `retain` instead of dropping
       it — fixes a latent bug Aaron's foundation introduced (authoritative-replace defaults omitted
       `retain`→false, so pre-this every per-axis edit silently un-retained; harmless only with the flag
       OFF). App types (`BufferSession.directives[].retain`, `SegmentDirective.retain`) added. **Still
       remaining in step 1:** the drag-to-save/buffer WRITE flip + **render-by-keep** (the carve change —
       coupled to step 2 + a device pass on the `clips-timeline-clock-v1` milestone grid).
  2. **Backend (Aaron) — option-a Clip lifecycle:** on save, write `retain:true` over the range + keep
     materialising the `Clip` row; on un-save, **flip `retain`→false over the range + remove the `Clip`
     row** (drop the bespoke copy-path `saveClip`/`unsaveClip`/edge-relative endpoints). This is the
     reaper-affecting, data-sensitive half — build it with the flag OFF, then re-gate.
  3. **Re-gate** (Ben runs): flag ON → repeat the 4-point gate (now incl. drag-half-to-buffer reaps +
     un-save doesn't reappear saved) → **flip `CU3_RETAIN_ONLY` ON for good.**
- **✅ DONE (Ben, 2026-06-27): `CU3_RETAIN_ONLY` flipped OFF** on `/admin/config` — back to the safe
  3-signal reaper; un-save works via the legacy path again while D3 is built. Re-flip ON only after the
  D3 re-gate (and heed the "no-flip-back once real retain-only saves exist" invariant — treat that flip
  as the commit).

- **📌 D3 SAVE/UN-SAVE CONTRACT — confirm before we both build (Ben, 2026-06-27).** The remaining-D3
  steps above leave *how* save/un-save is driven implicit. Proposed contract (so the app keep-writes and
  Aaron's Clip lifecycle meet at one seam):
  - **Single write path:** the app drives save/un-save by writing **`retain`** on the per-range
    directive via **`patchDirectives`** (the one path for all 7 axes) — **no separate save/un-save
    endpoint** to call. (The bespoke `saveClip`/`unsaveClip` are dropped.)
  - **Backend side-effects of `retain` flipping (inside the directive PATCH handler), option-a:**
    `retain` false→true ⇒ **materialise the `Clip` row** (the artifact wrapper) **+ enforce the
    saved-storage cap** (reject/signal over-quota — the `409 storage_cap` the old `saveClip` returned);
    `retain` true→false ⇒ **remove the `Clip` row**.
  - **Edge-relative save** ("save the remainder from the reaper edge") is expressed as the directive's
    **range** (`[reaperEdge, …]`, which the app already computes) — not a special endpoint param. So the
    `fromReaperEdge`/`toNow` logic moves into "what range the retain directive covers."
  - **Over-quota response:** the PATCH must surface the over-quota case (e.g. `409 storage_cap` +
    used/quota) so the app shows the warning and, for a LIVE-span save, flips the go-live lane back to
    `buffer` (matches today's U3 behaviour).
  - **Why this shape:** keeps "save = a directive edit" literally true (one write path), makes the Clip
    lifecycle a backend-internal consequence of the keep axis (not a thing the app orchestrates), and
    gives the dropped `saveClip`'s storage-cap + edge-relative concerns a clean home. **Aaron: confirm
    or counter** — it determines whether I wire save/un-save against `patchDirectives` or a new endpoint.
  - **✅ AARON: CONFIRMED — wire against `patchDirectives` (2026-06-27).** The shape is right; one write
    path, Clip lifecycle as a backend side-effect, edge-relative-save-as-range. The foundation is already
    deployed (`7be1875`: the PATCH accepts/persists `retain`, `GET /buffer/me` returns it), so **you can
    wire the keep-writes now.** Implementation specifics I'm pinning so our halves meet exactly (these
    are *how I'll build the side-effect*, not counters):
    1. **Transition = an interval DELTA, not a row diff.** The PATCH is an authoritative full-replace and
       the app re-splits eras, so I compute **old-retained-regions vs new-retained-regions** (union the
       `retain:true` ranges each side, then diff): regions newly retained ⇒ materialise; regions no
       longer retained ⇒ remove. So **send the complete directive set with `retain` per range** (you
       already round-trip it) — I derive the save/un-save from the delta. A visibility/precision-only
       edit (no retain delta) does **no** Clip/quota work.
    2. **Clip identity = reconcile by session + overlap.** A new retained region overlapping an existing
       Clip's range **updates** that Clip's range (widen/shrink); a non-overlapping new region ⇒ **new**
       `Clip`; an existing Clip whose region is fully un-retained ⇒ **removed**. **Interim scope is
       per-session** (the PATCH is per-session; a retained region → a `Clip` over that session). A
       cross-session save = one PATCH per session = one `Clip` per session for now — the single
       cross-session clip is a **CU4** (clip ≡ segment) concern, not D3.
    3. **Storage cap, transactional.** I measure the **net-new** retained bytes first; if `used + net >
       quota` the PATCH returns **`409 { storage_cap, usedBytes, quotaBytes, neededBytes }`** and applies
       **nothing** (no directive write, no Clip). You keep today's U3 behaviour (warn; for a live-span
       save flip the go-live lane → buffer). Un-save (retain→false) never hits the cap.
    4. **Materialise = retain-in-place** (no copy): a `Clip` row (`saved=true`, `status:'ready'`) +
       `ClipRange` over the region + enabled `ClipTrack`s from the session kinds; `manifestUrl` stays the
       buffer-stitch (clip token). Mirrors what `POST /buffer/me/clips` does today, minus the copy.
    - **Sequencing:** flag is OFF (✅), so build both halves now → re-gate (drag-half-to-buffer reaps +
      doesn't reappear saved; over-quota 409) → flip `CU3_RETAIN_ONLY` ON for good. **My next backend
      commit is this side-effect (Clip lifecycle + cap inside `patchDirectives`) + dropping
      `saveClip`/`unsaveClip`.** One open nit for you: confirm per-session Clips are fine for the Library
      interim (vs. one Clip per logical multi-session save) — I'll assume yes unless you flag it.

### D3 backend side-effect — ✅ DONE + DEPLOYED (Aaron, `wrld-backend f6fa2fa`)
The `patchDirectives` Clip-lifecycle side-effect is built per the confirmed contract:
- **Reconciles the retain DELTA:** `retainedRegions()`/`regionDelta()` (pure, 11 tests) diff old vs new
  `retain:true` regions → a newly-retained region **materialises** a retain-in-place `Clip` (saved/ready,
  ClipRange, ClipTracks from the session kinds, buffer-served, no copy) + charges storage; a no-longer-
  retained region **removes** the overlapping retain-in-place Clip + reclaims storage. Net-new over the
  saved-clip quota ⇒ **`409 storage_cap`** (whole PATCH rejected → you warn + flip the live lane→buffer).
  Directive replace + Clip ops + storage delta in **one transaction**.
- **🔑 KEEP-AWARE GUARDED:** the side-effect only runs when a directive in the PATCH carries `retain`.
  So a legacy (retain-omitting) per-segment edit causes **zero Clip churn** — and it's **inert until
  your app round-trips `retain`**, which is why it's safe with `CU3_RETAIN_ONLY` ON. (Copied legacy
  clips are left to the old DELETE path — the side-effect never leaks `/media`.)
- **Per-session interim** (one Clip per retained region of a session; cross-session = CU4).

**➡️ Ben — over to you (the seam is live):** wire `clipDirectives` so drag-to-save / drag-to-buffer
**round-trips `retain` on every directive** (true over the saved range / false over the un-saved one),
and **render the saved lane by per-range `keep`** (not `BufferSession.lane`). The moment your PATCHes
carry `retain`, save creates the Library `Clip` and un-save removes it + reaps — **no `saveClip`/
`unsaveClip` calls**. Then re-gate (drag-half-to-buffer reaps + doesn't reappear saved; over-quota 409)
→ keep the flag ON. I'll drop the bespoke endpoints once your app is fully on `patchDirectives`.

> **⚠️ `CU3_RETAIN_ONLY` is ON again (2026-06-27).** Until your app round-trips `retain`, the side-effect
> is inert and **un-save stays broken via the legacy path** (drag-saved→buffer over-retains — footage
> doesn't reap; **not data loss** — the reaper backfill re-protects saved-lane/ClipRange footage every
> pass). So with the flag ON now we're in "save works, un-save is a no-op" until your keep-writes land.
> If you'd rather have working un-save in the meantime, flip the flag OFF until the re-gate; leaving it
> ON is safe (just over-retains) and lets us drive straight to the re-gate once your side ships.

- **ℹ️ FYI — ghost-block fix is DONE end-to-end (2026-06-27).** Aaron's backend half (`70a39c9`,
  `survivingStartMs`/`survivingEndMs` + thumbnail drop) + Ben's render half (blocks bound by the
  surviving range; reaped head → gap; fully-reaped → no block) are both in. Owes one on-device pass.

### Ben's lane
- **Now (unblocked):** the canonical-type **discovery-pin slice** (CU4 prep) — in flight.
- **After D3 lands:** the `keep` axis in the drawer + retire the bespoke `saveClip`/`unsaveClip` flow
  (write via `clipDirectives`); read the resolved `keep` instead of `BufferSession.lane`/`captureConfig.lane`.
- **On-device gates owed** (mediasoup/data-sensitive paths are headless-unverifiable, no prod data):
  the D1 cutover checklist above · D2 (a saved-lane go-live writes the opening retain era + survives a
  reap) · D4 (pause camera ~30s → a `sources:{camera:false}` era marks the gap, the clip rail hides it).

**Next move:** Ben runs the D1 cutover gate; when it's green we take the quick D3/U3 Library call and I
start D3. Until then CU3 is safely paused at "engine writes the one model, nothing cut over yet."

---

## CU3 D3 re-gate — interior-eviction 'dam': REPORT half shipped, eviction MECHANICS diagnosed (Aaron, 2026-06-27)

Picked up `handoff(D3 re-gate): interior-eviction 'dam' bug`. The owner-split assigned me both
**(2) report surviving footage as a regions LIST** and **(1) evict the interior unretained segment
(punch the hole)**. I shipped (2) and pinned down (1) precisely. (Note: I'd wiped the buffer +
its DB rows at Aaron's request just before this, so there's no live footage to reproduce against —
the re-gate runs on fresh broadcasts regardless.)

### ✅ (2) `survivingRegions` — DONE + DEPLOYED (`wrld-backend 3ff2cac`, health 200)
`GET /buffer/me` now returns, per session, **`survivingRegions: [{ startMs, endMs }]`** (absolute
ms) — the maximal contiguous runs of the playable track's **surviving on-disk segments**. This is
exactly what the single `survivingStartMs/EndMs` window can't express:
- an **interior hole** (an evicted segment between two retained neighbours) shows as a **gap
  BETWEEN two regions** — not a block drawn over reaped footage (the #3 ghost);
- a **head trim** advances the **first region's start** (the #1 ghost folds in for free).

Built on a pure `contiguousRegions(segs, maxGapMs)` (6 unit tests; splits on a gap below one
segment's ~2s length so even a single-segment hole separates, while absorbing PDT/EXTINF jitter).
The three time-model outputs (`mediaDurationSec`, `mediaStartOffsetMs`, `survivingRegions`) now all
derive from ONE surviving-segment-extent walk, so they can't disagree. **Additive / back-compat:**
single contiguous footage ⟹ one region == `[survivingStartMs, survivingEndMs]`; a data-only or
legacy/no-PDT-anchor session ⟹ `survivingRegions: []` (fall back to the single window).

**✅ Ben — render half DONE (`wrld-app 21a004a`).** `BufferSession.survivingRegions[]` consumed in
`ClipsScreen`: `reapedClaims` = the gaps BETWEEN a session's surviving regions, subtracted in the buffer
carve (`carveClaims = claims + reapedClaims`) → the block splits into one piece per region with an
eviction gap between (the interior #3 hole). Head/tail still via `sessionStartMs/EndMs`. `<2 regions` /
empty → `carveClaims === claims` (byte-identical fallback, zero regression). **Will SHOW the #3 gap once
your eviction-MECHANICS fix actually evicts #3** (today the pad still bridges it, so `survivingRegions`
is one region). Owes an on-device pass at the re-gate.

### 🔬 (1) The eviction MECHANICS — the handoff's model was slightly off; here's the real cause
The handoff framed the dam as "the rolling buffer **trims contiguously from the oldest end and
stops at the first retained segment**." On reading the reaper, the age-trim is actually **per-leaf**
(`for (lf of leaves) { if (isProtected(lf) || lf.mtime >= cutoff) continue; unlink }`) — it deletes
*any* unprotected past-window leaf regardless of position, so it already punches holes for
non-tiny interior segments. The real "dam" is **`RETAIN_PAD_MS` (4s) bridging a SHORT interior
unretained segment**: `coveredByRetain` keeps a segment whose mtime is within 4s of a retained
range's edge, so a `<~8s` #3 sitting between saved #2 and #4 is within 4s of **both** (#2's end-pad
AND #4's start-pad) → protected → never evicted. The pad exists to keep a retained range's boundary
*segments*; for a short interior gap the two ranges' pads meet and bridge it.

**The correct fix is overlap-based retain:** a segment is kept iff its time-range `[start, end]`
**overlaps a retained range** (not "mtime within range ± pad"). That keeps boundary segments (they
overlap), evicts any interior unretained segment (it doesn't), and is **provably safe for retained
footage** (a segment overlapping a retained range is never evicted — same guarantee the pad gives,
without the bridge). It needs per-segment durations in the reaper (it currently walks mtime-only
leaves) — i.e. reusing the same PDT/EXTINF segment-extent walk I just added for the regions list.
A pad *reduction* only mitigates (interior gaps ≤ 2×pad still bridge), so it's not the answer.

I deliberately did **not** ship that reaper retain-protection change blind this turn: it's a
data-sensitive prod path and — with the buffer wiped — it can only be honestly verified against
**fresh** footage at the re-gate. So:

**Re-gate plan (when there's footage again):** flip `CU3_RETAIN_ONLY` ON (it is now), broadcast →
snip into ≥4 segments → save #2 + #4, leave #1 + #3 buffer → tighten the tier window → reap, then
confirm via `GET /buffer/me` that the session's `survivingRegions` shows **two regions with a gap
where #3 was** (and #1 gone from the head). If #3 is still present (the pad bridged it because it's
short), that's the signal to land the overlap-based retain fix — which I'll do as the (1) follow-up.

**Net:** the regions LIST is live and unblocks your render now; the interior-eviction MECHANICS fix
(overlap-based retain) is queued for the re-gate where it can be verified with real footage.

---

## CU3 D3 — interior-eviction MECHANICS fix shipped (the dam is closed) — Aaron, 2026-06-27

Followed `handoff: CU3_RETAIN_ONLY confirmed OFF`. With Ben's render half done and the report
half (`survivingRegions`) shipped last turn, this closes the other half I'd diagnosed: the reaper
now actually **evicts the interior unretained segment** (punches the hole), so `survivingRegions`
will show it.

**✅ Fix DONE + DEPLOYED-INERT (`wrld-backend 0b32c4d`, health 200).** The dam was
`coveredByRetain`'s ±4s pad bridging a short interior segment (it's within both saved neighbours'
edge-pads). The reaper now retains **media segments by PDT-extent OVERLAP**, not the padded mtime
point: a segment is kept iff its `[start,end]` intersects a retained range — boundary segments
overlap (kept), an interior unretained segment overlaps neither (**evicted**). It uses the
segment's PDT extent (the same absolute-ms axis the retain ranges live on), which also removes the
mtime↔PDT skew the pad was masking. Data `.jsonl` chunks, legacy/no-PDT segments, and the flag-off
path keep the padded mtime test, so **nothing is ever newly under-protected** (overlap can only
stop protecting an unretained segment, never evict a retained one).

**🔒 Gated to the `CU3_RETAIN_ONLY` (single-authority) path — NO new flag.** With the flag OFF
(its current state) the reaper is byte-for-byte unchanged, so deploy is inert. The fix activates
together with the cutover when you flip `CU3_RETAIN_ONLY` ON at the re-gate — which is exactly the
flip you're already gating. (Per Aaron's no-flag-clutter preference, I bundled it into the existing
flag rather than add `CU3_OVERLAP_RETAIN`.)

**Proof (the wiped buffer is why):** `cu3InteriorEviction.test.ts` writes a real on-disk 5-segment
HLS session, saves #2 + #4, leaves #1/#3/#5 buffer, and asserts after a reap that **#3 is evicted
while #2/#4 survive** — with #3's mtime deliberately inside the OLD ±4s pad of both neighbours (so
the padded test *would* have bridged it; the overlap test is what evicts it). A second case proves
a fully-retained run survives intact. 371 tests green.

### ➡️ The re-gate (now turnkey — both halves are in)
Flip **`CU3_RETAIN_ONLY` ON**, then on device: broadcast → snip into ≥4 segments → save #2 + #4,
leave #1/#3 buffer → (tighten the tier window to force a reap) → reap. Expect:
1. `GET /buffer/me` → the session's `survivingRegions` shows **two regions with a gap where #3 was**
   (and #1 gone from the head) — and your render draws that interior hole.
2. #3 is **gone from disk** (the eviction, not just the report).
3. #2 + #4 (and the live tail) survive; the over-quota path still 409s.

If green: keep `CU3_RETAIN_ONLY` ON for good (heed "no-flip-back once real retain-only saves
exist"). **Both the eviction MECHANICS and the surviving-footage REPORT are now mine-complete** —
the dam bug is closed pending your on-device confirmation at the flip.

### 🔴 RE-GATE #2 RESULT (Ben+Aaron device, 2026-06-28, flag ON) — eviction WORKS at disk; REPORT/SERVE doesn't reflect interior deletions
**🎯 Win: the interior eviction MECHANICS landed — #3 (interior, between saved #2/#4) is EVICTED FROM
DISK** (disk-confirmed; #1 also gone). The dam is cured in the reaper. **But the eviction isn't
reflected up the stack:**
- **In the grid: #3 still renders** in the buffer lane (#1 IS gone). So `survivingRegions` is still
  **ONE region spanning #3** — no gap → my render has nothing to draw. The **HEAD trim IS reflected**
  (`survivingStartMs` advanced → #1 gone); the **INTERIOR deletion is NOT**.
- **#3 still PLAYS**, and the **time machine shows + plays all 4** (incl. the disk-evicted #1/#3).
- **Diagnosis (Aaron's lane — REPORT/SERVE half):** the surviving-segment walk + the served buffer
  manifest read the **playlist**. A head-trim prunes the playlist's leading entries (reflected); the
  interior eviction **deletes #3's files but doesn't remove #3 from the playlist** → the walk still
  counts #3 (one region, no gap) and the served manifest still lists #3 (plays cached/404, shows in
  discovery). **→ make `survivingRegions` + the served manifest + clips/buffer discover reflect actual
  on-disk survival of INTERIOR segments** (skip/prune deleted interior entries, not just the head).
- **App render is correct + READY** — `reapedClaims` draws the #3 gap the instant `survivingRegions`
  reports two regions; no grid change needed.
- **Confirming diagnostic:** `GET /buffer/me` survivingRegions for that session — **1 region** ⟹
  Aaron's report gap (expected); **2 regions** ⟹ Ben's `reapedClaims`. (Strong expectation: 1.)
- **Minor (Ben, low-pri):** scrolling the clock past #4 flashes #1's title/id — a label-resolution
  wrap-around in the clips clock/pin label.

**Eras still pass.** Step 1 (save) + step 1b (whole-clip un-save) were not the focus this run.

#### Run #2 (inverted: saved #1/#3, buffer #2/#4, + distinct visual cues) — the gap CORRUPTS playback
- **Eviction works (disk):** #2 + #4 (buffer) evicted, #1 + #3 (saved) survive. ✅
- **Head+tail trims reflected, interior NOT:** grid drops #4 (tail, via `survivingEndMs`) but #2
  (interior, between saved #1/#3) **ghosts** → confirms `survivingRegions` is still ONE region spanning
  the interior hole (combined with run #1's head case: single window reflects head+tail; interior holes
  don't). 
- **🔴🔴 Stale manifest CORRUPTS time-machine playback (new, worse than a cosmetic ghost):** with
  distinct per-segment cues, #2 **plays #3's content**, #3 is a **stalled thumbnail**, #4 shows **#1's
  thumbnail (stalled)**. The deleted interior segments are **still listed in the served playlist**, so
  the player's **time→segment mapping is shifted** by the missing data → seeks land on the wrong
  footage + stall. So this isn't just a ghost block — **it scrambles what plays.**
- **Sharpened fix (Aaron):** **prune deleted interior segments from the served playlist/manifest** (and
  the `survivingRegions` walk + clips/buffer discover). That single fix resolves all of it — the render
  gap (`survivingRegions` → 2 regions), the ghost+serve, AND the seek mis-alignment/stalls. Head/tail
  pruning already happens; interior doesn't. Higher priority than thought (corrupts playback, not just UI).
- App render unchanged (correct + ready; draws the gap once `survivingRegions` splits).
