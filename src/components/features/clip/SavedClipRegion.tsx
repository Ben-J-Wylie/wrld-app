// src/components/features/clip/SavedClipRegion.tsx
//
// Buffer-trim clip editor (clips initiative · C2). A read-only band over a span of
// the buffer that has already been saved as a clip. New clip brackets can't enter
// one (BufferTimeline clamps them at the edge); deleting that clip from the Library
// removes the band and frees the span for reuse.
//
// Presentational only — the parent (BufferTimeline) positions it absolutely over
// the track (left/width from the saved span at the current zoom) via `style`.
// RN has no built-in diagonal hatch (see the Timeline `trimOverlay` deferral), so
// "taken" is conveyed with an accent-surface fill + a solid accent top band +
// accent borders + a "SAVED" micro-label.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  label?: string
  style?: StyleProp<ViewStyle>
}

export function SavedClipRegion({ label = 'SAVED', style }: Props) {
  return (
    <View style={[styles.region, style]} pointerEvents="none">
      <View style={styles.topBand} />
      <Text variant="monoLabel" color={theme.colors.accent.default} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  region: {
    backgroundColor: theme.colors.accent.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.accent.border,
    overflow: 'hidden',
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.accent.default,
    opacity: 0.6,
  },
  label: {
    position: 'absolute',
    top: theme.spacing.xs,
    left: theme.spacing.xs,
  },
})
