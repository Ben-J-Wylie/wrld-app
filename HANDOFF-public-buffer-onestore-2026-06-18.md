# Path — Public buffer + one-store / retain-in-place (PB0–PB4)

**Decided with Ben 2026-06-18.** Principle is canonical in **CONTENT.md §3** (with
§1.3/§1.5/§2.5/§5/§7/§8/§9 updated) + the dated CLAUDE.md update.

---

## → AARON — OPEN BACKEND ITEMS FROM PB3 DEVICE TESTING (2026-06-23)

### ← Aaron RESOLVED (2026-06-23): items 1, 2, 4 fixed/verified; 3 by-design; 5 future
- **1 — serve-precision ✅ FIXED + deployed (`38dc93d`).** The serve subtracted private
  windows then RE-INCLUDED any segment overlapping the public sub-range → a ~2s segment
  straddling a mid-segment snip leaked its private frames. `buildDraftPlaylist` now takes
  `excludeWindows`: a segment touching ANY private window is DROPPED (both public paths).
  HLS segments are atomic so a frame-exact trim needs re-encode (which no-copy retain-in-
  place avoids) → privacy-safe choice: never serve a private FRAME, at the cost of ≤1
  boundary segment of public per edge. (Frame-exact serve = a future re-encode/coverage
  option, ties to #5.)
- **2 — per-range write/read ✅ VERIFIED.** Prod has 3 distinct private standalone rows
  (`retain=false, clipId=null`, incl. overlapping ones) — written distinctly, no dedup
  collapse. The deployed `NOT EXISTS (startAtMs ≤ T·1000 < endAtMs)` hides at `T∈A`, shows
  at `T∈B`. Backend half confirmed.
- **3 — post-end pin: BY DESIGN (no bug found).** The bufferPin query is window-bounded
  (`startedAt ≤ T ≤ endedAt‖now`), so a STOPPED session CANNOT pin past its `endedAt`. A
  pin "after the clip's end" therefore means the session was still **LIVE** with public
  footage past the last private mark (the single-pin-per-session model — the live edge
  isn't private). On-device discriminator: if a pin shows for a **stopped** session past
  its end → that'd be a bug (the query says it can't); if only while live / with a public
  tail → working as designed.
- **4 — saved-clip dedup leak ✅ FIXED + deployed (`e1e1a9c`).** At a private instant the
  bufferPin is hidden, so the clip↔bufferPin dedup didn't fire and the clip pin re-surfaced
  (leak). `clips/discover` now also excludes a clip at any `T` inside a private
  DirectiveRange for its source session. Latent today (no saved clip on a private session
  yet); closed defensively.
- **5 — coverage-intervals: tracked, NOT built.** Frame-crisp pins (discover returns
  per-pin public coverage intervals; client resolves at the exact playhead) — a refinement
  for later; also the path to frame-exact *serve*.


PB3 is flipped on + tested on device. App-side fixes shipped (saved-lane toggle symmetry;
1s discover bucket so per-segment privacy resolves; mend prompt). **Rehydration is DONE** (grid seeds marks from `/buffer/me` `directives[]` on load). The following are
**backend (yours)** — surfaced by testing the private/public segment behaviour:

1. **Serve-precision = the real content guarantee (most important).** The discovery PIN can
   be coarse (1s bucket is fine — a pin blinking sub-second is imperceptible), but the
   **serve / playback path must exclude a private span at its EXACT ms boundary** (a snip at
   frame 15 = `…:03.500`), independent of any discovery bucket. Confirm the served footage /
   manifest drops the private range to the frame, not rounded. *This is what actually
   protects private content.*
2. **Per-range write/read verify (rules out a backend cause of the "both segments same"
   bug).** For a session with A=[t0,ts] private + B=[ts,t1] public, confirm `clips/discover`
   hides the pin at `T∈A` and shows it at `T∈B` (the deployed `NOT EXISTS … dr.startAtMs <= T
   < dr.endAtMs` check looks right; confirm the rows are written distinctly + no dedup
   collapse). Ben's 1s bucket fixed the app side; this confirms the backend half.
3. **"#2 pin reappears after the clip's end" — measure.** The bufferPin is per-session,
   spanning `[start, endedAt ?? NOW]`, hidden only at instants inside a private range. For a
   **STOPPED** session marked **entirely** private: does the pin still show after its end? →
   **yes** = a range/end mismatch bug; **only when there's real public tail / still-live** =
   working as designed (the single-pin model) and a product call, not a bug.
4. **Saved-clip dedup edge.** A saved clip is hidden by a `DirectiveRange` only if it's
   **deduped to a `bufferPin`** (session live/retained). Confirm retain-in-place keeps saved
   clips on the bufferPin path (expected) — else the `clips`-array discover path (filters on
   `Clip.visibility`) must also honour directives, or marking a saved clip private must also
   set `Clip.visibility`.
5. **(Future, not now) coverage-intervals model — the "ideal" that kills the bucket.**
   Instead of the client re-querying a bucketed instant, have `discover` return **per-pin
   public coverage intervals**; the client fetches a coarse window and resolves pin
   visibility at the **exact** playhead locally (frame-precise, no per-second refetch,
   sub-second-range-safe). A refinement for when we want frame-crisp pins; flagged so it's
   tracked, not built.

---

## → BEN — PB3 IS READY, TAKE IT FROM HERE (2026-06-23, Aaron)

**State:** PB1 ✅ live · PB2 ✅ live · **PB3 backend ✅ DONE + deployed · app toggle ✅
scabbed in.** Both Aaron backend steps from the old version of this section are now
shipped, so there's **no remaining backend code** — only the flag flip + your app polish:

- ✅ **`PB3_PER_RANGE` allowlisted on `/config`** (`wrld-backend 790e775`) — verified live:
  `/config` now returns `PB3_PER_RANGE` (currently `false`), so `configBool('PB3_PER_RANGE')`
  reads it; the toggle stays dormant until the flip.
- ✅ **Directives fold into `GET /buffer/me`** (`wrld-backend 4be347c`) — each session now
  carries `directives: [{ startAtMs, endAtMs, visibility, precision, attributed }]` (`[]` =
  all default). **Closes the scab-in reload caveat** — the grid can now rehydrate per-segment
  public/private marks on load, no separate GET needed.
- The full enforcement (write PATCH · reaper retain union · discover-hide · public-serve
  exclude) is deployed + data-gated behind the flag.

### Your steps (Ben)
1. **Flip it on:** set `PB3_PER_RANGE = true` in `/admin/config` (just a config toggle now —
   no code/deploy; the key's already on `/config` + in RemoteConfig). *(Or ping Aaron to flip
   it via the DB.)*
2. **Verify on device:** relaunch (≈10-min `/config` cache) → tap a buffer-lane segment →
   eye/lock toggle by the scissor → mark private → its pin vanishes from the time machine +
   it won't serve publicly, while you (owner) still see it.
3. **Rehydrate marks:** wire the grid to seed per-segment public/private from each
   `/buffer/me` session's new `directives[]` (so marks survive reload — the caveat is now
   backend-supported).
4. **Redesign the scab-in:** your own note — the by-the-scissor placement + ±1s range-keyed
   matching are stopgaps; redesign when ready.

After that, the initiative's last slice is **PB4** (per-user visibility default + grid
polish; Aaron adds `User.bufferVisibilityDefault` when we get there).

---

## → BEN — ACTION ITEMS (updated 2026-06-19): PB1+PB2 shipped, PB3 backend done, your turn

**State:** PB1 (public buffer in the time machine) ✅ live + verified. PB2 (retain-in-place:
saves stop copying, reaper keeps them) ✅ live + verified. **PB3 backend ✅ complete +
deployed, all behind `PB3_PER_RANGE` (OFF).** The only thing standing between us and
per-segment public/private going live is **your app UI + a coordinated flag flip.** Full
contracts are in the PB3 sections below; this is your ordered checklist.

### 1. Per-segment settings UI (PB3) — the headline
Each snipped segment (your `splitPoints`) gets its own **public/private** toggle.
- **On change, call** `PATCH /buffer/me/sessions/:id/directives` with the **authoritative
  full list** for that session:
  ```
  { directives: [ { startAtMs, endAtMs, visibility: 'public'|'private',
                    precision?: 'exact'|'city'|'country'|'off'|null, attributed?: boolean } ] }
  ```
  Omit a segment → it reverts to default (public / inherit / attributed). Owner-gated.
- **⚠️ Gate the toggle on the flag:** only render it when `configBool('PB3_PER_RANGE')` is
  true. The endpoint 409s when off, and a "private" mark isn't enforced until the flag's on —
  showing it while off would give a false sense of privacy.
- **Mend differ-guard:** when adjacent segments' directives differ, **prompt-to-pick** which
  to keep (decided default); keeping them snipped is always valid.

### 2. Ping Aaron for the team flip (when #1 is built)
I'll then (a) add `PB3_PER_RANGE` to the public `/config` allowlist so `configBool` sees it,
and (b) flip it on for the team. **On-device gate:** mark a segment private → its pin vanishes
from the time machine + it won't serve publicly, while you (the owner) still see it.

### 3. PB4 app items (after PB3 is validated) — lower priority
- **Per-user visibility default** setting (a "new go-lives are public/private by default"
  toggle). Backend adds `User.bufferVisibilityDefault` when we get here (Aaron).
- **Polish:** distinct-segment visual in the grid; storage-meter copy for retain-in-place.

### Not blocking you (Aaron, in parallel)
PB4 **backend guardrail audit** — verify subscribers-only/PPV buffer stays paywalled on
time-machine replay + anon/precision reversibility on the public buffer. Independent of your
UI; I'll do it so the public buffer is safe to widen past the team.

---

> Below is the full implementation record (PB0 contracts → PB3 build), kept for reference.

## The model in one paragraph
One append-only footage store. A clip is a manifest of **per-range directives** over
it; **retention (reap ↔ keep)** and **visibility (public ↔ private)** are two
**orthogonal** per-range axes (all four cells valid). The **reaper is a manifest
consumer** — a segment survives iff a `retain` directive pins it (or it's live);
**saving is retain-in-place, never a copy**, and shifts bytes from the time-window
budget onto the saved-storage quota. The **rolling buffer is public by default** and
in the time machine; **private** is the per-range opt-out (live-viewable, kept if
retained, never in the past). **Live is public by product policy.** The only genuine
byte copies are **permanent delete** and the **Report Centre** moderation hold.

## What it supersedes
- Two physical pools + `promoteBufferClip` **copy-on-save** → one store, retain-in-place.
- Per-clip `attributed` / `locDisplayPrecision` / `visibility` → **per-range**.
- Time machine = saved clips only → **public buffer + retained public clips**.
- The "never expose a regular user's buffer publicly" wall → a **public buffer serve
  + token-mint policy** (private ranges + owner editing views stay owner-gated).

---

## Phased rollout

| Stage | Owner | Repo | What | Depends on |
|---|---|---|---|---|
| **PB0** | Ben + Aaron | — | **Contracts.** ✅ principle (CONTENT.md §3). Still to pin: the per-range directive shape (where retain/visibility/precision/identity live — `ClipRange` columns vs a directive-range table that also covers un-saved buffer ranges); the unified discover pin shape; the public serve/token policy; **migration call for existing copied saved clips** (recommend: grandfather in `/media/clips`, no rewrite). | — |
| **PB1** | Aaron (backend+recorder) · Ben (app) | all | **Public buffer in the time machine (Path A headline).** Backend: `clips/discover?at=` (or a unified discover) **also returns public buffer sessions** at T (`BufferSession ⋈ Stream`, `startedAt ≤ T ≤ endedAt‖now`, public, exclude private/`off`/subscribers-gated-without-access); a **public buffer serve** route + token-mint for any *public* session (lift the ext-cam-only restriction for public sessions); a **public buffer-session detail** endpoint (manifest + tracks + start/end), the `clips/:id` analog. Visibility here is **coarse** (per-user default + a per-stream/per-clip private flag) — per-range lands in PB3. App: globe seam consumes the unified feed (buffer pins + clip pins); the clip viewer handles a buffer-session id (reuse `ClipViewerScreen` via the unified detail). | PB0 |
| **PB2** | Aaron (backend+recorder) | backend + mediasoup | **Retain-in-place (drop copy-on-save).** Reaper honours per-range/clip `retain` — a retained range's segments are exempt **in place** (segment survives iff a retain range overlaps it / it's live). `saveClip` → a **retain directive** (no `promoteBufferClip` copy); un-save removes it. **Retained-bytes quota** = sum of retained ranges over the one store (still decrements available storage). Grandfather existing copied clips. | PB0 (parallel to PB1) |
| **PB3** | Aaron (backend) · Ben (app) | all | **Per-range directives.** Move `retain` / `visibility` / `precision` / `identity` to the **range** level. App: a **per-segment settings affordance** (each snip segment carries its own settings) + the **mend differ-guard** (disable / prompt-to-pick when adjacent ranges differ; keeping snipped is always valid). | PB1 + PB2 |
| **PB4** | Ben (app) · Aaron (backend) | all | **Private polish + per-user default.** The public/private per-range **toggle UI** + a clear visual of distinct segments; a **per-user visibility default** setting; backend enforces per-range visibility in discover + serve. Guardrail audit: **subscribersOnly** buffer keeps the paywall on replay; anon/identity reversibility honoured on the public buffer. | PB3 |

**Parallelism:** PB1 (public buffer) and PB2 (retain-in-place) are independent after
PB0 — PB1 delivers the user-facing ask, PB2 is the invisible storage simplification.
PB3 needs both; PB4 last.

## The Ben / Aaron split (the seam holds)
- **Ben (`design` → app):** the time-machine consumer for buffer pins (globe seam +
  the unified discover), the buffer-session viewer (reuse `ClipViewerScreen`), the
  **public/private per-range toggle UI**, the **per-segment settings affordance**, the
  **snip/mend differ-guard**, the storage-meter copy.
- **Aaron (`main` + sister repos):** discover-over-public-buffer + the **public serve
  / token-mint policy**, the **reaper honouring `retain`** (drop the copy-out),
  per-range manifest schema, retained-bytes quota accounting, the subscribersOnly
  replay gate.

## Risks / watch-items
- **Public-serve security** — the new public token-mint must serve *only* public
  ranges of a session; owner editing views + private ranges stay owner-gated. This is
  the line that today reads "never expose a regular user's buffer."
- **subscribersOnly + anon** — a public buffer must still honour the paywall and the
  reversible anon/precision display (read the range's *current* value).
- **v0.3 object-storage migration** — retained (permanent) footage now lives
  intermixed in the buffer tree, tagged by metadata, not a tidy `clips/` dir; the
  future cold-storage/backup migrator walks per-range retention instead. Note for v0.3.
- **Saved-from-buffer playback** inherits buffer codec-group quirks (no clean
  transcoded VOD) — largely mitigated by capture-pinning (single-group buffers).
- **Migration** of already-copied saved clips — grandfather (they already survive
  eviction); don't rewrite.

## Done-bar
Roll the globe back → you see **everyone's surviving public footage** (buffer +
saved) at the instant, not just deliberately-saved clips. A creator can mark a
segment **private** (per range) and it drops out of the past while staying live-
viewable + kept. Saving a segment **keeps it from the reaper with no copy** and
decrements storage. Snip a clip, give each segment different settings, and mend
behaves (free when they agree, guarded when they differ). Live is always public.

---

## PB0 — the two contracts to decide (Ben + Aaron), kicked off 2026-06-18

Before PB1/PB2 code. Both are **Aaron's lane to ratify** (schema + serve); Ben's lean is
noted. Neither blocks *starting* PB1 (see "minimum to start" at the end).

### Contract 1 — where per-range directives live

The directives: **`retain`** (reap/keep), **`visibility`** (public/private),
**`locDisplayPrecision`**, **`attributed`** (identity) — today all **per-`Clip`**
(`attributed` / `locDisplayPrecision` / `visibility` columns + the `saved` bool). The
new requirement: directives must also describe **un-saved public buffer ranges** (the
buffer is public by default and a user can mark *a slice* of it private), so they can't
live only on saved `Clip` rows.

- **Option A — extend `ClipRange`.** Add `retain`/`visibility`/`precision`/`attributed`
  to `ClipRange`; the buffer's default (reapable + public) is the *absence* of an
  overriding range; marking a buffer slice private = creating a draft `Clip` + a
  `ClipRange` just to carve the override. *Pro:* reuses the existing manifest. *Con:*
  every "make this bit private / public" spawns a `Clip` row; overlapping ranges over
  the same buffer time get fiddly; `Clip`/`ClipRange` end up doing double duty (naming
  *and* store-truth).
- **Option B — a dedicated `DirectiveRange` table (Ben's lean).** First-class rows over
  the store: `{ userId, bufferSessionId, startAtMs, endAtMs, retain, visibility,
  precision, attributed, ordinal }` — the **single source of truth** the reaper,
  discovery, and serving all read. A **saved `Clip` becomes a named grouping** of
  retain-directives (presentation layer); the buffer default = no row = reapable +
  public(per-user default); a private buffer slice = one `DirectiveRange`, no `Clip`
  needed. *Pro:* clean split — directives describe *footage*, Clips *name* it; one thing
  to read everywhere. *Con:* new table + Clip↔DirectiveRange relation + migrating the
  existing per-clip columns into rows.

**This decision blocks PB3, not PB1.** PB1 ships **coarse** visibility (a per-stream
flag + a per-user default) — `Stream.visibility` (or a buffer-level flag) is all PB1
needs. The A/B call is the *target* shape for per-range (PB3); locking the direction now
just lets PB2/PB3 build toward it. **Ben's lean: B**, because un-saved public buffer
genuinely needs directives and forcing a `Clip` per "make-this-private" is awkward.

> Decide: **A or B** for the per-range target; and the **coarse PB1 flag** location
> (`Stream.visibility` vs `UserBuffer`/user default vs both).

### Contract 2 — the public serve / token policy

Today (`buffer.ts`): `mkToken(userId)` → HMAC `{u, e}` (1h TTL); `verifyToken` → userId;
serve routes return `buffers/<userId>/…`. Tokens are minted **owner-gated** (`/buffer/me`)
or for **ext-cams** (`/streams/:id/live.m3u8`, which mints `mkToken(hostId)` but is locked
to `ext-*` + live, with the comment *"never expose a regular user's buffer."*).

**The core problem:** the current token is **user-namespace-scoped** — a token grants all
of `buffers/<userId>/…`. That's too broad to hand a public viewer (it would authorize the
host's *entire* buffer, not one public session/range). So the PB0 call is how to narrow it.

- **Option 1 — public mint of the host token.** Reuse `mkToken(hostId)` for any public
  session. *Rejected:* over-grants the whole host namespace; no range scoping.
- **Option 2 — token-less public route, per-request visibility check.** A public serve
  route looks up session (and PB3: range) visibility per request, serves iff public, no
  token. *Pro:* instant revocation (flip private → next fetch 404s); no over-grant.
  *Con:* a DB/visibility lookup per **segment** request (HLS is chatty) — perf/caching
  cost; diverges from the token mechanism.
- **Option 3 — session-scoped public tokens + visibility enforced at manifest build
  (Ben's lean).** Token payload gains a **session (+ public) scope**: `{ session, scope:
  'public', e }`; the serve route resolves session→host internally and checks the
  requested segment belongs to that session — so a public token **can't roam the host's
  namespace**. The **public/private gate lives at manifest-build time**: the discover /
  detail / manifest only lists segments of **public** ranges, so flipping a range private
  drops it from the next manifest fetch (near-immediate effect); subscribersOnly is
  checked there before minting. *Pro:* keeps the efficient self-authorizing token, narrows
  the grant to one session, cheap privacy gate at the manifest layer. *Con:* a segment URL
  already minted is hittable until TTL (~1h) even after going private — but without the
  manifest a viewer won't request it; **strict per-segment revocation** is a later
  hardening (or shorten the public TTL).

> Decide: **serve mechanism** (Option 2 token-less vs Option 3 session-scoped token);
> the **public token TTL** (shorter = tighter revocation); and that **subscribersOnly +
> anon/precision are enforced at the manifest/detail layer** (read the range's *current*
> value), not baked into the token.

### Minimum to START (so PB0 ratification and PB1 can overlap)
- **PB1 needs only:** the **coarse visibility flag** (Contract 1's PB1 piece) + the
  **serve mechanism** (Contract 2). It does **not** need the A/B per-range table.
- **PB2 needs:** the reaper to read a `retain` signal — which can begin against the
  *coarse/Clip-level* `saved` today and generalize to per-range once A/B lands.
- So: lock **Contract 2 (serve) + the PB1 coarse flag** now → PB1 starts. Lock **A/B**
  in parallel → unblocks PB3. PB2 starts additive against today's `saved`.

### PB0 — open questions audit (2026-06-18)

What's **settled** (don't re-open): the core principle (CONTENT.md §3); per-range
directives; orthogonal retention × visibility (Reading B); keep-cap model (buffer=time,
saved=storage quota, saving decrements storage); the PB0–PB4 phasing.

**Still unanswered — grouped by what they block:**

*Blocks PB1 (answer to start):*
1. **Contract 2 serve mechanism** — Option 2 (token-less per-request check) vs Option 3
   (session-scoped token + manifest-build gate). [Aaron's lane; Ben leans 3]
2. **Coarse PB1 visibility flag location** — `Stream.visibility` vs `UserBuffer`/user
   default vs both. [Aaron]
3. **subscribersOnly buffer = a third serve tier.** A public buffer that's
   subscribers-only is neither open nor owner-private — it's auth+sub-gated. Decide:
   does it appear in the time machine as a **locked pin** (like live subs-only streams
   on the globe) and gate on *watch*, or is it **excluded** from the past entirely?
   And the serve path must handle three tiers (public / subs-gated / owner-private),
   not two. [Ben product + Aaron serve]

*Blocks PB2 (the careful phase):*
4. **Existing copied saved clips** — grandfather in `/media/clips` (recommend) vs
   reconcile into retain-in-place. [Aaron; Ben to bless]
5. **Additive→subtractive cutover** — copy-on-save and retain-in-place run together
   first (redundant, safe); the flip that *stops copying* needs a **verification gate**
   (prove a retained range survives a real reap cycle on device before we drop the
   copy). Not a hard unknown, but an explicit gate to agree. [Aaron + Ben verify]
6. **Delete vs un-save in one store (NEW question the model creates).** Un-save =
   remove `retain` → footage falls back to the reaper. But **permanent-delete of a
   saved clip whose footage is also live public buffer = the same bytes** — so delete
   removes it *everywhere* (public buffer included). Is "delete = gone everywhere" the
   intended semantic, or do we need delete-from-saved-only (just un-retain)? [Ben
   product call]

*Blocks PB3:*
7. **Contract 1 A vs B** — extend `ClipRange` vs a dedicated `DirectiveRange` table.
   [Aaron; Ben leans B]
8. **Per-user visibility default** — is the default itself user-changeable in v0.2, and
   where stored (`User.bufferVisibilityDefault`)? Or hardcoded public for now? [Ben]
9. **Mend differ-guard behaviour** — disable mend vs prompt-to-pick when adjacent
   ranges' directives differ. [Ben, UX — decide at build]

*Confirm-but-low-risk (same pattern as today's clips/discover):*
10. **Anon identity + precision on the public buffer** — discover honours the stream's
    `attributed` + go-live precision via the same COALESCE chain as `clips/discover`
    C4.5; un-directive'd buffer inherits the stream value. Confirm, don't redesign.
11. **Session = pin/viewer unit** — one `BufferSession` (a go-live span) = one
    time-machine pin; the viewer seeks to T within it (same seek math as clips).
    Confirm.

### PB0 — DECIDED (2026-06-18, Ben + Aaron)

All PB0 blockers resolved. These are now contract, not options:

1. **Contract 1 — `DirectiveRange` table (Option B).** A first-class table over the
   store — `{ userId, bufferSessionId, startAtMs, endAtMs, retain, visibility,
   precision, attributed, ordinal }` — is the **single truth** the reaper, discovery,
   and serving read. A saved `Clip` is a named grouping of retain-directives. Buffer
   default = no row = reapable + public. *(PB1 may read a coarse stream/user-level
   visibility while the table lands; the per-request serve check (below) reads whatever
   the current truth is — coarse flag in PB1, `DirectiveRange` from PB3.)*
2. **Contract 2 — per-request visibility check, instant revocation (Option 2).**
   Flipping a range private cuts it off for **everyone immediately**, including a viewer
   mid-watch — privacy-first. The serve route checks access **per chunk request** and
   serves iff allowed; **mitigate the load with a short-TTL cache** of the per-range
   access decision (not a per-request DB round-trip every time). No broad
   user-namespace token handed to viewers.
3. **Four access tiers** (the serve check + discovery both honour them):
   **open public · subscriber-gated · PPV-gated · owner-private.** Public + the gated
   tiers appear in the time machine as **locked pins** (watch requires auth + an active
   subscription / PPV access, like live today); **owner-private is excluded** from the
   past entirely. The per-request check resolves the tier (public → serve; subscriber →
   auth + active sub; PPV → auth + event access; owner-private → owner only).
4. **Permanent-delete = gone everywhere, now.** It destroys the one copy (segments off
   disk), so the public-buffer copy vanishes with it. **Un-save** stays the soft act
   (drop `retain` → footage falls back to the reaper, evicts when past the window).

**Remaining non-blocking defaults (Ben's calls unless overridden):**
- **Per-user visibility default:** hardcoded **public** for v0.2; a user-facing default
  setting is a PB4 add. (Override: ship the setting in v0.2 if wanted.)
- **Mend differ-guard:** **prompt-to-pick** when adjacent ranges differ (vs hard
  disable); keeping snipped always valid. Decide on device at build.
- **Existing copied saved clips:** **grandfather** in `/media/clips` (already survive
  eviction) — no rewrite.
- **PB2 cutover gate:** ship reaper-honours-`retain` **additively** (copy-on-save still
  running) → verify a retained range survives a real reap cycle on device → **then**
  stop copying.
- **Coarse PB1 flag location:** Aaron's pick (a per-go-live `Stream`-level public/private
  + the hardcoded user default is enough for PB1).

**Unblocked:** PB1 can start (serve = per-request check; PB1 visibility = coarse flag).
PB2 starts additive. `DirectiveRange` (Contract 1) is the PB3 schema. Ben's PB1 app
side (globe buffer pins + the buffer-session viewer, reusing the Time Machine consumer)
can scaffold against the agreed discover/serve shape now.

### PB0 — REVISION (2026-06-18): Contract 2 → windowed + a tunable window control

**Supersedes the "truly instant for everyone / per-request check" choice above.** Ben:
make revocation **windowed** with a **control we can play with**.

- **Serve = session-scoped self-authorizing token + manifest-build visibility gate.**
  Flipping a range private removes it from the next manifest fetch (new viewers can't
  find or open it immediately); a viewer **already mid-watch** can still reach those
  exact segments until the token expires.
- **The window = the public token TTL, exposed as an admin RemoteConfig knob**
  (e.g. `PUBLIC_BUFFER_TOKEN_TTL_SEC`), tunable live like the other globe knobs (app
  reads `usePublicConfig`; backend RemoteConfig ~30s cache). It spans the spectrum:
  **small TTL ≈ near-instant revoke** (more re-mint/token churn), **larger ≈ efficient
  serving + slower revoke** — so we dial in the privacy/load balance on device instead
  of hardcoding it.
- **Load profile:** the common path is cheap (self-authorizing segment fetches, no
  per-chunk DB hit); the privacy gate runs at **manifest build** (cheap, per fetch),
  not per segment.
- Everything else from PB0 DECIDED stands: `DirectiveRange` table, four access tiers
  (public/subscriber/PPV/owner-private; gated = locked pins, owner-private excluded),
  permanent-delete = gone-everywhere, the non-blocking defaults.

---

## PB1 — API contract (draft for ratification, 2026-06-18)

Build to this. **Additive + flag-gated** so flag-off is byte-identical to today.

### Safety rails (non-negotiable for PB1)
- **`PUBLIC_BUFFER_ENABLED` RemoteConfig flag, default OFF.** Off → discover omits
  buffer pins, the serve/detail route 404s, behaviour == today (saved clips only).
  Flip on **for the team first**, soak, then widen. One-switch kill.
- **`PUBLIC_BUFFER_TOKEN_TTL_SEC` RemoteConfig knob** = the revocation window (Contract
  2 revision). Exposed via `usePublicConfig` so it's tunable live.
- **Coarse visibility (PB1):** `Stream.visibility` `'public' | 'private'` (default
  `public`) set at go-live + the hardcoded per-user default. Per-range comes with
  `DirectiveRange` in PB3; the serve gate reads "current truth" (this flag now).

### Discovery — extend `GET /clips/discover?at=<ISO>` (additive)
Response gains a **`bufferPins`** array alongside the existing `clips` (unchanged).
Only present when the flag is on. Each pin = a public/gated buffer session live at T:

```
bufferPins: Array<{
  source: 'buffer'
  sessionId: string
  host: { id, handle, displayName, avatarUrl } | { handle:'anonymous', ... }  // anon-aware
  title: string | null
  lat: number; lng: number                       // display coords (precision-obfuscated)
  locationPrecision: 'exact' | 'city' | 'country'
  sessionStartMs: number; sessionEndMs: number   // endedAt ?? now
  seekOffsetSec: number                          // floor(T_sec - sessionStart_sec)
  accessTier: 'public' | 'subscriber' | 'ppv'    // owner-private is NEVER returned
  subscriptionPriceUsd?: number | null           // for the locked-pin card
  ppvEventId?: string | null
}>
```
Filter: `BufferSession ⋈ Stream`, `startedAt ≤ T ≤ endedAt‖now`, `Stream.visibility !=
'private'`, precision `!= off`; honour `attributed` (anon) + precision via the same
COALESCE chain as `clips/discover` C4.5. Gated tiers (subscriber/ppv) ARE returned (as
locked pins); owner-private excluded.

### Detail / serve — new `GET /buffer/session/:id` (optionalAuth), the `clips/:id` analog
```
200 { session: {
  id, title, host(anon-aware), startAtMs, endAtMs, accessTier,
  manifestUrl: string | null,                          // windowed-token HLS (primary)
  tracks: Array<{ kind, manifestUrl, dataUrl }>        // windowed-token; powers the source rail
}}
403  // subscriber/ppv tier + caller lacks access → app shows the locked state
404  // not found / owner-private / flag off
```
- **Tier enforcement** here: public → serve; subscriber → require auth + active sub;
  ppv → require auth + event access; owner-private → never (404).
- **Tokens** are session-scoped + self-authorizing, TTL = `PUBLIC_BUFFER_TOKEN_TTL_SEC`
  (no broad user-namespace grant). Manifest lists only public ranges (PB1: whole
  session; PB3: per-range). Segment fetches need no per-chunk DB hit.

### App side (Ben — drops onto the Time Machine consumer)
- `clipsApi.discover` reads `bufferPins`; the globe seam maps them like clip pins
  (a `clipToStream`-style adapter) → a **"Watch"** card; locked tiers render the
  subscribe/PPV locked card (reuse the live globe treatment).
- Tapping → a buffer-session viewer = **`ClipViewerScreen` generalized** to fetch
  `GET /buffer/session/:id` (same rail + broadcast clock + transport; just a different
  fetch + id space). 403 → locked state; 404 → graceful.

### Done-bar (PB1, flag-on for the team)
Roll the globe back → a teammate's **un-saved public buffer** shows as a pin at the
instant → Watch → it plays with the source rail + broadcast clock. A `private` go-live
does **not** appear. A subscriber-only session shows as a **locked pin**. Flipping
`PUBLIC_BUFFER_ENABLED` off restores today's saved-clips-only past.

### PB1 — app scaffold LANDED (Ben, 2026-06-18), flag-gated, awaiting Aaron's backend

The app side is built to the contract above and **degrades gracefully** until the
backend ships (discover returns no `bufferPins` → nothing extra; the viewer 404s on a
buffer id → graceful blocked state). `tsc` clean; pure JS, no rebuild.

- **`src/api/clips.ts`** — `discover` now returns `{ clips, bufferPins }` (additive;
  `bufferPins` empty unless the backend sends it). New **`BufferPin`** type +
  **`getBufferSession(id)`** → `GET /buffer/session/:id`, normalised into `ClipDetail`
  so the viewer is source-agnostic.
- **`src/hooks/useHistoricalClips.ts`** — returns `{ clips, bufferPins }`.
- **`src/hooks/usePublicConfig.ts`** — new **`configBool`** helper.
- **`GlobeScreenMapbox`** — reads **`PUBLIC_BUFFER_ENABLED`** (`configBool`, default
  false; defensive on top of the backend gate); `bufferPinToStream` adapter; the
  historical `pins` set = clip pins **+** buffer pins; `watchHistorical(id)` routes the
  viewer with `source: 'buffer' | 'clip'`; locked tiers render the existing
  subscriber/PPV locked card.
- **`ClipViewerScreen`** — reads a `source` param; `source==='buffer'` fetches
  `getBufferSession` (same rail + clock + transport, different fetch + id space).

**What's needed to light it up (Aaron, PB1 backend, to the contract):** `Stream.visibility`
(coarse), `bufferPins[]` in `clips/discover`, `GET /buffer/session/:id` with the 4-tier
gate + session-scoped windowed tokens, and the `PUBLIC_BUFFER_ENABLED` +
`PUBLIC_BUFFER_TOKEN_TTL_SEC` RemoteConfig keys. Flip the flag on for the team → the
PB1 done-bar.

---

## ← BACK TO BEN (2026-06-18, Aaron): PB1 backend DONE + deployed (flag OFF) — your flip + on-device

**All five PB1 backend items are built, deployed on `api.wrld.cam`, and pushed**
(`wrld-backend dc2970d`, `wrld-mediasoup 6c50c9b`). Flag-gated + **OFF by default**, so
prod behaviour == today until someone flips it. Verified on the box:

- ✅ **RemoteConfig** `PUBLIC_BUFFER_ENABLED` (bool, **false**) + `PUBLIC_BUFFER_TOKEN_TTL_SEC`
  (number, **3600**) — seeded by migration, **exposed on `GET /config`** (confirmed the app
  will see them via `usePublicConfig`/`configBool`).
- ✅ **`Stream.visibility`** `'public'|'private'` (default `'public'`) — migration applied
  (column live), threaded through `streamStarted` + mediasoup `createRoom→streamStarted`.
- ✅ **`clips/discover` → `{ clips, bufferPins }`** — flag-off returns `bufferPins: []`
  (verified). Flag-on, the query returns public `BufferSession ⋈ Stream` live at T,
  reap-aware (`UserBuffer.earliestAt`), precision-obfuscated, `accessTier`
  (`public`/`subscriber`/`ppv`), owner-private excluded. **Validated the SQL against prod
  data** (returns real live public sessions, incl. a PPV one → `accessTier:'ppv'`).
- ✅ **`GET /buffer/session/:id`** (optionalAuth, the `clips/:id` analog) — flag-off → 404
  (verified); flag-on → 4-tier gate (public serve / subscriber+sub / ppv+access /
  owner-private→404), `manifestUrl` + per-source `tracks[]`, **session-scoped windowed
  tokens** (TTL = `PUBLIC_BUFFER_TOKEN_TTL_SEC`).
- ✅ **Token scoping** — public tokens carry a session claim and reach ONLY that session's
  serve routes (can't roam the host namespace); owner tokens unchanged.

**Matches the contract shapes** in the "PB1 — API contract" + "PB1 app scaffold LANDED"
sections — `bufferPins[]` and `getBufferSession`'s `ClipDetail` normalisation should line up.

**→ Over to Ben/team:**
1. **Flip `PUBLIC_BUFFER_ENABLED` on for the team** (`/admin/config`), soak, then widen —
   that's the deliberate rollout call, so I left it OFF.
2. **On-device done-bar** (below): roll the globe back → a teammate's un-saved public buffer
   shows as a pin → Watch → plays with rail + clock; a `private` go-live doesn't appear; a
   subscriber-only session shows as a locked pin; flag off → today's saved-clips-only past.
3. **One deploy note:** mediasoup is pushed but its **restart is deferred** (the `visibility`
   passthrough is inert until both the flag is on AND the app sends `visibility` at go-live;
   I didn't want to interrupt the live streams / Bol Harbour ext-cam). Restart
   `wrld-mediasoup` at a convenient time to activate the passthrough. Until then a go-live
   sends no `visibility` → backend defaults `'public'` (the intended PB1 default anyway).

If discover/serve shapes need a tweak to match the app, send me the mismatch.
PB2 (retain-in-place) + PB3 (`DirectiveRange`) are the next backend slices.

---

## PB1 — Aaron START-HERE (backend, to the contract above) — ✅ COMPLETE (kept for the record)

The app is built + merged (flag-off, degrades gracefully). PB1 ships when these land
and the flag flips. Build to the **PB1 API contract** + **PB0 DECIDED** sections above.
All additive + flag-gated → flag-off == today.

1. **RemoteConfig keys** (allowlist + the public `/config` output so the app sees them):
   - `PUBLIC_BUFFER_ENABLED` — bool, **default false** (the kill switch; flip on for the
     team first).
   - `PUBLIC_BUFFER_TOKEN_TTL_SEC` — number (the revocation window; start generous, tune
     live).
2. **`Stream.visibility`** column — `'public' | 'private'`, **default `'public'`**, set at
   go-live (carry it on the `createRoom` / `streamStarted` payload like the other fields).
   Coarse PB1 visibility; per-range `DirectiveRange` is PB3.
3. **`clips/discover?at=` → add `bufferPins[]`** (only when the flag's on; `clips`
   unchanged): `BufferSession ⋈ Stream` where `startedAt ≤ T ≤ endedAt‖now`,
   `Stream.visibility != 'private'`, precision `!= off`; honour `attributed` (anon) +
   precision via the **same COALESCE chain as C4.5**; compute `seekOffsetSec`; set
   `accessTier` (`public` / `subscriber` = subscribersOnly / `ppv` = has ppvEventId);
   **owner-private excluded**. Exact shape in the PB1 contract.
4. **`GET /buffer/session/:id`** (optionalAuth) — the `clips/:id` analog: returns
   `{ session: { id, title, host(anon-aware), startAtMs, endAtMs, accessTier,
   manifestUrl, tracks[] } }` with **session-scoped windowed tokens** (TTL =
   `PUBLIC_BUFFER_TOKEN_TTL_SEC`). **4-tier gate:** public → serve; subscriber → auth +
   active sub (else 403); ppv → auth + event access (else 403); owner-private → 404.
   Flag-off → 404.
5. **Narrow the public token to a session** (add a session claim) so a handed-out token
   can't roam the host's whole `buffers/<userId>/` namespace; the existing
   `/buffer/stream/:sessionId/...` serve routes accept it for **that session only**.

**Done-bar (flip the flag on for the team):** roll the globe back → a teammate's
**un-saved public buffer** shows as a pin at the instant → **Watch** → plays with the
source rail + broadcast clock. A `private` go-live does **not** appear. A subscriber-only
session shows as a **locked pin**. Flag off → today's saved-clips-only past.

*(Then PB2 — reaper honours `retain`, additive — and PB3 — the `DirectiveRange` table.)*

### PB1 — app COMPLETE incl. the private opt-out (Ben, 2026-06-18)

Verified Aaron's backend against prod (`/config` exposes both keys; `clips/discover` →
`{clips:[],bufferPins:[]}`; `/buffer/session/:id` → 404 flag-off). Then finished the
app's missing half — **sending `visibility` at go-live** (the private opt-out):

- **`captureConfig.visibility`** `'public' | 'private'` (default `public`), persisted.
- **`createRoom` chain** carries `visibility?` (`mediasoupSignaling` + `useSignaling` +
  `StreamScreen` go-live passes `c.visibility`).
- **Dashboard "Public replay" toggle** — on = public (in the time machine), off =
  private (live-only). **Gated on `PUBLIC_BUFFER_ENABLED`** so it only appears once the
  feature is flipped on. Coarse per-go-live (per-range is PB3).

**To light up the full PB1 done-bar, two ops actions remain (not code):**
1. **Flip `PUBLIC_BUFFER_ENABLED` on** for the team (`/admin/config`).
2. **Restart `wrld-mediasoup`** — Aaron deferred it, so until then `createRoom`'s
   `visibility` is dropped at the relay and the backend defaults `'public'` (the
   public-buffer headline still works; the **private opt-out won't take effect until the
   restart**).

Then on device: public go-live → appears in the past with the rail/clock; **private
go-live → does NOT appear**; subs-only → locked pin; flag off → today's behaviour.

---

## PB1 — ✅ VERIFIED ON DEVICE (Ben, 2026-06-18) → PB2 is next (Aaron)

On-device tests pass: Time Machine + the PB1 public buffer (pin in the past → Watch →
rail/clock). Headline working. *(Private opt-out activates with the deferred
`wrld-mediasoup` restart — confirm "private go-live doesn't appear" once that's done if
not already.)* PB1 is closed.

## ✅ PB2 CUTOVER GATE PASSED (2026-06-18) — verified end-to-end on prod

Flag flipped on (`PB2_RETAIN_IN_PLACE=true`) + a real clip saved by **@ben** in the app:
- **Save = retain-only, NO copy** — clip `manifestUrl` null, `storagePath` empty, no
  `/media/clips/<id>` dir; `usedStorageBytes` charged the retained bytes (964 KB); log
  `PB2 retain-in-place save — NO copy` fired.
- **Owner playback** — confirmed playing in Ben's library (in-app).
- **Public playback** — `GET /clips/:id` → buffer manifest **200** (7 segs + init), `init.mp4`
  **200**, segment (range) **206**, `location` data track **200** — per-session public tokens
  authorise the segments.
- **Un-save** — clip row + ranges + tracks gone, **buffer footage survived on disk**, storage
  reclaimed exactly.

The cutover is proven. **Flag left ON = retain-in-place is live** (new saves stop copying).
Remaining: the no-flip-back rule holds (don't flip OFF while retain-only saves exist, or
they lose footage past the window). Below: the pre-gate cutover notes, kept for the record.

### ✅ PB2 CLOSED (2026-06-18) — post-gate cleanup done
- **Doubled time-machine pin — FIXED** (`d02c025`). Cause: `clips/discover` returned a saved
  clip in `clips[]` AND its public buffer session in `bufferPins[]` (same footage → 2 pins).
  Fix: dedup — drop the clip pin when its buffer session is already a public `bufferPin`
  (clips whose session isn't a public pin — private/reaped/legacy — still show). Verified on
  device: single pin, saves + reaping behave.
- **Grandfathered `/media` copies — DELETED.** The 2 legacy copied clips (test data) removed
  (rows + files + quota reclaimed); `/media/clips` empty. Everything is retain-in-place now.
- Lightweight `tag:PB2` save/serve logs left in (cheap info tracing).
- **The whole PB0–PB2 path (public buffer + retain-in-place) is DONE + verified on prod.**

## ← PB2 CUTOVER (step 3+4) DONE + deployed INERT (Aaron, 2026-06-18); ⛔ cutover gate is YOURS

Step-1 gate passed (you confirmed a retained range survived a reap cycle), so I built +
deployed the **full cutover for ALL clips** (your call) — `wrld-backend 4051e61`. Gated by
the **same `PB2_RETAIN_IN_PLACE` flag** so reaper-protect + stop-copy + buffer-serving are
always coherent; **flag OFF = full rollback to copy-on-save.**

**I deployed it INERT: I flipped `PB2_RETAIN_IN_PLACE` back OFF first** (your existing saves
still have `/media` copies, so that's safe). Why: your step-1 gate proved *footage survival*,
but the cutover **serving** (stop-copy + play-from-buffer) is newly written and only
typecheck/unit-tested — it needs one on-device playback check before it's load-bearing.
`PUBLIC_BUFFER_ENABLED` left **ON** (PB1 verified).

What the cutover does when the flag's on: a save makes **no copy** — it's a retain directive
over the buffer; the clip serves from the buffer (owner via the draft-stitch; public via a
new `GET /clips/:id/buffer/index.m3u8` with clip-scoped → per-session public tokens);
`usedStorageBytes` charges the retained buffer bytes. Edit = pure manifest writes (no
ffmpeg); un-save = drop retain (buffer untouched, reaper reclaims later).

**⛔ Cutover gate (on device) — flip `PB2_RETAIN_IN_PLACE=true`, then:**
1. **Save** a clip → confirm **no `/media/clips/<id>` dir is created** (it's retain-only) and
   `usedStorageBytes` still went up (charged the retained bytes).
2. **Owner playback:** the saved clip plays from your library (buffer-stitched).
3. **Public playback:** open it via the time machine / `clips/:id` → it plays for a viewer.
4. **Un-save** → the clip's gone, buffer footage remains; storage reclaimed.

**🚨 No-flip-back invariant (important):** once you've made REAL retain-only saves with the
flag on, **don't flip it back off** — the reaper would stop honouring their retain and their
footage (which now has *no copy*) reaps when it ages past the window. Flag-off is only safe
while saves are still copying (i.e. before you commit to the cutover, or after a re-copy
migration). For the gate, test clips are fine to lose; for real use, on means on.

If anything's off, send me the failing `GET /clips/:id` or `/buffer/me/clips` payload.
*(Below: PB2 step 1's earlier note + the original START-HERE, kept for the record.)*

## ← PB2 step 1 DONE + deployed (Aaron, 2026-06-18); ⛔ verification gate is YOURS next

**Step 1 (reaper honours `retain`, ADDITIVE) is built, deployed, pushed** (`wrld-backend
817c3e0`), **flag `PB2_RETAIN_IN_PLACE` OFF by default** → the reaper is byte-for-byte
unchanged right now, copy-on-save still fully protects saved footage. Nothing has cut over.

- `bufferService.reapBuffers`: when the flag's on, a buffer segment whose capture instant
  (its mtime — fMP4 segments are written once) falls within one of the user's **saved-clip
  retained ranges** (`ClipRange` windows of `saved` Clips, keyed by `bufferSessionId`) is
  `isProtected` → never evicted by the age-trim or the byte backstop. Clip-level retain
  today (no `DirectiveRange` — that's PB3). Pure `coveredByRetain` (+4s boundary pad) is
  unit-tested (138 tests green). Migration seeds `PB2_RETAIN_IN_PLACE` (boolean, **false**;
  internal, not on `/config`).

**⛔ The verification gate (step 2) is on-device and yours — do it BEFORE any cutover:**
1. On `/admin/config` set **`PB2_RETAIN_IN_PLACE=true`** (and temporarily tighten
   `BUFFER_WINDOW_HOURS_<TIER>` low to force a reap fast).
2. Save a clip, then let footage age past the (tightened) window so the reaper runs.
3. **Confirm the retained range's segments stay on disk AND still play** — and that
   *non*-retained footage past the window still gets reaped (protection is scoped, not
   global). If a retained range survives a real reap cycle → gate passed.
4. Restore the window; leave the flag on or off as you choose (off = back to today).

**Only after the gate passes** do I proceed to step 3 (cutover — `saveClip`/`promoteBufferClip`
stops copying; saving = set retain only) + step 4 (retained-bytes quota over one store).
Ping me with the gate result and I'll do the cutover. *(I can't run the on-device reap
cycle from the box — hence the handback.)* Below is the original START-HERE for reference.

## PB2 — Aaron START-HERE (retain-in-place; backend + mediasoup)

The simplification: **drop copy-on-save — "saving" becomes a `retain` directive the
reaper honours in place** (CONTENT.md §3). **This is the careful, high-stakes phase**
— the reaper must NEVER evict a kept range (the one principle we can't violate:
"never silently drop content a user chose to keep"). So it ships **additive first,
behind a verification gate.**

1. **Reaper honours `retain` — ADDITIVE (copy-on-save still running).** In
   `bufferService.reapBuffers`, before evicting a buffer segment, **skip it if a
   retained range overlaps it** (or it's in the live window). PB2 can read retain at
   the **clip level today** (a `saved` Clip's `ranges` = retain for that user) — no
   `DirectiveRange` needed yet (that's PB3). Copy-on-save stays on; this just proves
   the reaper can keep footage in place.
2. **⛔ VERIFICATION GATE (on device, before step 3).** Confirm a retained range
   **survives a real reap cycle** — footage older than the tier window but covered by a
   retain stays on disk AND still plays. Do **not** proceed to the cutover until this
   passes. (Tighten the test buffer window via RemoteConfig to force a reap quickly.)
3. **Cutover: stop copying.** Once step 2 is proven, `saveClip` / `promoteBufferClip`
   **stops copying bytes** — saving = set `retain` only; un-save = clear it (footage
   falls back to the reaper, evicts when past the window).
4. **Quota accounting over one store.** Retained-bytes quota = **sum of retained
   ranges** (replaces the copied-pool size); `GET /buffer/me` storage fields
   (`usedStorageBytes`) reflect it. Saving still decrements available storage.
5. **Permanent-delete = gone everywhere** (decided): destroy the segments (the one
   copy) — buffer + saved vanish together. **Un-save** stays the soft release.
6. **Grandfather** existing copied saved clips in `/media/clips` — leave as-is (they
   already survive eviction); no rewrite.

**App side for PB2: ~none.** Drag-to-save already calls `saveClip`; un-save/delete
already exist; the storage meter already reads `/buffer/me`. Behaviour is unchanged to
the app — the change is server-side (no copy). I'll wire any app touch-ups if the
contract shifts.

*(Then PB3 — the `DirectiveRange` table → per-range `retain`/`visibility`/precision/
identity + the per-segment settings UI + the mend differ-guard. That's where the app
comes back in.)*

---

## PB3 — per-range directives (plan + contract for sign-off, 2026-06-18)

PB0–PB2 done. PB3 moves `retain`/`visibility`/`precision`/`identity` from coarse
(per-stream / per-clip) to **per-range**, with `DirectiveRange` as the single source of
truth. **This rewrites how the reaper/discovery/serving read retain+visibility → joint
sign-off before the read-path build.** Flag-gated (`PB3_PER_RANGE`, default OFF) so flag-off
== PB2-today.

### ✅ Landed (additive, inert) — `a4867e9`
- **`DirectiveRange`** table (Contract 1 / option B): `{ id, userId, bufferSessionId,
  startAtMs, endAtMs, retain, visibility, precision?, attributed, ordinal, clipId? }`.
  `Clip.directiveRanges` relation. A saved Clip = grouping of retain rows (clipId set); an
  un-saved private buffer slice = a row with clipId null. Buffer default = NO row (reapable
  + public). Nothing reads/writes it yet.

### Backend read-path migration (mine, flag-gated `PB3_PER_RANGE`)
1. **Write path** — `saveClip`/draft-edit + the per-segment settings PATCH write
   `DirectiveRange` rows (retain=true for a save; visibility/precision/attributed per
   segment). One-time **backfill**: every existing retain-in-place saved clip's `ClipRange`s
   → `DirectiveRange(retain=true, clipId)` so the reaper keeps honouring them after cutover.
2. **Reaper** (`bufferService.reapBuffers`) — read retain from `DirectiveRange(retain=true)`
   instead of (PB2) the saved-clip `ClipRange`s. Same `coveredByRetain` math, new source.
3. **Discovery** (`clips/discover` bufferPins) — a session pins if it has ANY public range
   at T; replace the coarse `Stream.visibility` gate with per-range (a session can be
   part-public/part-private). Precision/anon read per range (COALESCE range → stream → exact).
4. **Serve** (`/buffer/session/:id`, `/clips/:id/buffer`, the per-session serve) — the
   built manifest **excludes segments in private ranges** (per-range visibility); precision/
   identity per range. Contract 2 (revision): session-scoped **windowed token** + the gate
   at **manifest-build** (flip a range private → it drops from the next manifest fetch).
5. **Coarse → per-range**: `Stream.visibility` (PB1) stays as the session DEFAULT a
   broadcaster picks at go-live; `DirectiveRange` overrides per slice. No PB1/PB2 break.

### App (Ben) — the per-range UX
- **Per-segment settings affordance:** each snipped segment carries its own
  public/private (+ later precision/identity); writes a `DirectiveRange` via the PATCH.
- **Mend differ-guard:** when adjacent segments' directives differ, **prompt-to-pick**
  (decided default) which to keep; keeping them snipped is always valid.

### Resolves
- The known PB2 limitation (multi-session data tracks on a public clip) — per-range serving
  builds the manifest from `DirectiveRange` across sessions uniformly.

### Sign-off ask (Ben + Aaron)
Confirm: (a) `DirectiveRange` shape above; (b) the write path = `saveClip` + a per-segment
PATCH; (c) reaper/discover/serve read `DirectiveRange` with `Stream.visibility` as the
session default; (d) flag `PB3_PER_RANGE` (default off) + the `ClipRange→DirectiveRange`
backfill. On sign-off I build the read-paths flag-gated (additive), gate on device, then flip.

## PB4 — private polish (mostly Ben/app; backend guardrail audit)
After PB3: per-user visibility default setting (`User.bufferVisibilityDefault`), the
public/private per-range toggle UI + distinct-segment visual (Ben), and a backend guardrail
audit (subscribersOnly buffer keeps the paywall on replay; anon/precision reversibility
honoured on the public buffer). Small backend; mostly app.

---

## → BEN: PB3 per-segment settings UI (2026-06-19) — backend write endpoint is LIVE

PB3 steps 1–2 done (DirectiveRange written on save + read by the reaper, flag-gated).
**Step 3a is deployed:** the per-segment **write** endpoint your settings UI calls. The
**enforcement** (discover hides private at T; serve excludes private segments) is step 3b
(Aaron, next). All gated by `PB3_PER_RANGE` (default OFF).

### The endpoint (owner-gated, flag-gated)
`PATCH /buffer/me/sessions/:id/directives`
```
{ directives: [
    { startAtMs, endAtMs,                 // a [start,end) slice of THIS buffer session
      visibility: 'public' | 'private',   // default 'public'
      precision?: 'exact'|'city'|'country'|'off' | null,  // null = inherit (optional, later)
      attributed?: boolean }              // default true (optional, later)
] }
→ 200 { ok: true, count }
→ 409 if PB3_PER_RANGE is off   ← see "gate the UI" below
```
- **Authoritative full list per session** (same shape as `/splits`): send every
  non-default segment; **omit a range → it reverts to default** (public / inherit /
  attributed). Replaces the session's standalone directives; saved-clip retain rows
  are untouched.
- Headline use: mark a segment **private** → (once 3b lands) it drops out of the time
  machine + stops serving, while staying live-viewable and (if saved) kept.

### Your UI (per the signed-off plan)
- **Per-segment settings affordance:** each snip segment (your `splitPoints`) carries
  its own public/private toggle → on change, PATCH the full `directives` list for the
  session. (Precision/identity per segment can come later; visibility is the headline.)
- **Mend differ-guard:** when adjacent segments' directives differ, **prompt-to-pick**
  which to keep (decided default); keeping them snipped is always valid.
- **⚠️ Gate the toggle on the flag:** only show the per-segment private toggle when
  `configBool('PB3_PER_RANGE')` is true. The endpoint 409s when off, and — more
  importantly — a "private" mark isn't enforced until 3b + the flag are live, so showing
  it while off would give a false sense of privacy. (Same `usePublicConfig` path as the
  other globe flags — I'll add `PB3_PER_RANGE` to the public `/config` allowlist when we
  flip it on for the team; ping me and I'll expose it.)

### Status / next
**Backend PB3 is COMPLETE** (2026-06-19): 3a write endpoint + 3b enforcement both LIVE
(flag-gated `PB3_PER_RANGE`, off). Enforcement: discover hides a session pin when the
instant is inside a private range; the public serve (clip + session) excludes private
windows from the built manifest; the OWNER still sees everything (session-scoped token =
public viewer, owner token = full). So the moment your per-segment UI writes a private
directive (+ the flag's on), it vanishes from the past + won't serve publicly.
**Over to you:** build the per-segment toggle (the PATCH contract above) + the mend
differ-guard. When ready, ping me to (a) add `PB3_PER_RANGE` to the public `/config`
allowlist so the app can `configBool` it, and (b) flip it on for the team for the
on-device gate (mark a segment private → pin vanishes + won't serve; owner still sees it).

### PB3 — app per-segment public/private SCABBED IN (Ben, 2026-06-19) → Aaron, flip when ready

Built Option A (public/private per segment), wired full-suite-ready. Lives in the clip
grid (`ClipsScreen`) by the scissor — **needs a redesign, scabbed in for now** per Ben.

- **`bufferApi.patchDirectives(sessionId, directives)`** → `PATCH /buffer/me/sessions/:id/directives`
  with the authoritative full list. `SegmentDirective` carries `visibility` (set today) +
  `precision?`/`attributed?` (accepted now, UI later — no API change to add them).
- **Grid control:** select a BUFFER segment → an **eye/lock toggle** appears above the
  scissor → marks that segment public/private → PATCHes the session's private ranges
  (public omitted = default). **Gated on `configBool('PB3_PER_RANGE')`** — dormant until
  you allowlist + flip it.
- **Mend differ-guard:** un-snipping two segments whose privacy differs → Alert
  prompt-to-pick (Public / Private / Cancel); same/none → merge silently.
- **Scab-in caveats (for the redesign):** (1) no `GET` directives yet, so marks don't
  survive a reload — the **enforcement** (discover/serve) is real, only the local UI
  reflection is ephemeral; a read endpoint would let the grid rehydrate. (2) range-keyed
  matching (±1s) is provisional. (3) the control placement is a stopgap by the scissor.

**→ Aaron:** (a) add `PB3_PER_RANGE` to the public `/config` allowlist so `configBool`
sees it, (b) flip it on for the team. Then on-device: mark a segment private → its pin
vanishes from the time machine + won't serve publicly, while you (owner) still see it.
A `GET /buffer/me/sessions/:id/directives` (or fold directives into `GET /buffer/me`)
would make the marks survive reload — nice-to-have for the redesign.

tsc clean; pure JS, no rebuild.

### ← Aaron (2026-06-23): allowlist + rehydration DONE; only the flip remains
- ✅ **`PB3_PER_RANGE` added to the public `/config` allowlist** (`790e775`) — `configBool('PB3_PER_RANGE')` now reads it; still `false`, so the toggle stays dormant.
- ✅ **Directives folded into `GET /buffer/me`** (`4be347c`) — each session now returns
  `directives: [{ startAtMs, endAtMs, visibility, precision, attributed }]` (its standalone
  clipId-null overrides; `[]` = all default). **Closes the scab-in reload caveat** — the grid
  can rehydrate per-segment public/private marks on load. (No separate GET route; it's on the
  data source the grid already fetches.)
- ⏳ **Only the flip is left:** set `PB3_PER_RANGE = true` in `/admin/config` (team rollout
  + the on-device gate — mark a segment private → pin vanishes + won't serve publicly; owner
  still sees it). Left for you (deliberate rollout, same as PB2/PB3 gates); ping me to flip it
  via DB instead. Backend is fully ready (write + reaper + discover/serve enforcement + rehydration).

---

## PB3 — on-device test findings (Ben, 2026-06-23)

PB3 flag live + tested on device. Results:

- ✅ **Public buffer clip → pin shows in the time machine.**
- ✅ **Mend reconciliation prompt** looks good.
- ✅ **#3 saved-lane symmetry — FIXED (app, Ben).** The per-segment public/private toggle
  now shows for a selected **saved** clip too, not just buffer (gate changed from
  buffer-lane-only to "any selected segment with a `sourceSessionId`"). Post-PB2
  (retain-in-place) a saved clip's footage stays in its buffer session, so the SAME
  `patchDirectives` range (over `sourceSessionId`) governs its pin — symmetric, the only
  lane difference is reaper survival (per Ben).
  > **→ Aaron, confirm one edge:** a saved clip is hidden via a DirectiveRange only if it's
  > **deduped to a `bufferPin`** (its session is a live/retained public bufferPin). For a
  > saved clip that surfaces via the `clips` array instead (session fully gone, or a legacy
  > clip), the directive won't hide it — that path filters on `Clip.visibility`. Confirm
  > retain-in-place keeps saved clips on the bufferPin path (expected), else discover's
  > `clips` filter must also honour directives (or marking a saved clip private must also
  > set `Clip.visibility`).

- 🐛 **#2 private pin flickers on scroll + reappears after the clip's end — NEEDS AARON
  (discover semantics).** Diagnosis from the deployed query: a **bufferPin is per-SESSION**,
  spanning `[startedAt, endedAt ?? NOW]`, and is hidden **only at instants `T` inside a
  private DirectiveRange**. So:
  - **"Shows after the clip end":** the private directive covers the marked segment's range,
    but the session pin spans the whole session (incl. any public footage after the segment,
    and up to **NOW** if the session is still live). At `T` past the private range the pin
    correctly-but-confusingly reappears for that **public** footage. → Decide the intended
    semantic: should marking a clip private hide the session pin across the clip's footage
    only (current), or should a fully-private-clip session not reappear? **Measure first:**
    for a STOPPED session marked **entirely** private, does the pin still show after its end?
    If yes → a range/end mismatch bug; if only when there's real public tail → working as
    designed but needs a product call.
  - **"Reveals momentarily as I scroll":** the globe queries the past in **5 s buckets**
    (`useHistoricalClips`) + keeps prior pins via `placeholderData` during the fetch, so near
    a private-range edge the queried instant lags the visual playhead and the pin flashes.
    App-side cadence — can tighten (smaller bucket / query-at-exact-playhead) but it trades
    more fetches; holding until the per-session-vs-per-segment semantic above is settled.

- ✅ **Rehydration DONE (app, Ben, 2026-06-23):** the grid seeds `privateSegs` from each
  `/buffer/me` session's `directives[]` on first load (`BufferSession.directives` typed;
  seed-once via a ref so a later refetch doesn't fight an in-flight optimistic toggle), so
  private marks survive a reload.

### PB3 finding — snipped public+private segments read as one permission (Ben, 2026-06-23)

Snip a clip → mark one segment private, the other public → time machine treats BOTH the
same. **Same root as #2.** Cause (app): the globe queried the past in **5 s buckets**, so
for a short clip snipped into ~5-10 s segments the queried instant `T` couldn't resolve
which segment the playhead was in → the single per-session pin read one permission for
both. **Fix (Ben):** `useHistoricalClips` bucket **5 s → 1 s** (matches the globe's 1 s
playhead ticker), so per-segment privacy now resolves as the playhead crosses the snip.

**→ Aaron, please also verify backend-side** (so we know the bucket was the whole cause):
that the per-segment **DirectiveRange** rows are written + read **per-range** — i.e. for a
session with A=[t0,ts] private and B=[ts,t1] public, `clips/discover` hides the pin at
`T∈A` and shows it at `T∈B`. (The deployed `NOT EXISTS … dr.startAtMs<=T<dr.endAtMs`
check looks per-range; confirming rules out a write/dedup issue.) Note the **single pin
per session** model: scrubbing across the snip toggles that one pin — there isn't a
separate pin per segment. If the product wants distinct simultaneous representation,
that's a bigger discover/representation change.
