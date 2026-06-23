// src/components/screens/ProfileScreen.tsx
//
// 12.6 migration target. Composes:
//   • ScreenScroll for the scroll viewport
//   • IconButton (arrow-left) for back navigation
//   • Avatar primitive (size lg) + Text variants for the centered
//     identity header
//   • MetaStrip for the "Joined ..." caption (PublicUser carries
//     createdAt; bio / region / pronouns / socials aren't on the
//     PublicUser shape today, so PassportCard isn't a fit yet)
//   • Bespoke 2-up stat cards (Followers / Following) — the big-
//     number-with-label layout reads as the visual hierarchy of a
//     profile flex move; MetaStrip would flatten it
//   • FollowButton (for other profiles) / Button (for own profile)

import { useState } from 'react'
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Avatar } from '@/components/primitives/Avatar'
import { Text } from '@/components/primitives/Text'
import { FollowButton } from '@/components/features/user/FollowButton'
import { ProfileTipSheet } from '@/components/features/user/ProfileTipSheet'
import { ProfileGiftSheet } from '@/components/features/user/ProfileGiftSheet'
import { MetaStrip } from '@/components/features/user/MetaStrip'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'
import { ppvApi } from '@/api/ppvEvents'
import { useQuery } from '@tanstack/react-query'

function formatEventDate(iso: string): string {
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

function formatJoined(iso: string): string {
  try {
    const d = new Date(iso)
    return `Joined ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`
  } catch {
    return ''
  }
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function ProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const { isSignedIn } = useAuth()
  const { data: profile, isLoading, error } = useUserProfile(handle ?? null)
  const { data: me } = useCurrentUser()

  const isOwnProfile = !!me && me.handle === handle
  const [tipVisible, setTipVisible] = useState(false)
  const [giftVisible, setGiftVisible] = useState(false)
  const [blocking, setBlocking] = useState(false)

  // Block: once blocked, the pair is hidden (the profile 404s), so leave to the
  // globe on success. Unblock lives in Settings → Privacy.
  function handleBlock() {
    Alert.alert(
      `Block @${handle}?`,
      'They won’t be able to view your profile, find you in search, follow you, tip or gift you, or join your live streams. You can unblock from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlocking(true)
            try {
              await usersApi.block(handle)
              router.navigate('/(app)/globe')
            } catch {
              Alert.alert('Error', 'Could not block this user — try again.')
              setBlocking(false)
            }
          },
        },
      ],
    )
  }

  const { data: subStatus, refetch: refetchSubStatus } = useQuery({
    queryKey: ['subscription-status', handle],
    queryFn: () => usersApi.getSubscriptionStatus(handle!),
    enabled: !!isSignedIn && !isOwnProfile && !!profile?.subscriptionEnabled,
  })

  const { data: ppvEvents } = useQuery({
    queryKey: ['ppv-events-profile', handle],
    queryFn: () => ppvApi.getCreatorEvents(handle!),
    enabled: !!handle,
  })

  if (isLoading) {
    return (
      <ScreenScroll contentContainerStyle={styles.loadingScroll}>
        <ActivityIndicator color={theme.colors.accent.default} />
      </ScreenScroll>
    )
  }

  if (error || !profile) {
    return (
      <ScreenScroll
        header={<ScreenHeader onBack={() => router.back()} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.notFound}>
          <Text variant="body" color={theme.colors.text.muted}>
            User not found
          </Text>
        </View>
      </ScreenScroll>
    )
  }

  const joinedLine = formatJoined(profile.createdAt)

  return (
    <ScreenScroll
      header={<ScreenHeader onBack={() => router.back()} />}
      contentContainerStyle={styles.content}
    >
      <View style={styles.identity}>
        <Avatar
          avatarUrl={profile.avatarUrl}
          displayName={profile.displayName}
          size="xl"
        />
        <Text variant="display" style={styles.center}>
          {profile.displayName}
        </Text>
        <Text variant="body" color={theme.colors.text.muted}>
          @{profile.handle}
        </Text>
        {joinedLine && (
          <MetaStrip rows={[[{ value: joinedLine }]]} style={styles.metaStrip} />
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text variant="display">{formatCount(profile.followerCount)}</Text>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>
            FOLLOWERS
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text variant="display">{formatCount(profile.followingCount)}</Text>
          <Text variant="monoLabel" color={theme.colors.text.subtle}>
            FOLLOWING
          </Text>
        </View>
      </View>

      {isSignedIn && !isOwnProfile && (
        <FollowButton handle={profile.handle} />
      )}

      {isSignedIn && !isOwnProfile && profile.tippable && (
        <Button
          label="💸 Tip"
          variant="secondary"
          onPress={() => setTipVisible(true)}
        />
      )}

      {isSignedIn && !isOwnProfile && profile.tippable && (
        <Button
          label="🎁 Send a gift"
          variant="secondary"
          onPress={() => setGiftVisible(true)}
        />
      )}

      {isSignedIn && !isOwnProfile && (
        <Pressable onPress={handleBlock} disabled={blocking} style={styles.blockRow}>
          <Text variant="caption" color={theme.colors.text.muted}>
            {blocking ? 'Blocking…' : `Block @${handle}`}
          </Text>
        </Pressable>
      )}

      {!isOwnProfile && profile.subscriptionEnabled && profile.subscriptionPriceUsd && (
        subStatus?.subscribed ? (
          <View style={{ gap: theme.spacing.sm }}>
            {subStatus.pastDue && (
              <Button
                label="Payment failed · Update card"
                onPress={async () => {
                  try {
                    // Branded /billing page via the handoff token — update the card +
                    // retry the failed renewal with no web login.
                    const { webUrl } = await usersApi.createBillingSession()
                    await Linking.openURL(webUrl)
                    refetchSubStatus()
                  } catch {
                    Alert.alert('Error', 'Could not open billing')
                  }
                }}
              />
            )}
            <Button
              label={
                subStatus.pastDue
                  ? 'Manage subscription'
                  : `Subscribed · $${(profile.subscriptionPriceUsd / 100).toFixed(2)}/mo`
              }
              variant="secondary"
              onPress={() => {
                Alert.alert(
                  'Manage subscription',
                  'Your subscription is active.',
                  [
                    { text: 'Cancel subscription', style: 'destructive', onPress: async () => {
                      try {
                        await usersApi.cancelSubscription(profile.handle)
                        refetchSubStatus()
                      } catch {
                        Alert.alert('Error', 'Could not cancel subscription')
                      }
                    }},
                    { text: 'Dismiss', style: 'cancel' },
                  ],
                )
              }}
            />
          </View>
        ) : (
          <Button
            label={`Subscribe · $${(profile.subscriptionPriceUsd / 100).toFixed(2)}/mo`}
            onPress={async () => {
              try {
                // Open the branded wrld.cam/subscribe page (system browser). It pays via
                // the embedded Payment Element using the session token — no web login.
                // Fall back to the legacy Stripe-hosted-checkout redirect if an older
                // backend doesn't return webUrl yet.
                const { url, webUrl } = await usersApi.createSubscribeSession(profile.handle)
                await Linking.openURL(webUrl ?? url)
                // Refetch status when app regains focus after browser payment
                refetchSubStatus()
              } catch {
                Alert.alert('Error', 'Could not open subscription page')
              }
            }}
          />
        )
      )}

      {profile.giftsReceived && profile.giftsReceived.length > 0 && (
        <View style={styles.giftsCard}>
          <View style={styles.giftsHeader}>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              GIFTS RECEIVED
            </Text>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              {formatCount(profile.giftsReceivedTotal ?? 0)} 🚀
            </Text>
          </View>
          <View style={styles.giftsRow}>
            {profile.giftsReceived.map((g) => (
              <View key={g.giftType} style={styles.giftCell}>
                <Text variant="display">{g.emoji}</Text>
                <Text variant="bodyEmphasized">{formatCount(g.count)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {isOwnProfile && (
        <Button
          label="Edit Profile"
          onPress={() => router.push('/(app)/me')}
          variant="secondary"
        />
      )}

      {ppvEvents && ppvEvents.length > 0 && (
        <View style={styles.ppvSection}>
          <Text variant="monoLabel" color={theme.colors.text.muted}>
            UPCOMING EVENTS
          </Text>
          {ppvEvents.map(event => {
            const isLive = event.status === 'live'
            const countdown = !isLive ? formatCountdown(event.scheduledAt) : ''
            return (
              <Pressable
                key={event.id}
                style={styles.ppvCard}
                onPress={() => router.push({
                  pathname: '/(app)/ppv/[id]',
                  params: { id: event.id, handle: handle ?? '' },
                })}
              >
                {event.thumbnailUrl ? (
                  <Image source={{ uri: event.thumbnailUrl }} style={styles.ppvCover} resizeMode="cover" />
                ) : null}
                {/* Title row with status badge */}
                <View style={styles.ppvTitleRow}>
                  <Text variant="bodyEmphasized" style={styles.ppvTitle}>{event.title}</Text>
                  {isLive && (
                    <View style={styles.liveBadge}>
                      <Text variant="monoCaption" color={theme.colors.text.inverse}>LIVE</Text>
                    </View>
                  )}
                </View>

                {/* Description snippet */}
                {event.description ? (
                  <Text variant="caption" color={theme.colors.text.muted} numberOfLines={2}>
                    {event.description}
                  </Text>
                ) : null}

                {/* Date + countdown */}
                <View style={styles.ppvMeta}>
                  <Text variant="caption" color={theme.colors.text.muted}>
                    {formatEventDate(event.scheduledAt)}
                  </Text>
                  {countdown ? (
                    <Text variant="caption" color={theme.colors.accent.default}>
                      {countdown}
                    </Text>
                  ) : null}
                </View>

                {/* Details row: duration, subscriber access */}
                {(event.durationMinutes || event.subscribersFreeAccess) ? (
                  <View style={styles.ppvDetails}>
                    {event.durationMinutes ? (
                      <Text variant="caption" color={theme.colors.text.muted}>
                        ~{event.durationMinutes} min
                      </Text>
                    ) : null}
                    {event.subscribersFreeAccess ? (
                      <Text variant="caption" color={theme.colors.accent.default}>
                        Free for subscribers
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Price + access CTA */}
                <View style={styles.ppvFooter}>
                  <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                    {(event.priceSb ?? event.priceUsd ?? 0).toLocaleString()} 🚀
                  </Text>
                  {event.hasAccess ? (
                    <View style={styles.accessBadge}>
                      <Text variant="monoCaption" color={theme.colors.accent.default}>
                        ✓ Access purchased
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.buyBtn}>
                      <Text variant="monoCaption" color={theme.colors.text.inverse}>
                        {isLive ? 'WATCH NOW' : 'BUY TICKET'}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
      )}

      <ProfileTipSheet
        visible={tipVisible}
        handle={profile.handle}
        displayName={profile.displayName}
        onClose={() => setTipVisible(false)}
      />

      <ProfileGiftSheet
        visible={giftVisible}
        handle={profile.handle}
        displayName={profile.displayName}
        onClose={() => setGiftVisible(false)}
      />
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  loadingScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    alignItems: 'stretch',
    paddingBottom: theme.spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
  },
  notFound: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  identity: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  metaStrip: {
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border.subtle,
  },
  giftsCard: {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  giftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftCell: {
    alignItems: 'center',
    gap: 2,
  },
  ppvSection: {
    gap: theme.spacing.sm,
  },
  ppvCard: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  ppvCover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
  },
  ppvTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  ppvTitle: {
    flex: 1,
  },
  liveBadge: {
    backgroundColor: '#D0233A',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  ppvMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ppvDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  ppvFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  accessBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
  },
  buyBtn: {
    backgroundColor: theme.colors.accent.default,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
  },
  blockRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
})
