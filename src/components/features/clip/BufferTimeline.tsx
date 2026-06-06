// src/components/features/clip/BufferTimeline.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The collapsed-gap, zoomable
// timeline of the rolling buffer. Recorded segments scale with the zoom level;
// every real-time gap between them collapses to a fixed-width GapMarker. Already
// saved spans render as read-only SavedClipRegion bands. An optional ClipBracket
// overlay defines the pending clip's in/out.
//
// Playhead behavior (shared with BufferScrubField via the controlled `playheadMs`):
//   • content narrower than the viewport → content left-aligned, playhead moves
//     freely (free-fit)
//   • content wider than the viewport → content translates to keep the playhead
//     centered…
//   • …until an end reaches the screen edge, where the translate clamps and the
//     playhead travels off-center toward that edge (no scrolling past the ends).
// This is implemented as a derived translateX on the content layer (no ScrollView),
// so the scrub + bracket PanResponders never fight a scroll gesture.
//
// Time math lives entirely here. The bracket is positioned in pixels and clamped so
// it can't cross a SavedClipRegion (emits `blocked` to the ClipBracket while it
// resists). Pinch-to-zoom is the consumer's gesture-handler concern; `zoom` is a
// controlled prop driven by TimelineZoomControl.
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
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'
import type { TimelineZoom } from '@/components/primitives/TimelineZoomControl'
import { GapMarker, GAP_MARKER_WIDTH } from './GapMarker'
import { SavedClipRegion } from './SavedClipRegion'
import { ClipBracket } from './ClipBracket'

export type BufferSegment = { id: string; startMs: number; endMs: number; peaks?: number[] }
export type BufferSavedRegion = { id: string; startMs: number; endMs: number; label?: string }
export type BufferBracket = { inMs: number; outMs: number }

type Props = {
  segments: BufferSegment[]
  savedRegions?: BufferSavedRegion[]
  playheadMs: number
  zoom: TimelineZoom
  bracket?: BufferBracket | null
  onScrub: (ms: number) => void
  onBracketChange?: (next: BufferBracket) => void
  style?: StyleProp<ViewStyle>
}

const AXIS_H = 18
const TRACK_H = 78
const HEIGHT = AXIS_H + TRACK_H
const MIN_BRACKET_MS = 500
const GAP_THRESHOLD_MS = 500

// px-per-ms by zoom level. 'all' fits the whole buffer; the rest are fixed scales
// floored at the fit value so zooming only ever enlarges (never shrinks past 'all').
const ZOOM_PX_PER_MS: Record<Exclude<TimelineZoom, 'all'>, number> = {
  hours: 0.00002, // ~0.072 px/s → ~259 px/hour
  min: 0.0005, // 0.5 px/s → 30 px/min
  sec: 0.006, // 6 px/s
}

type SegBlock = { kind: 'seg'; seg: BufferSegment; leftPx: number; widthPx: number }
type GapBlock = { kind: 'gap'; leftPx: number; skippedMs: number }

export function BufferTimeline({
  segments,
  savedRegions = [],
  playheadMs,
  zoom,
  bracket,
  onScrub,
  onBracketChange,
  style,
}: Props) {
  const [width, setWidth] = useState(0)
  const [blocked, setBlocked] = useState(false)

  const bufferStartMs = segments.length > 0 ? segments[0]!.startMs : 0
  const bufferEndMs = segments.length > 0 ? segments[segments.length - 1]!.endMs : 0

  const { blocks, contentWidth, pxPerMs } = useMemo(
    () => layout(segments, zoom, width),
    [segments, zoom, width],
  )
  const segBlocks = useMemo(
    () => blocks.filter((b): b is SegBlock => b.kind === 'seg'),
    [blocks],
  )

  function timeToX(ms: number): number {
    if (segBlocks.length === 0) return 0
    for (const b of segBlocks) {
      if (ms < b.seg.startMs) return b.leftPx
      if (ms <= b.seg.endMs) return b.leftPx + (ms - b.seg.startMs) * pxPerMs
    }
    const last = segBlocks[segBlocks.length - 1]!
    return last.leftPx + last.widthPx
  }

  function xToTime(x: number): number {
    if (segBlocks.length === 0) return 0
    for (const b of segBlocks) {
      if (x < b.leftPx) return b.seg.startMs
      if (x <= b.leftPx + b.widthPx) return b.seg.startMs + (x - b.leftPx) / pxPerMs
    }
    return segBlocks[segBlocks.length - 1]!.seg.endMs
  }

  // Derived content offset for the centered / edge-released playhead.
  const playheadX = timeToX(playheadMs)
  const translateX =
    width > 0 && contentWidth > width
      ? clamp(width / 2 - playheadX, width - contentWidth, 0)
      : 0

  // Refs mirror the latest props/derived values so the once-created PanResponders
  // (below) always read fresh values inside their gesture closures.
  const playheadMsRef = useRef(playheadMs)
  const pxPerMsRef = useRef(pxPerMs)
  const bufferStartRef = useRef(bufferStartMs)
  const bufferEndRef = useRef(bufferEndMs)
  const bracketRef = useRef(bracket)
  const savedRegionsRef = useRef(savedRegions)
  const onScrubRef = useRef(onScrub)
  const onBracketChangeRef = useRef(onBracketChange)
  const startScrubMs = useRef(playheadMs)
  const startBracket = useRef<BufferBracket>({ inMs: 0, outMs: 0 })
  playheadMsRef.current = playheadMs
  pxPerMsRef.current = pxPerMs
  bufferStartRef.current = bufferStartMs
  bufferEndRef.current = bufferEndMs
  bracketRef.current = bracket
  savedRegionsRef.current = savedRegions
  onScrubRef.current = onScrub
  onBracketChangeRef.current = onBracketChange

  // ── Scrub (drag the empty track) ──────────────────────────────────────────
  const scrubPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => {
        startScrubMs.current = playheadMsRef.current
      },
      onPanResponderMove: (_e, g) => {
        if (pxPerMsRef.current <= 0) return
        // Content-scroll feel: drag right → earlier; drag left → later.
        const next = startScrubMs.current - g.dx / pxPerMsRef.current
        onScrubRef.current(clamp(next, bufferStartRef.current, bufferEndRef.current))
      },
    }),
  ).current

  // ── Bracket gestures (in edge / out edge / center move) ───────────────────
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
      onPanResponderMove: (_e, g) => {
        const cb = onBracketChangeRef.current
        if (!cb || pxPerMsRef.current <= 0) return
        const dms = g.dx / pxPerMsRef.current
        const { inMs, outMs } = startBracket.current
        const { lo, hi } = corridor((inMs + outMs) / 2)
        if (mode === 'in') {
          const desired = inMs + dms
          const next = clamp(desired, lo, outMs - MIN_BRACKET_MS)
          setBlocked(desired < lo)
          cb({ inMs: next, outMs })
        } else if (mode === 'out') {
          const desired = outMs + dms
          const next = clamp(desired, inMs + MIN_BRACKET_MS, hi)
          setBlocked(desired > hi)
          cb({ inMs, outMs: next })
        } else {
          const dur = outMs - inMs
          const desired = inMs + dms
          const nextIn = clamp(desired, lo, hi - dur)
          setBlocked(desired < lo || desired > hi - dur)
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
    <View style={[styles.timeline, style]} onLayout={onLayout} {...scrubPan.panHandlers}>
      <View
        style={[
          styles.content,
          { width: contentWidth > 0 ? contentWidth : '100%', transform: [{ translateX }] },
        ]}
      >
        <View style={styles.axis}>
          {segBlocks.map((b) => (
            <Text
              key={`tick-${b.seg.id}`}
              variant="monoValue"
              color={theme.colors.text.subtle}
              style={[styles.tick, { left: b.leftPx }]}
              numberOfLines={1}
            >
              {formatTick(b.seg.startMs, zoom)}
            </Text>
          ))}
          {segBlocks.length > 0 && (
            <Text
              variant="monoValue"
              color={theme.colors.text.subtle}
              style={[styles.tick, { left: contentWidth - 2 }]}
              numberOfLines={1}
            >
              NOW
            </Text>
          )}
        </View>

        <View style={styles.track}>
          {blocks.map((b, i) =>
            b.kind === 'seg' ? (
              <View
                key={`seg-${b.seg.id}`}
                style={[styles.seg, { left: b.leftPx, width: b.widthPx }]}
              >
                <Waveform peaks={b.seg.peaks} />
              </View>
            ) : (
              <View key={`gap-${i}`} style={[styles.gapHolder, { left: b.leftPx }]}>
                <GapMarker skippedMs={b.skippedMs} style={styles.gapFill} />
              </View>
            ),
          )}

          {savedRegions.map((r) => {
            const left = timeToX(r.startMs)
            const w = Math.max(2, timeToX(r.endMs) - left)
            return (
              <SavedClipRegion
                key={`saved-${r.id}`}
                label={r.label}
                style={[styles.saved, { left, width: w }]}
              />
            )
          })}

          {bracket && (
            <ClipBracket
              leftPx={timeToX(bracket.inMs)}
              widthPx={Math.max(0, timeToX(bracket.outMs) - timeToX(bracket.inMs))}
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

function layout(
  segments: BufferSegment[],
  zoom: TimelineZoom,
  width: number,
): { blocks: (SegBlock | GapBlock)[]; contentWidth: number; pxPerMs: number } {
  if (segments.length === 0 || width <= 0) return { blocks: [], contentWidth: 0, pxPerMs: 0 }

  let gapCount = 0
  let totalSegMs = 0
  for (let i = 0; i < segments.length; i++) {
    totalSegMs += Math.max(0, segments[i]!.endMs - segments[i]!.startMs)
    if (i > 0 && segments[i]!.startMs - segments[i - 1]!.endMs > GAP_THRESHOLD_MS) gapCount++
  }
  const gapsPx = gapCount * GAP_MARKER_WIDTH
  const fit = totalSegMs > 0 ? Math.max(0, (width - gapsPx) / totalSegMs) : 0
  const pxPerMs = zoom === 'all' ? fit : Math.max(fit, ZOOM_PX_PER_MS[zoom])

  const blocks: (SegBlock | GapBlock)[] = []
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
    const w = Math.max(1, (seg.endMs - seg.startMs) * pxPerMs)
    blocks.push({ kind: 'seg', seg, leftPx: cursor, widthPx: w })
    cursor += w
  }
  return { blocks, contentWidth: cursor, pxPerMs }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

const DEFAULT_PEAKS = [0.5, 0.8, 0.35, 0.62, 0.9, 0.48, 0.7, 0.55, 0.4, 0.66]

function formatTick(ms: number, zoom: TimelineZoom): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  if (zoom === 'all' || zoom === 'hours') {
    if (zoom === 'hours') return `${hh}:00`
    const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    return `${MON[d.getMonth()]} ${d.getDate()}`
  }
  if (zoom === 'min') return `${hh}:${mm}`
  return `${mm}:${ss}`
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
  timeline: {
    height: HEIGHT,
    backgroundColor: theme.colors.bg.panel,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border.strong,
    overflow: 'hidden',
  },
  content: {
    height: HEIGHT,
  },
  axis: {
    height: AXIS_H,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  tick: {
    position: 'absolute',
    top: 3,
  },
  track: {
    position: 'absolute',
    top: AXIS_H,
    left: 0,
    right: 0,
    bottom: 0,
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
    top: 12,
    bottom: 12,
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
    top: -AXIS_H,
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
