// src/components/screens/ClipsScreen.tsx
//
// Clips landing — the first page from the Clip (footer) button. A two-lane, time-ordered
// grid of every clip: buffered recording sessions on the LEFT, saved clips on the RIGHT,
// on a shared vertical time axis. Now is at the BOTTOM (scroll up = older).
//
// The axis lays out clips PER-CLIP so each one keeps a readable, tappable block: a clip's
// height is its duration × zoom, FLOORED to MIN_BLOCK_H, and that floored height is the
// space it reserves — so short clips never collapse to slivers and blocks never overlap.
// Empty stretches between clips (and the trailing stretch up to "now") collapse to a fixed
// `TimeGapMarker`. 2-finger pinch zooms (longer clips grow past the floor → proportional).
// Double-tap a clip → editor; drag a clip across to the other lane to save / un-save.
//
// MOCK SEAM: the saved lane reads the real recordings list; the buffer→saved promote + the
// real saved-clips model + un-save are Aaron's lane (the manifest).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSharedValue, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { ClipLane, type LaneClip, type ClipPos } from '@/components/features/clip/ClipLane'
import { TimeGapMarker } from '@/components/features/clip/TimeGapMarker'
import { useBuffer } from '@/hooks/useBuffer'
import { useRecordings } from '@/hooks/useRecordings'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { bufferApi, type BufferSession } from '@/api/buffer'
import type { Recording } from '@/types'

const MIN_BLOCK_H = 34 // a short clip stays a readable, tappable block
const GAP_PX = 34 // height an empty stretch collapses to
const GAP_THRESHOLD_MS = 45_000 // gaps longer than this get a marker; shorter → a hair of spacing
const MICRO_GAP_PX = 5 // spacing between near-adjacent clips (no marker)
const LONGEST_DEFAULT_PX = 130 // at the default zoom, the longest clip is about this tall
const MAX_PX_PER_MS = 0.2 // ~1s ≈ 200px at full zoom

const sessionStartMs = (s: BufferSession) => Date.parse(s.startedAt) + (s.mediaStartOffsetMs ?? 0)
// `?? 0` matters: a brand-new live session can have BOTH duration fields undefined.
const sessionEndMs = (s: BufferSession) => sessionStartMs(s) + (s.mediaDurationSec ?? s.durationSec ?? 0) * 1000

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
function pad(n: number) {
  return String(n).padStart(2, '0')
}
function fmtTime(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtDur(sec: number) {
  const t = Math.max(0, Math.round(sec))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
// Coarse gap label: "2d 4h", "3h 12m", "12m", "45s".
function fmtGap(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(t / 86400)
  const h = Math.floor((t % 86400) / 3600)
  const m = Math.floor((t % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m`
  return `${t}s`
}

// ── per-clip collapsed layout ────────────────────────────────────────────────
type GapMark = { yTop: number; height: number; ms: number }
type Layout = { pos: Map<string, ClipPos>; gaps: GapMark[]; contentHeight: number }
// Walk all clips oldest → newest; give each a `top`/`height` slot (duration×px, floored to
// MIN_BLOCK_H) and collapse the empty stretches between them — and up to `nowMs` — to gaps.
// Reserving the floored height is what stops short blocks overlapping (the old thin-line bug).
function buildLayout(clips: LaneClip[], px: number, nowMs: number): Layout {
  const sorted = clips
    .filter((c) => Number.isFinite(c.startMs) && Number.isFinite(c.endMs) && c.endMs >= c.startMs)
    .sort((a, b) => a.startMs - b.startMs)
  const pos = new Map<string, ClipPos>()
  const gaps: GapMark[] = []
  let cursor = 0
  let prevEnd: number | null = null
  for (const c of sorted) {
    if (prevEnd != null && c.startMs > prevEnd) {
      const gapMs = c.startMs - prevEnd
      if (gapMs > GAP_THRESHOLD_MS) {
        gaps.push({ yTop: cursor, height: GAP_PX, ms: gapMs })
        cursor += GAP_PX
      } else {
        cursor += MICRO_GAP_PX
      }
    }
    const height = Math.max(MIN_BLOCK_H, (c.endMs - c.startMs) * px)
    pos.set(c.id, { top: cursor, height })
    cursor += height
    prevEnd = prevEnd == null ? c.endMs : Math.max(prevEnd, c.endMs)
  }
  if (prevEnd != null && nowMs > prevEnd + GAP_THRESHOLD_MS) {
    gaps.push({ yTop: cursor, height: GAP_PX, ms: nowMs - prevEnd })
    cursor += GAP_PX
  }
  return { pos, gaps, contentHeight: cursor }
}

export const ClipsScreen = () => {
  const insets = useSafeAreaInsets()
  const { isSignedIn } = useAuth()
  const isLive = useBroadcastStore((s) => s.isLive)
  const { data: buffer } = useBuffer(!!isSignedIn, isLive)
  const { data: recordings } = useRecordings(!!isSignedIn)

  // ── normalise both data sources into time-positioned lane clips ──
  const buffered = useMemo<LaneClip[]>(() => {
    return (buffer?.sessions ?? []).map((s) => {
      const startMs = sessionStartMs(s)
      const endMs = sessionEndMs(s)
      return { id: s.id, startMs, endMs, label: fmtTime(startMs), sublabel: fmtDur((endMs - startMs) / 1000), posterUrl: s.thumbnailUrl }
    })
  }, [buffer])
  const saved = useMemo<LaneClip[]>(() => {
    const recs: Recording[] = recordings ?? []
    return recs.map((r) => {
      const startMs = Date.parse(r.startedAt)
      const endMs = startMs + (r.durationSec ?? 0) * 1000
      return { id: r.id, startMs, endMs, label: fmtTime(startMs), sublabel: fmtDur(r.durationSec ?? 0), posterUrl: r.thumbnailUrl }
    })
  }, [recordings])

  // Combine into one set so a drag just flips a clip's lane (locked in time). Lanes are
  // filtered views; `laneOverride` is the local (mock) save / un-save.
  const [laneOverride, setLaneOverride] = useState<Record<string, 'buffered' | 'saved'>>({})
  const laneOf = useCallback((id: string, def: 'buffered' | 'saved') => laneOverride[id] ?? def, [laneOverride])
  const bufferedLane = useMemo(
    () => [...buffered.filter((c) => laneOf(c.id, 'buffered') === 'buffered'), ...saved.filter((c) => laneOf(c.id, 'saved') === 'buffered')],
    [buffered, saved, laneOf],
  )
  const savedLane = useMemo(
    () => [...saved.filter((c) => laneOf(c.id, 'saved') === 'saved'), ...buffered.filter((c) => laneOf(c.id, 'buffered') === 'saved')],
    [buffered, saved, laneOf],
  )
  const allClips = useMemo(() => [...buffered, ...saved], [buffered, saved])
  const hasAny = allClips.length > 0

  const moveClip = useCallback((clip: LaneClip, to: 'buffered' | 'saved') => {
    setLaneOverride((prev) => ({ ...prev, [clip.id]: to }))
    if (to === 'saved') {
      bufferApi
        .saveClip({ startAtMs: Math.round(clip.startMs), endAtMs: Math.round(clip.endMs), name: clip.label, kinds: [] })
        .catch(() => {})
    }
  }, [])

  const [lanesRowW, setLanesRowW] = useState(0)
  const reachPx = lanesRowW > 0 ? (lanesRowW + theme.spacing.sm) / 2 : 0

  // ── zoom + time bounds ──
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])
  useFocusEffect(useCallback(() => setNowMs(Date.now()), []))
  const axisTop = useMemo(() => {
    let newest = nowMs
    for (const c of allClips) if (Number.isFinite(c.endMs) && c.endMs > newest) newest = c.endMs
    return newest
  }, [allClips, nowMs])
  const maxClipDur = useMemo(() => {
    let m = 0
    for (const c of allClips) {
      const d = c.endMs - c.startMs
      if (Number.isFinite(d) && d > m) m = d
    }
    return m
  }, [allClips])

  const [viewportH, setViewportH] = useState(0)
  const [pxPerMs, setPxPerMs] = useState(0)
  // minPx → the longest clip sits at the floor (all blocks uniform); maxPx → ~1s/200px.
  const minPx = maxClipDur > 0 ? MIN_BLOCK_H / maxClipDur : 0
  const maxPx = Math.max(minPx, MAX_PX_PER_MS)
  const defaultPx = maxClipDur > 0 ? clamp(LONGEST_DEFAULT_PX / maxClipDur, minPx, maxPx) : 0
  const px = pxPerMs > 0 ? clamp(pxPerMs, minPx, maxPx) : defaultPx
  useEffect(() => {
    if (pxPerMs === 0 && defaultPx > 0) setPxPerMs(defaultPx)
  }, [defaultPx, pxPerMs])

  const layout = useMemo(() => buildLayout(allClips, px, axisTop), [allClips, px, axisTop])
  const contentHeight = layout.contentHeight
  const posOf = useCallback((id: string) => layout.pos.get(id), [layout])

  const scrollRef = useRef<ScrollView>(null)
  const scrollYRef = useRef(0)
  const pendingScrollY = useRef<number | null>(null)
  const didInitialScroll = useRef(false)
  const pxRef = useRef(px)
  pxRef.current = px
  const clipsRef = useRef(allClips)
  clipsRef.current = allClips
  const axisTopRef = useRef(axisTop)
  axisTopRef.current = axisTop
  const contentHeightRef = useRef(contentHeight)
  contentHeightRef.current = contentHeight

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y
  }
  useEffect(() => {
    if (pendingScrollY.current != null) {
      const y = pendingScrollY.current
      pendingScrollY.current = null
      scrollRef.current?.scrollTo({ y, animated: false })
      scrollYRef.current = y
    }
  }, [px])
  // Land at "now" (the bottom) the first time we have content + a measured viewport.
  useEffect(() => {
    if (!didInitialScroll.current && contentHeight > 0 && viewportH > 0) {
      didInitialScroll.current = true
      const y = Math.max(0, contentHeight - viewportH)
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }))
    }
  }, [contentHeight, viewportH])

  // Pinch keeps the content fraction under the pinch focal pinned across the rescale.
  const zoomToFocal = useCallback(
    (targetPx: number, focalY: number) => {
      if (viewportH <= 0) return
      const next = clamp(targetPx, minPx, maxPx)
      if (Math.abs(next - pxRef.current) < 1e-12) return
      const oldContent = contentHeightRef.current
      const frac = oldContent > 0 ? (scrollYRef.current + focalY) / oldContent : 0
      const nextLayout = buildLayout(clipsRef.current, next, axisTopRef.current)
      const newScrollY = clamp(frac * nextLayout.contentHeight - focalY, 0, Math.max(0, nextLayout.contentHeight - viewportH))
      pendingScrollY.current = newScrollY
      setPxPerMs(next)
    },
    [minPx, maxPx, viewportH],
  )
  const pxSv = useSharedValue(px)
  pxSv.value = px
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
          runOnJS(zoomToFocal)(pinchStartSv.value * e.scale, e.focalY)
        }),
    [zoomToFocal, pinchStartSv, pxSv],
  )

  const openClip = useCallback((clip: LaneClip, kind: 'buffered' | 'saved') => {
    router.navigate({ pathname: '/(app)/clip-editor', params: { clipId: clip.id, kind } })
  }, [])

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <ScreenHeader title="Clips" />
        <PageTabs
          tabs={[
            { key: 'grid', label: 'Clips' },
            { key: 'editor', label: 'Editor' },
          ]}
          value="grid"
          onChange={(k) => {
            if (k === 'editor') router.navigate('/(app)/clip-editor')
          }}
          style={styles.pager}
        />
        <View style={styles.laneHeaders}>
          <View style={styles.laneHeaderCell}>
            <Icon name="film" size="sm" color={theme.colors.text.muted} />
            <Text variant="monoLabel" color={theme.colors.text.muted}>
              BUFFERED
            </Text>
          </View>
          <View style={styles.laneGap} />
          <View style={styles.laneHeaderCell}>
            <Icon name="bookmark" size="sm" color={theme.colors.accent.default} />
            <Text variant="monoLabel" color={theme.colors.accent.default}>
              SAVED
            </Text>
          </View>
        </View>
        <Text variant="monoCaption" color={theme.colors.text.subtle} style={styles.hint}>
          double-tap to edit · drag across to save · pinch to zoom
        </Text>
      </View>

      {!hasAny ? (
        <View style={styles.empty}>
          <Icon name="film" size="lg" color={theme.colors.text.subtle} />
          <Text variant="bodyEmphasized">No clips yet</Text>
          <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
            Go live to start buffering. Your recent footage shows on the left; drag a clip right to save it.
          </Text>
        </View>
      ) : (
        <View style={styles.gridWrap} onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}>
          <GestureDetector gesture={pinch}>
            <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
              <View style={{ height: contentHeight }}>
                {/* Collapsed-time gap markers across both lanes. */}
                {layout.gaps.map((g, i) => (
                  <View key={`gap-${i}`} style={[styles.gapBand, { top: g.yTop }]}>
                    <TimeGapMarker height={g.height} label={fmtGap(g.ms)} />
                  </View>
                ))}
                <View style={styles.lanesRow} onLayout={(e) => setLanesRowW(e.nativeEvent.layout.width)}>
                  <ClipLane
                    clips={bufferedLane}
                    tone="buffered"
                    posOf={posOf}
                    onOpenClip={(c) => openClip(c, 'buffered')}
                    reachPx={reachPx}
                    onMoveClip={(c) => moveClip(c, 'saved')}
                  />
                  <View style={styles.laneGap} />
                  <ClipLane
                    clips={savedLane}
                    tone="saved"
                    posOf={posOf}
                    onOpenClip={(c) => openClip(c, 'saved')}
                    reachPx={reachPx}
                    onMoveClip={(c) => moveClip(c, 'buffered')}
                  />
                </View>
              </View>
            </ScrollView>
          </GestureDetector>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  header: {
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  pager: {
    marginTop: theme.spacing.sm,
  },
  laneHeaders: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  laneHeaderCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  laneGap: {
    width: theme.spacing.sm,
  },
  hint: {
    textAlign: 'center',
    paddingTop: theme.spacing.xs,
  },
  gridWrap: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  gapBand: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  lanesRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 260,
  },
})
