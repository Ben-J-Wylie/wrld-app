// src/components/screens/CashoutScreen.tsx
//
// 12.6 migration target. The Stardust cash-out flow composes from
// design-system features that match its exact UX:
//
//   • AmountInput (variant='cashout') replaces the bespoke big-number
//     display + payout breakdown + bespoke PanResponder slider. The
//     feature owns the ✨ glyph, USD line, fee-net line (passed
//     `platformFeePct={5}`), invalidReason, and the snap-to-step
//     Slider primitive — exactly the slice this screen needed.
//   • PresetGrid for the 1K / 5K / 10K presets; one inline Chip for
//     ALL (which maps to whatever readyStardust currently is, not a
//     fixed number).
//   • Two custom mini-cards (LOCKED + READY) using Text + tokens —
//     PursesCard's hero layout would dwarf the chip-sized status
//     blocks the design calls for.
//   • IconButton (arrow-left) for back, Button (primary) docked at
//     the bottom for the cash-out CTA.
//   • Success screen composes accent-circled Icon + Text + Button.
//
// All GOLD (#F59E0B / #2A1F00) hex literals retire. Per the single-
// accent rule, Stardust-related accents use accent.default + the ✨
// glyph to distinguish from Space Bucks.

import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { theme } from '@/tokens/theme'
import { useWallet, useInvalidateWallet } from '@/hooks/useWallet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Button } from '@/components/primitives/Button'
import { Chip } from '@/components/primitives/Chip'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { AmountInput } from '@/components/features/wallet/AmountInput'
import { PresetGrid } from '@/components/sections/PresetGrid'

const SPACE_BUCKS_PER_DOLLAR = 100
const CASHOUT_MINIMUM = 1000
const CASHOUT_FEE_PCT = 5

const PRESETS = [1000, 5000, 10000] as const

function fmtUsd(stardust: number): string {
  return `$${(stardust / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}`
}

export function CashoutScreen() {
  const { data, isLoading } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [amount, setAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useFocusEffect(
    useCallback(() => {
      setSubmitted(false)
      setAmount(CASHOUT_MINIMUM)
    }, []),
  )

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      </SafeAreaView>
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
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null
      Alert.alert('Could not submit', msg ?? 'Something went wrong — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.navigate('/(app)/wallet')} />
        <ScreenScroll contentContainerStyle={styles.successScroll}>
          <View style={styles.successIconFrame}>
            <Icon name="check" size="lg" color={theme.colors.accent.default} />
          </View>
          <Text variant="display" style={styles.center}>
            Request submitted
          </Text>
          <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
            We'll process your {amount.toLocaleString()} Stardust and send {fmtUsd(net)} to
            your account email within 5–7 business days.
          </Text>
          <Button label="Done" onPress={() => router.navigate('/(app)/wallet')} />
        </ScreenScroll>
      </SafeAreaView>
    )
  }

  const invalidReason =
    amount > 0 && amount < CASHOUT_MINIMUM
      ? `MINIMUM ${CASHOUT_MINIMUM.toLocaleString()} ✨ (${fmtUsd(CASHOUT_MINIMUM)})`
      : undefined

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => router.navigate('/(app)/wallet')} />

      <ScreenScroll contentContainerStyle={styles.scroll}>
        <Text variant="display">Cash out</Text>

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
      </ScreenScroll>

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
    </SafeAreaView>
  )
}

// ─── Inline bits ─────────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton
        name="arrow-left"
        variant="ghost"
        onPress={onBack}
        accessibilityLabel="Back"
      />
      <Text variant="heading">Cash out</Text>
      <View style={styles.headerSpacer} />
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
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { textAlign: 'center' },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  headerSpacer: { width: 36, height: 36 },

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
