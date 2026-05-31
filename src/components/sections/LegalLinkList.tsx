// src/components/sections/LegalLinkList.tsx
//
// Vertical list of legal-document link rows ("Terms of service",
// "Community rules", "Privacy policy") with a right chevron. Tap
// opens the document in the consumer's reader. Used by all
// LegalAcceptanceCard variants and any future legal-disclosure
// surface.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type LegalDoc = {
  id: string
  label: string
  onPress: () => void
}

type Props = {
  docs: LegalDoc[]
  style?: StyleProp<ViewStyle>
}

export function LegalLinkList({ docs, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      {docs.map((d, i) => (
        <Pressable
          key={d.id}
          variant="subtle"
          onPress={d.onPress}
          accessibilityRole="link"
          accessibilityLabel={d.label}
          style={[styles.row, i > 0 && styles.rowBorder]}
        >
          <Text variant="body" color={theme.colors.text.primary}>
            {d.label}
          </Text>
          <Icon name="chevron-right" size="md" color={theme.colors.text.subtle} />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.elevated,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
})
