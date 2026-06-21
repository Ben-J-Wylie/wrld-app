import { ActivityIndicator, Alert, Image, StyleSheet, View } from 'react-native'
import { useCallback, useEffect, useState } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { onPpvSocketEvent } from '@/lib/ppvSocketEvents'
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
import { CURRENT_USER_KEY } from '@/hooks/useCurrentUser'

// PPV is purchased with Space Bucks (1 🚀 = 1¢). Older events may carry a null
// priceSb, so fall back to priceUsd (numerically equal) then 0.
function ppvPriceSb(event: { priceSb?: number | null; priceUsd?: number | null }): number {
  return event.priceSb ?? event.priceUsd ?? 0
}

const PPV_REPORT_REASONS = [
  { value: 'never_started', label: 'It never started' },
  { value: 'ended_early', label: 'It ended early' },
  { value: 'technical', label: 'Technical / quality problem' },
  { value: 'not_as_described', label: 'Not as described' },
]

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
  const [reportDone, setReportDone] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [accessStatus, setAccessStatus] = useState<{ hasAccess: boolean; free: boolean } | null>(null)
  // Live event status for the waiting room — refreshed by polling
  const [liveStatus, setLiveStatus] = useState<{ status: string; roomId: string | null } | null>(null)
  const [eventOver, setEventOver] = useState<'ended' | 'cancelled' | 'admin_cancelled' | null>(null)
  const [cancelling, setCancelling] = useState(false)

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

  // Waiting room: a ticket holder waiting for a scheduled event gets the live/ended
  // pushes over the user socket — no polling, however far out the event is.
  const hasAccessLocal = accessStatus?.hasAccess ?? event?.hasAccess ?? false
  const isScheduledLocally = (liveStatus?.status ?? event?.status) === 'scheduled'
  const waitingForLive = isSignedIn && hasAccessLocal && isScheduledLocally

  // One-shot catch-up on focus — covers a push that landed before this screen
  // mounted or while the socket was briefly down. Needs the creator handle.
  useFocusEffect(useCallback(() => {
    if (!waitingForLive || !handle) return
    ppvApi.getCreatorEvents(handle)
      .then(events => {
        const updated = events.find(e => e.id === id)
        if (updated) setLiveStatus({ status: updated.status, roomId: updated.streamRoomId ?? null })
      })
      .catch(() => {})
  }, [waitingForLive, handle, id]))

  // Live/ended pushes drive the waiting room (no polling).
  useEffect(() => onPpvSocketEvent((e) => {
    if (e.eventId !== id) return
    if (e.type === 'ppv_event_live') {
      setLiveStatus({ status: 'live', roomId: e.mediasoupRoomId ?? null })
    } else if (e.type === 'ppv_event_ended') {
      setEventOver(e.reason === 'cancelled' ? 'cancelled' : e.reason === 'admin_cancelled' ? 'admin_cancelled' : 'ended')
    }
  }), [id])

  function handleCancelPurchase() {
    if (!event) return
    Alert.alert(
      'Cancel your ticket?',
      `You'll be refunded ${ppvPriceSb(event).toLocaleString()} 🚀. You can buy again any time before the event starts.`,
      [
        { text: 'Keep ticket', style: 'cancel' },
        {
          text: 'Cancel & refund',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true)
            try {
              await ppvApi.cancelPurchase(id)
              setAccessStatus({ hasAccess: false, free: false })
              qc.invalidateQueries({ queryKey: ['ppv-events-profile', handle] })
              Alert.alert('Refunded', 'Your ticket was cancelled and refunded.')
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Could not cancel your ticket.'
              Alert.alert('Error', msg)
            } finally {
              setCancelling(false)
            }
          },
        },
      ],
    )
  }

  function handlePurchase() {
    if (!isSignedIn) {
      router.push('/(auth)/login')
      return
    }
    // This stream is ALSO subscriber-only — a ticket alone won't grant entry.
    // Warn before charging so nobody buys a ticket they can't use.
    if (event?.streamSubscribersOnly) {
      Alert.alert(
        'Subscription also required',
        `Heads up — this stream is subscriber-only. A ticket alone won't get you in; you also need an active subscription to @${event.host?.handle ?? 'this creator'}. Make sure you're subscribed before you buy.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy ticket anyway', onPress: () => { void doPurchase() } },
        ],
      )
      return
    }
    void doPurchase()
  }

  async function doPurchase() {
    setPurchasing(true)
    try {
      // The only PPV purchase path: instant in-app Space Bucks. The response
      // drives access state directly — no browser round-trip, no re-poll.
      const res = await ppvApi.purchaseWithSpaceBucks(id)
      setAccessStatus({ hasAccess: res.purchased, free: res.free })
      qc.invalidateQueries({ queryKey: CURRENT_USER_KEY })
      qc.invalidateQueries({ queryKey: ['ppv-events-profile', handle] })
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        Alert.alert('Not enough Space Bucks', 'Top up your balance to buy this ticket.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Top up', onPress: () => router.push('/(app)/wallet') },
        ])
        return
      }
      if (status === 409) {
        // Already has access — reflect it rather than erroring.
        setAccessStatus({ hasAccess: true, free: false })
        return
      }
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
  // The mediasoup room to join — what /stream/[id] expects (not the DB stream id).
  const currentRoomId = liveStatus?.roomId ?? event?.streamRoomId ?? null
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
      {/* ── Cover art ───────────────────────────────────────── */}
      {event.thumbnailUrl ? (
        <Image source={{ uri: event.thumbnailUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Icon name="calendar" size="lg" color={theme.colors.text.muted} />
        </View>
      )}

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
          <Text variant="body">
            {ppvPriceSb(event).toLocaleString()} 🚀
          </Text>
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
      {eventOver ? (
        <View style={styles.accessGranted}>
          <Text variant="bodyEmphasized">
            {eventOver === 'admin_cancelled' ? 'Ended by an administrator'
              : eventOver === 'cancelled' ? 'Cancelled by the creator'
              : 'This event has ended'}
          </Text>
          {(eventOver === 'cancelled' || eventOver === 'admin_cancelled') && hasAccess && !isFreeAccess && (
            <Text variant="caption" color={theme.colors.text.muted}>
              You&apos;ve been credited {ppvPriceSb(event).toLocaleString()} 🚀 back to your balance.
            </Text>
          )}
          {eventOver === 'ended' && hasAccess && !isFreeAccess && (
            reportDone ? (
              <Text variant="caption" color={theme.colors.text.muted}>Thanks — your report was submitted.</Text>
            ) : (
              <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
                <Text variant="caption" color={theme.colors.text.muted}>Was there a problem with this event?</Text>
                {PPV_REPORT_REASONS.map(r => (
                  <Button
                    key={r.value}
                    label={r.label}
                    variant="secondary"
                    onPress={async () => {
                      try { await ppvApi.reportProblem(id, r.value); setReportDone(true) }
                      catch { Alert.alert('Error', 'Could not submit report.') }
                    }}
                  />
                ))}
              </View>
            )
          )}
          <Button label="Back to events" variant="secondary" onPress={() => router.back()} />
        </View>
      ) : hasAccess ? (
        <View style={styles.accessGranted}>
          <Icon name="check-circle" size="md" color={theme.colors.accent.default} />
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            {isFreeAccess ? 'Free access — you\'re a subscriber' : 'Access purchased ✓'}
          </Text>
          {isLive && currentRoomId ? (
            // Event is live and viewer has access — show the join button
            <Button
              label="Join now →"
              onPress={() => router.push({
                pathname: '/(app)/stream/[id]',
                params: { id: currentRoomId, sources: '' },
              })}
            />
          ) : isLive ? (
            // Live but streamId not resolved yet
            <Text variant="caption" color={theme.colors.text.muted}>
              The stream is live — join from the creator's profile.
            </Text>
          ) : (
            // Scheduled — waiting room (live push arrives over the socket, no polling)
            <View style={styles.waitingRoom}>
              <ActivityIndicator size="small" color={theme.colors.text.muted} />
              <Text variant="caption" color={theme.colors.text.muted}>
                You&apos;re in — we&apos;ll bring you in automatically when it starts.
              </Text>
            </View>
          )}
          {!isFreeAccess && currentStatus === 'scheduled' && (
            <Button
              label={cancelling ? 'Cancelling…' : 'Cancel ticket & refund'}
              variant="secondary"
              onPress={handleCancelPurchase}
              disabled={cancelling}
            />
          )}
        </View>
      ) : (
        <View style={styles.purchaseArea}>
          <Button
            label={purchasing ? 'Purchasing…' : `Buy ticket · ${ppvPriceSb(event).toLocaleString()} 🚀`}
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
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
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
