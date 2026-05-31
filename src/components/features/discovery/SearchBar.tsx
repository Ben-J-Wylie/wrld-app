// src/components/features/discovery/SearchBar.tsx
//
// Glass-pill search input — leading mag-glass icon, TextInput middle,
// optional clear-X right (shown when there's text and `onClear` is
// provided). Sits on the globe overlay below the WRLD + LIVE header
// and above the CategoryChipRow.
//
// Variants:
//   default — pill on `bg.panel` with a subtle border. Focus swaps
//             the border to `accent.default` (no focus-driven
//             shadow — see DESIGN.md Section 3 Input note on the
//             2026-05-30 CALayer race).
//
// Built with a bare `TextInput` rather than wrapping the Input
// primitive because Input doesn't support a leading icon slot and the
// pill geometry (radius:full, 40 tall) differs from Input's default
// rectangle (radius:md, 52 tall). Keeping the primitive untouched and
// building a small custom pill here is the cheaper composition.

import { useState } from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = Omit<TextInputProps, 'style'> & {
  value: string
  onChangeText: (v: string) => void
  onSubmit?: () => void
  onClear?: () => void
  placeholder?: string
  style?: StyleProp<ViewStyle>
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'Search handle, title, or city',
  onFocus,
  onBlur,
  style,
  ...textInputProps
}: Props) {
  const [focused, setFocused] = useState(false)
  const borderColor = focused ? theme.colors.accent.default : theme.colors.border.subtle
  const showClear = onClear !== undefined && value.length > 0

  return (
    <View style={[styles.pill, { borderColor }, style]}>
      <Icon name="search" size="md" color={theme.colors.text.muted} />
      <TextInput
        {...textInputProps}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.subtle}
        returnKeyType="search"
        style={styles.input}
      />
      {showClear && (
        <Pressable
          variant="default"
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={12}
          style={styles.clear}
        >
          <Icon name="x" size="md" color={theme.colors.text.muted} />
        </Pressable>
      )}
    </View>
  )
}

const PILL_HEIGHT = 40

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: PILL_HEIGHT,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    backgroundColor: theme.colors.bg.panel,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: 14,
    fontFamily: theme.typography.body.fontFamily,
    paddingVertical: 0,
  },
  clear: {
    padding: theme.spacing.xxs,
  },
})
