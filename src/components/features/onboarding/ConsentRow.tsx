// src/components/features/onboarding/ConsentRow.tsx
//
// Row with title + description on the left, Toggle on the right. The
// `locked` variant keeps the Toggle on and disables it (Essential-
// type consents that cannot be turned off).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Toggle } from '@/components/primitives/Toggle'
import { theme } from '@/tokens/theme'

type Props = {
  title: string
  description?: string
  on: boolean
  onToggle: (v: boolean) => void
  locked?: boolean
  style?: StyleProp<ViewStyle>
}

export function ConsentRow({ title, description, on, onToggle, locked, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.col}>
        <Text variant="bodyEmphasized" color={theme.colors.text.primary}>
          {title}
        </Text>
        {description && (
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {description}
          </Text>
        )}
      </View>
      <Toggle
        value={locked ? true : on}
        onValueChange={onToggle}
        disabled={locked}
        accessibilityLabel={title}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  col: {
    flex: 1,
    gap: 2,
  },
})
