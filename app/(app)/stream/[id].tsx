import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { theme } from '@/lib/theme'

export default function StreamView() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Stream</Text>
        <Text style={styles.id}>ID: {id}</Text>
        <Text style={styles.subtitle}>
          Phase 7: Mediasoup viewer/creator view renders here
        </Text>
        <Button label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.text },
  id: { fontSize: 14, color: theme.colors.textMuted, fontFamily: 'monospace' },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center' },
})
