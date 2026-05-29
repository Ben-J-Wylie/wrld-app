import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { Link, router } from 'expo-router'
import { useSignIn, useAuth } from '@clerk/clerk-expo'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { theme } from '@/tokens/theme'
import { clerkError } from '@/lib/clerkError'

export function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isSignedIn) router.replace('/(app)/globe')
  }, [isSignedIn])

  const handleLogin = async () => {
    if (!isLoaded) return
    setLoading(true)
    try {
      await signIn.create({ identifier: email })
      const result = await signIn.attemptFirstFactor({ strategy: 'password', password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.replace('/(app)/globe')
      } else if (result.status === 'needs_second_factor') {
        Alert.alert('MFA required', 'This account has multi-factor authentication enabled. Disable it in your account settings and try again.')
      } else {
        Alert.alert('Sign in failed', 'Please check your email and password and try again.')
      }
    } catch (err) {
      Alert.alert('Sign in failed', clerkError(err, 'Please check your email and password'))
    } finally {
      setLoading(false)
    }
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
        <Button label={loading ? 'Signing in...' : 'Sign in'} onPress={handleLogin} />
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
