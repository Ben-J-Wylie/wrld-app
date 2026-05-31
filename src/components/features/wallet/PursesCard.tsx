// src/components/features/wallet/PursesCard.tsx
//
// Dual-currency hero card. Space Bucks (SB, 🚀 in Phase 13 copy) on
// the left, Star Dust (SD, ✨ in copy) on the right. Each side shows
// a big tabular balance + USD equivalent (both currencies are $0.01
// per unit per the 2026-05-29 re-baseline).
//
// Variants:
//   dual      — both sides (Wallet v2 hero)
//   single-sb — SB only (Top Up context strip)
//   single-sd — SD only (Cash Out hero)

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Variant = 'dual' | 'single-sb' | 'single-sd'
type Currency = 'sb' | 'sd'

type Props = {
  variant?: Variant
  spaceBucks?: number
  starDust?: number
  style?: StyleProp<ViewStyle>
}

const CURRENCY_LABEL: Record<Currency, string> = {
  sb: 'SPACE BUCKS',
  sd: 'STAR DUST',
}

const CURRENCY_GLYPH: Record<Currency, string> = {
  sb: '🚀',
  sd: '✨',
}

const CENT_PER_UNIT = 1 // both currencies are $0.01/unit

export function PursesCard({ variant = 'dual', spaceBucks = 0, starDust = 0, style }: Props) {
  if (variant === 'single-sb') {
    return (
      <View style={[styles.card, style]}>
        <Purse currency="sb" amount={spaceBucks} />
      </View>
    )
  }
  if (variant === 'single-sd') {
    return (
      <View style={[styles.card, style]}>
        <Purse currency="sd" amount={starDust} />
      </View>
    )
  }
  return (
    <View style={[styles.card, styles.dual, style]}>
      <Purse currency="sb" amount={spaceBucks} />
      <View style={styles.divider} />
      <Purse currency="sd" amount={starDust} />
    </View>
  )
}

function Purse({ currency, amount }: { currency: Currency; amount: number }) {
  const usd = (amount * CENT_PER_UNIT) / 100
  return (
    <View style={styles.purse}>
      <View style={styles.row}>
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          {CURRENCY_LABEL[currency]}
        </Text>
        <Text variant="bodyEmphasized">{CURRENCY_GLYPH[currency]}</Text>
      </View>
      <Text variant="display" color={theme.colors.text.primary} style={styles.balance}>
        {amount.toLocaleString()}
      </Text>
      <Text variant="monoCaption" color={theme.colors.text.muted}>
        ${usd.toFixed(2)} · $0.01/unit
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  dual: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.lg,
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  purse: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balance: {
    fontVariant: ['tabular-nums'],
  },
})
