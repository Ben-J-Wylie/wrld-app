// src/components/features/onboarding/RulesChecklist.tsx
//
// Vertical list of validation rules. Each row has a small status dot
// (check / x / neutral) + the rule label. Universally useful for
// handle picker rules, password rules, etc.
//
// Status -> visual:
//   met     — accent dot with `check` glyph, ink label
//   bad     — accent dot with `x` glyph, accent label (single-accent
//             rule: errors share the accent color and are
//             distinguished by glyph)
//   neutral — empty-line dot, dim label (not yet evaluated)

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type RuleStatus = 'met' | 'bad' | 'neutral'

export type Rule = {
  label: string
  status: RuleStatus
}

type Props = {
  rules: Rule[]
  style?: StyleProp<ViewStyle>
}

export function RulesChecklist({ rules, style }: Props) {
  return (
    <View style={[styles.list, style]}>
      {rules.map((r, i) => (
        <View key={`${i}:${r.label}`} style={styles.row}>
          <StatusDot status={r.status} />
          <Text
            variant="monoLabel"
            color={
              r.status === 'met'
                ? theme.colors.text.primary
                : r.status === 'bad'
                  ? theme.colors.accent.default
                  : theme.colors.text.muted
            }
          >
            {r.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

function StatusDot({ status }: { status: RuleStatus }) {
  if (status === 'neutral') {
    return <View style={[styles.dot, styles.dotNeutral]} />
  }
  return (
    <View
      style={[
        styles.dot,
        status === 'met' ? styles.dotMet : styles.dotBad,
      ]}
    >
      <Icon
        name={status === 'met' ? 'check' : 'x'}
        size={10}
        color={theme.colors.text.inverse}
      />
    </View>
  )
}

const DOT = 18

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotMet: {
    backgroundColor: theme.colors.accent.default,
  },
  dotBad: {
    backgroundColor: theme.colors.accent.default,
  },
  dotNeutral: {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: 'transparent',
  },
})
