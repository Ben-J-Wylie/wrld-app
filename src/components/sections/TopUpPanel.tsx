// src/components/sections/TopUpPanel.tsx
//
// The Top Up body, extracted from TopUpScreen (2026-06-05) so it can render in
// two places without duplication: the standalone /(app)/topup route AND the
// Wallet "Top Up" page-tab (hybrid-nav prototype). The host provides the chrome
// (SafeAreaView / header); this owns the bundle picker + buy logic + success
// state, parameterised only by `onDone` (where "Done" / post-purchase goes —
// back to the wallet route, or back to the Balance tab).
//
// No big "Top up" title here — the tab label / screen header already says it.

import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { theme } from '@/tokens/theme'
import { useWallet, useInvalidateWallet } from '@/hooks/useWallet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { PursesCard } from '@/components/features/wallet/PursesCard'
import { BundleCard, type BundleBadge } from '@/components/features/wallet/BundleCard'

type Bundle = {
  amount: number
  priceCents: number
  badge: BundleBadge | null
}

const BUNDLES: Bundle[] = [
  { amount: 500, priceCents: 499, badge: null },
  { amount: 1200, priceCents: 999, badge: 'most-popular' },
  { amount: 2500, priceCents: 1999, badge: 'best-value' },
  { amount: 6000, priceCents: 3999, badge: 'vip' },
]

const BASE_RATE = 0.01 // $0.01 per Space Buck

function savingsPct(b: Bundle): number {
  const rate = b.priceCents / 100 / b.amount
  const pct = Math.round((1 - rate / BASE_RATE) * 100)
  return Math.max(0, pct)
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function TopUpPanel({ onDone }: { onDone: () => void }) {
  const { data } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [selectedIndex, setSelectedIndex] = useState(1) // MOST POPULAR default
  const [buying, setBuying] = useState(false)
  const [done, setDone] = useState(false)

  const selected = BUNDLES[selectedIndex]!

  async function handleBuy() {
    setBuying(true)
    try {
      await usersApi.topUpSpaceBucks(selected.amount, selected.priceCents)
      await Promise.all([invalidateWallet(), invalidateCurrentUser()])
      setDone(true)
    } catch {
      Alert.alert('Error', 'Top up failed — try again.')
    } finally {
      setBuying(false)
    }
  }

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.successScroll}>
        <View style={styles.successIconFrame}>
          <Icon name="check" size="lg" color={theme.colors.accent.default} />
        </View>
        <Text variant="display" style={styles.center}>
          Space Bucks added
        </Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
          {selected.amount.toLocaleString()} Space Bucks have been added to your wallet.
        </Text>
        <Button label="Done" onPress={onDone} />
      </ScrollView>
    )
  }

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {data != null && <PursesCard variant="single-sb" spaceBucks={data.spaceBucks} />}

        <HelpText>CHOOSE BUNDLE</HelpText>

        <View style={styles.bundles}>
          {BUNDLES.map((bundle, i) => (
            <BundleCard
              key={bundle.amount}
              qty={bundle.amount}
              priceUsd={bundle.priceCents / 100}
              perUnitSavingsPct={savingsPct(bundle)}
              badge={bundle.badge ?? undefined}
              selected={i === selectedIndex}
              onPress={() => setSelectedIndex(i)}
            />
          ))}
        </View>

        <HelpText style={styles.center}>TEST MODE · NO PAYMENT REQUIRED</HelpText>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={`Add ${selected.amount.toLocaleString()} 🚀  ·  ${fmtPrice(selected.priceCents)}`}
          onPress={handleBuy}
          loading={buying}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  center: { textAlign: 'center' },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  bundles: {
    gap: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
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
