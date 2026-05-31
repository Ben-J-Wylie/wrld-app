// src/components/features/wallet/AmountInput.tsx
//
// Large numeric amount input used by TipSheet (variant `tip`) and
// the Cash Out screen (variant `cashout`). Currency glyph prefix +
// big numeric input + USD equivalent below + Slider for snap-to-step
// adjustment.
//
// Variants:
//   tip     — Space Bucks glyph, accent tone
//   cashout — Star Dust glyph, accent tone (single-accent rule),
//             shows net-after-fee line if `platformFeePct` is set

import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Slider } from '@/components/primitives/Slider'
import { theme } from '@/tokens/theme'

type Variant = 'tip' | 'cashout'

type Props = {
  variant?: Variant
  value: number
  onValueChange: (n: number) => void
  min?: number
  max: number
  step?: number
  platformFeePct?: number
  invalidReason?: string
  style?: StyleProp<ViewStyle>
}

const GLYPH: Record<Variant, string> = {
  tip: '🚀',
  cashout: '✨',
}

const UNIT_LABEL: Record<Variant, string> = {
  tip: 'SPACE BUCKS',
  cashout: 'STAR DUST',
}

const CENT_PER_UNIT = 1

export function AmountInput({
  variant = 'tip',
  value,
  onValueChange,
  min = 0,
  max,
  step = 1,
  platformFeePct,
  invalidReason,
  style,
}: Props) {
  const usd = (value * CENT_PER_UNIT) / 100
  const netAfterFee =
    platformFeePct !== undefined
      ? value - Math.round((value * platformFeePct) / 100)
      : undefined
  const netUsd = netAfterFee !== undefined ? (netAfterFee * CENT_PER_UNIT) / 100 : undefined
  const isInvalid = !!invalidReason

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <Text variant="display">{GLYPH[variant]}</Text>
        <TextInput
          value={String(value)}
          onChangeText={(t) => {
            const n = Number.parseInt(t.replace(/[^0-9]/g, ''), 10)
            onValueChange(Number.isFinite(n) ? n : 0)
          }}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          {UNIT_LABEL[variant]}
        </Text>
      </View>
      <Text variant="monoCaption" color={theme.colors.text.muted}>
        ≈ ${usd.toFixed(2)} USD
      </Text>
      {netAfterFee !== undefined && netUsd !== undefined && (
        <Text variant="monoCaption" color={theme.colors.text.muted}>
          NET after {platformFeePct}% fee · {netAfterFee.toLocaleString()} ✨ · ${netUsd.toFixed(2)}
        </Text>
      )}
      {isInvalid && (
        <Text variant="monoLabel" color={theme.colors.accent.default}>
          {invalidReason}
        </Text>
      )}
      <Slider
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 40,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
})
