// src/components/features/clip/BufferTimeline.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The collapsed-gap timeline of the
// rolling buffer. Recorded segments render as a repeating filmstrip; gaps collapse to
// thin 10px markers; saved spans are read-only bands; an optional ClipBracket defines
// the pending clip's in/out.
//
// Gesture model (2026-06-06 — react-native-gesture-handler + reanimated):
//   • TAP — the playhead snaps to where you tap.
//   • PAN (horizontal-only: `activeOffsetX` + `failOffsetY`) — scrubs the PLAYHEAD to
//     the finger; vertical drags fall through to the page scroll. (Scrolling the
//     timeline itself is the scrollbar's job, not pan.)
//   • PINCH — continuous horizontal zoom on the UI thread (reanimated shared
//     values), committed to `pxPerMs` + offset on release.
//   • ZOOM TOGGLE (All · Days · Hours · Min · Sec) below the scrollbar — a
//     non-pinch way to snap the zoom to a span; centres on the playhead.
//   • The bracket handles are their own RNGH Pan gestures (block the timeline pan),
//     so dragging an edge resizes the clip instead of scrubbing.
//
// View state (zoom `pxPerMs` + `scrollOffset`) is local; data (playhead, bracket,
// segments, savedRegions, nowMs/streaming) is from props.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { theme } from '@/tokens/theme'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { GapMarker, GAP_MARKER_WIDTH } from './GapMarker'
import { SavedClipRegion } from './SavedClipRegion'
import { ClipBracket } from './ClipBracket'
import { TimelineScrollbar } from './TimelineScrollbar'

export type BufferSegment = {
  id: string
  startMs: number
  endMs: number
  peaks?: number[]
  // Optional poster frame for this recording session — filled across the segment
  // (cover) as a real broadcast frame. Falls back to the sprocket filmstrip when absent
  // (audio-only sessions, missing poster). Superseded per-interval by `thumbnails` when
  // server-generated frames land.
  posterUrl?: string | null
}
export type BufferSavedRegion = { id: string; startMs: number; endMs: number; label?: string }
export type BufferBracket = { inMs: number; outMs: number }
// Real frame thumbnails (from expo-video's generateThumbnailsAsync, rendered via
// expo-image) placed at their wall-clock instant. Optional enhancement layer over the
// sprocket filmstrip — where a thumb exists it covers the sprockets; gaps/missing →
// sprockets show through. `source` is whatever expo-image's <Image> accepts (incl. the
// VideoThumbnail SharedRef the screen passes).
export type TimelineThumb = { tMs: number; source: ComponentProps<typeof Image>['source'] }
export type VisibleRange = { startMs: number; endMs: number; cellMs: number }

type Props = {
  segments: BufferSegment[]
  savedRegions?: BufferSavedRegion[]
  playheadMs: number
  nowMs?: number
  streaming?: boolean
  // The oldest-edge "eviction" gap: a collapsed marker before the first segment whose
  // wall-clock span [startMs, endMs=earliestFootage] represents headroom until the
  // oldest footage starts getting deleted. Mirrors the trailing (since-last-broadcast)
  // gap. The parent shows a countdown card while the playhead is over it.
  leadingGap?: { startMs: number; endMs: number } | null
  bracket?: BufferBracket | null
  thumbnails?: TimelineThumb[]
  onScrub: (ms: number) => void
  // Discrete seek on TAP (vs the continuous drag `onScrub`) — lets the parent keep
  // playing from the tapped point instead of pausing. Falls back to `onScrub`.
  onSeek?: (ms: number) => void
  // Drag gesture lifecycle (activation / release) so the parent can pause playback
  // while scrubbing and resume on lift if it was playing.
  onScrubStart?: () => void
  onScrubEnd?: () => void
  onBracketChange?: (next: BufferBracket) => void
  // The live zoom (px per ms), reported on change — the field uses it to scale its
  // own scrub rate relative to the timeline.
  onZoomChange?: (pxPerMs: number) => void
  // The visible time window (+ per-cell duration), reported on settle — the screen
  // generates thumbnails for exactly this range/density.
  onVisibleRangeChange?: (range: VisibleRange) => void
  style?: StyleProp<ViewStyle>
}

const TRACK_H = 52
const MIN_BRACKET_MS = 500
const GAP_THRESHOLD_MS = 500
const ZOOM_MAX_FACTOR = 12
const FILM_CELL_W = 24
// The head/tail buffer-edge indicators are wider than inter-session gaps and carry
// state: dark (idle), or accent with a footage-facing zigzag (head = evicting oldest,
// tail = live/growing) — "the buffer eating the footage".
const EDGE_GAP_WIDTH = 15
const ZIGZAG_TEETH = 4 // fixed count, evenly spaced over the track height
const ZIGZAG_DEPTH = 5 // how far the teeth bite into the footage (px)

// Zoom-level toggle (an alternative to pinch). Each non-"All" level targets a
// span that fills the viewport; "All" fits the whole buffer. pxPerMs = width/span,
// clamped to the live zoom range. maxPx is raised so the finest (Sec) level — and
// pinch — can reach it even on a wide (multi-day) buffer.
type ZoomLevel = 'all' | 'days' | 'hours' | 'min' | 'sec'
const ZOOM_LEVELS: ZoomLevel[] = ['all', 'days', 'hours', 'min', 'sec']
const ZOOM_OPTS: { value: ZoomLevel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'days', label: 'Days' },
  { value: 'hours', label: 'Hours' },
  { value: 'min', label: 'Min' },
  { value: 'sec', label: 'Sec' },
]
const SEC_SPAN_MS = 20_000
const LEVEL_SPAN_MS: Record<Exclude<ZoomLevel, 'all'>, number> = {
  days: 2 * 86_400_000,
  hours: 3 * 3_600_000,
  min: 10 * 60_000,
  sec: SEC_SPAN_MS,
}

type SegBlock = { kind: 'seg'; seg: BufferSegment; leftPx: number; widthPx: number }
type GapBlock = { kind: 'gap'; leftPx: number; skippedMs: number }
type Layout = { blocks: (SegBlock | GapBlock)[]; segBlocks: SegBlock[]; contentWidth: number }

export function BufferTimeline({
  segments,
  savedRegions = [],
  playheadMs,
  nowMs,
  streaming,
  leadingGap,
  bracket,
  thumbnails,
  onScrub,
  onSeek,
  onScrubStart,
  onScrubEnd,
  onBracketChange,
  onZoomChange,
  onVisibleRangeChange,
  style,
}: Props) {
  const [width, setWidth] = useState(0)
  const [pxPerMs, setPxPerMs] = useState(0) // 0 → use the fit scale (whole buffer)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [blocked, setBlocked] = useState(false)
  // Poster URLs that failed to load (e.g. backend 404) → fall back to sprockets for
  // those segments instead of a blank fill. Auto-recovers once the server serves them.
  const [failedPosters, setFailedPosters] = useState<Set<string>>(() => new Set())

  const bufferStartMs = segments.length > 0 ? segments[0]!.startMs : 0
  const bufferEndMs = segments.length > 0 ? segments[segments.length - 1]!.endMs : 0
  const lastEnd = bufferEndMs

  const { totalSegMs, gapsPx } = useMemo(() => measure(segments), [segments])
  const hasFootage = segments.length > 0
  // The head + tail edge indicators are ALWAYS present when there's footage (20px each);
  // their state varies. Head: dark + countdown while there's headroom (`hasLeadingGap`),
  // else accent + right zigzag (evicting the oldest). Tail: accent + left zigzag while
  // live (growing), else dark + since-last-broadcast.
  const hasTrailingGap = !streaming && nowMs != null && hasFootage && nowMs > lastEnd + GAP_THRESHOLD_MS
  const hasLeadingGap = !!leadingGap && hasFootage && leadingGap.endMs - leadingGap.startMs > GAP_THRESHOLD_MS
  const headEvicting = hasFootage && !hasLeadingGap
  const tailLive = hasFootage && !!streaming
  const leadingPx = hasFootage ? EDGE_GAP_WIDTH : 0
  const trailingPx = hasFootage ? EDGE_GAP_WIDTH : 0
  // Fit subtracts ALL fixed-width gap markers (inter-session + leading + trailing) so
  // "All" shows the whole buffer — footage AND both edge gaps — inside the viewport
  // (the trailing gap used to spill ~10px past the edge, so "All" wasn't all).
  const fit =
    totalSegMs > 0 && width > 0 ? Math.max(0, (width - gapsPx - leadingPx - trailingPx) / totalSegMs) : 0
  const minPx = fit
  const secPx = width > 0 ? width / SEC_SPAN_MS : 0
  const maxPx = fit > 0 ? Math.max(fit * ZOOM_MAX_FACTOR, secPx) : 0
  const px = pxPerMs > 0 ? pxPerMs : fit

  // Layout starts the cursor at leadingPx so every block is offset past the leading gap.
  const { blocks, segBlocks, contentWidth } = useMemo(
    () => layout(segments, px, leadingPx),
    [segments, px, leadingPx],
  )
  const effContentWidth = contentWidth + trailingPx
  const maxScroll = Math.max(0, effContentWidth - width)
  const offset = clamp(scrollOffset, 0, maxScroll)
  let playheadX = timeToX(playheadMs, segBlocks, px)
  if (hasLeadingGap && leadingGap && playheadMs < bufferStartMs) {
    const f = clamp((playheadMs - leadingGap.startMs) / Math.max(1, bufferStartMs - leadingGap.startMs), 0, 1)
    playheadX = leadingPx * f
  } else if (hasTrailingGap && playheadMs > lastEnd) {
    const f = clamp((playheadMs - lastEnd) / Math.max(1, (nowMs as number) - lastEnd), 0, 1)
    playheadX = contentWidth + trailingPx * f
  }

  // ── reanimated transform (UI thread) ──────────────────────────────────────
  const sx = useSharedValue(1)
  const tx = useSharedValue(-offset)
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { scaleX: sx.value }],
  }))
  useEffect(() => {
    tx.value = -offset
  }, [offset, tx])

  // Report the live zoom up so the field can scale its scrub rate to the timeline.
  const onZoomChangeRef = useRef(onZoomChange)
  onZoomChangeRef.current = onZoomChange
  useEffect(() => {
    if (px > 0) onZoomChangeRef.current?.(px)
  }, [px])

  // Report the visible window (debounced on settle) so the screen generates thumbnails
  // for exactly what's on screen at the current zoom/density.
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange)
  onVisibleRangeChangeRef.current = onVisibleRangeChange
  const visRangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const cb = onVisibleRangeChangeRef.current
    if (!cb || px <= 0 || width <= 0 || segBlocks.length === 0) return
    if (visRangeTimer.current) clearTimeout(visRangeTimer.current)
    visRangeTimer.current = setTimeout(() => {
      cb({
        startMs: xToTime(offset, segBlocks, px),
        endMs: xToTime(offset + width, segBlocks, px),
        cellMs: FILM_CELL_W / px,
      })
    }, 200)
    return () => {
      if (visRangeTimer.current) clearTimeout(visRangeTimer.current)
    }
  }, [offset, width, px, segBlocks])

  // Shared mirrors the pinch worklet reads (set from JS each render).
  const sPx = useSharedValue(px)
  const sOffset = useSharedValue(offset)
  const sCW = useSharedValue(effContentWidth)
  const sWidth = useSharedValue(width)
  const sMinPx = useSharedValue(minPx)
  const sMaxPx = useSharedValue(maxPx)
  useEffect(() => {
    sPx.value = px
    sOffset.value = offset
    sCW.value = effContentWidth
    sWidth.value = width
    sMinPx.value = minPx
    sMaxPx.value = maxPx
  }, [px, offset, effContentWidth, width, minPx, maxPx, sPx, sOffset, sCW, sWidth, sMinPx, sMaxPx])

  // Pinch gesture state (shared, set in worklets, read by the JS commit).
  const pStartPx = useSharedValue(0)
  const pAnchorContentX = useSharedValue(0)
  const pCW = useSharedValue(0)
  const pLastScale = useSharedValue(1)
  const pLastFocal = useSharedValue(0)

  // ── refs for the JS gesture handlers ──────────────────────────────────────
  const widthRef = useRef(width)
  const pxRef = useRef(px)
  const offsetRef = useRef(offset)
  const segmentsRef = useRef(segments)
  const segBlocksRef = useRef(segBlocks)
  const minPxRef = useRef(minPx)
  const maxPxRef = useRef(maxPx)
  const onScrubRef = useRef(onScrub)
  const onSeekRef = useRef(onSeek)
  const onScrubStartRef = useRef(onScrubStart)
  const onScrubEndRef = useRef(onScrubEnd)
  onScrubStartRef.current = onScrubStart
  onScrubEndRef.current = onScrubEnd
  const onBracketChangeRef = useRef(onBracketChange)
  const bracketRef = useRef(bracket)
  const savedRegionsRef = useRef(savedRegions)
  const bufferStartRef = useRef(bufferStartMs)
  const bufferEndRef = useRef(bufferEndMs)
  const leadingPxRef = useRef(leadingPx)
  const leadingGapRef = useRef(leadingGap)
  leadingPxRef.current = leadingPx
  leadingGapRef.current = leadingGap
  // Trailing-gap scrub mapping (so the tail edge scrubs smoothly to [lastEnd, now]
  // instead of snapping to the last clip's end).
  const tailRef = useRef({ hasGap: hasTrailingGap, lastEnd, nowMs: nowMs ?? bufferEndMs, contentWidth, trailingPx })
  tailRef.current = { hasGap: hasTrailingGap, lastEnd, nowMs: nowMs ?? bufferEndMs, contentWidth, trailingPx }
  widthRef.current = width
  pxRef.current = px
  offsetRef.current = offset
  segmentsRef.current = segments
  segBlocksRef.current = segBlocks
  minPxRef.current = minPx
  maxPxRef.current = maxPx
  onScrubRef.current = onScrub
  onSeekRef.current = onSeek
  onBracketChangeRef.current = onBracketChange
  bracketRef.current = bracket
  savedRegionsRef.current = savedRegions
  bufferStartRef.current = bufferStartMs
  bufferEndRef.current = bufferEndMs

  const gesturingRef = useRef(false)
  function setGesturing(v: boolean) {
    gesturingRef.current = v
  }

  // Touch x → playhead time. Content x inside the leading gap maps to its wall-clock
  // span; inside the trailing gap to [lastEnd, now]; otherwise to footage/inter-gap time.
  function timeAtX(x: number): number {
    const contentX = x + offsetRef.current
    const lg = leadingGapRef.current
    const lpx = leadingPxRef.current
    if (lg && lpx > 0 && contentX < lpx) {
      const f = clamp(contentX / lpx, 0, 1)
      return lg.startMs + f * (lg.endMs - lg.startMs)
    }
    const t = tailRef.current
    if (t.hasGap && contentX > t.contentWidth) {
      const f = clamp((contentX - t.contentWidth) / Math.max(1, t.trailingPx), 0, 1)
      return t.lastEnd + f * (t.nowMs - t.lastEnd)
    }
    return xToTime(contentX, segBlocksRef.current, pxRef.current)
  }
  // Drag (pan) → continuous scrub (parent pauses to hunt the frame).
  function scrubAtX(x: number) {
    onScrubRef.current(timeAtX(x))
  }
  // Tap → discrete seek (parent keeps playing from there if playing, else holds the
  // frame). Falls back to onScrub when no onSeek is wired.
  function seekAtX(x: number) {
    ;(onSeekRef.current ?? onScrubRef.current)(timeAtX(x))
  }
  function emitScrubStart() {
    onScrubStartRef.current?.()
  }
  function emitScrubEnd() {
    onScrubEndRef.current?.()
  }
  // Pinch end → commit the live scale into pxPerMs + offset (one re-layout).
  function commitPinch(s: number, focal: number) {
    const startPx = pStartPx.value || pxRef.current
    const newPx = clamp(startPx * s, minPxRef.current, maxPxRef.current)
    const nl = layout(segmentsRef.current, newPx, leadingPxRef.current)
    const anchorMs = xToTime(pAnchorContentX.value, segBlocksRef.current, startPx)
    const no = clamp(timeToX(anchorMs, nl.segBlocks, newPx) - focal, 0, Math.max(0, nl.contentWidth - widthRef.current))
    sx.value = 1
    tx.value = -no
    setPxPerMs(newPx)
    setScrollOffset(no)
    gesturingRef.current = false
  }

  // ── zoom-level toggle (alternative to pinch) ────────────────────────────────
  function levelToPx(level: ZoomLevel): number {
    if (level === 'all' || width <= 0 || fit <= 0) return fit
    return clamp(width / LEVEL_SPAN_MS[level], minPx, maxPx)
  }
  // The segment highlighted = the level whose scale is nearest the current zoom.
  const currentLevel: ZoomLevel = useMemo(() => {
    if (px <= 0) return 'all'
    let best: ZoomLevel = 'all'
    let bestD = Infinity
    for (const lv of ZOOM_LEVELS) {
      const lpx = levelToPx(lv)
      if (lpx <= 0) continue
      const d = Math.abs(Math.log(px) - Math.log(lpx))
      if (d < bestD) {
        bestD = d
        best = lv
      }
    }
    return best
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, fit, minPx, maxPx, width])
  // Tap a level → snap the zoom, keeping the playhead centred in the viewport.
  function applyZoomLevel(level: ZoomLevel) {
    const newPx = levelToPx(level)
    if (newPx <= 0) return
    const nl = layout(segmentsRef.current, newPx, leadingPx)
    const newCW = nl.contentWidth + trailingPx
    const phX = timeToX(playheadMs, nl.segBlocks, newPx)
    const no = clamp(phX - width / 2, 0, Math.max(0, newCW - width))
    sx.value = 1
    tx.value = -no
    setPxPerMs(newPx)
    setScrollOffset(no)
  }

  // ── gestures ──────────────────────────────────────────────────────────────
  const panRef = useRef(undefined as unknown)

  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd((e, success) => {
      'worklet'
      if (success) runOnJS(seekAtX)(e.x)
    })

  const pan = Gesture.Pan()
    .withRef(panRef as never)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      'worklet'
      runOnJS(setGesturing)(true)
    })
    .onStart(() => {
      'worklet'
      runOnJS(emitScrubStart)()
    })
    .onUpdate((e) => {
      'worklet'
      runOnJS(scrubAtX)(e.x)
    })
    .onEnd(() => {
      'worklet'
      runOnJS(emitScrubEnd)()
    })
    .onFinalize(() => {
      'worklet'
      runOnJS(setGesturing)(false)
    })

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      'worklet'
      runOnJS(setGesturing)(true)
    })
    .onStart((e) => {
      'worklet'
      pStartPx.value = sPx.value
      pAnchorContentX.value = e.focalX + sOffset.value
      pCW.value = sCW.value
    })
    .onUpdate((e) => {
      'worklet'
      const startPx = pStartPx.value
      const newPx = Math.max(sMinPx.value, Math.min(sMaxPx.value, startPx * e.scale))
      const s = startPx > 0 ? newPx / startPx : e.scale
      pLastScale.value = s
      pLastFocal.value = e.focalX
      sx.value = s
      tx.value = e.focalX - pAnchorContentX.value * s - ((1 - s) * pCW.value) / 2
    })
    .onEnd(() => {
      'worklet'
      runOnJS(commitPinch)(pLastScale.value, pLastFocal.value)
    })
    .onFinalize(() => {
      'worklet'
      runOnJS(setGesturing)(false)
    })

  const composed = Gesture.Race(pinch, pan, tap)

  // ── bracket gestures (RNGH; block the timeline pan so an edge drag resizes) ──
  const startBracket = useRef<BufferBracket>({ inMs: 0, outMs: 0 })
  function corridor(centerMs: number): { lo: number; hi: number } {
    let lo = bufferStartRef.current
    let hi = bufferEndRef.current
    for (const r of savedRegionsRef.current) {
      if (r.endMs <= centerMs) lo = Math.max(lo, r.endMs)
      if (r.startMs >= centerMs) hi = Math.min(hi, r.startMs)
    }
    return { lo, hi }
  }
  function bracketBegin() {
    startBracket.current = bracketRef.current ?? { inMs: 0, outMs: 0 }
    setBlocked(false)
  }
  function bracketMove(mode: 'in' | 'out' | 'move', dxPx: number) {
    const cb = onBracketChangeRef.current
    if (!cb || pxRef.current <= 0) return
    const dms = dxPx / pxRef.current
    const { inMs, outMs } = startBracket.current
    const { lo, hi } = corridor((inMs + outMs) / 2)
    if (mode === 'in') {
      const desired = inMs + dms
      setBlocked(desired < lo)
      cb({ inMs: clamp(desired, lo, outMs - MIN_BRACKET_MS), outMs })
    } else if (mode === 'out') {
      const desired = outMs + dms
      setBlocked(desired > hi)
      cb({ inMs, outMs: clamp(desired, inMs + MIN_BRACKET_MS, hi) })
    } else {
      const dur = outMs - inMs
      const desired = inMs + dms
      setBlocked(desired < lo || desired > hi - dur)
      const nextIn = clamp(desired, lo, hi - dur)
      cb({ inMs: nextIn, outMs: nextIn + dur })
    }
  }
  function makeBracketGesture(mode: 'in' | 'out' | 'move') {
    return Gesture.Pan()
      .blocksExternalGesture(panRef as never)
      .onBegin(() => {
        'worklet'
        runOnJS(bracketBegin)()
      })
      .onUpdate((e) => {
        'worklet'
        runOnJS(bracketMove)(mode, e.translationX)
      })
      .onFinalize(() => {
        'worklet'
        runOnJS(setBlocked)(false)
      })
  }
  const inGesture = makeBracketGesture('in')
  const outGesture = makeBracketGesture('out')
  const moveGesture = makeBracketGesture('move')

  // Auto-follow the live edge when the playhead is at now and not gesturing.
  useEffect(() => {
    if (gesturingRef.current) return
    const live = nowMs ?? bufferEndMs
    if (playheadMs < live - 1500) return
    const end = Math.max(0, effContentWidth - width)
    if (end <= 0) return
    setScrollOffset(end)
    tx.value = -end
  }, [playheadMs, effContentWidth, width, nowMs, bufferEndMs, tx])

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width)
  }

  return (
    <View style={[styles.wrap, style]}>
      <GestureDetector gesture={composed}>
        <View style={styles.timeline} onLayout={onLayout}>
          <Animated.View
            style={[
              styles.content,
              { width: effContentWidth > 0 ? effContentWidth : '100%' },
              contentStyle,
            ]}
          >
            {blocks.map((b, i) =>
              b.kind === 'seg' ? (
                <View key={`seg-${b.seg.id}`} style={[styles.seg, { left: b.leftPx, width: b.widthPx }]}>
                  {b.seg.posterUrl && !failedPosters.has(b.seg.posterUrl) ? (
                    <Image
                      source={{ uri: b.seg.posterUrl }}
                      style={styles.segPoster}
                      contentFit="cover"
                      pointerEvents="none"
                      transition={120}
                      onError={() => {
                        const url = b.seg.posterUrl
                        if (!url) return
                        // eslint-disable-next-line no-console
                        if (__DEV__) console.log('[clip-video] poster 404 → sprockets', url)
                        setFailedPosters((prev) => {
                          if (prev.has(url)) return prev
                          const next = new Set(prev)
                          next.add(url)
                          return next
                        })
                      }}
                    />
                  ) : (
                    <FilmstripFill widthPx={b.widthPx} />
                  )}
                </View>
              ) : (
                <View key={`gap-${i}`} style={[styles.gapHolder, { left: b.leftPx }]}>
                  <GapMarker style={styles.gapFill} />
                </View>
              ),
            )}

            {hasFootage && <BufferEdge side="head" leftPx={0} accent={headEvicting} />}

            {hasFootage && <BufferEdge side="tail" leftPx={contentWidth} accent={tailLive} />}

            {/* Real frame thumbnails over the sprocket filmstrip (where available). */}
            {thumbnails?.map((t) => (
              <Image
                key={`thumb-${t.tMs}`}
                source={t.source}
                style={[styles.thumbTile, { left: timeToX(t.tMs, segBlocks, px) }]}
                contentFit="cover"
                pointerEvents="none"
              />
            ))}

            {savedRegions.map((r) => {
              const left = timeToX(r.startMs, segBlocks, px)
              const w = Math.max(2, timeToX(r.endMs, segBlocks, px) - left)
              return (
                <SavedClipRegion key={`saved-${r.id}`} label={r.label} style={[styles.saved, { left, width: w }]} />
              )
            })}

            {bracket && (
              <ClipBracket
                leftPx={timeToX(bracket.inMs, segBlocks, px)}
                widthPx={Math.max(0, timeToX(bracket.outMs, segBlocks, px) - timeToX(bracket.inMs, segBlocks, px))}
                durationLabel={formatDuration(bracket.outMs - bracket.inMs)}
                rangeLabel={`${formatClock(bracket.inMs)} → ${formatClock(bracket.outMs)}`}
                blocked={blocked}
                inGesture={inGesture}
                outGesture={outGesture}
                centerGesture={moveGesture}
              />
            )}

            <View style={[styles.playhead, { left: playheadX - 1 }]} pointerEvents="none">
              <View style={styles.playheadKnob} />
            </View>
          </Animated.View>
        </View>
      </GestureDetector>

      <TimelineScrollbar
        contentWidth={effContentWidth}
        viewport={width}
        scrollOffset={offset}
        onScrollTo={(o) => {
          const no = clamp(o, 0, maxScroll)
          tx.value = -no
          setScrollOffset(no)
        }}
      />

      <SegmentedToggle options={ZOOM_OPTS} value={currentLevel} onChange={applyZoomLevel} />
    </View>
  )
}

// The head/tail buffer-edge indicator: a 20px block, dark when idle or accent when
// "active" (head evicting / tail live). When accent, a zigzag bites into the footage
// from the footage-facing edge (head → right, tail → left).
function BufferEdge({ side, leftPx, accent }: { side: 'head' | 'tail'; leftPx: number; accent: boolean }) {
  const color = accent ? theme.colors.accent.default : theme.colors.text.primary
  return (
    <View
      style={[styles.edge, { left: leftPx, width: EDGE_GAP_WIDTH, backgroundColor: color }]}
      pointerEvents="none"
    >
      {accent && <ZigzagColumn side={side === 'head' ? 'right' : 'left'} color={color} />}
    </View>
  )
}

// A vertical sawtooth of triangles at one edge, teeth pointing outward (toward the
// footage). Rendered just past the edge so it overlaps the adjacent footage like a bite.
function ZigzagColumn({ side, color }: { side: 'left' | 'right'; color: string }) {
  const toothH = TRACK_H / ZIGZAG_TEETH
  return (
    <View
      style={[styles.zig, side === 'right' ? { right: -ZIGZAG_DEPTH } : { left: -ZIGZAG_DEPTH }]}
      pointerEvents="none"
    >
      {Array.from({ length: ZIGZAG_TEETH }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 0,
            height: 0,
            borderTopWidth: toothH / 2,
            borderBottomWidth: toothH / 2,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            ...(side === 'right'
              ? { borderLeftWidth: ZIGZAG_DEPTH, borderLeftColor: color }
              : { borderRightWidth: ZIGZAG_DEPTH, borderRightColor: color }),
          }}
        />
      ))}
    </View>
  )
}

function FilmstripFill({ widthPx }: { widthPx: number }) {
  const n = Math.max(1, Math.min(160, Math.ceil(widthPx / FILM_CELL_W)))
  return (
    <View style={styles.film} pointerEvents="none">
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={styles.filmCell}>
          <View style={styles.filmHole} />
          <View style={styles.filmHole} />
        </View>
      ))}
    </View>
  )
}

// ── layout + helpers ─────────────────────────────────────────────────────────

function measure(segments: BufferSegment[]): { totalSegMs: number; gapsPx: number } {
  let totalSegMs = 0
  let gapCount = 0
  for (let i = 0; i < segments.length; i++) {
    totalSegMs += Math.max(0, segments[i]!.endMs - segments[i]!.startMs)
    if (i > 0 && segments[i]!.startMs - segments[i - 1]!.endMs > GAP_THRESHOLD_MS) gapCount++
  }
  return { totalSegMs, gapsPx: gapCount * GAP_MARKER_WIDTH }
}

function layout(segments: BufferSegment[], px: number, leadingPx = 0): Layout {
  const blocks: (SegBlock | GapBlock)[] = []
  const segBlocks: SegBlock[] = []
  let cursor = leadingPx
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    if (i > 0) {
      const gapMs = seg.startMs - segments[i - 1]!.endMs
      if (gapMs > GAP_THRESHOLD_MS) {
        blocks.push({ kind: 'gap', leftPx: cursor, skippedMs: gapMs })
        cursor += GAP_MARKER_WIDTH
      }
    }
    const w = Math.max(1, (seg.endMs - seg.startMs) * px)
    const block: SegBlock = { kind: 'seg', seg, leftPx: cursor, widthPx: w }
    blocks.push(block)
    segBlocks.push(block)
    cursor += w
  }
  return { blocks, segBlocks, contentWidth: cursor }
}

// time → x. Within a collapsed inter-session gap the time maps LINEARLY across the gap
// marker's pixels (no snapping to the next clip's start), so the playhead glides.
function timeToX(ms: number, segBlocks: SegBlock[], px: number): number {
  if (segBlocks.length === 0) return 0
  for (let i = 0; i < segBlocks.length; i++) {
    const b = segBlocks[i]!
    if (ms < b.seg.startMs) {
      const prev = i > 0 ? segBlocks[i - 1]! : null
      if (!prev) return b.leftPx
      const gx = prev.leftPx + prev.widthPx
      const f = clamp((ms - prev.seg.endMs) / Math.max(1, b.seg.startMs - prev.seg.endMs), 0, 1)
      return gx + f * (b.leftPx - gx)
    }
    if (ms <= b.seg.endMs) return b.leftPx + (ms - b.seg.startMs) * px
  }
  const last = segBlocks[segBlocks.length - 1]!
  return last.leftPx + last.widthPx
}

// x → time. Inverse of the above: x inside a gap marker maps linearly to the gap's
// wall-clock span (smooth scrub across gaps, no snap to clip heads).
function xToTime(x: number, segBlocks: SegBlock[], px: number): number {
  if (segBlocks.length === 0) return 0
  for (let i = 0; i < segBlocks.length; i++) {
    const b = segBlocks[i]!
    if (x < b.leftPx) {
      const prev = i > 0 ? segBlocks[i - 1]! : null
      if (!prev) return b.seg.startMs
      const gx = prev.leftPx + prev.widthPx
      const f = clamp((x - gx) / Math.max(1, b.leftPx - gx), 0, 1)
      return prev.seg.endMs + f * (b.seg.startMs - prev.seg.endMs)
    }
    if (x <= b.leftPx + b.widthPx) return b.seg.startMs + (px > 0 ? (x - b.leftPx) / px : 0)
  }
  return segBlocks[segBlocks.length - 1]!.seg.endMs
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function formatClock(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  timeline: {
    height: TRACK_H,
    backgroundColor: theme.colors.bg.panel,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.strong,
    overflow: 'hidden',
  },
  content: {
    height: TRACK_H,
  },
  seg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.bg.panelHi,
    overflow: 'hidden',
  },
  thumbTile: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: FILM_CELL_W,
  },
  segPoster: {
    ...StyleSheet.absoluteFillObject,
  },
  film: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  filmCell: {
    width: FILM_CELL_W,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(26,22,18,0.12)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  filmHole: {
    width: 10,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(26,22,18,0.22)',
  },
  gapHolder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  zig: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  gapFill: {
    flex: 1,
  },
  saved: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.accent.bright,
  },
  playheadKnob: {
    position: 'absolute',
    top: 0,
    left: -3.5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: theme.colors.accent.bright,
  },
})
