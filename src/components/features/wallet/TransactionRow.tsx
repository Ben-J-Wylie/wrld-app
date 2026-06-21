// src/components/features/wallet/TransactionRow.tsx
//
// Single row in the Wallet v2 transaction list. Thumbnail (40×40,
// colored by kind + currency direction) + meta column (title + sub) +
// amount column (mono, signed, USD equivalent below). Pending state
// shows a "PENDING" label below the amount.
//
// Variants map to the v0.2/v0.3 wallet model — see DESIGN.md decision
// log 2026-05-29. tip-sent/tip-received are functional in v0.2;
// sub-/ppv- variants ship as mocks; topup/cashout stay stubbed.

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type TransactionKind =
  | 'tip-sent'
  | 'tip-received'
  | 'sub-paid'
  | 'sub-earned'
  | 'ppv-paid'
  | 'ppv-earned'
  | 'topup'
  | 'cashout'
  | 'promo'
  | 'refund'
  | 'hold'

type Currency = 'sb' | 'sd'

export type TransactionRow = {
  kind: TransactionKind
  title: string
  sub?: string
  message?: string | null
  amount: number
  currency: Currency
  pending?: boolean
  // A status pill below the amount (e.g. cashout PENDING / PROCESSING / FAILED).
  // 'wait' renders amber, 'bad' renders accent (refunded/failed). Takes precedence
  // over `pending` so a status is never rendered as a blank/"undefined" row.
  statusLabel?: string
  statusTone?: 'wait' | 'bad'
  onPress?: () => void
}

type Props = TransactionRow & {
  style?: StyleProp<ViewStyle>
}

type KindMeta = {
  iconName: IconName
  direction: -1 | 1
}

const KIND_META: Record<TransactionKind, KindMeta> = {
  'tip-sent': { iconName: 'send', direction: -1 },
  'tip-received': { iconName: 'gift', direction: 1 },
  'sub-paid': { iconName: 'user', direction: -1 },
  'sub-earned': { iconName: 'user-check', direction: 1 },
  'ppv-paid': { iconName: 'lock', direction: -1 },
  'ppv-earned': { iconName: 'unlock', direction: 1 },
  topup: { iconName: 'plus-circle', direction: 1 },
  cashout: { iconName: 'arrow-down-circle', direction: -1 },
  promo: { iconName: 'star', direction: 1 },
  refund: { iconName: 'rotate-ccw', direction: 1 },
  hold: { iconName: 'pause-circle', direction: 0 as unknown as -1 },
}

const CURRENCY_GLYPH: Record<Currency, string> = {
  sb: '🚀',
  sd: '✨',
}

const CENT_PER_UNIT = 1

export function TransactionRow({
  kind,
  title,
  sub,
  message,
  amount,
  currency,
  pending,
  statusLabel,
  statusTone,
  onPress,
  style,
}: Props) {
  const meta = KIND_META[kind]
  const usd = (amount * CENT_PER_UNIT) / 100
  const signedAmount = meta.direction === -1 ? `−${amount.toLocaleString()}` : `+${amount.toLocaleString()}`
  const signedUsd = meta.direction === -1 ? `−$${usd.toFixed(2)}` : `+$${usd.toFixed(2)}`

  const body = (
    <>
      <View style={styles.thumb}>
        <Icon name={meta.iconName} size="md" color={theme.colors.text.primary} />
      </View>
      <View style={styles.metaCol}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {title}
        </Text>
        {sub && (
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
            {sub}
          </Text>
        )}
        {message ? (
          <Text variant="caption" color={theme.colors.text.muted} numberOfLines={3} style={styles.message}>
            “{message}”
          </Text>
        ) : null}
      </View>
      <View style={styles.amountCol}>
        <Text variant="monoValue" color={theme.colors.text.primary}>
          {signedAmount} {CURRENCY_GLYPH[currency]}
        </Text>
        <Text variant="monoCaption" color={theme.colors.text.muted}>
          {signedUsd}
        </Text>
        {statusLabel ? (
          <Text
            variant="monoLabel"
            color={statusTone === 'bad' ? theme.colors.accent.default : theme.colors.warn}
          >
            {statusLabel.toUpperCase()}
          </Text>
        ) : pending ? (
          <Text variant="monoLabel" color={theme.colors.warn}>
            PENDING
          </Text>
        ) : null}
      </View>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[styles.row, style]}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={[styles.row, style]}>{body}</View>
}

const THUMB = 40

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  message: {
    fontStyle: 'italic',
    marginTop: 2,
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
})
