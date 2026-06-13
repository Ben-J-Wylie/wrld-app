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
// Buffer + saved clips never overlap (the carve), so ONE shared time→x axis positions both
// lanes + the ruler. Pinch zooms; single-tap selects (→ viewer), double-tap opens the editor.
//
// See DESIGN.md Section 3 (Clips landing grid).

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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

// ── horizontal collapsed-gap layout (oldest → newest = left → right) ──
type HPos = { left: number; width: number }
type HGap = { x: number; width: number }
type HLayout = { pos: Map<string, HPos>; gaps: HGap[]; contentWidth: number; tickXs: { x: number; label: string }[] }
function buildHLayout(clips: LaneClip[], pxPerMs: number, nowMs: number): HLayout {
  const sorted = clips
    .filter((c) => Number.isFinite(c.startMs) && Number.isFinite(c.endMs) && c.endMs >= c.startMs)
    .sort((a, b) => a.startMs - b.startMs) // oldest first
  const pos = new Map<string, HPos>()
  const gaps: HGap[] = []
  const tickXs: { x: number; label: string }[] = []
  let cursor = 0
  let prevEnd: number | null = null
  let lastTickX = -Infinity
  for (const c of sorted) {
    if (prevEnd != null && c.startMs > prevEnd) {
      const gapMs = c.startMs - prevEnd
      if (gapMs > GAP_THRESHOLD_MS) {
        gaps.push({ x: cursor, width: GAP_W })
        cursor += GAP_W
      } else {
        cursor += MICRO_GAP_W
      }
    }
    const width = Math.max(MIN_CLIP_W, (c.endMs - c.startMs) * pxPerMs)
    pos.set(c.id, { left: cursor, width })
    if (cursor - lastTickX > 56) {
      tickXs.push({ x: cursor, label: fmtTick(c.startMs) })
      lastTickX = cursor
    }
    cursor += width
    prevEnd = prevEnd == null ? c.endMs : Math.max(prevEnd, c.endMs)
  }
  // trailing gap to now (the live edge) + a "now" tick at the far right
  if (prevEnd != null && nowMs > prevEnd + GAP_THRESHOLD_MS) {
    gaps.push({ x: cursor, width: GAP_W })
    cursor += GAP_W
  }
  tickXs.push({ x: cursor, label: 'now' })
  return { pos, gaps, contentWidth: cursor, tickXs }
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
  onCenter?: (clipId: string | null, timeMs: number) => void // clip/instant under the centre playhead
}

// Imperative handle so the host can drive the scroll from playback — bring a time instant under
// the fixed centre playhead (reposition on play, then follow frame-by-frame as it plays).
export type ClipsTimelineHandle = {
  scrollToTime: (ms: number, animated?: boolean) => void
}

export const ClipsTimeline = forwardRef<ClipsTimelineHandle, Props>(function ClipsTimeline(
  { buffered, saved, nowMs, selectedId, onSelect, onOpen, onSave, onUnsave, onScrubStart, onCenter }: Props,
  ref,
) {
  // Combined set drives the shared axis (buffer + saved don't overlap → one timeline).
  const allClips = useMemo(() => [...buffered, ...saved], [buffered, saved])
  const maxDur = useMemo(() => allClips.reduce((m, c) => Math.max(m, c.endMs - c.startMs), 0), [allClips])

  const [viewportW, setViewportW] = useState(0)
  const [regionH, setRegionH] = useState(0)
  const [pxPerMs, setPxPerMs] = useState(0)
  const minPx = maxDur > 0 ? MIN_CLIP_W / maxDur : 0
  const maxPx = Math.max(minPx, MAX_PX_PER_MS)
  const defaultPx = maxDur > 0 ? clamp(LONGEST_DEFAULT_W / maxDur, minPx, maxPx) : 0
  const px = pxPerMs > 0 ? clamp(pxPerMs, minPx, maxPx) : defaultPx
  useEffect(() => {
    if (pxPerMs === 0 && defaultPx > 0) setPxPerMs(defaultPx)
  }, [defaultPx, pxPerMs])

  const layout = useMemo(() => buildHLayout(allClips, px, nowMs), [allClips, px, nowMs])
  const contentWidth = layout.contentWidth
  // Half-viewport of empty scroll on each end so the reaper edge (x=0) and the now edge
  // (x=contentWidth) can each scroll all the way to the fixed centre playhead.
  const padX = viewportW > 0 ? viewportW / 2 : 0
  const outerWidth = contentWidth + 2 * padX

  const scrollRef = useRef<ScrollView>(null)
  const scrollXRef = useRef(0)
  const pendingScrollX = useRef<number | null>(null)
  const didInitialScroll = useRef(false)
  const contentWidthRef = useRef(contentWidth)
  contentWidthRef.current = contentWidth
  const pxRef = useRef(px)
  pxRef.current = px
  const clipsRef = useRef(allClips)
  clipsRef.current = allClips

  useEffect(() => {
    if (pendingScrollX.current != null) {
      const x = pendingScrollX.current
      pendingScrollX.current = null
      scrollRef.current?.scrollTo({ x, animated: false })
      scrollXRef.current = x
    }
  }, [px])
  // Land with "now" (the right edge) centred under the playhead on first content + viewport.
  useEffect(() => {
    if (!didInitialScroll.current && contentWidth > 0 && viewportW > 0) {
      didInitialScroll.current = true
      const x = Math.max(0, outerWidth - viewportW) // = contentWidth → now under centre
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x, animated: false }))
    }
  }, [contentWidth, viewportW, outerWidth])

  // Pinch zoom — keep the timeline fraction under the focal pinned across the rescale (the
  // leading pad is constant, so the focal maps into timeline space by subtracting it).
  const zoomToFocal = useCallback(
    (targetPx: number, focalX: number) => {
      if (viewportW <= 0) return
      const next = clamp(targetPx, minPx, maxPx)
      if (Math.abs(next - pxRef.current) < 1e-12) return
      const pad = viewportW / 2
      const oldW = contentWidthRef.current
      const frac = oldW > 0 ? (scrollXRef.current + focalX - pad) / oldW : 0
      const newW = buildHLayout(clipsRef.current, next, nowMs).contentWidth
      pendingScrollX.current = clamp(pad + frac * newW - focalX, 0, Math.max(0, newW + 2 * pad - viewportW))
      setPxPerMs(next)
    },
    [minPx, maxPx, viewportW, nowMs],
  )
  const pxSv = useSharedValue(px)
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
          runOnJS(zoomToFocal)(pinchStartSv.value * e.scale, e.focalX)
        }),
    [zoomToFocal, pinchStartSv, pxSv],
  )

  // ── imperative: bring a time instant under the centre playhead ──
  // scrollX that centres content-x C is `padX + C - viewportW/2` = C (padX = viewportW/2), so the
  // target scroll offset is simply the time's content-x. Used to reposition on play + follow.
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const timeToContentX = useCallback((ms: number) => {
    const lay = layoutRef.current
    const clips = clipsRef.current
    let fallback = 0
    let bestDist = Infinity
    for (const c of clips) {
      const p = lay.pos.get(c.id)
      if (!p) continue
      if (ms >= c.startMs && ms <= c.endMs) {
        const dur = Math.max(1, c.endMs - c.startMs)
        return p.left + ((ms - c.startMs) / dur) * p.width
      }
      const edgeX = ms < c.startMs ? p.left : p.left + p.width
      const d = ms < c.startMs ? c.startMs - ms : ms - c.endMs
      if (d < bestDist) {
        bestDist = d
        fallback = edgeX
      }
    }
    return fallback
  }, [])
  useImperativeHandle(
    ref,
    () => ({
      scrollToTime: (ms: number, animated = false) => {
        const x = Math.max(0, timeToContentX(ms))
        scrollRef.current?.scrollTo({ x, animated })
        scrollXRef.current = x
      },
    }),
    [timeToContentX],
  )
  // The clip + instant under the centre playhead. The centred content-x equals the scroll offset
  // (padX = viewportW/2 cancels), so map the scroll offset → the clip it lands in + the time there.
  const centerAt = useCallback((scrollX: number): { id: string | null; timeMs: number } => {
    const lay = layoutRef.current
    for (const c of clipsRef.current) {
      const p = lay.pos.get(c.id)
      if (p && scrollX >= p.left && scrollX <= p.left + p.width) {
        const frac = p.width > 0 ? (scrollX - p.left) / p.width : 0
        return { id: c.id, timeMs: c.startMs + frac * (c.endMs - c.startMs) }
      }
    }
    return { id: null, timeMs: 0 }
  }, [])

  // Five rows fill the region: ruler + 2 title bands + 2 clip lanes. The lanes split what's left.
  const laneHeight = Math.max(0, (regionH - RULER_H - 2 * TITLE_H) / 2)
  const bufferTop = RULER_H + TITLE_H
  const savedTitleTop = bufferTop + laneHeight
  const savedTop = savedTitleTop + TITLE_H

  const clipH = Math.max(0, laneHeight - 2 * CLIP_INSET_Y)
  const renderLane = (clips: LaneClip[], tone: 'buffered' | 'saved', topPx: number) => (
    <View style={[styles.lane, { top: topPx, height: laneHeight, width: contentWidth }]}>
      {clips.map((c) => {
        const p = layout.pos.get(c.id)
        if (!p) return null
        return (
          <View key={c.id} style={[styles.slot, { left: p.left, width: p.width, top: CLIP_INSET_Y, height: clipH }]}>
            <ClipBlock
              heightPx={clipH} /* inset from the lane top/bottom; the slot bounds the width */
              widthPx={p.width}
              label={c.label}
              sublabel={c.sublabel}
              posterUrl={c.posterUrl}
              tone={tone}
              draft={!!c.draftId}
              selected={selectedId === c.id}
              onSelect={() => onSelect(c)}
              onOpen={() => onOpen(c, tone)}
              dragAxis="y"
              dragDir={tone === 'buffered' ? 1 : -1}
              reachPx={clipH}
              onCross={() => (tone === 'buffered' ? onSave(c) : onUnsave(c))}
            />
          </View>
        )
      })}
    </View>
  )

  const hasAny = allClips.length > 0

  return (
    <View style={styles.region} onLayout={(e) => setRegionH(e.nativeEvent.layout.height)}>
      {/* Horizontally-scrolling timeline — full width; the lane titles sticky-overlay the left. */}
      <View style={styles.scrollArea} onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}>
        {!hasAny ? (
          <View style={styles.empty}>
            <Text variant="monoCaption" color={theme.colors.text.muted}>
              No clips yet — go live to start buffering.
            </Text>
          </View>
        ) : (
          <GestureDetector gesture={pinch}>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => onScrubStart?.()}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x
                scrollXRef.current = x
                if (onCenter) {
                  const { id, timeMs } = centerAt(x)
                  onCenter(id, timeMs)
                }
              }}
              scrollEventThrottle={16}
            >
              <View style={{ width: outerWidth, height: regionH }}>
                {/* Timeline content, shifted right by the leading pad so x=0 sits at the centre. */}
                <View style={{ position: 'absolute', left: padX, top: 0, width: contentWidth, height: regionH }}>
                  {/* ruler */}
                  <View style={styles.ruler}>
                    {layout.tickXs.map((t, i) => (
                      <View key={i} style={[styles.tick, { left: t.x }]}>
                        <View style={[styles.tickMark, t.label === 'now' && styles.tickMarkNow]} />
                        <Text variant="monoCaption" color={t.label === 'now' ? theme.colors.accent.default : theme.colors.text.subtle}>
                          {t.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {/* gap markers across both lanes */}
                  {layout.gaps.map((g, i) => (
                    <View key={`gap-${i}`} style={[styles.gapBand, { left: g.x, width: g.width, top: RULER_H, bottom: 0 }]}>
                      <View style={styles.gapRule} />
                    </View>
                  ))}
                  {/* clip lanes (positioned around the fixed title bands) */}
                  {renderLane(buffered, 'buffered', bufferTop)}
                  {renderLane(saved, 'saved', savedTop)}
                </View>
              </View>
            </ScrollView>
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
  },
  slot: {
    position: 'absolute',
  },
})
