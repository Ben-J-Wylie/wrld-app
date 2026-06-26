// MonetizeScreen
//
// Creator subscription setup. Lets the creator:
//   1. Connect their Stripe account (opens browser via Stripe Connect onboarding)
//   2. Set a monthly subscription price
//   3. Toggle subscriptions on/off
//   4. Open their Stripe Express dashboard for payout management

import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Toggle } from '@/components/primitives/Toggle'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { PageTabs } from '@/components/features/navigation/PageTabs'
import { usersApi } from '@/api/users'
import { ppvApi } from '@/api/ppvEvents'
import { CREATOR_SUB_TIERS, formatUsd } from '@/lib/subscriptionTiers'
import { usePublicConfig, configTiers } from '@/hooks/usePublicConfig'

export function MonetizeScreen() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['subscription-settings'],
    queryFn: () => usersApi.getSubscriptionSettings(),
  })

  const { data: myEvents } = useQuery({
    queryKey: ['my-ppv-events'],
    queryFn: () => ppvApi.listMyEvents(),
  })

  // Tier ladder from config (server is the charge authority); falls back to the
  // hardcoded ladder before the fetch resolves / offline. A price change is now
  // config-only — no EAS ship to update these labels.
  const { config } = usePublicConfig()
  const tiers = configTiers(config, CREATOR_SUB_TIERS)

  const [saving, setSaving] = useState(false)
  // Hybrid-nav: Subscriptions / Events as in-place page-tabs.
  const [tab, setTab] = useState<'subs' | 'events'>('subs')

  async function handleConnectStripe() {
    try {
      const { url } = await usersApi.startSubscriptionOnboard()
      await Linking.openURL(url)
    } catch {
      Alert.alert('Error', 'Could not open Stripe onboarding')
    }
  }

  async function handleSelectTier(tier: number, priceUsd: number) {
    setSaving(true)
    try {
      await usersApi.updateSubscriptionSettings({ subscriptionTier: tier })
      qc.invalidateQueries({ queryKey: ['subscription-settings'] })
      qc.invalidateQueries({ queryKey: ['currentUser'] })
      Alert.alert('Tier updated', `New subscribers will pay ${formatUsd(priceUsd)}/mo`)
    } catch {
      Alert.alert('Error', 'Could not update subscription tier')
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
    <ScreenScroll
      header={
        <View>
          <ScreenHeader title="Monetize" onBack={() => router.back()} />
          <PageTabs
            tabs={[
              { key: 'subs', label: 'Subscriptions' },
              { key: 'events', label: 'Events' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      }
      contentContainerStyle={styles.scroll}
    >

      {tab === 'subs' &&
        (isLoading ? null : !settings?.onboardingComplete ? (
        <>
          <Text variant="body" color={theme.colors.text.muted}>
            Connect a Stripe account to receive subscription payments. Stripe handles billing,
            payouts, and tax compliance.
          </Text>
          <HelpText>PLATFORM TAKES 40% · YOU KEEP 60%</HelpText>
          <Button label="Connect Stripe" onPress={handleConnectStripe} />
        </>
      ) : (
        <>
          {/* Subscriber stats */}
          {(settings.subscriberCount > 0 || settings.subscriptionPriceUsd) && (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text variant="display">{settings.subscriberCount}</Text>
                <Text variant="monoCaption" color={theme.colors.text.muted}>
                  {settings.subscriberCount === 1 ? 'SUBSCRIBER' : 'SUBSCRIBERS'}
                </Text>
              </View>
              {settings.subscriptionPriceUsd != null && (
                <View style={styles.statBox}>
                  <Text variant="display">
                    ${(settings.estimatedMrrCents / 100).toFixed(0)}
                  </Text>
                  <Text variant="monoCaption" color={theme.colors.text.muted}>
                    EST. MONTHLY
                  </Text>
                </View>
              )}
            </View>
          )}

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
              disabled={!settings.subscriptionTier}
            />
          </View>

          {/* Tier picker (fixed ladder — no arbitrary pricing) */}
          <View style={styles.section}>
            <HelpText>MONTHLY TIER</HelpText>
            {!settings.subscriptionTier && (
              <Text variant="body" color={theme.colors.text.muted}>
                Pick a tier to enable subscriptions
              </Text>
            )}
            <View style={styles.tierGrid}>
              {tiers.map(t => {
                const selected = settings.subscriptionTier === t.tier
                return (
                  <Pressable
                    key={t.tier}
                    onPress={() => handleSelectTier(t.tier, t.priceUsd)}
                    disabled={saving}
                    style={[styles.tierCard, selected && styles.tierCardSelected, saving && styles.tierCardDisabled]}
                  >
                    <Text variant="bodyEmphasized">{formatUsd(t.priceUsd)}</Text>
                    <Text variant="monoCaption" color={theme.colors.text.muted}>
                      TIER {t.tier} · / MO
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <HelpText>FIXED TIERS · SAME ON WEB &amp; APP</HelpText>
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
      ))}

      {/* ── PPV Events ──────────────────────────────────────── */}
      {tab === 'events' && (
        <View style={styles.section}>
        <View style={styles.ppvHeader}>
          <HelpText>PAY-PER-VIEW EVENTS</HelpText>
          <Button
            label="+ Schedule event"
            variant="secondary"
            onPress={() => router.push('/(app)/ppv/create')}
          />
        </View>
        {myEvents && myEvents.length > 0 ? (
          myEvents.map(event => (
            <Pressable
              key={event.id}
              style={styles.ppvCard}
              onPress={() => router.push({
                pathname: '/(app)/ppv/[id]/manage',
                params: { id: event.id },
              })}
            >
              <View style={styles.ppvCardRow}>
                <View style={styles.ppvCardInfo}>
                  <Text variant="bodyEmphasized">{event.title}</Text>
                  <Text variant="caption" color={theme.colors.text.muted}>
                    {new Date(event.scheduledAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.ppvCardRight}>
                  <Text variant="caption" color={theme.colors.text.muted}>
                    {event.status.toUpperCase()}
                  </Text>
                  <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                    {(event.priceSb ?? event.priceUsd ?? 0).toLocaleString()} 🚀
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <Text variant="caption" color={theme.colors.text.muted}>
            No events scheduled yet. Create a PPV event to sell tickets to your next stream.
          </Text>
        )}
        </View>
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
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tierCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: 2,
  },
  tierCardSelected: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  tierCardDisabled: {
    opacity: 0.5,
  },
  ppvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ppvCard: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.md,
  },
  ppvCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  ppvCardInfo: {
    flex: 1,
    gap: 2,
  },
  ppvCardRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
})
