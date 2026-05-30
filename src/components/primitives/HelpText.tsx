// src/components/primitives/HelpText.tsx
//
// Small mono-caps caption rendered immediately under a form field.
// Pairs with Input + Textarea (the consumer composes them inline).
// Tones:
//   dim   — neutral instruction ("3–20 CHARACTERS")
//   ok    — accent-tinted ("EMAIL LOOKS GOOD")
//   err   — accent-tinted ("TOO SHORT — 8 CHARACTERS MINIMUM")
//   warn  — amber-tinted ("ADD A NUMBER OR SYMBOL")
//
// Single-accent rule: `ok` and `err` render with the same color
// (`accent.default`). Differentiation is the *content* and the paired
// Input's affordance icon (check vs x), not a separate red/green pair.
// `warn` is the only non-accent tone — amber, used sparingly.

import type { ReactNode } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import { Text } from './Text'
import { theme } from '@/tokens/theme'

type Tone = 'dim' | 'ok' | 'err' | 'warn'

const COLORS: Record<Tone, string> = {
  dim: theme.colors.text.subtle,
  ok: theme.colors.accent.default,
  err: theme.colors.accent.default,
  warn: theme.colors.warn,
}

type Props = {
  tone?: Tone
  children: ReactNode
  style?: StyleProp<TextStyle>
}

export function HelpText({ tone = 'dim', children, style }: Props) {
  return (
    <Text variant="monoLabel" color={COLORS[tone]} style={style}>
      {children}
    </Text>
  )
}
