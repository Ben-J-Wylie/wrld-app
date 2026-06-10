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
import { useFocusEffect } from 'expo-router'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { TimeScrubber, CLOCK_COLLAPSED_H } from '@/components/features/discovery/TimeScrubber'
import { Text } from '@/components/primitives/Text'
import { Input } from '@/components/primitives/Input'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { SaveClipButton } from '@/components/features/broadcast/SaveClipButton'
import { BufferScrubField } from '@/components/features/clip/BufferScrubField'
import { BufferTransport } from '@/components/features/clip/BufferTransport'
import {
  BufferTimeline,
  type BufferSegment,
  type BufferSavedRegion,
  type BufferBracket,
  type TimelineThumb,
  type VisibleRange,
} from '@/components/features/clip/BufferTimeline'
import { ClipSourcesDrawer, type ClipSource } from '@/components/features/clip/ClipSourcesDrawer'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { useAuth } from '@clerk/clerk-expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useBuffer } from '@/hooks/useBuffer'
import { useBroadcastStore } from '@/stores/broadcastStore'
import type { BufferSession, BufferTrackKind } from '@/api/buffer'
import { theme } from '@/tokens/theme'

type Page = 'editor' | 'saved'

type SavedClip = {
  id: string
  name: string
  capturedAt: string
  durationSec: number
  variant: 'camera' | 'audio-only' | 'map-only'
  sourcesLabel: string
  visibility: 'draft' | 'anon' | 'public'
}

// A row in the Saved-clips list: either an explicit in-session trim (`source: 'saved'`)
// or an auto-listed recording/buffer session (`source: 'session'`, which may carry a
// poster + a Recording/Unedited status tag).
type DisplayClip = SavedClip & {
  source: 'saved' | 'session'
  thumbnailUrl?: string | null
  tags?: { label: string; tone: 'warn' | 'accent' | 'muted' }[]
}

const H = 3_600_000
const DEFAULT_CLIP_MS = 120_000 // 2 min default bracket on "New clip"
const MIN_BRACKET_MS = 500
// During playback EVERY gap is rushed over exactly this long: the clock spins across the
// gap's full span in 3s, then the next clip plays. Long gap → fast spin; 3s gap → reads
// as normal counting; <3s gap → reads as slowing down.
const GAP_RUSH_MS = 3_000
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
const SOURCE_DEFAULT_ON = new Set<BufferTrackKind>(['camera', 'audio', 'location'])
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
  const sessions = buffer?.sessions ?? EMPTY_SESSIONS

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
  const segments: BufferSegment[] = sessions.map((s) => ({
    id: s.id,
    startMs: sessionStartMs(s),
    endMs: sessionEndMs(s),
    posterUrl: s.thumbnailUrl, // real broadcast frame per session (server filmstrip later)
  }))
  const bufferStartMs = sessions.length ? sessionStartMs(sessions[0]!) : Date.now()
  const bufferEndMs = Date.now()

  // Leading "eviction" edge: the buffer keeps `windowHours` of footage, so the oldest
  // frame (bufferStartMs) is deleted at bufferStartMs + window. While the oldest footage
  // is newer than the window's oldest boundary (now - window) there's headroom → a
  // leading gap whose card counts down to when the oldest footage starts being deleted.
  const windowMs = (buffer?.windowHours ?? 72) * H
  const leadStartMs = bufferEndMs - windowMs
  const hasLeadingGap = sessions.length > 0 && bufferStartMs > leadStartMs + 60_000
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
      if (followingRef.current) setPlayheadMs(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [])
  // Lower bound extends into the leading eviction gap (so you can scrub onto it).
  const clampPlayhead = (ms: number) => clamp(ms, hasLeadingGap ? leadStartMs : bufferStartMs, Date.now())
  // Place the playhead at an absolute instant (held); start following only if it
  // lands at the live edge.
  function placePlayhead(ms: number) {
    const m = clampPlayhead(ms)
    playheadRef.current = m
    setPlayheadMs(m)
    setFollowing(m >= Date.now() - 1500)
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
  const [name, setName] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Saved-clip persistence is R3 — these stay in-session (local) until the
  // promote-on-publish backend route lands.
  const [savedRegions, setSavedRegions] = useState<BufferSavedRegion[]>([])
  const [savedClips, setSavedClips] = useState<SavedClip[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Local in-session overrides for the auto-listed recording entries (delete = hide;
  // publish = mark public). Real persistence is R3 — Aaron.
  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(() => new Set())
  const [publishedSessionIds, setPublishedSessionIds] = useState<Set<string>>(() => new Set())

  // EVERY recording (buffer session) is a Saved-clips entry — listed whether or not it's
  // been trimmed/edited, mirroring the Library. A live session is tagged "Recording", a
  // finished-but-untrimmed one "Unedited". Newest first. (Reconciling these against the
  // real Library + persisting trims is R3 — Aaron; today this is the in-session view.)
  const sessionClips = useMemo<DisplayClip[]>(
    () =>
      [...sessions]
        .reverse()
        .filter((s) => !hiddenSessionIds.has(s.id))
        .map((s) => {
          const live = s.endedAt === null
          const hasCam = s.kinds.includes('camera')
          const hasAud = s.kinds.includes('audio')
          const sourcesLabel = KIND_ORDER.filter((k) => s.kinds.includes(k))
            .map((k) => titleCase(KIND_META[k]!.label))
            .join(' · ')
          const tags: DisplayClip['tags'] = [
            live ? { label: 'Recording', tone: 'accent' } : { label: 'Unedited', tone: 'muted' },
            ...(sourcesLabel ? [{ label: sourcesLabel, tone: 'muted' as const }] : []),
          ]
          return {
            id: s.id,
            name: `Recording · ${fmtClipStamp(sessionStartMs(s))}`,
            capturedAt: fmtClipStamp(sessionStartMs(s)),
            durationSec: Math.max(1, Math.round(s.durationSec)),
            variant: hasCam ? 'camera' : hasAud ? 'audio-only' : 'map-only',
            sourcesLabel,
            visibility: publishedSessionIds.has(s.id) ? 'public' : 'draft',
            thumbnailUrl: s.thumbnailUrl,
            tags,
            source: 'session',
          }
        }),
    [sessions, hiddenSessionIds, publishedSessionIds],
  )

  // The Saved-clips list = explicit in-session trims (most-recent user intent) +
  // every recording. Trims carry their own visibility/no tags; recordings carry the
  // Recording/Unedited status tag.
  const displayClips: DisplayClip[] = useMemo(
    () => [...savedClips.map((c) => ({ ...c, source: 'saved' as const })), ...sessionClips],
    [savedClips, sessionClips],
  )

  // Recorded-source list seeded from the kinds the buffer actually captured.
  // Seeded once when sessions first arrive; user toggles are preserved after.
  const [sources, setSources] = useState<ClipSource[]>([])
  useEffect(() => {
    if (!sessions.length) return
    setSources((prev) => {
      if (prev.length) return prev
      const captured = new Set<string>()
      sessions.forEach((s) => s.kinds.forEach((k) => captured.add(k)))
      return KIND_ORDER.filter((k) => captured.has(k)).map((k) => ({
        ...KIND_META[k]!,
        active: SOURCE_DEFAULT_ON.has(k),
      }))
    })
  }, [sessions])
  const activeCount = sources.filter((s) => s.active).length

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
  const streaming = isLive && sessions.length > 0 && sessions[sessions.length - 1]!.endedAt === null

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
  // Active gap "rush": spin the clock from `from`→`to` over `hold` (≤GAP_RUSH_MS) while
  // the video holds; `live` = trailing gap (→ go live at the end vs resume next clip).
  const gapRushRef = useRef<{ startWall: number; from: number; to: number; hold: number; live: boolean } | null>(
    null,
  )

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
      if (!playClockRef.current) playClockRef.current = { wall: now, ph: playheadRef.current }
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
        if (Math.abs(player.currentTime - g.localSec) > 0.75) player.seekBy(g.localSec - player.currentTime)
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
  // Clip heads = each session's start. Prev = current clip's head if we're >1s into it,
  // else the previous clip's head; Next = the next clip's head (else the live end).
  const sessionStarts = sessions.map(sessionStartMs).sort((a, b) => a - b)
  function prevClipTarget(): number {
    let best: number | null = null
    for (const st of sessionStarts) if (st < playheadRef.current - 1000) best = st
    return best ?? bufferStartMs
  }
  function nextClipTarget(): number | null {
    for (const st of sessionStarts) if (st > playheadRef.current + 1000) return st
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
    }
    recenterTimeline()
  }
  const canPrev = bufferEndMs > 0 && playheadMs > bufferStartMs + 1000
  const canNext = bufferEndMs > 0 && playheadMs < Date.now() - 1000

  function newClip() {
    const half = DEFAULT_CLIP_MS / 2
    const inMs = clamp(playheadMs - half, bufferStartMs, bufferEndMs - DEFAULT_CLIP_MS)
    setBracket({ inMs, outMs: inMs + DEFAULT_CLIP_MS })
  }

  function saveClip() {
    if (!bracket) return
    const id = `c${savedClips.length + 1}-${bracket.inMs}`
    const durationSec = Math.max(1, Math.round((bracket.outMs - bracket.inMs) / 1000))
    const activeSources = sources.filter((s) => s.active)
    const sourcesLabel = activeSources.map((s) => titleCase(s.label)).join(' · ')
    const hasCam = activeSources.some((s) => s.key === 'cam')
    const hasAud = activeSources.some((s) => s.key === 'aud')
    setSavedClips((prev) => [
      {
        id,
        name: name.trim() || 'Untitled clip',
        capturedAt: fmtClipStamp(bracket.inMs),
        durationSec,
        variant: hasCam ? 'camera' : hasAud ? 'audio-only' : 'map-only',
        sourcesLabel,
        visibility: 'draft',
      },
      ...prev,
    ])
    setSavedRegions((prev) => [...prev, { id, startMs: bracket.inMs, endMs: bracket.outMs, label: 'SAVED' }])
    setBracket(null)
    setName('')
    setExpandedId(id)
    setPage('saved')
  }

  function deleteClip(id: string) {
    setSavedClips((prev) => prev.filter((c) => c.id !== id))
    setSavedRegions((prev) => prev.filter((r) => r.id !== id))
  }

  const canSave = bracket != null && bracket.outMs - bracket.inMs >= MIN_BRACKET_MS

  return (
    <View style={styles.root}>
    <ScreenScroll
      header={<ScreenHeader title="Clip editor" />}
      contentContainerStyle={styles.content}
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
      <PageTabs
        tabs={[
          { key: 'editor', label: 'Editor' },
          { key: 'saved', label: `Saved clips${displayClips.length ? ` · ${displayClips.length}` : ''}` },
        ]}
        value={page}
        onChange={(p) => {
          setClockExpanded(false) // leaving the editor unmounts the clock — restore scroll
          setPage(p)
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
                variant={fieldVariant}
                thumbnailUrl={scrubbing ? fieldFrame ?? fieldThumb : fieldThumb}
                frameSlot={
                  !scrubbing && hasCameraVideo && !playerError ? (
                    <VideoView
                      player={player}
                      style={StyleSheet.absoluteFill}
                      nativeControls={false}
                      contentFit="cover"
                    />
                  ) : undefined
                }
                reachLabel={`Buffer · ${buffer?.windowHours ?? 72}h`}
                card={gapCard}
                showScrubHint={false}
                onScrub={handleFieldScrub}
                onScrubStart={handleScrubStart}
                onScrubEnd={handleScrubEnd}
              />
            </View>
          </View>

          <View onTouchStart={collapseClock}>
            <BufferTransport
              playing={playing}
              onToStart={() => jumpTo(hasLeadingGap ? leadStartMs : bufferStartMs)}
              onPrev={() => jumpTo(prevClipTarget())}
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
              onNext={() => jumpTo(nextClipTarget() ?? Date.now())}
              onToEnd={() => jumpTo(Date.now())}
              canPrev={canPrev}
              canNext={canNext}
            />
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
              onBracketChange={setBracket}
              onZoomChange={(ppm) => {
                timelinePxPerMsRef.current = ppm
              }}
              onVisibleRangeChange={setVisibleRange}
              centerSignal={centerSignal}
            />

            <View style={styles.btnRow}>
              {bracket ? (
                <TbBtn icon="rotate-ccw" label="Reset" onPress={() => setBracket(null)} muted />
              ) : (
                <TbBtn icon="plus" label="New clip" onPress={newClip} accent />
              )}
              <TbBtn
                icon="grid"
                label="Sources"
                trailing={`${activeCount}/${sources.length}`}
                onPress={() => setDrawerOpen(true)}
                muted
              />
            </View>

            <Input value={name} onChangeText={setName} placeholder="Name this clip" />

            <SaveClipButton
              label={canSave ? `Save clip · ${fmtDur((bracket!.outMs - bracket!.inMs) / 1000)}` : 'Save clip'}
              hint={canSave ? 'Saves as a private draft' : 'Drop a clip to enable save'}
              disabled={!canSave}
              onPress={saveClip}
            />
          </View>
        </View>
      ) : (
        <View style={styles.saved}>
          {displayClips.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="scissors" size="lg" color={theme.colors.text.subtle} />
              <Text variant="bodyEmphasized">No clips yet</Text>
              <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
                Your recordings land here automatically; clips you cut from the buffer join them.
              </Text>
              <Pressable variant="default" onPress={() => setPage('editor')} style={styles.emptyCta}>
                <Icon name="plus" size="sm" color={theme.colors.accent.default} />
                <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                  New clip
                </Text>
              </Pressable>
            </View>
          ) : (
            displayClips.map((c) => (
              <SavedClipRow
                key={c.id}
                name={c.name}
                capturedAt={c.capturedAt}
                durationSec={c.durationSec}
                thumbnailUrl={c.thumbnailUrl}
                variant={c.variant}
                sourcesLabel={c.sourcesLabel}
                visibility={c.visibility}
                tags={c.tags}
                expanded={expandedId === c.id}
                onToggleExpand={() => setExpandedId((id) => (id === c.id ? null : c.id))}
                onShare={() => {}}
                onPublish={() =>
                  c.source === 'saved'
                    ? setSavedClips((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, visibility: 'public' } : x)),
                      )
                    : setPublishedSessionIds((s) => new Set(s).add(c.id))
                }
                onDelete={() =>
                  c.source === 'saved'
                    ? deleteClip(c.id)
                    : setHiddenSessionIds((s) => new Set(s).add(c.id))
                }
              />
            ))
          )}
        </View>
      )}

      <ClipSourcesDrawer
        visible={drawerOpen}
        sources={sources}
        onToggleSource={(k) =>
          setSources((s) => s.map((x) => (x.key === k ? { ...x, active: !x.active } : x)))
        }
        onDismiss={() => setDrawerOpen(false)}
      />
    </ScreenScroll>

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

function TbBtn({
  icon,
  label,
  trailing,
  onPress,
  accent,
  muted,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  trailing?: string
  onPress: () => void
  accent?: boolean
  muted?: boolean
}) {
  const tint = accent ? theme.colors.accent.default : theme.colors.text.primary
  return (
    <Pressable
      variant="default"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tbBtn, accent && styles.tbBtnAccent, muted && styles.tbBtnMuted]}
    >
      <Icon name={icon} size="sm" color={accent ? theme.colors.accent.default : theme.colors.text.muted} />
      <Text variant="bodyEmphasized" color={tint}>
        {label}
      </Text>
      {trailing != null && (
        <Text variant="monoLabel" color={theme.colors.text.muted}>
          {trailing}
        </Text>
      )}
    </Pressable>
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
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${pad(s)}`
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
  belowField: {
    gap: theme.spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 42,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.elevated,
  },
  tbBtnAccent: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  tbBtnMuted: {},
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
