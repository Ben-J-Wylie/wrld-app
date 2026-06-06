// src/components/features/clip/BufferTimeline.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The collapsed-gap timeline of the
// rolling buffer. Recorded segments scale with a continuous zoom; every real-time gap
// collapses to a fixed-width GapMarker. Already-saved spans render as read-only
// SavedClipRegion bands; an optional ClipBracket overlay defines the pending clip.
//
// Interaction model (2026-06-06 rework):
//   • TAP — the playhead snaps to wherever you tap (emits onScrub(absoluteMs)).
//   • PAN — a one-finger horizontal drag scrolls the timeline (when zoomed past the
//     viewport). The playhead does NOT move on scroll — it stays pinned to its time
//     and can travel off-screen.
//   • PINCH — a two-finger horizontal pinch zooms continuously, anchored on the
//     pinch midpoint.
//   • A thin TimelineScrollbar (below the track) shows the whole buffer: thumb length
//     = visible fraction (zoom), thumb position = scroll; drag it to pan. (Replaced
//     the discrete zoom toggle.)
//
// View state (zoom `pxPerMs` + `scrollOffset`) is local; data (playhead, bracket,
// segments, savedRegions) is from props. Gestures use PanResponder multitouch — no
// gesture-handler dependency. Bracket handles keep their own responders (parent owns
// the time math; saved-region no-overlap clamp).
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import { useMemo, useRef, useState } from 'react'
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { theme } from '@/tokens/theme'
import { GapMarker, GAP_MARKER_WIDTH } from './GapMarker'
import { SavedClipRegion } from './SavedClipRegion'
import { ClipBracket } from './ClipBracket'
import { TimelineScrollbar } from './TimelineScrollbar'

export type BufferSegment = { id: string; startMs: number; endMs: number; peaks?: number[] }
export type BufferSavedRegion = { id: string; startMs: number; endMs: number; label?: string }
export type BufferBracket = { inMs: number; outMs: number }

type Props = {
  segments: BufferSegment[]
  savedRegions?: BufferSavedRegion[]
  playheadMs: number
  bracket?: BufferBracket | null
  onScrub: (ms: number) => void
  onBracketChange?: (next: BufferBracket) => void
  style?: StyleProp<ViewStyle>
}

const TRACK_H = 52 // matches the Input `md` "What's happening" field
const MIN_BRACKET_MS = 500
const GAP_THRESHOLD_MS = 500
const ZOOM_MAX_FACTOR = 12 // can zoom in up to 12× the fit (whole-buffer) scale
const TAP_SLOP = 4

type SegBlock = { kind: 'seg'; seg: BufferSegment; leftPx: number; widthPx: number }
type GapBlock = { kind: 'gap'; leftPx: number; skippedMs: number }
type Layout = { blocks: (SegBlock | GapBlock)[]; segBlocks: SegBlock[]; contentWidth: number }

export function BufferTimeline({
  segments,
  savedRegions = [],
  playheadMs,
  bracket,
  onScrub,
  onBracketChange,
  style,
}: Props) {
  const [width, setWidth] = useState(0)
  const [pxPerMs, setPxPerMs] = useState(0) // 0 → use the fit scale (whole buffer)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [blocked, setBlocked] = useState(false)

  const bufferStartMs = segments.length > 0 ? segments[0]!.startMs : 0
  const bufferEndMs = segments.length > 0 ? segments[segments.length - 1]!.endMs : 0

  // Fit scale = pxPerMs that makes the whole buffer exactly fill the viewport.
  const { totalSegMs, gapsPx } = useMemo(() => measure(segments), [segments])
  const fit = totalSegMs > 0 && width > 0 ? Math.max(0, (width - gapsPx) / totalSegMs) : 0
  const minPx = fit
  const maxPx = fit > 0 ? fit * ZOOM_MAX_FACTOR : 0
  const px = pxPerMs > 0 ? pxPerMs : fit

  const { blocks, segBlocks, contentWidth } = useMemo(() => layout(segments, px), [segments, px])
  const maxScroll = Math.max(0, contentWidth - width)
  const offset = clamp(scrollOffset, 0, maxScroll)
  const playheadX = timeToX(playheadMs, segBlocks, px)

  // ── refs for the gesture closures ─────────────────────────────────────────
  const widthRef = useRef(width)
  const pxRef = useRef(px)
  const offsetRef = useRef(offset)
  const segmentsRef = useRef(segments)
  const segBlocksRef = useRef(segBlocks)
  const contentWidthRef = useRef(contentWidth)
  const minPxRef = useRef(minPx)
  const maxPxRef = useRef(maxPx)
  const onScrubRef = useRef(onScrub)
  const onBracketChangeRef = useRef(onBracketChange)
  const bracketRef = useRef(bracket)
  const savedRegionsRef = useRef(savedRegions)
  const bufferStartRef = useRef(bufferStartMs)
  const bufferEndRef = useRef(bufferEndMs)
  widthRef.current = width
  pxRef.current = px
  offsetRef.current = offset
  segmentsRef.current = segments
  segBlocksRef.current = segBlocks
  contentWidthRef.current = contentWidth
  minPxRef.current = minPx
  maxPxRef.current = maxPx
  onScrubRef.current = onScrub
  onBracketChangeRef.current = onBracketChange
  bracketRef.current = bracket
  savedRegionsRef.current = savedRegions
  bufferStartRef.current = bufferStartMs
  bufferEndRef.current = bufferEndMs

  // ── main gesture: tap (set playhead) / pan (scroll) / pinch (zoom) ─────────
  const g = useRef({ offset: 0, startX: 0, lastDx: 0, moved: false, pinchDist: 0, pinchPx: 0, anchorMs: 0 })
  const mainPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > TAP_SLOP || gs.numberActiveTouches === 2,
      onPanResponderGrant: (e) => {
        g.current = {
          offset: offsetRef.current,
          startX: e.nativeEvent.locationX ?? 0,
          lastDx: 0,
          moved: false,
          pinchDist: 0,
          pinchPx: pxRef.current,
          anchorMs: 0,
        }
      },
      onPanResponderMove: (e, gs) => {
        const touches = e.nativeEvent.touches
        const W = widthRef.current
        if (touches.length >= 2) {
          const x0 = touches[0]!.locationX ?? 0
          const x1 = touches[1]!.locationX ?? 0
          const dist = Math.max(1, Math.abs(x0 - x1)) // horizontal pinch
          const mid = (x0 + x1) / 2
          if (g.current.pinchDist === 0) {
            g.current.pinchDist = dist
            g.current.pinchPx = pxRef.current
            g.current.anchorMs = xToTime(mid + g.current.offset, segBlocksRef.current, pxRef.current)
          }
          g.current.moved = true
          const np = clamp(g.current.pinchPx * (dist / g.current.pinchDist), minPxRef.current, maxPxRef.current)
          const nl = layout(segmentsRef.current, np)
          const no = clamp(timeToX(g.current.anchorMs, nl.segBlocks, np) - mid, 0, Math.max(0, nl.contentWidth - W))
          g.current.offset = no
          setPxPerMs(np)
          setScrollOffset(no)
        } else {
          if (Math.abs(gs.dx) > TAP_SLOP) g.current.moved = true
          g.current.pinchDist = 0
          const delta = gs.dx - g.current.lastDx
          g.current.lastDx = gs.dx
          const maxS = Math.max(0, contentWidthRef.current - W)
          g.current.offset = clamp(g.current.offset - delta, 0, maxS)
          setScrollOffset(g.current.offset)
        }
      },
      onPanResponderRelease: () => {
        if (!g.current.moved) {
          const contentX = g.current.startX + g.current.offset
          onScrubRef.current(xToTime(contentX, segBlocksRef.current, pxRef.current))
        }
      },
    }),
  ).current

  // ── bracket gestures (in edge / out edge / center move) ───────────────────
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
  function makeBracketPan(mode: 'in' | 'out' | 'move') {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startBracket.current = bracketRef.current ?? { inMs: 0, outMs: 0 }
        setBlocked(false)
      },
      onPanResponderMove: (_e, gs) => {
        const cb = onBracketChangeRef.current
        if (!cb || pxRef.current <= 0) return
        const dms = gs.dx / pxRef.current
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
      },
      onPanResponderRelease: () => setBlocked(false),
      onPanResponderTerminate: () => setBlocked(false),
    })
  }
  const inPan = useRef(makeBracketPan('in')).current
  const outPan = useRef(makeBracketPan('out')).current
  const movePan = useRef(makeBracketPan('move')).current

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width)
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.timeline} onLayout={onLayout} {...mainPan.panHandlers}>
        <View
          style={[
            styles.content,
            { width: contentWidth > 0 ? contentWidth : '100%', transform: [{ translateX: -offset }] },
          ]}
        >
          {blocks.map((b, i) =>
            b.kind === 'seg' ? (
              <View key={`seg-${b.seg.id}`} style={[styles.seg, { left: b.leftPx, width: b.widthPx }]}>
                <Waveform peaks={b.seg.peaks} />
              </View>
            ) : (
              <View key={`gap-${i}`} style={[styles.gapHolder, { left: b.leftPx }]}>
                <GapMarker skippedMs={b.skippedMs} style={styles.gapFill} />
              </View>
            ),
          )}

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
              inHandlers={inPan.panHandlers}
              outHandlers={outPan.panHandlers}
              centerHandlers={movePan.panHandlers}
            />
          )}

          <View style={[styles.playhead, { left: playheadX - 1 }]} pointerEvents="none">
            <View style={styles.playheadKnob} />
          </View>
        </View>
      </View>

      <TimelineScrollbar
        contentWidth={contentWidth}
        viewport={width}
        scrollOffset={offset}
        onScrollTo={(o) => setScrollOffset(clamp(o, 0, maxScroll))}
      />
    </View>
  )
}

function Waveform({ peaks }: { peaks?: number[] }) {
  const data = peaks ?? DEFAULT_PEAKS
  return (
    <View style={styles.wf} pointerEvents="none">
      {data.map((h, i) => (
        <View key={i} style={[styles.wfBar, { height: `${Math.round(20 + h * 70)}%` }]} />
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

function layout(segments: BufferSegment[], px: number): Layout {
  const blocks: (SegBlock | GapBlock)[] = []
  const segBlocks: SegBlock[] = []
  let cursor = 0
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

function timeToX(ms: number, segBlocks: SegBlock[], px: number): number {
  if (segBlocks.length === 0) return 0
  for (const b of segBlocks) {
    if (ms < b.seg.startMs) return b.leftPx
    if (ms <= b.seg.endMs) return b.leftPx + (ms - b.seg.startMs) * px
  }
  const last = segBlocks[segBlocks.length - 1]!
  return last.leftPx + last.widthPx
}

function xToTime(x: number, segBlocks: SegBlock[], px: number): number {
  if (segBlocks.length === 0) return 0
  for (const b of segBlocks) {
    if (x < b.leftPx) return b.seg.startMs
    if (x <= b.leftPx + b.widthPx) return b.seg.startMs + (px > 0 ? (x - b.leftPx) / px : 0)
  }
  return segBlocks[segBlocks.length - 1]!.seg.endMs
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

const DEFAULT_PEAKS = [0.5, 0.8, 0.35, 0.62, 0.9, 0.48, 0.7, 0.55, 0.4, 0.66]

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
    borderRightWidth: 1,
    borderRightColor: theme.colors.border.subtle,
  },
  wf: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    opacity: 0.5,
  },
  wfBar: {
    flex: 1,
    borderRadius: 1,
    backgroundColor: theme.colors.text.primary,
  },
  gapHolder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
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
