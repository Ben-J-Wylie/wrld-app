// src/components/sections/PresetGrid.tsx
//
// 4-up grid of preset value chips. Tap sets a parent value
// (typically the AmountInput sibling). Selected chip carries the
// accent tint via the Chip primitive.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Chip } from '@/components/primitives/Chip'
import { theme } from '@/tokens/theme'

type Props<T extends string | number> = {
  presets: T[]
  value: T | null
  onChange: (next: T) => void
  format?: (v: T) => string
  style?: StyleProp<ViewStyle>
}

export function PresetGrid<T extends string | number>({
  presets,
  value,
  onChange,
  format,
  style,
}: Props<T>) {
  return (
    <View style={[styles.grid, style]}>
      {presets.map((p, i) => {
        const label = format ? format(p) : String(p)
        return (
          <View key={`${i}:${String(p)}`} style={styles.cell}>
            <Chip
              label={label}
              selected={p === value}
              onPress={() => onChange(p)}
            />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  cell: {
    width: '24%',
    minWidth: 64,
  },
})
