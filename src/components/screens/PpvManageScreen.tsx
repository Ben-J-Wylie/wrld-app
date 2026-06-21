import { Alert, Image, Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useState, useCallback } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Icon } from '@/components/primitives/Icon'
import { ppvApi } from '@/api/ppvEvents'
import type { PpvEvent } from '@/types'

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

function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Escrow payout-state note for the creator. Ticket revenue is held until the
// event succeeds; this surfaces where in the lifecycle the money sits.
function PayoutNote({
  payoutStatus,
  payoutOutcome,
  releaseAt,
  hasRevenue,
}: {
  payoutStatus?: PpvEvent['payoutStatus']
  payoutOutcome?: PpvEvent['payoutOutcome']
  releaseAt?: string | null
  hasRevenue: boolean
}) {
  // Nothing held yet (no sales / no status) → no note.
  if (!payoutStatus || !hasRevenue) return null

  let label: string
  switch (payoutStatus) {
    case 'held':
      label = 'Pending — releases after the event'
      break
    case 'scheduled_release':
      label = releaseAt ? `Releasing on ${formatReleaseDate(releaseAt)}` : 'Releasing soon'
      break
    case 'review':
      label = 'In review'
      break
    case 'released':
      label = 'Added to your Stardust'
      break
    case 'refunded':
      label = 'Refunded'
      break
    default:
      return null
  }

  const released = payoutStatus === 'released' && payoutOutcome !== 'failed'
  return (
    <HelpText tone={released ? 'ok' : 'dim'}>{label}</HelpText>
  )
}

export function PpvManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
  const [countdown, setCountdown] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [ending, setEnding] = useState(false)

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

  function handleEnd() {
    Alert.alert(
      'End event',
      `End "${event?.title}"? Ends the live broadcast (if one's running) and clears the PPV requirement so you can stream normally. Ticket holders aren't refunded — use Cancel & refund instead to refund them.`,
      [
        { text: 'Keep event', style: 'cancel' },
        {
          text: 'End event',
          style: 'destructive',
          onPress: async () => {
            setEnding(true)
            try {
              await ppvApi.endEvent(id)
              qc.invalidateQueries({ queryKey: ['ppv-event-manage', id] })
              qc.invalidateQueries({ queryKey: ['my-ppv-events'] })
              qc.invalidateQueries({ queryKey: ['my-scheduled-ppv-events'] })
              refetch()
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Could not end event'
              Alert.alert('Error', msg)
            } finally {
              setEnding(false)
            }
          },
        },
      ],
    )
  }

  if (!event) {
    return (
      <ScreenScroll
        header={<ScreenHeader title="Manage" onBack={() => router.back()} />}
        contentContainerStyle={styles.content}
      >
        <Text variant="body" color={theme.colors.text.muted}>
          {isLoading ? 'Loading…' : 'Event not found.'}
        </Text>
      </ScreenScroll>
    )
  }

  const tz = event.timezone
  const isScheduled = event.status === 'scheduled'
  const isLive = event.status === 'live'
  const canGoLive = isScheduled || isLive
  // "End event" clears the go-live gate — only meaningful once the show is/was
  // live. Ending a not-yet-aired event with ticket holders strands them with no
  // refund (and the server rejects it), so pre-show with buyers, force Cancel.
  const canEnd = isLive || (isScheduled && event.purchaseCount === 0)
  // 1🚀 = 1¢, so netRevenueCents (already net of fee) IS the creator's net Space
  // Bucks — render as 🚀 with NO /100. priceSb is the ticket price (older events
  // may be null → fall back to priceUsd, numerically equal).
  const netRevenueSb = event.netRevenueCents ?? 0
  const priceSb = event.priceSb ?? event.priceUsd ?? 0

  return (
    <ScreenScroll
      header={<ScreenHeader title="Manage" onBack={() => router.back()} />}
      contentContainerStyle={styles.content}
    >
      {/* ── Cover art ──────────────────────────────────────── */}
      {event.thumbnailUrl ? (
        <Image source={{ uri: event.thumbnailUrl }} style={styles.cover} resizeMode="cover" />
      ) : isScheduled ? (
        <Pressable
          style={[styles.cover, styles.coverEmpty]}
          onPress={() => router.push({ pathname: '/(app)/ppv/create', params: { eventId: event.id } })}
        >
          <Icon name="image" size="lg" color={theme.colors.text.muted} />
          <Text variant="caption" color={theme.colors.text.muted}>Add cover art</Text>
        </Pressable>
      ) : null}

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
          <Text variant="heading">{priceSb.toLocaleString()} 🚀</Text>
          <Text variant="caption" color={theme.colors.text.muted}>Per ticket</Text>
        </View>
        <View style={styles.statCard}>
          <Text variant="heading">{netRevenueSb.toLocaleString()} 🚀</Text>
          <Text variant="caption" color={theme.colors.text.muted}>Your earnings</Text>
        </View>
      </View>

      {/* Escrow payout state — ticket revenue is held until the event succeeds. */}
      <PayoutNote
        payoutStatus={event.payoutStatus}
        payoutOutcome={event.payoutOutcome}
        releaseAt={event.releaseAt}
        hasRevenue={netRevenueSb > 0}
      />

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
            When you go live within your event's start window, the dashboard automatically
            airs it as this PPV event — no setup needed.
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
        {canEnd && (
          <Button
            label={ending ? 'Ending…' : 'End event'}
            variant="secondary"
            onPress={handleEnd}
            disabled={ending}
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
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
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
