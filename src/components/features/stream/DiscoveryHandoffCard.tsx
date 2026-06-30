// src/components/features/stream/DiscoveryHandoffCard.tsx
//
// The discovery → watching seam (Section 0.7 canonical example).
// Replaces the inline `<View>` blocks in GlobeScreen.tsx for both the
// single-pin tap and the multi-pin cluster tap.
//
// Variants (inferred from prop shape):
//   single  — `{ stream }` — Avatar + title + handle + viewer count +
//             Join button, with an optional `layers` row that renders
//             the StreamStrip section as a second row per C2=A.
//   cluster — `{ streams }` — small header ("N live streams here ·
//             LOCATION") + compact rows (Avatar + title + meta +
//             Join chip).
//
// Floats at the bottom of the GlobeScreen — not a bottom-sheet
// (deferred to v0.3 per the 2026-05-29 decision-log entry).

import type { ComponentProps } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Avatar } from '@/components/primitives/Avatar'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'
import { StreamStrip, type StreamStripLayer } from '@/components/sections/StreamStrip'
import { LivePill } from './LivePill'
import { placeLabel } from '@/lib/location'
import { useBroadcasterClock } from '@/hooks/useBroadcasterClock'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type DiscoveryStream = {
  id: string
  title: string
  handle: string
  displayName?: string
  avatarUrl?: string | null
  viewerCount: number
  isLive?: boolean
  city?: string | null
  // ISO alpha-2; country name is derived client-side. Local time ticks from the
  // IANA timezone. Both city + timezone are server-gated to exact/city precision.
  countryCode?: string | null
  timezone?: string | null
  distance?: string
  layers?: StreamStripLayer[]
  subscribersOnly?: boolean
  subscriptionPriceUsd?: number | null
  // Present when this live stream is a pay-per-view event broadcast.
  ppvEvent?: { id: string; title: string; status: string } | null
  // 'clip' (Time Machine replay) vs the default live 'stream'. A clip shows the
  // `ctaLabel` ("Watch") instead of "Join", no LivePill, and a "replay" caption.
  kind?: 'stream' | 'clip'
  ctaLabel?: string
  onJoin: () => void
}

type SingleProps = {
  stream: DiscoveryStream
  onDismiss?: () => void
  style?: StyleProp<ViewStyle>
}

type ClusterProps = {
  streams: DiscoveryStream[]
  locationLabel?: string
  onDismiss?: () => void
  style?: StyleProp<ViewStyle>
}

type Props = SingleProps | ClusterProps

function isCluster(p: Props): p is ClusterProps {
  return (p as ClusterProps).streams !== undefined
}

export function DiscoveryHandoffCard(props: Props) {
  if (isCluster(props)) {
    return <ClusterCard {...props} />
  }
  return <SingleCard {...props} />
}

// ─── Single ──────────────────────────────────────────────────────────────────

function SingleCard({ stream, onDismiss, style }: SingleProps) {
  const priceLabel = stream.subscriptionPriceUsd
    ? `$${(stream.subscriptionPriceUsd / 100).toFixed(2)}/mo`
    : null
  const place = placeLabel(stream.city, stream.countryCode)
  const localTime = useBroadcasterClock(stream.timezone)

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        <Avatar
          avatarUrl={stream.avatarUrl}
          displayName={stream.displayName ?? stream.handle}
          size="md"
        />
        <View style={styles.col}>
          <Text variant="bodyEmphasized" numberOfLines={1}>
            {stream.title}
          </Text>
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
            @{stream.handle} · {stream.kind === 'clip' ? 'replay' : `${formatViewers(stream.viewerCount)} watching`}
          </Text>
          {(place || localTime) && (
            <View style={styles.lockRow}>
              {place && <Icon name="map-pin" size="sm" color={theme.colors.text.muted} />}
              <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
                {[place, localTime].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
          {priceLabel != null && (
            <View style={styles.lockRow}>
              <Icon
                name={stream.subscribersOnly ? 'lock' : 'star'}
                size="sm"
                color={theme.colors.accent.default}
              />
              <Text variant="monoCaption" color={theme.colors.accent.default}>
                {stream.subscribersOnly ? 'Subscribers only' : 'Subscriptions available'} · {priceLabel}
              </Text>
            </View>
          )}
          {stream.ppvEvent && (
            <View style={styles.lockRow}>
              <Icon name="lock" size="sm" color={theme.colors.warn} />
              <Text variant="monoCaption" color={theme.colors.warn} numberOfLines={1}>
                🎟 PPV · {stream.ppvEvent.title}
              </Text>
            </View>
          )}
        </View>
        {stream.kind !== 'clip' && stream.isLive !== false && <LivePill size="sm" />}
        {onDismiss && (
          <Pressable
            variant="default"
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={8}
            style={styles.close}
          >
            <Icon name="x" size="md" color={theme.colors.text.muted} />
          </Pressable>
        )}
      </View>
      {stream.layers && stream.layers.length > 0 && (
        <StreamStrip layers={stream.layers} />
      )}
      <Button
        variant="primary"
        label={stream.ctaLabel ?? (stream.ppvEvent ? 'Get ticket 🎟' : 'Join')}
        onPress={stream.onJoin}
      />
    </View>
  )
}

// ─── Cluster ─────────────────────────────────────────────────────────────────

function ClusterCard({ streams, locationLabel, onDismiss, style }: ClusterProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text variant="bodyEmphasized">
          {streams.length} live stream{streams.length === 1 ? '' : 's'} here
          {locationLabel ? ` · ${locationLabel}` : ''}
        </Text>
        {onDismiss && (
          <Pressable
            variant="default"
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={8}
            style={styles.close}
          >
            <Icon name="x" size="md" color={theme.colors.text.muted} />
          </Pressable>
        )}
      </View>
      <ScrollView style={styles.clusterScroll}>
        {streams.map((s) => (
          <View key={s.id} style={styles.clusterRow}>
            <Avatar
              avatarUrl={s.avatarUrl}
              displayName={s.displayName ?? s.handle}
              size="sm"
            />
            <View style={styles.col}>
              <Text variant="bodyEmphasized" numberOfLines={1}>
                {s.title}
              </Text>
              <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
                @{s.handle} · {formatViewers(s.viewerCount)}
                {s.distance ? ` · ${s.distance}` : ''}
                {s.subscribersOnly ? ' · 🔒' : s.subscriptionPriceUsd ? ' · ⭐' : ''}
                {s.ppvEvent ? ' · 🎟' : ''}
              </Text>
            </View>
            <Pressable
              variant="default"
              onPress={s.onJoin}
              accessibilityRole="button"
              accessibilityLabel={`Join ${s.handle}`}
              style={styles.joinChip}
            >
              <Text variant="monoLabel" color={theme.colors.accent.default}>
                JOIN
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function formatViewers(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  close: {
    padding: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  clusterScroll: {
    maxHeight: 220,
  },
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  joinChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
})

// keep IconName referenced for users who want to extend layers programmatically
export type DiscoveryIconName = IconName
