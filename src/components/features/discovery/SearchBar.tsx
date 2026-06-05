// src/components/features/discovery/SearchBar.tsx
//
// Search input — composes the `Input` primitive so it shares the exact look
// of the "What's happening" title field on the dashboard / stream preview
// (2026-06-05 harmonisation). It's the primitive's `leading` slot (search
// magnifier) + a `rightAffordance` clear-X, plus search-specific keyboard
// behaviour (returnKeyType + onSubmit). The bespoke glass-pill it used to be
// is gone — there is now one source of truth for the field styling.
//
// Same public API as before (value / onChangeText / onSubmit / onClear /
// placeholder / style + any TextInputProps), so existing callers are
// unchanged — they just render as the rectangle field now.

import {
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { Input } from '@/components/primitives/Input'
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
  style,
  ...textInputProps
}: Props) {
  const showClear = onClear !== undefined && value.length > 0

  return (
    <Input
      {...textInputProps}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      returnKeyType="search"
      autoCorrect={false}
      autoCapitalize="none"
      style={style}
      leading={<Icon name="search" size="md" color={theme.colors.text.muted} />}
      rightAffordance={
        showClear ? (
          <Pressable
            variant="default"
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
          >
            <Icon name="x" size="md" color={theme.colors.text.muted} />
          </Pressable>
        ) : undefined
      }
    />
  )
}
