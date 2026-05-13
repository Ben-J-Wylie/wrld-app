import { View, Text, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useClerk } from '@clerk/clerk-expo'
import { theme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useQueryClient } from '@tanstack/react-query'

export default function Settings() {
  const { signOut } = useClerk()
  const clearWrldUser = useAuthStore((s) => s.clearWrldUser)
  const qc = useQueryClient()

  async function handleSignOut() {
    await signOut()
    clearWrldUser()
    qc.clear()
    router.replace('/(app)/globe')
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button label="← Back" onPress={() => router.back()} variant="secondary" />
        <Text style={styles.title}>Settings</Text>
      </View>
      <View style={styles.content}>
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
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  wide: { width: '100%' },
  note: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
})
