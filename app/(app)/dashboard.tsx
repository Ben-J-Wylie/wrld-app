import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '@/lib/theme'

export default function Dashboard() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>
          Phase 6: Stream layer arming controls render here
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center' },
})
