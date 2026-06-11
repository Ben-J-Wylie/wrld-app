// src/components/features/clip/ClipBracket.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The in/out selection drawn over
// the BufferTimeline track: an accent frame with a left (in-point) + right (out-point)
// grip handle, a center move-zone, and a live readout pill above it.
//
// Presentational. The parent (BufferTimeline) owns all time math + creates the three
// RNGH Pan gestures (in / out / center) — each blocks the timeline pan so an edge drag
// resizes the clip instead of scrubbing. This component just positions the frame in
// pixels, renders the readout, and wraps each zone in a GestureDetector. When the
// parent clamps at a SavedClipRegion boundary it passes `blocked` (warn tint).
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import type { ReactElement } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { GestureDetector, type GestureType } from 'react-native-gesture-handler'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

const HANDLE_W = 26 // touch target per edge — sits OUTSIDE the frame, flanking the crop
// The in/out grip: a slim "D" — flat on the INNER edge (flush with the frame's thin 2px
// precision line), bulging OUTWARD at the vertical middle. Placed just outside the frame
// so the selection itself can be any width — down to nothing (it collapses entirely).
const BULB_W = 7
const BULB_H = 18

type Props = {
  leftPx: number
  widthPx: number
  blocked?: boolean
  // RNGH gestures created by BufferTimeline (each blocks the timeline pan). Optional
  // so the gallery can render a static, non-interactive bracket.
  inGesture?: GestureType
  outGesture?: GestureType
  centerGesture?: GestureType
  style?: StyleProp<ViewStyle>
}

function withGesture(g: GestureType | undefined, node: ReactElement): ReactElement {
  return g ? <GestureDetector gesture={g}>{node}</GestureDetector> : node
}

export function ClipBracket({ leftPx, widthPx, blocked, inGesture, outGesture, centerGesture, style }: Props) {
  // The frame is the ACTUAL selection width (no handle-fit floor — the handles live
  // outside it), so it can be any width and collapse entirely. A 2px floor just keeps the
  // precision line visible.
  const w = Math.max(2, widthPx)
  return (
    <>
      {/* The selection box = the move zone (drag anywhere inside to slide the clip). */}
      {withGesture(
        centerGesture,
        <View style={[styles.frame, { left: leftPx, width: w }, blocked && styles.frameBlocked, style]}>
          {w >= 24 && (
            <View style={styles.moveDots}>
              <View style={styles.moveDot} />
              <View style={styles.moveDot} />
            </View>
          )}
        </View>,
      )}
      {/* In handle — just OUTSIDE the left edge; bulb flush-flat on the inner side, bulging out. */}
      {withGesture(
        inGesture,
        <View style={[styles.handle, styles.handleL, { left: leftPx - HANDLE_W }]}>
          <View style={[styles.bulb, styles.bulbL, blocked && styles.bulbBlocked]}>
            <View style={styles.grip} />
          </View>
        </View>,
      )}
      {/* Out handle — just OUTSIDE the right edge. */}
      {withGesture(
        outGesture,
        <View style={[styles.handle, styles.handleR, { left: leftPx + w }]}>
          <View style={[styles.bulb, styles.bulbR, blocked && styles.bulbBlocked]}>
            <View style={styles.grip} />
          </View>
        </View>,
      )}
      {/* No time readout on the selection — only a transient "blocked" pill when an
          edge drag hits a saved-region boundary. */}
      {blocked && (
        <View style={[styles.readout, styles.readoutBlocked, { left: leftPx }]} pointerEvents="none">
          <Text variant="monoValue" color={theme.colors.text.inverse}>
            Blocked · saved region
          </Text>
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameBlocked: {
    borderColor: theme.colors.warn,
  },
  // Transparent touch column sitting OUTSIDE the frame (`left` set inline), vertically
  // centred; the bulb hugs the inner edge (flush with the frame's 2px precision line).
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_W,
    justifyContent: 'center',
  },
  handleL: { alignItems: 'flex-end' }, // bulb hugs the frame's left edge, bulges left (out)
  handleR: { alignItems: 'flex-start' }, // bulb hugs the frame's right edge, bulges right (out)
  // The grip bulb: flat INNER side (against the frame), rounded (bulging) OUTER side.
  bulb: {
    width: BULB_W,
    height: BULB_H,
    backgroundColor: theme.colors.accent.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulbL: {
    borderTopLeftRadius: BULB_H / 2,
    borderBottomLeftRadius: BULB_H / 2,
  },
  bulbR: {
    borderTopRightRadius: BULB_H / 2,
    borderBottomRightRadius: BULB_H / 2,
  },
  bulbBlocked: {
    backgroundColor: theme.colors.warn,
  },
  grip: {
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: theme.colors.text.inverse,
    opacity: 0.85,
  },
  moveDots: {
    flexDirection: 'row',
    gap: 3,
    opacity: 0.5,
  },
  moveDot: {
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: theme.colors.accent.default,
  },
  readout: {
    position: 'absolute',
    top: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.text.primary,
  },
  readoutBlocked: {
    backgroundColor: theme.colors.warn,
  },
})
