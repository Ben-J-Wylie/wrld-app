// src/components/features/auth/PasswordStrengthMeter.tsx
//
// 3-segment strength indicator + tone-matched helper line. Sits under
// a password Input. The consumer computes the score (a small util
// belongs in `@/lib/passwordStrength.ts` later); this feature only
// renders.
//
// Scores:
//   0  no password — all segments unfilled, helper neutral
//   1  weak — 1 segment in accent, helper accent
//   2  ok   — 2 segments in warn, helper warn
//   3  strong — 3 segments in accent, helper accent
//
// Custom 3-segment fill rather than the ProgressBar primitive because
// the warn variant for score=2 needs a different fill color (warn
// amber) from accent — ProgressBar's segments share one fill color.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type StrengthScore = 0 | 1 | 2 | 3

type Props = {
  score: StrengthScore
  helper?: string
  style?: StyleProp<ViewStyle>
}

// Score 1 covers both "too short" and "long but one character type", so the
// default for it must not claim "too short" (the consumer can pass a more
// specific `helper` when it knows the exact reason — see SignupScreen).
const DEFAULT_HELPER: Record<StrengthScore, string> = {
  0: '8 CHARACTERS MINIMUM',
  1: 'TOO WEAK — ADD LENGTH OR A NUMBER/SYMBOL',
  2: 'ADD A NUMBER OR SYMBOL',
  3: 'STRONG',
}

function fillFor(score: StrengthScore): string {
  if (score === 2) return theme.colors.warn
  if (score === 1 || score === 3) return theme.colors.accent.default
  return theme.colors.border.strong
}

function helperColor(score: StrengthScore): string {
  if (score === 2) return theme.colors.warn
  if (score === 1 || score === 3) return theme.colors.accent.default
  return theme.colors.text.muted
}

export function PasswordStrengthMeter({ score, helper, style }: Props) {
  const filled = fillFor(score)
  const idle = theme.colors.border.strong
  const helpText = helper ?? DEFAULT_HELPER[score]

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bar}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < score ? filled : idle },
            ]}
          />
        ))}
      </View>
      <Text variant="monoLabel" color={helperColor(score)}>
        {helpText}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
})
