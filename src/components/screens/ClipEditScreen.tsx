// src/components/screens/ClipEditScreen.tsx
//
// Buffer-trim clip editor — the two-screen flow from the 2026-06-06 brief, behind a
// PageTabs pager: "Editor" (scrub the buffer + set a clip's in/out + name + save) and
// "Saved clips" (the Library list of SavedClipRows). Composes the C2 components:
// BufferScrubField + BufferTimeline (+ ClipBracket / SavedClipRegion / GapMarker /
// TimelineScrollbar) + ClipSourcesDrawer + SaveClipButton + SavedClipRow.
//
// Buffer substrate wired to the real rolling buffer (R5): `useBuffer()` → the
// owner's sessions (GET /buffer/me, owner-gated tokenized HLS + poster thumbs).
// Sessions drive the timeline segments + collapsed gaps, the field's poster
// thumbnail, and the recorded-source list. Saved-clip PERSISTENCE is still R3
// (promote-on-publish) — saving stays in-session (local) until that backend
// route lands; the Saved tab + saved-regions reflect this session's saves only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Alert, Animated, RefreshControl, StyleSheet, View } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { TimeScrubber, CLOCK_COLLAPSED_H, CLOCK_EXPANDED_H } from '@/components/features/discovery/TimeScrubber'
import { Text } from '@/components/primitives/Text'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { BufferScrubField } from '@/components/features/clip/BufferScrubField'
import { BufferTransport } from '@/components/features/clip/BufferTransport'
import {
  BufferTimeline,
  TimelineScrollbarShelf,
  type BufferSegment,
  type BufferSavedRegion,
  type BufferBracket,
  type TimelineThumb,
  type VisibleRange,
  type TimelineLane,
  type ScrollbarState,
  type ScrollbarApi,
} from '@/components/features/clip/BufferTimeline'
import { type TimelineLaneKind } from '@/components/features/clip/TimelineLaneFill'
import { type ClipSource } from '@/components/features/clip/ClipSourcesDrawer'
import { SaveClipSheet } from '@/components/features/clip/SaveClipSheet'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { ClipToolRail, type ClipToolItem } from '@/components/features/clip/ClipToolRail'
import { SourceRail, type SourceRailItem } from '@/components/features/clip/SourceRail'
import { SourceWaveform } from '@/components/features/clip/SourceWaveform'
import { SourceTelemetryGraph } from '@/components/features/clip/SourceTelemetryGraph'
import { SourceLocationTrail } from '@/components/features/clip/SourceLocationTrail'
import { SourceIdentityCard } from '@/components/features/clip/SourceIdentityCard'
import { SourceChatLog } from '@/components/features/clip/SourceChatLog'
import { useAuth } from '@clerk/clerk-expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useBuffer } from '@/hooks/useBuffer'
import { useDataTrack } from '@/hooks/useDataTrack'
import { toGraphValues, readingAt, toTrail, trailPositionAt, toChatLog } from '@/lib/dataTrackRender'
import { useSavedClips } from '@/hooks/useSavedClips'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { bufferApi } from '@/api/buffer'
import type { BufferSession, BufferTrackKind } from '@/api/buffer'
import { theme } from '@/tokens/theme'

type Page = 'editor' | 'saved'

// A saved clip: the named selection a user cuts from the buffer (the Saved-clips
// gallery is ONLY these — not every recording). Persistence is R3 (in-session today).
type SavedClip = {
  id: string
  name: string
  capturedAt: string
  durationSec: number
  variant: 'camera' | 'audio-only' | 'map-only'
  sourcesLabel: string
  visibility: 'draft' | 'anon' | 'public'
}

const H = 3_600_000
const DEFAULT_CLIP_MS = 120_000 // 2 min default bracket on "New clip"
const MIN_BRACKET_MS = 500
const FRAME_MS = 1000 / 30 // one frame at the pinned 30fps capture (transport frame-step)
// Prev/next clip-edge buttons skip edges within this of the playhead (so they advance
// to the NEXT distinct head/tail rather than re-snapping to where you already are).
const EDGE_SNAP_GUARD_MS = 300
// During playback EVERY gap is rushed over exactly this long: the clock spins across the
// gap's full span in 3s, then the next clip plays. Long gap → fast spin; 3s gap → reads
// as normal counting; <3s gap → reads as slowing down.
const GAP_RUSH_MS = 3_000
// The video-authoritative loop only FOLLOWS the video while it's within this of the
// playhead (a genuine in-session stall). Beyond it — a tap-seek jump, or the video run
// ahead into the next session across a collapsed gap — it must NOT glue, so the tap
// sticks and the gap-rush fires. Must sit above the in-session seek-drift tolerance.
const VIDEO_FOLLOW_MAX_DRIFT_MS = 2_000
// The glue HOLDS the playhead only during a genuine in-session STALL (video stopped
// advancing). It must NOT fire when the video is just playing forward from a fresh seek
// that landed slightly behind a keyframe — that pulled the playhead BACKWARD ("jumped
// back to catch up") on tap-then-play. Guard 1: the video must be stalled this tick
// (advanced < this fraction of real time). Guard 2: the glue is suppressed briefly after
// any play-start / seek so the post-seek buffering can't snap the playhead back — instead
// the playhead plays on from where it is and the video re-syncs at the next segment.
const VIDEO_STALL_RATIO = 0.5
const GLUE_SUPPRESS_MS = 800
// Field scrub: finger-px to cross an ENTIRE gap, regardless of its duration — collapses
// gaps like the timeline (the 10px inter-gap marker at the field's half rate ≈ 20px), so
// scrubbing has no slowdown over long gaps.
const GAP_SCRUB_PX = 20
// Client-side timeline thumbnails via expo-video generateThumbnailsAsync are OFF —
// confirmed to HANG (6s timeout) twice now: on the original -c:v copy VOD AND, retested
// 2026-06-07, on Aaron's codec-uniform groups (the source loads & PLAYS fine, but
// exact-frame extraction still hangs; there's no tolerant thumbnail API). Path kept
// behind the flag; the durable fix is SERVER-generated thumbnails — wrld-backend
// CLAUDE.md stacked-work item 6. Until then the timeline shows its sprocket filmstrip.
const CLIENT_THUMB_GEN = false
// Max server-frame thumbnails fetched for the timeline's visible window per pass —
// bounds request volume regardless of buffer length (only the on-screen window loads).
const SERVER_THUMB_CAP = 40

// Recorded-source kind → ClipSource row metadata (icon/label/value). Only the
// kinds the buffer actually captured are shown; unknown kinds are skipped.
const KIND_META: Record<string, { key: string; iconName: ClipSource['iconName']; label: string; value: string }> = {
  camera: { key: 'cam', iconName: 'video', label: 'CAMERA', value: 'VIDEO' },
  audio: { key: 'aud', iconName: 'mic', label: 'AUDIO', value: '48 KHZ' },
  location: { key: 'loc', iconName: 'map-pin', label: 'LOCATION', value: 'GPS' },
  compass: { key: 'comp', iconName: 'compass', label: 'COMPASS', value: 'DEG' },
  gyro: { key: 'gyro', iconName: 'navigation', label: 'GYRO', value: 'AXIS' },
}
const KIND_ORDER: BufferTrackKind[] = ['camera', 'audio', 'location', 'compass', 'gyro']

// ── Source viewer (the rail's view switch — which captured track the field renders) ──
// Camera + identity show real data; audio / location / telemetry render against the mock
// below until the buffer descriptor exposes those tracks (Aaron). Distinct from the
// ClipSourcesDrawer save-set above.
// The full dashboard capture suite, top-to-bottom in the SAME order the dashboard
// groups them (identity/location · cam/audio/screen · compass/gyro/motion/speed/temp ·
// torch). The buffer only records 6 of these (BufferTrackKind); the v0.3+ sources
// (motion/speed/temp/torch) and any uncaptured kind render greyed. Icons match the
// dashboard (`FeedThumb` GLYPH + the identity/location meta icons).
const VIEW_META: Record<string, { iconName: SourceRailItem['iconName']; label: string }> = {
  identity: { iconName: 'user', label: 'Identity' },
  location: { iconName: 'map-pin', label: 'Location' },
  chat: { iconName: 'message-circle', label: 'Chat' },
  camera: { iconName: 'video', label: 'Camera' },
  audio: { iconName: 'mic', label: 'Audio' },
  screen: { iconName: 'monitor', label: 'Screen' },
  compass: { iconName: 'compass', label: 'Compass' },
  gyro: { iconName: 'navigation', label: 'Gyro' },
  motion: { iconName: 'activity', label: 'Motion' },
  speed: { iconName: 'fast-forward', label: 'Speed' },
  temp: { iconName: 'thermometer', label: 'Temp' },
  torch: { iconName: 'zap', label: 'Torch' },
}
const RAIL_ORDER = [
  'identity',
  'location',
  'chat',
  'camera',
  'audio',
  'screen',
  'compass',
  'gyro',
  'motion',
  'speed',
  'temp',
  'torch',
]
const MOCK_PEAKS = Array.from({ length: 56 }, (_, i) => 0.3 + 0.55 * Math.abs(Math.sin(i * 0.5)))
const MOCK_COMPASS = Array.from({ length: 56 }, (_, i) => 0.5 + 0.4 * Math.sin(i * 0.32))
const MOCK_GYRO = Array.from({ length: 56 }, (_, i) => 0.5 + 0.45 * Math.sin(i * 0.6 + 1))
const MOCK_TRAIL: [number, number][] = Array.from({ length: 22 }, (_, i) => [
  -0.1276 + i * 0.0009,
  51.5074 + 0.0006 * Math.sin(i * 0.5),
])
const EMPTY_SESSIONS: BufferSession[] = []

// Footage occupies [startedAt + mediaStartOffsetMs, + mediaDurationSec] (the time
// model, option b). The session block is its REAL media length — NOT wall-clock
// (startedAt→endedAt/now). The wall-clock tail beyond the footage (encoder warm-up
// at the head, HLS latency at the live edge) is a gap, so the clip never renders
// longer than its footage and never bleeds the next session's head into the tail.
// Falls back to `durationSec` / 0 against an older backend that omits the fields.
// THE single source of truth for a session's length: the real flushed media
// (the served HLS playlist's EXTINF sum), precise — never the rounded durationSec.
// Both the timeline geometry AND the playback media-time math derive from this, so
// they're locked to the same value (and to what the player actually plays).
const sessionMediaSec = (s: BufferSession) => Math.max(0, s.mediaDurationSec ?? s.durationSec)
const sessionStartMs = (s: BufferSession) => Date.parse(s.startedAt) + (s.mediaStartOffsetMs ?? 0)
const sessionEndMs = (s: BufferSession) => sessionStartMs(s) + sessionMediaSec(s) * 1000

// A clip's display name when opened from the Clips grid — its start wall-clock time.
const clipLabel = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `Clip · ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ── per-lane clip model (trim/delete carve per-lane removed ranges → no-data blocks) ──
type Interval = { startMs: number; endMs: number }

// Union of overlapping/adjacent removed ranges, so the no-data blocks stay tidy.
function mergeIntervals(ivs: Interval[]): Interval[] {
  if (ivs.length <= 1) return ivs
  const sorted = [...ivs].sort((a, b) => a.startMs - b.startMs)
  const out: Interval[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.startMs <= last.endMs) last.endMs = Math.max(last.endMs, cur.endMs)
    else out.push({ ...cur })
  }
  return out
}

// Dev-only video diagnostics (stripped from production by the __DEV__ guard).
function vlog(msg: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  if (__DEV__) console.log(`[clip-video] ${msg}`, extra ?? '')
}

// Reject if a promise doesn't settle in time — generateThumbnailsAsync can hang
// forever on a -c:v copy HLS VOD (exact-frame extraction), which would otherwise wedge
// the generator. (The native work may continue, but the JS side recovers.)
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export const ClipEditScreen = () => {
  const { isSignedIn } = useAuth()
  // The user's own live state — the authoritative, immediate signal that the
  // latest buffer session is actively being written right now. Drives the live
  // (teeth) tail and a faster buffer refetch while live.
  const isLive = useBroadcastStore((s) => s.isLive)
  const { data: buffer, refetch: refetchBuffer } = useBuffer(!!isSignedIn, isLive)
  const { data: currentUser } = useCurrentUser()
  const { data: savedClipsData } = useSavedClips(!!isSignedIn)
  const qc = useQueryClient()
  const sessions = buffer?.sessions ?? EMPTY_SESSIONS

  // ── focus clip (opened from the Clips grid) ──────────────────────────────────
  // When navigated with `clipId` + `kind`, the editor scopes to THAT clip's own
  // window — a single segment over [start, end], NO rolling-buffer leading-eviction
  // gap, NO live tail, playhead bounded to the clip. (Phase C scaffold: the video
  // VOD mapping below stays whole-buffer, so a clip whose footage is in the buffer
  // plays from the correct media offset; a saved clip whose footage has since been
  // evicted degrades to its poster until real saved-clip playback is wired.)
  // `startMs`/`endMs` bound a carved buffer interval directly (its id is synthetic); `clipId`
  // resolves a saved clip or whole session for its name. `kind` is a hint.
  const { clipId, startMs: pStartMs, endMs: pEndMs, draftId: pDraftId } = useLocalSearchParams<{ clipId?: string; kind?: string; startMs?: string; endMs?: string; sessionId?: string; draftId?: string }>()
  const focusClip = useMemo<{ startMs: number; endMs: number; name: string } | null>(() => {
    const ps = pStartMs ? Number(pStartMs) : NaN
    const pe = pEndMs ? Number(pEndMs) : NaN
    const saved = clipId ? (savedClipsData ?? []).find((x) => x.id === clipId) : undefined
    if (Number.isFinite(ps) && Number.isFinite(pe) && pe > ps) {
      // A passed window (carved buffer interval, or any explicit range).
      const name = saved?.name?.trim() || clipLabel(ps)
      return { startMs: ps, endMs: pe, name }
    }
    if (!clipId) return null
    if (saved) return { startMs: saved.startAtMs, endMs: saved.endAtMs, name: saved.name?.trim() || clipLabel(saved.startAtMs) }
    const s = sessions.find((x) => x.id === clipId)
    if (s) return { startMs: sessionStartMs(s), endMs: sessionEndMs(s), name: s.title?.trim() || clipLabel(sessionStartMs(s)) }
    return null
  }, [clipId, pStartMs, pEndMs, savedClipsData, sessions])
  const focused = !!focusClip
  const focusedRef = useRef(focused)
  focusedRef.current = focused

  // Pull fresh buffer on every screen focus (ignoring useBuffer's 30s staleTime),
  // so recordings made elsewhere — e.g. a web go-live — show up when you (re)open
  // the editor without relaunching the app. Bound via ref so the focus effect
  // doesn't re-subscribe when refetch's identity changes.
  const refetchOnFocusRef = useRef(refetchBuffer)
  refetchOnFocusRef.current = refetchBuffer
  useFocusEffect(
    useCallback(() => {
      refetchOnFocusRef.current()
    }, []),
  )

  // Pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetchOnFocusRef.current()
    } finally {
      setRefreshing(false)
    }
  }, [])

  // Sessions → timeline segments; live session's end tracks the live head (the
  // 1s tick below re-renders so it stays fresh).
  //
  // MEMOIZED on `sessions` (the query data, stable between refetches): a fresh
  // array every render gave BufferTimeline a new `segBlocks` identity every
  // render, which re-armed its visible-range timer on every render and drove a
  // perpetual setVisibleRange → setThumbs → re-render loop (the "Maximum update
  // depth exceeded" cascade). Segment geometry derives only from `sessions`
  // (real media duration, not wall-clock), so this is the correct dep.
  const bufferSegments: BufferSegment[] = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        startMs: sessionStartMs(s),
        endMs: sessionEndMs(s),
        posterUrl: s.thumbnailUrl, // real broadcast frame per session (server filmstrip later)
      })),
    [sessions],
  )
  // Focused: the clip's own segment(s) — the buffer sessions clipped to [start,end]
  // (the common case is one session = the clip), or a single synthetic segment if the
  // clip's footage isn't in the rolling buffer (a saved recording → poster only).
  const focusSegments: BufferSegment[] = useMemo(() => {
    if (!focusClip) return []
    const overlap = sessions.filter((s) => sessionEndMs(s) > focusClip.startMs && sessionStartMs(s) < focusClip.endMs)
    if (!overlap.length) return [{ id: 'focus', startMs: focusClip.startMs, endMs: focusClip.endMs, posterUrl: null }]
    return overlap.map((s) => ({
      id: s.id,
      startMs: Math.max(focusClip.startMs, sessionStartMs(s)),
      endMs: Math.min(focusClip.endMs, sessionEndMs(s)),
      posterUrl: s.thumbnailUrl,
    }))
  }, [focusClip, sessions])
  const segments = focused ? focusSegments : bufferSegments
  const bufferStartMs = focused ? focusClip!.startMs : sessions.length ? sessionStartMs(sessions[0]!) : Date.now()
  const bufferEndMs = focused ? focusClip!.endMs : Date.now()

  // Leading "eviction" edge: the buffer keeps `windowHours` of footage, so the oldest
  // frame (bufferStartMs) is deleted at bufferStartMs + window. While the oldest footage
  // is newer than the window's oldest boundary (now - window) there's headroom → a
  // leading gap whose card counts down to when the oldest footage starts being deleted.
  const windowMs = (buffer?.windowHours ?? 72) * H
  const leadStartMs = bufferEndMs - windowMs
  // No eviction edge in a focused single-clip view — only the live rolling buffer evicts.
  const hasLeadingGap = !focused && sessions.length > 0 && bufferStartMs > leadStartMs + 60_000
  const leadingGap = hasLeadingGap ? { startMs: leadStartMs, endMs: bufferStartMs } : null

  // DIAGNOSTIC: poster availability + a sample URL (so we can see if thumbnailUrl is
  // populated and what it looks like).
  useEffect(() => {
    const withPoster = sessions.filter((s) => s.thumbnailUrl).length
    vlog(
      `posters: ${withPoster}/${sessions.length} have thumbnailUrl; sample=${
        sessions.find((s) => s.thumbnailUrl)?.thumbnailUrl ?? 'none'
      }`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer])

  const [page, setPage] = useState<Page>('editor')
  // The playhead is an ABSOLUTE instant that HOLDS where you place it (tap / drag /
  // clock) — it does not drift. The only exception is the live head: when `following`
  // (placed at ~now), the 1s tick advances it to now so the clock + timeline auto-
  // follow the live edge. The clock (TimeScrubber) runs in controlled `playback=false`
  // mode and derives its offset from this absolute instant.
  const [playheadMs, setPlayheadMs] = useState(() => Date.now() - 2 * H)
  const [following, setFollowing] = useState(false)
  // True while the user is dragging the field / timeline / clock. The field shows the
  // static server frame under the playhead during a scrub (no video seek = no stutter),
  // then returns to live video on release.
  const [scrubbing, setScrubbing] = useState(false)
  const playheadRef = useRef(playheadMs)
  playheadRef.current = playheadMs
  const followingRef = useRef(following)
  followingRef.current = following
  // The timeline's live zoom (px per ms) drives the field's scrub rate (zoom-relative).
  const timelinePxPerMsRef = useRef(0)
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setClockTick((t) => (t + 1) % 60)
      // Focused single-clip view never follows a live edge.
      if (!focusedRef.current && followingRef.current) setPlayheadMs(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [])
  // Lower bound extends into the leading eviction gap (so you can scrub onto it).
  const clampPlayhead = (ms: number) =>
    focused
      ? clamp(ms, focusClip!.startMs, focusClip!.endMs)
      : clamp(ms, hasLeadingGap ? leadStartMs : bufferStartMs, Date.now())
  // Place the playhead at an absolute instant (held); start following only if it
  // lands at the live edge.
  function placePlayhead(ms: number) {
    const m = clampPlayhead(ms)
    playheadRef.current = m
    setPlayheadMs(m)
    setFollowing(!focused && m >= Date.now() - 1500)
  }
  // When following the live edge, the clock reads exactly 0 (NOW) and live-ticks;
  // otherwise it's the held instant's distance behind now. (Deriving it as
  // Date.now()-playheadMs alone drifts up to ~1s between ticks → reads THEN even at
  // the live head, which is why NOW looked stuck.)
  const offsetForClock = following ? 0 : Math.max(0, Date.now() - playheadMs)
  // While the TimeScrubber clock is expanded, lock the screen scroll so vertical
  // wheel drags aren't stolen by the ScrollView. Touching anything that isn't the
  // clock bumps collapseSignal → the clock collapses → scroll restores.
  const [clockExpanded, setClockExpanded] = useState(false)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const collapseClock = () => {
    if (clockExpanded) setCollapseSignal((s) => s + 1)
  }
  const [bracket, setBracket] = useState<BufferBracket | null>(null)
  // The name-this-clip modal (opened from the tool rail's Save).
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)

  // On opening a focus clip, land the playhead at its start and default the bracket to
  // the whole clip (the user trims in from there). Runs once per focused clip.
  const focusInitRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusClip || !clipId) return
    if (focusInitRef.current === clipId) return
    focusInitRef.current = clipId
    playheadRef.current = focusClip.startMs
    setPlayheadMs(focusClip.startMs)
    setFollowing(false)
    setBracket({ inMs: focusClip.startMs, outMs: focusClip.endMs })
    setPage('editor')
  }, [focusClip, clipId])

  // Saved-clip persistence is R3 — these stay in-session (local) until the
  // promote-on-publish backend route lands.
  const [savedRegions, setSavedRegions] = useState<BufferSavedRegion[]>([])
  const [savedClips, setSavedClips] = useState<SavedClip[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Field poster + variant follow the session under the playhead.
  const sessionAtPlayhead =
    sessions.find((s) => playheadMs >= sessionStartMs(s) && playheadMs <= sessionEndMs(s)) ?? null
  const fieldThumb = sessionAtPlayhead?.thumbnailUrl ?? null
  // The exact server frame under the playhead — shown in the field WHILE scrubbing
  // (instant, no decode) instead of seeking the HLS video on every tick (the cause of
  // scrub stutter). Falls back to the session poster, then the field's placeholder.
  const fieldFrame = (() => {
    const fs = sessionAtPlayhead?.filmstrip
    if (!sessionAtPlayhead || !fs) return null
    const mediaSec = Math.max(0, (playheadMs - sessionStartMs(sessionAtPlayhead)) / 1000)
    const idx = Math.min(fs.frameCount, Math.max(1, Math.floor(mediaSec / fs.intervalSec) + 1))
    return `${fs.baseUrl}/${idx}.jpg?t=${fs.token}`
  })()

  // Streaming iff the user is live now AND the latest session is still open.
  // Gating on `isLive` (not just `endedAt === null`) flips the tail to its dark/
  // ended state the instant the stream stops, without waiting for the backend
  // session-ended roundtrip + refetch.
  const streaming = !focused && isLive && sessions.length > 0 && sessions[sessions.length - 1]!.endedAt === null

  // When the playhead is in a gap (no session under it), the field shows a card
  // instead of video: a static duration for an inter-session gap, or a running
  // "since last broadcast" clock for the trailing gap (not streaming). Recomputed
  // each render — the 1s tick keeps the running clock live. (Leading-edge "footage
  // clears in" countdown is increment 2 — needs a buffer at-capacity signal.)
  const gapCard: { title: string; detail: string } | undefined = (() => {
    if (sessionAtPlayhead) return undefined
    const prev = [...sessions].reverse().find((s) => sessionEndMs(s) <= playheadMs)
    const next = sessions.find((s) => sessionStartMs(s) > playheadMs)
    if (prev && next) return { title: 'GAP', detail: fmtGap(sessionStartMs(next) - sessionEndMs(prev)) }
    if (prev && !next) return { title: 'SINCE LAST BROADCAST', detail: fmtClock(Date.now() - sessionEndMs(prev)) }
    if (!prev && next && hasLeadingGap) {
      return { title: 'FOOTAGE CLEARS IN', detail: fmtClock(Math.max(0, bufferStartMs + windowMs - Date.now())) }
    }
    return undefined
  })()

  // The whole camera buffer is "snapped together" into one concatenated VOD
  // (allManifestUrl, gaps collapsed). The field plays that single stream; the
  // wall-clock playhead maps to a continuous MEDIA time = cumulative camera
  // session durations + intra-session offset, so scrubbing the timeline/clock
  // moves smoothly across every session.
  const allManifestUrl = buffer?.allManifestUrl ?? null
  const camCum = (() => {
    let acc = 0
    return sessions
      .filter((s) => s.kinds.includes('camera'))
      .map((s) => {
        const mediaStart = acc
        acc += sessionMediaSec(s)
        return { s, mediaStart, mediaEnd: acc }
      })
  })()
  const totalCamSec = camCum.length ? camCum[camCum.length - 1]!.mediaEnd : 0

  // ── Codec-uniform groups (backend item 5 fix) ──────────────────────────────
  // The backend splits the camera buffer into runs that share a decoder config,
  // each served as its own HLS VOD (a single EXT-X-MAP). Playing per-group and
  // swapping the source at group boundaries avoids the native-player wedge
  // ("resource unavailable" after a seek) that one mixed-codec stitch causes.
  // Fallback (older backend without `allGroups`, or none): treat the legacy
  // single concatenated stream as one group spanning the whole camera timeline.
  const playGroups: { groupIndex: number; startSec: number; durationSec: number; manifestUrl: string }[] =
    buffer?.allGroups?.length
      ? buffer.allGroups
      : allManifestUrl
        ? [{ groupIndex: 0, startSec: 0, durationSec: totalCamSec, manifestUrl: allManifestUrl }]
        : []
  const hasCameraVideo = playGroups.length > 0
  const playGroupsRef = useRef(playGroups)
  playGroupsRef.current = playGroups

  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const activeGroupIndexRef = useRef(0)
  activeGroupIndexRef.current = activeGroupIndex
  const activeGroupUrl = playGroups.length
    ? playGroups[Math.min(activeGroupIndex, playGroups.length - 1)]!.manifestUrl
    : null

  // global camera media-sec → the group that contains it (+ its local offset).
  function groupForMediaSec(globalSec: number): { index: number; localSec: number; url: string } | null {
    const gs = playGroupsRef.current
    if (!gs.length) return null
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i]!
      if (globalSec >= g.startSec && globalSec < g.startSec + g.durationSec) {
        return { index: i, localSec: globalSec - g.startSec, url: g.manifestUrl }
      }
    }
    const last = gs[gs.length - 1]!
    return { index: gs.length - 1, localSec: Math.max(0, last.durationSec - 0.05), url: last.manifestUrl }
  }
  // global media-sec → local sec within the CURRENTLY-LOADED group (clamped).
  function localForActive(globalSec: number): number {
    const g = playGroupsRef.current[activeGroupIndexRef.current]
    if (!g) return 0
    return clamp(globalSec - g.startSec, 0, Math.max(0, g.durationSec - 0.05))
  }

  // wall-clock playhead → media seconds in the concatenated stream (snap gaps to
  // the nearest camera boundary).
  function playheadToMediaSec(): number {
    if (!camCum.length) return 0
    for (const c of camCum) {
      const st = sessionStartMs(c.s)
      const en = sessionEndMs(c.s)
      if (playheadMs >= st && playheadMs <= en) {
        return c.mediaStart + Math.min(sessionMediaSec(c.s), Math.max(0, (playheadMs - st) / 1000))
      }
    }
    if (playheadMs <= sessionStartMs(camCum[0]!.s)) return 0
    let best = totalCamSec
    for (const c of camCum) if (sessionEndMs(c.s) <= playheadMs) best = c.mediaEnd
    return Math.max(0, Math.min(totalCamSec, best) - 0.05)
  }

  // The field shows camera video whenever any camera footage exists.
  const fieldVariant: 'camera' | 'audio-only' | 'map-only' = hasCameraVideo
    ? 'camera'
    : sessionAtPlayhead?.kinds.includes('audio')
      ? 'audio-only'
      : 'map-only'

  // ── Source viewer: a rail of the buffer's captured sources; tapping one swaps what the
  // field renders. Camera + identity are real; audio/location/telemetry are mock until
  // the buffer exposes those tracks. The rail items come from the union of captured kinds
  // (+ identity, always available from the signed-in user).
  const capturedKinds = useMemo(() => new Set(sessions.flatMap((s) => s.kinds)), [sessions])
  // The rail shows EVERY source. For now every source is selectable (all active) so
  // the full model — incl. the chat + telemetry placeholders — is browsable against
  // the mock viewers; once the buffer descriptor exposes per-track capture state,
  // restore `disabled` for kinds this buffer didn't capture (was: identity always on,
  // others gated on `capturedKinds`).
  const railItems: SourceRailItem[] = useMemo(
    () =>
      RAIL_ORDER.map((k) => ({
        key: k,
        ...VIEW_META[k]!,
        disabled: false,
      })),
    [],
  )
  const [view, setView] = useState('camera')
  // One stacked timeline lane per source (dashboard order). All lanes share the timeline's
  // segment/gap geometry — only each segment's fill differs by source. `selectedKey={view}`
  // ties the lanes to the rail + buffer viewer (one shared selection); `lanesExpanded`
  // toggles the whole stack vs just the selected lane.
  const timelineLanes: TimelineLane[] = useMemo(
    () => RAIL_ORDER.map((k) => ({ key: k, kind: k as TimelineLaneKind, label: VIEW_META[k]!.label })),
    [],
  )
  const [lanesExpanded, setLanesExpanded] = useState(false)
  // Measured height of the whole sticky bottom chrome (scroll/zoom · tools · transport),
  // so the scroll content clears it (chrome + clock are fixed above the scroll, like the
  // dashboard's GoBar over the clock).
  const [chromeH, setChromeH] = useState(0)
  // External scroll/zoom bar — BufferTimeline reports its viewport here + exposes its
  // handlers via the ref, so the bar can live on the sticky chrome (not below a tall stack).
  const [scrollbarState, setScrollbarState] = useState<ScrollbarState | null>(null)
  const scrollbarApiRef = useRef<ScrollbarApi | null>(null)
  // The bottom chrome rides UP when the clock expands (its `bottom` tracks the clock's
  // animated height), so the shelves stay flush above the dial. Mirrors TimeScrubber's
  // own expand timing so they move in lockstep.
  const clockLift = useRef(new Animated.Value(CLOCK_COLLAPSED_H)).current
  useEffect(() => {
    Animated.timing(clockLift, {
      toValue: clockExpanded ? CLOCK_EXPANDED_H : CLOCK_COLLAPSED_H,
      duration: theme.motion.patterns.overlay.duration,
      easing: theme.motion.patterns.overlay.easing,
      useNativeDriver: false,
    }).start()
  }, [clockExpanded, clockLift])
  // True once the user makes a real edit (so just opening a clip doesn't create a draft).
  const editStartedRef = useRef(false)
  // Clip inclusion: which lanes the gutter toggles have ON (in the clip). Default all on.
  // Trims/deletes apply only to these; the clip span comes from their oldest/newest data.
  const [clipLanes, setClipLanes] = useState<Set<string>>(() => new Set(RAIL_ORDER))
  const toggleClipLane = useCallback((key: string) => {
    editStartedRef.current = true
    setClipLanes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  // Per-lane removed (trimmed / deleted) ranges → BufferTimeline renders them as no-data
  // blocks. MOCK-side state today; Aaron's manifest persists these as the real clip edit.
  const [removedByLane, setRemovedByLane] = useState<Record<string, Interval[]>>({})
  const includedKeys = useMemo(() => [...clipLanes], [clipLanes])

  // ── C4.5 draft persistence ──────────────────────────────────────────────────
  // Editing a buffer interval lazily creates a DRAFT and PATCHes its manifest as you edit;
  // editing an already-saved clip PATCHes it in place (C4.4). Save materialises the draft.
  // (Trim window + per-source on/off persist now; per-lane mid-clip deletes — `removedByLane`
  // — are still mock-only.)
  const editingSavedId = useMemo(
    () => (clipId && (savedClipsData ?? []).some((c) => c.id === clipId) ? clipId : null),
    [clipId, savedClipsData],
  )
  // Reopening an existing DRAFT (from the grid) passes its id → continue editing it in place
  // rather than spawning a new draft on the first edit.
  const draftIdRef = useRef<string | null>(pDraftId || editingSavedId)
  const draftPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Reset the draft context when the focused clip changes.
  useEffect(() => {
    editStartedRef.current = false
    draftIdRef.current = pDraftId || editingSavedId
  }, [clipId, editingSavedId, pDraftId])
  const sessionIdForMs = useCallback(
    (ms: number) => sessions.find((s) => sessionStartMs(s) <= ms && sessionEndMs(s) >= ms)?.id ?? sessions[0]?.id ?? null,
    [sessions],
  )
  const sourcesFromLanes = useCallback(
    (lanes: Set<string>) => {
      const out: Record<string, boolean> = {}
      for (const k of capturedKinds) out[k] = lanes.has(k)
      return out
    },
    [capturedKinds],
  )
  // Debounced auto-PATCH while editing a DRAFT (only after a real edit; never on open). A
  // saved clip is NOT auto-patched — a range/source change re-materialises (copies), so those
  // edits apply on explicit save instead.
  useEffect(() => {
    if (!editStartedRef.current || !bracket || editingSavedId) return
    const b = bracket
    const lanes = clipLanes
    if (draftPushTimer.current) clearTimeout(draftPushTimer.current)
    draftPushTimer.current = setTimeout(async () => {
      const sid = sessionIdForMs(b.inMs)
      if (!sid) return
      let id = draftIdRef.current
      if (!id) {
        try {
          id = (await bufferApi.createDraft({ startAtMs: Math.round(b.inMs), endAtMs: Math.round(b.outMs) })).clipId
          draftIdRef.current = id
        } catch {
          return
        }
      }
      try {
        await bufferApi.patchClip(id, {
          ranges: [{ bufferSessionId: sid, startAtMs: Math.round(b.inMs), endAtMs: Math.round(b.outMs) }],
          sources: sourcesFromLanes(lanes),
        })
        qc.invalidateQueries({ queryKey: ['buffer', 'clips'] })
      } catch {}
    }, 600)
    return () => {
      if (draftPushTimer.current) clearTimeout(draftPushTimer.current)
    }
  }, [bracket, clipLanes, editingSavedId, sessionIdForMs, sourcesFromLanes, qc])
  // Keep the selection on a CAPTURED source as the buffer resolves (don't land on a greyed one).
  useEffect(() => {
    const cur = railItems.find((i) => i.key === view)
    if (!cur || cur.disabled) {
      const firstEnabled = railItems.find((i) => !i.disabled)
      if (firstEnabled) setView(firstEnabled.key)
    }
  }, [railItems, view])
  // Mock telemetry/waveform/trail progress tracks the playhead within the current session.
  const viewProgress = sessionAtPlayhead
    ? clamp(
        (playheadMs - sessionStartMs(sessionAtPlayhead)) /
          Math.max(1, sessionEndMs(sessionAtPlayhead) - sessionStartMs(sessionAtPlayhead)),
        0,
        1,
      )
    : 0.5
  // C6 — the viewed data source's `.jsonl`, replayed through the design renderers at
  // `viewProgress`. Fetch the data track for the session under the playhead; falls
  // back to the MOCK placeholders below until real samples land. (cam/audio/identity
  // have no data track → undefined → no fetch.)
  const currentDataUrl =
    view === 'location' || view === 'compass' || view === 'gyro' || view === 'chat'
      ? sessionAtPlayhead?.dataUrls?.[view as BufferTrackKind]
      : undefined
  const dataSamples = useDataTrack(currentDataUrl)
  const dataTrail = useMemo(() => toTrail(dataSamples), [dataSamples])

  const identityMeta: { label: string; value: string }[] = []
  if (sessionAtPlayhead) identityMeta.push({ label: 'Captured', value: fmtClipStamp(sessionStartMs(sessionAtPlayhead)) })
  const capturedLabels = RAIL_ORDER.filter((k) => capturedKinds.has(k as BufferTrackKind)).map((k) => VIEW_META[k]!.label)
  if (capturedLabels.length) identityMeta.push({ label: 'Sources', value: capturedLabels.join(' · ') })
  // The field's chrome variant tracks the active view (light for map/identity, dark else).
  const viewVariant: 'camera' | 'audio-only' | 'map-only' =
    view === 'camera'
      ? fieldVariant
      : view === 'location' || view === 'identity' || view === 'chat'
        ? 'map-only'
        : 'audio-only'

  // ── Video controller ──────────────────────────────────────────────────────
  // Default = PAUSED, holding the frame at the playhead: any playhead change (tap /
  // drag / clock) seeks the player to that frame (throttled) so the viewer refreshes
  // to show it. A play/pause button toggles playback; while playing, the playhead
  // follows the video, and any scrub pauses it again.
  const SEEK_THROTTLE_MS = 120
  const SCRUB_SETTLE_MS = 220 // after the last scrub, pause on the rendered frame

  const player = useVideoPlayer(null, (p) => {
    p.muted = true
    p.pause()
    // Buffer further ahead so playback doesn't stall at segment boundaries (iOS
    // defaults to 0 = auto, which AVPlayer keeps conservative for this tokenized HLS;
    // a stall is what makes the wall-clock playhead run ahead and then hard-seek the
    // video forward — a visible skip). Set the whole object (per-field set is unsupported).
    p.bufferOptions = {
      preferredForwardBufferDuration: 30,
      minBufferForPlayback: 4,
      waitsToMinimizeStalling: true,
    }
  })

  const targetSec = playheadToMediaSec()
  const targetSecRef = useRef(targetSec)
  targetSecRef.current = targetSec
  const camCumRef = useRef(camCum)
  camCumRef.current = camCum

  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  playingRef.current = playing
  // Wall-clock playback anchor: { wall, ph } captured when play starts; the playhead =
  // ph + (now - wall), advancing in real-time over footage until the live edge.
  const playClockRef = useRef<{ wall: number; ph: number } | null>(null)
  // Video-stall detection for the follow glue: the video's currentTime + the wall time
  // sampled on the previous footage tick, so a tick can tell whether the video advanced
  // (playing) or froze (stalled) since then.
  const lastVtRef = useRef(0)
  const lastVtWallRef = useRef(0)
  // While Date.now() < this, the follow glue is suppressed (a play-start / seek just
  // happened, the video is buffering toward the target — don't let it snap the playhead
  // back to the keyframe it landed on).
  const glueSuppressUntilRef = useRef(0)
  // Active gap "rush": spin the clock from `from`→`to` over `hold` (≤GAP_RUSH_MS) while
  // the video holds; `live` = trailing gap (→ go live at the end vs resume next clip).
  const gapRushRef = useRef<{ startWall: number; from: number; to: number; hold: number; live: boolean } | null>(
    null,
  )
  // Suppress the video-follow glue for a beat (after a play-start / seek). Called wherever
  // we kick the video to a new position so the post-seek buffer can't pull the playhead back.
  function suppressGlue() {
    glueSuppressUntilRef.current = Date.now() + GLUE_SUPPRESS_MS
  }

  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSeekAt = useRef(0)
  const pendingSeek = useRef<number | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewPlayingRef = useRef(false) // internal scrub-preview play (not the user `playing` state)
  const wantPauseRef = useRef(false) // settle wants to pause once the final seek has rendered
  const seekCountRef = useRef(0) // diagnostic counter (logged on status change)
  const loadWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null) // stuck-loading recovery
  const totalCamSecRef = useRef(totalCamSec)
  totalCamSecRef.current = totalCamSec

  // Player-recovery state. The tokenized HLS URL is short-lived (useBuffer comment),
  // so after some minutes the source goes "resource unavailable". Recovery RE-FETCHES
  // a fresh descriptor (new token) and reloads with replaceAsync — capped + backed off
  // so it can never tight-loop or freeze the UI (the bug the naive self-heal caused).
  const MAX_HEAL = 4
  const healAttemptsRef = useRef(0)
  const healingRef = useRef(false)
  const healTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playerError, setPlayerError] = useState(false)
  const activeGroupUrlRef = useRef<string | null>(null)
  activeGroupUrlRef.current = activeGroupUrl
  const refetchBufferRef = useRef(refetchBuffer)
  refetchBufferRef.current = refetchBuffer

  // Re-fetch a fresh token + reload. Capped (per-incident) with exponential backoff;
  // when exhausted, surface the poster instead of looping. healAttempts resets to 0
  // whenever the player returns to readyToPlay, so a later expiry gets a full budget.
  function recoverPlayer(reason: string) {
    if (healingRef.current || !activeGroupUrlRef.current) return
    if (healAttemptsRef.current >= MAX_HEAL) {
      vlog(`recovery exhausted (${reason}) — showing poster`)
      setPlayerError(true)
      return
    }
    healingRef.current = true
    healAttemptsRef.current += 1
    const n = healAttemptsRef.current
    const backoff = Math.min(500 * 2 ** (n - 1), 4000)
    vlog(`recover #${n} (${reason}) in ${backoff}ms`)
    if (healTimer.current) clearTimeout(healTimer.current)
    healTimer.current = setTimeout(async () => {
      healTimer.current = null
      try {
        const res = await refetchBufferRef.current() // fresh tokenized URLs
        const idx = activeGroupIndexRef.current
        const url =
          res.data?.allGroups?.[idx]?.manifestUrl ?? res.data?.allManifestUrl ?? activeGroupUrlRef.current
        if (url) {
          await player.replaceAsync({ uri: url, contentType: 'hls' })
          pendingSeek.current = localForActive(targetSecRef.current)
        }
      } catch (e) {
        vlog('recover failed', e)
      } finally {
        healingRef.current = false
      }
    }, backoff)
  }

  // BACKPRESSURE: precise HLS seeks (`currentTime =`) are expensive and pile up if
  // issued faster than they complete — that backlog is what wedged the player after
  // a while. So we only ever seek when the player is `readyToPlay`, always to the
  // LATEST pending target; while it's busy (`loading`) the newest target just
  // overwrites `pendingSeek`, and the statusChange→readyToPlay handler re-flushes it.
  // One in-flight seek at a time, to the most recent frame.
  function flushSeek() {
    if (seekTimer.current) {
      clearTimeout(seekTimer.current)
      seekTimer.current = null
    }
    if (pendingSeek.current == null) return
    if (player.status !== 'readyToPlay') return // busy — statusChange will re-flush
    lastSeekAt.current = Date.now()
    const sec = pendingSeek.current
    pendingSeek.current = null
    seekCountRef.current += 1
    try {
      // TOLERANT seek (keyframe), not `currentTime =` (zero-tolerance). Precise seeks
      // hang AVPlayer/ExoPlayer in `loading` forever on a -c:v copy HLS VOD after some
      // seeks; seekBy snaps to the nearest keyframe and never wedges. Frame accuracy
      // isn't needed here — the clip in/out come from the timeline, not the video.
      const delta = sec - player.currentTime
      if (Math.abs(delta) >= 0.05) player.seekBy(delta)
    } catch {}
  }
  // Coalesce rapid scrub targets into ~one seek per SEEK_THROTTLE_MS, with a trailing
  // flush so the final landing frame is always applied (subject to the ready gate).
  function scheduleSeek(sec: number) {
    pendingSeek.current = sec
    const since = Date.now() - lastSeekAt.current
    if (since >= SEEK_THROTTLE_MS) flushSeek()
    else if (!seekTimer.current) seekTimer.current = setTimeout(flushSeek, SEEK_THROTTLE_MS - since)
  }
  // Pause on settle, but only once the FINAL seek has actually landed (no pending
  // seek + readyToPlay) — pausing a still-loading player leaves a blank/stale frame.
  function maybeSettlePause() {
    if (!wantPauseRef.current || playingRef.current) {
      wantPauseRef.current = false
      return
    }
    if (pendingSeek.current != null || player.status !== 'readyToPlay') return // not landed yet
    wantPauseRef.current = false
    previewPlayingRef.current = false
    try {
      player.pause()
    } catch {}
  }
  // Paused playhead change → keep the player playing (muted preview) so the seek
  // repaints, then pause once it settles + lands. One play, one pause per burst.
  function previewSeek(sec: number) {
    if (playingRef.current) return // real playback drives itself
    wantPauseRef.current = false
    if (!previewPlayingRef.current) {
      previewPlayingRef.current = true
      try {
        player.play()
      } catch {}
    }
    scheduleSeek(sec)
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null
      wantPauseRef.current = true
      flushSeek()
      maybeSettlePause()
    }, SCRUB_SETTLE_MS)
  }

  // media seconds → wall-clock playhead (inverse of playheadToMediaSec), for
  // following the video during playback.
  function mediaSecToPlayhead(sec: number): number | null {
    const cc = camCumRef.current
    if (!cc.length) return null
    for (const c of cc) {
      if (sec >= c.mediaStart && sec <= c.mediaEnd) return sessionStartMs(c.s) + (sec - c.mediaStart) * 1000
    }
    return sessionEndMs(cc[cc.length - 1]!.s)
  }

  // wall-clock ms → GLOBAL media seconds, ONLY within camera footage (null in gaps) —
  // lets wall-clock playback decide whether to play the video (footage) or hold (gap).
  function globalSecForWall(ms: number): number | null {
    for (const c of camCumRef.current) {
      const st = sessionStartMs(c.s)
      const en = sessionEndMs(c.s)
      if (ms >= st && ms <= en) {
        return c.mediaStart + Math.min(sessionMediaSec(c.s), Math.max(0, (ms - st) / 1000))
      }
    }
    return null
  }

  // The camera-footage gap an instant falls in: [end of the prior clip → start of the
  // next clip], or [last clip end → now] for the trailing gap (hasNext=false). null when
  // not in a gap. Used to bound a playback gap-rush.
  function cameraGapAround(ms: number): { start: number; end: number; hasNext: boolean } | null {
    const cc = camCumRef.current
    if (!cc.length) return null
    // Leading eviction gap (before the first clip) → rush forward to the first clip.
    if (ms < sessionStartMs(cc[0]!.s)) {
      return { start: ms, end: sessionStartMs(cc[0]!.s), hasNext: true }
    }
    for (let i = 0; i < cc.length; i++) {
      const en = sessionEndMs(cc[i]!.s)
      const nextStart = i + 1 < cc.length ? sessionStartMs(cc[i + 1]!.s) : null
      if (ms >= en && (nextStart == null || ms < nextStart)) {
        return { start: en, end: nextStart ?? Date.now(), hasNext: nextStart != null }
      }
    }
    return null
  }

  // A scrub interaction pauses playback (so the seeked frame holds).
  function markScrubbing() {
    if (playingRef.current) setPlaying(false)
  }

  // Drag scrub honours the play state like a tap (and like the clock): while the finger
  // is down, pause so playback doesn't fight the drag; on lift, resume from the new
  // position if it was playing (slightly after, so the frame settles); if it was paused,
  // stay paused there.
  const wasPlayingRef = useRef(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleScrubStart() {
    setScrubbing(true)
    // If a resume is already pending, we were playing before this burst — keep that
    // intent so adjusting several wheels (or re-grabbing) in a row still resumes at the
    // end, instead of each new grab capturing the already-paused state as "was paused".
    const resuming = resumeTimer.current != null
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current)
      resumeTimer.current = null
    }
    wasPlayingRef.current = resuming || playingRef.current
    if (playingRef.current) setPlaying(false)
  }
  function handleScrubEnd() {
    setScrubbing(false)
    if (!wasPlayingRef.current) return
    wasPlayingRef.current = false
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null
      playClockRef.current = null // re-anchor the wall clock at the new playhead
      gapRushRef.current = null
      setPlaying(true)
    }, 250)
  }

  // Load the ACTIVE GROUP's source (replaceAsync — replace() loads synchronously on
  // the iOS main thread and freezes the UI). Re-runs when the active group changes
  // (a boundary crossing) or its token refreshes. A fresh URL means a fresh token →
  // reset the recovery budget + clear any prior error. After load, seek to the
  // current target's offset within the group + repaint, so a boundary swap lands on
  // the scrubbed frame.
  useEffect(() => {
    if (!activeGroupUrl) return
    healAttemptsRef.current = 0
    setPlayerError(false)
    let cancelled = false
    ;(async () => {
      try {
        await player.replaceAsync({ uri: activeGroupUrl, contentType: 'hls' })
        if (cancelled) return
        const local = localForActive(targetSecRef.current)
        if (playingRef.current) {
          suppressGlue() // boundary swap re-seek — don't glue the playhead back to it
          try {
            const d = local - player.currentTime
            if (Math.abs(d) >= 0.05) player.seekBy(d)
          } catch {}
          try {
            player.play()
          } catch {}
        } else {
          previewSeek(local)
        }
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [activeGroupUrl, player])

  // Status watcher: (1) DIAGNOSTIC log of every transition + seek count; (2) on
  // readyToPlay, reset the recovery budget, re-flush the latest pending seek, and
  // settle-pause if the scrub is done; (3) on error OR stuck-loading, recoverPlayer()
  // (refetch a fresh token + replaceAsync, capped + backed off — never a tight loop).
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, oldStatus, error }) => {
      vlog(`${oldStatus ?? '?'} → ${status}  seeks=${seekCountRef.current}`, error)
      if (loadWatchdog.current) {
        clearTimeout(loadWatchdog.current)
        loadWatchdog.current = null
      }
      if (status === 'loading') {
        // A normal seek clears this in a few hundred ms; if `loading` outlives the
        // watchdog the player has wedged (silent stuck-loading) → recover.
        loadWatchdog.current = setTimeout(() => recoverPlayer('stuck loading'), 2500)
      } else if (status === 'readyToPlay') {
        healAttemptsRef.current = 0
        setPlayerError(false)
        if (pendingSeek.current != null) flushSeek()
        maybeSettlePause()
      } else if (status === 'error') {
        recoverPlayer('error')
      }
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, activeGroupUrl])

  // Paused: seek to the playhead frame on every change (preview-play → settle-pause)
  // so the viewer refreshes to that frame. (Fixes blank-on-tap + post-use stalling.)
  // Group-aware: if the target falls in a different codec-uniform group, switch the
  // source (the load effect seeks + repaints); otherwise seek within the active group.
  useEffect(() => {
    if (!hasCameraVideo || playing) return
    const g = groupForMediaSec(targetSec)
    if (!g) return
    if (g.index !== activeGroupIndexRef.current) setActiveGroupIndex(g.index)
    else previewSeek(g.localSec)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadMs, playing, hasCameraVideo])

  // Play / pause — play from the current playhead.
  useEffect(() => {
    if (!hasCameraVideo) return
    // Tear down any in-flight preview-scrub timers so they can't fight the explicit
    // play/pause.
    if (settleTimer.current) {
      clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
    if (seekTimer.current) {
      clearTimeout(seekTimer.current)
      seekTimer.current = null
    }
    previewPlayingRef.current = false
    wantPauseRef.current = false
    if (playing) {
      pendingSeek.current = null
      suppressGlue() // play from the tapped spot — don't let the post-seek buffer snap back
      const g = groupForMediaSec(targetSecRef.current)
      if (g && g.index !== activeGroupIndexRef.current) {
        setActiveGroupIndex(g.index) // load effect plays on ready (playingRef)
      } else {
        try {
          const delta = localForActive(targetSecRef.current) - player.currentTime
          if (Math.abs(delta) >= 0.05) player.seekBy(delta) // tolerant — see flushSeek
        } catch {}
        player.play()
      }
    } else {
      player.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeGroupUrl, player])

  // Playback is WALL-CLOCK driven (real-time) over footage; the video follows (plays
  // over footage, holds over gaps). It never stops at a clip end — only at the live edge.
  // GAPS RUSH: the playhead spins across the gap's full wall-clock span over a fixed
  // GAP_RUSH_MS (3s) while the video holds, then the next clip plays — so a long gap
  // rushes fast, a 3s gap reads as normal counting, a <3s gap reads as slowing.
  //
  // Driven by requestAnimationFrame: the GAP RUSH updates every frame (smooth, like the
  // scrub — the clock is the only visual there); FOOTAGE is throttled to ~200ms (the
  // video is the visual, so frequent playhead re-renders aren't needed and stay cheap).
  useEffect(() => {
    if (!playing) {
      playClockRef.current = null
      gapRushRef.current = null
      return
    }
    let raf = 0
    let lastFootage = 0
    const step = () => {
      raf = requestAnimationFrame(step)
      // GAP RUSH — every frame.
      if (gapRushRef.current) {
        const r = gapRushRef.current
        const f = clamp((Date.now() - r.startWall) / r.hold, 0, 1)
        const ph = r.from + f * (r.to - r.from)
        playheadRef.current = ph
        setPlayheadMs(ph)
        try {
          player.pause()
        } catch {}
        if (f >= 1) {
          gapRushRef.current = null
          if (r.live) {
            setPlaying(false)
            setFollowing(true)
          } else {
            playClockRef.current = { wall: Date.now(), ph: r.to } // resume footage at next clip
          }
        }
        return
      }
      // FOOTAGE — throttled to ~200ms.
      const now = Date.now()
      if (now - lastFootage < 200) return
      lastFootage = now
      if (!playClockRef.current) {
        playClockRef.current = { wall: now, ph: playheadRef.current }
        // Fresh anchor → reset the stall baseline so the first tick isn't misread.
        lastVtRef.current = player.currentTime
        lastVtWallRef.current = now
      }
      // Did the video advance ~in step with real time since the last tick (it's PLAYING)
      // or freeze (a STALL)? Only a genuine stall may glue the playhead back to the video.
      const vtNow = player.currentTime
      const dtWall = now - lastVtWallRef.current
      const vtAdvanced = vtNow - lastVtRef.current
      lastVtRef.current = vtNow
      lastVtWallRef.current = now
      const videoStalled = dtWall > 0 && vtAdvanced * 1000 < dtWall * VIDEO_STALL_RATIO
      // Suppressed right after a play-start/seek (post-seek buffer) AND only while the video
      // is genuinely stalled — so a fresh tap-seek that landed just behind a keyframe plays
      // ON from the tap instead of snapping the playhead BACK to the keyframe.
      const glueAllowed = now >= glueSuppressUntilRef.current && videoStalled
      // VIDEO-AUTHORITATIVE in-session: glue the wall-clock anchor to where the video
      // ACTUALLY is, so the playhead FOLLOWS the video rather than the video being seeked
      // to the playhead. During a real stall this holds the playhead with the video (no
      // run-ahead, no forward-skip-on-resume). Released within ~0.6s of a session end so
      // the wall clock can still advance into the gap and fire the gap-rush + clip skip.
      const ag = playGroupsRef.current[activeGroupIndexRef.current]
      if (glueAllowed && ag && vtNow > 0.1) {
        const vGlobal = ag.startSec + vtNow
        const sess = camCumRef.current.find((cc) => vGlobal >= cc.mediaStart && vGlobal < cc.mediaEnd)
        if (sess && sess.mediaEnd - vGlobal > 0.6) {
          const vWall = mediaSecToPlayhead(vGlobal)
          // Stay within the drift bound so a cross-session run-ahead (collapsed-gap VOD)
          // still doesn't glue.
          const cur = playClockRef.current
          const curPh = cur.ph + (now - cur.wall)
          if (vWall != null && vWall < now - 300 && Math.abs(vWall - curPh) < VIDEO_FOLLOW_MAX_DRIFT_MS) {
            playClockRef.current = { wall: now, ph: vWall }
          }
        }
      }
      const c = playClockRef.current
      const ph = c.ph + (now - c.wall)
      // Reached the live edge → stop playback and go live (follow the head).
      if (ph >= now - 300) {
        setPlaying(false)
        setFollowing(true)
        return
      }
      // Crossed into a gap → start a fixed-duration rush across its true span.
      if (globalSecForWall(ph) == null) {
        const gap = cameraGapAround(ph)
        if (gap) {
          gapRushRef.current = {
            startWall: Date.now(),
            from: gap.start,
            to: gap.end,
            hold: GAP_RUSH_MS,
            live: !gap.hasNext,
          }
          return
        }
      }
      playheadRef.current = ph
      setPlayheadMs(ph)
      // Video follows: footage → play (group + offset, drift-corrected); gap → hold.
      const sec = globalSecForWall(ph)
      if (sec == null) {
        try {
          player.pause()
        } catch {}
        return
      }
      const g = groupForMediaSec(sec)
      if (!g) return
      if (g.index !== activeGroupIndexRef.current) {
        setActiveGroupIndex(g.index) // load effect seeks + plays on ready (playingRef)
        return
      }
      try {
        // Only hard-seek the video back in sync on a LARGE drift. A brief rebuffer
        // stall leaves the video a fraction of a second behind the wall clock; at the
        // old 0.75s threshold that triggered a forward seekBy every stall — a visible
        // skip. Tolerating up to 1.5s lets the video keep playing smoothly (the clock
        // simply leads it slightly) and only corrects a real desync. Paired with the
        // larger forward buffer above, which makes stalls rarer in the first place.
        if (Math.abs(player.currentTime - g.localSec) > 1.5) player.seekBy(g.localSec - player.currentTime)
        player.play()
      } catch {}
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, player])

  // Cleanup the seek + settle + watchdog + heal timers.
  useEffect(() => () => {
    if (seekTimer.current) clearTimeout(seekTimer.current)
    if (settleTimer.current) clearTimeout(settleTimer.current)
    if (loadWatchdog.current) clearTimeout(loadWatchdog.current)
    if (healTimer.current) clearTimeout(healTimer.current)
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
  }, [])

  // ── Timeline thumbnails (real frames over the sprocket filmstrip) ───────────
  // A DEDICATED player (so it never contends with playback seeks) generates frame
  // thumbnails for the timeline's visible window, on demand at the current density.
  // Cached by media-second; capped per pass; tolerant of failure (the timeline falls
  // back to sprockets). Hits the same tokenized VOD, so it degrades with the same
  // substrate issue until that's fixed — hence the graceful fallback, not a hard dep.
  const THUMB_CAP = 28
  const thumbPlayer = useVideoPlayer(null, (p) => {
    p.muted = true
    p.pause()
  })
  const [thumbs, setThumbs] = useState<TimelineThumb[]>([])
  const [visibleRange, setVisibleRange] = useState<VisibleRange | null>(null)
  const visibleRangeRef = useRef<VisibleRange | null>(null)
  visibleRangeRef.current = visibleRange
  const thumbCache = useRef<Map<number, TimelineThumb>>(new Map())
  const genBusyRef = useRef(false) // one generateThumbnailsAsync at a time
  const genPendingRef = useRef(false) // a request arrived mid-generation → re-run after
  const thumbFailRef = useRef(0) // consecutive gen failures/timeouts
  const thumbsDisabledRef = useRef(false) // give up after repeated hangs (unsupported source)

  // wall-clock ms → media seconds, but only within camera footage (null in gaps).
  // The thumbnail player holds the ACTIVE group, so this returns the group-LOCAL
  // second; instants outside the active group return null (their sprockets show).
  function wallToMediaSec(ms: number): number | null {
    let global: number | null = null
    for (const c of camCumRef.current) {
      const st = sessionStartMs(c.s)
      const en = sessionEndMs(c.s)
      if (ms >= st && ms <= en) {
        global = c.mediaStart + Math.min(sessionMediaSec(c.s), Math.max(0, (ms - st) / 1000))
        break
      }
    }
    if (global == null) return null
    const g = playGroupsRef.current[activeGroupIndexRef.current]
    if (!g || global < g.startSec || global >= g.startSec + g.durationSec) return null
    return global - g.startSec
  }

  // Load the dedicated thumbnail source (separate from playback). Tracks the active
  // group so generated frames stay codec-uniform; the cache is per-group (cleared on
  // group change), so local second-buckets never collide across groups.
  useEffect(() => {
    thumbCache.current.clear()
    // NOTE: server-frame thumbs (the effect below) own `thumbs`; don't clear them on
    // group change — the filmstrip is per-session and group-independent.
    if (!CLIENT_THUMB_GEN || !activeGroupUrl) return
    let cancelled = false
    ;(async () => {
      try {
        await thumbPlayer.replaceAsync({ uri: activeGroupUrl, contentType: 'hls' })
        if (!cancelled) thumbPlayer.pause()
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [activeGroupUrl, thumbPlayer])

  // Generate thumbnails for the current visible window. One generateThumbnailsAsync
  // call per pass for the uncached buckets; serialized (busy/pending) so passes never
  // overlap. Reads everything via refs so the thumb-player's readyToPlay listener can
  // call it with fresh inputs. Gated on the dedicated player being loaded — the key
  // fix for "no thumbnails": the first pass often fires before the player is ready, so
  // it now retries from the statusChange listener once it loads. (group-aware: the
  // thumb player tracks the active codec-uniform group.)
  async function runThumbGen() {
    if (!CLIENT_THUMB_GEN || thumbsDisabledRef.current) return
    const range = visibleRangeRef.current
    if (!range || !activeGroupUrlRef.current) {
      vlog(`thumb gen: no range/url (range=${!!range} url=${!!activeGroupUrlRef.current})`)
      return
    }
    if (thumbPlayer.status !== 'readyToPlay') {
      vlog(`thumb gen deferred — player ${thumbPlayer.status}`)
      return
    }
    if (genBusyRef.current) {
      genPendingRef.current = true
      return
    }
    genBusyRef.current = true
    try {
      const { startMs, endMs, cellMs } = range
      if (endMs <= startMs) {
        vlog(`thumb gen: degenerate range ${startMs}..${endMs}`)
        return
      }
      const step = Math.max(cellMs, (endMs - startMs) / THUMB_CAP)
      const wanted: { tMs: number; sec: number; bucket: number }[] = []
      for (let t = startMs; t <= endMs && wanted.length < THUMB_CAP; t += step) {
        const sec = wallToMediaSec(t)
        if (sec == null) continue
        const bucket = Math.round(sec)
        if (wanted.some((w) => w.bucket === bucket)) continue
        wanted.push({ tMs: t, sec, bucket })
      }
      if (!wanted.length) {
        const span = Math.round((endMs - startMs) / 1000)
        vlog(`thumb gen: 0 in-footage cells (span ${span}s, camSessions ${camCumRef.current.length}, totalCam ${Math.round(totalCamSecRef.current)}s)`)
        setThumbs([])
        return
      }
      vlog(`thumb gen: ${wanted.length} cells in window (cache ${thumbCache.current.size})`)
      const missing = wanted.filter((w) => !thumbCache.current.has(w.bucket))
      if (missing.length) {
        const t0 = Date.now()
        try {
          const imgs = await withTimeout(
            thumbPlayer.generateThumbnailsAsync(
              missing.map((m) => m.sec),
              { maxWidth: 96 },
            ),
            6000,
          )
          imgs.forEach((img, i) => {
            const m = missing[i]
            if (m) thumbCache.current.set(m.bucket, { tMs: m.tMs, source: img })
          })
          if (thumbCache.current.size > 240) thumbCache.current.clear()
          thumbFailRef.current = 0
          vlog(`thumb gen +${imgs.length} in ${Date.now() - t0}ms (cache ${thumbCache.current.size})`)
        } catch (e) {
          thumbFailRef.current += 1
          vlog(`thumb gen failed after ${Date.now() - t0}ms (#${thumbFailRef.current})`, e)
          // Repeated hangs → generateThumbnailsAsync isn't viable on this source
          // (exact-frame extraction on the -c:v copy HLS VOD). Stop trying; the
          // timeline keeps its sprocket filmstrip.
          if (thumbFailRef.current >= 2) {
            thumbsDisabledRef.current = true
            vlog('thumbnails disabled — generation unsupported/hanging on this source')
          }
        }
      }
      setThumbs(wanted.map((w) => thumbCache.current.get(w.bucket)).filter(Boolean) as TimelineThumb[])
    } finally {
      genBusyRef.current = false
      if (genPendingRef.current) {
        genPendingRef.current = false
        runThumbGen()
      }
    }
  }

  // Trigger 1: the visible window changed (already debounced by the timeline).
  useEffect(() => {
    runThumbGen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange, activeGroupUrl])

  // Trigger 2: the dedicated thumb player finished loading → (re)generate for the
  // current window. This is what makes the FIRST pass land (it usually fires before
  // the player is readyToPlay). Reads inputs via refs, so binding once is fine.
  useEffect(() => {
    const sub = thumbPlayer.addListener('statusChange', ({ status }) => {
      vlog(`thumb player → ${status}`)
      if (status === 'readyToPlay') runThumbGen()
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbPlayer])

  // ── Timeline filmstrip from SERVER frames (replaces the non-viable client gen) ──
  // Map each visible cell's wall-clock instant to the backend frame URL covering it
  // (per-session `filmstrip`: idx = floor(mediaSec / intervalSec) + 1) and feed
  // BufferTimeline's `thumbnails` prop. Pure URL building — no decode, no seeking, no
  // hang; expo-image fetches/caches the actual frames, and only for the on-screen
  // window. Missing frames (gaps, audio-only, older backend) fall back to sprockets.
  useEffect(() => {
    const range = visibleRange
    if (!range || range.endMs <= range.startMs) {
      setThumbs([])
      return
    }
    const { startMs, endMs, cellMs } = range
    const step = Math.max(cellMs, (endMs - startMs) / SERVER_THUMB_CAP)
    const out: TimelineThumb[] = []
    for (let t = startMs; t <= endMs && out.length < SERVER_THUMB_CAP; t += step) {
      const sess = sessions.find((s) => t >= sessionStartMs(s) && t <= sessionEndMs(s))
      const fs = sess?.filmstrip
      if (!sess || !fs) continue
      const mediaSec = Math.max(0, (t - sessionStartMs(sess)) / 1000)
      const idx = Math.min(fs.frameCount, Math.max(1, Math.floor(mediaSec / fs.intervalSec) + 1))
      out.push({ tMs: t, source: { uri: `${fs.baseUrl}/${idx}.jpg?t=${fs.token}` } })
    }
    setThumbs(out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRange, sessions])

  // The gap an instant falls in (inter-session / leading / trailing), or null in
  // footage — used to collapse gaps during the field scrub.
  function fieldGapAt(ms: number): { start: number; end: number } | null {
    for (const s of sessions) if (ms >= sessionStartMs(s) && ms <= sessionEndMs(s)) return null
    let prevEnd = -Infinity
    let nextStart = Infinity
    for (const s of sessions) {
      const en = sessionEndMs(s)
      const st = sessionStartMs(s)
      if (en <= ms) prevEnd = Math.max(prevEnd, en)
      if (st > ms) nextStart = Math.min(nextStart, st)
    }
    if (prevEnd === -Infinity) return hasLeadingGap ? { start: leadStartMs, end: bufferStartMs } : null
    if (nextStart === Infinity) return { start: prevEnd, end: Date.now() }
    return { start: prevEnd, end: nextStart }
  }

  function handleFieldScrub(deltaPx: number) {
    // Drag right (dx>0) → earlier → playhead moves back. Footage scrubs at half the
    // timeline's 1:1 finger rate (zoom-relative). GAPS ARE COLLAPSED like the timeline:
    // the whole gap is crossed in a small fixed finger distance (GAP_SCRUB_PX) — no
    // slowdown over a long gap, no instant skip, an unbroken glide into the next clip.
    markScrubbing()
    const here = playheadRef.current
    const gap = fieldGapAt(here)
    let msPerPx: number
    if (gap) {
      msPerPx = Math.max(1, (gap.end - gap.start) / GAP_SCRUB_PX)
    } else {
      const ppm = timelinePxPerMsRef.current
      msPerPx = ppm > 0 ? 0.5 / ppm : 30_000
    }
    placePlayhead(here - deltaPx * msPerPx)
  }

  // ── Transport (jump controls below the field) ───────────────────────────────
  // Clip EDGES = every session's start AND end (so prev/next land on clip tails too,
  // not just heads). Prev = nearest edge before the playhead; next = nearest edge after.
  const clipEdges = useMemo(() => {
    const set = new Set<number>()
    sessions.forEach((s) => {
      set.add(sessionStartMs(s))
      set.add(sessionEndMs(s))
    })
    return [...set].sort((a, b) => a - b)
  }, [sessions])
  function prevClipTarget(): number {
    let best: number | null = null
    for (const e of clipEdges) if (e < playheadRef.current - EDGE_SNAP_GUARD_MS) best = e
    // No earlier clip edge → fall back to the HEAD OF BUFFER (the leading eviction-gap
    // edge when there's headroom, else the oldest footage). This mirrors the tail: once
    // you're at the oldest clip's head, a second tap steps out to the buffer head, just
    // as a second forward tap steps past the last clip's tail to the buffer end.
    return best ?? (hasLeadingGap ? leadStartMs : bufferStartMs)
  }
  function nextClipTarget(): number | null {
    for (const e of clipEdges) if (e > playheadRef.current + EDGE_SNAP_GUARD_MS) return e
    return null
  }
  // Bumped to ask the timeline to recenter the playhead in its viewport (animated) —
  // every transport action raises it, so a playhead that scrolled out of frame glides
  // back as close to centre as the zoom allows.
  const [centerSignal, setCenterSignal] = useState(0)
  const recenterTimeline = useCallback(() => setCenterSignal((s) => s + 1), [])

  // Jump the playhead; keep playing across the jump by re-anchoring the wall clock
  // (and cancelling any in-progress gap rush). Recenters the timeline on the new spot.
  function jumpTo(ms: number) {
    placePlayhead(ms)
    if (playingRef.current) {
      playClockRef.current = null
      gapRushRef.current = null
      suppressGlue() // resume from the tapped spot, not the keyframe the video lands on
      // Seek the VIDEO to the new instant too — otherwise the video-authoritative loop
      // reads the video's old currentTime next tick and snaps the playhead back. (The
      // loop's proximity guard ignores the stale position until this seek lands.)
      const gsec = globalSecForWall(ms)
      if (gsec != null) {
        const g = groupForMediaSec(gsec)
        if (g) {
          if (g.index !== activeGroupIndexRef.current) {
            setActiveGroupIndex(g.index) // load effect seeks on ready (playingRef)
          } else {
            try {
              const d = g.localSec - player.currentTime
              if (Math.abs(d) >= 0.05) player.seekBy(d)
            } catch {}
          }
        }
      }
    }
    recenterTimeline()
  }
  // The buffer's head/floor — the leading eviction-gap edge when there's headroom, else
  // the oldest footage. clip-back's enable + the reverse floor both key off this, so a
  // second clip-back tap steps PAST the oldest clip's head into the eviction gap (and
  // the button stays live there) — mirroring the tail stepping past the last clip's tail
  // to the buffer end. Guarding against bufferStartMs here is what disabled the 2nd tap.
  const floorMs = hasLeadingGap ? leadStartMs : bufferStartMs
  const canPrev = bufferEndMs > 0 && playheadMs > floorMs + 1000
  const canNext = bufferEndMs > 0 && playheadMs < Date.now() - 1000

  // ── Frame step + hold-to-play (the transport's ‹ / › buttons) ───────────────
  const reverseRaf = useRef<number | null>(null)
  function stopReverse() {
    if (reverseRaf.current != null) {
      cancelAnimationFrame(reverseRaf.current)
      reverseRaf.current = null
    }
  }
  // Hold ‹ → reverse-scrub at 1× until released; the paused-seek effect repaints the
  // field to the nearest frame as the playhead moves back. Stops at the buffer floor.
  function startReverse() {
    if (reverseRaf.current != null) return
    if (playingRef.current) setPlaying(false)
    let last = Date.now()
    const step = () => {
      const now = Date.now()
      const next = playheadRef.current - (now - last)
      last = now
      placePlayhead(next)
      if (next <= floorMs) {
        stopReverse()
        return
      }
      reverseRaf.current = requestAnimationFrame(step)
    }
    reverseRaf.current = requestAnimationFrame(step)
  }
  // Tap ‹ / › → step exactly one frame (and pause).
  function frameStep(dir: 1 | -1) {
    stopReverse()
    if (playingRef.current) setPlaying(false)
    placePlayhead(playheadRef.current + dir * FRAME_MS)
    recenterTimeline()
  }
  function frameForwardHold(held: boolean) {
    stopReverse()
    setPlaying(held) // hold → forward playback; release → stop
  }
  function frameBackHold(held: boolean) {
    if (held) startReverse()
    else stopReverse()
  }
  const canFrameBack = playheadMs > floorMs + 1
  const canFrameForward = playheadMs < Date.now() - 1
  useEffect(() => () => stopReverse(), [])

  // `privacy` carries the clip's REVERSIBLE display choices (decision A): location
  // precision + identity (attributed/anon). Both are blur-or-sharpen, any time —
  // the backend stores full fidelity and has no ≤-ceiling. SEAM: the controls live
  // in `SaveClipSheet` (Ben's feature) + an in-place edit on a focused saved clip;
  // when that surface emits them, pass them here (and call `editClipPrivacy` for an
  // already-saved clip). Omitted fields are left to the clip's current value (a new
  // draft inherits the go-live precision server-side), so this never clobbers.
  async function saveClip(
    clipName: string,
    privacy?: { locDisplayPrecision?: 'exact' | 'city' | 'country' | 'off'; attributed?: boolean },
  ) {
    if (!bracket) return
    const { inMs, outMs } = bracket
    const durationSec = Math.max(1, Math.round((outMs - inMs) / 1000))
    // R3 promote-on-publish: a clip is a wall-clock window that can span MULTIPLE
    // buffer sessions (a camera flip / rotation starts a new session). Send every
    // kind any covered session captured — the backend resolves the sessions and
    // copies/transcodes the in-window footage. (No more user-toggled save-set.)
    const coveredSessions = sessions.filter((s) => sessionStartMs(s) < outMs && sessionEndMs(s) > inMs)
    // Only the toggled-on lanes go into the clip. (The per-lane removed ranges in
    // `removedByLane` are the next thing for Aaron's manifest to persist.)
    const kinds = Array.from(
      new Set(coveredSessions.length ? coveredSessions.flatMap((s) => s.kinds) : (sessionAtPlayhead?.kinds ?? [])),
    ).filter((k) => clipLanes.has(k))
    if (!kinds.length) {
      Alert.alert('Nothing to save', 'No captured footage in the selected range.')
      return
    }
    const sourcesLabel = KIND_ORDER.filter((k) => kinds.includes(k))
      .map((k) => titleCase(KIND_META[k]!.label))
      .join(' · ')

    const name = clipName.trim() || 'Untitled clip'
    if (draftPushTimer.current) clearTimeout(draftPushTimer.current) // we patch the final manifest below

    // C4.5: materialise through a draft (create if needed → final PATCH → saveDraft). Falls
    // back to the proven R3 one-shot save if anything in the draft path fails, so save never breaks.
    let clipId: string
    try {
      const sid = sessionIdForMs(inMs)
      let id = draftIdRef.current
      if (!id) id = (await bufferApi.createDraft({ startAtMs: Math.round(inMs), endAtMs: Math.round(outMs), name })).clipId
      await bufferApi.patchClip(id, {
        ...(sid ? { ranges: [{ bufferSessionId: sid, startAtMs: Math.round(inMs), endAtMs: Math.round(outMs) }] } : {}),
        sources: sourcesFromLanes(clipLanes),
        title: name,
        // Reversible privacy (decision A) — only sent when the sheet provides them.
        ...(privacy?.locDisplayPrecision !== undefined ? { locDisplayPrecision: privacy.locDisplayPrecision } : {}),
        ...(privacy?.attributed !== undefined ? { attributed: privacy.attributed } : {}),
      })
      if (!editingSavedId) await bufferApi.saveDraft(id) // an already-saved clip is already materialised
      clipId = id
      draftIdRef.current = null
      editStartedRef.current = false
    } catch {
      try {
        const res = await bufferApi.saveClip({ startAtMs: Math.round(inMs), endAtMs: Math.round(outMs), name, kinds })
        clipId = res.clipId
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Could not save the clip. Please try again.'
        Alert.alert('Save failed', String(msg))
        return
      }
    }
    qc.invalidateQueries({ queryKey: ['buffer', 'clips'] })

    setSavedClips((prev) => [
      {
        id: clipId,
        name: clipName.trim() || 'Untitled clip',
        capturedAt: fmtClipStamp(inMs),
        durationSec,
        variant: kinds.includes('camera') ? 'camera' : kinds.includes('audio') ? 'audio-only' : 'map-only',
        sourcesLabel,
        visibility: 'draft',
      },
      ...prev,
    ])
    setSavedRegions((prev) => [...prev, { id: clipId, startMs: inMs, endMs: outMs, label: 'SAVED' }])
    setBracket(null)
    setSaveSheetOpen(false)
    setExpandedId(clipId)
    setPage('saved')
  }

  function deleteClip(id: string) {
    setSavedClips((prev) => prev.filter((c) => c.id !== id))
    setSavedRegions((prev) => prev.filter((r) => r.id !== id))
  }

  const canSave = bracket != null && bracket.outMs - bracket.inMs >= MIN_BRACKET_MS

  // ── Clip-editing tools (the left rail) ──────────────────────────────────────
  // Select / set-in / set-out manipulate the in-out bracket (client-side, real). Save
  // routes through the existing in-session saveClip. Delete / trim are destructive buffer
  // mutations — the confirm + UX live here; the actual removal needs the backend buffer
  // endpoint (Aaron). The bracket is the selection.
  // Create a clip = bracket the single session (clip) the playhead is over — its exact
  // start/end. (Not the whole toggled-lanes extent.) No-op over a gap.
  function selectCurrentClip() {
    if (!sessionAtPlayhead) return
    editStartedRef.current = true
    setBracket({ inMs: sessionStartMs(sessionAtPlayhead), outMs: sessionEndMs(sessionAtPlayhead) })
  }
  // In point lands EXACTLY on the playhead. If it ends up after the out, push the out to
  // just after the new in (min-length clip).
  function setInPoint() {
    editStartedRef.current = true
    const inMs = playheadMs
    setBracket((b) => {
      if (!b) return { inMs, outMs: Math.min(bufferEndMs, inMs + DEFAULT_CLIP_MS) }
      const outMs = b.outMs > inMs + MIN_BRACKET_MS ? b.outMs : Math.min(bufferEndMs, inMs + MIN_BRACKET_MS)
      return { inMs, outMs }
    })
  }
  function setOutPoint() {
    editStartedRef.current = true
    const outMs = playheadMs
    setBracket((b) => {
      if (!b) return { inMs: Math.max(bufferStartMs, outMs - DEFAULT_CLIP_MS), outMs }
      // If the new out is before the in, pull the in to just before the new out.
      const inMs = b.inMs <= outMs - MIN_BRACKET_MS ? b.inMs : Math.max(bufferStartMs, outMs - MIN_BRACKET_MS)
      return { inMs, outMs }
    })
  }
  // Mark a removed range on every TOGGLED-ON lane (per-lane, so a later edit with a
  // different toggle set produces different data/no-data blocks). MOCK today; the real
  // destructive buffer mutation is Aaron's manifest. Different-set edits accumulate.
  function markRemoved(ranges: Interval[]) {
    if (!ranges.length) return
    editStartedRef.current = true
    setRemovedByLane((prev) => {
      const next = { ...prev }
      for (const key of clipLanes) next[key] = mergeIntervals([...(next[key] ?? []), ...ranges])
      return next
    })
  }
  function deleteSelected() {
    if (!bracket) return
    Alert.alert(
      'Delete footage?',
      'Delete everything between the in and out points on the toggled-on lanes, leaving a gap.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => markRemoved([{ startMs: bracket.inMs, endMs: bracket.outMs }]) },
      ],
    )
  }
  function trimSelected() {
    if (!bracket) return
    Alert.alert(
      'Trim clip?',
      'Delete everything outside the in and out points on the toggled-on lanes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trim',
          style: 'destructive',
          onPress: () => {
            const ranges: Interval[] = []
            if (bracket.inMs > bufferStartMs) ranges.push({ startMs: bufferStartMs, endMs: bracket.inMs })
            if (bracket.outMs < bufferEndMs) ranges.push({ startMs: bracket.outMs, endMs: bufferEndMs })
            markRemoved(ranges)
          },
        },
      ],
    )
  }
  const clipTools: ClipToolItem[] = [
    { key: 'select', iconName: 'crop', label: 'Select current clip', onPress: selectCurrentClip, disabled: !sessionAtPlayhead },
    { key: 'in', iconName: 'log-in', label: 'Set in point', onPress: setInPoint, disabled: !sessions.length },
    { key: 'out', iconName: 'log-out', label: 'Set out point', onPress: setOutPoint, disabled: !sessions.length },
    { key: 'delete', iconName: 'trash-2', label: 'Delete selected', onPress: deleteSelected, disabled: !bracket, tone: 'warn' },
    {
      key: 'trim',
      iconName: 'scissors',
      label: 'Trim selected',
      onPress: trimSelected,
      disabled: !bracket,
      tone: 'warn',
    },
    { key: 'save', iconName: 'save', label: 'Save clip', onPress: () => setSaveSheetOpen(true), disabled: !canSave },
    { key: 'clear', iconName: 'x', label: 'Clear selection', onPress: () => setBracket(null), disabled: !bracket },
  ]

  return (
    <View style={styles.root}>
    <ScreenScroll
      header={<ScreenHeader title={focused ? focusClip!.name : 'Clip editor'} />}
      contentContainerStyle={[
        styles.content,
        // Editor: clear the sticky bottom chrome (its collapsed `bottom` + measured height).
        page === 'editor' && { paddingBottom: theme.spacing.xxxl + CLOCK_COLLAPSED_H + chromeH },
      ]}
      scrollEnabled={!clockExpanded}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.text.muted}
          colors={[theme.colors.accent.default]}
        />
      }
    >
      {/* Top tabs shared with the Clips grid: "Clips" returns to the vertical
          grid (a sibling tab route — instant swap), "Editor" is this page. */}
      <PageTabs
        tabs={[
          { key: 'grid', label: 'Clips' },
          { key: 'editor', label: 'Editor' },
        ]}
        value="editor"
        onChange={(k) => {
          if (k === 'grid') {
            setClockExpanded(false) // leaving the editor unmounts the clock — restore scroll
            router.navigate('/(app)/clips')
          }
        }}
        style={styles.pager}
      />

      {page === 'editor' ? (
        <View style={styles.editor}>
          {/* The buffer scrub field. The clock that drives this field's playhead
              is no longer flush beneath it — it's docked at the bottom of the
              screen (above the footer), the predictable cross-screen clock
              pattern (globe / dashboard / stream). Field and docked clock still
              scrub the same playhead; touching the field collapses the clock. */}
          <View>
            <View style={styles.fieldWrap} onTouchStart={collapseClock}>
              <BufferScrubField
                variant={viewVariant}
                thumbnailUrl={scrubbing ? fieldFrame ?? fieldThumb : fieldThumb}
                frameSlot={
                  view === 'camera' ? (
                    !scrubbing && hasCameraVideo && !playerError ? (
                      <VideoView
                        player={player}
                        style={StyleSheet.absoluteFill}
                        nativeControls={false}
                        // contain (not cover) so a landscape recording shows whole —
                        // letterboxed to fit the field — instead of being cropped/zoomed.
                        contentFit="contain"
                      />
                    ) : undefined
                  ) : view === 'audio' ? (
                    <SourceWaveform peaks={MOCK_PEAKS} progress={viewProgress} />
                  ) : view === 'location' ? (
                    (() => {
                      const path = dataTrail.length ? dataTrail : MOCK_TRAIL
                      return <SourceLocationTrail path={path} position={trailPositionAt(path, viewProgress)} />
                    })()
                  ) : view === 'compass' ? (
                    <SourceTelemetryGraph
                      values={dataSamples.length ? toGraphValues(dataSamples, 'compass') : MOCK_COMPASS}
                      progress={viewProgress}
                      label="COMPASS"
                      reading={dataSamples.length ? readingAt(dataSamples, 'compass', viewProgress) : `${Math.round(viewProgress * 359)}°`}
                      iconName="compass"
                    />
                  ) : view === 'gyro' ? (
                    <SourceTelemetryGraph
                      values={dataSamples.length ? toGraphValues(dataSamples, 'gyro') : MOCK_GYRO}
                      progress={viewProgress}
                      label="GYRO"
                      reading={dataSamples.length ? readingAt(dataSamples, 'gyro', viewProgress) : '±1.2 rad/s'}
                      iconName="navigation"
                    />
                  ) : view === 'identity' ? (
                    <SourceIdentityCard
                      displayName={currentUser?.displayName ?? '—'}
                      handle={currentUser?.handle ?? 'you'}
                      avatarUrl={currentUser?.avatarUrl}
                      attributed
                      meta={identityMeta}
                    />
                  ) : view === 'chat' ? (
                    // Real recorded chat track (C6); SourceChatLog shows its own
                    // placeholder transcript until the first messages land.
                    <SourceChatLog messages={toChatLog(dataSamples)} progress={viewProgress} />
                  ) : undefined
                }
                reachLabel={focused ? focusClip!.name : `Buffer · ${buffer?.windowHours ?? 72}h`}
                card={gapCard}
                showScrubHint={false}
                onScrub={handleFieldScrub}
                onScrubStart={handleScrubStart}
                onScrubEnd={handleScrubEnd}
              />
              {/* Source view switch on the left edge of the field. The clip-editing tools
                  moved to a sticky shelf above the transport (below). */}
              {railItems.length > 1 && (
                <View style={styles.sourceRail} pointerEvents="box-none">
                  <SourceRail sources={railItems} value={view} onChange={setView} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.belowField} onTouchStart={collapseClock}>
            <BufferTimeline
              segments={segments}
              savedRegions={savedRegions}
              playheadMs={playheadMs}
              nowMs={bufferEndMs}
              streaming={streaming}
              leadingGap={leadingGap}
              bracket={bracket}
              thumbnails={thumbs}
              onScrub={(ms) => {
                markScrubbing()
                placePlayhead(ms)
              }}
              onSeek={(ms) => jumpTo(ms)}
              onScrubStart={handleScrubStart}
              onScrubEnd={handleScrubEnd}
              onBracketChange={(b) => {
                editStartedRef.current = true
                setBracket(b.outMs - b.inMs <= 0 ? null : b)
              }}
              onZoomChange={(ppm) => {
                timelinePxPerMsRef.current = ppm
              }}
              onVisibleRangeChange={setVisibleRange}
              centerSignal={centerSignal}
              lanes={timelineLanes}
              selectedKey={view}
              expanded={lanesExpanded}
              onToggleExpand={() => setLanesExpanded((v) => !v)}
              includedKeys={includedKeys}
              onToggleLane={toggleClipLane}
              removedByLane={removedByLane}
              externalScrollbar
              onScrollbarState={setScrollbarState}
              scrollbarApiRef={scrollbarApiRef}
            />
            {/* All editing controls live in the field's left ClipToolRail; naming
                happens in the SaveClipSheet when Save is tapped. */}
          </View>
        </View>
      ) : (
        <View style={styles.saved}>
          {savedClips.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="scissors" size="lg" color={theme.colors.text.subtle} />
              <Text variant="bodyEmphasized">No clips yet</Text>
              <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
                Cut a clip from the buffer — select an in/out and Save — and it lands here.
              </Text>
              <Pressable variant="default" onPress={() => setPage('editor')} style={styles.emptyCta}>
                <Icon name="plus" size="sm" color={theme.colors.accent.default} />
                <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                  New clip
                </Text>
              </Pressable>
            </View>
          ) : (
            savedClips.map((c) => (
              <SavedClipRow
                key={c.id}
                name={c.name}
                capturedAt={c.capturedAt}
                durationSec={c.durationSec}
                variant={c.variant}
                sourcesLabel={c.sourcesLabel}
                visibility={c.visibility}
                expanded={expandedId === c.id}
                onToggleExpand={() => setExpandedId((id) => (id === c.id ? null : c.id))}
                onShare={() => {}}
                onPublish={() =>
                  setSavedClips((prev) => prev.map((x) => (x.id === c.id ? { ...x, visibility: 'public' } : x)))
                }
                onDelete={() => deleteClip(c.id)}
              />
            ))
          )}
        </View>
      )}

      {/* Decision A (reversible precision/identity): when SaveClipSheet surfaces the
          precision picker + identity toggle and emits them via onSave, forward them —
          `onSave={(name, privacy) => saveClip(name, privacy)}`. saveClip already
          accepts + persists `{ locDisplayPrecision, attributed }`; the backend is
          unbounded (blur OR sharpen). Sheet UI is Ben's lane; this wiring is ready. */}
      <SaveClipSheet
        visible={saveSheetOpen}
        durationLabel={bracket ? `${fmtDur((bracket.outMs - bracket.inMs) / 1000)} clip` : undefined}
        onSave={(clipName) => saveClip(clipName)}
        onCancel={() => setSaveSheetOpen(false)}
      />
    </ScreenScroll>

      {/* Sticky bottom chrome — three stacked shelves (scroll/zoom · clip tools ·
          transport), all fixed above the scroll. The whole stack's `bottom` tracks the
          clock's animated height, so it rides UP flush above the dial when the clock
          expands (instead of being hidden). Editor page only. */}
      {page === 'editor' && (
        <Animated.View
          style={[styles.bottomChrome, { bottom: clockLift }]}
          onLayout={(e) => setChromeH(e.nativeEvent.layout.height)}
        >
          {/* Scroll / zoom bar — extracted from the timeline so it stays reachable above
              a tall expanded lane stack. */}
          <View style={[styles.shelf, styles.shelfTight]}>
            <TimelineScrollbarShelf state={scrollbarState} api={scrollbarApiRef} />
          </View>

          {/* Clip-editing tools. */}
          <View style={[styles.shelf, styles.shelfTight]}>
            <ClipToolRail tools={clipTools} variant="shelf" />
          </View>

          {/* Transport — the main bottom shelf (dashboard GoBar pattern). */}
          <View style={styles.shelf}>
            <BufferTransport
              playing={playing}
              onToStart={() => jumpTo(hasLeadingGap ? leadStartMs : bufferStartMs)}
              onPrevClip={() => jumpTo(prevClipTarget())}
              onFrameBack={() => frameStep(-1)}
              onFrameBackHold={frameBackHold}
              onTogglePlay={() => {
                // If recovery is exhausted (field shows the poster), play re-arms a
                // fresh recovery attempt instead of toggling.
                if (playerError) {
                  healAttemptsRef.current = 0
                  setPlayerError(false)
                  recoverPlayer('manual retry')
                  return
                }
                setPlaying((p) => !p)
                recenterTimeline()
              }}
              onFrameForward={() => frameStep(1)}
              onFrameForwardHold={frameForwardHold}
              onNextClip={() => jumpTo(nextClipTarget() ?? Date.now())}
              onToEnd={() => jumpTo(Date.now())}
              canPrev={canPrev}
              canNext={canNext}
              canFrameBack={canFrameBack}
              canFrameForward={canFrameForward}
            />
          </View>
        </Animated.View>
      )}

      {/* WRLD clock — docked flush above the app footer (the predictable
          cross-screen pattern). Interactive here: scrubbing the dial drives the
          buffer playhead, same as the field/timeline. Editor page only. */}
      {page === 'editor' && (
        <View style={styles.clockDock}>
          <TimeScrubber
            offsetMs={offsetForClock}
            onOffsetChange={(v) => placePlayhead(Date.now() - v)}
            onScrubStart={handleScrubStart}
            onScrubEnd={handleScrubEnd}
            onExpandedChange={setClockExpanded}
            collapseSignal={collapseSignal}
            playback={false}
          />
        </View>
      )}
    </View>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function fmtClipStamp(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${MON[d.getMonth()]} ${d.getDate()}`
}
function fmtDur(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  return `${Math.floor(total / 60)}:${pad(total % 60)}`
}
function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}
// Coarse gap / running-clock duration: "2d 4h" / "3h 12m" / "12m 05s" / "45s".
function fmtGap(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m ${pad(s)}s`
  return `${s}s`
}

// Head/tail counting clocks: always include a seconds counter (days · hours · minutes ·
// seconds), larger units shown only when non-zero. Ticks every second via the 1s tick.
function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (d > 0 || h > 0) parts.push(`${h}h`)
  if (d > 0 || h > 0 || m > 0) parts.push(`${m}m`)
  parts.push(`${pad(s)}s`)
  return parts.join(' ')
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // WRLD clock dock — flush above the app footer, spanning full width. The
  // interactive dial expands upward over the editor, so it's bottom-anchored.
  clockDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Sticky bottom chrome container — holds the stacked shelves; its `bottom` is animated
  // (inline) to track the clock height so the whole stack rides up when the clock expands.
  bottomChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  // One shelf tier (scroll/zoom · tools · transport). Stacks in the chrome column; matches
  // the dashboard/stream bottom-shelf look (paper, top border).
  shelf: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  // Tighter vertical padding for the secondary tiers (tools + scroll/zoom) so the chrome
  // stays compact.
  shelfTight: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  content: {
    // Extra bottom clearance so the Save button isn't hidden behind the docked
    // clock's collapsed band.
    paddingBottom: theme.spacing.xxxl + CLOCK_COLLAPSED_H,
  },
  pager: {
    marginTop: theme.spacing.sm,
  },
  editor: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  fieldWrap: {
    position: 'relative',
  },
  // Source switcher on the left edge of the field (clip-editing tools moved to a bottom shelf).
  sourceRail: {
    position: 'absolute',
    left: theme.spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  belowField: {
    gap: theme.spacing.md,
  },
  saved: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxxl,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 240,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
})
