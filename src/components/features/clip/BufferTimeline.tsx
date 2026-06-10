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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Image } from 'expo-image'
import { theme } from '@/tokens/theme'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
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
  // Bump this (e.g. from a transport button: prev/next clip, play, to-start/end) to
  // recenter the playhead in the viewport. If the playhead has scrolled out of frame,
  // the scroll animates so it lands as close to centre as the content bounds allow;
  // if it's already visible, the view stays put.
  centerSignal?: number
  style?: StyleProp<ViewStyle>
}

const TRACK_H = 52
const MIN_BRACKET_MS = 500
const GAP_THRESHOLD_MS = 500
// Real-frame filmstrip: each recorded segment is tiled with little FILM CELLS — a
// sprocket-hole band above and below, the thumbnail framed between them. The frame's
// aspect follows the video's display aspect (PORTRAIT — the scrub field + stream view
// are portrait boxes; tweak THUMB_ASPECT if that changes), so a portrait video gives a
// portrait frame and a landscape one a landscape frame. The sprocket holes are a fixed
// size + pitch regardless of frame orientation (only their count varies with width),
// so the perforations always look the same.
const THUMB_ASPECT = 9 / 16
const SPROCKET_BAND_H = 7 // height of each (top/bottom) perforation band
const SPROCKET_HOLE_W = 5
const SPROCKET_HOLE_H = 3
const SPROCKET_PITCH = 9 // target horizontal spacing between holes (fixed → consistent)
const THUMB_FRAME_H = TRACK_H - SPROCKET_BAND_H * 2 // the image area between the bands
const THUMB_CELL_W = Math.max(12, Math.round(THUMB_FRAME_H * THUMB_ASPECT)) // ≈ 21 portrait
const MAX_THUMB_TILES = 200 // per-segment cap (perf backstop at extreme zoom)
const EMPTY_THUMBS: TimelineThumb[] = []
// The head/tail buffer-edge indicators are wider than inter-session gaps and carry
// state: dark (idle), or accent with a footage-facing zigzag (head = evicting oldest,
// tail = live/growing) — "the buffer eating the footage".
const EDGE_GAP_WIDTH = 15
const ZIGZAG_TEETH = 4 // fixed count, evenly spaced over the track height
const ZIGZAG_DEPTH = 5 // how far the teeth bite into the footage (px)

// Zoom is a continuous pxPerMs from `fit` (the whole buffer fills the viewport) up to a
// frame-level max. The ‹zoom-out / zoom-in› buttons flanking the scrollbar step it on a
// tap and smoothly ramp it on a press-and-hold (replacing the old discrete level toggle).
const FRAME_MS = 1000 / 30 // one frame at the pinned 30fps capture
const FRAME_VIEW_PX = 12 // a single frame is ≈ this wide at the finest zoom
const FRAME_MAX_PXPERMS = FRAME_VIEW_PX / FRAME_MS // max zoom (≈0.36 px/ms = frame level)
const ZOOM_TAP_STEP = 1.6 // each tap multiplies / divides the zoom by this
const ZOOM_HOLD_TRIGGER_MS = 240 // press longer than this → smooth-zoom hold (not a tap)
const ZOOM_HOLD_MS = 5000 // a full-range hold (fit ⇆ frames) takes this long, any buffer

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
  centerSignal,
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
  // Every separator is a CELL border over the panelHi cell background, so they all match
  // (drawing on the dark eviction bars or the lighter gap fill would shift the colour).
  // Cells always carry a right border; a segment's FIRST cell additionally gets a left
  // border when something to its left can't own the separator itself — i.e. the head
  // eviction bar (first segment) or a preceding gap. The tail bar + inter-cell + cell→
  // gap boundaries are already covered by right borders.
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
  // Max zoom is the finer of frame-level and fit (a tiny buffer can't zoom past fit).
  const maxPx = fit > 0 ? Math.max(fit, FRAME_MAX_PXPERMS) : 0
  const px = pxPerMs > 0 ? pxPerMs : fit

  // Layout starts the cursor at leadingPx so every block is offset past the leading gap.
  const { blocks, segBlocks, contentWidth } = useMemo(
    () => layout(segments, px, leadingPx),
    [segments, px, leadingPx],
  )

  // Group per-instant frames by the segment that contains them, so each segment's
  // filmstrip can pick the nearest real frame for each of its tiles. Empty today
  // (no per-time frame source wired yet) → tiles fall back to the segment poster.
  const thumbsBySeg = useMemo(() => {
    const m = new Map<string, TimelineThumb[]>()
    if (!thumbnails?.length) return m
    for (const t of thumbnails) {
      const seg = segments.find((s) => t.tMs >= s.startMs && t.tMs <= s.endMs)
      if (!seg) continue
      const arr = m.get(seg.id)
      if (arr) arr.push(t)
      else m.set(seg.id, [t])
    }
    return m
  }, [segments, thumbnails])
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
        cellMs: THUMB_CELL_W / px,
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
  // `nowMs` is the live wall-clock the parent passes (Date.now()), so it changes
  // every render — read it via a ref where effects only need its current value
  // (not to re-run on it). See the auto-follow effect below.
  const nowMsRef = useRef(nowMs)
  nowMsRef.current = nowMs
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

  // ── continuous zoom (the ‹zoom-out / zoom-in› buttons flanking the scrollbar) ─
  // Set the zoom to `target` (clamped), keeping `focalTime` PINNED at the viewport
  // centre — so it grows/shrinks evenly on both sides of that instant, and a side that
  // reaches a buffer edge just stops (offset clamp) while the other keeps going. Reads
  // geometry via refs so it works from a tap AND the hold rAF loop.
  function applyZoom(target: number, focalTime: number) {
    const newPx = clamp(target, minPxRef.current, maxPxRef.current)
    if (newPx <= 0) return
    const nl = layout(segmentsRef.current, newPx, leadingPxRef.current)
    const newCW = nl.contentWidth + tailRef.current.trailingPx
    const focalX = timeToX(focalTime, nl.segBlocks, newPx)
    const no = clamp(focalX - widthRef.current / 2, 0, Math.max(0, newCW - widthRef.current))
    sx.value = 1
    tx.value = -no
    setPxPerMs(newPx)
    setScrollOffset(no)
  }
  // The time currently at the viewport centre — the focal the zoom locks onto.
  function viewportCenterTime() {
    return xToTime(offsetRef.current + widthRef.current / 2, segBlocksRef.current, pxRef.current)
  }
  function zoomStep(dir: 1 | -1) {
    applyZoom(dir > 0 ? pxRef.current * ZOOM_TAP_STEP : pxRef.current / ZOOM_TAP_STEP, viewportCenterTime())
  }
  // Hold → smoothly ramp the zoom across the WHOLE range (fit ⇆ frames) in ZOOM_HOLD_MS,
  // independent of buffer size: a constant rate in log-space (exponential zoom reads as
  // perceptually linear). `cur` carries the live value so React state batching can't lag
  // it; `focal` is captured ONCE so the centre stays rock-still (no per-frame re-pick).
  const zoomRaf = useRef<number | null>(null)
  function stopZoomHold() {
    if (zoomRaf.current != null) {
      cancelAnimationFrame(zoomRaf.current)
      zoomRaf.current = null
    }
  }
  function startZoomHold(dir: 1 | -1) {
    if (zoomRaf.current != null) return
    const minP = minPxRef.current
    const maxP = maxPxRef.current
    if (maxP <= minP) return
    const ratePerMs = Math.log(maxP / minP) / ZOOM_HOLD_MS
    const focal = viewportCenterTime()
    let cur = pxRef.current
    let last = Date.now()
    const step = () => {
      const now = Date.now()
      const dt = now - last
      last = now
      cur = clamp(cur * Math.exp(dir * ratePerMs * dt), minP, maxP)
      applyZoom(cur, focal)
      if ((dir > 0 && cur >= maxP) || (dir < 0 && cur <= minP)) {
        stopZoomHold()
        return
      }
      zoomRaf.current = requestAnimationFrame(step)
    }
    zoomRaf.current = requestAnimationFrame(step)
  }
  useEffect(() => () => stopZoomHold(), [])
  const canZoomOut = px > minPx * 1.002
  const canZoomIn = px < maxPx * 0.998

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
    const g = Gesture.Pan()
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
    // Extend the in/out grab area beyond the slim bulb — outward (away from the crop) +
    // vertically — for an easier handle grab. The move zone keeps its own bounds.
    if (mode === 'in') return g.hitSlop({ top: 12, bottom: 12, left: 14 })
    if (mode === 'out') return g.hitSlop({ top: 12, bottom: 12, right: 14 })
    return g
  }
  const inGesture = makeBracketGesture('in')
  const outGesture = makeBracketGesture('out')
  const moveGesture = makeBracketGesture('move')

  // Auto-follow the live edge when the playhead is at now and not gesturing.
  // `nowMs`/`bufferEndMs` are read via refs (not deps): the parent passes
  // `nowMs={Date.now()}`, which changes every render, so listing it here re-ran
  // this setState-bearing effect on every render — half of the render-loop that
  // tripped "Maximum update depth exceeded". It only needs the live threshold's
  // current value; the meaningful triggers are a moved playhead or a relayout.
  useEffect(() => {
    if (gesturingRef.current) return
    const live = nowMsRef.current ?? bufferEndRef.current
    if (playheadMs < live - 1500) return
    const end = Math.max(0, effContentWidth - width)
    if (end <= 0) return
    setScrollOffset(end)
    tx.value = -end
  }, [playheadMs, effContentWidth, width, tx])

  // Recenter the playhead on demand. The parent bumps `centerSignal` from a transport
  // action (prev/next clip, play, to-start/end); if the playhead has scrolled out of
  // the viewport we glide the scroll so it lands as close to centre as the content
  // bounds + zoom allow. Already on-screen → leave the view put (no needless jump).
  // Runs after the render that carries the new playhead + signal, so playheadX/offset
  // here are fresh. scrollOffset is committed only on completion, so the line above's
  // `tx = -offset` effect doesn't snap mid-animation.
  const centerSignalRef = useRef(centerSignal)
  useEffect(() => {
    if (centerSignal == null || centerSignal === centerSignalRef.current) return
    centerSignalRef.current = centerSignal
    if (width <= 0) return
    const phViewX = playheadX - offset
    if (phViewX >= 0 && phViewX <= width) return // already visible
    const target = clamp(playheadX - width / 2, 0, maxScroll)
    if (Math.abs(target - offset) < 1) return
    cancelAnimation(tx)
    tx.value = withTiming(-target, { duration: 300, easing: Easing.out(Easing.cubic) }, (finished) => {
      'worklet'
      if (finished) runOnJS(setScrollOffset)(target)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSignal])

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
            {blocks.map((b, i) => {
              if (b.kind !== 'seg') {
                return (
                  <View key={`gap-${i}`} style={[styles.gapHolder, { left: b.leftPx }]}>
                    <GapMarker style={styles.gapFill} />
                  </View>
                )
              }
              const poster =
                b.seg.posterUrl && !failedPosters.has(b.seg.posterUrl) ? b.seg.posterUrl : null
              const frames = thumbsBySeg.get(b.seg.id) ?? EMPTY_THUMBS
              return (
                <View key={`seg-${b.seg.id}`} style={[styles.seg, { left: b.leftPx, width: b.widthPx }]}>
                  {poster || frames.length ? (
                    <SegmentFilmstrip
                      widthPx={b.widthPx}
                      startMs={b.seg.startMs}
                      endMs={b.seg.endMs}
                      posterUrl={poster}
                      frames={frames}
                      leadingBorder={i === 0 || blocks[i - 1]?.kind === 'gap'}
                      onPosterError={(url) =>
                        setFailedPosters((prev) => {
                          if (prev.has(url)) return prev
                          const next = new Set(prev)
                          next.add(url)
                          return next
                        })
                      }
                    />
                  ) : (
                    <FilmstripFill widthPx={b.widthPx} />
                  )}
                </View>
              )
            })}

            {hasFootage && <BufferEdge side="head" leftPx={0} accent={headEvicting} />}

            {hasFootage && <BufferEdge side="tail" leftPx={contentWidth} accent={tailLive} />}

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

      {/* Scrollbar flanked by zoom-out (left) / zoom-in (right): tap to step, hold to
          smooth-zoom across the whole range. */}
      <View style={styles.zoomRow}>
        <ZoomButton
          icon="zoom-out"
          label="Zoom out"
          disabled={!canZoomOut}
          onTap={() => zoomStep(-1)}
          onHold={(held) => (held ? startZoomHold(-1) : stopZoomHold())}
        />
        <View style={styles.zoomScroll}>
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
        </View>
        <ZoomButton
          icon="zoom-in"
          label="Zoom in"
          disabled={!canZoomIn}
          onTap={() => zoomStep(1)}
          onHold={(held) => (held ? startZoomHold(1) : stopZoomHold())}
        />
      </View>
    </View>
  )
}

// Zoom button flanking the scrollbar: TAP = one zoom step; press-and-hold (past
// ZOOM_HOLD_TRIGGER_MS) = smooth zoom until release. Same tap-vs-hold shape as the
// transport's frame buttons.
function ZoomButton({
  icon,
  label,
  onTap,
  onHold,
  disabled,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  onTap: () => void
  onHold: (held: boolean) => void
  disabled?: boolean
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holding = useRef(false)
  const clearTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }
  return (
    <Pressable
      variant={disabled ? 'none' : 'subtle'}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.zoomBtn}
      onPressIn={() => {
        holding.current = false
        clearTimer()
        holdTimer.current = setTimeout(() => {
          holding.current = true
          onHold(true)
        }, ZOOM_HOLD_TRIGGER_MS)
      }}
      onPressOut={() => {
        clearTimer()
        if (holding.current) {
          holding.current = false
          onHold(false)
        } else {
          onTap()
        }
      }}
    >
      <Icon name={icon} size="md" color={disabled ? theme.colors.text.subtle : theme.colors.text.muted} />
    </Pressable>
  )
}

// The head/tail buffer-edge indicator: a 20px block, dark when idle or accent when
// "active" (head evicting / tail live). When accent, a zigzag bites into the footage
// from the footage-facing edge (head → right, tail → left).
function BufferEdge({ side, leftPx, accent }: { side: 'head' | 'tail'; leftPx: number; accent: boolean }) {
  const color = accent ? theme.colors.accent.default : theme.colors.text.primary
  return (
    <View
      style={[
        styles.edge,
        { left: leftPx, width: EDGE_GAP_WIDTH, backgroundColor: color },
      ]}
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

// A fixed-pitch row of sprocket holes for one film-cell band. Hole size + spacing are
// constant; only the count scales with the cell width, so perforations look identical
// whether the frame is portrait or landscape.
function SprocketRow({ widthPx }: { widthPx: number }) {
  const n = Math.max(1, Math.round(widthPx / SPROCKET_PITCH))
  return (
    <View style={styles.sprocketRow} pointerEvents="none">
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={styles.sprocketHole} />
      ))}
    </View>
  )
}

// One film cell: a perforation band top and bottom with the frame (image, or empty for
// the sprocket-only fallback) in between. The frame area carries the thumbnail's aspect.
function FilmCell({
  widthPx,
  src,
  onError,
  leftBorder,
}: {
  widthPx: number
  src?: ComponentProps<typeof Image>['source'] | null
  onError?: () => void
  leftBorder?: boolean
}) {
  return (
    <View style={[styles.filmCell, { width: widthPx }, leftBorder && styles.filmCellLeft]}>
      <SprocketRow widthPx={widthPx} />
      <View style={styles.filmFrame}>
        {src ? (
          <Image
            source={src}
            style={styles.segPoster}
            contentFit="cover"
            transition={120}
            pointerEvents="none"
            onError={onError}
          />
        ) : null}
      </View>
      <SprocketRow widthPx={widthPx} />
    </View>
  )
}

// Sprocket-only fallback (audio-only / missing poster): a row of empty film cells.
function FilmstripFill({ widthPx }: { widthPx: number }) {
  const n = Math.max(1, Math.min(MAX_THUMB_TILES, Math.round(widthPx / THUMB_CELL_W)))
  const cellW = widthPx / n
  return (
    <View style={styles.film} pointerEvents="none">
      {Array.from({ length: n }).map((_, i) => (
        <FilmCell key={i} widthPx={cellW} />
      ))}
    </View>
  )
}

// The real-frame filmstrip for one recorded segment: a row of film cells whose frame
// width follows the thumbnail aspect (stretched slightly to fill the segment exactly).
// Each cell shows the frame at its evenly-distributed time — cell 0 = the clip's head,
// the last = its tail — picking the nearest available per-time frame, else the session
// poster (so a single-poster backend still tiles; distinct frames light up unchanged
// once the server serves per-time frames). Cell count scales with zoom (segment width).
function SegmentFilmstrip({
  widthPx,
  startMs,
  endMs,
  posterUrl,
  frames,
  onPosterError,
  leadingBorder,
}: {
  widthPx: number
  startMs: number
  endMs: number
  posterUrl: string | null
  frames: TimelineThumb[]
  onPosterError: (url: string) => void
  leadingBorder?: boolean
}) {
  const n = Math.max(1, Math.min(MAX_THUMB_TILES, Math.round(widthPx / THUMB_CELL_W)))
  const cellW = widthPx / n
  return (
    <View style={styles.film} pointerEvents="none">
      {Array.from({ length: n }).map((_, i) => {
        const t = n > 1 ? startMs + ((endMs - startMs) * i) / (n - 1) : startMs
        const frame = nearestFrame(frames, t)
        const src = frame?.source ?? (posterUrl ? { uri: posterUrl } : undefined)
        return (
          <FilmCell
            key={i}
            widthPx={cellW}
            src={src}
            leftBorder={leadingBorder && i === 0}
            onError={!frame && posterUrl ? () => onPosterError(posterUrl) : undefined}
          />
        )
      })}
    </View>
  )
}

// The frame nearest a given time, or null when there are no per-time frames.
function nearestFrame(frames: TimelineThumb[], tMs: number): TimelineThumb | null {
  if (!frames.length) return null
  let best = frames[0]!
  let bestD = Math.abs(best.tMs - tMs)
  for (let i = 1; i < frames.length; i++) {
    const d = Math.abs(frames[i]!.tMs - tMs)
    if (d < bestD) {
      bestD = d
      best = frames[i]!
    }
  }
  return best
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

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  zoomScroll: {
    flex: 1,
  },
  zoomBtn: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: {
    // TRACK_H + the two 1px borders: the content (TRACK_H) then sits BETWEEN the
    // borders instead of clipping over the bottom one (iOS clips to the border box),
    // so the top and bottom rules match.
    height: TRACK_H + 2,
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
  segPoster: {
    ...StyleSheet.absoluteFillObject,
    // 4px rounded corners on the framed thumbnail; the corners reveal the film cell's
    // own frame background behind it.
    borderRadius: 4,
  },
  film: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  // One film cell: a perforation band top + bottom (column), the frame between them.
  // Separators follow one rule across the whole strip — every column (cell, gap, the
  // head eviction bar) draws a 1px RIGHT border and nothing draws a left border, so each
  // boundary is exactly one 1px line (no 2px doubling at gaps, no missing line at the
  // left edge). All use the same token.
  filmCell: {
    height: '100%',
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border.strong,
  },
  // The first cell of the first segment: a matching left border so the head eviction
  // bar gets the same cell-style separator the tail bar already has from the last cell.
  filmCellLeft: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border.strong,
  },
  filmFrame: {
    flex: 1,
    overflow: 'hidden',
    // The exact cell background (opaque) so the thumbnail's rounded corners reveal a
    // colour that matches the rest of the cell — not the previous semi-transparent tint,
    // which read a touch darker.
    backgroundColor: theme.colors.bg.panelHi,
  },
  sprocketRow: {
    height: SPROCKET_BAND_H,
    flexDirection: 'row',
    alignItems: 'center',
    // space-around → edge gaps are half the inter-hole gap, so a hole's spacing to its
    // neighbour reads the same whether that neighbour is in this cell or the next one
    // over (the 1px cell border sits in the middle of the shared gap).
    justifyContent: 'space-around',
  },
  sprocketHole: {
    width: SPROCKET_HOLE_W,
    height: SPROCKET_HOLE_H,
    borderRadius: 1.5,
    backgroundColor: theme.colors.text.subtle,
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
    // The gap draws NO borders. Its fill is paper100 (lighter than the panelHi cells),
    // so a semi-transparent border.strong line on it reads lighter than the rest. Both
    // 1px separators instead come from the adjacent CELLS (prior cell's right border,
    // next cell's left border), which sit over panelHi — so every separator matches.
    borderLeftWidth: 0,
    borderRightWidth: 0,
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
