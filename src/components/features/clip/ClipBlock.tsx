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

import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS, type SharedValue } from 'react-native-reanimated'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { FilmStrip } from './FilmStrip'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type ClipTone = 'buffered' | 'saved'

// Below this px height the block collapses to a thin labelled bar (no film strip / stacked text).
const COMPACT_H = 44


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
          <FilmStrip cellLeftSv={cellLeftSv} widthPx={widthPx} posterUrl={posterUrl} />
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
