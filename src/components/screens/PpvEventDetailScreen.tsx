import { Alert, Linking, StyleSheet, View } from 'react-native'
import { useCallback, useEffect, useState } from 'react'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
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

function formatEventTime(isoUtc: string): string {
  const d = new Date(isoUtc)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function formatCreatorTime(isoUtc: string, tz: string): string {
  return new Date(isoUtc).toLocaleString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function PpvEventDetailScreen() {
  const { id, handle } = useLocalSearchParams<{ id: string; handle?: string }>()
  const { isSignedIn } = useAuth()
  const qc = useQueryClient()
  const [countdown, setCountdown] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [accessStatus, setAccessStatus] = useState<{ hasAccess: boolean; free: boolean } | null>(null)

  // Load event from cache populated by ProfileScreen, or re-fetch via the handle param
  const cachedEvents = handle
    ? (qc.getQueryData<Awaited<ReturnType<typeof ppvApi.getCreatorEvents>>>(['ppv-events-profile', handle]) ?? [])
    : []
  const eventData = cachedEvents.find(e => e.id === id) ?? null

  const { data: fetchedEvents } = useQuery({
    queryKey: ['ppv-events-profile', handle],
    queryFn: () => ppvApi.getCreatorEvents(handle!),
    enabled: !!handle && cachedEvents.length === 0,
  })
  const event = eventData ?? fetchedEvents?.find(e => e.id === id) ?? null

  useFocusEffect(useCallback(() => {
    if (!isSignedIn) return
    ppvApi.getAccessStatus(id)
      .then(setAccessStatus)
      .catch(() => setAccessStatus({ hasAccess: false, free: false }))
  }, [id, isSignedIn]))

  useEffect(() => {
    if (!event?.scheduledAt) return
    const tick = () => setCountdown(formatCountdown(event.scheduledAt))
    tick()
    const interval = setInterval(tick, 30_000)
    return () => clearInterval(interval)
  }, [event?.scheduledAt])

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

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <View style={styles.icon}><Icon name="video" size="lg" color={theme.colors.accent.default} /></View>

      {/* ── Title & creator ───────────────────────────────── */}
      <View style={styles.center}>
        <Text variant="heading" style={styles.textCenter}>
          {event?.title ?? 'PPV Event'}
        </Text>
        {event?.host && (
          <Text variant="caption" color={theme.colors.text.muted} style={styles.textCenter}>
            @{event.host.handle}
          </Text>
        )}
        {event?.description && (
          <Text variant="body" color={theme.colors.text.muted} style={styles.textCenter}>
            {event.description}
          </Text>
        )}
      </View>

      {/* ── Price + schedule ─────────────────────────────── */}
      {event && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Icon name="tag" size="sm" color={theme.colors.text.muted} />
            <Text variant="body">${(event.priceUsd / 100).toFixed(2)}</Text>
            {event.subscribersFreeAccess && (
              <Text variant="caption" color={theme.colors.text.muted}> · Free for subscribers</Text>
            )}
          </View>
          {countdown.length > 0 && (
            <View style={styles.row}>
              <Icon name="clock" size="sm" color={theme.colors.text.muted} />
              <Text variant="body">Starts in {countdown}</Text>
            </View>
          )}
          {event.durationMinutes && (
            <View style={styles.row}>
              <Icon name="clock" size="sm" color={theme.colors.text.muted} />
              <Text variant="body">~{event.durationMinutes} min</Text>
            </View>
          )}
          {event.replayAccess && (
            <View style={styles.row}>
              <Icon name="film" size="sm" color={theme.colors.text.muted} />
              <Text variant="body">Replay access included</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Access status ─────────────────────────────────── */}
      {hasAccess ? (
        <View style={styles.accessGranted}>
          <Icon name="check-circle" size="md" color={theme.colors.accent.default} />
          <Text variant="body" color={theme.colors.accent.default}>
            {isFreeAccess ? 'Free access (subscriber)' : 'Access purchased ✓'}
          </Text>
          <HelpText>You'll receive a notification when the stream starts.</HelpText>
        </View>
      ) : (
        <View style={styles.purchaseArea}>
          <Text variant="body" color={theme.colors.text.muted} style={styles.textCenter}>
            Purchase once to watch live{event?.replayAccess ? ' and keep replay access' : ''}.
          </Text>
          <Button
            label={purchasing ? 'Opening checkout…' : `Buy access · $${event ? (event.priceUsd / 100).toFixed(2) : '—'}`}
            onPress={handlePurchase}
            disabled={purchasing}
          />
          {!isSignedIn && (
            <HelpText style={styles.textCenter}>
              Sign in to purchase access
            </HelpText>
          )}
        </View>
      )}

      <Button
        label="Back"
        variant="secondary"
        onPress={() => router.back()}
      />
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    alignItems: 'stretch',
    paddingBottom: theme.spacing.xxxl,
  },
  icon: {
    alignSelf: 'center',
  },
  center: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  textCenter: {
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 12,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
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
    borderRadius: 12,
  },
  purchaseArea: {
    gap: theme.spacing.md,
    alignItems: 'stretch',
  },
})
