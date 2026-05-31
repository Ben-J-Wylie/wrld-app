// src/components/features/user/MetaStrip.tsx
//
// 2-row dot-separated info pattern. Mono font, dim ink, mid-dot
// separators. Consumer passes rows of `{ label, value }` items; each
// row renders its non-empty items joined by " · ".
//
// Used in Profile / My Profile / future identity-with-metadata cards.
// A user without (e.g.) pronouns simply omits that item — the strip
// hides empty rows automatically.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type MetaItem = {
  label?: string
  value: string
}

type Props = {
  rows: MetaItem[][]
  style?: StyleProp<ViewStyle>
}

export function MetaStrip({ rows, style }: Props) {
  return (
    <View style={[styles.strip, style]}>
      {rows.map((row, i) => {
        const filtered = row.filter((it) => it.value && it.value.length > 0)
        if (filtered.length === 0) return null
        return (
          <Text key={i} variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
            {filtered.map(formatItem).join(' · ')}
          </Text>
        )
      })}
    </View>
  )
}

function formatItem(it: MetaItem): string {
  return it.label ? `${it.label} ${it.value}` : it.value
}

const styles = StyleSheet.create({
  strip: {
    gap: 2,
  },
})
