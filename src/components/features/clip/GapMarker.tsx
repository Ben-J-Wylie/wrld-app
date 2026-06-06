// src/components/features/clip/GapMarker.tsx
//
// Buffer-trim clip editor (clips initiative · C2). The BufferTimeline collapses
// every real-time gap between recorded segments to a single fixed-width marker so
// the user can see that time was skipped without the gap eating timeline space.
// Segments scale with zoom; gaps stay GAP_MARKER_WIDTH px wide at every level.
//
// Presentational only — a break glyph over the skipped-duration label. Width is a
// constant the parent (BufferTimeline) reads via GAP_MARKER_WIDTH when laying out
// the track.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export const GAP_MARKER_WIDTH = 50

type Props = {
  skippedMs: number
  style?: StyleProp<ViewStyle>
}

export function GapMarker({ skippedMs, style }: Props) {
  return (
    <View style={[styles.gap, style]}>
      <Text variant="monoLabel" color={theme.colors.text.subtle} style={styles.glyph}>
        ⋮
      </Text>
      <Text variant="monoCaption" color={theme.colors.text.muted}>
        {formatSkipped(skippedMs)}
      </Text>
    </View>
  )
}

// Largest sensible unit, rounded — "45s" / "40m" / "3h" / "2d".
function formatSkipped(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)}d`
}

const styles = StyleSheet.create({
  gap: {
    width: GAP_MARKER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: theme.colors.bg.primary,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border.strong,
  },
  glyph: {
    letterSpacing: 0,
    lineHeight: 10,
  },
})
