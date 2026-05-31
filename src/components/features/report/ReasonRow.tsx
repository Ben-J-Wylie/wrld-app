// src/components/features/report/ReasonRow.tsx
//
// Selectable row used in the Report flow's reason picker. Title +
// description + chevron. Selected = accent-tinted background + accent
// border + accent chevron.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  title: string
  description?: string
  selected?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

export function ReasonRow({ title, description, selected, onPress, style }: Props) {
  return (
    <Pressable
      variant="subtle"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      style={[styles.row, selected && styles.selected, style]}
    >
      <View style={styles.col}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {title}
        </Text>
        {description && (
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>
      <Icon
        name="chevron-right"
        size="md"
        color={selected ? theme.colors.accent.default : theme.colors.text.subtle}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  selected: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
