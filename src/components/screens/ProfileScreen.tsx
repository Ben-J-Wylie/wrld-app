import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { Button } from '@/components/primitives/Button'
import { Avatar } from '@/components/primitives/Avatar'
import { FollowButton } from '@/components/features/user/FollowButton'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export function ProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const { isSignedIn } = useAuth()
  const { data: profile, isLoading, error } = useUserProfile(handle ?? null)
  const { data: me } = useCurrentUser()

  const isOwnProfile = !!me && me.handle === handle

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backRow}>
          <Button label="← Back" onPress={() => router.back()} variant="secondary" />
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>User not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backRow}>
        <Button label="← Back" onPress={() => router.back()} variant="secondary" />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} size={88} />
        <Text style={styles.displayName}>{profile.displayName}</Text>
        <Text style={styles.handle}>@{profile.handle}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {isSignedIn && !isOwnProfile && (
          <View style={styles.actions}>
            <FollowButton handle={profile.handle} />
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.actions}>
            <Button
              label="Edit Profile"
              onPress={() => router.push('/(app)/me')}
              variant="secondary"
              style={styles.wide}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  content: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  displayName: { ...theme.typography.heading, color: theme.colors.text.primary, fontWeight: '700' },
  handle: { ...theme.typography.body, color: theme.colors.text.muted },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  stat: { alignItems: 'center', gap: 2 },
  statNum: { ...theme.typography.heading, color: theme.colors.text.primary, fontWeight: '700' },
  statLabel: { ...theme.typography.caption, color: theme.colors.text.muted },
  statDivider: { width: 1, height: 32, backgroundColor: theme.colors.border.subtle },
  actions: { width: '100%', gap: theme.spacing.sm },
  muted: { ...theme.typography.body, color: theme.colors.text.muted },
  wide: { width: '100%' },
})
