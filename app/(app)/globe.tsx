import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '@/lib/theme'

export default function Globe() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🌍 Globe</Text>
        <Text style={styles.subtitle}>Phase 5: 3D globe of live streams renders here</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 48, color: theme.colors.text },
  subtitle: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center' },
})
