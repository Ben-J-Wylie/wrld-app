// src/components/primitives/Textarea.tsx
//
// Multi-line text input. Distinct primitive from Input: no right
// affordance (icons don't make sense inline with multi-line content),
// no loading state (textareas aren't typically tied to async validation),
// no prefix. Shares its visual treatment with Input via shared tokens.
//
// Min-height 96 (six body lines). RN `TextInput` with `multiline` is the
// underlying element; vertical resize is controlled by the consumer via
// `style` if needed.

import { useState } from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { theme } from '@/tokens/theme'

type Props = Omit<TextInputProps, 'style' | 'multiline'> & {
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function Textarea({
  disabled,
  style,
  onFocus,
  onBlur,
  ...textInputProps
}: Props) {
  const [focused, setFocused] = useState(false)
  const borderColor = focused ? theme.colors.accent.default : theme.colors.border.strong

  // NOTE: focus-driven shadow removed (2026-05-30 CALayer-reconfiguration
  // fix — see Input.tsx for the diagnostic story). Adding shadow
  // properties on focus changed the UIView's effective bounds mid-
  // keyboard-animation, causing iOS to cancel keyboard appearance.
  // Border color change on focus remains.
  return (
    <View
      style={[
        styles.wrapper,
        { borderColor },
        disabled && styles.disabled,
        style,
      ]}
    >
      <TextInput
        {...textInputProps}
        multiline
        editable={!disabled && textInputProps.editable !== false}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        placeholderTextColor={theme.colors.text.subtle}
        textAlignVertical="top"
        style={styles.input}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 96,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  input: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: theme.typography.body.fontFamily,
    paddingVertical: 0,
  },
  disabled: {
    opacity: 0.5,
  },
})
