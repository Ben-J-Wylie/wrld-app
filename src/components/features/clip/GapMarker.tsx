// src/components/features/clip/GapMarker.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The collapsed-gap divider in
// BufferTimeline — a thin (10px) break between recorded filmstrip segments, marking
// real-time the buffer skipped. No duration label (2026-06-06): the gap's duration
// is surfaced in the scrub field's gap card while the playhead crosses it, not on the
// timeline itself. Recorded segments scale with zoom; gaps stay GAP_MARKER_WIDTH px.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '@/tokens/theme'

export const GAP_MARKER_WIDTH = 10

type Props = {
  style?: StyleProp<ViewStyle>
}

export function GapMarker({ style }: Props) {
  return <View style={[styles.gap, style]} />
}

const styles = StyleSheet.create({
  gap: {
    width: GAP_MARKER_WIDTH,
    backgroundColor: theme.colors.bg.primary,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border.strong,
  },
})
