// src/components/sections/SettingsGroup.tsx
//
// Section header (mono caps, dim) + a Card-style container hosting
// SettingsRow children. Border-top + border-bottom + border-side on
// the container so a stack of rows reads as one grouped list.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  title?: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function SettingsGroup({ title, children, style }: Props) {
  return (
    <View style={[styles.group, style]}>
      {title && (
        <Text variant="monoLabel" color={theme.colors.text.subtle} style={styles.title}>
          {title}
        </Text>
      )}
      <View style={styles.card}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    gap: theme.spacing.xs,
  },
  title: {
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
})
