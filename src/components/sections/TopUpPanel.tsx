// src/components/sections/TopUpPanel.tsx
//
// The Top Up body, extracted from TopUpScreen (2026-06-05) so it can render in
// two places without duplication: the standalone /(app)/topup route AND the
// Wallet "Top Up" page-tab (hybrid-nav prototype). The host provides the chrome
// (SafeAreaView / header); this owns the bundle picker + buy logic + success
// state, parameterised only by `onDone` (where "Done" / post-purchase goes —
// back to the wallet route, or back to the Balance tab).
//
// ── Buy rails (decided 2026-06-21: "both") ──────────────────────────────────
// In-app digital goods must use IAP (App Store/Play 3.1.1), so the primary buy
// is a RevenueCat consumable purchase. The backend RevenueCat webhook credits
// Space Bucks (mapping the store product → bundle), so — like the web Stripe
// flow — the credit is ASYNC: after the purchase resolves we poll the wallet for
// the balance to rise before celebrating (and never claim success without it).
// A "top up on the web" link is the second rail (desktop + e-wallet markets via
// the wrld.cam Stripe flow). Until the store/RevenueCat products exist the IAP
// path is dormant and the web link is the path (the admin test-seed stays behind
// dev tools for Ben/Aaron).

import { useEffect, useState } from 'react'
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { PurchasesPackage } from 'react-native-purchases'
import { theme } from '@/tokens/theme'
import { env } from '@/lib/env'
import { useWallet, useInvalidateWallet } from '@/hooks/useWallet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { useRevenueCat } from '@/hooks/useRevenueCat'
import { getSpaceBucksPackages, purchase } from '@/lib/purchases'
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
  // Store consumable product id — must match the App Store / Play product id AND
  // the backend TOPUP_BUNDLES catalog's iosProductId/androidProductId. Keep the
  // id string identical across both stores so one value matches either platform.
  storeProductId: string
}

const BUNDLES: Bundle[] = [
  { amount: 500, priceCents: 499, badge: null, storeProductId: 'wrld.spacebucks.500' },
  { amount: 1200, priceCents: 999, badge: 'most-popular', storeProductId: 'wrld.spacebucks.1200' },
  { amount: 2500, priceCents: 1999, badge: 'best-value', storeProductId: 'wrld.spacebucks.2500' },
  { amount: 6000, priceCents: 3999, badge: 'vip', storeProductId: 'wrld.spacebucks.6000' },
]

// Web top-up (the second rail). The wrld.cam wallet hosts the Stripe top-up.
const WEB_TOPUP_URL = 'https://wrld.cam/wallet'

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
  const rc = useRevenueCat()
  const [selectedIndex, setSelectedIndex] = useState(1) // MOST POPULAR default
  const [buying, setBuying] = useState(false)
  const [done, setDone] = useState(false)
  const [packages, setPackages] = useState<PurchasesPackage[]>([])

  const selected = BUNDLES[selectedIndex]!

  // Load the Space Bucks consumable packages once the SDK is configured. Empty
  // until the store/RevenueCat products exist — then the IAP CTA lights up.
  useEffect(() => {
    if (!rc.available) return
    let alive = true
    getSpaceBucksPackages().then((pkgs) => {
      if (alive) setPackages(pkgs)
    })
    return () => {
      alive = false
    }
  }, [rc.available])

  const selectedPkg = packages.find((p) => p.product.identifier === selected.storeProductId)
  const iapReady = rc.available && !!selectedPkg

  // The credit lands via the RevenueCat webhook (async), so poll the wallet for
  // the balance to rise before declaring success. Returns whether it rose.
  async function pollForCredit(before: number): Promise<boolean> {
    for (let i = 0; i < 8; i++) {
      await Promise.all([invalidateWallet(), invalidateCurrentUser()])
      const w = await usersApi.getWallet().catch(() => null)
      if (w && w.spaceBucks > before) return true
      await new Promise((r) => setTimeout(r, 1500))
    }
    return false
  }

  async function handleBuyIap() {
    if (!selectedPkg) return
    setBuying(true)
    const before = data?.spaceBucks ?? 0
    const outcome = await purchase(selectedPkg)
    if (outcome.status === 'cancelled') {
      setBuying(false)
      return
    }
    if (outcome.status === 'error') {
      Alert.alert('Purchase failed', outcome.message)
      setBuying(false)
      return
    }
    // Purchased — wait for the webhook credit instead of assuming it.
    const credited = await pollForCredit(before)
    setBuying(false)
    if (credited) setDone(true)
    else {
      Alert.alert(
        'Payment received',
        'Your Space Bucks will appear in your wallet shortly once the purchase is confirmed.',
      )
    }
  }

  function handleBuyWeb() {
    Linking.openURL(WEB_TOPUP_URL).catch(() =>
      Alert.alert('Could not open the browser', `Visit ${WEB_TOPUP_URL} to top up.`),
    )
  }

  // Dev/admin only: the admin test-seed route (no real payment). Kept for
  // Ben/Aaron's testing; never shown to users.
  async function handleDevSeed() {
    setBuying(true)
    try {
      await usersApi.topUpSpaceBucks(selected.amount, selected.priceCents)
      await Promise.all([invalidateWallet(), invalidateCurrentUser()])
      setDone(true)
    } catch {
      Alert.alert('Error', 'Test grant failed (admin-only route).')
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

  // CTA price: the localized store price when IAP is live, else our USD anchor.
  const ctaPrice = iapReady ? selectedPkg!.product.priceString : fmtPrice(selected.priceCents)

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

        {env.enableDevTools && (
          <Pressable onPress={handleDevSeed} disabled={buying} style={styles.devSeed}>
            <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
              Dev: grant {selected.amount.toLocaleString()} 🚀 (test, no payment)
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {iapReady ? (
          <>
            <Button
              label={`Add ${selected.amount.toLocaleString()} 🚀  ·  ${ctaPrice}`}
              onPress={handleBuyIap}
              loading={buying}
            />
            <Pressable onPress={handleBuyWeb} style={styles.webLink}>
              <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
                Or top up on the web →
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Button label="Top up on the web" onPress={handleBuyWeb} loading={buying} />
            <Text variant="caption" color={theme.colors.text.muted} style={[styles.center, styles.webNote]}>
              Buy Space Bucks at wrld.cam — in-app purchases are coming soon.
            </Text>
          </>
        )}
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
  devSeed: {
    paddingVertical: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
    gap: theme.spacing.sm,
  },
  webLink: {
    paddingVertical: theme.spacing.xs,
  },
  webNote: {
    marginTop: theme.spacing.xs,
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
