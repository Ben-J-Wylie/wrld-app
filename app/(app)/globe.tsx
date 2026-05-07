import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useClerk, useAuth } from '@clerk/clerk-expo'
import { Button } from '@/components/ui/Button'
import { theme } from '@/lib/theme'
import { useAuthStore } from '@/stores/authStore'

export default function Globe() {
  const { signOut } = useClerk()
  const { isSignedIn } = useAuth()
  const wrldUser = useAuthStore((s) => s.wrldUser)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🌍 Globe</Text>
        <Text style={styles.subtitle}>Phase 5: 3D globe of live streams renders here</Text>
        {wrldUser && (
          <Text style={styles.user}>Signed in as {wrldUser.displayName}</Text>
        )}
        {isSignedIn ? (
          <Button label="Sign out" onPress={() => signOut()} variant="secondary" />
        ) : (
          <Button
            label="Sign in"
            onPress={() => { /* navigate to (auth)/login — Phase 6/7 modal flow */ }}
            variant="secondary"
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 48, color: theme.colors.text },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center' },
  user: { fontSize: 14, color: theme.colors.textMuted, marginVertical: 16 },
})
