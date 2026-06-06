// src/components/features/clip/ClipBracket.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The in/out selection drawn over
// the BufferTimeline track: an accent frame with a left (in-point) and right
// (out-point) grip handle, a center move-zone, and a live readout pill (duration +
// in→out timecodes) above it.
//
// Presentational. The parent (BufferTimeline) owns all time math — it positions the
// frame in pixels (leftPx / widthPx), formats the readout strings, and supplies the
// three PanResponder handler sets (one per zone). Edge drag = set in/out (duration
// changes); center drag = move the whole selection (duration fixed). When the parent
// clamps the selection at a SavedClipRegion boundary it passes `blocked`, which
// recolors the in-edge + readout to the warn tone.
//
// Lives inside the track container (position: relative, overflow: hidden); the frame
// fills the track height (top/bottom 0), the readout floats near the track top.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import {
  StyleSheet,
  View,
  type GestureResponderHandlers,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

const HANDLE_W = 16

type Props = {
  leftPx: number
  widthPx: number
  durationLabel: string
  rangeLabel: string
  blocked?: boolean
  inHandlers?: GestureResponderHandlers
  outHandlers?: GestureResponderHandlers
  centerHandlers?: GestureResponderHandlers
  style?: StyleProp<ViewStyle>
}

export function ClipBracket({
  leftPx,
  widthPx,
  durationLabel,
  rangeLabel,
  blocked,
  inHandlers,
  outHandlers,
  centerHandlers,
  style,
}: Props) {
  const width = Math.max(HANDLE_W * 2, widthPx)
  return (
    <>
      <View
        style={[styles.frame, { left: leftPx, width }, blocked && styles.frameBlocked, style]}
      >
        <View
          {...inHandlers}
          style={[styles.handle, styles.handleL, blocked && styles.handleBlocked]}
        >
          <View style={styles.grip} />
        </View>
        <View {...centerHandlers} style={styles.center}>
          <View style={styles.moveDots}>
            <View style={styles.moveDot} />
            <View style={styles.moveDot} />
          </View>
        </View>
        <View {...outHandlers} style={[styles.handle, styles.handleR]}>
          <View style={styles.grip} />
        </View>
      </View>
      <View style={[styles.readout, { left: leftPx }, blocked && styles.readoutBlocked]} pointerEvents="none">
        {blocked ? (
          <Text variant="monoValue" color={theme.colors.text.inverse}>
            Blocked · saved region
          </Text>
        ) : (
          <>
            <Text variant="monoValue" color={theme.colors.accent.bright}>
              {durationLabel}
            </Text>
            <Text variant="monoValue" color={theme.colors.text.inverse}>
              {` · ${rangeLabel}`}
            </Text>
          </>
        )}
      </View>
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
