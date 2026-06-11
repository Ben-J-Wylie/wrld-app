// src/components/features/clip/TimeGapMarker.tsx
//
// A collapsed-time gap on the clips landing grid. Empty stretches between clips (and the
// trailing stretch up to "now") don't take their real height — they collapse to this fixed
// thin band across both lanes, labelled with how much time was skipped. Lets short clips
// keep a readable, proportional size without the dead space between them crushing them.
//
// See DESIGN.md Section 3 (Clips landing grid).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  height: number
  label: string // e.g. "3h", "2d 4h"
  style?: StyleProp<ViewStyle>
}

export function TimeGapMarker({ height, label, style }: Props) {
  return (
    <View style={[styles.gap, { height }, style]} pointerEvents="none">
      <View style={styles.rule} />
      <View style={styles.pill}>
        <Icon name="more-vertical" size="sm" color={theme.colors.text.subtle} />
        <Text variant="monoCaption" color={theme.colors.text.muted}>
          {label}
        </Text>
      </View>
      <View style={styles.rule} />
    </View>
  )
}

const styles = StyleSheet.create({
  // Spans the lanes; the dashed rules above/below read as "time skipped here".
  gap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  rule: {
    height: 0,
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderStyle: 'dashed',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.primary,
  },
})
