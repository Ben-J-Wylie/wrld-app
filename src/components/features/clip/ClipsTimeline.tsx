// src/components/features/clip/ClipsTimeline.tsx
//
// The horizontal Clips timeline — the redesigned grid (2026-06-12). A fixed-height region
// (no page vertical scroll). Top-to-bottom it stacks FIVE rows; the clock ruler + the two
// clip lanes scroll together HORIZONTALLY along a shared collapsed-gap time axis (**oldest/
// reaper on the LEFT, now on the RIGHT**); the two title rows are fixed bands that name each
// lane and what happens to its content:
//
//   ┌ clock stamps ──────────────────────────────┐
//   │ ▣ BUFFER  not public · reaper clears it     │  (fixed title band)
//   │   [▓▓▓]·[▓▓▓▓]········[▓▓]                   │  footage minus saved ranges
//   │ ▣ SAVED   public · safe from the reaper      │  (fixed title band)
//   │        [▓▓]       [▓▓▓]                      │  the carved-out saved clips
//   └ reaper ──────────────────────────────► now ─┘
//
// Empty time collapses to thin gap markers (footage never disappears into empty space).
//
// ── Why this is all reanimated (no ScrollView) ──
// Pan + pinch run ENTIRELY on the UI thread. Clip / tick / gap positions are animated values
// derived from two shared values — `px` (px-per-ms zoom) and `scroll` (the content-x under the
// centre playhead) — so a gesture NEVER touches React state and never re-renders the tree. That
// is what makes it buttery: no runOnJS-per-frame, no setState-per-frame, no scroll correction
// lagging the layout. Zoom is a pure layout rescale (clips re-flow to new widths; their content
// is fixed-size, so nothing stretches), anchored to the centre. React state only commits in
// coarse zoom steps, purely to flip the thumb↔film-glyph swap. See DESIGN.md Section 3.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { ClipBlock } from './ClipBlock'
import { type LaneClip } from './ClipLane'

const RULER_H = 22
const TITLE_H = 22 // fixed title band above each clip lane (name + reaper/time-machine note)
const CLIP_INSET_Y = 4 // breathing room between a clip block and the top/bottom of its lane
const MIN_CLIP_W = 26 // a short clip stays a tappable block
const GAP_W = 22 // collapsed-gap marker width
const GAP_THRESHOLD_MS = 45_000 // gaps longer than this get a marker; shorter → a hair of spacing
const MICRO_GAP_W = 4
const LONGEST_DEFAULT_W = 150 // default zoom: the longest clip ≈ this wide
const MAX_PX_PER_MS = 0.2
const TICK_MIN_GAP = 48 // hide a ruler stamp whose neighbour is closer than this (px)
const COMMIT_STEP = 0.18 // re-commit px to React (→ thumb/glyph swap) every ~18% zoom change

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtTick(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ── one segment per clip on the shared axis (oldest → newest = left → right) ──
// `gapPx` is the fixed-width gap BEFORE this clip (0 · MICRO_GAP_W · GAP_W). Precomputed in JS
// (changes only when the clip set / now changes), then the cumulative pixel layout is computed
// from `px` — in a worklet on the UI thread for the live gesture, and in JS for scrollToTime.
type Seg = { id: string; startMs: number; durMs: number; gapPx: number }
type Layout = { lefts: number[]; widths: number[]; total: number }

// Cumulative layout at a given zoom. Tagged `worklet` so it runs on the UI thread inside the
// derived value + gestures; it also runs fine on the JS thread (scrollToTime).
function computeLayout(segs: Seg[], trailGapPx: number, px: number): Layout {
  'worklet'
  const lefts: number[] = []
  const widths: number[] = []
  let cursor = 0
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!
    cursor += s.gapPx
    const w = Math.max(MIN_CLIP_W, s.durMs * px)
    lefts.push(cursor)
    widths.push(w)
    cursor += w
  }
  cursor += trailGapPx
  return { lefts, widths, total: cursor }
}
function clampW(v: number, lo: number, hi: number) {
  'worklet'
  return Math.max(lo, Math.min(hi, v))
}

type Props = {
  buffered: LaneClip[]
  saved: LaneClip[]
  nowMs: number
  selectedId: string | null
  onSelect: (clip: LaneClip) => void
  onOpen: (clip: LaneClip, kind: 'buffered' | 'saved') => void
  onSave: (clip: LaneClip) => void // drag a buffer block DOWN → save
  onUnsave: (clip: LaneClip) => void // drag a saved block UP → un-save
  onScrubStart?: () => void // the user began dragging the timeline (→ blur the selection)
  // The drag ended; carries the PRECISE clip + instant under the centre playhead at release
  // (computed fresh from the scroll position — not the last clip-change), so a within-clip scrub
  // resumes from exactly where you let go.
  onScrubEnd?: (clipId: string | null, timeMs: number) => void
  onCenter?: (clipId: string | null, timeMs: number) => void // clip/instant under the centre playhead
}

// Imperative handle so the host can drive the scroll from playback — bring a time instant under
// the fixed centre playhead (reposition on play, then follow frame-by-frame as it plays) — and
// read back the clip + instant currently under the playhead (for the scissor cut).
export type ClipsTimelineHandle = {
  scrollToTime: (ms: number, animated?: boolean) => void
  getCenter: () => { clipId: string | null; timeMs: number }
}

// ── animated leaf nodes (each reads the shared `layout` on the UI thread) ──
function AnimatedClip({
  layout,
  index,
  clipH,
  children,
}: {
  layout: SharedValue<Layout>
  index: number
  clipH: number
  children: React.ReactNode
}) {
  const style = useAnimatedStyle(() => ({
    left: layout.value.lefts[index] ?? 0,
    width: layout.value.widths[index] ?? MIN_CLIP_W,
  }))
  return <Animated.View style={[styles.slot, { top: CLIP_INSET_Y, height: clipH }, style]}>{children}</Animated.View>
}

function AnimatedTick({ layout, index, label, isNow }: { layout: SharedValue<Layout>; index: number; label: string; isNow?: boolean }) {
  const style = useAnimatedStyle(() => {
    const lay = layout.value
    const x = isNow ? lay.total : (lay.lefts[index] ?? 0)
    // Fade a stamp whose left neighbour is too close, so labels never crowd when zoomed out.
    let opacity = 1
    if (!isNow && index > 0) opacity = x - (lay.lefts[index - 1] ?? 0) < TICK_MIN_GAP ? 0 : 1
    return { left: x, opacity }
  })
  return (
    <Animated.View style={[styles.tick, style]}>
      <View style={[styles.tickMark, isNow && styles.tickMarkNow]} />
      <Text variant="monoCaption" color={isNow ? theme.colors.accent.default : theme.colors.text.subtle}>
        {label}
      </Text>
    </Animated.View>
  )
}

function AnimatedGap({ layout, index, trailing }: { layout: SharedValue<Layout>; index: number; trailing?: boolean }) {
  // A full gap occupies [left-GAP_W, left] before clip `index`; the trailing gap is the last GAP_W.
  const style = useAnimatedStyle(() => ({ left: trailing ? layout.value.total - GAP_W : (layout.value.lefts[index] ?? 0) - GAP_W }))
  return (
    <Animated.View style={[styles.gapBand, { width: GAP_W, top: RULER_H, bottom: 0 }, style]}>
      <View style={styles.gapRule} />
    </Animated.View>
  )
}

export const ClipsTimeline = forwardRef<ClipsTimelineHandle, Props>(function ClipsTimeline(
  { buffered, saved, nowMs, selectedId, onSelect, onOpen, onSave, onUnsave, onScrubStart, onScrubEnd, onCenter }: Props,
  ref,
) {
  // Combined set drives the shared axis (buffer + saved don't overlap → one timeline). Sorted
  // oldest→newest with gap-before widths; each clip gets a stable index into the layout arrays.
  const { segs, trailGapPx, idToIndex, tickIndices, gapIndices, trailingGap } = useMemo(() => {
    const all = [...buffered, ...saved]
      .filter((c) => Number.isFinite(c.startMs) && Number.isFinite(c.endMs) && c.endMs >= c.startMs)
      .sort((a, b) => a.startMs - b.startMs)
    const out: Seg[] = []
    const idx: Record<string, number> = {}
    const gaps: number[] = []
    let prevEnd: number | null = null
    for (const c of all) {
      let gapPx = 0
      if (prevEnd != null && c.startMs > prevEnd) gapPx = c.startMs - prevEnd > GAP_THRESHOLD_MS ? GAP_W : MICRO_GAP_W
      if (gapPx >= GAP_W) gaps.push(out.length)
      idx[c.id] = out.length
      out.push({ id: c.id, startMs: c.startMs, durMs: c.endMs - c.startMs, gapPx })
      prevEnd = prevEnd == null ? c.endMs : Math.max(prevEnd, c.endMs)
    }
    const trailing = prevEnd != null && nowMs > prevEnd + GAP_THRESHOLD_MS
    return { segs: out, trailGapPx: trailing ? GAP_W : 0, idToIndex: idx, tickIndices: out.map((_, i) => i), gapIndices: gaps, trailingGap: trailing }
  }, [buffered, saved, nowMs])

  const maxDur = useMemo(() => segs.reduce((m, s) => Math.max(m, s.durMs), 0), [segs])
  const [viewportW, setViewportW] = useState(0)
  const [regionH, setRegionH] = useState(0)
  // px committed to React — ONLY drives the thumb↔glyph swap (widthPx prop). The live zoom lives
  // in the `px` shared value; this trails it in coarse steps.
  const [pxState, setPxState] = useState(0)

  const minPx = maxDur > 0 ? MIN_CLIP_W / maxDur : 0
  const maxPx = Math.max(minPx, MAX_PX_PER_MS)
  const defaultPx = maxDur > 0 ? clamp(LONGEST_DEFAULT_W / maxDur, minPx, maxPx) : 0

  // ── shared values (UI-thread source of truth) ──
  const px = useSharedValue(0) // px-per-ms zoom
  const scroll = useSharedValue(0) // content-x under the centre playhead (= the scroll offset)
  const segsSv = useSharedValue<Seg[]>(segs)
  const trailSv = useSharedValue(trailGapPx)
  const minPxSv = useSharedValue(0)
  const maxPxSv = useSharedValue(MAX_PX_PER_MS)
  const vpSv = useSharedValue(0)
  const pinchStartPx = useSharedValue(0)
  const anchorIdx = useSharedValue(-1)
  const anchorFrac = useSharedValue(0)
  const anchorScrollFrac = useSharedValue(0)
  const lastCommitPx = useSharedValue(0)
  const prevCenterIdx = useSharedValue(-2)
  // True the instant a 2nd finger lands anywhere on the timeline → pan + clip-drag yield to the
  // pinch immediately (before pinch even activates on movement). The pinch ref lets the clip
  // drags (in child detectors) run simultaneously, so a 2nd finger can take over mid-drag.
  const twoFingers = useSharedValue(false)
  const pinchRef = useRef<GestureType | undefined>(undefined)
  const layout = useDerivedValue(() => computeLayout(segsSv.value, trailSv.value, px.value))

  // Keep the worklet inputs in sync with the JS-side precompute / measurements.
  useEffect(() => {
    segsSv.value = segs
    trailSv.value = trailGapPx
  }, [segs, trailGapPx, segsSv, trailSv])
  useEffect(() => {
    minPxSv.value = minPx
    maxPxSv.value = maxPx
  }, [minPx, maxPx, minPxSv, maxPxSv])
  useEffect(() => {
    vpSv.value = viewportW
  }, [viewportW, vpSv])

  // Seed the zoom + land with "now" centred, once, when the viewport + first content are known.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || defaultPx <= 0 || viewportW <= 0) return
    seeded.current = true
    px.value = defaultPx
    lastCommitPx.value = defaultPx
    setPxState(defaultPx)
    scroll.value = computeLayout(segs, trailGapPx, defaultPx).total // now under the centre
  }, [defaultPx, viewportW, segs, trailGapPx, px, scroll, lastCommitPx])

  // ── imperative: bring a time instant under the centre playhead (playback reposition + follow) ──
  const scrollToTime = useCallback(
    (ms: number, animated = false) => {
      const p = px.value || defaultPx
      if (p <= 0) return
      const lay = computeLayout(segs, trailGapPx, p)
      let x = lay.total
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!
        if (ms >= s.startMs && ms <= s.startMs + s.durMs) {
          const frac = s.durMs > 0 ? (ms - s.startMs) / s.durMs : 0
          x = lay.lefts[i]! + frac * lay.widths[i]!
          break
        }
      }
      const target = clamp(x, 0, lay.total)
      cancelAnimation(scroll)
      scroll.value = animated ? withTiming(target, { duration: 240 }) : target
    },
    [segs, trailGapPx, defaultPx, px, scroll],
  )
  // The clip + instant currently under the centre playhead (read on demand for the scissor cut).
  const getCenter = useCallback(() => {
    const p = px.value || defaultPx
    if (p <= 0) return { clipId: null, timeMs: 0 }
    const lay = computeLayout(segs, trailGapPx, p)
    const s = scroll.value
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!
      if (s >= lay.lefts[i]! && s <= lay.lefts[i]! + lay.widths[i]!) {
        const frac = lay.widths[i]! > 0 ? (s - lay.lefts[i]!) / lay.widths[i]! : 0
        return { clipId: seg.id, timeMs: seg.startMs + frac * seg.durMs }
      }
    }
    return { clipId: null, timeMs: 0 }
  }, [segs, trailGapPx, defaultPx, px, scroll])
  useImperativeHandle(ref, () => ({ scrollToTime, getCenter }), [scrollToTime, getCenter])

  // ── report the clip/instant under the centre playhead (only on a CLIP CHANGE — minimal hops) ──
  const reportCenter = useCallback(
    (id: string | null, timeMs: number) => {
      onCenter?.(id, timeMs)
    },
    [onCenter],
  )
  useAnimatedReaction(
    () => scroll.value,
    (s) => {
      const lay = layout.value
      let idx = -1
      for (let i = 0; i < lay.lefts.length; i++) {
        if (s >= lay.lefts[i]! && s <= lay.lefts[i]! + lay.widths[i]!) {
          idx = i
          break
        }
      }
      if (idx === prevCenterIdx.value) return
      prevCenterIdx.value = idx
      if (idx >= 0) {
        const seg = segsSv.value[idx]!
        const frac = lay.widths[idx]! > 0 ? (s - lay.lefts[idx]!) / lay.widths[idx]! : 0
        runOnJS(reportCenter)(seg.id, seg.startMs + frac * seg.durMs)
      } else {
        runOnJS(reportCenter)(null, 0)
      }
    },
  )

  // ── tap-during-pinch guard (Pressables live in the clip blocks) ──
  const [pinching, setPinching] = useState(false)
  const pinchingRef = useRef(false)
  pinchingRef.current = pinching
  const commitPx = useCallback((next: number) => {
    setPxState(next)
  }, [])
  const notifyScrubStart = useCallback(() => onScrubStart?.(), [onScrubStart])
  const notifyScrubEnd = useCallback((id: string | null, timeMs: number) => onScrubEnd?.(id, timeMs), [onScrubEnd])

  // ── gestures (all UI thread) ──
  // Pan = 1-finger horizontal scroll with momentum. Pinch = 2-finger zoom anchored to the centre.
  // maxPointers(1) on the pan + the 2-finger pinch make them naturally exclusive by pointer count,
  // so a pinch never scrolls; activeOffsetX/failOffsetY keep vertical clip-drags + taps free.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .activeOffsetX([-10, 10])
        .failOffsetY([-16, 16])
        .onStart(() => {
          'worklet'
          cancelAnimation(scroll)
          runOnJS(notifyScrubStart)()
        })
        .onChange((e) => {
          'worklet'
          if (twoFingers.value) return // a 2nd finger landed → defer to pinch, stop scrolling
          scroll.value = clampW(scroll.value - e.changeX, 0, layout.value.total)
        })
        .onEnd((e) => {
          'worklet'
          // Precise centre at release → the host resumes playback from exactly here.
          const lay = layout.value
          const s = scroll.value
          let idx = -1
          for (let i = 0; i < lay.lefts.length; i++) {
            if (s >= lay.lefts[i]! && s <= lay.lefts[i]! + lay.widths[i]!) {
              idx = i
              break
            }
          }
          if (idx >= 0) {
            const seg = segsSv.value[idx]!
            const frac = lay.widths[idx]! > 0 ? (s - lay.lefts[idx]!) / lay.widths[idx]! : 0
            runOnJS(notifyScrubEnd)(seg.id, seg.startMs + frac * seg.durMs)
          } else {
            runOnJS(notifyScrubEnd)(null, 0)
          }
          if (twoFingers.value) return // don't fling into a zoom
          scroll.value = withDecay({ velocity: -e.velocityX, clamp: [0, layout.value.total], deceleration: 0.997 })
        }),
    [scroll, layout, segsSv, notifyScrubStart, notifyScrubEnd, twoFingers],
  )

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .withRef(pinchRef)
        .onTouchesDown((e) => {
          'worklet'
          if (e.numberOfTouches >= 2) {
            twoFingers.value = true // the moment a 2nd finger lands — before pinch activates
            cancelAnimation(scroll)
          }
        })
        .onTouchesUp((e) => {
          'worklet'
          if (e.numberOfTouches < 2) twoFingers.value = false
        })
        .onStart(() => {
          'worklet'
          cancelAnimation(scroll)
          runOnJS(setPinching)(true)
          pinchStartPx.value = px.value
          const lay = layout.value
          const s = scroll.value
          let idx = -1
          let frac = 0
          for (let i = 0; i < lay.lefts.length; i++) {
            if (s >= lay.lefts[i]! && s <= lay.lefts[i]! + lay.widths[i]!) {
              idx = i
              frac = lay.widths[i]! > 0 ? (s - lay.lefts[i]!) / lay.widths[i]! : 0
              break
            }
          }
          anchorIdx.value = idx
          anchorFrac.value = frac
          anchorScrollFrac.value = lay.total > 0 ? s / lay.total : 0
        })
        .onUpdate((e) => {
          'worklet'
          const next = clampW(pinchStartPx.value * e.scale, minPxSv.value, maxPxSv.value)
          px.value = next
          // New layout at `next`, computed inline so the anchor uses fresh positions this frame.
          const L = computeLayout(segsSv.value, trailSv.value, next)
          const center = anchorIdx.value >= 0 ? L.lefts[anchorIdx.value]! + anchorFrac.value * L.widths[anchorIdx.value]! : anchorScrollFrac.value * L.total
          scroll.value = clampW(center, 0, L.total)
          // Coarse-step commit → React flips the thumb↔glyph swap (positions stay UI-thread smooth).
          if (lastCommitPx.value <= 0 || Math.abs(next - lastCommitPx.value) / lastCommitPx.value > COMMIT_STEP) {
            lastCommitPx.value = next
            runOnJS(commitPx)(next)
          }
        })
        .onFinalize(() => {
          'worklet'
          twoFingers.value = false
          runOnJS(setPinching)(false)
          runOnJS(commitPx)(px.value)
        }),
    [scroll, layout, px, segsSv, trailSv, minPxSv, maxPxSv, pinchStartPx, anchorIdx, anchorFrac, anchorScrollFrac, lastCommitPx, commitPx, twoFingers],
  )

  const gesture = useMemo(() => Gesture.Simultaneous(panGesture, pinchGesture), [panGesture, pinchGesture])

  // Animated content container: width tracks the zoom; translateX positions the centre playhead
  // (padX − scroll, where padX = viewportW/2). One transform drives the whole timeline's scroll.
  const contentStyle = useAnimatedStyle(() => ({
    width: Math.max(layout.value.total, 1),
    transform: [{ translateX: vpSv.value / 2 - scroll.value }],
  }))

  // Five rows fill the region: ruler + 2 title bands + 2 clip lanes. The lanes split what's left.
  const laneHeight = Math.max(0, (regionH - RULER_H - 2 * TITLE_H) / 2)
  const bufferTop = RULER_H + TITLE_H
  const savedTitleTop = bufferTop + laneHeight
  const savedTop = savedTitleTop + TITLE_H
  const clipH = Math.max(0, laneHeight - 2 * CLIP_INSET_Y)

  const renderLane = (clips: LaneClip[], tone: 'buffered' | 'saved', topPx: number) => (
    <View style={[styles.lane, { top: topPx, height: laneHeight }]}>
      {clips.map((c) => {
        const index = idToIndex[c.id]
        if (index == null) return null
        return (
          <AnimatedClip key={c.id} layout={layout} index={index} clipH={clipH}>
            <ClipBlock
              heightPx={clipH}
              widthPx={Math.max(MIN_CLIP_W, c.endMs > c.startMs ? (c.endMs - c.startMs) * pxState : MIN_CLIP_W)}
              label={c.label}
              sublabel={c.sublabel}
              posterUrl={c.posterUrl}
              tone={tone}
              draft={!!c.draftId}
              selected={selectedId === c.id}
              onSelect={() => !pinchingRef.current && onSelect(c)}
              onOpen={() => !pinchingRef.current && onOpen(c, tone)}
              dragAxis="y"
              dragDir={tone === 'buffered' ? 1 : -1}
              reachPx={clipH}
              onCross={() => (tone === 'buffered' ? onSave(c) : onUnsave(c))}
              yieldToGesture={pinchRef}
              yieldSignal={twoFingers}
            />
          </AnimatedClip>
        )
      })}
    </View>
  )

  const hasAny = segs.length > 0

  return (
    <View style={styles.region} onLayout={(e) => setRegionH(e.nativeEvent.layout.height)}>
      <View style={styles.scrollArea} onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}>
        {!hasAny ? (
          <View style={styles.empty}>
            <Text variant="monoCaption" color={theme.colors.text.muted}>
              No clips yet — go live to start buffering.
            </Text>
          </View>
        ) : (
          <GestureDetector gesture={gesture}>
            <View style={styles.surface}>
              <Animated.View style={[{ height: regionH }, contentStyle]}>
                {/* ruler (clock stamps) */}
                <View style={styles.ruler}>
                  {tickIndices.map((i) => (
                    <AnimatedTick key={i} layout={layout} index={i} label={fmtTick(segs[i]!.startMs)} />
                  ))}
                  <AnimatedTick layout={layout} index={-1} label="now" isNow />
                </View>
                {/* gap markers across both lanes */}
                {gapIndices.map((i) => (
                  <AnimatedGap key={`gap-${i}`} layout={layout} index={i} />
                ))}
                {trailingGap ? <AnimatedGap layout={layout} index={-1} trailing /> : null}
                {/* clip lanes (positioned around the fixed title bands) */}
                {renderLane(buffered, 'buffered', bufferTop)}
                {renderLane(saved, 'saved', savedTop)}
              </Animated.View>
            </View>
          </GestureDetector>
        )}
      </View>

      {/* Fixed centre playhead — a vertical rule pinned to the screen centre, spanning the lanes.
          Rendered before the title bands so it reads as running *under* them. Not draggable. */}
      {hasAny && regionH > 0 && viewportW > 0 ? (
        <View style={[styles.playhead, { left: viewportW / 2 - 1 }]} pointerEvents="none" />
      ) : null}

      {/* Fixed title bands — name each lane + what happens to its content. Don't scroll;
          pointerEvents none so pinch/scroll/drag pass through to the timeline beneath. */}
      {hasAny && regionH > 0 ? (
        <>
          <View style={[styles.titleBand, { top: RULER_H, height: TITLE_H }]} pointerEvents="none">
            <Icon name="film" size="sm" color={theme.colors.text.muted} />
            <Text variant="monoLabel" color={theme.colors.text.primary}>
              Buffer
            </Text>
            <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1} style={styles.titleNote}>
              Not public · reaper clears it
            </Text>
          </View>
          <View style={[styles.titleBand, { top: savedTitleTop, height: TITLE_H }]} pointerEvents="none">
            <Icon name="bookmark" size="sm" color={theme.colors.accent.default} />
            <Text variant="monoLabel" color={theme.colors.accent.default}>
              Saved
            </Text>
            <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1} style={styles.titleNote}>
              Public · reaper-safe
            </Text>
          </View>
        </>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  region: {
    flex: 1,
    backgroundColor: theme.colors.bg.elevated, // the clock + clip lanes read in this tone
  },
  scrollArea: {
    flex: 1,
    overflow: 'hidden',
  },
  surface: {
    flex: 1,
  },
  // Fixed vertical playhead at the screen centre. Full region height; the opaque title bands
  // (rendered after) cover it at their rows, so it reads as running under the titles.
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.accent.default,
  },
  // Fixed full-width title band above each clip lane. Lighter than the lanes, with a hairline
  // above AND below so every row (ruler · buffer · saved) reads as separated.
  titleBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.bg.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
  },
  titleNote: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruler: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: RULER_H,
  },
  tick: {
    position: 'absolute',
    top: 0,
    height: RULER_H,
    justifyContent: 'center', // vertically centre the stamp within the clock lane
    alignItems: 'flex-start',
  },
  tickMark: {
    width: 1,
    height: 6,
    backgroundColor: theme.colors.border.subtle,
  },
  tickMarkNow: {
    backgroundColor: theme.colors.accent.border,
  },
  gapBand: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapRule: {
    width: 0,
    flex: 1,
    borderLeftWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderStyle: 'dashed',
  },
  lane: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  slot: {
    position: 'absolute',
  },
})
