// src/components/sections/CategoryChipRow.tsx
//
// Horizontally-scrollable row of single-select category chips. The
// section is domain-blind — consumer hands it `categories: Category[]`
// and owns the filter semantics.
//
// Globe-page consumer (Phase 14a) wires five chips:
//   all              — no filter (selected → `value === null`)
//   city / country   — geographic (current city / country derived via
//                      Mapbox reverse-geocode on the user's coords)
//   camera-only      — `Stream.sources` includes 'camera'
//   audio-only       — `Stream.sources` includes 'audio'
//
// Same shape works for any future single-select chip row that needs
// the "All + N category" pattern.

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
