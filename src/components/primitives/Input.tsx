// src/components/primitives/Input.tsx
//
// Single-line text input primitive. Replaces the Phase 1 placeholder.
// Extends RN `TextInputProps` so every native prop (value, onChangeText,
// keyboardType, autoCapitalize, secureTextEntry, autoComplete, …) keeps
// working unchanged for existing callers.
//
// Variants:
//   default — plain field
//   prefix  — leading `@` (or any short token) shown inside the field
//
// Sizes: md (h:52, standard) | lg (h:60, hero like the handle picker).
//
// States:
//   default — neutral border
//   focus   — accent border + accent glow (auto-tracked via focus/blur)
//   valid   — accent border + check affordance
//   error   — accent border + x affordance (single-accent rule: error
//             distinguishes by icon, not color)
//   loading — accent border + spinner affordance (async validation —
//             never a screen-blocking spinner)
//   disabled — half opacity, non-editable
//
// Right affordance is auto-derived from `state` but can be overridden
// via the `rightAffordance` prop for cases like a clear-X button.
//
// `style` applies to the outer wrapper (controls layout/positioning).
// HelpText sits BELOW the Input — it's a separate primitive composed by
// the consumer, not built into this one.

import { useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { Text } from './Text'
import { Icon } from './Icon'
import { theme } from '@/tokens/theme'

type Variant = 'default' | 'prefix'
type Size = 'md' | 'lg'
type State = 'default' | 'valid' | 'error' | 'loading'

const HEIGHT: Record<Size, number> = { md: 52, lg: 60 }

type Props = Omit<TextInputProps, 'style'> & {
  variant?: Variant
  size?: Size
  state?: State
  prefix?: string
  rightAffordance?: ReactNode
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function Input({
  variant = 'default',
  size = 'md',
  state = 'default',
  prefix,
  rightAffordance,
  disabled,
  style,
  onFocus,
  onBlur,
  ...textInputProps
}: Props) {
  const [focused, setFocused] = useState(false)

  const borderColor = resolveBorderColor(state, focused)
  const showGlow = focused || state === 'valid' || state === 'error' || state === 'loading'
  const glowStyle = showGlow && !disabled ? theme.elevation.glow.accent : null
  const affordance = resolveAffordance(state, rightAffordance)

  return (
    <View
      style={[
        styles.wrapper,
        { height: HEIGHT[size], borderColor },
        glowStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'prefix' && prefix && (
        <Text variant="body" color={theme.colors.text.muted}>
          {prefix}
        </Text>
      )}
      <TextInput
        {...textInputProps}
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
        style={styles.input}
      />
      {affordance && <View style={styles.affordance}>{affordance}</View>}
    </View>
  )
}

function resolveBorderColor(state: State, focused: boolean): string {
  if (state === 'valid' || state === 'error' || state === 'loading') {
    return theme.colors.accent.default
  }
  if (focused) return theme.colors.accent.default
  return theme.colors.border.strong
}

function resolveAffordance(state: State, custom: ReactNode | undefined): ReactNode {
  if (custom !== undefined) return custom
  if (state === 'valid') return <Icon name="check" size="md" color={theme.colors.accent.default} />
  if (state === 'error') return <Icon name="x" size="md" color={theme.colors.accent.default} />
  if (state === 'loading') return <ActivityIndicator color={theme.colors.accent.default} />
  return null
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: theme.typography.body.fontFamily,
    paddingVertical: 0,
    height: '100%',
  },
  affordance: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
})
