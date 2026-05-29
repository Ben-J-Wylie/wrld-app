import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Alert } from 'react-native'
import { Link, router } from 'expo-router'
import { useSignUp, useAuth } from '@clerk/clerk-expo'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { theme } from '@/tokens/theme'
import { clerkError } from '@/lib/clerkError'

export function SignupScreen() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const { isSignedIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isSignedIn) router.replace('/(app)/globe')
  }, [isSignedIn])

  const handleSignup = async () => {
    if (!isLoaded) return
    setLoading(true)
    try {
      await signUp.create({ emailAddress: email, password })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
    } catch (err) {
      Alert.alert('Sign up failed', clerkError(err, 'Could not create account'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!isLoaded) return
    setLoading(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({ code })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.replace('/(app)/globe')
      } else {
        Alert.alert('Verification incomplete', `Status: ${result.status}. Please try again.`)
      }
    } catch (err) {
      Alert.alert('Verification failed', clerkError(err, 'Invalid or expired code'))
    } finally {
      setLoading(false)
    }
  }

  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>Enter the code we sent to {email}</Text>
          <Input
            placeholder="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
          />
          <Button
            label={loading ? 'Verifying...' : 'Verify email'}
            onPress={handleVerify}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>
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
        <Button label={loading ? 'Creating account...' : 'Sign up'} onPress={handleSignup} />
        <Link href="/(auth)/login" style={styles.link}>
          Already have an account? Sign in
        </Link>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  link: { color: theme.colors.accent, textAlign: 'center', marginTop: 16 },
})
