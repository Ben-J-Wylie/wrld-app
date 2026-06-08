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

import { useCallback, useEffect, useRef, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { TimeScrubber } from '@/components/features/discovery/TimeScrubber'
import { Text } from '@/components/primitives/Text'
import { Input } from '@/components/primitives/Input'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { SaveClipButton } from '@/components/features/broadcast/SaveClipButton'
import { BufferScrubField } from '@/components/features/clip/BufferScrubField'
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

const H = 3_600_000
const DEFAULT_CLIP_MS = 120_000 // 2 min default bracket on "New clip"
const MIN_BRACKET_MS = 500
// Client-side timeline thumbnails via expo-video generateThumbnailsAsync are OFF —
// confirmed to HANG (6s timeout) twice now: on the original -c:v copy VOD AND, retested
// 2026-06-07, on Aaron's codec-uniform groups (the source loads & PLAYS fine, but
// exact-frame extraction still hangs; there's no tolerant thumbnail API). Path kept
// behind the flag; the durable fix is SERVER-generated thumbnails — wrld-backend
// CLAUDE.md stacked-work item 6. Until then the timeline shows its sprocket filmstrip.
const CLIENT_THUMB_GEN = false

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

const sessionStartMs = (s: BufferSession) => Date.parse(s.startedAt)
const sessionEndMs = (s: BufferSession) => (s.endedAt ? Date.parse(s.endedAt) : Date.now())

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
  const { data: buffer, refetch: refetchBuffer } = useBuffer(!!isSignedIn)
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

  // Streaming iff the latest buffer session is still open (endedAt === null).
  const streaming = sessions.length > 0 && sessions[sessions.length - 1]!.endedAt === null

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
        acc += Math.max(0, s.durationSec)
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
        return c.mediaStart + Math.min(Math.max(0, c.s.durationSec), Math.max(0, (playheadMs - st) / 1000))
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
  // ph + (now - wall), advancing in real-time (across gaps) until the live edge.
  const playClockRef = useRef<{ wall: number; ph: number } | null>(null)

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
        return c.mediaStart + Math.min(Math.max(0, c.s.durationSec), Math.max(0, (ms - st) / 1000))
      }
    }
    return null
  }

  // A scrub interaction pauses playback (so the seeked frame holds).
  function markScrubbing() {
    if (playingRef.current) setPlaying(false)
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

  // Playback is WALL-CLOCK driven (real-time), so the playhead advances naturally
  // across gaps and never stops at the end of a clip — only at the live edge. The
  // VIDEO follows the playhead: over footage it plays (seeking to the right codec-
  // uniform group + offset, tolerant drift-correct); over a gap it holds (the field
  // shows the gap card). (Media time collapses gaps, so a media-driven follow couldn't
  // traverse them in real-time — hence wall-clock as the driver.)
  useEffect(() => {
    if (!playing) {
      playClockRef.current = null
      return
    }
    const id = setInterval(() => {
      if (!playClockRef.current) playClockRef.current = { wall: Date.now(), ph: playheadRef.current }
      const c = playClockRef.current
      const ph = c.ph + (Date.now() - c.wall)
      // Reached the live edge → stop playback and go live (follow the head).
      if (ph >= Date.now() - 300) {
        setPlaying(false)
        setFollowing(true)
        return
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
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, player])

  // Cleanup the seek + settle + watchdog + heal timers.
  useEffect(() => () => {
    if (seekTimer.current) clearTimeout(seekTimer.current)
    if (settleTimer.current) clearTimeout(settleTimer.current)
    if (loadWatchdog.current) clearTimeout(loadWatchdog.current)
    if (healTimer.current) clearTimeout(healTimer.current)
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
        global = c.mediaStart + Math.min(Math.max(0, c.s.durationSec), Math.max(0, (ms - st) / 1000))
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
    setThumbs([])
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

  function handleFieldScrub(deltaPx: number) {
    // Drag right (dx>0) → earlier → playhead moves back. Plain, smooth scrub at the
    // zoom-relative rate EVERYWHERE — including across gaps (no snapping, no special
    // gap handling). Half the timeline's 1:1 finger rate, so it feels consistent with
    // the zoom. The field still shows the gap-duration card while over a gap.
    markScrubbing()
    const ppm = timelinePxPerMsRef.current
    const msPerPx = ppm > 0 ? 0.5 / ppm : 30_000
    placePlayhead(playheadRef.current - deltaPx * msPerPx)
  }

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
    <ScreenScroll
      header={<ScreenHeader title="Clip editor" onBack={() => router.back()} />}
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
          { key: 'saved', label: `Saved clips${savedClips.length ? ` · ${savedClips.length}` : ''}` },
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
          {/* Field (image swipe-to-scrub); the time-machine clock sits directly BELOW
              it (expand to spin-scrub the buffer). Both place the playhead. While the
              clock is expanded the screen scroll is locked; touching the field or
              anything below collapses it and restores scroll — the clock itself is not
              wrapped in a collapse handler, so touching it doesn't collapse it. The
              field, clock, and timeline share the editor's lg padding (inline with the
              "name this clip" input), not full-bleed. */}
          <View style={styles.fieldWrap} onTouchStart={collapseClock}>
            <BufferScrubField
              variant={fieldVariant}
              thumbnailUrl={fieldThumb}
              frameSlot={
                hasCameraVideo && !playerError ? (
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
              playing={playing}
              onTogglePlay={() => {
                // After recovery is exhausted the field shows the poster — tapping
                // play rearms recovery (fresh token attempt) instead of toggling.
                if (playerError) {
                  healAttemptsRef.current = 0
                  setPlayerError(false)
                  recoverPlayer('manual retry')
                  return
                }
                setPlaying((p) => !p)
              }}
              showScrubHint={false}
              onScrub={handleFieldScrub}
            />
          </View>

          <TimeScrubber
            offsetMs={offsetForClock}
            onOffsetChange={(v) => {
              markScrubbing()
              placePlayhead(Date.now() - v)
            }}
            onExpandedChange={setClockExpanded}
            collapseSignal={collapseSignal}
            playback={false}
          />

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
              onBracketChange={setBracket}
              onZoomChange={(ppm) => {
                timelinePxPerMsRef.current = ppm
              }}
              onVisibleRangeChange={setVisibleRange}
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
          {savedClips.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="scissors" size="lg" color={theme.colors.text.subtle} />
              <Text variant="bodyEmphasized">No clips yet</Text>
              <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
                Clips you cut from your buffer land here as private drafts.
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
                  setSavedClips((prev) =>
                    prev.map((x) => (x.id === c.id ? { ...x, visibility: 'public' } : x)),
                  )
                }
                onDelete={() => deleteClip(c.id)}
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
  content: {
    paddingBottom: theme.spacing.xxxl,
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
