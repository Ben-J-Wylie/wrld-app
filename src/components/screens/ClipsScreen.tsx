// src/components/screens/ClipsScreen.tsx
//
// Clips landing — the first page from the Clip (footer) button. A two-lane, time-ordered
// grid of every clip: buffered sessions on the LEFT, saved clips on the RIGHT, on a shared
// vertical time axis. NEWEST is at the TOP (scroll down = older); "now" is the top edge.
//
// The axis lays out clips PER-CLIP so each one keeps a readable, tappable block: a clip's
// height is its duration × zoom, FLOORED to MIN_BLOCK_H, and that floored height is the
// space it reserves — so short clips never collapse to slivers and blocks never overlap.
// Empty stretches between clips (and the leading stretch from "now") collapse to a fixed
// `TimeGapMarker`. 2-finger pinch zooms (longer clips grow past the floor → proportional).
// Double-tap a clip → editor; drag a clip across to the other lane to save / un-save.
//
// Saved lane = the durable Clip pool (useSavedClips). A saved clip is the SAME clip as its
// source buffer session in two states (linked by sourceSessionId), so it shows in exactly
// one lane. Clips carry their own poster + manifest (durable, survives buffer eviction).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { Alert, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { ClipLane, type LaneClip, type ClipPos } from '@/components/features/clip/ClipLane'
import { TimeGapMarker } from '@/components/features/clip/TimeGapMarker'
import { ClipTimeRuler, type RulerTick } from '@/components/features/clip/ClipTimeRuler'
import { ClipsTimeline } from '@/components/features/clip/ClipsTimeline'
import { ClipViewer } from '@/components/features/clip/ClipViewer'
import { BufferTransport } from '@/components/features/clip/BufferTransport'
import { TimeScrubber } from '@/components/features/discovery/TimeScrubber'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useBuffer } from '@/hooks/useBuffer'
import { useSavedClips } from '@/hooks/useSavedClips'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { bufferApi, type BufferSession } from '@/api/buffer'

const FRAME_MS = 1000 / 30 // one frame at the 30fps capture (transport frame-step)
const GUTTER_W = 52 // left ruler column (ghosted time marks)
const MIN_TICK_GAP = 26 // min vertical px between ruler labels so they don't collide
const MIN_BLOCK_H = 34 // a short clip stays a readable, tappable block
const GAP_PX = 34 // height an empty stretch collapses to
const GAP_THRESHOLD_MS = 45_000 // gaps longer than this get a marker; shorter → a hair of spacing
const MICRO_GAP_PX = 5 // spacing between near-adjacent clips (no marker)
const LONGEST_DEFAULT_PX = 130 // at the default zoom, the longest clip is about this tall
const MAX_PX_PER_MS = 0.2 // ~1s ≈ 200px at full zoom

// Dev-only trace to the Metro terminal for diagnosing drag-to-save (stripped in prod).
const slog = (...args: unknown[]) => {
  if (__DEV__) console.log('[clips-save]', ...args)
}

const MATCH_TOL_MS = 2000 // window tolerance matching an optimistic save to its real Clip
const MIN_REMAINDER_MS = 1000 // don't show carved remainders shorter than this

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
// Coarse gap label: "2d 4h", "3h 12m", "12m", "45s".
function fmtGap(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(t / 86400)
  const h = Math.floor((t % 86400) / 3600)
  const m = Math.floor((t % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m`
  return `${t}s`
}

// ── carve: the buffer lane shows footage MINUS the saved ranges ──────────────
// A saved (possibly trimmed) clip carves its range out of its source session; the leading /
// trailing remainder stay as buffer entries you can still clip. Whole-session save → nothing
// remains (the "move" case). Backend keeps the buffer footage on save (verified), so this is
// a pure display computation.
type Claim = { sessionId: string; startMs: number; endMs: number }
// An in-flight drag-to-save: carves its range out + shows a saved-lane placeholder until the
// real Clip lands (then it's pruned and the real clip takes over seamlessly).
type PendingSave = { tempId: string; sessionId: string; startMs: number; endMs: number; label: string; posterUrl?: string | null; manifestUrl?: string | null }
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

// ── per-clip collapsed layout ────────────────────────────────────────────────
type GapMark = { yTop: number; height: number; ms: number }
type Layout = { pos: Map<string, ClipPos>; gaps: GapMark[]; contentHeight: number }
// Walk all clips NEWEST → OLDEST (top → bottom): give each a `top`/`height` slot (duration×px,
// floored to MIN_BLOCK_H) and collapse the empty stretches between them — and from `nowMs` down to
// the newest clip — to gaps. Newest at the top, oldest at the bottom; "now" is the top edge.
// Reserving the floored height is what stops short blocks overlapping (the old thin-line bug).
function buildLayout(clips: LaneClip[], px: number, nowMs: number): Layout {
  const sorted = clips
    .filter((c) => Number.isFinite(c.startMs) && Number.isFinite(c.endMs) && c.endMs >= c.startMs)
    .sort((a, b) => b.startMs - a.startMs) // newest first
  const pos = new Map<string, ClipPos>()
  const gaps: GapMark[] = []
  let cursor = 0
  // Leading gap at the TOP: from now down to the newest clip's end.
  if (sorted.length && nowMs > sorted[0]!.endMs + GAP_THRESHOLD_MS) {
    gaps.push({ yTop: cursor, height: GAP_PX, ms: nowMs - sorted[0]!.endMs })
    cursor += GAP_PX
  }
  let prevStart: number | null = null // start of the previously-placed (newer) clip
  for (const c of sorted) {
    if (prevStart != null && prevStart > c.endMs) {
      const gapMs = prevStart - c.endMs
      if (gapMs > GAP_THRESHOLD_MS) {
        gaps.push({ yTop: cursor, height: GAP_PX, ms: gapMs })
        cursor += GAP_PX
      } else {
        cursor += MICRO_GAP_PX
      }
    }
    const height = Math.max(MIN_BLOCK_H, (c.endMs - c.startMs) * px)
    pos.set(c.id, { top: cursor, height })
    cursor += height
    prevStart = prevStart == null ? c.startMs : Math.min(prevStart, c.startMs)
  }
  return { pos, gaps, contentHeight: cursor }
}

export const ClipsScreen = () => {
  const insets = useSafeAreaInsets()
  const { isSignedIn } = useAuth()
  const isLive = useBroadcastStore((s) => s.isLive)
  const qc = useQueryClient()
  const { data: buffer, refetch: refetchBuffer } = useBuffer(!!isSignedIn, isLive)
  const { data: savedData, refetch: refetchSaved } = useSavedClips(!!isSignedIn)
  // Trace what the saved-clip list returns (does a just-saved clip show up?).
  useEffect(() => {
    slog('GET /buffer/me/clips →', savedData?.length ?? 0, 'saved clip(s)', (savedData ?? []).map((c) => c.id))
  }, [savedData])

  // ── lanes: buffer = footage minus saved ranges (carve); saved = the saved clips ──
  const sessions = useMemo(() => buffer?.sessions ?? [], [buffer])

  // Un-save: optimistically drop a clip being deleted (its range un-carves → back to buffer).
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set())
  // In-flight drag-to-save: carved out + placeholdered until the real Clip lands.
  const [pendingSaves, setPendingSaves] = useState<PendingSave[]>([])

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

  // A pending save stays "pending" until a real saved clip with a matching window arrives.
  const matchesReal = useCallback(
    (ps: PendingSave) =>
      realSavedData.some(
        (c) => c.bufferSessionId === ps.sessionId && Math.abs(c.startAtMs - ps.startMs) < MATCH_TOL_MS && Math.abs(c.endAtMs - ps.endMs) < MATCH_TOL_MS,
      ),
    [realSavedData],
  )
  const pendingNotReal = useMemo(() => pendingSaves.filter((ps) => !matchesReal(ps)), [pendingSaves, matchesReal])

  const savedLane = useMemo<LaneClip[]>(
    () => [
      ...savedLaneReal,
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
    ],
    [savedLaneReal, pendingNotReal],
  )

  // Carve: subtract the saved ranges (real + pending) from each session → remaining footage.
  const claims = useMemo<Claim[]>(() => {
    const out: Claim[] = []
    for (const c of realSavedData) {
      if (c.ranges?.length) for (const r of c.ranges) out.push({ sessionId: r.bufferSessionId, startMs: r.startAtMs, endMs: r.endAtMs })
      else if (c.bufferSessionId) out.push({ sessionId: c.bufferSessionId, startMs: c.startAtMs, endMs: c.endAtMs })
    }
    for (const ps of pendingNotReal) out.push({ sessionId: ps.sessionId, startMs: ps.startMs, endMs: ps.endMs })
    return out
  }, [realSavedData, pendingNotReal])

  const bufferedLane = useMemo(() => carveBuffer(sessions, claims), [sessions, claims])
  const allClips = useMemo(() => [...bufferedLane, ...savedLane], [bufferedLane, savedLane])
  const hasAny = allClips.length > 0

  // Prune pending saves once the real list has caught up.
  useEffect(() => {
    setPendingSaves((prev) => {
      const next = prev.filter((ps) => !matchesReal(ps))
      return next.length === prev.length ? prev : next
    })
  }, [matchesReal])

  // ── sticky viewer selection ──
  // Single-tap a clip → preview it in the viewer; default to the newest clip.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedClip = useMemo(() => allClips.find((c) => c.id === selectedId) ?? null, [allClips, selectedId])
  useEffect(() => {
    if ((!selectedId || !allClips.some((c) => c.id === selectedId)) && allClips.length) {
      const newest = allClips.reduce((a, b) => (b.endMs > a.endMs ? b : a))
      setSelectedId(newest.id)
    }
  }, [allClips, selectedId])

  // ── playback: the selected clip drives one video player; the bottom transport + clock
  // control it. For a buffered session, manifestUrl is the session VOD and the clip window
  // is the whole session, so video [0,dur] maps to [clipStart, clipEnd]. Saved clips have no
  // manifest yet → poster only (handoff). ──
  const clipStart = selectedClip?.startMs ?? 0
  const clipEnd = selectedClip?.endMs ?? 0
  const manifestUrl = selectedClip?.manifestUrl ?? null
  const player = useVideoPlayer(null, (p) => {
    p.loop = false
  })
  const [playing, setPlaying] = useState(false)
  const [playheadMs, setPlayheadMs] = useState(0)
  const playheadRef = useRef(0)
  playheadRef.current = playheadMs

  // Load (or clear) the clip's video when the selection changes; reset to its start.
  useEffect(() => {
    setPlaying(false)
    setPlayheadMs(clipStart)
    if (manifestUrl) player.replaceAsync({ uri: manifestUrl, contentType: 'hls' }).catch(() => {})
    else player.replace(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const seekTo = useCallback(
    (ms: number) => {
      const m = clamp(ms, clipStart, clipEnd)
      setPlayheadMs(m)
      if (manifestUrl) {
        try {
          player.currentTime = (m - clipStart) / 1000
        } catch {}
      }
    },
    [clipStart, clipEnd, manifestUrl, player],
  )

  // While playing, follow the video's currentTime → playhead; stop at the clip end.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const ph = clipStart + player.currentTime * 1000
      if (ph >= clipEnd - 16) {
        player.pause()
        setPlaying(false)
        setPlayheadMs(clipEnd)
        return
      }
      setPlayheadMs(ph)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, clipStart, clipEnd, player])

  const togglePlay = useCallback(() => {
    if (!manifestUrl) return
    if (player.playing) {
      player.pause()
      setPlaying(false)
    } else {
      if (playheadRef.current >= clipEnd - 100) seekTo(clipStart) // restart from the top at the end
      player.play()
      setPlaying(true)
    }
  }, [manifestUrl, player, clipEnd, clipStart, seekTo])

  // Prev / next clip = select the time-adjacent clip in the grid.
  const ordered = useMemo(() => [...allClips].sort((a, b) => a.startMs - b.startMs), [allClips])
  const selIdx = ordered.findIndex((c) => c.id === selectedId)
  const canPrev = selIdx > 0
  const canNext = selIdx >= 0 && selIdx < ordered.length - 1

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

  // Clock: a held instant (playback=false). Scrubbing the dial seeks within the clip.
  const offsetForClock = Math.max(0, Date.now() - playheadMs)
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
  // `[clips-save]` traces print to the Metro terminal (dev only) for diagnosing.
  // Drag a buffered remainder right → save just its window. Optimistically carve it out +
  // placeholder it in the saved lane; the real Clip prunes the placeholder when it lands.
  const saveClip = useCallback(
    (clip: LaneClip) => {
      const sessionId = clip.sourceSessionId
      if (!sessionId) return
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
      slog('POST /buffer/me/clips →', payload, `(window ${Math.round((payload.endAtMs - payload.startAtMs) / 1000)}s)`)
      bufferApi
        .saveClip(payload)
        .then((res) => {
          slog('SAVE OK → clipId', res.clipId, '— refetching saved lane')
          refetchSavedSoon()
        })
        .catch((err: unknown) => {
          setPendingSaves((prev) => prev.filter((p) => p.tempId !== tempId)) // revert the optimistic carve
          const e = err as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string }
          slog('SAVE FAILED — status', e.response?.status, '— body', JSON.stringify(e.response?.data), '— msg', e.message)
          const msg = e.response?.data?.message ?? e.response?.data?.error ?? e.message ?? 'Could not save clip'
          Alert.alert('Save failed', msg)
        })
    },
    [sessions, refetchSavedSoon],
  )

  // Drag a SAVED clip left → un-save (delete the durable copy). Optimistically hide
  // it; revert if the delete fails.
  const unsaveClip = useCallback(
    (clip: LaneClip) => {
      if (clip.id.startsWith('pending:')) return // an optimistic placeholder, not a real clip yet
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
    [qc],
  )

  const [lanesRowW, setLanesRowW] = useState(0)
  const reachPx = lanesRowW > 0 ? (lanesRowW + theme.spacing.sm) / 2 : 0

  // ── zoom + time bounds ──
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])
  // On focus (e.g. returning from the editor after a save), refresh both sources so the
  // carve reflects any new saved clip.
  const refetchRef = useRef({ refetchBuffer, refetchSaved })
  refetchRef.current = { refetchBuffer, refetchSaved }
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now())
      refetchRef.current.refetchBuffer()
      refetchRef.current.refetchSaved()
    }, []),
  )
  const axisTop = useMemo(() => {
    let newest = nowMs
    for (const c of allClips) if (Number.isFinite(c.endMs) && c.endMs > newest) newest = c.endMs
    return newest
  }, [allClips, nowMs])
  const maxClipDur = useMemo(() => {
    let m = 0
    for (const c of allClips) {
      const d = c.endMs - c.startMs
      if (Number.isFinite(d) && d > m) m = d
    }
    return m
  }, [allClips])

  const [viewportH, setViewportH] = useState(0)
  const [pxPerMs, setPxPerMs] = useState(0)
  // minPx → the longest clip sits at the floor (all blocks uniform); maxPx → ~1s/200px.
  const minPx = maxClipDur > 0 ? MIN_BLOCK_H / maxClipDur : 0
  const maxPx = Math.max(minPx, MAX_PX_PER_MS)
  const defaultPx = maxClipDur > 0 ? clamp(LONGEST_DEFAULT_PX / maxClipDur, minPx, maxPx) : 0
  const px = pxPerMs > 0 ? clamp(pxPerMs, minPx, maxPx) : defaultPx
  useEffect(() => {
    if (pxPerMs === 0 && defaultPx > 0) setPxPerMs(defaultPx)
  }, [defaultPx, pxPerMs])

  const layout = useMemo(() => buildLayout(allClips, px, axisTop), [allClips, px, axisTop])
  const contentHeight = layout.contentHeight
  const posOf = useCallback((id: string) => layout.pos.get(id), [layout])

  // Ghosted ruler: "now" at the top, then a time mark at each clip's start (top edge),
  // deduped top-down so labels don't collide.
  const rulerTicks = useMemo<RulerTick[]>(() => {
    const sorted = allClips
      .filter((c) => Number.isFinite(c.startMs))
      .map((c) => ({ c, top: layout.pos.get(c.id)?.top }))
      .filter((x): x is { c: LaneClip; top: number } => x.top != null)
      .sort((a, b) => a.top - b.top)
    const out: RulerTick[] = [{ y: 0, label: 'now', now: true }]
    let lastY = 0
    for (const { c, top } of sorted) {
      if (top - lastY < MIN_TICK_GAP) continue
      out.push({ y: top, label: fmtTime(c.startMs) })
      lastY = top
    }
    return out
  }, [allClips, layout])

  const scrollRef = useRef<ScrollView>(null)
  const scrollYRef = useRef(0)
  const pendingScrollY = useRef<number | null>(null)
  const didInitialScroll = useRef(false)
  const pxRef = useRef(px)
  pxRef.current = px
  const clipsRef = useRef(allClips)
  clipsRef.current = allClips
  const axisTopRef = useRef(axisTop)
  axisTopRef.current = axisTop
  const contentHeightRef = useRef(contentHeight)
  contentHeightRef.current = contentHeight

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y
  }
  useEffect(() => {
    if (pendingScrollY.current != null) {
      const y = pendingScrollY.current
      pendingScrollY.current = null
      scrollRef.current?.scrollTo({ y, animated: false })
      scrollYRef.current = y
    }
  }, [px])
  // Land at "now"/newest (the TOP) the first time we have content + a measured viewport.
  useEffect(() => {
    if (!didInitialScroll.current && contentHeight > 0 && viewportH > 0) {
      didInitialScroll.current = true
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }))
    }
  }, [contentHeight, viewportH])

  // Pinch keeps the content fraction under the pinch focal pinned across the rescale.
  const zoomToFocal = useCallback(
    (targetPx: number, focalY: number) => {
      if (viewportH <= 0) return
      const next = clamp(targetPx, minPx, maxPx)
      if (Math.abs(next - pxRef.current) < 1e-12) return
      const oldContent = contentHeightRef.current
      const frac = oldContent > 0 ? (scrollYRef.current + focalY) / oldContent : 0
      const nextLayout = buildLayout(clipsRef.current, next, axisTopRef.current)
      const newScrollY = clamp(frac * nextLayout.contentHeight - focalY, 0, Math.max(0, nextLayout.contentHeight - viewportH))
      pendingScrollY.current = newScrollY
      setPxPerMs(next)
    },
    [minPx, maxPx, viewportH],
  )
  const pxSv = useSharedValue(px)
  // Mirror px into the shared value in an effect (not during render — reanimated's
  // strict mode warns on render-time writes); the pinch gesture reads it on start.
  useEffect(() => {
    pxSv.value = px
  }, [px, pxSv])
  const pinchStartSv = useSharedValue(0)
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          'worklet'
          pinchStartSv.value = pxSv.value
        })
        .onUpdate((e) => {
          'worklet'
          runOnJS(zoomToFocal)(pinchStartSv.value * e.scale, e.focalY)
        }),
    [zoomToFocal, pinchStartSv, pxSv],
  )

  const openClip = useCallback((clip: LaneClip, kind: 'buffered' | 'saved') => {
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
      },
    })
  }, [])

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
            <ClipViewer
              posterUrl={selectedClip?.posterUrl}
              title={selectedClip?.label}
              playing={playing}
              frameSlot={
                manifestUrl ? (
                  <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" />
                ) : undefined
              }
            />
          </View>
        ) : null}
        {/* Transport directly below the viewer (it drives it); the clock stays at the bottom. */}
        {hasAny ? (
          <BufferTransport
            playing={playing}
            onToStart={() => seekTo(clipStart)}
            onPrevClip={() => canPrev && setSelectedId(ordered[selIdx - 1]!.id)}
            onFrameBack={() => seekTo(playheadRef.current - FRAME_MS)}
            onFrameBackHold={(held) => frameHold(-1, held)}
            onTogglePlay={togglePlay}
            onFrameForward={() => seekTo(playheadRef.current + FRAME_MS)}
            onFrameForwardHold={(held) => frameHold(1, held)}
            onNextClip={() => canNext && setSelectedId(ordered[selIdx + 1]!.id)}
            onToEnd={() => seekTo(clipEnd)}
            canPrev={canPrev}
            canNext={canNext}
            canFrameBack={!!manifestUrl && playheadMs > clipStart}
            canFrameForward={!!manifestUrl && playheadMs < clipEnd}
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
            buffered={bufferedLane}
            saved={savedLane}
            nowMs={axisTop}
            selectedId={selectedId}
            onSelect={(c) => setSelectedId(c.id)}
            onOpen={openClip}
            onSave={saveClip}
            onUnsave={unsaveClip}
          />
        </View>
      )}

      {/* Bottom clock — the transport moved up under the viewer. The clock expands upward,
          pushing the grid up as it grows; it drives the selected clip's playhead. */}
      {hasAny ? (
        <View style={styles.bottomChrome}>
          <TimeScrubber
            offsetMs={offsetForClock}
            onOffsetChange={(off) => seekTo(Date.now() - off)}
            playback={false}
            collapseSignal={collapseSignal}
            onExpandedChange={setClockExpanded}
            onScrubStart={() => {
              if (player.playing) {
                player.pause()
                setPlaying(false)
              }
            }}
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
  laneHeaders: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  laneHeaderCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  laneGap: {
    width: theme.spacing.sm,
  },
  transport: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  gridWrap: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  timelineWrap: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  bottomChrome: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.primary,
    paddingTop: theme.spacing.xs,
  },
  gapBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  lanesRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
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
