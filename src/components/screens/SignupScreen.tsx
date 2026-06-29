// src/components/screens/SignupScreen.tsx
//
// 12.6 migration target. Two-step flow (create account → verify
// email) running through design-system primitives. Adds a live
// PasswordStrengthMeter under the password field — small UX value-add
// unlocked by the design-system feature being available.
//
// AuthChoiceList is intentionally not wired in here yet — social auth
// backends aren't wired (see DESIGN.md note on AuthChoiceList). It can
// land as a follow-up once Apple / Google providers are configured.

import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet } from 'react-native'
import { Link, router } from 'expo-router'
import { useSignUp, useAuth } from '@clerk/clerk-expo'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { BrandMark } from '@/components/primitives/BrandMark'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { PasswordStrengthMeter } from '@/components/features/auth/PasswordStrengthMeter'
import { theme } from '@/tokens/theme'
import { clerkError } from '@/lib/clerkError'
import { scorePassword, passwordMeetsMinimum } from '@/lib/passwordStrength'

export function SignupScreen() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const { isSignedIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isSignedIn) router.replace('/(app)/globe')
  }, [isSignedIn])

  const handleSignup = async () => {
    if (!isLoaded) return
    if (!passwordMeetsMinimum(password)) return
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

  const handleResend = async () => {
    if (!isLoaded) return
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      Alert.alert('Code sent', `We sent a new code to ${email}.`)
    } catch (err) {
      Alert.alert('Could not resend', clerkError(err, 'Please try again in a moment'))
    }
  }

  if (pendingVerification) {
    return (
      <ScreenScroll contentContainerStyle={styles.content}>
        <BrandMark size={64} />
        <Text variant="display" style={styles.center}>
          Check your email
        </Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
          Enter the code we sent to {email}
        </Text>
        <Input
          placeholder="Verification code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
        />
        <Button label="Verify email" onPress={handleVerify} loading={loading} />
        <Pressable accessibilityRole="link" accessibilityLabel="Resend code" onPress={handleResend}>
          <Text variant="caption" color={theme.colors.accent.default} style={styles.link}>
            Didn&apos;t get a code? Send a new one
          </Text>
        </Pressable>
      </ScreenScroll>
    )
  }

  const score = scorePassword(password)
  const passwordOk = passwordMeetsMinimum(password)
  // Precise reason so an 8+ char password never reads "too short" — score 1 means
  // either too short OR too few character types, and we know which here.
  const passwordHelper =
    password.length === 0
      ? undefined
      : password.length < 8
        ? 'TOO SHORT — 8 CHARACTERS MINIMUM'
        : score === 1
          ? 'ADD A NUMBER, SYMBOL, OR CAPITAL'
          : undefined

  return (
    <ScreenScroll contentContainerStyle={styles.content}>
      <BrandMark size={64} />
      <Text variant="display" style={styles.center}>
        Create account
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
      {password.length > 0 && <PasswordStrengthMeter score={score} helper={passwordHelper} />}
      <Button label="Sign up" onPress={handleSignup} loading={loading} disabled={!passwordOk} />
      <Link href="/(auth)/login" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Sign in">
          <Text variant="caption" color={theme.colors.accent.default} style={styles.link}>
            Already have an account? Sign in
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
