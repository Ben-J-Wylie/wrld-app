# HANDOFF — Haven private-stream pins (Aaron) — 2026-06-18

## ✅ BACKEND DEPLOYED + VERIFIED (Aaron, 2026-06-19)

`65c2f2a` pulled onto the Hetzner box + api rebuilt. Verified in the running container:
- `findAllLiveStreams` no longer excludes `off` — it surfaces private streams with
  **`lat: null, lng: null, locationPrecision: 'off'`**; `findStreamsNear` still excludes
  `off` (no geographic position). `streamStarted` pushes `off` streams with **null coords**.
- **Privacy sanity-check PASSED:** real coordinates for `off` streams are stripped to null
  at both server boundaries; nothing else emits them.
- **Redis-safe:** `DISCOVERY_REDIS` is on; coordless pins are kept OUT of the geo set /
  tiles (`if (s.lat == null) continue`) → pin-hash + legacy fan-out only (the app's Haven
  socket), viewport/Earth clients ignore them, no null-coord crash. API log clean.

Remaining = the **on-device test checklist below** (go live PRIVATE → absent on Earth →
pin on Haven island at a stable spot → tap → Join → count/end clear it). That's yours —
I can't drive the globe from the box.


**Goal:** get PRIVATE-location streams rendering as pins on the **Haven** island,
end-to-end. The **app side is done** (Ben, `planet` branch). What's left is the
**backend deploy + verify** — that's this handoff.

---

## TL;DR — what you do

Both repos are already merged to `main` and pushed (2026-06-18).

1. **Deploy `main`** — the backend Haven change is on `origin/main` (commit
   **`65c2f2a`**, cherry-picked from `1f32558`). `git pull` main on the Hetzner box +
   **rebuild/restart the API** so the discovery socket starts emitting `off` streams.
2. **Test:** go live PRIVATE → it's NOT on Earth → switch to Haven → a pin sits on
   the island.

No DB migration. No mediasoup change. No app rebuild (app is pure JS / hot-reload).

---

## Why this is needed

A creator who broadcasts with **PRIVATE** location (`locationPrecision = 'off'`) was
filtered out of discovery server-side → completely undiscoverable. Haven (the second
planet — a synthetic 99%-water + one-island globe) is their home. Each private stream
is placed at a **stable random spot on the island, derived from its stream id** — so
it's discoverable while revealing **nothing** about the real location.

---

## The data flow (how a private pin reaches Haven)

1. Broadcaster goes live with **PRIVATE** location → the app sends
   `locationPrecision: 'off'` (the dashboard already maps `'private' → 'off'`).
2. mediasoup → `POST /internal/streams/started` — **unchanged**, already forwards `off`.
3. **Backend (my change):** pushes the stream to discovery with **coordinates
   stripped to `null`** + `locationPrecision: 'off'`.
4. The discovery socket (`/streams/discovery`, the app connects as a **legacy/global**
   client) fans it out (snapshot + `stream_started` + count/end events).
5. **App (done):** `GlobeScreenMapbox` runs `useDiscoverySocket()` filtered to
   `'off'` = `privateStreams`, used as Haven's pin + drawer source; `randomPointOnIsland(id)`
   scatters each on the island. Earth ignores this feed (it uses viewport-tile discovery).

---

## Backend changes — commit `1f32558` ("surface PRIVATE ('off') streams to the Haven planet")

Three files, self-contained:

- **`src/services/streamService.ts`** — `findAllLiveStreams` (the discovery snapshot):
  dropped the `… != 'off'` WHERE filter; for `off` rows it returns **`lat: null,
  lng: null`** + `locationPrecision: 'off'` (privacy — the real coordinate never
  leaves the server). `findStreamsNear` (geographic `/streams/near`) **still excludes
  `off`** — correct, a private stream has no discoverable geographic position.
- **`src/services/discoveryService.ts`** — `DiscoveryStream.lat/lng` made nullable +
  precision `'off'`; `rebuildIndex` and `publish('stream_started')` keep **coordless
  pins OUT of the geo set / tiles** (pin-hash + legacy fan-out only → the app's global
  socket gets them, viewport clients ignore them); `tilePath(...)` guarded for null
  coords in the `location_updated` / `stream_ended` branches.
- **`src/routes/internal.ts`** — `streamStarted` now **pushes** `off` streams (with
  null coords) instead of skipping them.

**mediasoup:** no change (it already forwards `off`).

---

## Deploy (Hetzner box)

- It's on `origin/main` already (commit `65c2f2a`, 3 files). On the box: `git pull`
  main → **rebuild + restart the API (Fastify) container** with the usual flow.
- **No DB migration** (no schema change — `lat`/`lng` already exist; only nulled in
  the response). **No `prisma generate` change.**
- The `/streams/discovery` route already exists — deploying only changes **what it
  emits**.

Backward-compatible: the currently-installed app filters out null-coord pins, so old
clients just ignore the new private streams rather than breaking.

---

## Privacy guarantee (please sanity-check)

Real coordinates for `off` streams are stripped to `null` at the **server boundary**
(`findAllLiveStreams` + the `streamStarted` push). The island position is derived
**client-side from the stream id** — deterministic + stable, but carries zero real
location. Worth a second pair of eyes that nothing else leaks `off` coords (I checked
the obvious paths; `findStreamsNear` still excludes them).

---

## Test checklist

- [ ] Phone A: go live with **PRIVATE** location.
- [ ] **Earth:** the stream does **not** appear (correct — it's coordless).
- [ ] Switch to **Haven:** a pin appears on the island at a **stable** spot
      (re-open the app → same spot).
- [ ] Tap it → `DiscoveryHandoffCard` → **Join** → the viewer joins the room.
- [ ] Inspect the discovery socket payload for that stream:
      `locationPrecision: 'off'`, `lat: null`, `lng: null` (no real-coords leak).
- [ ] Viewer-count updates + stream-end clear the Haven pin.

---

## App side (already done — reference; Ben's lane)

App `planet` commit **`59e24b3`**. The **HAVEN DATA SEAM** in `GlobeScreenMapbox`:
`privateStreams = useDiscoverySocket().filter(s => s.locationPrecision === 'off')`;
`planetPins` / `drawerSource` switch the pin + drawer + count + tap sources by
`planet.id`; pins placed via `randomPointOnIsland(s.id)` (`src/lib/planets/`). Pure JS
— hot-reload, no EAS rebuild.

---

## Branch note (resolved)

The backend `planet` branch had got tangled with the **PB3 / public-buffer** commits.
PB3 was already on `origin/main`, so the Haven backend work was **cherry-picked clean
onto `main`** (`65c2f2a` from `1f32558`, 3 files only) and pushed — no PB3 entanglement.
The local `planet` branches (app + backend) are now redundant and can be deleted.

---

## Scale follow-up (not blocking)

The app re-added the **always-on discovery socket** just to feed Haven, which slightly
undercuts the viewport-tile model `main` moved to for scale. Fine at friends-and-family
scale. At real scale, either **gate the socket to when Haven is the active planet**, or
add a dedicated lightweight **`GET /streams/private`** (live `off` streams) the app
polls instead of opening the full discovery socket.

## Open / optional

- **Clusters on Haven:** if private streams bunch on the island they cluster like any
  pins; cluster-tap → `getClusterLeaves` → join. Works through the shared pin path.
- **Own private stream on Haven:** renders as the black self-pin; tap returns to the
  broadcast (`treatAsSelf` is planet-agnostic).
- **Time machine on Haven:** the scrubber is Earth-oriented; Haven shows live private
  streams regardless of the offset (no historical private feed). Fine for now.
