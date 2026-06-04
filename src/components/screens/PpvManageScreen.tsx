import { Alert, StyleSheet, View } from 'react-native'
import { useEffect, useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Icon } from '@/components/primitives/Icon'
import { ppvApi } from '@/api/ppvEvents'

function formatCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return 'Starting now'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatLocalTime(isoUtc: string, tz: string): string {
  return new Date(isoUtc).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function PpvManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
  const [countdown, setCountdown] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const { data: event, isLoading, refetch } = useQuery({
    queryKey: ['ppv-event-manage', id],
    queryFn: () => ppvApi.getMyEvent(id),
    enabled: !!id,
  })

  // Refetch on focus so stats stay fresh
  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  // Countdown ticker
  useEffect(() => {
    if (!event?.scheduledAt) return
    const tick = () => setCountdown(formatCountdown(event.scheduledAt))
    tick()
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [event?.scheduledAt])

  async function handleCancel() {
    Alert.alert(
      'Cancel event',
      `This will cancel "${event?.title}" and issue refunds to all ${event?.purchaseCount ?? 0} purchaser(s). This cannot be undone.`,
      [
        { text: 'Keep event', style: 'cancel' },
        {
          text: 'Cancel & refund',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              const { refundCount } = await ppvApi.cancelEvent(id)
              qc.invalidateQueries({ queryKey: ['ppv-event-manage', id] })
              qc.invalidateQueries({ queryKey: ['my-ppv-events'] })
              Alert.alert('Event cancelled', `${refundCount} refund(s) issued.`, [
                { text: 'OK', onPress: () => router.back() },
              ])
            } catch {
              Alert.alert('Error', 'Could not cancel event')
            } finally {
              setCancelling(false)
            }
          },
        },
      ],
    )
  }

  if (!event) {
    return (
      <ScreenScroll contentContainerStyle={styles.content}>
        <Text variant="body" color={theme.colors.text.muted}>
          {isLoading ? 'Loading…' : 'Event not found.'}
        </Text>
        {!isLoading && (
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        )}
      </ScreenScroll>
    )
  }

  const tz = event.timezone
  const isScheduled = event.status === 'scheduled'
  const isLive = event.status === 'live'
  const canGoLive = isScheduled || isLive
  const feeRate = 0.30
  const netRevenue = event.netRevenueCents ?? Math.round((event.priceUsd * event.purchaseCount) * (1 - feeRate))
  const grossRevenue = event.grossRevenueCents ?? event.priceUsd * event.purchaseCount

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text variant="heading">{event.title}</Text>
        <View style={[styles.badge, isLive ? styles.badgeLive : styles.badgeScheduled]}>
          <Text variant="caption" color={isLive ? '#fff' : theme.colors.text.primary}>
            {isLive ? '● LIVE' : isScheduled ? 'SCHEDULED' : event.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {event.description ? (
        <Text variant="body" color={theme.colors.text.muted}>{event.description}</Text>
      ) : null}

      {/* ── Schedule ──────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.statRow}>
          <Icon name="clock" size="sm" color={theme.colors.text.muted} />
          <Text variant="body">{formatLocalTime(event.scheduledAt, tz)}</Text>
        </View>
        {event.durationMinutes && (
          <View style={styles.statRow}>
            <Icon name="clock" size="sm" color={theme.colors.text.muted} />
            <Text variant="body">~{event.durationMinutes} min</Text>
          </View>
        )}
        {isScheduled && (
          <View style={styles.statRow}>
            <Icon name="zap" size="sm" color={theme.colors.text.muted} />
            <Text variant="body" color={theme.colors.accent.default}>
              Starts in {countdown}
            </Text>
          </View>
        )}
      </View>

      {/* ── Stats ─────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text variant="heading">
            {event.maxCapacity != null
              ? `${event.purchaseCount} / ${event.maxCapacity}`
              : String(event.purchaseCount)}
          </Text>
          <Text variant="caption" color={theme.colors.text.muted}>
            {event.maxCapacity != null ? 'Sold / Cap' : 'Purchasers'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text variant="heading">${(event.priceUsd / 100).toFixed(2)}</Text>
          <Text variant="caption" color={theme.colors.text.muted}>Per ticket</Text>
        </View>
        <View style={styles.statCard}>
          <Text variant="heading">${(netRevenue / 100).toFixed(2)}</Text>
          <Text variant="caption" color={theme.colors.text.muted}>Your earnings (70%)</Text>
        </View>
      </View>

      {event.subscribersFreeAccess && (
        <HelpText>Monthly subscribers get free access</HelpText>
      )}
      {event.replayAccess && (
        <HelpText>Purchasers can watch the replay</HelpText>
      )}

      {/* ── Go Live ───────────────────────────────────────── */}
      {canGoLive && (
        <View style={styles.section}>
          <Text variant="monoLabel">Ready to broadcast?</Text>
          <HelpText>
            Head to the dashboard and go live. Set your event's ID ({event.id.slice(0, 8)}…) in
            the PPV field when prompted to link this event to your stream.
          </HelpText>
          <Button
            label="Go to Dashboard"
            onPress={() => router.navigate('/(app)/dashboard')}
          />
        </View>
      )}

      {/* ── Actions ───────────────────────────────────────── */}
      <View style={styles.section}>
        {isScheduled && (
          <Button
            label="Edit event"
            variant="secondary"
            onPress={() => router.push({
              pathname: '/(app)/ppv/create',
              params: { eventId: event.id },
            })}
          />
        )}
        {(isScheduled || isLive) && (
          <Button
            label={cancelling ? 'Cancelling…' : 'Cancel event & refund'}
            variant="secondary"
            onPress={handleCancel}
            disabled={cancelling}
          />
        )}
      </View>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  badgeLive: {
    backgroundColor: theme.colors.accent.default,
  },
  badgeScheduled: {
    backgroundColor: theme.colors.bg.elevated,
  },
  card: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 12,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  section: {
    gap: theme.spacing.sm,
  },
})
