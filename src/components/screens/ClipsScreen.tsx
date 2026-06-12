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
import { useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { Alert, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
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
import { ClipTimeRuler, type RulerTick } from '@/components/features/clip/ClipTimeRuler'
import { useBuffer } from '@/hooks/useBuffer'
import { useSavedClips } from '@/hooks/useSavedClips'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { bufferApi, type BufferSession } from '@/api/buffer'

const GUTTER_W = 52 // left ruler column (ghosted time marks)
const MIN_TICK_GAP = 26 // min vertical px between ruler labels so they don't collide
const MIN_BLOCK_H = 34 // a short clip stays a readable, tappable block
const GAP_PX = 34 // height an empty stretch collapses to
const GAP_THRESHOLD_MS = 45_000 // gaps longer than this get a marker; shorter → a hair of spacing
const MICRO_GAP_PX = 5 // spacing between near-adjacent clips (no marker)
const LONGEST_DEFAULT_PX = 130 // at the default zoom, the longest clip is about this tall
const MAX_PX_PER_MS = 0.2 // ~1s ≈ 200px at full zoom

// Dev-only trace to the Metro terminal for diagnosing drag-to-save (stripped in prod).
const slog = (...args: unknown[]) => {
  if (__DEV__) console.log('[clips-save]', ...args)
}

const SAVED_MATCH_TOL_MS = 1500
// A saved clip and its source buffered session are the SAME clip in two states, so a
// saved session is hidden from the buffer lane (saving MOVES it, never duplicates). The
// exact link is the clip's source `bufferSessionId` (pending in the API — see handoff);
// until then we match on the window, which is exact for whole-session saves: a buffered
// session is "saved" when a saved clip's window covers it.
const savedClipCovers = (b: LaneClip, savedList: LaneClip[]) =>
  savedList.some((s) => s.startMs <= b.startMs + SAVED_MATCH_TOL_MS && s.endMs >= b.endMs - SAVED_MATCH_TOL_MS)

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
  const qc = useQueryClient()
  const { data: buffer } = useBuffer(!!isSignedIn, isLive)
  const { data: savedData } = useSavedClips(!!isSignedIn)
  // Trace what the saved-clip list returns (does a just-saved clip show up?).
  useEffect(() => {
    slog('GET /buffer/me/clips →', savedData?.length ?? 0, 'saved clip(s)', (savedData ?? []).map((c) => c.id))
  }, [savedData])

  // ── normalise both data sources into time-positioned lane clips ──
  // Clips are labelled by the stream TITLE; the start time + duration live on the
  // sublabel + the left ruler. Buffered sessions fall back to the time until the
  // backend carries `title` onto the buffer descriptor (handoff 2026-06-11); saved
  // clips carry their saved name.
  const buffered = useMemo<LaneClip[]>(() => {
    return (buffer?.sessions ?? []).map((s) => {
      const startMs = sessionStartMs(s)
      const endMs = sessionEndMs(s)
      return {
        id: s.id,
        startMs,
        endMs,
        label: s.title?.trim() || fmtTime(startMs),
        sublabel: fmtDur((endMs - startMs) / 1000),
        posterUrl: s.thumbnailUrl,
      }
    })
  }, [buffer])
  const saved = useMemo<LaneClip[]>(() => {
    return (savedData ?? []).map((c) => ({
      id: c.id,
      startMs: c.startAtMs,
      endMs: c.endAtMs,
      label: c.name?.trim() || fmtTime(c.startAtMs),
      sublabel: fmtDur((c.endAtMs - c.startAtMs) / 1000),
      posterUrl: c.thumbnailUrl,
    }))
  }, [savedData])

  // Saving COPIES a buffer span into a durable Clip (new id) — the buffer session
  // stays. So this isn't a "move": dragging a buffered clip right CREATES a saved
  // copy (the block springs back), and dragging a saved clip left DELETES the copy
  // (un-save). `pendingDelete` optimistically hides a clip being un-saved.
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set())
  // Source session ids being saved right now — optimistically moved to the saved lane so the
  // dragged block lands there immediately, before the POST + refetch round-trip resolves.
  const [movingToSaved, setMovingToSaved] = useState<Set<string>>(new Set())

  // The real server-backed saved clips (minus any being un-saved).
  const realSaved = useMemo(() => saved.filter((c) => !pendingDelete.has(c.id)), [saved, pendingDelete])
  // Optimistic placeholder in the saved lane for each session mid-save whose real Clip
  // hasn't arrived yet (`pending:` id; same window/label → seamless swap when it lands).
  const optimisticSaved = useMemo(
    () => buffered.filter((b) => movingToSaved.has(b.id) && !savedClipCovers(b, realSaved)).map((b) => ({ ...b, id: `pending:${b.id}` })),
    [buffered, movingToSaved, realSaved],
  )
  const savedLane = useMemo(() => [...realSaved, ...optimisticSaved], [realSaved, optimisticSaved])
  // Saving MOVES a clip (it must not show in both lanes): a buffered session drops out of the
  // buffer lane while moving, and once a real saved clip covers its window. Un-saving (the clip
  // leaves `realSaved` via pendingDelete / refetch) brings the session back automatically.
  const bufferedLane = useMemo(
    () => buffered.filter((b) => !movingToSaved.has(b.id) && !savedClipCovers(b, realSaved)),
    [buffered, movingToSaved, realSaved],
  )
  const allClips = useMemo(() => [...bufferedLane, ...savedLane], [bufferedLane, savedLane])
  const hasAny = allClips.length > 0

  // Drop the optimistic flag once the session's real Clip lands (covers it) or it vanishes —
  // the placeholder is replaced by the real saved clip without a flicker.
  useEffect(() => {
    setMovingToSaved((prev) => {
      if (!prev.size) return prev
      const next = new Set(prev)
      let changed = false
      for (const id of prev) {
        const b = buffered.find((x) => x.id === id)
        if (!b || savedClipCovers(b, realSaved)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [buffered, realSaved])

  // A just-saved clip is processed async (status:'processing' → 'ready'), so it
  // doesn't appear in the list immediately. Invalidate now + a few times after, so
  // it lands in the saved lane once ready. (Replace with Aaron's ready push later.)
  const refetchSavedSoon = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['buffer', 'clips'] })
    const t1 = setTimeout(() => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }), 3000)
    const t2 = setTimeout(() => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }), 8000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [qc])

  // Drag a BUFFERED clip right → save a durable copy of its window. The POST is
  // synchronous server-side (returns once the clip is `ready`), so on success the
  // clip appears on the next refetch. Surface failures (quota / no-footage / promote
  // error) instead of swallowing them — silent failure is why a save "won't stick".
  // `[clips-save]` traces print to the Metro terminal (dev only) for diagnosing.
  const saveClip = useCallback(
    (clip: LaneClip) => {
      // The backend requires a non-empty `kinds`. Resolve the captured source tracks
      // from the buffer session(s) the window covers (union across a cross-session
      // span); fall back to camera if a session reports none.
      const kindSet = new Set<string>()
      for (const s of buffer?.sessions ?? []) {
        if (sessionEndMs(s) > clip.startMs && sessionStartMs(s) < clip.endMs) s.kinds.forEach((k) => kindSet.add(k))
      }
      const kinds = kindSet.size ? [...kindSet] : ['camera']
      const payload = { startAtMs: Math.round(clip.startMs), endAtMs: Math.round(clip.endMs), name: clip.label, kinds }
      slog('POST /buffer/me/clips →', payload, `(window ${Math.round((payload.endAtMs - payload.startAtMs) / 1000)}s)`)
      setMovingToSaved((prev) => new Set(prev).add(clip.id)) // optimistic move → saved lane
      bufferApi
        .saveClip(payload)
        .then((res) => {
          slog('SAVE OK → clipId', res.clipId, '— refetching saved lane')
          refetchSavedSoon()
        })
        .catch((err: unknown) => {
          setMovingToSaved((prev) => {
            const next = new Set(prev)
            next.delete(clip.id) // revert the optimistic move
            return next
          })
          const e = err as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string }
          slog('SAVE FAILED — status', e.response?.status, '— body', JSON.stringify(e.response?.data), '— msg', e.message)
          const msg = e.response?.data?.message ?? e.response?.data?.error ?? e.message ?? 'Could not save clip'
          Alert.alert('Save failed', msg)
        })
    },
    [buffer, refetchSavedSoon],
  )

  // Drag a SAVED clip left → un-save (delete the durable copy). Optimistically hide
  // it; revert if the delete fails.
  const unsaveClip = useCallback(
    (clip: LaneClip) => {
      setPendingDelete((prev) => new Set(prev).add(clip.id))
      bufferApi
        .deleteSavedClip(clip.id)
        .then(() => qc.invalidateQueries({ queryKey: ['buffer', 'clips'] }))
        .catch(() =>
          setPendingDelete((prev) => {
            const next = new Set(prev)
            next.delete(clip.id)
            return next
          }),
        )
    },
    [qc],
  )

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

  // Ghosted ruler: a time mark at each clip's start (top edge), deduped so labels don't
  // collide, plus a "now" mark at the bottom.
  const rulerTicks = useMemo<RulerTick[]>(() => {
    const sorted = allClips
      .filter((c) => Number.isFinite(c.startMs))
      .map((c) => ({ c, top: layout.pos.get(c.id)?.top }))
      .filter((x): x is { c: LaneClip; top: number } => x.top != null)
      .sort((a, b) => a.top - b.top)
    const out: RulerTick[] = []
    let lastY = -Infinity
    for (const { c, top } of sorted) {
      if (top - lastY < MIN_TICK_GAP) continue
      out.push({ y: top, label: fmtTime(c.startMs) })
      lastY = top
    }
    if (contentHeight - lastY >= MIN_TICK_GAP) out.push({ y: contentHeight, label: 'now', now: true })
    return out
  }, [allClips, layout, contentHeight])

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
  // Mirror px into the shared value in an effect (not during render — reanimated's
  // strict mode warns on render-time writes); the pinch gesture reads it on start.
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
          {/* Spacer aligning the lane labels over the gutter-offset lanes below. */}
          <View style={{ width: GUTTER_W }} />
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
                {/* Ghosted time-mark ruler down the left gutter. */}
                <ClipTimeRuler ticks={rulerTicks} width={GUTTER_W} />
                {/* Collapsed-time gap markers across both lanes (right of the gutter). */}
                {layout.gaps.map((g, i) => (
                  <View key={`gap-${i}`} style={[styles.gapBand, { top: g.yTop, left: GUTTER_W }]}>
                    <TimeGapMarker height={g.height} label={fmtGap(g.ms)} />
                  </View>
                ))}
                <View style={[styles.lanesRow, { left: GUTTER_W }]} onLayout={(e) => setLanesRowW(e.nativeEvent.layout.width)}>
                  <ClipLane
                    clips={bufferedLane}
                    tone="buffered"
                    posOf={posOf}
                    onOpenClip={(c) => openClip(c, 'buffered')}
                    reachPx={reachPx}
                    onMoveClip={saveClip}
                  />
                  <View style={styles.laneGap} />
                  <ClipLane
                    clips={savedLane}
                    tone="saved"
                    posOf={posOf}
                    onOpenClip={(c) => openClip(c, 'saved')}
                    reachPx={reachPx}
                    onMoveClip={unsaveClip}
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
