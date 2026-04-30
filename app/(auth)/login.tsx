import { View, Text, StyleSheet } from 'react-native'
import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { theme } from '@/lib/theme'
import { useAuthStore } from '@/stores/authStore'
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const setUser = useAuthStore((s) => s.setUser)

  const handleLogin = async () => {
    // PHASE 3: Replace with real Cognito auth
    // For now, this is a stub so navigation works
    setUser({ id: 'stub', email, displayName: email.split('@')[0] ?? 'user' })
    router.replace('/(app)/globe')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>WRLD</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button label="Sign in" onPress={handleLogin} />

        <Link href="/(auth)/signup" style={styles.link}>
          Don&apos;t have an account? Sign up
        </Link>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 48, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  link: { color: theme.colors.accent, textAlign: 'center', marginTop: 16 },
})
