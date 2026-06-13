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
import { Image } from 'expo-image'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS, type SharedValue } from 'react-native-reanimated'
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type ClipTone = 'buffered' | 'saved'

// Below this px height the block collapses to a thin labelled bar (no poster / stacked text).
const COMPACT_H = 44
// The corner poster is 38px + its left/right inset; below this block width it can't fit, so we
// swap it for a centred clip glyph (the rotated `film` icon, matching the Clips tab).
const THUMB_FIT_MIN = 48

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
  // When the timeline pinch grabs (a 2nd finger lands), the drag must yield: run simultaneously
  // with the pinch so it can take over mid-drag, and spring the block back the instant the signal
  // flips (a graceful return to its current lane instead of a half-committed cross).
  yieldToGesture?: React.MutableRefObject<GestureType | undefined>
  yieldSignal?: SharedValue<boolean>
  style?: StyleProp<ViewStyle>
}

export function ClipBlock({ heightPx, widthPx, label, sublabel, posterUrl, tone, draft, selected, onSelect, onOpen, dragDir, dragAxis = 'x', reachPx, onCross, yieldToGesture, yieldSignal, style }: Props) {
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
      {/* A bordered paper span across the top of the block (with margins). It holds the poster
          when the box is wide enough; otherwise (too narrow at this zoom) the rotated `film`
          glyph that matches the Clips tab. `contain` letterboxes/pillarboxes the frame so it
          stays square inside the span for any aspect ratio. */}
      {!compact && (widthPx ?? Infinity) < THUMB_FIT_MIN ? (
        <View style={styles.topSpan} pointerEvents="none">
          <Icon name="film" size="md" rotate={90} color={theme.colors.text.muted} />
        </View>
      ) : posterUrl && !compact ? (
        <View style={styles.topSpan} pointerEvents="none">
          <View style={styles.thumbFrame}>
            <Image source={{ uri: posterUrl }} style={styles.thumbImg} contentFit="contain" transition={120} />
          </View>
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
  // A bordered paper strip spanning the top of the block (with margins), fixed height. Holds the
  // poster (square via `contain`, pillarboxed on the lightest paper) or the centred clip glyph.
  // Same stroke as the clip box.
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // A square frame around the poster (the span's height) — every thumb is the same size
  // regardless of orientation, with an additional inward-rounded stroke on its left/right.
  thumbFrame: {
    height: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.primary,
    overflow: 'hidden',
  },
  thumbImg: {
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
