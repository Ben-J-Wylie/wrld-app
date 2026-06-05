import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Icon } from '@/components/primitives/Icon'
import { ppvApi } from '@/api/ppvEvents'

// Poll interval for the waiting room (30 s)
const WAITING_ROOM_POLL_MS = 30_000

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function PpvEventDetailScreen() {
  const { id, handle } = useLocalSearchParams<{ id: string; handle?: string }>()
  const { isSignedIn } = useAuth()
  const qc = useQueryClient()
  const [countdown, setCountdown] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [accessStatus, setAccessStatus] = useState<{ hasAccess: boolean; free: boolean } | null>(null)
  // Live event status for the waiting room — refreshed by polling
  const [liveStatus, setLiveStatus] = useState<{ status: string; streamId: string | null } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Try cache first (seeded by ProfileScreen), then fetch if needed
  const cachedEvents = handle
    ? (qc.getQueryData<Awaited<ReturnType<typeof ppvApi.getCreatorEvents>>>(['ppv-events-profile', handle]) ?? [])
    : []
  const cachedEvent = cachedEvents.find(e => e.id === id) ?? null

  const { data: fetchedEvents, isLoading } = useQuery({
    queryKey: ['ppv-events-profile', handle],
    queryFn: () => ppvApi.getCreatorEvents(handle!),
    enabled: !!handle && !cachedEvent,
    staleTime: 60_000,
  })

  const event = cachedEvent ?? fetchedEvents?.find(e => e.id === id) ?? null

  useFocusEffect(useCallback(() => {
    if (!isSignedIn) return
    ppvApi.getAccessStatus(id)
      .then(setAccessStatus)
      .catch(() => setAccessStatus({ hasAccess: false, free: false }))
  }, [id, isSignedIn]))

  // Countdown ticker
  useEffect(() => {
    if (!event?.scheduledAt) return
    const tick = () => setCountdown(formatCountdown(event.scheduledAt))
    tick()
    const interval = setInterval(tick, 30_000)
    return () => clearInterval(interval)
  }, [event?.scheduledAt])

  // Waiting room: poll event status when scheduled + has access.
  // Once the event goes live we show the join button immediately.
  const hasAccessLocal = accessStatus?.hasAccess ?? event?.hasAccess ?? false
  const isScheduledLocally = (liveStatus?.status ?? event?.status) === 'scheduled'
  const shouldPoll = isSignedIn && hasAccessLocal && isScheduledLocally

  useEffect(() => {
    if (!shouldPoll) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }

    async function checkStatus() {
      try {
        // Re-fetch creator events to get updated status + streamId
        if (!handle) return
        const events = await ppvApi.getCreatorEvents(handle)
        const updated = events.find(e => e.id === id)
        if (updated) setLiveStatus({ status: updated.status, streamId: updated.streamId ?? null })
      } catch {
        // ignore
      }
    }

    checkStatus()
    pollRef.current = setInterval(checkStatus, WAITING_ROOM_POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [shouldPoll, id, handle])

  async function handlePurchase() {
    if (!isSignedIn) {
      router.push('/(auth)/login')
      return
    }
    setPurchasing(true)
    try {
      const { free, url } = await ppvApi.createAccessSession(id)
      if (free) {
        setAccessStatus({ hasAccess: true, free: true })
        Alert.alert('Access granted', 'You have free access as a subscriber.')
        return
      }
      if (url) {
        await Linking.openURL(url)
        const status = await ppvApi.getAccessStatus(id)
        setAccessStatus(status)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not complete purchase'
      Alert.alert('Error', msg)
    } finally {
      setPurchasing(false)
    }
  }

  const hasAccess = accessStatus?.hasAccess ?? event?.hasAccess ?? false
  const isFreeAccess = accessStatus?.free ?? false
  // Use polling-updated status when available, fall back to the event data
  const currentStatus = liveStatus?.status ?? event?.status
  const currentStreamId = liveStatus?.streamId ?? event?.streamId ?? null
  const isLive = currentStatus === 'live'

  if (isLoading && !event) {
    return (
      <ScreenScroll
        header={<ScreenHeader title="Event" onBack={() => router.back()} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      </ScreenScroll>
    )
  }

  if (!event) {
    return (
      <ScreenScroll
        header={<ScreenHeader title="Event" onBack={() => router.back()} />}
        contentContainerStyle={styles.content}
      >
        <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
          Event not found.
        </Text>
      </ScreenScroll>
    )
  }

  return (
    <ScreenScroll
      header={<ScreenHeader title="Event" onBack={() => router.back()} />}
      contentContainerStyle={styles.content}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.titleRow}>
        <Text variant="heading" style={styles.flex}>{event.title}</Text>
        {isLive && (
          <View style={styles.liveBadge}>
            <Text variant="monoCaption" color={theme.colors.text.inverse}>LIVE</Text>
          </View>
        )}
      </View>

      {event.host && (
        <Text variant="caption" color={theme.colors.text.muted}>by @{event.host.handle}</Text>
      )}

      {event.description ? (
        <Text variant="body" color={theme.colors.text.muted}>{event.description}</Text>
      ) : null}

      {/* ── Event details ───────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name="calendar" size="sm" color={theme.colors.text.muted} />
          <Text variant="body">{formatDate(event.scheduledAt)}</Text>
        </View>
        {countdown ? (
          <View style={styles.row}>
            <Icon name="clock" size="sm" color={theme.colors.accent.default} />
            <Text variant="body" color={theme.colors.accent.default}>
              {isLive ? 'Live now' : `Starts in ${countdown}`}
            </Text>
          </View>
        ) : null}
        {event.durationMinutes ? (
          <View style={styles.row}>
            <Icon name="clock" size="sm" color={theme.colors.text.muted} />
            <Text variant="body">~{event.durationMinutes} min</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Icon name="tag" size="sm" color={theme.colors.text.muted} />
          <Text variant="body">${(event.priceUsd / 100).toFixed(2)}</Text>
          {event.subscribersFreeAccess && (
            <Text variant="caption" color={theme.colors.accent.default}> · free for subscribers</Text>
          )}
        </View>
        {event.replayAccess && (
          <View style={styles.row}>
            <Icon name="film" size="sm" color={theme.colors.text.muted} />
            <Text variant="body">Replay access included</Text>
          </View>
        )}
      </View>

      {/* ── Access / purchase ───────────────────────────────── */}
      {hasAccess ? (
        <View style={styles.accessGranted}>
          <Icon name="check-circle" size="md" color={theme.colors.accent.default} />
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            {isFreeAccess ? 'Free access — you\'re a subscriber' : 'Access purchased ✓'}
          </Text>
          {isLive && currentStreamId ? (
            // Event is live and viewer has access — show the join button
            <Button
              label="Join now →"
              onPress={() => router.push({
                pathname: '/(app)/stream/[id]',
                params: { id: currentStreamId, sources: '' },
              })}
            />
          ) : isLive ? (
            // Live but streamId not resolved yet
            <Text variant="caption" color={theme.colors.text.muted}>
              The stream is live — join from the creator's profile.
            </Text>
          ) : (
            // Scheduled — waiting room
            <View style={styles.waitingRoom}>
              <ActivityIndicator size="small" color={theme.colors.text.muted} />
              <Text variant="caption" color={theme.colors.text.muted}>
                Waiting for the stream to start… checking every 30 seconds.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.purchaseArea}>
          <Button
            label={purchasing ? 'Opening checkout…' : `Buy ticket · $${(event.priceUsd / 100).toFixed(2)}`}
            onPress={handlePurchase}
            disabled={purchasing}
          />
          <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
            One-time purchase. {event.replayAccess ? 'Includes replay access.' : ''}
            {event.subscribersFreeAccess ? '\nSubscribers get free access.' : ''}
          </Text>
          {!isSignedIn && (
            <HelpText style={styles.center}>Sign in to purchase access.</HelpText>
          )}
        </View>
      )}

    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    alignItems: 'stretch',
    paddingBottom: theme.spacing.xxxl,
  },
  loadingWrap: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  liveBadge: {
    backgroundColor: '#D0233A',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    marginTop: 2,
  },
  card: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  accessGranted: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  waitingRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  purchaseArea: {
    gap: theme.spacing.sm,
  },
})
