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

import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { IconButton } from '@/components/primitives/IconButton'
import { Avatar } from '@/components/primitives/Avatar'
import { Text } from '@/components/primitives/Text'
import { FollowButton } from '@/components/features/user/FollowButton'
import { MetaStrip } from '@/components/features/user/MetaStrip'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'
import { useQuery } from '@tanstack/react-query'

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

  const { data: subStatus, refetch: refetchSubStatus } = useQuery({
    queryKey: ['subscription-status', handle],
    queryFn: () => usersApi.getSubscriptionStatus(handle!),
    enabled: !!isSignedIn && !isOwnProfile && !!profile?.subscriptionEnabled,
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
      <ScreenScroll contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <IconButton
            name="arrow-left"
            variant="ghost"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
        </View>
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
    <ScreenScroll contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <IconButton
          name="arrow-left"
          variant="ghost"
          onPress={() => router.back()}
          accessibilityLabel="Back"
        />
      </View>

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

      {!isOwnProfile && profile.subscriptionEnabled && profile.subscriptionPriceUsd && (
        subStatus?.subscribed ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={`Subscribed · $${(profile.subscriptionPriceUsd / 100).toFixed(2)}/mo`}
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
                const { url } = await usersApi.createSubscribeSession(profile.handle)
                await Linking.openURL(url)
                // Refetch status when app regains focus after browser payment
                refetchSubStatus()
              } catch {
                Alert.alert('Error', 'Could not open subscription page')
              }
            }}
          />
        )
      )}

      {isOwnProfile && (
        <Button
          label="Edit Profile"
          onPress={() => router.push('/(app)/me')}
          variant="secondary"
        />
      )}
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
})
