import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useCallback, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Text } from '@/components/primitives/Text'
import { Button } from '@/components/primitives/Button'
import { ppvApi } from '@/api/ppvEvents'
import { useCurrentUser } from '@/hooks/useCurrentUser'
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

function EventCard({ event, isSignedIn, currentUserId }: { event: PpvEvent; isSignedIn: boolean; currentUserId?: string }) {
  const isLive = event.status === 'live'
  const isScheduled = event.status === 'scheduled'
  const countdown = isScheduled ? formatCountdown(event.scheduledAt) : ''
  const isMyEvent = !!currentUserId && event.hostId === currentUserId
  // hasAccess from the discover endpoint (set when viewer is authenticated)
  const hasAccess = event.hasAccess ?? false
  const canJoin = isLive && hasAccess && !!event.streamId

  function handlePress() {
    if (isMyEvent) {
      // Host taps their own event → go to the manage screen
      router.push({ pathname: '/(app)/ppv/[id]/manage', params: { id: event.id } })
      return
    }
    if (canJoin) {
      router.push({
        pathname: '/(app)/stream/[id]',
        params: { id: event.streamId!, sources: '' },
      })
      return
    }
    router.push({
      pathname: '/(app)/ppv/[id]',
      params: { id: event.id, handle: event.host?.handle ?? '' },
    })
  }

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.cardTop}>
        <Text variant="bodyEmphasized" style={styles.cardTitle}>{event.title}</Text>
        <View style={styles.badgeRow}>
          {isMyEvent && (
            <View style={[styles.badge, styles.myEventBadge]}>
              <Text variant="monoCaption" color={theme.colors.accent.default}>MY EVENT</Text>
            </View>
          )}
          {hasAccess && isSignedIn && !isMyEvent && (
            <View style={[styles.badge, styles.accessBadge]}>
              <Text variant="monoCaption" color="#22c55e">ACCESS ✓</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: isLive ? STATUS_COLORS.live : theme.colors.bg.panel }]}>
            <Text
              variant="monoCaption"
              color={isLive ? theme.colors.text.inverse : STATUS_COLORS[event.status] ?? theme.colors.text.muted}
            >
              {isLive ? '● LIVE' : event.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {event.host && (
        <Text variant="caption" color={theme.colors.text.muted}>@{event.host.handle}</Text>
      )}

      <View style={styles.dateRow}>
        <Text variant="caption" color={theme.colors.text.muted}>{formatDate(event.scheduledAt)}</Text>
        {countdown ? (
          <Text variant="caption" color={theme.colors.accent.default}>{countdown}</Text>
        ) : null}
      </View>

      <View style={styles.priceRow}>
        <Text variant="caption" color={theme.colors.text.muted}>
          ${(event.priceUsd / 100).toFixed(2)} per ticket
        </Text>
        {event.subscribersFreeAccess && (
          <Text variant="caption" color={theme.colors.accent.default}>· free for subscribers</Text>
        )}
      </View>

      {event.durationMinutes || event.replayAccess ? (
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
        </View>
      ) : null}

      {/* CTA row — only shown in special cases on the index (detail screen handles purchase) */}
      {!isMyEvent && isLive && hasAccess && isSignedIn && (
        <Button label="Join now →" onPress={handlePress} />
      )}
      {!isMyEvent && isScheduled && hasAccess && isSignedIn && (
        <Text variant="caption" color={theme.colors.text.muted}>
          You have access — you'll be notified when it starts.
        </Text>
      )}
    </Pressable>
  )
}

export function PpvIndexScreen() {
  const { isSignedIn } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const [refreshing, setRefreshing] = useState(false)
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['all-ppv-events'],
    queryFn: () => ppvApi.listAllEvents(),
  })

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const upcoming = events?.filter(e => e.status === 'scheduled') ?? []
  const live = events?.filter(e => e.status === 'live') ?? []

  return (
    <ScreenScroll
      header={<ScreenHeader title="Events" />}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.accent.default}
        />
      }
    >

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      ) : !events || events.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" color={theme.colors.text.muted} style={styles.emptyText}>
            No upcoming events right now.
          </Text>
          <Text variant="caption" color={theme.colors.text.muted} style={styles.emptyText}>
            When creators schedule paid live events they'll appear here.
          </Text>
        </View>
      ) : (
        <>
          {live.length > 0 && (
            <View style={styles.section}>
              <Text variant="monoLabel" color={theme.colors.text.muted}>LIVE NOW</Text>
              {live.map(e => <EventCard key={e.id} event={e} isSignedIn={!!isSignedIn} currentUserId={currentUser?.id} />)}
            </View>
          )}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <Text variant="monoLabel" color={theme.colors.text.muted}>UPCOMING</Text>
              {upcoming.map(e => <EventCard key={e.id} event={e} isSignedIn={!!isSignedIn} currentUserId={currentUser?.id} />)}
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  badge: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  accessBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  myEventBadge: {
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
