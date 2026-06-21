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
import { useQuery } from '@tanstack/react-query'
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
// Fallbacks only — the live minimum / fee / lock window come from the wallet
// payload (data.cashoutMinimum / cashoutFeeRate / stardustLockDays), so an admin
// /admin/config change is reflected instead of a frozen client constant.
const CASHOUT_MINIMUM_FALLBACK = 1000
const CASHOUT_LOCK_DAYS_FALLBACK = 7

const PRESETS = [1000, 5000, 10000] as const

function fmtUsd(stardust: number): string {
  return `$${(stardust / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}`
}

export function CashOutPanel({ onDone }: { onDone: () => void }) {
  const { data, isLoading } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [amount, setAmount] = useState(CASHOUT_MINIMUM_FALLBACK)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Payout-account status — gate the form up front instead of failing after submit.
  // Only block on a definitive "not onboarded"; a failed/loading fetch falls through
  // to the form (the server's payouts_not_set_up is the backstop).
  const { data: payoutSettings } = useQuery({
    queryKey: ['subscription-settings'],
    queryFn: () => usersApi.getSubscriptionSettings(),
    staleTime: 60_000,
  })

  if (isLoading || !data) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator color={theme.colors.accent.default} />
      </View>
    )
  }

  const { stardust, lockedStardust, readyStardust } = data
  const cashoutMin = data.cashoutMinimum || CASHOUT_MINIMUM_FALLBACK
  const feeRate = data.cashoutFeeRate || 0
  const feePct = Math.round(feeRate * 100)
  const lockDays = data.stardustLockDays || CASHOUT_LOCK_DAYS_FALLBACK

  const knownNotOnboarded = payoutSettings !== undefined && !payoutSettings.onboardingComplete

  // Cap the amount at the ready balance so it can never silently exceed what's
  // available (a dead Cash-out button with no reason was the old failure mode).
  const clampAmount = (v: number) => Math.max(0, Math.min(Math.floor(v || 0), readyStardust))

  const net = amount - Math.floor(amount * feeRate)
  const insufficient = readyStardust < cashoutMin
  const belowMin = !insufficient && amount > 0 && amount < cashoutMin
  const canSubmit = amount >= cashoutMin && amount <= readyStardust && !submitting

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
          'Cash-outs are sent to your bank through Stripe. Connect your payout account to start cashing out.',
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
          Payout requested
        </Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
          {`We've queued your payout of ${net.toLocaleString()} ✨ (${fmtUsd(net)})${feePct > 0 ? ` — your ${amount.toLocaleString()} Stardust minus the ${feePct}% cashout fee` : ''}. It's reviewed and sent to your connected Stripe payout account, usually within a few business days. Track it in your transaction history.`}
        </Text>
        <Button label="Done" onPress={onDone} />
      </ScrollView>
    )
  }

  // No payout account yet — block before the form instead of after submit.
  if (knownNotOnboarded) {
    return (
      <ScrollView contentContainerStyle={styles.successScroll}>
        <View style={styles.successIconFrame}>
          <Icon name="arrow-down-circle" size="lg" color={theme.colors.accent.default} />
        </View>
        <Text variant="display" style={styles.center}>
          Set up payouts first
        </Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
          Cash-outs are sent to your bank through Stripe. Connect your payout account to start cashing out your Stardust.
        </Text>
        <Button label="Set up payouts" onPress={() => router.push('/(app)/monetize')} />
      </ScrollView>
    )
  }

  const invalidReason = belowMin
    ? `MINIMUM ${cashoutMin.toLocaleString()} ✨ (${fmtUsd(cashoutMin)})`
    : undefined

  // Explain a disabled button so the primary action is never silently dead.
  const disabledHint = insufficient
    ? `Need ${cashoutMin.toLocaleString()} ✨ ready to cash out`
    : belowMin
      ? `Minimum is ${cashoutMin.toLocaleString()} ✨`
      : amount > readyStardust
        ? `Only ${readyStardust.toLocaleString()} ✨ ready`
        : undefined

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.statusRow}>
          <StatusCard
            label="LOCKED"
            value={`${lockedStardust.toLocaleString()} ✨`}
            sub={`releases in up to ${lockDays} days`}
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
            MIN {cashoutMin.toLocaleString()} ✨ · {fmtUsd(cashoutMin)}
          </HelpText>
        </View>

        <AmountInput
          variant="cashout"
          value={amount}
          onValueChange={(v) => setAmount(clampAmount(v))}
          min={cashoutMin}
          max={Math.max(cashoutMin, readyStardust)}
          step={100}
          platformFeePct={feePct > 0 ? feePct : undefined}
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
            selected={amount === readyStardust && readyStardust >= cashoutMin}
            disabled={readyStardust < cashoutMin}
            onPress={() => setAmount(readyStardust)}
          />
        </View>

        {insufficient && stardust > 0 && (
          <HelpText style={styles.center}>
            {readyStardust > 0
              ? `YOU HAVE ${readyStardust.toLocaleString()} ✨ READY — YOU NEED AT LEAST ${cashoutMin.toLocaleString()} ✨ TO CASH OUT`
              : `YOUR ${stardust.toLocaleString()} ✨ IS LOCKED FOR UP TO ${lockDays} DAYS AFTER BEING EARNED`}
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
        {!canSubmit && !submitting && disabledHint ? (
          <HelpText style={[styles.center, { color: theme.colors.warn }]}>{disabledHint}</HelpText>
        ) : (
          <HelpText style={styles.center}>
            REVIEWED &amp; SENT TO YOUR CONNECTED STRIPE PAYOUT ACCOUNT
          </HelpText>
        )}
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
