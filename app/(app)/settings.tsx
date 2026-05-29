import { View, Text, StyleSheet, Alert, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useClerk } from '@clerk/clerk-expo'
import { theme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { useState } from 'react'

export default function Settings() {
  const { signOut } = useClerk()
  const clearWrldUser = useAuthStore((s) => s.clearWrldUser)
  const wrldUser = useAuthStore((s) => s.wrldUser)
  const setWrldUser = useAuthStore((s) => s.setWrldUser)
  const qc = useQueryClient()

  const [followedLive, setFollowedLive] = useState(wrldUser?.notifyOnFollowedLive ?? true)
  const [nearbyLive, setNearbyLive] = useState(wrldUser?.notifyOnNearbyLive ?? false)

  async function handleSignOut() {
    try {
      await signOut()
    } catch {
      // Clerk may throw in RN environments (e.g. CustomEvent polyfill gap); proceed anyway.
    }
    clearWrldUser()
    qc.clear()
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ])
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button label="← Back" onPress={() => router.back()} variant="secondary" />
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Someone I follow goes live</Text>
            <Text style={styles.rowSub}>Get notified when a streamer you follow starts streaming</Text>
          </View>
          <Switch
            value={followedLive}
            onValueChange={toggleFollowedLive}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Live stream nearby</Text>
            <Text style={styles.rowSub}>Get notified when someone is streaming near your last location</Text>
          </View>
          <Switch
            value={nearbyLive}
            onValueChange={toggleNearbyLive}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          label="Sign out"
          onPress={confirmSignOut}
          variant="danger"
          style={styles.wide}
        />
        <Text style={styles.note}>
          To delete your account, contact us at support@wrld.cam. Your data will be removed within 30 days.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: { ...theme.typography.heading, color: theme.colors.text },
  section: {
    marginTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  rowText: { flex: 1 },
  rowLabel: { ...theme.typography.body, color: theme.colors.text, fontWeight: '500' },
  rowSub: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginLeft: theme.spacing.lg },
  bottom: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    alignItems: 'center',
    marginTop: 'auto',
  },
  wide: { width: '100%' },
  note: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
})
