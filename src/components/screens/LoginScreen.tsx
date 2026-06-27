// src/components/screens/LoginScreen.tsx
//
// 12.6 migration target. Token-shape + primitive-composition pass —
// replaces bespoke font sizes and link styling with Text variants,
// BrandMark, and a Pressable + Text "navigation link" for the
// "Don't have an account?" hand-off to Signup.
//
// AuthChoiceList is intentionally not wired in here yet — social auth
// backends aren't wired (see DESIGN.md note on AuthChoiceList). It can
// land as a follow-up once Apple / Google providers are configured;
// the migration only needs the existing email + password flow to work
// through design-system primitives.

import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet } from 'react-native'
import { Link, router } from 'expo-router'
import { useSignIn, useAuth } from '@clerk/clerk-expo'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { BrandMark } from '@/components/primitives/BrandMark'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { theme } from '@/tokens/theme'
import { clerkError } from '@/lib/clerkError'

export function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        Alert.alert(
          'MFA required',
          'This account has multi-factor authentication enabled. Disable it in your account settings and try again.',
        )
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
    <ScreenScroll contentContainerStyle={styles.content}>
      <BrandMark size={64} />
      <Text variant="display" style={styles.center}>
        Welcome back
      </Text>
      <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
        Sign in to continue
      </Text>
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
        secureTextEntry={!showPassword}
        rightAffordance={
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size="md" color={theme.colors.text.muted} />
          </Pressable>
        }
      />
      <Button label="Sign in" onPress={handleLogin} loading={loading} />
      <Link href="/(auth)/signup" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Sign up">
          <Text variant="caption" color={theme.colors.accent.default} style={styles.link}>
            Don&apos;t have an account? Sign up
          </Text>
        </Pressable>
      </Link>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  center: {
    textAlign: 'center',
  },
  link: {
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
})
