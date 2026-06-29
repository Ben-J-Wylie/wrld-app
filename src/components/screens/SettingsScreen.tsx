// src/components/screens/SettingsScreen.tsx
//
// 12.6 migration target: this screen now composes from the design
// system. ScreenScroll wraps; SettingsGroup hosts each section;
// SettingsRow renders every row including the notifications Toggles
// (the row's `right` slot carries the Toggle). Identity row carries
// an AccountIDPill in its `right` slot so the user's permanent ID
// surfaces alongside the changeable handle.

import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useClerk } from '@clerk/clerk-expo'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { SettingsGroup } from '@/components/sections/SettingsGroup'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { ProfileEditCard } from '@/components/screens/ProfileEditCard'
import { Button } from '@/components/primitives/Button'
import { Toggle } from '@/components/primitives/Toggle'
import { Text } from '@/components/primitives/Text'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { useAuthStore } from '@/stores/authStore'
import { usersApi } from '@/api/users'
import { clearCaptureConfig } from '@/lib/captureConfig'
import { theme } from '@/tokens/theme'
import * as Notifications from 'expo-notifications'

export function SettingsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { signOut } = useClerk()
  const clearWrldUser = useAuthStore((s) => s.clearWrldUser)
  const wrldUser = useAuthStore((s) => s.wrldUser)
  const setWrldUser = useAuthStore((s) => s.setWrldUser)
  const setDeletionPending = useAuthStore((s) => s.setDeletionPending)
  const qc = useQueryClient()

  const [followedLive, setFollowedLive] = useState(wrldUser?.notifyOnFollowedLive ?? true)
  const [nearbyLive, setNearbyLive] = useState(wrldUser?.notifyOnNearbyLive ?? false)
  const [subscribedLive, setSubscribedLive] = useState(wrldUser?.notifyOnSubscribedLive ?? true)
  const [tip, setTip] = useState(wrldUser?.notifyOnTip ?? true)
  const [gift, setGift] = useState(wrldUser?.notifyOnGift ?? true)
  const [ppvReminder, setPpvReminder] = useState(wrldUser?.notifyOnPpvReminder ?? true)
  const [follower, setFollower] = useState(wrldUser?.notifyOnFollower ?? true)
  const [subscriber, setSubscriber] = useState(wrldUser?.notifyOnSubscriber ?? true)

  const { data: blocks = [], refetch: refetchBlocks } = useQuery({
    queryKey: ['blocks'],
    queryFn: usersApi.getBlocks,
    staleTime: 30_000,
  })

  async function handleUnblock(handle: string) {
    try {
      await usersApi.unblock(handle)
      refetchBlocks()
    } catch {
      Alert.alert('Error', 'Could not unblock — try again.')
    }
  }

  const { data: mutes = [], refetch: refetchMutes } = useQuery({
    queryKey: ['mutes'],
    queryFn: usersApi.getMutes,
    staleTime: 30_000,
  })

  async function handleUnmute(handle: string) {
    try {
      await usersApi.unmute(handle)
      refetchMutes()
    } catch {
      Alert.alert('Error', 'Could not unmute — try again.')
    }
  }

  async function handleSignOut() {
    // Unregister push token before clearing session so the device stops
    // receiving notifications for this account immediately after sign-out.
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '35ab0828-46ac-477f-8ace-453105f6601e',
      })
      await usersApi.unregisterPushToken(tokenData.data)
    } catch {
      // Don't block sign-out if unregister fails (e.g. no notification permission)
    }
    clearWrldUser()
    qc.clear()
    // Device-local arming + title must not carry to the next account on this device.
    clearCaptureConfig().catch(() => {})
    router.navigate('/(app)/globe')
    try {
      await signOut()
    } catch {
      // Clerk may throw in RN environments (e.g. CustomEvent polyfill gap); proceed anyway.
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ])
  }

  async function handleDeleteAccount() {
    try {
      const { anonymizeAt } = await usersApi.deleteAccount()
      // The reactivation gate (rendered in the root layout) takes over from here.
      setDeletionPending(anonymizeAt)
    } catch {
      Alert.alert('Error', 'Could not delete your account — try again, or contact support@wrld.cam.')
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'Your account will be scheduled for deletion. You have 30 days to change your mind — sign back in and reactivate, and everything returns. After 30 days your profile, clips, and balances are permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: handleDeleteAccount },
      ],
    )
  }

  async function toggleFollowedLive(value: boolean) {
    setFollowedLive(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnFollowedLive: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setFollowedLive(!value)
    }
  }

  async function toggleNearbyLive(value: boolean) {
    setNearbyLive(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnNearbyLive: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setNearbyLive(!value)
    }
  }

  async function toggleSubscribedLive(value: boolean) {
    setSubscribedLive(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnSubscribedLive: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setSubscribedLive(!value)
    }
  }

  async function toggleTip(value: boolean) {
    setTip(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnTip: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setTip(!value)
    }
  }

  async function toggleGift(value: boolean) {
    setGift(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnGift: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setGift(!value)
    }
  }

  async function togglePpvReminder(value: boolean) {
    setPpvReminder(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnPpvReminder: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setPpvReminder(!value)
    }
  }

  async function toggleFollower(value: boolean) {
    setFollower(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnFollower: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setFollower(!value)
    }
  }

  async function toggleSubscriber(value: boolean) {
    setSubscriber(value)
    try {
      const prefs = await usersApi.updateNotificationPreferences({ notifyOnSubscriber: value })
      if (wrldUser) setWrldUser({ ...wrldUser, ...prefs })
    } catch {
      setSubscriber(!value)
    }
  }

  const tierLabel =
    wrldUser?.tier === 'plus' ? 'Plus' : wrldUser?.tier === 'pro' ? 'Pro' : 'Free'

  const body = (
    <>
      <View style={styles.profileSection}>
        <Text variant="monoLabel" color={theme.colors.text.subtle} style={styles.profileTitle}>
          PROFILE
        </Text>
        <ProfileEditCard />
      </View>

      <SettingsGroup title="ACCOUNT">
        <SettingsRow
          iconName="credit-card"
          title="Plan"
          value={`${tierLabel} · View all plans`}
          arrow
          showBorderTop={false}
          onPress={() => router.push('/(app)/subscription')}
        />
        {wrldUser?.creatorReady && (
          <SettingsRow
            iconName="dollar-sign"
            title="Monetize"
            value={wrldUser.subscriptionEnabled ? 'Subscriptions on' : 'Set up subscriptions'}
            arrow
            onPress={() => router.push('/(app)/monetize')}
          />
        )}
        {/* Analytics — shown to everyone (the screen gates: Pro → dashboard,
            non-Pro → upsell to /subscription). The upsell is a Pro marketing
            surface, so we don't hide the row from non-Pro users. */}
        <SettingsRow
          iconName="bar-chart-2"
          title="Analytics"
          value={
            wrldUser?.tier === 'pro'
              ? 'Audience, revenue & geography'
              : 'Pro · audience, revenue & geography'
          }
          arrow
          onPress={() => router.push('/(app)/analytics')}
        />
      </SettingsGroup>

      <SettingsGroup title="NOTIFICATIONS">
        <SettingsRow
          iconName="bell"
          title="Someone I follow goes live"
          value="Get notified when a streamer you follow starts streaming"
          right={
            <Toggle
              value={followedLive}
              onValueChange={toggleFollowedLive}
              accessibilityLabel="Notify when someone I follow goes live"
            />
          }
          showBorderTop={false}
        />
        <SettingsRow
          iconName="map-pin"
          title="Live stream nearby"
          value="Get notified when someone is streaming near your last location"
          right={
            <Toggle
              value={nearbyLive}
              onValueChange={toggleNearbyLive}
              accessibilityLabel="Notify when a live stream is nearby"
            />
          }
        />
        <SettingsRow
          iconName="heart"
          title="A creator I subscribe to goes live"
          value="Get notified when a creator you subscribe to starts streaming"
          right={
            <Toggle
              value={subscribedLive}
              onValueChange={toggleSubscribedLive}
              accessibilityLabel="Notify when a creator I subscribe to goes live"
            />
          }
        />
        <SettingsRow
          iconName="dollar-sign"
          title="Tips received"
          value="Get notified when another viewer tips you"
          right={
            <Toggle
              value={tip}
              onValueChange={toggleTip}
              accessibilityLabel="Notify when I receive a tip"
            />
          }
        />
        <SettingsRow
          iconName="gift"
          title="Gifts received"
          value="Get notified when someone sends you a gift from your profile or a clip"
          right={
            <Toggle
              value={gift}
              onValueChange={toggleGift}
              accessibilityLabel="Notify when I receive a gift"
            />
          }
        />
        <SettingsRow
          iconName="user-plus"
          title="New followers"
          value="Get notified when someone follows you"
          right={
            <Toggle
              value={follower}
              onValueChange={toggleFollower}
              accessibilityLabel="Notify when someone follows me"
            />
          }
        />
        <SettingsRow
          iconName="star"
          title="New subscribers"
          value="Get notified when someone subscribes to your channel"
          right={
            <Toggle
              value={subscriber}
              onValueChange={toggleSubscriber}
              accessibilityLabel="Notify when someone subscribes to my channel"
            />
          }
        />
        <SettingsRow
          iconName="calendar"
          title="PPV event reminders"
          value="Get notified when an event you bought a ticket to is about to start"
          right={
            <Toggle
              value={ppvReminder}
              onValueChange={togglePpvReminder}
              accessibilityLabel="Notify about PPV event reminders"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="PRIVACY · BLOCKED ACCOUNTS">
        {blocks.length === 0 ? (
          <SettingsRow
            iconName="slash"
            title="No blocked accounts"
            value="Block someone from their profile. Blocked accounts can't view you, find you in search, follow, tip/gift, or join your streams."
            showBorderTop={false}
          />
        ) : (
          blocks.map((u, i) => (
            <SettingsRow
              key={u.id}
              iconName="slash"
              title={u.displayName}
              value={`@${u.handle}`}
              showBorderTop={i !== 0}
              right={
                <Pressable onPress={() => handleUnblock(u.handle)} hitSlop={8}>
                  <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                    Unblock
                  </Text>
                </Pressable>
              }
            />
          ))
        )}
      </SettingsGroup>

      <SettingsGroup title="PRIVACY · MUTED ACCOUNTS">
        {mutes.length === 0 ? (
          <SettingsRow
            iconName="volume-x"
            title="No muted accounts"
            value="Mute someone from their profile or a chat message. You won't see muted accounts' chat or reactions — muting is silent and they can still follow, tip, and watch you."
            showBorderTop={false}
          />
        ) : (
          mutes.map((u, i) => (
            <SettingsRow
              key={u.id}
              iconName="volume-x"
              title={u.displayName}
              value={`@${u.handle}`}
              showBorderTop={i !== 0}
              right={
                <Pressable onPress={() => handleUnmute(u.handle)} hitSlop={8}>
                  <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                    Unmute
                  </Text>
                </Pressable>
              }
            />
          ))
        )}
      </SettingsGroup>

      <SettingsGroup title="CONTENT">
        <SettingsRow
          iconName="calendar"
          title="Events"
          value="Schedule & manage pay-per-view events"
          arrow
          showBorderTop={false}
          onPress={() => router.push('/(app)/ppv')}
        />
      </SettingsGroup>

      <SettingsGroup title="LEGAL">
        <SettingsRow
          iconName="file-text"
          title="Terms of Service"
          value="How WRLD works and the rules of use"
          arrow
          showBorderTop={false}
          onPress={() => router.push('/(app)/legal/terms')}
        />
        <SettingsRow
          iconName="file-text"
          title="Privacy Policy"
          value="What we collect and how we use it"
          arrow
          onPress={() => router.push('/(app)/legal/privacy')}
        />
        <SettingsRow
          iconName="file-text"
          title="Community Rules"
          value="Keeping WRLD safe for everyone"
          arrow
          onPress={() => router.push('/(app)/legal/community')}
        />
        <SettingsRow
          iconName="file-text"
          title="Creator Guidelines"
          value="Broadcasting, clips & earning"
          arrow
          onPress={() => router.push('/(app)/legal/creator')}
        />
      </SettingsGroup>

      {__DEV__ && (
        <SettingsGroup title="DEVELOPMENT">
          <SettingsRow
            iconName="layers"
            title="Primitive gallery"
            value="20 primitives — Text, Icon, Pressable, Button, Card, Input, …"
            arrow
            showBorderTop={false}
            onPress={() => router.push('/(app)/primitive-gallery')}
          />
          <SettingsRow
            iconName="grid"
            title="Feature gallery"
            value="Domain features composed from primitives"
            arrow
            onPress={() => router.push('/(app)/feature-gallery')}
          />
          <SettingsRow
            iconName="layout"
            title="Section gallery"
            value="Screen-region patterns (ScreenScroll, TrendingRail, …)"
            arrow
            onPress={() => router.push('/(app)/section-gallery')}
          />
        </SettingsGroup>
      )}

      <View style={styles.bottom}>
        <Button label="Sign out" onPress={confirmSignOut} variant="primary" />
        <Pressable onPress={confirmDeleteAccount} style={styles.deleteBtn} hitSlop={8}>
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            Delete account
          </Text>
        </Pressable>
        <Text variant="caption" color={theme.colors.text.muted} style={styles.note}>
          Scheduling deletion gives you a 30-day grace period to reactivate before your
          data is permanently removed.
        </Text>
      </View>
    </>
  )

  // Embedded as the Settings tab of the Me page: the host owns the safe-area
  // frame + header, so render a plain scroll. Standalone (the /settings route):
  // bring our own ScreenScroll + header.
  if (embedded) {
    return (
      <ScrollView
        style={styles.embeddedRoot}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>
    )
  }

  return (
    <ScreenScroll
      header={<ScreenHeader title="Settings" onBack={() => router.back()} />}
      contentContainerStyle={styles.scroll}
    >
      {body}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  embeddedRoot: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  profileSection: {
    gap: theme.spacing.sm,
  },
  profileTitle: {
    paddingHorizontal: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  bottom: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  note: {
    textAlign: 'center',
    lineHeight: 18,
  },
})
