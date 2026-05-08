import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useState } from 'react'
import { theme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'

export default function Dashboard() {
  const [roomId, setRoomId] = useState('')
  const wrldUser = useAuthStore((s) => s.wrldUser)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Phase 6: Stream layer arming controls render here</Text>

        <View style={styles.divider} />
        <Text style={styles.label}>Phase 3b test</Text>

        {wrldUser ? (
          <Button
            label="Go Live"
            onPress={() => router.push('/(app)/stream/new')}
            style={styles.wide}
          />
        ) : (
          <Text style={styles.muted}>Sign in to go live</Text>
        )}

        <Input
          placeholder="Paste room ID to watch"
          value={roomId}
          onChangeText={setRoomId}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.wide}
        />
        <Button
          label="Join Stream"
          onPress={() => router.push(`/(app)/stream/${roomId}`)}
          disabled={!roomId.trim()}
          variant="secondary"
          style={styles.wide}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  label: { ...theme.typography.caption, color: theme.colors.textMuted },
  muted: { ...theme.typography.body, color: theme.colors.textMuted },
  divider: { width: '100%', height: 1, backgroundColor: theme.colors.border },
  wide: { width: '100%' },
})
