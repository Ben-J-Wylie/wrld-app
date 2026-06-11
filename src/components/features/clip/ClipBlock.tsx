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
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type ClipTone = 'buffered' | 'saved'

// Below this px height the block collapses to a thin labelled bar (no poster / stacked text).
const COMPACT_H = 44

type Props = {
  heightPx: number
  label: string // primary (name / time)
  sublabel?: string // duration / sources
  posterUrl?: string | null
  tone: ClipTone
  onOpen?: () => void // double-tap → editor
  // Drag-to-cross (save / un-save): the allowed horizontal direction (1 = right → saved,
  // -1 = left → buffered), the px distance to the other lane, and the commit callback once
  // the block is dragged past halfway. Omit `dragDir` to make the block static.
  dragDir?: 1 | -1
  reachPx?: number
  onCross?: () => void
  style?: StyleProp<ViewStyle>
}

export function ClipBlock({ heightPx, label, sublabel, posterUrl, tone, onOpen, dragDir, reachPx, onCross, style }: Props) {
  const lastTap = useRef(0)
  const onPress = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      onOpen?.()
    } else {
      lastTap.current = now
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

  const pan = useRef(
    Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onStart(() => {
        'worklet'
        runOnJS(setDragging)(true)
      })
      .onUpdate((e) => {
        'worklet'
        const dir = dirSv.value
        if (dir === 0) return
        const reach = reachSv.value
        tx.value = dir > 0 ? Math.max(0, Math.min(reach, e.translationX)) : Math.min(0, Math.max(-reach, e.translationX))
      })
      .onEnd(() => {
        'worklet'
        const dir = dirSv.value
        const reach = reachSv.value
        const crossed = dir !== 0 && (dir > 0 ? tx.value >= reach / 2 : tx.value <= -reach / 2)
        if (crossed) {
          // Leave tx put — the host moves the clip to the other lane and this block unmounts.
          runOnJS(fireCross)()
        } else {
          tx.value = withTiming(0, { duration: 160 })
        }
      })
      .onFinalize(() => {
        'worklet'
        runOnJS(setDragging)(false)
      }),
  ).current

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }))

  const block = (
    <Pressable
      variant="none"
      accessibilityRole="button"
      accessibilityLabel={`${label}${sublabel ? ` · ${sublabel}` : ''} — double-tap to edit${dragDir ? `, drag ${dragDir > 0 ? 'right to save' : 'left to un-save'}` : ''}`}
      onPress={onPress}
      style={[styles.block, saved ? styles.blockSaved : styles.blockBuffered, { height: heightPx }, style]}
    >
      {posterUrl && !compact ? (
        <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : null}
      {/* Scrim so the label reads over a poster. */}
      {posterUrl && !compact ? <View style={styles.scrim} pointerEvents="none" /> : null}

      {compact ? (
        <View style={styles.compactRow}>
          <View style={[styles.dot, saved ? styles.dotSaved : styles.dotBuffered]} />
          <Text variant="monoCaption" color={theme.colors.text.primary} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={styles.meta}>
          <Text
            variant="monoLabel"
            color={posterUrl ? theme.colors.text.inverse : theme.colors.text.primary}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              variant="monoCaption"
              color={posterUrl ? 'rgba(255,255,255,0.85)' : theme.colors.text.muted}
              numberOfLines={1}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
      )}

      {saved && !compact ? (
        <View style={styles.badge} pointerEvents="none">
          <Icon name="bookmark" size="sm" color={theme.colors.accent.default} />
        </View>
      ) : null}
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
  blockSaved: {
    backgroundColor: theme.colors.accent.surface,
    borderColor: theme.colors.accent.border,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,16,12,0.35)',
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
  badge: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.primary,
  },
})
