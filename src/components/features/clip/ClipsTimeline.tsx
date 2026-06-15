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

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { ClipBlock } from './ClipBlock'
import { type LaneClip } from './ClipLane'

const RULER_H = 22
const TITLE_H = 22 // fixed title band above each clip lane (name + reaper/time-machine note)
const CLIP_INSET_Y = 4 // breathing room between a clip block and the top/bottom of its lane
const MIN_CLIP_W = 26 // a short clip stays a tappable block
const GAP_W = 22 // collapsed (fixed-width) gap marker — the playhead glides across these pixels
const EDGE_EPS = 3 // px proximity that counts as "at" the now edge (for the clock's NOW/THEN state)
const EDGE_SNAP = 12 // px "within reach" of a frontier → the playhead snaps and sticks to it (now OR reaper)
const GAP_THRESHOLD_MS = 500 // unbroadcasted time longer than this is a traversable gap; below = a snip
const GAP_RUSH_MS = 3000 // a gap is consumed in this fixed real-time (mirrors the transport playhead's rush)
const LONGEST_DEFAULT_W = 50 // default zoom: the longest clip ≈ this wide (lower = wider/zoomed-out initial view)
const MAX_PX_PER_MS = 0.2
const TICK_MIN_GAP = 48 // hide a ruler stamp whose neighbour is closer than this (px)
const COMMIT_STEP = 0.18 // re-commit px to React (→ thumb/glyph swap) every ~18% zoom change
const REAPER_RED = '#D7263D' // the reaper edge eating BUFFER footage (no red semantic token exists)
const REAPER_SAVE = '#111111' // the reaper edge passing a SAVED clip (protected — black, save icon)

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
type Layout = { lefts: number[]; widths: number[]; total: number; leadGapPx: number }

// Cumulative layout at a given zoom. `leadGapPx` is a fixed gap BEFORE the oldest clip (the reaper
// edge's leading gap, when the buffer isn't full); `trailGapPx` is the one AFTER the newest (→ now).
// Tagged `worklet` so it runs on the UI thread inside the derived value + gestures; also runs fine
// on the JS thread (scrollToTime).
function computeLayout(segs: Seg[], leadGapPx: number, trailGapPx: number, px: number): Layout {
  'worklet'
  const lefts: number[] = []
  const widths: number[] = []
  let cursor = leadGapPx
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!
    cursor += s.gapPx
    const w = Math.max(MIN_CLIP_W, s.durMs * px)
    lefts.push(cursor)
    widths.push(w)
    cursor += w
  }
  cursor += trailGapPx
  return { lefts, widths, total: cursor, leadGapPx }
}
function clampW(v: number, lo: number, hi: number) {
  'worklet'
  return Math.max(lo, Math.min(hi, v))
}

// Extend the LIVE (open) session's segment to the smooth nowUI clock, so the now edge + the live
// block grow per-frame (a smooth realtime build) instead of stepping on the 15s server refetch. Only
// the live seg's duration changes — never its start, never any other seg — so older footage and the
// reaper edge are untouched. `dur` can only grow (max with the server duration), so the build is
// monotonic. Worklet-tagged (runs in the frame loop + JS).
function extendLive(base: Seg[], liveIdx: number, nowUiMs: number): Seg[] {
  'worklet'
  if (liveIdx < 0 || liveIdx >= base.length) return base
  const s = base[liveIdx]!
  const dur = Math.max(s.durMs, nowUiMs - s.startMs)
  if (dur === s.durMs) return base
  const out = base.slice()
  out[liveIdx] = { ...s, durMs: dur }
  return out
}

// ── continuous time ⇄ x mapping (interpolates LINEARLY across gap pixels) ──
// This is what makes a gap traversable: a wall-clock instant inside a gap maps to a proportional
// x within the fixed gap-marker pixels (and back), so the playhead glides across a gap rather
// than snapping to the next clip — for both scrub and the play-over-gap rush. (Ported from the
// editor's BufferTimeline.) Worklet-tagged → runs on the UI thread + the JS thread.
function timeToX(ms: number, segs: Seg[], lay: Layout, nowMs: number, leadFromMs: number): number {
  'worklet'
  if (!segs.length) return 0
  const firstStart = segs[0]!.startMs
  // Leading gap [leadFromMs, firstStart] → pixels [0, leadGapPx] (mirror of the trailing gap).
  if (lay.leadGapPx > 0 && ms < firstStart) {
    if (ms <= leadFromMs) return 0
    const f = (ms - leadFromMs) / Math.max(1, firstStart - leadFromMs)
    return f * lay.leadGapPx
  }
  if (ms <= firstStart) return lay.lefts[0]!
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!
    const left = lay.lefts[i]!
    const width = lay.widths[i]!
    if (i > 0 && seg.gapPx > 0) {
      const prevEnd = segs[i - 1]!.startMs + segs[i - 1]!.durMs
      if (ms > prevEnd && ms < seg.startMs) {
        const f = (ms - prevEnd) / Math.max(1, seg.startMs - prevEnd)
        return left - seg.gapPx + f * seg.gapPx
      }
    }
    if (ms >= seg.startMs && ms <= seg.startMs + seg.durMs) {
      const f = seg.durMs > 0 ? (ms - seg.startMs) / seg.durMs : 0
      return left + f * width
    }
  }
  const li = segs.length - 1
  const lastEnd = segs[li]!.startMs + segs[li]!.durMs
  const lastRight = lay.lefts[li]! + lay.widths[li]!
  if (ms > lastEnd && lay.total > lastRight) {
    const f = Math.min(1, (ms - lastEnd) / Math.max(1, nowMs - lastEnd))
    return lastRight + f * (lay.total - lastRight)
  }
  return lastRight
}
// x → { clip under it (null in a gap), the interpolated wall-clock instant, inGap }.
function resolveAt(x: number, segs: Seg[], lay: Layout, nowMs: number, leadFromMs: number): { clipId: string | null; timeMs: number; inGap: boolean } {
  'worklet'
  if (!segs.length) return { clipId: null, timeMs: 0, inGap: false }
  // Leading gap: x in [0, leadGapPx] → wall-clock [leadFromMs, firstStart], reported as a gap.
  if (lay.leadGapPx > 0 && x < lay.lefts[0]!) {
    const f = Math.max(0, x) / lay.leadGapPx
    return { clipId: null, timeMs: leadFromMs + f * (segs[0]!.startMs - leadFromMs), inGap: true }
  }
  if (x <= lay.lefts[0]!) return { clipId: segs[0]!.id, timeMs: segs[0]!.startMs, inGap: false }
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!
    const left = lay.lefts[i]!
    const width = lay.widths[i]!
    if (i > 0 && seg.gapPx > 0) {
      const gapLeft = left - seg.gapPx
      if (x >= gapLeft && x < left) {
        const prevEnd = segs[i - 1]!.startMs + segs[i - 1]!.durMs
        const f = (x - gapLeft) / seg.gapPx
        return { clipId: null, timeMs: prevEnd + f * (seg.startMs - prevEnd), inGap: true }
      }
    }
    if (x >= left && x <= left + width) {
      const f = width > 0 ? (x - left) / width : 0
      return { clipId: seg.id, timeMs: seg.startMs + f * seg.durMs, inGap: false }
    }
  }
  const li = segs.length - 1
  const lastEnd = segs[li]!.startMs + segs[li]!.durMs
  const lastRight = lay.lefts[li]! + lay.widths[li]!
  if (x > lastRight && lay.total > lastRight) {
    const f = Math.min(1, (x - lastRight) / (lay.total - lastRight))
    return { clipId: null, timeMs: lastEnd + f * (nowMs - lastEnd), inGap: true }
  }
  return { clipId: null, timeMs: lastEnd, inGap: true }
}

// ── the reaper frontier's content-x (gap-rush mapping) ──
// Where the eviction boundary `B` (= now − window) sits in pixels. Footage is consumed at 1× —
// linear in the clip, exactly like timeToX. A GAP, instead of being crossed time-linearly (which
// makes the frontier crawl across the collapsed gap pixels for the gap's whole real duration), is
// consumed in the FINAL GAP_RUSH_MS before the footage on its FAR side begins evicting: the frontier
// parks at the just-eaten edge through the gap's long empty span, then rushes the collapsed pixels in
// the last 3s, landing on the next clip exactly as it ages out. This mirrors the transport playhead's
// fixed-duration gap rush (see timeToX vs the host clock), but stays pinned to the REAL boundary so it
// never reports footage gone before it is. Leading, interior, and trailing gaps all obey it.
function reaperEdgeX(B: number, segs: Seg[], lay: Layout, nowMs: number, leadFromMs: number): number {
  'worklet'
  if (!segs.length) return 0
  const firstStart = segs[0]!.startMs
  // Leading gap [leadFromMs, firstStart] → pixels [0, leadGapPx]; rush the last GAP_RUSH_MS.
  if (lay.leadGapPx > 0 && B < firstStart) {
    if (B <= firstStart - GAP_RUSH_MS) return 0
    return clampW((B - (firstStart - GAP_RUSH_MS)) / GAP_RUSH_MS, 0, 1) * lay.leadGapPx
  }
  if (B <= firstStart) return lay.lefts[0]!
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!
    const left = lay.lefts[i]!
    const width = lay.widths[i]!
    // interior gap before this clip → park at the previous clip's tail, rush the last GAP_RUSH_MS.
    if (i > 0 && seg.gapPx > 0) {
      const prevEnd = segs[i - 1]!.startMs + segs[i - 1]!.durMs
      if (B > prevEnd && B < seg.startMs) {
        const gapLeft = left - seg.gapPx
        if (B <= seg.startMs - GAP_RUSH_MS) return gapLeft
        return gapLeft + clampW((B - (seg.startMs - GAP_RUSH_MS)) / GAP_RUSH_MS, 0, 1) * seg.gapPx
      }
    }
    // footage → 1× (linear in the clip)
    if (B >= seg.startMs && B <= seg.startMs + seg.durMs) {
      const f = seg.durMs > 0 ? (B - seg.startMs) / seg.durMs : 0
      return left + f * width
    }
  }
  // trailing gap [lastEnd, nowMs] → [lastRight, total]; rush the last GAP_RUSH_MS before now.
  const li = segs.length - 1
  const lastEnd = segs[li]!.startMs + segs[li]!.durMs
  const lastRight = lay.lefts[li]! + lay.widths[li]!
  if (B > lastEnd && lay.total > lastRight) {
    if (B <= nowMs - GAP_RUSH_MS) return lastRight
    return lastRight + clampW((B - (nowMs - GAP_RUSH_MS)) / GAP_RUSH_MS, 0, 1) * (lay.total - lastRight)
  }
  return lastRight
}

type Props = {
  buffered: LaneClip[]
  saved: LaneClip[]
  nowMs: number
  // The open (still-recording) session id, or null. Its segment BUILDS smoothly to the timeline's own
  // UI clock (nowUI) instead of stepping on the server refetch — so the live clip + the now edge grow
  // per-frame, riding the SAME clock as the reaper edge (both edges, one clock).
  liveSessionId?: string | null
  // True while playback is driving the scroll → suspends the reaper riding-latch so it can't grab the
  // scroll out from under the playhead (the same grab/release jumpiness a drag causes).
  playing?: boolean
  // True when the host is following the NOW edge (clock reads NOW). Pins scroll to the now edge so the
  // playhead STICKS to it as the live build grows it — the now-edge analog of riding the reaper edge.
  followNow?: boolean
  // Suppress the reaper riding-latch (and release any active ride) — e.g. while the host is wheeling
  // the CLOCK, so the playhead can be moved forward OFF the reaper edge without the latch re-pinning it.
  suppressRide?: boolean
  // Continuous report of whether the centre is RIDING the reaper edge (the timeline's autonomous
  // `ridingSv`). The host mirrors this into its reaper-clock + transport state so they never desync
  // (an autonomous catch-up, or a clock-wheel landing on the edge, both update it).
  onRidingChange?: (riding: boolean) => void
  // Which lane the oldest (being-reaped) clip is in → buffer = red sickle, saved = black save icon.
  reaperLane?: 'buffered' | 'saved'
  // The reaper boundary (now − window) in wall-clock + the window length. The timeline advances the
  // boundary every FRAME (anchored to these) so the reaper mask + edge consume the oldest clip as
  // smoothly as the playhead plays. null/0 → no windowing.
  reaperEdgeMs?: number | null
  windowMs?: number
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
  // clip/instant under the centre playhead; `inGap` = the playhead is over unbroadcasted time.
  onCenter?: (clipId: string | null, timeMs: number, inGap: boolean) => void
}

// Imperative handle so the host can drive the scroll from playback — bring a time instant under
// the fixed centre playhead (reposition on play, then follow frame-by-frame as it plays) — and
// read back the clip + instant currently under the playhead (for the scissor cut).
export type ClipsTimelineHandle = {
  scrollToTime: (ms: number, animated?: boolean) => void
  getCenter: () => { clipId: string | null; timeMs: number; pxPerMs: number; inGap: boolean; atNow: boolean; atReaper: boolean }
  // Feed the continuous UI clock from the host's JS requestAnimationFrame loop. The reanimated
  // frame-callback clock (frame.timeSinceFirstFrame) STALLS during video playback (heavy main-thread
  // work), so reaperNowSv froze between 1 s re-anchors → the live build stepped 1 s at a time. The JS
  // RAF clock stays smooth (it drives scroll fine during play), so we feed it in and take the monotonic
  // max of both clocks: JS wins during playback, the frame callback wins if the RAF isn't running.
  setNowUi: (ms: number) => void
  // Snap + stick the centre to the reaper edge (no sliver) and latch the ride — the reaper's analog of
  // the now-edge follow. The host calls it when a drag settles within reach of the reaper.
  snapToReaper: () => void
}

// ── animated leaf nodes (each reads the shared `layout` on the UI thread) ──
function AnimatedClip({
  layout,
  index,
  clipH,
  reaperEdgeX,
  children,
}: {
  layout: SharedValue<Layout>
  index: number
  clipH: number
  reaperEdgeX: SharedValue<number>
  children: React.ReactNode
}) {
  // The clip geometry SHRINKS FROM THE LEFT as the reaper consumes it (and GROWS FROM THE RIGHT via the
  // live build) — symmetric with the now edge. Clamp the left edge to the reaper boundary: the oldest
  // clip then stops at reaperEdgeX and renders its OWN rounded-left corner + border there (just like the
  // now edge shows the rounded-right corner), instead of being flat-cropped by the dark void. A
  // fully-reaped clip collapses to width 0; reaperEdgeX is 0 when windowing is off, so this is a no-op there.
  const style = useAnimatedStyle(() => {
    const l0 = layout.value.lefts[index] ?? 0
    const w0 = layout.value.widths[index] ?? MIN_CLIP_W
    const left = Math.max(l0, reaperEdgeX.value)
    return { left, width: Math.max(0, l0 + w0 - left) }
  })
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

function AnimatedGap({ layout, index, trailing, leading }: { layout: SharedValue<Layout>; index: number; trailing?: boolean; leading?: boolean }) {
  // A full gap occupies [left-GAP_W, left] before clip `index`; trailing = the last GAP_W; leading =
  // the first GAP_W (the reaper edge's room-before-footage).
  const style = useAnimatedStyle(() => ({
    left: leading ? 0 : trailing ? layout.value.total - GAP_W : (layout.value.lefts[index] ?? 0) - GAP_W,
  }))
  return (
    <Animated.View style={[styles.gapBand, { width: GAP_W, top: RULER_H, bottom: 0 }, style]}>
      <View style={styles.gapRule} />
    </Animated.View>
  )
}

// The reaper edge — ONE vertical rule spanning the WHOLE timeline (ruler + both lanes) at the
// reaper boundary's content-x, so the time/buffer/saved rows move as one (it reads under the fixed
// title bands, like the centre playhead). Only the BADGE sits in the lane whose footage is being
// consumed — buffer → red sickle, saved → black save. Because the rule is full-height, a buffer→
// saved transition just recolours it + slides the badge; the rule never teleports between lanes.
function AnimatedReaperEdge({ edgeX, top, height, badgeTop, kind }: { edgeX: SharedValue<number>; top: number; height: number; badgeTop: number; kind: 'reap' | 'save' }) {
  // Ride the reaper boundary's content-x (advanced each frame) → the rule + badge creep across the
  // clip as smoothly as the playhead. Centre the GAP_W-wide column on it. Hidden until the frontier
  // has actually consumed something (edgeX > 0) — so during a long pre-reap countdown, when it's
  // parked at the very oldest start, nothing shows (the host's countdown card speaks instead).
  const style = useAnimatedStyle(() => ({ left: edgeX.value - GAP_W / 2, opacity: edgeX.value > 0.5 ? 1 : 0 }))
  const color = kind === 'reap' ? REAPER_RED : REAPER_SAVE
  return (
    <Animated.View style={[styles.reaperEdge, { top, height }, style]} pointerEvents="none">
      <View style={[styles.reaperRule, { backgroundColor: color }]} />
      <View style={[styles.reaperBadge, { backgroundColor: color, top: badgeTop }]}>
        <MaterialCommunityIcons name={kind === 'reap' ? 'sickle' : 'content-save'} size={14} color={theme.colors.bg.primary} />
      </View>
    </Animated.View>
  )
}

export const ClipsTimeline = forwardRef<ClipsTimelineHandle, Props>(function ClipsTimeline(
  { buffered, saved, nowMs, liveSessionId, playing = false, followNow = false, suppressRide = false, reaperLane = 'buffered', reaperEdgeMs, windowMs = 0, selectedId, onSelect, onOpen, onSave, onUnsave, onScrubStart, onScrubEnd, onCenter, onRidingChange }: Props,
  ref,
) {
  // Combined set drives the shared axis (buffer + saved don't overlap → one timeline). Sorted
  // oldest→newest with gap-before widths; each clip gets a stable index into the layout arrays.
  // `liveIdx` = the live tail seg (the one that builds to nowUI).
  const { segs, trailGapPx, idToIndex, tickIndices, gapIndices, trailingGap, liveIdx } = useMemo(() => {
    // The live tail = the BUFFERED clip of the open session that REACHES the live edge (the newest
    // footage end across both lanes) — the only piece that grows to nowUI. Matching by session alone
    // also caught saved/pending-save/draft/remainder pieces and grew them ("the saved copy keeps
    // extending"); matching the buffered *max-end* alone caught the remainder LEFT BEHIND when the tail
    // is dragged to save (the saved copy then holds the edge), growing a bogus copy over the saved
    // range. So require the candidate to reach the global newest end: if the tail was saved, no buffer
    // clip reaches it → nothing extends (until new footage forms a fresh tail).
    let liveTailId: string | null = null
    if (liveSessionId) {
      let newest = -Infinity
      for (const c of buffered) if (c.endMs > newest) newest = c.endMs
      for (const c of saved) if (c.endMs > newest) newest = c.endMs
      for (const c of buffered) {
        if (c.sourceSessionId === liveSessionId && !c.draftId && c.endMs >= newest - 2) {
          liveTailId = c.id
          break
        }
      }
    }
    const all = [...buffered, ...saved]
      .filter((c) => Number.isFinite(c.startMs) && Number.isFinite(c.endMs) && c.endMs >= c.startMs)
      .sort((a, b) => a.startMs - b.startMs)
    const out: Seg[] = []
    const idx: Record<string, number> = {}
    const gaps: number[] = []
    let live = -1
    let prevEnd: number | null = null
    for (const c of all) {
      // Snip (contiguous footage) → touching, no marker. Real unbroadcasted-time gap → a fixed
      // traversable marker.
      let gapPx = 0
      if (prevEnd != null && c.startMs - prevEnd > GAP_THRESHOLD_MS) gapPx = GAP_W
      if (gapPx > 0) gaps.push(out.length)
      if (c.id === liveTailId) live = out.length // only the growing buffer tail extends
      idx[c.id] = out.length
      out.push({ id: c.id, startMs: c.startMs, durMs: c.endMs - c.startMs, gapPx })
      prevEnd = prevEnd == null ? c.endMs : Math.max(prevEnd, c.endMs)
    }
    // No trailing gap while broadcasting — the live seg builds all the way to nowUI, so there's no
    // empty span between the newest footage and now. The instant broadcast STOPS (liveSessionId →
    // null) the gap forms (north-star #2). Deliberately keyed off liveSessionId ALONE, NOT `nowMs`:
    // depending on the 1 s clock here rebuilt `segs` (and re-ran the layout effect's scroll re-pin)
    // every second, which fought the per-frame play/reaper loops — the per-second jump. The footage
    // geometry must change only when the FOOTAGE changes, never merely because a second passed.
    const trailing = !liveSessionId && prevEnd != null
    return { segs: out, trailGapPx: trailing ? GAP_W : 0, idToIndex: idx, tickIndices: out.map((_, i) => i), gapIndices: gaps, trailingGap: trailing, liveIdx: live }
  }, [buffered, saved, liveSessionId])

  // Leading gap: a FIXED GAP_W marker before the oldest clip, present whenever windowing is active —
  // and crucially NEVER removed (removing it when reaping starts was the 22px snap that bounced:
  // total 194→172, a layout shift no scroll value can hide). Instead the gap stays put and the reaper
  // MASK sweeps across it (rushing the final GAP_RUSH_MS) and then on into the clip. The oldest
  // clip's content position is constant, so there's no layout shift → no bounce. Visually: while
  // there's still time before the oldest footage the gap reads as a light band ("room"); once the
  // mask reaches it, it reads as reaped void — a continuous transition, no pop. So the user always
  // sees a gap between the reaper and the oldest clip while time remains.
  const firstStartMs = segs[0]?.startMs ?? 0
  const hasLeadGap = reaperEdgeMs != null && segs.length > 0
  const leadGapPx = hasLeadGap ? GAP_W : 0
  // Scrub/centre mapping floor: the boundary while there's room, clamped to the clip start once
  // reaping (no scrubbable room left of the footage).
  const leadFromMs = hasLeadGap ? Math.min(reaperEdgeMs!, firstStartMs) : firstStartMs
  // The frontier (mask + edge) is mounted whenever windowing is active; it self-hides (0-width mask,
  // opacity-0 edge) until it has actually consumed something, so it only appears as it engages.
  const showReaperFrontier = reaperEdgeMs != null && segs.length > 0

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
  // segsSv = the EXTENDED segs (live seg built to nowUI), the one everything renders from. baseSegsSv
  // holds the raw server segs; the frame loop derives segsSv = extendLive(base, liveIdx, nowUI) each
  // frame so the live build is smooth. (When not broadcasting, liveIdx < 0 and segsSv == base.)
  const segsSv = useSharedValue<Seg[]>(segs)
  const baseSegsSv = useSharedValue<Seg[]>(segs)
  const liveIdxSv = useSharedValue(liveIdx)
  const trailSv = useSharedValue(trailGapPx)
  const leadSv = useSharedValue(leadGapPx)
  const leadFromSv = useSharedValue(leadFromMs)
  const nowSv = useSharedValue(nowMs)
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
  // ── reaper boundary, advanced EVERY FRAME (so the mask/edge consume the oldest clip smoothly) ──
  // Anchored to the JS reaper edge (`reaperEdgeMs`, re-synced on the slow tick) + the frame delta.
  const reaperNowSv = useSharedValue(0) // the universal wall clock (serverNow), pushed by setNowUi
  const windowMsSv = useSharedValue(0)
  const reaperOnSv = useSharedValue(0) // 1 when windowing is active (reaperEdgeMs present)
  // 1 while the centre is RIDING the reaper edge (parked at it) — sticky across clip-drops. While
  // riding, the frame-lock is the SOLE scroll authority and tracks the edge EXACTLY (up and down) so
  // a layout shift (a clip leaving the set) slides scroll with the edge → no bounce. Released when
  // the user scrolls away toward newer footage.
  const ridingSv = useSharedValue(0)
  // 1 while a pan or playback is ACTIVELY driving the scroll. The riding latch/pin is suspended then
  // — otherwise the lock grabs the scroll mid-drag (pin to centre → ignore the drag), releases when
  // the drag exceeds the threshold (scroll jumps free), and re-grabs on the way back: a latch/release
  // cycle that reads as the reaper line jumping. While suspended the edge still advances via
  // reaperEdgeXSv (renders at its content position, moving with scroll + consumption — smooth).
  const panningSv = useSharedValue(0)
  const playingSv = useSharedValue(0)
  const followNowSv = useSharedValue(0) // 1 while pinning scroll to the now edge (host followLive)
  const suppressRideSv = useSharedValue(0) // 1 while the host suppresses the reaper latch (clock wheel)
  // Cumulative pixel layout at the live zoom (UI thread). Declared before the frame callback so the
  // worklet below can read it (reanimated captures closure refs at definition time).
  const layout = useDerivedValue(() => computeLayout(segsSv.value, leadSv.value, trailSv.value, px.value))
  useFrameCallback(() => {
    'worklet'
    if (!reaperOnSv.value) return
    // SINGLE CLOCK (CONTENT.md §6): reaperNowSv IS the universal wall clock (serverNow), pushed every
    // JS frame by the host's setNowUi. The frame callback no longer keeps its OWN time — the retired
    // frame-timer accumulator (timeSinceFirstFrame) was a second clock that STALLED during video
    // playback AND let the edges run ahead of the (JS-clock) playhead during a JS hitch. Now the edges,
    // the live build, and the playhead all ride the one serverNow clock and stall/resume together.
    // nowSv mirrors it for every mapping (reaper edge, trailing-gap, scrollToTime, getCenter, gestures).
    nowSv.value = reaperNowSv.value
    // Live build: grow the open session's seg to nowUI each frame (smooth) — same clock as the edge.
    if (liveIdxSv.value >= 0) segsSv.value = extendLive(baseSegsSv.value, liveIdxSv.value, reaperNowSv.value)
    // ── invariant: the reaper edge never passes the centre playhead ──
    // The edge's content-x at this frame (the boundary now − window, via the gap-rush mapping):
    const edgeX = reaperEdgeX(reaperNowSv.value - windowMsSv.value, segsSv.value, layout.value, nowSv.value, leadFromSv.value)
    const total = layout.value.total
    if (ridingSv.value) {
      // Riding the edge → lock scroll TO it EXACTLY (up AND down). This is the key to no-bounce: when
      // a clip leaves the set the layout's x=0 shifts and `edgeX` jumps (e.g. to 0); scroll follows it
      // down in the same breath, so the edge stays pinned at centre and the mask stays exactly at
      // centre — the dropped clip's reaped pixels are simply replaced by the void, nothing reappears.
      // The now edge is pulled toward centre as footage is eaten, until the window is fully evicted.
      scroll.value = Math.min(edgeX, total)
    } else if (followNowSv.value && !panningSv.value && !twoFingers.value) {
      // Following the NOW edge → stick scroll to it as the live build grows `total` (the now-edge
      // analog of riding). Suspended during a pan/pinch so a drag can leave the edge.
      scroll.value = total
    } else if (!panningSv.value && !playingSv.value && !suppressRideSv.value && scroll.value <= edgeX + 1.5) {
      // Scroll SETTLED at the edge while idle (button-1, or scrubbed left into it) → snap on + LATCH.
      // Suspended during an active pan/playback so the lock can't grab the scroll mid-gesture (that
      // grab/release cycle was the jumpiness). Floors the scroll: a left-scroll can't enter the void.
      cancelAnimation(scroll)
      scroll.value = Math.min(edgeX, total)
      ridingSv.value = 1
    }
    // Hard floor (every frame): scroll can never sit LEFT of the reaper edge — the eviction boundary
    // is the floor. The pan only re-floors on change events, but the edge advances each frame, so a
    // held drag at the edge would otherwise fall behind it ("drag a little further past the reaper").
    // followNow pins to the now edge (always right of this); riding already sits at the edge. This only
    // pushes forward (never left), so a forward wheel/scrub off the edge is unaffected.
    if (!followNowSv.value && scroll.value < edgeX) scroll.value = edgeX
  })
  // The reaper boundary's CONTENT-x (where the mask ends + the edge sits), advanced each frame —
  // via the gap-rush mapping (footage 1×, gaps consumed in a fixed GAP_RUSH_MS).
  const reaperEdgeXSv = useDerivedValue(() => {
    if (!reaperOnSv.value) return 0
    return reaperEdgeX(reaperNowSv.value - windowMsSv.value, segsSv.value, layout.value, nowSv.value, leadFromSv.value)
  })

  // Re-anchor the frame clock whenever the JS reaper edge resyncs (the slow now tick). The frame
  // loop runs whenever windowing is active (a buffer window exists) — not only once a clip is being
  // eaten — so the LEADING gap can rush in its final 3s BEFORE the first clip starts evicting. The
  // frontier is invisible (0-width mask, hidden edge) while parked far from any footage, so this
  // costs one timeToX-class compare per frame and nothing visual until it engages.
  useEffect(() => {
    if (reaperEdgeMs == null) {
      reaperOnSv.value = 0
      ridingSv.value = 0
      return
    }
    reaperOnSv.value = 1
    windowMsSv.value = windowMs
    // Bootstrap / monotonic floor from the 1s server-read (`reaperEdgeMs + windowMs` is the host's
    // server-aligned nowMs): ensures reaperNowSv has a sane value before setNowUi's first push and
    // never sits at 0. setNowUi (continuous serverNow — the SAME clock, just per-frame) dominates;
    // this is only the floor. Forward-only, so a backward resync never retreats the edge.
    reaperNowSv.value = Math.max(reaperNowSv.value, reaperEdgeMs + windowMs)
  }, [reaperEdgeMs, windowMs, reaperOnSv, ridingSv, windowMsSv, reaperNowSv])

  // Keep the worklet inputs in sync with the JS-side precompute / measurements — AND preserve the
  // wall-clock instant under the centre playhead across the change. The timeline lays out by pixels;
  // when the footage set changes (a reaper drop, a 15s refetch, a save/un-save) the layout shifts,
  // and without re-pinning the content would slide under the fixed playhead — footage popping in/out.
  // So: capture the centre's instant in the OLD layout, apply the new inputs, then re-pin scroll to
  // the SAME instant in the NEW layout.
  //
  // Two deliberate details:
  //  • useLAYOUTeffect, not useEffect — so segsSv (and the derived `layout`) update SYNCHRONOUSLY with
  //    the React render that re-keyed the clip blocks. A plain effect runs after paint, leaving one
  //    frame where new clip blocks are positioned against the OLD layout → the bounce.
  //  • While RIDING the reaper edge, skip the scroll re-pin entirely — the frame-lock owns scroll then
  //    and tracks the edge via reaperEdgeX (the rush mapping). Re-pinning here would use the LINEAR
  //    timeToX, which disagrees with the rush mapping across a gap and would fight the lock.
  const prevLayoutInputs = useRef<{ segs: Seg[]; lead: number; trail: number; leadFrom: number; now: number } | null>(null)
  useLayoutEffect(() => {
    const p = px.value || defaultPx
    const prev = prevLayoutInputs.current
    // The "now" reference for all mappings is the CONTINUOUS UI-thread clock (reaperNowSv), never the
    // 1 s `nowMs` state — so a reconcile uses the same clock the per-frame loops use (no 1 s seam).
    const nowUi = reaperNowSv.value || nowMs
    // Capture the centre's instant in the OLD layout BEFORE swapping segs (linear center-preserve).
    // SKIP the scroll re-pin while RIDING the reaper edge, FOLLOWING the now edge, OR PLAYING — those
    // frontiers own scroll on the frame/RAF loop; re-pinning here once a second fought them. For the now
    // edge it re-pinned to the BASE (1s-stepped) total while the loop pins the CONTINUOUS (extended)
    // total → the per-second sawtooth jitter the reaper ride never had (its anchor is the unchanging
    // oldest end). The now-edge branch below re-pins to the EXTENDED total instead, atomically.
    const repin = !!prev && p > 0 && prev.segs.length > 0 && !ridingSv.value && !playingSv.value && !followNowSv.value
    let centerTime = 0
    if (repin) {
      const oldLay = computeLayout(prev!.segs, prev!.lead, prev!.trail, p)
      centerTime = resolveAt(scroll.value, prev!.segs, oldLay, prev!.now, prev!.leadFrom).timeMs
    }
    // Publish the raw server segs as the base + the live index, then the EXTENDED segs (live seg built
    // to nowUI) as what everything renders from. The frame loop keeps segsSv growing per-frame; this
    // sets it synchronously on a data change so JS reads right after are already current.
    const extended = extendLive(segs, liveIdx, reaperNowSv.value)
    baseSegsSv.value = segs
    liveIdxSv.value = liveIdx
    segsSv.value = extended
    trailSv.value = trailGapPx
    leadSv.value = leadGapPx
    leadFromSv.value = leadFromMs
    nowSv.value = nowUi
    if (p > 0) {
      const newLay = computeLayout(segs, leadGapPx, trailGapPx, p)
      if (ridingSv.value) {
        // Riding → re-pin scroll to the reaper edge in the NEW layout (the SAME rush mapping the
        // frame-lock uses), ATOMICALLY with segs, so a clip-drop is seamless with zero stale frames.
        const B = reaperNowSv.value - windowMs
        scroll.value = clamp(reaperEdgeX(B, segs, newLay, nowUi, leadFromMs), 0, newLay.total)
      } else if (followNowSv.value) {
        // Following the now edge → pin to the CONTINUOUS (extended) total, atomically with segs. Using
        // the extended layout (not the base `newLay`) is what removes the per-second snap-back jitter.
        scroll.value = computeLayout(extended, leadGapPx, trailGapPx, p).total
      } else if (repin) {
        scroll.value = clamp(timeToX(centerTime, segs, newLay, nowUi, leadFromMs), 0, newLay.total)
      }
    }
    prevLayoutInputs.current = { segs, lead: leadGapPx, trail: trailGapPx, leadFrom: leadFromMs, now: nowUi }
    // NOTE: `nowMs` is deliberately NOT a dependency — the effect must fire only when the FOOTAGE
    // geometry changes (data/refetch/drop/save), never once a second. Time progression is the frame
    // loop's job (the continuous clock); a per-second reconcile here was the jump.
  }, [segs, liveIdx, trailGapPx, leadGapPx, leadFromMs, windowMs, segsSv, baseSegsSv, liveIdxSv, trailSv, leadSv, leadFromSv, nowSv, px, scroll, defaultPx, ridingSv, playingSv, followNowSv, reaperNowSv, vpSv])
  useEffect(() => {
    minPxSv.value = minPx
    maxPxSv.value = maxPx
  }, [minPx, maxPx, minPxSv, maxPxSv])
  useEffect(() => {
    vpSv.value = viewportW
  }, [viewportW, vpSv])
  // Playback drives the scroll → suspend the reaper riding-latch (and release any active ride) so the
  // lock can't grab the scroll out from under the playhead.
  useEffect(() => {
    playingSv.value = playing ? 1 : 0
    if (playing) ridingSv.value = 0
  }, [playing, playingSv, ridingSv])
  // Follow the now edge (host followLive) → pin scroll to it (the frame callback does the per-frame
  // stick). Releasing the reaper ride so the two edge-follows don't fight.
  useEffect(() => {
    followNowSv.value = followNow ? 1 : 0
    if (followNow) ridingSv.value = 0
  }, [followNow, followNowSv, ridingSv])
  // Clock-wheel (or any host scrub of the clock) → suppress the reaper latch + release any active ride
  // so the playhead can move forward off the edge without being re-pinned.
  useEffect(() => {
    suppressRideSv.value = suppressRide ? 1 : 0
    if (suppressRide) ridingSv.value = 0
  }, [suppressRide, suppressRideSv, ridingSv])
  // Continuous mirror of the riding state → host (so the reaper clock + transport icon never desync).
  const notifyRiding = useCallback((r: number) => onRidingChange?.(r === 1), [onRidingChange])
  useAnimatedReaction(
    () => ridingSv.value,
    (r, prev) => {
      if (prev != null && r !== prev) runOnJS(notifyRiding)(r)
    },
  )

  // Seed the zoom + land with "now" centred, once, when the viewport + first content are known.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || defaultPx <= 0 || viewportW <= 0) return
    seeded.current = true
    px.value = defaultPx
    lastCommitPx.value = defaultPx
    setPxState(defaultPx)
    scroll.value = computeLayout(segs, leadGapPx, trailGapPx, defaultPx).total // now under the centre
  }, [defaultPx, viewportW, segs, leadGapPx, trailGapPx, px, scroll, lastCommitPx])

  // ── imperative: bring a time instant under the centre playhead (playback reposition + follow) ──
  // Maps via timeToX → glides across gap pixels (so the rush + scroll-to-time traverse a gap).
  // NB getCenter/scrollToTime read the SHARED (extended) values — segsSv (live tail built to nowUI),
  // leadSv/trailSv/nowSv/leadFromSv — so they agree with what's rendered. Using the server `segs`
  // here put the "now edge" at the server media end while the rendered edge sat at nowUI, so the
  // clock never registered NOW and goNow under-scrolled.
  const scrollToTime = useCallback(
    (ms: number, animated = false) => {
      const p = px.value || defaultPx
      if (p <= 0) return
      const sgs = segsSv.value
      const lay = computeLayout(sgs, leadSv.value, trailSv.value, p)
      const target = clamp(timeToX(ms, sgs, lay, nowSv.value, leadFromSv.value), 0, lay.total)
      // A host-driven move (playback follow, nav, dial) to a non-edge instant releases the reaper
      // ride, so the frame-lock stops pinning scroll to the edge and lets playback scroll forward.
      // Moving TO the edge (transport button-1) leaves it to re-latch via the frame-lock.
      if (target > reaperEdgeXSv.value + 8) ridingSv.value = 0
      cancelAnimation(scroll)
      scroll.value = animated ? withTiming(target, { duration: 240 }) : target
    },
    [defaultPx, px, scroll, segsSv, leadSv, trailSv, nowSv, leadFromSv, reaperEdgeXSv, ridingSv],
  )
  // The clip + instant + inGap currently under the centre playhead (read on demand). `atNow` /
  // `atReaper` are GEOMETRIC "within reach of a frontier" flags (a single EDGE_SNAP zone for both),
  // so the host sticks to either edge the same way — independent of the autonomous reaper latch's
  // timing (which a drag-while-playing could defeat, leaving a sliver + the wrong icon).
  const getCenter = useCallback(() => {
    const p = px.value || defaultPx
    const sgs = segsSv.value
    if (p <= 0 || !sgs.length) return { clipId: null, timeMs: 0, pxPerMs: 0, inGap: false, atNow: false, atReaper: false }
    const lay = computeLayout(sgs, leadSv.value, trailSv.value, p)
    const r = resolveAt(scroll.value, sgs, lay, nowSv.value, leadFromSv.value)
    const atNow = scroll.value >= lay.total - EDGE_SNAP
    const atReaper = !atNow && reaperOnSv.value === 1 && scroll.value <= reaperEdgeXSv.value + EDGE_SNAP
    return { ...r, pxPerMs: p, atNow, atReaper }
  }, [defaultPx, px, scroll, segsSv, leadSv, trailSv, nowSv, leadFromSv, reaperEdgeXSv, reaperOnSv])

  // Snap + STICK to the reaper edge (the reaper's analog of the now-edge follow). Pins scroll exactly to
  // the edge (no sliver) and latches the ride; the host calls this when a drag/scrub settles within reach
  // of the reaper, then mirrors the riding state back for the clock + slashed-pause icon.
  const snapToReaper = useCallback(() => {
    cancelAnimation(scroll)
    scroll.value = Math.min(reaperEdgeXSv.value, layout.value.total)
    ridingSv.value = 1
  }, [scroll, reaperEdgeXSv, layout, ridingSv])
  // The universal wall clock, pushed from the host's JS RAF loop (serverNow every frame). This is now
  // the SOLE driver of reaperNowSv (the frame-timer accumulator is retired). Monotonic (forward-only),
  // mirrors nowSv for every mapping, and advances the live build (extendLive) on the same clock.
  const setNowUi = useCallback(
    (ms: number) => {
      if (ms <= reaperNowSv.value) return
      reaperNowSv.value = ms
      nowSv.value = ms
      if (liveIdxSv.value >= 0) segsSv.value = extendLive(baseSegsSv.value, liveIdxSv.value, ms)
    },
    [reaperNowSv, nowSv, liveIdxSv, segsSv, baseSegsSv],
  )
  useImperativeHandle(ref, () => ({ scrollToTime, getCenter, setNowUi, snapToReaper }), [scrollToTime, getCenter, setNowUi, snapToReaper])

  // ── report the clip/instant/inGap under the centre playhead (on a clip OR gap-state change) ──
  const reportCenter = useCallback(
    (id: string | null, timeMs: number, inGap: boolean) => {
      onCenter?.(id, timeMs, inGap)
    },
    [onCenter],
  )
  const prevInGap = useSharedValue(-1) // -1 unset, 0 false, 1 true
  useAnimatedReaction(
    () => scroll.value,
    (s) => {
      const r = resolveAt(s, segsSv.value, layout.value, nowSv.value, leadFromSv.value)
      let idx = -1
      const lay = layout.value
      for (let i = 0; i < lay.lefts.length; i++) {
        if (s >= lay.lefts[i]! && s <= lay.lefts[i]! + lay.widths[i]!) {
          idx = i
          break
        }
      }
      const gapFlag = r.inGap ? 1 : 0
      if (idx === prevCenterIdx.value && gapFlag === prevInGap.value) return
      prevCenterIdx.value = idx
      prevInGap.value = gapFlag
      runOnJS(reportCenter)(r.clipId, r.timeMs, r.inGap)
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
          // The user is taking control → release any ride + mark panning so the frame-lock won't grab
          // the scroll mid-drag (that grab/release cycle was the reaper jumpiness).
          ridingSv.value = 0
          panningSv.value = 1
          runOnJS(notifyScrubStart)()
        })
        .onChange((e) => {
          'worklet'
          if (twoFingers.value) return // a 2nd finger landed → defer to pinch, stop scrolling
          // Floor at the reaper edge (not 0): the playhead can't be dragged PAST the reaper edge into
          // the reaped void — symmetric with the now edge (ceiling = total). reaperEdgeXSv is 0 when
          // windowing is off, so this is the same as before when there's no reaper.
          scroll.value = clampW(scroll.value - e.changeX, reaperEdgeXSv.value, layout.value.total)
        })
        .onEnd((e) => {
          'worklet'
          // Report the SETTLED centre (after inertia) so playback resumes where the fling LANDS,
          // not where the finger lifted. twoFingers (pinch took over) → settle immediately.
          if (twoFingers.value) {
            const r = resolveAt(scroll.value, segsSv.value, layout.value, nowSv.value, leadFromSv.value)
            runOnJS(notifyScrubEnd)(r.clipId, r.timeMs)
            return
          }
          scroll.value = withDecay({ velocity: -e.velocityX, clamp: [reaperEdgeXSv.value, layout.value.total], deceleration: 0.997 }, (finished) => {
            'worklet'
            if (!finished) return // cancelled by a new gesture → don't resume
            const r = resolveAt(scroll.value, segsSv.value, layout.value, nowSv.value, leadFromSv.value)
            runOnJS(notifyScrubEnd)(r.clipId, r.timeMs)
          })
        })
        .onFinalize(() => {
          'worklet'
          // Gesture done (the withDecay momentum continues) → drop the panning guard so a fling that
          // settles at the reaper edge can latch into a smooth ride.
          panningSv.value = 0
        }),
    [scroll, layout, segsSv, nowSv, leadFromSv, notifyScrubStart, notifyScrubEnd, twoFingers, ridingSv, reaperEdgeXSv, panningSv],
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
          const L = computeLayout(segsSv.value, leadSv.value, trailSv.value, next)
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
    [scroll, layout, px, segsSv, leadSv, trailSv, minPxSv, maxPxSv, pinchStartPx, anchorIdx, anchorFrac, anchorScrollFrac, lastCommitPx, commitPx, twoFingers],
  )

  const gesture = useMemo(() => Gesture.Simultaneous(panGesture, pinchGesture), [panGesture, pinchGesture])

  // Animated content container: width tracks the zoom; translateX positions the centre playhead.
  // While RIDING, the transform derives from `reaperEdgeXSv` (the SAME derived value the mask uses),
  // NOT the separately-written `scroll`. This is the no-flash fix: on a clip-drop, `reaperEdgeXSv`
  // and `layout` both recompute from `segsSv` atomically, so the edge, mask and clips move together;
  // `scroll` is a separate shared value that can lag by a frame (a leftover withDecay can even defeat
  // its re-pin), which is exactly the 199→54 one-frame flash the trace caught. `scroll` is still kept
  // in sync by the frame-lock for gesture/centre logic, but the picture no longer depends on it.
  // The visual anchor (content-x at the centre playhead). DERIVED — not the separately-written
  // `scroll` — so the transform recomputes ATOMICALLY with `layout` at render time, the way the reaper
  // ride already does. Riding → the reaper edge (rush mapping); following now → `layout.total` (the
  // continuous now edge, same derived clock as the clips); else → `scroll`. Using `scroll` for an edge
  // ride let the playhead position lag the layout by a frame → the high-zoom jitter the reaper never
  // had. (`scroll` is still maintained by the frame loop for gesture/centre logic; the PICTURE no longer
  // depends on it while stuck to a frontier.)
  const effScrollSv = useDerivedValue(() =>
    ridingSv.value ? reaperEdgeXSv.value : followNowSv.value ? layout.value.total : scroll.value,
  )
  const contentStyle = useAnimatedStyle(() => {
    return { width: Math.max(layout.value.total, 1), transform: [{ translateX: vpSv.value / 2 - effScrollSv.value }] }
  })

  // Dark caps beyond the buffer window — the empty viewport area left of the oldest footage (head =
  // reaper edge) and right of now (tail). They show "you've hit the end of the buffer." Positioned in
  // VIEWPORT space (not the scrolling content), so they grow into view exactly as an edge reaches centre.
  const headCapStyle = useAnimatedStyle(() => ({ width: Math.max(0, vpSv.value / 2 - effScrollSv.value) }))
  // The reaper mask (content coords, ON TOP of the clips): covers [0, reaperEdgeX] — the part of the
  // oldest clip already eaten. reaperEdgeX advances every frame → the clip is consumed smoothly.
  const reaperMaskStyle = useAnimatedStyle(() => ({ width: Math.max(0, reaperEdgeXSv.value) }))
  const tailCapStyle = useAnimatedStyle(() => {
    const edge = vpSv.value / 2 - effScrollSv.value + layout.value.total // viewport-x of the now edge
    return { left: edge, width: Math.max(0, vpSv.value - edge) }
  })

  // Five rows fill the region: ruler + 2 title bands + 2 clip lanes. The lanes split what's left.
  const laneHeight = Math.max(0, (regionH - RULER_H - 2 * TITLE_H) / 2)
  const bufferTop = RULER_H + TITLE_H
  const savedTitleTop = bufferTop + laneHeight
  const savedTop = savedTitleTop + TITLE_H
  const clipH = Math.max(0, laneHeight - 2 * CLIP_INSET_Y)
  const laneReach = laneHeight + TITLE_H // distance a block travels to reach the OTHER lane

  const renderLane = (clips: LaneClip[], tone: 'buffered' | 'saved', topPx: number) => (
    <View style={[styles.lane, { top: topPx, height: laneHeight }]}>
      {clips.map((c) => {
        const index = idToIndex[c.id]
        if (index == null) return null
        return (
          <AnimatedClip key={c.id} layout={layout} index={index} clipH={clipH} reaperEdgeX={reaperEdgeXSv}>
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
              reachPx={laneReach}
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
              {/* Dark caps beyond the buffer window (behind the content) — the reaped void (head) +
                  past-now (tail). The reaper countdown lives in the host's gap card, not here. */}
              <Animated.View style={[styles.edgeCap, styles.headCap, headCapStyle]} pointerEvents="none" />
              <Animated.View style={[styles.edgeCap, tailCapStyle]} pointerEvents="none" />
              <Animated.View style={[{ height: regionH }, contentStyle]}>
                {/* ruler (clock stamps) */}
                <View style={styles.ruler}>
                  {tickIndices.map((i) => (
                    <AnimatedTick key={i} layout={layout} index={i} label={fmtTick(segs[i]!.startMs)} />
                  ))}
                  <AnimatedTick layout={layout} index={-1} label="now" isNow />
                </View>
                {/* gap markers across both lanes */}
                {leadGapPx > 0 ? <AnimatedGap layout={layout} index={-2} leading /> : null}
                {gapIndices.map((i) => (
                  <AnimatedGap key={`gap-${i}`} layout={layout} index={i} />
                ))}
                {trailingGap ? <AnimatedGap layout={layout} index={-1} trailing /> : null}
                {/* clip lanes (positioned around the fixed title bands) */}
                {renderLane(buffered, 'buffered', bufferTop)}
                {renderLane(saved, 'saved', savedTop)}
                {/* reaper mask — the consumed span [0, reaperEdgeX], ON TOP of the lanes so eaten
                    footage reads as gone; advances every frame (0-width until the frontier engages). */}
                {showReaperFrontier ? <Animated.View style={[styles.reaperMask, reaperMaskStyle]} pointerEvents="none" /> : null}
                {/* reaper edge while actively reaping — a full-height rule (ruler + both lanes) so
                    the rows move as one, with the badge in the lane the oldest clip lives in (red
                    sickle = buffer eaten · black save = saved scrolling out). Rendered ON TOP of the
                    lanes so a clip block can't cut off the badge. */}
                {showReaperFrontier ? (
                  <AnimatedReaperEdge
                    edgeX={reaperEdgeXSv}
                    top={0}
                    height={regionH}
                    badgeTop={(reaperLane === 'saved' ? savedTop : bufferTop) + (laneHeight - 22) / 2}
                    kind={reaperLane === 'saved' ? 'save' : 'reap'}
                  />
                ) : null}
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
  // Darkened region beyond a buffer-window edge (reaper head / now tail) — reads as "no more buffer".
  edgeCap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.bg.panelHi,
  },
  headCap: {
    left: 0,
  },
  // The consumed (reaped) region over the oldest clip — content coords, left-anchored. Spans the
  // FULL height (top: 0, incl. the ruler) so the reaped void reaches centre in every row, matching
  // the head cap + the lanes; masking at RULER_H left the ruler's dark edge short of centre by the
  // boundary's offset into the oldest clip (a visible misalignment while reaping).
  reaperMask: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.bg.panelHi,
  },
  // Reaper edge — a full-height rule (spans the column) + a badge whose `top` is set per active lane.
  reaperEdge: {
    position: 'absolute',
    width: GAP_W,
  },
  reaperRule: {
    position: 'absolute',
    left: GAP_W / 2 - 1,
    top: 0,
    bottom: 0,
    width: 2,
  },
  reaperBadge: {
    position: 'absolute',
    left: GAP_W / 2 - 11,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: theme.colors.bg.primary, // empty-time band reads lighter than the lanes
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
