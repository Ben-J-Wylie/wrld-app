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

import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, Image, Linking, Pressable, StyleSheet, View } from 'react-native'
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
import { useMutes } from '@/hooks/useMutes'
import { usersApi } from '@/api/users'
import { REPORT_REASONS } from '@/lib/reportReasons'
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

// Active broadcast time as "Xh Ym" (or "Ym" / "Ns" under an hour). Only shown
// for creators who've actually broadcast (gated on broadcastSeconds > 0).
function liveTimeLabel(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${sec}s`
}

export function ProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const { isSignedIn } = useAuth()
  const { data: profile, isLoading, error, refetch: refetchProfile } = useUserProfile(handle ?? null)
  const { data: me } = useCurrentUser()

  const isOwnProfile = !!me && me.handle === handle
  const [tipVisible, setTipVisible] = useState(false)
  const [giftVisible, setGiftVisible] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [unblocking, setUnblocking] = useState(false)

  // Blocked-by-me: the backend 404s a blocked pair's profile, so without this the
  // screen falls through to "User not found" with no way to unblock. Detect it from
  // my blocks list and show a clean Unblock state instead.
  const { data: myBlocks, refetch: refetchBlocks } = useQuery({
    queryKey: ['blocks'],
    queryFn: usersApi.getBlocks,
    enabled: !!isSignedIn && !isOwnProfile,
  })
  const isBlockedByMe = !!myBlocks?.some((b) => b.handle === handle)

  async function handleUnblock() {
    setUnblocking(true)
    try {
      await usersApi.unblock(handle)
      await refetchBlocks()
      refetchProfile()
    } catch {
      Alert.alert('Error', 'Could not unblock — try again.')
    } finally {
      setUnblocking(false)
    }
  }

  // Mute: soft, silent, one-directional — you stop seeing their chat + reactions,
  // they're unaffected and unaware. Toggles in place (no navigation away).
  const { isMuted, mute, unmute } = useMutes()
  const muted = isMuted(handle)
  function handleMuteToggle() {
    if (muted) unmute.mutate(handle)
    else mute.mutate(handle)
  }

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
              await refetchBlocks() // → isBlockedByMe flips → the Unblock state renders
            } catch {
              Alert.alert('Error', 'Could not block this user — try again.')
            } finally {
              setBlocking(false)
            }
          },
        },
      ],
    )
  }

  // Report: a preset-reason picker (REPORT_REASONS shared across surfaces), then
  // files a report that raises a moderation case. Distinct from Block (hides the
  // pair). Auth-gated by the caller.
  function handleReport() {
    Alert.alert(`Report @${handle}?`, 'Why are you reporting this account?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: async () => {
          try {
            await usersApi.report(handle!, reason)
            Alert.alert('Report submitted', 'Thanks — our team will review this account.')
          } catch {
            Alert.alert('Error', 'Could not submit the report — try again.')
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ])
  }

  const { data: subStatus, refetch: refetchSubStatus } = useQuery({
    queryKey: ['subscription-status', handle],
    queryFn: () => usersApi.getSubscriptionStatus(handle!),
    enabled: !!isSignedIn && !isOwnProfile && !!profile?.subscriptionEnabled,
  })

  // The subscribe button opens the web checkout in the system browser
  // (Linking.openURL resolves on launch, NOT on return), and the subscription
  // activates asynchronously server-side via the Stripe invoice.paid webhook.
  // So we refetch status when the app returns to the foreground. When the user
  // just launched checkout (justSubscribedRef), poll a few times to cover the
  // webhook lag; otherwise a single refetch is enough.
  const justSubscribedRef = useRef(false)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      if (!isSignedIn || isOwnProfile || !profile?.subscriptionEnabled) return
      let tries = 0
      const maxTries = justSubscribedRef.current ? 6 : 1
      const tick = async () => {
        tries++
        const res = await refetchSubStatus()
        if (res.data?.subscribed) {
          justSubscribedRef.current = false
          return
        }
        if (tries < maxTries) {
          setTimeout(tick, 1500)
        } else {
          justSubscribedRef.current = false
        }
      }
      tick()
    })
    return () => sub.remove()
  }, [isSignedIn, isOwnProfile, profile?.subscriptionEnabled, refetchSubStatus])

  const { data: ppvEvents } = useQuery({
    queryKey: ['ppv-events-profile', handle],
    queryFn: () => ppvApi.getCreatorEvents(handle!),
    enabled: !!handle,
  })

  // You've blocked this account — a coherent Unblock state (the profile itself 404s).
  if (isSignedIn && isBlockedByMe) {
    return (
      <ScreenScroll
        header={<ScreenHeader onBack={() => router.back()} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.blockedCard}>
          <Text variant="heading" color={theme.colors.text.primary}>
            You&apos;ve blocked @{handle}
          </Text>
          <Text variant="body" color={theme.colors.text.muted} style={styles.blockedBody}>
            They can&apos;t view your profile, find you in search, follow you, tip or gift you, or join your live streams.
          </Text>
          <Button
            label={unblocking ? 'Unblocking…' : `Unblock @${handle}`}
            onPress={handleUnblock}
            disabled={unblocking}
          />
        </View>
      </ScreenScroll>
    )
  }

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
        {profile.broadcastSeconds > 0 && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text variant="display">{liveTimeLabel(profile.broadcastSeconds)}</Text>
              <Text variant="monoLabel" color={theme.colors.text.subtle}>
                LIVE TIME
              </Text>
            </View>
          </>
        )}
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
        <View style={styles.modRow}>
          <Pressable onPress={handleReport} style={styles.blockRow}>
            <Text variant="caption" color={theme.colors.text.muted}>
              {`Report @${handle}`}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleMuteToggle}
            disabled={mute.isPending || unmute.isPending}
            style={styles.blockRow}
          >
            <Text variant="caption" color={theme.colors.text.muted}>
              {muted ? `Unmute @${handle}` : `Mute @${handle}`}
            </Text>
          </Pressable>
          <Pressable onPress={handleBlock} disabled={blocking} style={styles.blockRow}>
            <Text variant="caption" color={theme.colors.text.muted}>
              {blocking ? 'Blocking…' : `Block @${handle}`}
            </Text>
          </Pressable>
        </View>
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
                  : subStatus.cancelAtPeriodEnd
                    ? subStatus.currentPeriodEnd
                      ? `Access until ${new Date(subStatus.currentPeriodEnd).toLocaleDateString()} · won't renew`
                      : "Subscription won't renew"
                    : `Subscribed · $${(profile.subscriptionPriceUsd / 100).toFixed(2)}/mo`
              }
              variant="secondary"
              onPress={() => {
                if (subStatus.cancelAtPeriodEnd) {
                  // Cancelling but still within the paid period — offer to undo it.
                  Alert.alert(
                    'Resume subscription',
                    "Your subscription is set to cancel and won't renew. Resume it to keep your subscription active.",
                    [
                      { text: 'Resume subscription', onPress: async () => {
                        try {
                          await usersApi.resumeSubscription(profile.handle)
                          refetchSubStatus()
                        } catch {
                          Alert.alert('Error', 'Could not resume subscription')
                        }
                      }},
                      { text: 'Dismiss', style: 'cancel' },
                    ],
                  )
                  return
                }
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
                // Poll status hard when the app returns to the foreground (the
                // AppState listener above) — the payment + webhook activation happen
                // while we're backgrounded in the browser.
                justSubscribedRef.current = true
                await Linking.openURL(webUrl ?? url)
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
  blockedCard: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  blockedBody: {
    textAlign: 'center',
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
  modRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
})
