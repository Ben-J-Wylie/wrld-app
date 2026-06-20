// src/components/sections/CashOutPanel.tsx
//
// The Cash Out body, extracted from CashoutScreen (2026-06-05) so it renders in
// both the standalone /(app)/cashout route AND the Wallet "Cash Out" page-tab
// (hybrid-nav prototype). Host provides the chrome (SafeAreaView / header); this
// owns the LOCKED/READY status, amount picker, and submit logic, parameterised
// only by `onDone`.
//
// No big "Cash out" title here — the tab label / screen header already says it.

import { useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native'
import { theme } from '@/tokens/theme'
import { useWallet, useInvalidateWallet } from '@/hooks/useWallet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Button } from '@/components/primitives/Button'
import { Chip } from '@/components/primitives/Chip'
import { Icon } from '@/components/primitives/Icon'
import { AmountInput } from '@/components/features/wallet/AmountInput'
import { PresetGrid } from '@/components/sections/PresetGrid'

const SPACE_BUCKS_PER_DOLLAR = 100
const CASHOUT_MINIMUM = 1000
const CASHOUT_FEE_PCT = 5

const PRESETS = [1000, 5000, 10000] as const

function fmtUsd(stardust: number): string {
  return `$${(stardust / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}`
}

export function CashOutPanel({ onDone }: { onDone: () => void }) {
  const { data, isLoading } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [amount, setAmount] = useState(CASHOUT_MINIMUM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (isLoading || !data) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator color={theme.colors.accent.default} />
      </View>
    )
  }

  const { stardust, lockedStardust, readyStardust } = data

  const net = amount - Math.floor((amount * CASHOUT_FEE_PCT) / 100)
  const canSubmit =
    amount >= CASHOUT_MINIMUM && amount <= readyStardust && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await usersApi.requestCashout(amount)
      await Promise.all([invalidateWallet(), invalidateCurrentUser()])
      setSubmitted(true)
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string; message?: string } } }).response?.data
          : null
      if (data?.error === 'payouts_not_set_up') {
        Alert.alert(
          'Set up payouts first',
          'Cash-outs are sent to your bank through Stripe. Connect your account to start receiving payouts.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Set up payouts', onPress: () => router.push('/(app)/monetize') },
          ],
        )
      } else {
        Alert.alert('Could not submit', data?.message ?? 'Something went wrong — try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <ScrollView contentContainerStyle={styles.successScroll}>
        <View style={styles.successIconFrame}>
          <Icon name="check" size="lg" color={theme.colors.accent.default} />
        </View>
        <Text variant="display" style={styles.center}>
          Request submitted
        </Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
          We'll send {fmtUsd(net)} to your connected Stripe payout account — your{' '}
          {amount.toLocaleString()} Stardust minus the {CASHOUT_FEE_PCT}% cashout fee.
          Payouts typically arrive within 5–7 business days.
        </Text>
        <Button label="Done" onPress={onDone} />
      </ScrollView>
    )
  }

  const invalidReason =
    amount > 0 && amount < CASHOUT_MINIMUM
      ? `MINIMUM ${CASHOUT_MINIMUM.toLocaleString()} ✨ (${fmtUsd(CASHOUT_MINIMUM)})`
      : undefined

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.statusRow}>
          <StatusCard
            label="LOCKED"
            value={`${lockedStardust.toLocaleString()} ✨`}
            sub="releases in up to 7 days"
          />
          <StatusCard
            label="READY"
            value={`${readyStardust.toLocaleString()} ✨`}
            sub={`${fmtUsd(readyStardust)} available`}
            ready
          />
        </View>

        <View style={styles.amountHeader}>
          <HelpText>AMOUNT</HelpText>
          <HelpText>
            MIN {CASHOUT_MINIMUM.toLocaleString()} ✨ · {fmtUsd(CASHOUT_MINIMUM)}
          </HelpText>
        </View>

        <AmountInput
          variant="cashout"
          value={amount}
          onValueChange={setAmount}
          min={CASHOUT_MINIMUM}
          max={Math.max(CASHOUT_MINIMUM, readyStardust)}
          step={100}
          platformFeePct={CASHOUT_FEE_PCT}
          invalidReason={invalidReason}
        />

        <PresetGrid
          presets={[...PRESETS]}
          value={PRESETS.includes(amount as 1000 | 5000 | 10000) ? amount : null}
          onChange={(v) => {
            if (v <= readyStardust) setAmount(v)
          }}
          format={(n) => `${n / 1000}K`}
        />

        <View style={styles.allRow}>
          <Chip
            label="ALL"
            selected={amount === readyStardust && readyStardust > 0}
            disabled={readyStardust === 0}
            onPress={() => setAmount(readyStardust)}
          />
        </View>

        {readyStardust === 0 && stardust > 0 && (
          <HelpText style={styles.center}>
            YOUR {stardust.toLocaleString()} ✨ IS LOCKED FOR UP TO 7 DAYS AFTER BEING EARNED
          </HelpText>
        )}

        {stardust === 0 && (
          <HelpText style={styles.center}>
            EARN STARDUST BY GOING LIVE AND RECEIVING TIPS
          </HelpText>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={
            canSubmit
              ? `Cash out ${amount.toLocaleString()} ✨  ·  ${fmtUsd(net)}`
              : 'Cash out'
          }
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
        <HelpText style={styles.center}>
          PROCESSED MANUALLY · PAYMENT SENT TO YOUR ACCOUNT EMAIL
        </HelpText>
      </View>
    </View>
  )
}

function StatusCard({
  label,
  value,
  sub,
  ready,
}: {
  label: string
  value: string
  sub: string
  ready?: boolean
}) {
  return (
    <View style={[styles.statusCard, ready && styles.statusCardReady]}>
      <Text
        variant="monoLabel"
        color={ready ? theme.colors.accent.default : theme.colors.text.muted}
      >
        {label}
      </Text>
      <Text variant="heading" color={theme.colors.text.primary} style={styles.statusValue}>
        {value}
      </Text>
      <Text
        variant="caption"
        color={ready ? theme.colors.accent.default : theme.colors.text.muted}
      >
        {sub}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  center: { textAlign: 'center' },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  statusRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statusCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    gap: 2,
  },
  statusCardReady: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  statusValue: {
    marginTop: 4,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  allRow: {
    alignItems: 'flex-start',
  },
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  successScroll: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  successIconFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
})
