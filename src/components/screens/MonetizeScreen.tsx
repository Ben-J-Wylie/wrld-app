// MonetizeScreen
//
// Creator subscription setup. Lets the creator:
//   1. Connect their Stripe account (opens browser via Stripe Connect onboarding)
//   2. Set a monthly subscription price
//   3. Toggle subscriptions on/off
//   4. Open their Stripe Express dashboard for payout management

import { Alert, Linking, StyleSheet, View } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Toggle } from '@/components/primitives/Toggle'
import { IconButton } from '@/components/primitives/IconButton'
import { Input } from '@/components/primitives/Input'
import { usersApi } from '@/api/users'

export function MonetizeScreen() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['subscription-settings'],
    queryFn: () => usersApi.getSubscriptionSettings(),
  })

  const [priceInput, setPriceInput] = useState('')
  const [saving, setSaving] = useState(false)

  const priceDollars = priceInput ? parseFloat(priceInput) : null
  const priceCents = priceDollars ? Math.round(priceDollars * 100) : null
  const priceValid = priceCents !== null && priceCents >= 100 && priceCents <= 100_000

  async function handleConnectStripe() {
    try {
      const { url } = await usersApi.startSubscriptionOnboard()
      await Linking.openURL(url)
    } catch {
      Alert.alert('Error', 'Could not open Stripe onboarding')
    }
  }

  async function handleSavePrice() {
    if (!priceValid || !priceCents) return
    setSaving(true)
    try {
      await usersApi.updateSubscriptionSettings({ subscriptionPriceUsd: priceCents })
      qc.invalidateQueries({ queryKey: ['subscription-settings'] })
      qc.invalidateQueries({ queryKey: ['currentUser'] })
      setPriceInput('')
      Alert.alert('Price updated', `New subscribers will pay $${(priceCents / 100).toFixed(2)}/mo`)
    } catch {
      Alert.alert('Error', 'Could not update price')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEnabled(next: boolean) {
    try {
      await usersApi.updateSubscriptionSettings({ subscriptionEnabled: next })
      qc.invalidateQueries({ queryKey: ['subscription-settings'] })
      qc.invalidateQueries({ queryKey: ['currentUser'] })
    } catch {
      Alert.alert('Error', 'Could not update subscription settings')
    }
  }

  async function handleDashboard() {
    try {
      const { url } = await usersApi.getSubscriptionDashboardUrl()
      await Linking.openURL(url)
    } catch {
      Alert.alert('Error', 'Could not open Stripe dashboard')
    }
  }

  return (
    <ScreenScroll contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <IconButton iconName="arrow-left" onPress={() => router.back()} />
        <Text variant="title">Monetize</Text>
      </View>

      {isLoading ? null : !settings?.onboardingComplete ? (
        <>
          <Text variant="body" color={theme.colors.text.secondary}>
            Connect a Stripe account to receive subscription payments. Stripe handles billing,
            payouts, and tax compliance.
          </Text>
          <HelpText>PLATFORM TAKES 30% · YOU KEEP 70%</HelpText>
          <Button label="Connect Stripe" onPress={handleConnectStripe} />
        </>
      ) : (
        <>
          {/* Enable / disable */}
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="body">Enable subscriptions</Text>
              <Text variant="caption" color={theme.colors.text.muted}>
                Allow fans to subscribe for{' '}
                {settings.subscriptionPriceUsd
                  ? `$${(settings.subscriptionPriceUsd / 100).toFixed(2)}/mo`
                  : 'a monthly fee'}
              </Text>
            </View>
            <Toggle
              value={settings.subscriptionEnabled}
              onValueChange={handleToggleEnabled}
              disabled={!settings.subscriptionPriceUsd}
            />
          </View>

          {/* Current price */}
          <View style={styles.section}>
            <HelpText>MONTHLY PRICE</HelpText>
            {settings.subscriptionPriceUsd ? (
              <Text variant="body">
                Current: ${(settings.subscriptionPriceUsd / 100).toFixed(2)}/mo
              </Text>
            ) : (
              <Text variant="body" color={theme.colors.text.muted}>
                No price set — set one to enable subscriptions
              </Text>
            )}
            <Input
              value={priceInput}
              onChangeText={setPriceInput}
              placeholder="New price in USD (e.g. 5.00)"
              keyboardType="decimal-pad"
            />
            <Button
              label={saving ? 'Saving…' : 'Save price'}
              onPress={handleSavePrice}
              disabled={!priceValid || saving}
            />
            <HelpText>MINIMUM $1.00 · MAXIMUM $1,000.00</HelpText>
          </View>

          {/* Stripe dashboard */}
          <View style={styles.section}>
            <HelpText>PAYOUTS</HelpText>
            <Text variant="caption" color={theme.colors.text.muted}>
              Manage your bank account, view earnings, and handle taxes in the Stripe dashboard.
            </Text>
            <Button label="Open Stripe dashboard" variant="secondary" onPress={handleDashboard} />
          </View>
        </>
      )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
})
