// src/components/screens/TopUpScreen.tsx
//
// 12.6 migration target. The bespoke top-up bundle picker composes
// from the v0.2 wallet features that already model this exact UX:
//
//   • PursesCard (variant=single-sb) renders the current Space Bucks
//     balance hero.
//   • BundleCard per bundle — radio bullet + qty + price + optional
//     corner badge. Badge tokens map: MOST POPULAR → 'most-popular',
//     BEST VALUE → 'best-value', VIP → 'vip'. The GREEN/GOLD bespoke
//     badge colors retire in favor of the design-system tones
//     (single-accent rule applies).
//   • IconButton (arrow-left) for back navigation.
//   • Button (primary) docked at the bottom for the Buy action.
//   • Success screen composes Icon frame + Text + Button.
//
// HelpText carries the "Test mode · no payment required" line. The
// underlying purchase logic (usersApi.topUpSpaceBucks + cache
// invalidations) is unchanged — only rendering migrates.

import { useCallback, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
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
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
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

export function TopUpScreen() {
  const { data } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [selectedIndex, setSelectedIndex] = useState(1) // MOST POPULAR default
  const [buying, setBuying] = useState(false)
  const [done, setDone] = useState(false)

  useFocusEffect(
    useCallback(() => {
      setDone(false)
      setSelectedIndex(1)
    }, []),
  )

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
      <SafeAreaView style={styles.container}>
        <Header onBack={() => router.navigate('/(app)/wallet')} />
        <ScreenScroll contentContainerStyle={styles.successScroll}>
          <View style={styles.successIconFrame}>
            <Icon name="check" size="lg" color={theme.colors.accent.default} />
          </View>
          <Text variant="display" style={styles.center}>
            Space Bucks added
          </Text>
          <Text
            variant="body"
            color={theme.colors.text.muted}
            style={styles.center}
          >
            {selected.amount.toLocaleString()} Space Bucks have been added to your wallet.
          </Text>
          <Button label="Done" onPress={() => router.navigate('/(app)/wallet')} />
        </ScreenScroll>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => router.navigate('/(app)/wallet')} />

      <ScreenScroll contentContainerStyle={styles.scroll}>
        <Text variant="display">Top up</Text>

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

        <HelpText style={styles.testNote}>TEST MODE · NO PAYMENT REQUIRED</HelpText>
      </ScreenScroll>

      <View style={styles.footer}>
        <Button
          label={`Add ${selected.amount.toLocaleString()} 🚀  ·  ${fmtPrice(selected.priceCents)}`}
          onPress={handleBuy}
          loading={buying}
        />
      </View>
    </SafeAreaView>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton
        name="arrow-left"
        variant="ghost"
        onPress={onBack}
        accessibilityLabel="Back"
      />
      <Text variant="heading">Top up</Text>
      <View style={styles.headerSpacer} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  bundles: {
    gap: theme.spacing.sm,
  },
  testNote: {
    textAlign: 'center',
  },
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  center: {
    textAlign: 'center',
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
