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

const HANDLE_W = 16

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
  const width = Math.max(HANDLE_W * 2, widthPx)
  return (
    <>
      <View style={[styles.frame, { left: leftPx, width }, blocked && styles.frameBlocked, style]}>
        {withGesture(
          inGesture,
          <View style={[styles.handle, styles.handleL, blocked && styles.handleBlocked]}>
            <View style={styles.grip} />
          </View>,
        )}
        {withGesture(
          centerGesture,
          <View style={styles.center}>
            <View style={styles.moveDots}>
              <View style={styles.moveDot} />
              <View style={styles.moveDot} />
            </View>
          </View>,
        )}
        {withGesture(
          outGesture,
          <View style={[styles.handle, styles.handleR]}>
            <View style={styles.grip} />
          </View>,
        )}
      </View>
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
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  frameBlocked: {
    borderColor: theme.colors.warn,
  },
  handle: {
    width: HANDLE_W,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent.default,
  },
  handleL: {},
  handleR: {},
  handleBlocked: {
    backgroundColor: theme.colors.warn,
  },
  grip: {
    width: 2,
    height: 20,
    borderRadius: 1,
    backgroundColor: theme.colors.text.inverse,
    opacity: 0.8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
