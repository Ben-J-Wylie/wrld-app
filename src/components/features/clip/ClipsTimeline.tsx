// src/components/features/clip/ClipsTimeline.tsx
//
// The horizontal Clips timeline — the redesigned grid (2026-06-12). A fixed-height region
// (no page vertical scroll) with three stacked rows that scroll together HORIZONTALLY along a
// shared collapsed-gap time axis, **oldest/reaper on the LEFT, now on the RIGHT**:
//
//   ┌ time ruler ─────────────────────────────────┐
//   │ BUFFER  [▓▓▓]·[▓▓▓▓]········[▓▓]              │   (footage minus saved ranges)
//   │ SAVED        [▓▓]       [▓▓▓]                 │   (the carved-out saved clips)
//   └ reaper ───────────────────────────────► now ─┘
//
// Empty time collapses to thin gap markers (footage never disappears into empty space).
// Buffer + saved clips never overlap (the carve), so ONE shared time→x axis positions both
// lanes + the ruler. Pinch zooms; single-tap selects (→ viewer), double-tap opens the editor.
// Fixed left gutter holds the lane labels; the timeline scrolls to its right.
//
// See DESIGN.md Section 3 (Clips landing grid).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { ClipBlock } from './ClipBlock'
import { type LaneClip } from './ClipLane'

const RULER_H = 22
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
}

export function ClipsTimeline({ buffered, saved, nowMs, selectedId, onSelect, onOpen, onSave, onUnsave }: Props) {
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
  // Land at "now" (the far right) on first content + measured viewport.
  useEffect(() => {
    if (!didInitialScroll.current && contentWidth > 0 && viewportW > 0) {
      didInitialScroll.current = true
      const x = Math.max(0, contentWidth - viewportW)
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x, animated: false }))
    }
  }, [contentWidth, viewportW])

  // Pinch zoom — keep the content fraction under the focal pinned across the rescale.
  const zoomToFocal = useCallback(
    (targetPx: number, focalX: number) => {
      if (viewportW <= 0) return
      const next = clamp(targetPx, minPx, maxPx)
      if (Math.abs(next - pxRef.current) < 1e-12) return
      const oldW = contentWidthRef.current
      const frac = oldW > 0 ? (scrollXRef.current + focalX) / oldW : 0
      const nextLayout = buildHLayout(clipsRef.current, next, nowMs)
      pendingScrollX.current = clamp(frac * nextLayout.contentWidth - focalX, 0, Math.max(0, nextLayout.contentWidth - viewportW))
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

  // Each lane fills half the region below the ruler (the divider takes 2px).
  const laneHeight = Math.max(0, (regionH - RULER_H - 2) / 2)

  const renderLane = (clips: LaneClip[], tone: 'buffered' | 'saved') => (
    <View style={styles.lane}>
      {clips.map((c) => {
        const p = layout.pos.get(c.id)
        if (!p) return null
        return (
          <View key={c.id} style={[styles.slot, { left: p.left, width: p.width }]}>
            <ClipBlock
              heightPx={laneHeight} /* fill the lane height; the slot bounds the width */
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
              reachPx={laneHeight + 2}
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
              onScroll={(e) => {
                scrollXRef.current = e.nativeEvent.contentOffset.x
              }}
              scrollEventThrottle={16}
            >
              <View style={{ width: contentWidth, height: regionH }}>
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
                {/* lanes */}
                <View style={styles.lanes}>
                  {renderLane(buffered, 'buffered')}
                  <View style={styles.laneDivider} />
                  {renderLane(saved, 'saved')}
                </View>
              </View>
            </ScrollView>
          </GestureDetector>
        )}
      </View>

      {/* Sticky lane titles — top-left of each lane, icon + name inline, don't scroll. */}
      {hasAny && regionH > 0 ? (
        <>
          <View style={[styles.laneTitle, { top: RULER_H + 4 }]} pointerEvents="none">
            <Icon name="film" size="sm" color={theme.colors.text.muted} />
            <Text variant="monoCaption" color={theme.colors.text.muted}>
              BUFFER
            </Text>
          </View>
          <View style={[styles.laneTitle, { top: RULER_H + laneHeight + 2 + 4 }]} pointerEvents="none">
            <Icon name="bookmark" size="sm" color={theme.colors.accent.default} />
            <Text variant="monoCaption" color={theme.colors.accent.default}>
              SAVED
            </Text>
          </View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  region: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  // Sticky title chip over the top-left of each lane (paper bg so it reads over a block).
  laneTitle: {
    position: 'absolute',
    left: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.primary,
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
  lanes: {
    position: 'absolute',
    top: RULER_H,
    left: 0,
    right: 0,
    bottom: 0,
  },
  lane: {
    flex: 1,
  },
  laneDivider: {
    height: 2,
  },
  slot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
})
