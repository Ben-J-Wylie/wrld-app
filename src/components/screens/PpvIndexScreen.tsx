import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { ppvApi } from '@/api/ppvEvents'
import type { PpvEvent } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  live:      '#D0233A',
  scheduled: theme.colors.accent.default,
  ended:     theme.colors.text.muted,
  cancelled: theme.colors.text.muted,
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return ''
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${mins}m`
  if (mins > 0) return `in ${mins}m`
  return 'starting soon'
}

function EventCard({ event }: { event: PpvEvent }) {
  const isLive = event.status === 'live'
  const isScheduled = event.status === 'scheduled'
  const countdown = isScheduled ? formatCountdown(event.scheduledAt) : ''
  const feeRate = 0.30
  const netRevenue = event.netRevenueCents ?? Math.round(event.priceUsd * event.purchaseCount * (1 - feeRate))

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/(app)/ppv/[id]/manage', params: { id: event.id } })}
    >
      <View style={styles.cardTop}>
        <Text variant="bodyEmphasized" style={styles.cardTitle}>{event.title}</Text>
        <View style={[styles.badge, { backgroundColor: isLive ? STATUS_COLORS.live : theme.colors.bg.panel }]}>
          <Text
            variant="monoCaption"
            color={isLive ? theme.colors.text.inverse : STATUS_COLORS[event.status] ?? theme.colors.text.muted}
          >
            {isLive ? '● LIVE' : event.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <Text variant="caption" color={theme.colors.text.muted}>{formatDate(event.scheduledAt)}</Text>
        {countdown ? (
          <Text variant="caption" color={theme.colors.accent.default}>{countdown}</Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text variant="display">{event.purchaseCount}</Text>
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {event.purchaseCount === 1 ? 'TICKET' : 'TICKETS'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text variant="display">${(event.priceUsd / 100).toFixed(2)}</Text>
          <Text variant="monoCaption" color={theme.colors.text.muted}>PER TICKET</Text>
        </View>
        <View style={styles.stat}>
          <Text variant="display">${(netRevenue / 100).toFixed(2)}</Text>
          <Text variant="monoCaption" color={theme.colors.text.muted}>YOUR TAKE</Text>
        </View>
      </View>

      {event.durationMinutes || event.replayAccess || event.subscribersFreeAccess ? (
        <View style={styles.tagsRow}>
          {event.durationMinutes ? (
            <View style={styles.tag}>
              <Text variant="caption" color={theme.colors.text.muted}>~{event.durationMinutes} min</Text>
            </View>
          ) : null}
          {event.replayAccess ? (
            <View style={styles.tag}>
              <Text variant="caption" color={theme.colors.text.muted}>Replay included</Text>
            </View>
          ) : null}
          {event.subscribersFreeAccess ? (
            <View style={styles.tag}>
              <Text variant="caption" color={theme.colors.accent.default}>Free for subscribers</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}

export function PpvIndexScreen() {
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['my-ppv-events'],
    queryFn: () => ppvApi.listMyEvents(),
  })

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  const upcoming = events?.filter(e => e.status === 'scheduled' || e.status === 'live') ?? []
  const past = events?.filter(e => e.status === 'ended' || e.status === 'cancelled') ?? []

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="heading">PPV Events</Text>
        <Button
          label="+ Schedule"
          variant="secondary"
          onPress={() => router.push('/(app)/ppv/create')}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      ) : !events || events.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" color={theme.colors.text.muted} style={styles.emptyText}>
            You haven't scheduled any PPV events yet.
          </Text>
          <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
            Schedule a paid live event, set a ticket price, and viewers purchase access before you go live.
          </Text>
          <Button
            label="Schedule your first event"
            onPress={() => router.push('/(app)/ppv/create')}
          />
        </View>
      ) : (
        <>
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <Text variant="monoLabel" color={theme.colors.text.muted}>UPCOMING</Text>
              {upcoming.map(e => <EventCard key={e.id} event={e} />)}
            </View>
          )}
          {past.length > 0 && (
            <View style={styles.section}>
              <Text variant="monoLabel" color={theme.colors.text.muted}>PAST</Text>
              {past.map(e => <EventCard key={e.id} event={e} />)}
            </View>
          )}
        </>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  empty: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
  },
  section: {
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cardTitle: {
    flex: 1,
  },
  badge: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.subtle,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
})
