// src/components/features/clip/ClipBlock.tsx
//
// One clip on the clips landing grid — a buffered recording session or a saved clip,
// drawn to scale on the time axis (the parent lane sets its top/height). Shows the poster
// frame + a name/duration label when it's tall enough, and degrades to a thin labelled bar
// when the zoom makes it short. Double-tap opens the clip editor.
//
// `tone` distinguishes the two lanes: `buffered` (neutral paper) vs `saved` (accent-tinted).
// Drag-to-save is layered on by the lane/screen (a Pan gesture) — this stays presentational.
// See DESIGN.md Section 3 (Clips landing grid).

import { memo, useEffect, useRef, useState } from 'react'
import { Image } from 'expo-image'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS, type SharedValue } from 'react-native-reanimated'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type ClipTone = 'buffered' | 'saved'

// Below this px height the block collapses to a thin labelled bar (no film strip / stacked text).
const COMPACT_H = 44

// ── film strip (the top band) ──
// The top band is a FILM STRIP: square rounded cells with a sprocket-hole band above and below.
// The cell size is CONSTANT regardless of zoom (the clip widens → MORE cells fit; it never stretches
// a cell). Cells are phase-anchored to the GLOBAL timeline grid (`cellLeftSv`, the clip's animated
// content-left), so they (a) skate as the timeline scrolls — revealed at the now edge, consumed at the
// reaper edge — and (b) LINE UP across a snip seam (adjacent pieces of one session share the grid).
const FILM_SPROCKET_H = 6 // height of each sprocket band (top + bottom)
const FILM_GAP = 4 // gap between cells
const FILM_CELL = 22 // square cell size — CONSTANT across zoom
const FILM_PITCH = FILM_CELL + FILM_GAP // one cell's footprint on the grid
const FILM_SPK_PITCH = FILM_PITCH / 2 // two sprockets per cell
const FILM_SPK_W = 4
const FILM_MAX_CELLS = 140 // backstop so a very wide (zoomed-in) clip can't render unbounded cells

// How many cells the strip renders for a given clip width (+ a 2-cell buffer so the smoothly-growing
// (UI-thread) clip edge always has pre-rendered cells to reveal — no gap-then-pop at the now edge).
function filmCellCount(widthPx?: number) {
  return Math.min(FILM_MAX_CELLS, Math.max(1, Math.ceil(((widthPx ?? FILM_PITCH) + FILM_PITCH * 2) / FILM_PITCH)))
}

// One repeating film strip, translated to sit on the global cell grid (so it skates + seam-aligns).
// SMOOTHNESS (2026-06-16): the strip is a stable set of Views that only TRANSLATES, so we
// (1) `memo` it on the CELL COUNT — a sub-cell width change (the 1 s nowMs tick, the per-frame live
//     build) no longer re-renders/re-reconciles the cell Views; only crossing a whole cell does; and
// (2) RASTERIZE it (`shouldRasterizeIOS` / `renderToHardwareTextureAndroid`) so the per-frame translate
//     — skating under the playhead, reaper consumption — is a cheap GPU texture move, not a re-composite
//     of every cell + sprocket View. (Only translates here, never scales, so the texture stays crisp.)
const FilmRow = memo(
  function FilmRow({ cellLeftSv, widthPx, posterUrl }: { cellLeftSv?: SharedValue<number>; widthPx?: number; posterUrl?: string | null }) {
    const cells = filmCellCount(widthPx)
    const sprockets = cells * 2
    // Translate the whole strip by the clip's content-left modulo the pitch → its cells land on the
    // global grid (k·PITCH). For the reaper-clamped oldest clip cellLeftSv is animated, so the strip
    // skates and the leftmost cells clip away (consumed); for the rest it's static + the content scroll
    // moves it for free. A static fallback (phase 0) covers the gallery (no SV).
    const rowStyle = useAnimatedStyle(() => {
      const left = cellLeftSv ? cellLeftSv.value : 0
      const phase = ((left % FILM_PITCH) + FILM_PITCH) % FILM_PITCH
      return { transform: [{ translateX: -phase }] }
    })
    return (
      <Animated.View
        style={[styles.filmRow, rowStyle, { width: cells * FILM_PITCH }]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        <View style={styles.sprocketBand}>
          {Array.from({ length: sprockets }).map((_, i) => (
            <View key={i} style={styles.sprocket} />
          ))}
        </View>
        <View style={styles.cellBand}>
          {Array.from({ length: cells }).map((_, i) => (
            <View key={i} style={styles.filmCell}>
              {posterUrl ? <Image source={{ uri: posterUrl }} style={styles.filmImg} contentFit="cover" transition={120} /> : null}
            </View>
          ))}
        </View>
        <View style={styles.sprocketBand}>
          {Array.from({ length: sprockets }).map((_, i) => (
            <View key={i} style={styles.sprocket} />
          ))}
        </View>
      </Animated.View>
    )
  },
  // Re-render ONLY when the visible cell count changes (or the frame source) — not on every sub-cell
  // width tick. cellLeftSv is a stable ref; the animated translate updates on the UI thread regardless.
  (a, b) => a.cellLeftSv === b.cellLeftSv && a.posterUrl === b.posterUrl && filmCellCount(a.widthPx) === filmCellCount(b.widthPx),
)

type Props = {
  heightPx: number
  widthPx?: number // the block's drawn width — drives the corner-thumb vs centred-glyph fallback
  label: string // primary (name / time)
  sublabel?: string // duration / sources
  posterUrl?: string | null
  tone: ClipTone
  draft?: boolean // an unsaved edit → dashed accent outline + DRAFT tag
  selected?: boolean // shown in the sticky viewer → accent outline
  onSelect?: () => void // single-tap → preview in the viewer
  onOpen?: () => void // double-tap → editor
  // Drag-to-cross (save / un-save): the allowed direction along `dragAxis` (+1 = right/down →
  // saved, -1 = left/up → buffered), the px distance to the other lane, and the commit callback
  // once dragged past halfway. Omit `dragDir` to make the block static. `dragAxis` is 'x' for the
  // side-by-side (vertical grid) lanes, 'y' for the stacked (horizontal timeline) lanes.
  dragDir?: 1 | -1
  dragAxis?: 'x' | 'y'
  reachPx?: number
  onCross?: () => void
  // Fired (true) when a lane-drag gesture begins, (false) when it finalises. The host uses this to
  // HOLD the timeline camera for the duration of the grab so a clip being dragged across lanes while
  // playback runs is a stable target (it doesn't scroll out from under the finger). See ClipsScreen.
  onDragActive?: (active: boolean) => void
  // When the timeline pinch grabs (a 2nd finger lands), the drag must yield: run simultaneously
  // with the pinch so it can take over mid-drag, and spring the block back the instant the signal
  // flips (a graceful return to its current lane instead of a half-committed cross).
  yieldToGesture?: React.MutableRefObject<GestureType | undefined>
  yieldSignal?: SharedValue<boolean>
  // The clip's animated content-left (from AnimatedClip). Phase-anchors the film strip to the global
  // timeline grid so cells skate (revealed at now, consumed at the reaper) + line up across snip seams.
  // Omitted (gallery) → a static strip (phase 0).
  cellLeftSv?: SharedValue<number>
  style?: StyleProp<ViewStyle>
}

export function ClipBlock({ heightPx, widthPx, label, sublabel, posterUrl, tone, draft, selected, onSelect, onOpen, dragDir, dragAxis = 'x', reachPx, onCross, onDragActive, yieldToGesture, yieldSignal, cellLeftSv, style }: Props) {
  const lastTap = useRef(0)
  const onPress = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      onOpen?.() // double tap → open editor
    } else {
      lastTap.current = now
      onSelect?.() // single tap → preview in the viewer (fires immediately)
    }
  }
  const compact = heightPx < COMPACT_H
  const saved = tone === 'saved'

  // ── drag-to-cross ──
  const tx = useSharedValue(0)
  const [dragging, setDragging] = useState(false)
  const dirSv = useSharedValue(dragDir ?? 0)
  const reachSv = useSharedValue(reachPx ?? 0)
  useEffect(() => {
    dirSv.value = dragDir ?? 0
    reachSv.value = reachPx ?? 0
  }, [dragDir, reachPx, dirSv, reachSv])
  const onCrossRef = useRef(onCross)
  onCrossRef.current = onCross
  const fireCross = () => onCrossRef.current?.()
  const onDragActiveRef = useRef(onDragActive)
  onDragActiveRef.current = onDragActive
  const fireDragActive = (active: boolean) => onDragActiveRef.current?.(active)

  // Drag along `dragAxis`: horizontal for side-by-side lanes, vertical for stacked lanes.
  const isY = dragAxis === 'y'
  const yieldSv = yieldSignal
  const pan = useRef(
    (() => {
      let g = (isY
        ? Gesture.Pan().activeOffsetY([-8, 8]).failOffsetX([-12, 12])
        : Gesture.Pan().activeOffsetX([-8, 8]).failOffsetY([-12, 12])
      ).maxPointers(1) // single-finger only → a 2-finger pinch never drags a clip between lanes
      // Run alongside the timeline pinch so a 2nd finger can take over mid-drag.
      if (yieldToGesture) g = g.simultaneousWithExternalGesture(yieldToGesture)
      return g
        .onStart(() => {
          'worklet'
          runOnJS(setDragging)(true)
          runOnJS(fireDragActive)(true) // → host holds the timeline camera for the grab
        })
        .onUpdate((e) => {
          'worklet'
          if (yieldSv && yieldSv.value) {
            // A 2nd finger landed → yield to the pinch: glide back to this lane, stop dragging.
            if (tx.value !== 0) tx.value = withTiming(0, { duration: 140 })
            return
          }
          const dir = dirSv.value
          if (dir === 0) return
          const reach = reachSv.value
          const t = isY ? e.translationY : e.translationX
          tx.value = dir > 0 ? Math.max(0, Math.min(reach, t)) : Math.min(0, Math.max(-reach, t))
        })
        .onEnd(() => {
          'worklet'
          if (yieldSv && yieldSv.value) {
            tx.value = withTiming(0, { duration: 140 }) // pinch took over — don't commit a cross
            return
          }
          const dir = dirSv.value
          const reach = reachSv.value
          const crossed = dir !== 0 && (dir > 0 ? tx.value >= reach / 2 : tx.value <= -reach / 2)
          if (crossed) {
            // Committed: leave tx put — the host optimistically moves the clip to the other lane,
            // so this block unmounts in place (springing back here caused the "jump back").
            runOnJS(fireCross)()
          } else {
            tx.value = withTiming(0, { duration: 160 })
          }
        })
        .onFinalize(() => {
          'worklet'
          runOnJS(setDragging)(false)
          runOnJS(fireDragActive)(false) // → host releases the camera hold (onFinalize ALWAYS fires, even on a cross/cancel)
        })
    })(),
  ).current

  const dragStyle = useAnimatedStyle(() => ({ transform: isY ? [{ translateY: tx.value }] : [{ translateX: tx.value }] }))

  const block = (
    <Pressable
      variant="none"
      accessibilityRole="button"
      accessibilityLabel={`${label}${sublabel ? ` · ${sublabel}` : ''} — double-tap to edit${dragDir ? `, drag ${dragDir > 0 ? 'right to save' : 'left to un-save'}` : ''}`}
      onPress={onPress}
      style={[
        styles.block,
        saved ? styles.blockSaved : styles.blockBuffered,
        draft && styles.blockDraft,
        selected && styles.blockSelected,
        { height: heightPx },
        style,
      ]}
    >
      {/* A bordered paper band across the top of the block (with margins): the FILM STRIP — square
          rounded cells between two sprocket-hole bands. Constant cell size across zoom; cells are
          phase-anchored to the global timeline grid so they skate (revealed at now, consumed at the
          reaper) and line up across snip seams. Frames are placeholders for now (posterUrl repeated
          if present) — correct per-cell thumbs are a later pass. Overflow clips to the band. */}
      {!compact ? (
        <View style={styles.topSpan} pointerEvents="none">
          <FilmRow cellLeftSv={cellLeftSv} widthPx={widthPx} posterUrl={posterUrl} />
        </View>
      ) : null}

      {compact ? (
        <View style={styles.compactRow}>
          <View style={[styles.dot, saved ? styles.dotSaved : styles.dotBuffered]} />
          <Text variant="monoCaption" color={theme.colors.text.primary} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={styles.meta}>
          <Text variant="monoLabel" color={theme.colors.text.primary} numberOfLines={1}>
            {label}
          </Text>
          {sublabel ? (
            <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  )

  // Explicit height from heightPx — don't rely on the parent slot filling a flex child through
  // the GestureDetector (that chain was leaving blocks collapsed to their content = thin lines).
  // Static block when not draggable; otherwise wrap in the cross-lane drag.
  if (!dragDir) return <View style={[styles.fill, { height: heightPx }]}>{block}</View>
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, { height: heightPx }, dragStyle, dragging && styles.dragElevated]}>
        {block}
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
  },
  // While being dragged across lanes: lift above neighbours + a soft shadow.
  dragElevated: {
    zIndex: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  block: {
    width: '100%',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  blockBuffered: {
    backgroundColor: theme.colors.bg.panelHi,
    borderColor: theme.colors.border.strong,
  },
  // Saved clips read the same as buffer clips — the lane + title carry the distinction, not colour.
  blockSaved: {
    backgroundColor: theme.colors.bg.panelHi,
    borderColor: theme.colors.border.strong,
  },
  // Currently shown in the sticky viewer — a stronger accent outline.
  blockSelected: {
    borderColor: theme.colors.accent.default,
    borderWidth: 2,
  },
  // An unsaved draft — dashed accent outline.
  blockDraft: {
    borderColor: theme.colors.accent.default,
    borderStyle: 'dashed',
  },
  // The film-strip band spanning the top of the block (with margins), fixed height. Holds the
  // FilmRow (sprockets · cells · sprockets); overflow clips the strip to the band so cells reveal/
  // consume cleanly at the edges. Same stroke as the clip box.
  topSpan: {
    position: 'absolute',
    top: theme.spacing.xs,
    left: theme.spacing.xs,
    right: theme.spacing.xs,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    overflow: 'hidden',
  },
  // The translated film strip: a column of [sprocket band · cell band · sprocket band], left-anchored
  // and shifted onto the global grid. Sizes to its content width (the rendered cells).
  filmRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  // A horizontal band of sprocket holes (top + bottom), denser than the cells (two per cell).
  sprocketBand: {
    height: FILM_SPROCKET_H,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sprocket: {
    width: FILM_SPK_W,
    height: 3,
    borderRadius: 1.5,
    marginRight: FILM_SPK_PITCH - FILM_SPK_W,
    backgroundColor: theme.colors.border.strong,
  },
  // The row of square rounded film cells (the frames), constant size regardless of zoom.
  cellBand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filmCell: {
    width: FILM_CELL,
    height: FILM_CELL,
    marginRight: FILM_GAP,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.panelHi,
    overflow: 'hidden',
  },
  filmImg: {
    width: '100%',
    height: '100%',
  },
  meta: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: 1,
  },
  compactRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotBuffered: { backgroundColor: theme.colors.text.muted },
  dotSaved: { backgroundColor: theme.colors.accent.default },
})
