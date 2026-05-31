// src/components/features/onboarding/SuggestionChipRow.tsx
//
// Wrapping row of handle suggestion chips. Tap = fills the Input above.
// Each chip has an accent "@" prefix to telegraph "this is a handle."

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  suggestions: string[]
  onPick: (value: string) => void
  style?: StyleProp<ViewStyle>
}

export function SuggestionChipRow({ suggestions, onPick, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {suggestions.map((s) => (
        <Pressable
          key={s}
          onPress={() => onPick(s)}
          accessibilityRole="button"
          accessibilityLabel={`Use handle ${s}`}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text variant="caption" color={theme.colors.accent.default}>
            @
          </Text>
          <Text variant="caption" color={theme.colors.text.primary}>
            {s}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  pressed: {
    opacity: 0.7,
  },
})
