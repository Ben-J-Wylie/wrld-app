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
// `leading` is an optional slot rendered inside the field, before the text
// (e.g. a search magnifier). It's the symmetric counterpart to the right
// affordance and is what lets `SearchBar` compose this primitive instead of
// re-implementing the field — so the search box and the title field share one
// look (2026-06-05 harmonisation).
//
// `style` applies to the outer wrapper (controls layout/positioning).
// HelpText sits BELOW the Input — it's a separate primitive composed by
// the consumer, not built into this one.

import { useState, type ReactNode } from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { Text } from './Text'
import { Icon } from './Icon'
import { Spinner } from './Spinner'
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
  leading?: ReactNode
  rightAffordance?: ReactNode
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function Input({
  variant = 'default',
  size = 'md',
  state = 'default',
  prefix,
  leading,
  rightAffordance,
  disabled,
  style,
  onFocus,
  onBlur,
  ...textInputProps
}: Props) {
  const [focused, setFocused] = useState(false)

  const borderColor = resolveBorderColor(state, focused)
  const affordance = resolveAffordance(state, rightAffordance)

  // NOTE: focus-driven shadow (theme.elevation.glow.accent) was removed
  // from this style array in the focus/blur-race investigation
  // (2026-05-30). Adding shadow properties to a UIView on focus appeared
  // to trigger CALayer reconfiguration that cancelled iOS's keyboard
  // appearance partway through. Border color change on focus remains
  // (cheap property update, no layer recalc).
  return (
    <View
      style={[
        styles.wrapper,
        { height: HEIGHT[size], borderColor },
        disabled && styles.disabled,
        style,
      ]}
    >
      {leading && <View style={styles.leading}>{leading}</View>}
      {variant === 'prefix' && prefix && (
        <Text variant="body" color={theme.colors.text.muted} style={styles.prefix}>
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
  if (state === 'loading') return <Spinner size="md" color={theme.colors.accent.default} />
  return null
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
  },
  prefix: {
    alignSelf: 'center',
  },
  leading: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  affordance: {
    minWidth: 20,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
})
