# Path — Public buffer + one-store / retain-in-place (PB0–PB4)

**Decided with Ben 2026-06-18.** Principle is canonical in **CONTENT.md §3** (with
§1.3/§1.5/§2.5/§5/§7/§8/§9 updated) + the dated CLAUDE.md update. This doc is the
**implementation path** — no code written yet.

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
