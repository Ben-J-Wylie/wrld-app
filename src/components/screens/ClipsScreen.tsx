// src/components/screens/ClipsScreen.tsx
//
// Clips landing — the first page from the Clip (footer) button. This screen owns the DATA +
// orchestration; the `ClipsTimeline` feature owns the horizontal, collapsed-gap two-lane
// rendering (reaper/oldest left → now right; pinch to zoom). Buffer lane = footage MINUS the
// saved ranges (the carve — `carveBuffer`); saved lane = the durable Clip pool (useSavedClips).
//
// A saved (possibly trimmed) clip carves just its range out of its source session; the
// remainder stays in the buffer lane, so a saved range shows in exactly one lane (and a carved
// range can't be re-saved). Saving COPIES (the buffer footage is untouched — verified), so this
// is a pure display computation; clips carry their own durable poster + manifest.
//
// Single-tap → preview in the sticky ClipViewer (driven by the transport + clock); double-tap →
// editor; drag a buffer block DOWN to save, a saved block UP to un-save (optimistic carve via
// `pendingSaves` / un-save via `pendingDelete`).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { Alert, StyleSheet, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Pressable } from '@/components/primitives/Pressable'
import { type LaneClip } from '@/components/features/clip/ClipLane'
import { ClipsTimeline, type ClipsTimelineHandle } from '@/components/features/clip/ClipsTimeline'
import { ClipViewer } from '@/components/features/clip/ClipViewer'
import { BufferTransport } from '@/components/features/clip/BufferTransport'
import { TimeScrubber } from '@/components/features/discovery/TimeScrubber'
import { useVideoPlayer, VideoView } from 'expo-video'
import { RTCView } from 'react-native-webrtc'
import { useBuffer } from '@/hooks/useBuffer'
import { useSavedClips } from '@/hooks/useSavedClips'
import { useDrafts } from '@/hooks/useDrafts'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { serverNow, feedServerNow } from '@/lib/serverClock'
import { bufferApi, type BufferSession } from '@/api/buffer'

const FRAME_MS = 1000 / 30 // one frame at the 30fps capture (transport frame-step)
const GAP_RUSH_MS = 3000 // real-time duration to "rush" the clock across an unbroadcasted-time gap
const PLAYHEAD_MAX_STEP_MS = 1000 // backgrounding guard: cap a single playhead advance. Routine jank is
// sub-second so it passes through fully (no drift); only a true app suspension is capped (no wild leap).
const DRIFT_TOL_S = 0.4 // only re-seek the (follower) video if it drifts more than this from the playhead
// Inter-clip gaps at/below this are split SEAMS (a snip, or adjacent buffer/saved pieces), not real
// unbroadcasted gaps — the clock plays straight across (no gap card). Matches the timeline's own
// gap-collapse threshold, so playback and the drawn timeline agree on what counts as a gap.
const SEAM_GAP_MS = 500


const MATCH_TOL_MS = 2000 // window tolerance matching an optimistic save to its real Clip
const MIN_REMAINDER_MS = 1000 // don't show carved remainders shorter than this
// The optimistic live clip — synthesized from go-live so the build is INSTANT, before the backend
// creates the real buffer session (~seconds). Its synthetic session id marks it as the live tail so
// the timeline extends it to nowUI; it's dropped the moment the real session appears.
const OPT_LIVE_SESSION = 'live:optimistic'
const OPT_LIVE_ID = 'live:optimistic'

const sessionStartMs = (s: BufferSession) => Date.parse(s.startedAt) + (s.mediaStartOffsetMs ?? 0)
// `?? 0` matters: a brand-new live session can have BOTH duration fields undefined.
const sessionEndMs = (s: BufferSession) => sessionStartMs(s) + (s.mediaDurationSec ?? s.durationSec ?? 0) * 1000

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtTime(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtDur(sec: number) {
  const t = Math.max(0, Math.round(sec))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// ── carve: the buffer lane shows footage MINUS the saved ranges ──────────────
// A saved (possibly trimmed) clip carves its range out of its source session; the leading /
// trailing remainder stay as buffer entries you can still clip. Whole-session save → nothing
// remains (the "move" case). Backend keeps the buffer footage on save (verified), so this is
// a pure display computation.
type Claim = { sessionId: string; startMs: number; endMs: number }
// An in-flight drag-to-save: carves its range out + shows a saved-lane placeholder until the
// real Clip lands (then it's pruned and the real clip takes over seamlessly). `realClipId` is set
// once the save POST resolves — pruning matches on that EXACT id (robust), not just on bounds (the
// backend may snap the saved range to segment boundaries, so a bounds-only match can miss and leave
// the placeholder forever = a duplicate of the clip in the saved lane).
type PendingSave = { tempId: string; sessionId: string; startMs: number; endMs: number; label: string; posterUrl?: string | null; manifestUrl?: string | null; realClipId?: string }
function bufEntry(s: BufferSession, a: number, b: number): LaneClip {
  return {
    id: `${s.id}~${Math.round(a)}`,
    startMs: a,
    endMs: b,
    label: s.title?.trim() || fmtTime(a),
    sublabel: fmtDur((b - a) / 1000),
    posterUrl: s.thumbnailUrl,
    manifestUrl: s.manifestUrl,
    sourceSessionId: s.id, // the session this footage belongs to
  }
}
// ── scissor split ────────────────────────────────────────────────────────────
// A cut at the playhead is front-end METADATA: a {sessionId, atMs} split point. It doesn't
// touch footage — it just subdivides the buffer entry so each piece is an independently
// draggable clip. Saving a piece persists it (the backend's metadata response); the split
// itself is local until a piece is saved. (Aaron can later persist splits as draft manifests.)
type SplitPoint = { sessionId: string; atMs: number }
// markParent: tag each piece with its origin SAVED clip id so a drag-up trims the parent's ranges.
function splitPiece(e: LaneClip, a: number, b: number, markParent: boolean): LaneClip {
  return {
    ...e,
    id: `${e.sourceSessionId}~${Math.round(a)}`,
    startMs: a,
    endMs: b,
    sublabel: fmtDur((b - a) / 1000),
    parentSavedId: markParent ? e.id : e.parentSavedId,
  }
}
function applySplits(entries: LaneClip[], splits: SplitPoint[], markParent = false): LaneClip[] {
  if (!splits.length) return entries
  const out: LaneClip[] = []
  for (const e of entries) {
    const pts = splits
      .filter((s) => s.sessionId === e.sourceSessionId && s.atMs > e.startMs + MIN_REMAINDER_MS && s.atMs < e.endMs - MIN_REMAINDER_MS)
      .map((s) => s.atMs)
      .sort((x, y) => x - y)
    if (!pts.length) {
      out.push(e)
      continue
    }
    let cursor = e.startMs
    for (const p of pts) {
      out.push(splitPiece(e, cursor, p, markParent))
      cursor = p
    }
    out.push(splitPiece(e, cursor, e.endMs, markParent))
  }
  return out
}
// Subtract a [start,end] hole from a set of claim ranges (splitting any range that straddles it).
function subtractRange(claims: Claim[], hole: { startMs: number; endMs: number }): Claim[] {
  const out: Claim[] = []
  for (const c of claims) {
    if (hole.endMs <= c.startMs || hole.startMs >= c.endMs) {
      out.push(c)
      continue
    }
    if (hole.startMs > c.startMs) out.push({ ...c, endMs: hole.startMs })
    if (hole.endMs < c.endMs) out.push({ ...c, startMs: hole.endMs })
  }
  return out
}
function carveBuffer(sessions: BufferSession[], claims: Claim[]): LaneClip[] {
  const out: LaneClip[] = []
  for (const s of sessions) {
    const sStart = sessionStartMs(s)
    const sEnd = sessionEndMs(s)
    if (sEnd - sStart < MIN_REMAINDER_MS) continue
    const cuts = claims
      .filter((c) => c.sessionId === s.id)
      .map((c) => [Math.max(sStart, c.startMs), Math.min(sEnd, c.endMs)] as [number, number])
      .filter(([a, b]) => b > a)
      .sort((x, y) => x[0] - y[0])
    let cursor = sStart
    for (const [a, b] of cuts) {
      if (a - cursor > MIN_REMAINDER_MS) out.push(bufEntry(s, cursor, a))
      cursor = Math.max(cursor, b)
    }
    if (sEnd - cursor > MIN_REMAINDER_MS) out.push(bufEntry(s, cursor, sEnd))
  }
  return out
}
// Carve the saved/pending ranges out of the LIVE block too (the live-session analog of carveBuffer).
// The live block bypasses carveBuffer (it's built from `nowMs`, not a session's recorded duration), so
// without this, saving a piece of the ongoing broadcast leaves its buffered copy behind = a DUPLICATE
// beside the new saved block. Subtract the live session's claims from [liveSince, now] → the unsaved
// remainder pieces; the last still reaches `now` (the frontier is non-saveable, so no claim covers it).
function carveLiveBlock(live: LaneClip, claims: Claim[]): LaneClip[] {
  const sid = live.sourceSessionId
  const cuts = claims
    .filter((c) => c.sessionId === sid)
    .map((c) => [Math.max(live.startMs, c.startMs), Math.min(live.endMs, c.endMs)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  if (!cuts.length) return [live]
  const out: LaneClip[] = []
  let cursor = live.startMs
  for (const [a, b] of cuts) {
    if (a - cursor > MIN_REMAINDER_MS) out.push({ ...live, id: `${sid}~${Math.round(cursor)}`, startMs: cursor, endMs: a })
    cursor = Math.max(cursor, b)
  }
  if (live.endMs - cursor > MIN_REMAINDER_MS) out.push({ ...live, id: `${sid}~${Math.round(cursor)}`, startMs: cursor, endMs: live.endMs })
  return out
}

export const ClipsScreen = () => {
  const insets = useSafeAreaInsets()
  const { isSignedIn } = useAuth()
  const isLive = useBroadcastStore((s) => s.isLive)
  const liveSince = useBroadcastStore((s) => s.liveSince)
  // The broadcaster's live camera feed (published by StreamScreen). Shown in the viewer when the
  // playhead rides the now edge — the buffer VOD's live edge trails real-time by seconds, so at "now"
  // the actual low-latency feed is the right media (same view as the stream page). See §6.
  const liveStreamUrl = useBroadcastStore((s) => s.liveStreamUrl)
  const liveMirror = useBroadcastStore((s) => s.liveMirror)
  const qc = useQueryClient()
  const { data: buffer, refetch: refetchBuffer } = useBuffer(!!isSignedIn, isLive)
  const { data: savedData, refetch: refetchSaved } = useSavedClips(!!isSignedIn)
  const { data: draftsData, refetch: refetchDrafts } = useDrafts(!!isSignedIn)

  // ── lanes: buffer = footage minus saved ranges (carve); saved = the saved clips ──
  const sessions = useMemo(() => buffer?.sessions ?? [], [buffer])
  // The open (still-recording) session → its footage block builds smoothly to "now" while
  // broadcasting (the timeline extends it to nowUI). Gate on `isLive` (broadcastStore — immediate)
  // AND `endedAt == null`: the buffer's `endedAt` lags by a refetch, so on STOP it would otherwise
  // keep the tail extending and suppress the trailing gap for ~15s. `isLive` flips the instant you
  // stop → the tail freezes and the "since last broadcast" gap forms right away.
  //
  // Pick the NEWEST open session, not the first. The backend can leave a stale ghost (a 0-duration
  // session, hours old, whose `endedAt` was never set) earlier in the chronological list; `find`
  // returned that ghost as "live", so liveTailId never matched the real recording (liveIdx stayed −1
  // → extendLive never ran → the clip stepped on refetch instead of building smoothly).
  const realLiveSession = useMemo(() => {
    if (!isLive) return null
    for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i]!.endedAt == null) return sessions[i]!
    return null
  }, [isLive, sessions])
  const realLiveSessionId = realLiveSession?.id ?? null

  // ── server-clock alignment (the skew-free "now") ── the UNIVERSAL wall clock lives in
  // `@/lib/serverClock` (CONTENT.md §6) so every surface reads the SAME clock; this screen feeds it
  // the backend's `serverNowMs` and reads `serverNow()` like everyone else. The downstream nowUI
  // clamp is monotonic, so a backward correction never snaps the edge — easing keeps it tiny.

  // ── time reference (now / reaper window) ── now ticks every 1s so the JS-side window boundary
  // (`windowStartMs`, which drives clip-drops + the reaper edge re-anchor) tracks the wall clock
  // closely. The reaper MASK glides continuously on the UI thread (real time); if `nowMs` only
  // ticked every 10s, the mask would run up to 10s ahead and the boundary would then lurch forward
  // in one step — a clip drop + re-anchor you can see as a stall-then-pop. At 1s the smooth mask and
  // the discrete drop reconcile within a frame's worth of footage (sub-pixel), so consumption reads
  // as one continuous wall-clock motion. (The network refetch stays at 15s — see below.)
  const [nowMs, setNowMs] = useState(() => serverNow())
  useEffect(() => {
    const id = setInterval(() => setNowMs(serverNow()), 1_000)
    return () => clearInterval(id)
  }, [])
  // Re-measure + ease the server offset on each fetch, and apply it immediately (don't wait for the
  // 1s tick). First measurement snaps; later ones ease (0.25) to absorb per-fetch latency jitter.
  useEffect(() => {
    if (buffer?.serverNowMs == null) return
    feedServerNow(buffer.serverNowMs)
    setNowMs(serverNow())
  }, [buffer?.serverNowMs])
  const windowMs = (buffer?.windowHours ?? 0) * 3_600_000
  const windowStartMs = windowMs > 0 ? nowMs - windowMs : null
  // The LIVE reaper boundary (now − window), read off the continuous wall clock — not the 1s `nowMs`
  // state, which lags the advancing edge by up to a second. The playhead instant must never sit behind
  // this (it's the eviction edge); `windowMsRef` lets callbacks read the current window.
  const windowMsRef = useRef(0)
  windowMsRef.current = windowMs
  const reaperEdgeNow = useCallback(() => (windowMsRef.current > 0 ? serverNow() - windowMsRef.current : null), [])

  // Un-save: optimistically drop a clip being deleted (its range un-carves → back to buffer).
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set())
  // In-flight drag-to-save: carved out + placeholdered until the real Clip lands.
  const [pendingSaves, setPendingSaves] = useState<PendingSave[]>([])
  // Scissor cuts at the playhead — local split points subdivide a clip in EITHER lane into pieces.
  const [splitPoints, setSplitPoints] = useState<SplitPoint[]>([])
  // When the playhead is over a (same-lane-healable) snip, the scissor becomes a bandaid → un-snip.
  const [unsnip, setUnsnip] = useState<SplitPoint | null>(null)
  // In-flight un-save of a saved PIECE: the piece's range is optimistically punched out of its
  // parent's claim (→ returns to buffer) while the parent is trimmed on the backend.
  const [pendingUnsave, setPendingUnsave] = useState<{ id: string; parentId: string; startMs: number; endMs: number }[]>([])

  const realSavedData = useMemo(() => (savedData ?? []).filter((c) => !pendingDelete.has(c.id)), [savedData, pendingDelete])

  // Saved-lane clips. Prefer the clip's own durable poster/manifest; fall back to the source
  // session's while it survives.
  const savedLaneReal = useMemo<LaneClip[]>(
    () =>
      realSavedData.map((c) => {
        const src = sessions.find((s) => s.id === c.bufferSessionId)
        return {
          id: c.id,
          startMs: c.startAtMs,
          endMs: c.endAtMs,
          label: c.name?.trim() || fmtTime(c.startAtMs),
          sublabel: fmtDur((c.endAtMs - c.startAtMs) / 1000),
          posterUrl: c.thumbnailUrl ?? src?.thumbnailUrl ?? null,
          manifestUrl: c.manifestUrl ?? src?.manifestUrl ?? null,
          sourceSessionId: c.bufferSessionId,
        }
      }),
    [realSavedData, sessions],
  )

  // A pending save stays "pending" until its real saved clip arrives. Match on the EXACT clip id the
  // save POST returned (robust — survives the backend snapping the saved range to segment boundaries);
  // fall back to a bounds match for the window before the POST resolves (and the draft path).
  const matchesReal = useCallback(
    (ps: PendingSave) =>
      (ps.realClipId != null && realSavedData.some((c) => c.id === ps.realClipId)) ||
      realSavedData.some(
        (c) => c.bufferSessionId === ps.sessionId && Math.abs(c.startAtMs - ps.startMs) < MATCH_TOL_MS && Math.abs(c.endAtMs - ps.endMs) < MATCH_TOL_MS,
      ),
    [realSavedData],
  )
  const pendingNotReal = useMemo(() => pendingSaves.filter((ps) => !matchesReal(ps)), [pendingSaves, matchesReal])

  const savedLaneAll = useMemo<LaneClip[]>(() => {
    const unsavedIds = new Set(pendingUnsave.map((h) => h.id))
    return [
      ...applySplits(savedLaneReal, splitPoints, true).filter((p) => !unsavedIds.has(p.id)),
      ...pendingNotReal.map((ps) => ({
        id: ps.tempId,
        startMs: ps.startMs,
        endMs: ps.endMs,
        label: ps.label,
        sublabel: fmtDur((ps.endMs - ps.startMs) / 1000),
        posterUrl: ps.posterUrl,
        manifestUrl: ps.manifestUrl,
        sourceSessionId: ps.sessionId,
      })),
    ]
  }, [savedLaneReal, pendingNotReal, splitPoints, pendingUnsave])

  // Drafts (edited-but-unsaved manifests) — shown in the buffer lane as draft blocks; they
  // carve their range out of the raw session too (so a draft + its remainder tile the session).
  const drafts = useMemo<LaneClip[]>(
    () =>
      (draftsData ?? []).map((c) => ({
        id: c.id,
        startMs: c.startAtMs,
        endMs: c.endAtMs,
        label: c.name?.trim() || fmtTime(c.startAtMs),
        sublabel: `DRAFT · ${fmtDur((c.endAtMs - c.startAtMs) / 1000)}`,
        posterUrl: c.thumbnailUrl ?? sessions.find((s) => s.id === c.bufferSessionId)?.thumbnailUrl ?? null,
        manifestUrl: c.manifestUrl ?? sessions.find((s) => s.id === c.bufferSessionId)?.manifestUrl ?? null,
        sourceSessionId: c.bufferSessionId,
        draftId: c.id,
      })),
    [draftsData, sessions],
  )

  // Carve: subtract the saved + draft ranges (real + pending) from each session → remaining footage.
  // A pending-unsaved piece punches a hole in its parent's claim, so that range returns to buffer.
  const claims = useMemo<Claim[]>(() => {
    const out: Claim[] = []
    for (const c of realSavedData) {
      let ranges: Claim[] = c.ranges?.length
        ? c.ranges.map((r) => ({ sessionId: r.bufferSessionId, startMs: r.startAtMs, endMs: r.endAtMs }))
        : c.bufferSessionId
          ? [{ sessionId: c.bufferSessionId, startMs: c.startAtMs, endMs: c.endAtMs }]
          : []
      for (const h of pendingUnsave) if (h.parentId === c.id) ranges = subtractRange(ranges, h)
      out.push(...ranges)
    }
    for (const c of draftsData ?? []) {
      if (c.ranges?.length) for (const r of c.ranges) out.push({ sessionId: r.bufferSessionId, startMs: r.startAtMs, endMs: r.endAtMs })
      else if (c.bufferSessionId) out.push({ sessionId: c.bufferSessionId, startMs: c.startAtMs, endMs: c.endAtMs })
    }
    for (const ps of pendingNotReal) out.push({ sessionId: ps.sessionId, startMs: ps.startMs, endMs: ps.endMs })
    return out
  }, [realSavedData, draftsData, pendingNotReal, pendingUnsave])

  // #1 INSTANT live build — ONE persistent live block, present the WHOLE time we're live. It spans
  // [liveSince → now] from the instant of go-live (liveSince is stamped then), so the clip appears
  // immediately and NEVER disappears. The bug before: I dropped the optimistic clip the moment the
  // real session id arrived (~2s) — but the real HLS footage hasn't flushed yet (zero-width for
  // ~5–7s), so the screen fell back to "No clips yet" until it caught up. Now the SAME block carries
  // the real session's manifest/poster once that session exists (gaining playability without changing
  // geometry), and its sourceSessionId binds to the real session so saving targets real footage. The
  // timeline's extendLive grows endMs to nowUI per-frame (smooth build). Dropped only when NOT live —
  // then the real session's normal carved clip (now full-duration) takes over as a past clip.
  const liveClip = useMemo<LaneClip | null>(() => {
    if (!isLive || liveSince == null) return null
    // Anchor the start to the REAL footage start once the session exists, NOT the optimistic go-live
    // instant (liveSince). The backend session starts a beat after go-live, so [liveSince, realStart]
    // is a no-footage region — anchoring there left a phantom buffered sliver before the start when
    // saving a piece that includes it (the real saved range begins at realStart) and could fail the
    // save outright ("No playable footage in the selected range"). Before the real session lands,
    // liveSince still drives the instant build (no real footage to save yet anyway → save is blocked).
    const startMs = realLiveSession ? sessionStartMs(realLiveSession) : liveSince
    return {
      id: OPT_LIVE_ID,
      startMs,
      endMs: nowMs,
      label: 'Live',
      sublabel: fmtDur(Math.max(0, nowMs - startMs) / 1000),
      posterUrl: realLiveSession?.thumbnailUrl ?? null,
      manifestUrl: realLiveSession?.manifestUrl ?? null,
      sourceSessionId: realLiveSessionId ?? OPT_LIVE_SESSION,
    }
  }, [isLive, liveSince, nowMs, realLiveSession, realLiveSessionId])
  // The live tail the timeline extends to nowUI: the live block's session (real once it exists, else
  // the synthetic placeholder), else null (not broadcasting).
  const liveSessionId = liveClip ? liveClip.sourceSessionId : null

  const bufferedLaneRaw = useMemo(() => {
    // While live, the real open session IS the single persistent liveClip — exclude it from the normal
    // carve so it isn't drawn twice (a zero-width-then-growing duplicate beside the live block).
    const carveSessions = realLiveSessionId ? sessions.filter((s) => s.id !== realLiveSessionId) : sessions
    const base = [...applySplits(carveBuffer(carveSessions, claims), splitPoints), ...drafts]
    // The live block is ONE [liveSince → now] piece, but a snip on it divides it like any other clip:
    // applySplits cuts at the live session's split points so the EARLIER (bounded) pieces become normal
    // draggable/saveable clips, while only the LAST piece reaches `now` (the still-growing frontier,
    // which the timeline detects as the live tail and renders non-draggable). No snips → one piece, as
    // before. (CONTENT.md §6: editing the model is orthogonal to playing it — snip the live stream too.)
    // carveLiveBlock first removes any saved/pending ranges (so saving a live piece doesn't leave a
    // duplicate buffered copy beside the new saved block), then applySplits divides the remainder at
    // the snip points.
    if (liveClip) base.push(...applySplits(carveLiveBlock(liveClip, claims), splitPoints))
    return base
  }, [sessions, claims, drafts, splitPoints, liveClip, realLiveSessionId])
  // Window the timeline to the buffer window: drop anything fully older than the reaper boundary
  // (removes SAVED clips older than the window). Clips straddling the boundary stay full-extent —
  // the timeline draws an advancing reaper MASK over their reaped part (smooth, on the UI thread),
  // so the consumption looks as fluid as the playhead, with no per-tick layout shift.
  const inWindow = useCallback((c: LaneClip) => windowStartMs == null || c.endMs > windowStartMs, [windowStartMs])
  const bufferedLane = useMemo(() => bufferedLaneRaw.filter(inWindow), [bufferedLaneRaw, inWindow])
  const savedLane = useMemo(() => savedLaneAll.filter(inWindow), [savedLaneAll, inWindow])
  const allClips = useMemo(() => [...bufferedLane, ...savedLane], [bufferedLane, savedLane])
  const hasAny = allClips.length > 0

  // Prune pending saves once the real list has caught up.
  useEffect(() => {
    setPendingSaves((prev) => {
      const next = prev.filter((ps) => !matchesReal(ps))
      return next.length === prev.length ? prev : next
    })
  }, [matchesReal])

  // Prune un-save holes once the parent's real ranges no longer cover them (the trim landed) or
  // the parent is gone.
  useEffect(() => {
    setPendingUnsave((prev) => {
      const next = prev.filter((h) => {
        const parent = realSavedData.find((c) => c.id === h.parentId)
        if (!parent) return false
        const ranges = parent.ranges?.length ? parent.ranges : [{ startAtMs: parent.startAtMs, endAtMs: parent.endAtMs }]
        return ranges.some((r) => r.startAtMs < h.endMs && r.endAtMs > h.startMs) // keep while still covered
      })
      return next.length === prev.length ? prev : next
    })
  }, [realSavedData])

  // ── sticky viewer selection ──
  // `selectedId` = the tapped clip (red highlight). Scrolling the timeline while paused BLURS the
  // selection (selectedId → null); the viewer then follows whatever clip is under the centre
  // playhead (`centerClipId`). Viewer + player key off `viewerClip` = selected ?? centered.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [centerClipId, setCenterClipId] = useState<string | null>(null)
  const selectedClip = useMemo(() => allClips.find((c) => c.id === selectedId) ?? null, [allClips, selectedId])
  const viewerClip = useMemo(() => selectedClip ?? allClips.find((c) => c.id === centerClipId) ?? null, [selectedClip, allClips, centerClipId])
  // Default the viewer to the newest clip — once, on first load (don't re-grab after a blur).
  const didInitSelect = useRef(false)
  useEffect(() => {
    if (didInitSelect.current || !allClips.length) return
    didInitSelect.current = true
    setSelectedId(allClips.reduce((a, b) => (b.endMs > a.endMs ? b : a)).id)
  }, [allClips])

  // ── playback ──
  // The PLAYER plays `playerClip`; the VIEWER poster shows `viewerClip`. They're the same EXCEPT
  // while scrubbing during playback: the player stays frozen on its clip (audio keeps running)
  // while the timeline + viewer poster follow the scrub; on release we jump the player to the
  // scrubbed instant and play from there. For a buffered session the manifest is the session VOD
  // and the clip window is the whole session, so video [0,dur] maps to [clipStart, clipEnd].
  const [playerId, setPlayerId] = useState<string | null>(null)
  const playerClip = useMemo(() => allClips.find((c) => c.id === playerId) ?? null, [allClips, playerId])
  const clipStart = playerClip?.startMs ?? 0
  const clipEnd = playerClip?.endMs ?? 0
  const manifestUrl = playerClip?.manifestUrl ?? null

  // The player's CONTINUOUS VOD range in wall-clock — playback flows across this whole span
  // (snips inside it are display-only and play through unbroken). Buffer/draft → the source
  // SESSION's range; a saved piece → its parent saved clip's range; a whole saved clip → itself.
  const playerInSaved = useMemo(() => savedLane.some((c) => c.id === playerId), [savedLane, playerId])
  const playerSession = useMemo(() => sessions.find((s) => s.id === playerClip?.sourceSessionId), [sessions, playerClip])
  const playerParent = useMemo(
    () => (playerClip?.parentSavedId ? realSavedData.find((c) => c.id === playerClip.parentSavedId) : null),
    [playerClip, realSavedData],
  )
  const vodStart = playerInSaved ? (playerParent ? playerParent.startAtMs : clipStart) : playerSession ? sessionStartMs(playerSession) : clipStart
  const vodEnd = playerInSaved ? (playerParent ? playerParent.endAtMs : clipEnd) : playerSession ? sessionEndMs(playerSession) : clipEnd
  const vodStartRef = useRef(0)
  vodStartRef.current = vodStart
  // Clips in wall-clock order — the transport clock walks this; `locateAt` resolves footage/gap/end.
  const orderedClips = useMemo(() => [...allClips].sort((a, b) => a.startMs - b.startMs), [allClips])
  const orderedRef = useRef(orderedClips)
  orderedRef.current = orderedClips

  // Gap card: shown while the clock rushes the playhead across unbroadcasted time (the clock owns it
  // during playback; onCenter owns it during a scrub). A plain title card — no footage behind it.
  const [gapCard, setGapCard] = useState<{ fromMs: number; toMs: number } | null>(null)
  const player = useVideoPlayer(null, (p) => {
    p.loop = false
  })
  const timelineRef = useRef<ClipsTimelineHandle>(null)
  // ── the single continuous clock, driven from JS ── The timeline's reanimated frame-callback clock
  // (frame.timeSinceFirstFrame) STALLS during video playback — heavy main-thread work freezes it for
  // ~10 frames, so the live build / now edge stepped 1 s at a time. This JS requestAnimationFrame loop
  // runs the WHOLE time the screen is focused and feeds the timeline a smooth server-aligned "now"
  // every frame (the same JS clock that already drives scroll smoothly during play). The timeline
  // takes the monotonic max of this and its own frame clock, so motion is smooth whether idle or
  // playing. (CONTENT.md §6 — one continuous clock for every frontier.)
  useFocusEffect(
    useCallback(() => {
      let raf = 0
      const tick = () => {
        timelineRef.current?.setNowUi(serverNow())
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }, []),
  )
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  playingRef.current = playing
  const [playheadMs, setPlayheadMs] = useState(0)
  const playheadRef = useRef(0)
  // While PLAYING the tick loop owns playheadRef (advances it at 60fps; commitPlayhead pushes it to
  // state at ~12Hz). Do NOT sync ref←state during play: a re-render between commits (the 12Hz commit
  // itself, the 1s nowMs tick, a 5s buffer refetch, …) would rewind playheadRef to the last committed
  // value and discard the frames advanced since — the playhead then ran at ~55% of real time and the
  // now/reaper fronts (true wall-clock) overtook it. Every non-tick setter (init/scrub/seek/nav) sets
  // playheadRef explicitly alongside setPlayheadMs, so the idle-only sync below loses nothing.
  if (!playingRef.current) playheadRef.current = playheadMs
  // Clock edge state. `followLive` = at the now edge → NOW (ticking). `ridingReaper` = at the reaper
  // edge → THEN, ticking toward eviction. Both are driven by the timeline's pixel-precise `atNow` /
  // `atReaper` flags (via getCenter) — not re-derived from playheadMs in a mismatched clock/rush
  // domain (which never registered the edges). Set on scrub-follow / settle / nav; cleared on a move.
  const [followLive, setFollowLive] = useState(false)
  const [ridingReaper, setRidingReaper] = useState(false)
  const followLiveRef = useRef(false)
  followLiveRef.current = followLive
  const ridingReaperRef = useRef(false)
  ridingReaperRef.current = ridingReaper
  // Riding either edge IS motion vs the footage (the clock ticks, the playhead isn't static), so the
  // transport play icon reflects it. The two edges differ: the now-edge ride (or footage playback) is
  // PAUSABLE → a regular pause icon; the reaper ride CAN'T be paused (it eats on a timer) → a distinct
  // slashed-pause icon (`reaping`). A press still plays FORWARD off the reaper (the natural escape).
  const pausablePlaying = playing || followLive
  // The footage at the playhead (null in a gap). The PLAYER follows this — so as the clock advances
  // the playhead across clips/snips/gaps, the loaded VOD tracks it. The VIEWER shows it too, so a
  // lane drag (which changes the clip's id) can't blank the preview: the playhead's clip is shown.
  const clipAtPlayhead = useMemo(
    () => orderedClips.find((c) => playheadMs >= c.startMs - 1 && playheadMs <= c.endMs + 1) ?? null,
    [orderedClips, playheadMs],
  )
  const firstStart = orderedClips[0]?.startMs ?? 0
  const lastEnd = orderedClips.length ? (orderedClips[orderedClips.length - 1]?.endMs ?? 0) : 0
  const firstStartRef = useRef(0)
  firstStartRef.current = firstStart
  const lastEndRef = useRef(0)
  lastEndRef.current = lastEnd
  const nowEdgeRef = useRef(0) // = axisTop (the live/now edge); assigned after axisTop is computed
  // Locate a wall-clock instant on the collapsed timeline: inside a clip's footage, inside an
  // inter-clip gap (unbroadcasted time), or past the last footage (caught up to the live edge).
  // The transport clock advances the playhead 1× through footage and rushes it across a gap; this
  // is how it knows which — the playhead never waits on the video to decide.
  const locateAt = useCallback(
    (ms: number): { mode: 'footage'; clip: LaneClip } | { mode: 'gap'; from: number; to: number } | { mode: 'end' } => {
      const clips = orderedRef.current
      for (const c of clips) if (ms >= c.startMs - 1 && ms <= c.endMs + 1) return { mode: 'footage', clip: c }
      let prevEnd = -Infinity
      let next: LaneClip | null = null
      for (const c of clips) {
        if (c.endMs <= ms && c.endMs > prevEnd) prevEnd = c.endMs
        if (c.startMs > ms && (!next || c.startMs < next.startMs)) next = c
      }
      if (next) {
        const from = prevEnd > -Infinity ? prevEnd : next.startMs
        // A split seam (≤ SEAM_GAP_MS) plays straight through as the next clip's footage — no gap
        // card, no 3s rush. Only a real unbroadcasted gap gets the rush + card.
        if (next.startMs - from <= SEAM_GAP_MS) return { mode: 'footage', clip: next }
        return { mode: 'gap', from, to: next.startMs }
      }
      // Past all footage → the TRAILING gap (last broadcast → now) is rushable like any other gap.
      const nowEdge = nowEdgeRef.current
      if (prevEnd > -Infinity && nowEdge - prevEnd > SEAM_GAP_MS && ms < nowEdge - 1) {
        return { mode: 'gap', from: prevEnd, to: nowEdge }
      }
      return { mode: 'end' } // at/after now, or no trailing gap → caught up to live
    },
    [],
  )

  // Seed the playhead on the newest footage (NOT 0 / 1969) so "play from the playhead" has somewhere
  // to start. The timeline seeds its own centre at the now edge; play/scroll reconciles the two.
  const didInitPlayhead = useRef(false)
  useEffect(() => {
    if (didInitPlayhead.current || !orderedClips.length) return
    didInitPlayhead.current = true
    const newest = orderedClips[orderedClips.length - 1]
    if (newest) {
      playheadRef.current = newest.startMs
      setPlayheadMs(newest.startMs)
    }
  }, [orderedClips])

  // Scrub-while-playing state. `scrubbingRef` gates the follow + onCenter synchronously and is
  // managed MANUALLY (NOT synced from state — the 60fps playhead re-renders would clobber it back
  // to a stale value before setScrubbing flushed, un-freezing the player → it would pause). The
  // `scrubbing` state only drives the viewer poster (held through an async cross-clip jump).
  const [scrubbing, setScrubbing] = useState(false)
  const scrubbingRef = useRef(false)
  const scrubResumePlayingRef = useRef(false) // was the player playing when the scrub started?
  // True while the CLOCK (TimeScrubber) is being wheeled → suppress the timeline's reaper latch so the
  // playhead can be wheeled forward OFF the reaper edge without being re-pinned.
  const [clockScrubbing, setClockScrubbing] = useState(false)
  // Show the seeked video frame (not the poster) while paused — set by a seek/scrub, held after.
  const [videoMode, setVideoMode] = useState(false)
  const playerIdRef = useRef<string | null>(null)
  playerIdRef.current = playerId

  // What the VIEWER shows. A TAP previews the tapped clip's poster WITHOUT moving the playhead
  // (so play still starts from the centre playhead) — so while a selection is held and we're idle,
  // show it. Playing / scrubbing / a blurred selection → show the clip at the PLAYHEAD.
  const showSelection = !!selectedClip && !playing && !scrubbing
  const displayClip = showSelection ? selectedClip : (clipAtPlayhead ?? viewerClip)

  // Riding the now edge while broadcasting → show the ACTUAL live camera feed (same as the stream
  // page), not the buffer VOD (whose live edge trails real-time by seconds). The moment you scrub
  // back into the past, followLive flips off and the viewer returns to the VOD. (CONTENT.md §6:
  // the live edge's media is the live stream; the past's media is the recording.)
  const showLiveFeed = followLive && isLive && !!liveStreamUrl && !scrubbing

  // The PLAYER (a follower) loads the clip at the PLAYHEAD — so as the clock advances the playhead
  // across clips/snips, the loaded VOD tracks it. In a gap clipAtPlayhead is null; we KEEP the last
  // VOD loaded (the clock just pauses it) so re-entering footage doesn't churn a reload.
  useEffect(() => {
    if (clipAtPlayhead) setPlayerId(clipAtPlayhead.id)
  }, [clipAtPlayhead])

  // Load the VOD when the player's clip changes, then seek it to the CURRENT playhead (the follower
  // catches up to the authoritative clock — we never reset the playhead here). Resume if playing.
  // CRUCIAL: only reload when the URL actually changes. Crossing a SNIP swaps the clip id (piece1→
  // piece2) but both map to the SAME session VOD — reloading it would stall the seam. Same URL → the
  // video just keeps playing unbroken (vodStart is identical, so the playhead↔video mapping holds).
  const loadedUrlRef = useRef<string | null>(null)
  // True while a cross-VOD swap is in flight → the viewer holds the incoming clip's poster over the
  // reload so a between-lane seam shows a frame, not the bg (see ClipViewer.coverPoster).
  const [vodLoading, setVodLoading] = useState(false)

  // ── seek controller (ported from ClipEditScreen: tolerant · back-pressured · self-healing) ──
  // Precise `currentTime =` seeks WEDGE AVPlayer/ExoPlayer in `loading` forever on the buffer's
  // -c:v copy HLS after enough of them — the "stale frame / wrong footage" on PAST footage. So:
  // (1) seek TOLERANTLY (seekBy → nearest keyframe, never wedges; the clock owns the exact position,
  // so frame-accuracy isn't needed); (2) BACKPRESSURE — only seek when readyToPlay, always to the
  // LATEST target, one in flight (busy → the statusChange handler re-flushes); (3) RECOVER — if it
  // wedges in `loading` past a watchdog OR errors, refetch a fresh token + replaceAsync, capped +
  // backed off, poster on exhaustion. (The grid had the naive version; this is the editor's proven one.)
  // Coalesce window for seeks. Kept SMALL: the readyToPlay gate already guarantees one seek in
  // flight at a time, so this only needs to avoid a tight loop when seeks complete instantly — a
  // bigger value (the editor's 120) just adds visible scrub latency (the "chunky" feel).
  const SEEK_THROTTLE_MS = 40
  const MAX_HEAL = 4
  const pendingSeekSec = useRef<number | null>(null)
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSeekAtRef = useRef(0)
  const loadWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healAttemptsRef = useRef(0)
  const healingRef = useRef(false)
  const healTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playerError, setPlayerError] = useState(false)
  // Preview-play (the smooth-scrub trick): while dragging, the player PLAYS (muted) so it renders
  // continuously forward — far smoother than discrete keyframe seeks on -c:v copy footage, which
  // repaint chunkily. We keep seeking it to the finger; on release we pause on the LANDED frame once
  // the final seek settles (wantSettle). Mirrors ClipEditScreen's previewSeek / maybeSettlePause.
  const previewingRef = useRef(false)
  const wantSettleRef = useRef(false)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null) // fallback pause if no readyToPlay fires
  const manifestUrlRef = useRef<string | null>(null)
  manifestUrlRef.current = manifestUrl
  const refetchBufferRef = useRef(refetchBuffer)
  refetchBufferRef.current = refetchBuffer

  const flushSeek = useCallback(() => {
    if (seekTimerRef.current) {
      clearTimeout(seekTimerRef.current)
      seekTimerRef.current = null
    }
    if (pendingSeekSec.current == null) return
    if (player.status !== 'readyToPlay') return // busy → statusChange re-flushes the latest target
    const sec = pendingSeekSec.current
    pendingSeekSec.current = null
    lastSeekAtRef.current = serverNow()
    try {
      const delta = sec - player.currentTime
      if (Math.abs(delta) >= 0.05) player.seekBy(delta)
    } catch {}
  }, [player])

  // Seek the video to a wall-clock instant — coalesced to ~one seek per SEEK_THROTTLE_MS, ready-gated.
  const scheduleSeek = useCallback(
    (ms: number) => {
      const sec = (ms - vodStartRef.current) / 1000
      if (sec < 0) return
      pendingSeekSec.current = sec
      const since = serverNow() - lastSeekAtRef.current
      if (since >= SEEK_THROTTLE_MS) flushSeek()
      else if (!seekTimerRef.current) seekTimerRef.current = setTimeout(flushSeek, SEEK_THROTTLE_MS - since)
    },
    [flushSeek],
  )

  const recoverPlayer = useCallback(() => {
    if (healingRef.current) return
    if (healAttemptsRef.current >= MAX_HEAL) {
      setPlayerError(true) // exhausted → fall back to the poster (no tight loop, no freeze)
      return
    }
    healingRef.current = true
    healAttemptsRef.current += 1
    const backoff = Math.min(500 * 2 ** (healAttemptsRef.current - 1), 4000)
    if (healTimerRef.current) clearTimeout(healTimerRef.current)
    healTimerRef.current = setTimeout(async () => {
      healTimerRef.current = null
      try {
        await refetchBufferRef.current() // fresh tokenized URLs (covers a token expiry)
        const url = manifestUrlRef.current
        if (url) {
          await player.replaceAsync({ uri: url, contentType: 'hls' })
          loadedUrlRef.current = url
          pendingSeekSec.current = (playheadRef.current - vodStartRef.current) / 1000
          flushSeek()
        }
      } catch {
        // swallow — the next statusChange (still loading / error) re-arms recovery
      } finally {
        healingRef.current = false
      }
    }, backoff)
  }, [player, flushSeek])

  // statusChange watcher: readyToPlay → reset the heal budget + flush the latest pending seek; stuck
  // in `loading` past the watchdog OR `error` → recover. One place (matches the editor).
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (loadWatchdogRef.current) {
        clearTimeout(loadWatchdogRef.current)
        loadWatchdogRef.current = null
      }
      if (status === 'loading') {
        loadWatchdogRef.current = setTimeout(() => recoverPlayer(), 2500)
      } else if (status === 'readyToPlay') {
        healAttemptsRef.current = 0
        setPlayerError(false)
        if (pendingSeekSec.current != null) flushSeek()
        // Settle: once the final scrub seek has landed (nothing pending + ready), pause the
        // preview-play on that exact frame. (Keep flushing while seeks are still pending.)
        else if (wantSettleRef.current) {
          wantSettleRef.current = false
          previewingRef.current = false
          if (settleTimerRef.current) {
            clearTimeout(settleTimerRef.current)
            settleTimerRef.current = null
          }
          try {
            player.pause()
          } catch {}
        }
      } else if (status === 'error') {
        recoverPlayer()
      }
    })
    return () => sub.remove()
  }, [player, flushSeek, recoverPlayer])

  useEffect(() => {
    if (!manifestUrl) {
      loadedUrlRef.current = null
      setVodLoading(false)
      try {
        player.replace(null)
      } catch {}
      return
    }
    if (manifestUrl === loadedUrlRef.current) return // same VOD (e.g. crossing a snip) → no reload
    loadedUrlRef.current = manifestUrl
    healAttemptsRef.current = 0 // fresh clip → full recovery budget + clear any poster fallback
    setPlayerError(false)
    setVodLoading(true)
    player
      .replaceAsync({ uri: manifestUrl, contentType: 'hls' })
      .then(() => {
        // TOLERANT seek (keyframe) after load — a precise `currentTime =` can wedge the -c:v copy
        // HLS player in `loading`; seekBy snaps to the nearest keyframe and never wedges.
        const want = (playheadRef.current - vodStartRef.current) / 1000
        try {
          if (want >= 0) {
            const d = want - player.currentTime
            if (Math.abs(d) >= 0.05) player.seekBy(d)
          }
        } catch {}
        if (playingRef.current && locateAt(playheadRef.current).mode === 'footage') {
          try {
            player.play()
          } catch {}
        }
        setVodLoading(false)
      })
      .catch(() => setVodLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  // Move the playhead to a wall-clock instant (frame-step nav, scrubber dial, scrub-release settle).
  // The playhead is authoritative; we set it, then seek the loaded video to match (best-effort —
  // the clock re-syncs on the next tick when playing).
  const seekTo = useCallback(
    (ms: number) => {
      // A programmatic seek cancels any in-flight scrub decay → clear the scrub gate so it can't orphan
      // (the withDecay settle won't fire onScrubEnd once cancelled). Same guard as togglePlay.
      scrubbingRef.current = false
      setScrubbing(false)
      // Floor at the reaper edge (not just the oldest clip start) so a seek/scrub can't land the
      // playhead BEHIND the eviction boundary — the common cause of "dragging a little past the reaper".
      const floor = Math.max(reaperEdgeNow() ?? -Infinity, firstStartRef.current)
      const m = clamp(ms, floor, lastEndRef.current)
      playheadRef.current = m
      setPlayheadMs(m)
      setFollowLive(false) // any explicit seek leaves the live edge → clock reads THEN
      setRidingReaper(false)
      setVideoMode(true) // show the seeked frame, not the poster
      if (manifestUrl) scheduleSeek(m) // tolerant + back-pressured (no wedge); the player follows
    },
    [manifestUrl, reaperEdgeNow, scheduleSeek],
  )

  // Footage-playback PICTURE drive (CONTENT.md §6: derive the position on the UI thread, don't snapshot
  // the JS-written scroll). While deriving, the timeline renders the playhead from reaperNowSv (smooth at
  // vsync) instead of the JS scroll (which jitters the whole content in sync at high zoom). enter on
  // footage-entry, exit on gap/end/pause/scrub. The JS `scroll` is still maintained for getCenter/video.
  const playDriveRef = useRef(false)
  const enterDrive = useCallback((ph: number) => {
    if (!playDriveRef.current) {
      playDriveRef.current = true
      timelineRef.current?.stampPlayAnchor(ph)
    }
  }, [])
  const exitDrive = useCallback(() => {
    if (playDriveRef.current) {
      playDriveRef.current = false
      timelineRef.current?.clearPlayDrive()
    }
  }, [])

  // ── the transport clock (see CONTENT.md §6) ──
  // The PLAYHEAD is the single source of truth. While playing it advances by REAL elapsed time —
  // 1× through footage, a fixed-duration RUSH across an unbroadcasted-time gap (GAP_RUSH_MS, gap
  // card) — and the video + timeline FOLLOW it. It never derives the playhead from the video's
  // position and never waits on a VOD reload, so a clip / snip / gap boundary is a seek for the
  // follower, not a stall for the clock.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    // serverNow() at the previous tick — the playhead's clock source. It advances by the WALL-CLOCK
    // delta (serverNow() − lastClock), the SAME clock the now/reaper fronts read — so a janky 150ms
    // frame advances both by 150ms and they can't diverge (CONTENT.md §6: read the clock, don't
    // accumulate frame-timer ticks). The delta is guarded max(0, min(PLAYHEAD_MAX_STEP_MS, …)) for a
    // backward clock tick / a backgrounding suspension.
    let lastClock: number | null = null
    let lastCommitTs = 0
    // The playhead REF + the timeline scroll advance every frame (smooth). But committing playheadMs
    // to React state every frame = 60 re-renders/sec of this heavy screen, which saturates the JS
    // thread and makes the per-frame scrollToTime (→ the timeline) janky/step even though the native
    // video stays smooth. Commit React state at ~12 Hz instead — the clock + clip-follow don't need
    // 60 fps, and the timeline scroll (a shared value) stays buttery because scrollToTime still runs
    // every frame. This is what keeps the playhead, now edge and reaper edge locked in sync (§6).
    const commitPlayhead = (ph: number, ts: number) => {
      if (ts - lastCommitTs >= 80) {
        lastCommitTs = ts
        setPlayheadMs(ph)
      }
    }
    const tick = (ts: number) => {
      const nowClock = serverNow()
      if (scrubbingRef.current) {
        lastClock = nowClock // the finger owns the playhead while scrubbing; re-anchor the clock
        raf = requestAnimationFrame(tick)
        return
      }
      const rawDt = lastClock == null ? 0 : nowClock - lastClock
      const dt = lastClock == null ? 0 : Math.max(0, Math.min(PLAYHEAD_MAX_STEP_MS, rawDt))
      lastClock = nowClock
      // Floor the playhead at the LIVE reaper edge every frame — it advances continuously (1×) and the
      // playhead also plays at 1×, so without this a playhead that started a hair behind (a stale instant)
      // would stay behind forever. The idle clamp effect skips while playing; this is its play-time analog.
      let ph = Math.max(playheadRef.current, reaperEdgeNow() ?? -Infinity)
      const loc = locateAt(ph)
      if (loc.mode === 'end') {
        exitDrive()
        // caught up to the live edge — nothing more to play. Pin the clock to NOW; if the last
        // broadcast ended a while ago, keep the trailing "since last broadcast" card up.
        try {
          player.pause()
        } catch {}
        const nowEdge = nowEdgeRef.current
        setGapCard(nowEdge - lastEndRef.current > SEAM_GAP_MS ? { fromMs: lastEndRef.current, toMs: nowEdge } : null)
        setFollowLive(true)
        setPlaying(false)
        return
      }
      if (loc.mode === 'gap') {
        exitDrive() // the rush rate ≠ 1× → the UI-derived anchor doesn't apply; JS scroll drives the gap
        setGapCard({ fromMs: loc.from, toMs: loc.to })
        if (player.playing)
          try {
            player.pause()
          } catch {}
        const span = Math.max(1, loc.to - loc.from)
        ph = ph + dt * (span / GAP_RUSH_MS)
        if (ph >= loc.to - 1) ph = loc.to // land exactly on the next clip's head
        playheadRef.current = ph
        commitPlayhead(ph, ts)
        timelineRef.current?.scrollToTime(ph)
        raf = requestAnimationFrame(tick)
        return
      }
      // footage: the loaded VOD should be this clip — seek-correct only on real drift, then play.
      setGapCard(null)
      if (playerIdRef.current === loc.clip.id && player.duration > 0) {
        const want = (ph - vodStartRef.current) / 1000
        if (want >= -0.1) {
          if (Math.abs(player.currentTime - want) > DRIFT_TOL_S) {
            try {
              player.seekBy(want - player.currentTime)
            } catch {}
          }
          if (!player.playing)
            try {
              player.play()
            } catch {}
        }
      }
      ph = ph + dt // advance by WALL-CLOCK elapsed (1×) regardless of the video's readiness — it catches up.
      // Summing true wall-clock deltas telescopes to playStart + (serverNow() − startClock) — i.e. it
      // IS the clock read, drift-free; only a backgrounding suspension (capped above) breaks the sum.
      // No hard stop at lastEnd: the playhead flows into the TRAILING gap, where locateAt returns a
      // rushable gap (3s to now) and then 'end' (caught up).
      playheadRef.current = ph
      enterDrive(ph) // footage at 1× → the picture derives smoothly on the UI thread from here
      commitPlayhead(ph, ts)
      timelineRef.current?.scrollToTime(ph) // keep `scroll` current for getCenter/video (picture uses the anchor)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      exitDrive() // stop deriving the playback picture when playback ends (pause / unmount / new session)
    }
  }, [playing, player, locateAt, reaperEdgeNow, enterDrive, exitDrive])

  // Start/stop the VIDEO when `playing` flips. CRUCIAL: a paused expo-video player does NOT begin
  // rendering on play() alone — it needs a seek to "kick" it. Without this the clock/timeline advanced
  // on play but the footage stayed frozen until a scrub's seek nudged it (the reported bug). So on
  // play, do a tolerant seek to the current frame, then play(); on stop, pause. (Mirrors the editor.)
  useEffect(() => {
    if (playing) {
      if (!manifestUrlRef.current) return
      pendingSeekSec.current = null
      previewingRef.current = false // real playback now owns the player (not a muted scrub preview)
      wantSettleRef.current = false
      try {
        player.muted = false // real playback has audio (preview-scrub muted it)
        const want = (playheadRef.current - vodStartRef.current) / 1000
        if (want >= 0) {
          const d = want - player.currentTime
          if (Math.abs(d) >= 0.05) player.seekBy(d) // the kick — repaints + readies the paused player
        }
        player.play()
      } catch {}
    } else {
      try {
        player.pause()
      } catch {}
    }
  }, [playing, player])

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      setGapCard(null)
      try {
        player.pause()
      } catch {}
      setPlaying(false)
      return
    }
    // Riding the NOW edge counts as playing (live) → the press PAUSES it: freeze the playhead at the
    // current live edge and detach, so `now` advances away from it and it reads as a static THEN
    // (counting up from the moment you paused). The reaper edge is handled below (you can't pause the
    // reaper — it eats on a timer — so a press plays FORWARD off it, the natural escape).
    if (followLiveRef.current) {
      const edge = nowEdgeRef.current
      playheadRef.current = edge
      setPlayheadMs(edge)
      setFollowLive(false)
      return
    }
    // Riding the REAPER edge can't be paused (it eats on a timer) — the slashed-pause is a STATUS
    // indicator, not a control. Pressing it does nothing (no bump, no playback). You leave the reaper
    // ride the same way you reach it: drag away / a forward transport button / wheeling the clock ahead.
    if (ridingReaperRef.current) return
    // Clear any in-flight scrub gate. After the finger lifts, the timeline's `withDecay` keeps
    // `scrubbing` true until it SETTLES (then onScrubEnd clears it). Pressing play interrupts that
    // decay (the play tick's scrollToTime cancels the animation), so its settle callback fires with
    // finished=false and onScrubEnd never runs — leaving scrubbingRef stuck true, which makes the play
    // tick early-return every frame (play icon on, playhead frozen). Clear it here so play can advance.
    scrubbingRef.current = false
    setScrubbing(false)
    setFollowLive(false) // playing advances the playhead off the live edge
    setRidingReaper(false)
    // Play from the PLAYHEAD. If we're at/after the last footage, restart from the top.
    if (playheadRef.current >= lastEndRef.current - 50) {
      const first = firstStartRef.current
      playheadRef.current = first
      setPlayheadMs(first)
      timelineRef.current?.scrollToTime(first, true)
    }
    setPlaying(true) // the clock takes over — it seeks + plays the video as a follower
  }, [player])

  // Smooth scrub: as the timeline scrubs under the playhead, the PLAYHEAD follows the centre
  // (gap-interpolated) and the loaded video seeks to match (tolerant keyframe seekBy → robust on
  // the -c:v copy buffer VOD; ~12 Hz). The clock idles while scrubbing; this is the follower drive.
  useEffect(() => {
    if (!scrubbing) return
    const id = setInterval(() => {
      const c = timelineRef.current?.getCenter()
      if (!c) return
      playheadRef.current = c.timeMs
      setPlayheadMs(c.timeMs) // the playhead follows the scrub
      // Edge state from the timeline's pixel-precise flags → clock NOW (now edge) / THEN+tick (reaper).
      setFollowLive(c.atNow)
      setRidingReaper(c.atReaper)
      if (c.inGap || !c.clipId || c.clipId !== playerIdRef.current) {
        // over a gap / unloaded clip → no footage to render; drop preview-play so it doesn't run on.
        if (previewingRef.current) {
          previewingRef.current = false
          try {
            player.pause()
          } catch {}
        }
        return
      }
      // Smooth scrub: keep the player PLAYING (muted) so it repaints continuously while we seek it to
      // the finger — far smoother than discrete seeks on keyframe-only footage. Settle-pauses on release.
      if (!previewingRef.current) {
        previewingRef.current = true
        wantSettleRef.current = false
        try {
          player.muted = true
          player.play()
        } catch {}
      }
      scheduleSeek(c.timeMs) // position it at the finger (tolerant + ready-gated)
    }, 50)
    return () => clearInterval(id)
  }, [scrubbing, player, scheduleSeek])

  // Scrub release: settle on the precise release frame. If the drag was over a PLAYING stream,
  // resume playback 250ms later from there (the `playing` state stayed true the whole time → the
  // play button never flipped); a paused drag just stays on the frame.
  const onScrubEnd = useCallback(
    (id: string | null, timeMs: number) => {
      if (!scrubbingRef.current) return // fires when the scroll has SETTLED (after any inertia)
      scrubbingRef.current = false
      setScrubbing(false)
      if (id) setCenterClipId(id)
      if (id && id === playerIdRef.current) seekTo(timeMs) // settle the exact landed frame
      // Settle the clock edge state from where the scroll LANDED (pixel-precise). seekTo above clears
      // both, so read + apply after it.
      const c = timelineRef.current?.getCenter()
      const atEdge = !!c?.atNow || !!c?.atReaper
      setFollowLive(!!c?.atNow)
      setRidingReaper(!!c?.atReaper)
      // Within reach of the reaper → SNAP + stick exactly to it (no sliver) and latch the ride; the now
      // edge sticks via followLive→followNow. (Geometric atNow/atReaper, so a drag-while-playing sticks
      // reliably — independent of the autonomous latch's timing.)
      if (c?.atReaper) timelineRef.current?.snapToReaper()
      // Landed on an EDGE → ride it (now edge follows, reaper edge rides) — like dragging to the now
      // edge. Stop footage playback so the ride owns the motion; don't resume. Off an edge → resume
      // from where the fling LANDED (if we were playing; the settle was the wait, no fixed timer).
      if (!atEdge && scrubResumePlayingRef.current) {
        // resume REAL playback from the landed frame — unmute (the scrub preview muted it)
        previewingRef.current = false
        try {
          player.muted = false
          player.play()
        } catch {}
      } else {
        // edge ride OR paused scrub → pause the preview-play on the landed frame once it settles.
        if (atEdge && playingRef.current) setPlaying(false)
        wantSettleRef.current = true
        // Fallback: if the landing seek was a no-op there's no readyToPlay to settle on → pause anyway.
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
        settleTimerRef.current = setTimeout(() => {
          if (!wantSettleRef.current) return
          wantSettleRef.current = false
          previewingRef.current = false
          try {
            player.pause()
          } catch {}
        }, 280)
      }
    },
    [player, seekTo],
  )

  // ── lane-drag (cross a clip to the other lane) ──
  // Editing the model (a clip's lane membership) is orthogonal to playing the model, so save/un-save
  // must work mid-playback exactly as it does when stopped. The only obstacle is the grab TARGET:
  // while the camera auto-moves (playing / following the now edge / riding the reaper) the block scrolls
  // out from under the finger. So for the duration of the grab we HOLD the camera (the block sits still,
  // a stable target) and the playhead (a clean resume with no catch-up snap). Nothing is lost — the
  // rolling buffer keeps recording server-side regardless of the app playhead. Snip stays ungated and
  // flowing (that's where "the playhead continues forward" is visible); only the drag holds the view.
  const [laneHold, setLaneHold] = useState(false)
  const laneHoldRef = useRef(false)
  const laneHoldResumeRef = useRef(false)
  const onLaneDragChange = useCallback(
    (active: boolean) => {
      if (active) {
        if (scrubbingRef.current || laneHoldRef.current) return // already held (an in-flight scrub/drag)
        const moving = playingRef.current || followLiveRef.current || ridingReaperRef.current
        if (!moving) return // stopped + static camera → the block is already a stable target; drag as-is
        laneHoldRef.current = true
        laneHoldResumeRef.current = playingRef.current
        exitDrive() // stop the UI-thread playback drive so the frozen camera can't keep auto-advancing
        setFollowLive(false) // release the now-edge follow + reaper ride so the auto-camera fully yields
        setRidingReaper(false)
        scrubbingRef.current = true // hold the playhead clock → release has no catch-up snap
        setLaneHold(true) // → ClipsTimeline holdCamera: freeze scroll wherever it is
        if (playingRef.current) {
          try {
            player.pause()
          } catch {}
        }
      } else {
        if (!laneHoldRef.current) return // we didn't engage a hold (stopped drag) → nothing to release
        laneHoldRef.current = false
        scrubbingRef.current = false
        setLaneHold(false)
        if (laneHoldResumeRef.current)
          try {
            player.play()
          } catch {}
        laneHoldResumeRef.current = false
      }
    },
    [player, exitDrive],
  )

  // Frame-step: tap seeks one frame; hold repeats.
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const frameHold = useCallback(
    (dir: 1 | -1, held: boolean) => {
      if (holdRef.current) {
        clearInterval(holdRef.current)
        holdRef.current = null
      }
      if (held) holdRef.current = setInterval(() => seekTo(playheadRef.current + dir * FRAME_MS), 70)
    },
    [seekTo],
  )

  // Keep the playhead out of the reaped region (clamp it up to the reaper edge while idle).
  useEffect(() => {
    if (windowStartMs == null || playingRef.current || scrubbingRef.current) return
    if (playheadRef.current < windowStartMs) {
      playheadRef.current = windowStartMs
      setPlayheadMs(windowStartMs)
    }
  }, [windowStartMs])
  // Clock: 0 (NOW) at the live edge; `windowMs` (live-ticking THEN) riding the reaper edge; else the
  // held instant behind now (frozen by the TimeScrubber so a paused clock doesn't bounce a second).
  const offsetForClock = followLive ? 0 : ridingReaper ? windowMs : Math.max(0, serverNow() - playheadMs)
  const [clockExpanded, setClockExpanded] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)

  // A just-saved clip is processed async (status:'processing' → 'ready'), so it
  // doesn't appear in the list immediately. Invalidate now + a few times after, so
  // it lands in the saved lane once ready. (Replace with Aaron's ready push later.)
  const refetchSavedSoon = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['buffer', 'clips'] })
    const t1 = setTimeout(() => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }), 3000)
    const t2 = setTimeout(() => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }), 8000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [qc])

  // Drag a BUFFERED clip right → save a durable copy of its window. The POST is
  // synchronous server-side (returns once the clip is `ready`), so on success the
  // clip appears on the next refetch. Surface failures (quota / no-footage / promote
  // error) instead of swallowing them — silent failure is why a save "won't stick".
  // Drag a buffered remainder right → save just its window. Optimistically carve it out +
  // placeholder it in the saved lane; the real Clip prunes the placeholder when it lands.
  const saveClip = useCallback(
    (clip: LaneClip) => {
      // A DRAFT block → materialise it (saveDraft); optimistically carve it remains carved.
      if (clip.draftId) {
        const draftId = clip.draftId
        setPendingSaves((prev) => [
          ...prev,
          { tempId: `pending:${draftId}`, sessionId: clip.sourceSessionId ?? '', startMs: clip.startMs, endMs: clip.endMs, label: clip.label.replace(/^DRAFT · /, ''), posterUrl: clip.posterUrl, manifestUrl: clip.manifestUrl },
        ])
        bufferApi
          .saveDraft(draftId)
          .then(() => {
            qc.invalidateQueries({ queryKey: ['buffer', 'clips'] })
            refetchSavedSoon()
          })
          .catch((err: unknown) => {
            setPendingSaves((prev) => prev.filter((p) => p.tempId !== `pending:${draftId}`))
            const e = err as { response?: { data?: { message?: string } }; message?: string }
            Alert.alert('Save failed', e.response?.data?.message ?? e.message ?? 'Could not save clip')
          })
        return
      }
      const sessionId = clip.sourceSessionId
      if (!sessionId) return
      // Can't save the optimistic live placeholder — it has no real footage on the backend yet.
      // (It's replaced by the real session within seconds; save then.)
      if (sessionId === OPT_LIVE_SESSION) return
      // The backend requires a non-empty `kinds` — resolve from the covered session(s).
      const kindSet = new Set<string>()
      for (const s of sessions) {
        if (sessionEndMs(s) > clip.startMs && sessionStartMs(s) < clip.endMs) s.kinds.forEach((k) => kindSet.add(k))
      }
      const kinds = kindSet.size ? [...kindSet] : ['camera']
      const tempId = `pending:${clip.id}`
      setPendingSaves((prev) => [
        ...prev,
        { tempId, sessionId, startMs: clip.startMs, endMs: clip.endMs, label: clip.label, posterUrl: clip.posterUrl, manifestUrl: clip.manifestUrl },
      ])
      const payload = { startAtMs: Math.round(clip.startMs), endAtMs: Math.round(clip.endMs), name: clip.label, kinds }
      bufferApi
        .saveClip(payload)
        .then((res) => {
          // Tag the placeholder with the real id so it's pruned by EXACT id when the clip lands
          // (not just by bounds, which the backend may snap) — otherwise it lingers as a duplicate.
          setPendingSaves((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, realClipId: res.clipId } : p)))
          refetchSavedSoon()
        })
        .catch((err: unknown) => {
          setPendingSaves((prev) => prev.filter((p) => p.tempId !== tempId)) // revert the optimistic carve
          const e = err as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string }
          const msg = e.response?.data?.message ?? e.response?.data?.error ?? e.message ?? 'Could not save clip'
          Alert.alert('Save failed', msg)
        })
    },
    [sessions, refetchSavedSoon, qc],
  )

  // Drag a SAVED clip up → un-save. A WHOLE clip is deleted; a scissor PIECE only trims that range
  // out of its parent (PATCH the parent's manifest to the kept ranges → the piece returns to
  // buffer, the rest stays saved). Optimistic; revert on failure.
  const unsaveClip = useCallback(
    (clip: LaneClip) => {
      if (clip.id.startsWith('pending:')) return // an optimistic placeholder, not a real clip yet
      // Returning footage to the buffer keeps its boundaries as SNIPS, so it stays a distinct piece
      // beside adjacent footage (it doesn't silently merge) — survives until mended.
      const snipSession = clip.sourceSessionId
      if (snipSession) {
        setSplitPoints((prev) => {
          const next = [...prev]
          for (const atMs of [clip.startMs, clip.endMs]) {
            if (!next.some((s) => s.sessionId === snipSession && Math.abs(s.atMs - atMs) < 1)) next.push({ sessionId: snipSession, atMs })
          }
          return next.length === prev.length ? prev : next
        })
      }
      if (clip.parentSavedId) {
        const parentId = clip.parentSavedId
        const parent = realSavedData.find((c) => c.id === parentId)
        if (!parent) return
        const hole = { id: clip.id, parentId, startMs: clip.startMs, endMs: clip.endMs }
        // Kept ranges = the parent's full ranges minus every hole (existing pending + this one).
        let kept: Claim[] = parent.ranges?.length
          ? parent.ranges.map((r) => ({ sessionId: r.bufferSessionId, startMs: r.startAtMs, endMs: r.endAtMs }))
          : parent.bufferSessionId
            ? [{ sessionId: parent.bufferSessionId, startMs: parent.startAtMs, endMs: parent.endAtMs }]
            : []
        for (const h of [...pendingUnsave.filter((p) => p.parentId === parentId), hole]) kept = subtractRange(kept, h)
        setPendingUnsave((prev) => [...prev, hole])
        const revert = () => setPendingUnsave((prev) => prev.filter((p) => p.id !== hole.id))
        const done = () => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] })
        if (!kept.length) bufferApi.deleteSavedClip(parentId).then(done).catch(revert)
        else
          bufferApi
            .patchClip(parentId, { ranges: kept.map((r) => ({ bufferSessionId: r.sessionId, startAtMs: Math.round(r.startMs), endAtMs: Math.round(r.endMs) })) })
            .then(done)
            .catch(revert)
        return
      }
      setPendingDelete((prev) => new Set(prev).add(clip.id))
      bufferApi
        .deleteSavedClip(clip.id)
        .then(() => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }))
        .catch(() =>
          setPendingDelete((prev) => {
            const next = new Set(prev)
            next.delete(clip.id)
            return next
          }),
        )
    },
    [qc, realSavedData, pendingUnsave],
  )

  // On focus (e.g. returning from the editor after an edit/save), refresh all sources so the
  // carve + drafts reflect any change. A periodic buffer refetch keeps the oldest footage shrinking
  // in step with the backend reaper (so you can watch a clip get eaten, not just on focus).
  const refetchRef = useRef({ refetchBuffer, refetchSaved, refetchDrafts })
  refetchRef.current = { refetchBuffer, refetchSaved, refetchDrafts }
  useFocusEffect(
    useCallback(() => {
      setNowMs(serverNow())
      refetchRef.current.refetchBuffer()
      refetchRef.current.refetchSaved()
      refetchRef.current.refetchDrafts()
    }, [serverNow]),
  )
  useEffect(() => {
    const id = setInterval(() => refetchRef.current.refetchBuffer(), 15_000)
    return () => clearInterval(id)
  }, [])
  const axisTop = useMemo(() => {
    let newest = nowMs
    for (const c of allClips) if (Number.isFinite(c.endMs) && c.endMs > newest) newest = c.endMs
    return newest
  }, [allClips, nowMs])
  nowEdgeRef.current = axisTop
  // The gap card is the TRAILING gap when its FROM is the newest clip's end → reads "since last
  // broadcast" (counts up). The leading (reaper) gap ends at the oldest clip → counts down. Keyed off
  // the clips' own edges (NOT axisTop, which drifts on the 10s tick — that flipped the card off too soon).
  const isTrailingCard = !!gapCard && lastEnd > 0 && gapCard.fromMs >= lastEnd - 1
  const isReaperCard = !!gapCard && firstStart > 0 && gapCard.toMs <= firstStart + 1
  const [, setSecondTick] = useState(0)
  useEffect(() => {
    if (!isTrailingCard && !isReaperCard) return // both count (up / down) → re-render every second
    const id = setInterval(() => setSecondTick((t) => (t + 1) % 86_400), 1000)
    return () => clearInterval(id)
  }, [isTrailingCard, isReaperCard])

  // Reaper edge = the buffer-window boundary (`windowStartMs`). When the OLDEST clip reaches it the
  // window is full → that lane's edge is being reaped (no leading gap); the lane decides the colour
  // (buffer = red sickle, saved = black save). Otherwise there's room → a LEADING gap whose card
  // counts down to when the current oldest footage ages out (`reapAtMs`).
  const oldestClip = orderedClips[0] ?? null
  const reaping = windowStartMs != null && oldestClip != null && oldestClip.startMs <= windowStartMs + 1
  const reaperLane: 'buffered' | 'saved' = oldestClip != null && savedLane.some((c) => c.id === oldestClip.id) ? 'saved' : 'buffered'

  const reaperBoundaryMs = windowStartMs != null && !reaping ? windowStartMs : null
  const reapAtMs = oldestClip != null && windowMs > 0 ? oldestClip.startMs + windowMs : null
  const reapAtRef = useRef<number | null>(null)
  reapAtRef.current = reapAtMs
  const openClip = useCallback((clip: LaneClip, kind: 'buffered' | 'saved') => {
    // The optimistic live placeholder has no real footage yet — don't open the editor on it.
    if (clip.sourceSessionId === OPT_LIVE_SESSION) return
    // Pass the window so the editor scopes to a carved buffer interval (whose id is synthetic),
    // and the source session so it can play the right buffer footage.
    router.navigate({
      pathname: '/(app)/clip-editor',
      params: {
        clipId: clip.id,
        kind,
        startMs: String(Math.round(clip.startMs)),
        endMs: String(Math.round(clip.endMs)),
        sessionId: clip.sourceSessionId ?? '',
        draftId: clip.draftId ?? '', // reopen an existing draft (continue editing it)
      },
    })
  }, [])

  // Poll the playhead → when it's over a snip whose two pieces are still in the SAME lane, the
  // scissor turns into a bandaid (un-snip). Reads lanes via a ref so the interval stays stable.
  const laneRefs = useRef({ buffered: bufferedLane, saved: savedLane, splits: splitPoints })
  laneRefs.current = { buffered: bufferedLane, saved: savedLane, splits: splitPoints }
  useEffect(() => {
    if (!splitPoints.length) {
      setUnsnip(null)
      return
    }
    const sameLane = (lane: LaneClip[], s: SplitPoint) =>
      lane.some((x) => x.sourceSessionId === s.sessionId && Math.abs(x.endMs - s.atMs) < 4) &&
      lane.some((x) => x.sourceSessionId === s.sessionId && Math.abs(x.startMs - s.atMs) < 4)
    const id = setInterval(() => {
      const c = timelineRef.current?.getCenter()
      if (!c || c.pxPerMs <= 0) return
      const tolMs = 16 / c.pxPerMs // ~16px proximity to the mark, zoom-correct
      const { buffered, saved, splits } = laneRefs.current
      const hit = splits.find((s) => Math.abs(s.atMs - c.timeMs) < tolMs && (sameLane(buffered, s) || sameLane(saved, s))) ?? null
      setUnsnip((prev) => (prev?.atMs === hit?.atMs && prev?.sessionId === hit?.sessionId ? prev : hit))
    }, 150)
    return () => clearInterval(id)
  }, [splitPoints.length])

  // Scissor / bandaid. Over a healable snip → remove the split point (rejoin, metadata only).
  // Otherwise → cut the clip under the static playhead in two (a local split point).
  const handleScissor = useCallback(() => {
    if (unsnip) {
      setSplitPoints((prev) => prev.filter((s) => !(s.sessionId === unsnip.sessionId && s.atMs === unsnip.atMs)))
      setUnsnip(null)
      return
    }
    const c = timelineRef.current?.getCenter()
    if (!c?.clipId) return
    const clip = allClips.find((x) => x.id === c.clipId)
    const sessionId = clip?.sourceSessionId
    if (!clip || !sessionId) return
    if (c.timeMs <= clip.startMs + MIN_REMAINDER_MS || c.timeMs >= clip.endMs - MIN_REMAINDER_MS) return // not strictly inside
    setSplitPoints((prev) => (prev.some((s) => s.sessionId === sessionId && Math.abs(s.atMs - c.timeMs) < 1) ? prev : [...prev, { sessionId, atMs: c.timeMs }]))
  }, [unsnip, allClips])

  // ── transport navigation: smooth-scroll the timeline so a boundary lands on the playhead ──
  // Boundaries = every clip head + tail; plus the reaper (oldest) and now (live) edges.
  const navBoundaries = useMemo(() => {
    const set = new Set<number>()
    for (const c of allClips) {
      set.add(Math.round(c.startMs))
      set.add(Math.round(c.endMs))
    }
    return [...set].sort((a, b) => a - b)
  }, [allClips])

  // The unbroadcasted-time gap bracketing a wall-clock instant (for the gap card). Leading (reaper)
  // → [now−window, oldest]; interior → between two clips; trailing → [last, now].
  const gapSpanAt = useCallback(
    (timeMs: number): { fromMs: number; toMs: number } | null => {
      const first = orderedClips[0]?.startMs
      if (first != null && reaperBoundaryMs != null && timeMs < first - 1) return { fromMs: reaperBoundaryMs, toMs: first }
      let prevEnd = -Infinity
      let nextStart = Infinity
      for (const c of orderedClips) {
        if (c.endMs <= timeMs && c.endMs > prevEnd) prevEnd = c.endMs
        if (c.startMs >= timeMs && c.startMs < nextStart) nextStart = c.startMs
      }
      if (prevEnd > -Infinity && nextStart < Infinity && nextStart > prevEnd) return { fromMs: prevEnd, toMs: nextStart }
      if (prevEnd > -Infinity && nextStart === Infinity && axisTop > prevEnd) return { fromMs: prevEnd, toMs: axisTop }
      return null
    },
    [orderedClips, axisTop, reaperBoundaryMs],
  )
  const goTo = useCallback(
    (timeMsRaw: number, live = false, reaper = false) => {
      scrubbingRef.current = false // a transport/nav jump cancels any in-flight scrub decay (see seekTo)
      setScrubbing(false)
      setSelectedId(null)
      setFollowLive(live) // now-edge jump → clock NOW
      setRidingReaper(reaper) // reaper-edge jump → clock THEN, ticking toward eviction
      // The playhead is authoritative — nav MOVES it (not just the scroll). `now` can sit past the
      // last footage (the caught-up edge), so don't clamp to lastEnd; but never land in the reaped
      // region (older than the reaper edge) — clamp up to the window boundary.
      const timeMs = windowStartMs != null ? Math.max(timeMsRaw, windowStartMs) : timeMsRaw
      playheadRef.current = timeMs
      setPlayheadMs(timeMs)
      setVideoMode(true)
      const clip = allClips.find((c) => timeMs >= c.startMs - 1 && timeMs <= c.endMs + 1)
      setCenterClipId(clip?.id ?? null)
      // Gap card at the destination: the trailing region (incl. the now edge) → "since last
      // broadcast"; an interior gap → "{dur} gap"; footage → none.
      const nowEdge = nowEdgeRef.current
      if (!clip && nowEdge - lastEndRef.current > SEAM_GAP_MS && timeMs >= lastEndRef.current - 1) {
        setGapCard({ fromMs: lastEndRef.current, toMs: nowEdge })
      } else {
        setGapCard(clip ? null : gapSpanAt(timeMs))
      }
      // Same loaded clip → seek the video here (tolerant + ready-gated); a different clip loads +
      // seeks via the load effect.
      if (clip && clip.id === playerIdRef.current) scheduleSeek(timeMs)
      timelineRef.current?.scrollToTime(timeMs, true)
    },
    [allClips, gapSpanAt, windowStartMs, scheduleSeek],
  )
  const goPrev = useCallback(() => {
    const c = timelineRef.current?.getCenter()
    if (!c) return
    let target: number | undefined
    for (const b of navBoundaries) {
      if (b < c.timeMs - 1) target = b
      else break
    }
    if (target != null) goTo(target)
  }, [navBoundaries, goTo])
  const goNext = useCallback(() => {
    const c = timelineRef.current?.getCenter()
    if (!c) return
    const target = navBoundaries.find((b) => b > c.timeMs + 1)
    if (target != null) goTo(target)
  }, [navBoundaries, goTo])
  const goReaper = useCallback(() => {
    // The reaper edge (now − window): the leading-gap countdown when there's room, or the oldest
    // footage being consumed (clock ticks THEN at the reaper time) once the window is full.
    if (windowStartMs != null) goTo(windowStartMs, false, true)
    else if (navBoundaries.length) goTo(navBoundaries[0]!, false, true)
  }, [windowStartMs, navBoundaries, goTo])
  const goNow = useCallback(() => goTo(axisTop, true), [goTo, axisTop])

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <ScreenHeader title="Clips" />
        <PageTabs
          tabs={[
            { key: 'grid', label: 'Clips' },
            { key: 'editor', label: 'Editor' },
          ]}
          value="grid"
          onChange={(k) => {
            if (k === 'editor') router.navigate('/(app)/clip-editor')
          }}
          style={styles.pager}
        />
        {/* Sticky viewer for the selected clip — above the buffered/saved bar. Padded
            wrapper gives equal L/R margins (a full-width frame + marginHorizontal would
            overflow the right edge). */}
        {hasAny ? (
          <View style={styles.viewerWrap}>
            <View style={styles.viewerBox}>
              <ClipViewer
                posterUrl={gapCard ? undefined : displayClip?.posterUrl}
                title={gapCard ? undefined : displayClip?.label}
                // Show the VIDEO (not poster) when: at the live edge (live feed), dragging (scrub
                // playback), playing, or after a scrub (videoMode). Over a gap → neither (gap card).
                // playerError (recovery exhausted) → fall back to the poster, not a wedged video frame.
                playing={showLiveFeed || ((scrubbing || playing || videoMode) && !gapCard && !playerError)}
                // While a between-lane VOD swap reloads, hold the incoming poster over the bg (never
                // over the live feed — that's already a live frame, not a reloading VOD).
                coverPoster={vodLoading && !gapCard && !showLiveFeed}
                frameSlot={
                  showLiveFeed ? (
                    // The actual live camera (low-latency), same as the stream page. mirror matches it.
                    <RTCView streamURL={liveStreamUrl!} style={StyleSheet.absoluteFill} objectFit="contain" mirror={liveMirror} zOrder={0} />
                  ) : manifestUrl ? (
                    <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" />
                  ) : undefined
                }
              />
              {/* Gap card — over unbroadcasted time (scrub-through or the play rush). absoluteFills
                  the viewer exactly: no thumb/footage, just a title over the background. */}
              {gapCard ? (
                <View style={styles.gapCard} pointerEvents="none">
                  <Icon
                    name={isReaperCard ? 'clock' : isTrailingCard ? 'radio' : 'moon'}
                    size="lg"
                    color={theme.colors.text.muted}
                  />
                  {isReaperCard ? (
                    <>
                      <Text variant="monoLabel" color={theme.colors.text.primary}>
                        {reapAtRef.current != null ? fmtDur(Math.max(0, reapAtRef.current - serverNow()) / 1000) : '—'}
                      </Text>
                      <Text variant="monoCaption" color={theme.colors.text.muted}>
                        until oldest is reaped
                      </Text>
                    </>
                  ) : isTrailingCard ? (
                    <>
                      <Text variant="monoLabel" color={theme.colors.text.primary}>
                        {fmtDur(Math.max(0, serverNow() - gapCard.fromMs) / 1000)}
                      </Text>
                      <Text variant="monoCaption" color={theme.colors.text.muted}>
                        since last broadcast
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text variant="monoLabel" color={theme.colors.text.primary}>
                        {fmtDur((gapCard.toMs - gapCard.fromMs) / 1000)} gap
                      </Text>
                      <Text variant="monoCaption" color={theme.colors.text.muted}>
                        not broadcast
                      </Text>
                    </>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        {/* Transport directly below the viewer (it drives it); the clock stays at the bottom. */}
        {hasAny ? (
          <BufferTransport
            playing={pausablePlaying}
            reaping={ridingReaper}
            onToStart={goReaper} // 1st — snap the reaper (oldest) edge to the playhead
            onPrevClip={goPrev} // 2nd — previous clip head/tail to the playhead
            onFrameBack={() => seekTo(playheadRef.current - FRAME_MS)}
            onFrameBackHold={(held) => frameHold(-1, held)}
            onTogglePlay={togglePlay}
            onFrameForward={() => seekTo(playheadRef.current + FRAME_MS)}
            onFrameForwardHold={(held) => frameHold(1, held)}
            onNextClip={goNext} // 6th — next clip head/tail to the playhead
            onToEnd={goNow} // 7th — snap the now (live) edge to the playhead
            canPrev={navBoundaries.length > 1}
            canNext={navBoundaries.length > 1}
            canFrameBack={!!manifestUrl && playheadMs > vodStart}
            canFrameForward={!!manifestUrl && playheadMs < vodEnd}
            style={styles.transport}
          />
        ) : null}
      </View>

      {!hasAny ? (
        <View style={styles.empty}>
          <Icon name="film" size="lg" color={theme.colors.text.subtle} />
          <Text variant="bodyEmphasized">No clips yet</Text>
          <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
            Go live to start buffering. Trim + save the bits you want to keep.
          </Text>
        </View>
      ) : (
        <View style={styles.timelineWrap} onTouchStart={() => clockExpanded && setCollapseSignal((s) => s + 1)}>
          {/* Horizontal timeline — reaper left, now right; collapsed gaps; pinch to zoom. */}
          <ClipsTimeline
            ref={timelineRef}
            buffered={bufferedLane}
            saved={savedLane}
            nowMs={axisTop}
            liveSessionId={liveSessionId}
            playing={playing}
            followNow={followLive}
            suppressRide={clockScrubbing}
            holdCamera={laneHold} // freeze the camera during a lane-drag grab (stable target mid-playback)
            onLaneDragChange={onLaneDragChange}
            onRidingChange={setRidingReaper} // mirror the timeline's true riding state → reaper clock + icon
            reaperLane={reaperLane}
            reaperEdgeMs={windowStartMs}
            windowMs={windowMs}
            selectedId={selectedId}
            onSelect={(c) => {
              setSelectedId(c.id) // tap → highlight + preview poster (no timeline reposition)
              setCenterClipId(null)
              setVideoMode(false) // show the tapped clip's poster, not a stale scrub frame
            }}
            onScrubStart={() => {
              setSelectedId(null) // any scrub blurs the selection
              setFollowLive(false) // scrubbing leaves the live edge (re-latched by the follow loop)
              setRidingReaper(false)
              setGapCard(null)
              exitDrive() // the finger owns scroll now → stop deriving the playback picture
              scrubResumePlayingRef.current = playingRef.current
              scrubbingRef.current = true
              setScrubbing(true)
              setVideoMode(true) // show the seeked video frame (scrub playback) for any drag
              // Dragging PAUSES playback (keep the `playing` state → the play button doesn't change).
              if (playingRef.current) player.pause()
            }}
            onCenter={(id, timeMs, inGap) => {
              // While PLAYING (not scrubbing) the transport clock owns the playhead + gap card —
              // ignore the follow-driven onCenter so they don't fight. Scrubbing / idle → follow.
              if (playingRef.current && !scrubbingRef.current) return
              if (id) setCenterClipId(id)
              setGapCard(inGap ? gapSpanAt(timeMs) : null)
            }}
            onScrubEnd={onScrubEnd}
            onOpen={openClip}
            onSave={saveClip}
            onUnsave={unsaveClip}
          />
          {/* Scissor / bandaid — cuts the clip at the playhead, or un-snips when over a snip mark. */}
          <View style={styles.scissorRow} pointerEvents="box-none">
            <Pressable
              variant="none"
              accessibilityLabel={unsnip ? 'Remove the snip at the playhead' : 'Cut clip at the playhead'}
              onPress={handleScissor}
              style={[styles.scissorBtn, unsnip && styles.bandaidBtn]}
            >
              {unsnip ? (
                <MaterialCommunityIcons name="bandage" size={20} color={theme.colors.text.inverse} />
              ) : (
                <Icon name="scissors" size="md" color={theme.colors.text.inverse} />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Bottom clock — the transport moved up under the viewer. The clock expands upward,
          pushing the grid up as it grows; it drives the selected clip's playhead. */}
      {hasAny ? (
        <View style={styles.bottomChrome}>
          <TimeScrubber
            offsetMs={offsetForClock}
            liveTick={ridingReaper}
            onOffsetChange={(off) => {
              if (off <= 0) {
                goNow() // tap NOW → skip the timeline to the now edge (+ pin the clock to NOW)
                return
              }
              const t = serverNow() - off
              seekTo(t)
              timelineRef.current?.scrollToTime(t, true) // dial scrub → bring the instant under the playhead
            }}
            playback={false}
            collapseSignal={collapseSignal}
            onExpandedChange={setClockExpanded}
            onScrubStart={() => {
              if (player.playing) {
                player.pause()
                setPlaying(false)
              }
              // Wheeling the clock leaves any edge ride → suppress the reaper latch so the playhead can
              // move forward off the edge (the latch re-engages on release if it lands back at the edge).
              setClockScrubbing(true)
              setFollowLive(false)
            }}
            onScrubEnd={() => setClockScrubbing(false)}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  header: {
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  pager: {
    marginTop: theme.spacing.sm,
  },
  viewerWrap: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  // Holds the viewer + the gap card so the card absoluteFills the viewer EXACTLY (same size).
  viewerBox: {
    width: '100%',
  },
  // Full-cover gap card — fills the viewer exactly; hides footage/poster, just a title.
  gapCard: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: theme.colors.bg.panel,
  },
  transport: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  timelineWrap: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  // Bottom-right of the timeline, just above the clock.
  scissorRow: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  scissorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.default,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.bg.primary,
  },
  // Un-snip mode reads as a distinct ink button (heal/rejoin), not the accent cut button.
  bandaidBtn: {
    backgroundColor: theme.colors.text.primary,
  },
  bottomChrome: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.primary,
    paddingTop: theme.spacing.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 260,
  },
})
