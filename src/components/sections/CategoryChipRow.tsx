// src/components/sections/CategoryChipRow.tsx
//
// Horizontally-scrollable row of single-select category chips. Used
// for the Globe Mobile category filter (trimmed to All + Cities in
// v0.2 per the 2026-05-29 decision-log entry). Same shape works for
// any future single-select chip row.

import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Chip } from '@/components/primitives/Chip'
import { theme } from '@/tokens/theme'

export type Category = {
  id: string
  label: string
}

type Props = {
  categories: Category[]
  value: string | null
  onChange: (next: string | null) => void
  style?: StyleProp<ViewStyle>
}

export function CategoryChipRow({ categories, value, onChange, style }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      style={style}
    >
      {categories.map((c) => {
        const isAll = c.id === 'all'
        const selected = (isAll && value === null) || c.id === value
        return (
          <Chip
            key={c.id}
            label={c.label}
            selected={selected}
            onPress={() => onChange(isAll ? null : c.id)}
          />
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
})
