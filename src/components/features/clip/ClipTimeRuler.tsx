// src/components/features/clip/ClipTimeRuler.tsx
//
// The ghosted time ruler down the left gutter of the Clips landing grid. Because the
// grid's axis collapses empty time (clips are per-clip blocks, gaps shrink to markers),
// a regular-interval ruler wouldn't line up — so the host hands this explicit ticks at
// the y-positions it knows (each clip's start, and "now" at the bottom). Each tick is a
// faint hairline + a small time label, read as a "this footage starts here" mark.
//
// Presentational: the host (ClipsScreen) owns the layout → tick math. See DESIGN.md
// Section 3 (Clips landing grid).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type RulerTick = { y: number; label: string; now?: boolean }

type Props = {
  ticks: RulerTick[]
  width: number
  style?: StyleProp<ViewStyle>
}

export function ClipTimeRuler({ ticks, width, style }: Props) {
  return (
    <View style={[styles.gutter, { width }, style]} pointerEvents="none">
      {ticks.map((t, i) => (
        <View key={`${t.label}-${i}`} style={[styles.tick, { top: t.y }]}>
          <View style={[styles.rule, t.now && styles.ruleNow]} />
          <Text variant="monoCaption" color={t.now ? theme.colors.accent.default : theme.colors.text.subtle}>
            {t.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  gutter: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  // Each tick sits at its y; the hairline marks the exact instant, the label reads below it.
  tick: {
    position: 'absolute',
    left: 0,
    right: theme.spacing.xs,
  },
  rule: {
    height: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  ruleNow: {
    backgroundColor: theme.colors.accent.border,
  },
})
