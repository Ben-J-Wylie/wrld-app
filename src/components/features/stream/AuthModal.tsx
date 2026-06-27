// src/components/features/stream/AuthModal.tsx
//
// 12.6 token cleanup pass. The bespoke Modal + KeyboardAvoidingView
// scaffold stays (they work + handle keyboard avoidance correctly);
// the inner rendering swaps to design-system primitives. This
// component is on the retirement runway anyway — when AuthChoiceList
// + the social auth backend land, the whole modal gets rewritten as
// a BottomSheet wrapping AuthChoiceList. Until then, token-clean it.

import { useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
// The sheet pads itself by the live keyboard height (the app's proven manual
// listener — react-native-keyboard-controller's KeyboardAvoidingView can't see the
// keyboard inside a Modal on Android, so iOS lifted but Android stayed covered).
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight'
import { useSignIn, useSignUp } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Pressable } from '@/components/primitives/Pressable'
import { clerkError } from '@/lib/clerkError'

type Tab = 'signin' | 'signup'
type SignUpStep = 'form' | 'verify'

type Props = {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AuthModal({ visible, onClose, onSuccess }: Props) {
  const insets = useSafeAreaInsets()
  // Keyboard height is measured from the real screen bottom; the sheet sits inside
  // the inset bottom, so lift it by (keyboard − inset) to hug the keyboard top.
  const keyboardHeight = useKeyboardHeight()
  const liftBottom = keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom) : 0
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [signUpStep, setSignUpStep] = useState<SignUpStep>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp()

  function reset() {
    setEmail('')
    setPassword('')
    setCode('')
    setSignUpStep('form')
    setError(null)
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function switchTab(t: Tab) {
    reset()
    setTab(t)
  }

  async function handleSignIn() {
    if (!signInLoaded) return
    setLoading(true)
    setError(null)
    try {
      const result = await signIn!.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActiveSignIn!({ session: result.createdSessionId })
        reset()
        onSuccess()
      } else {
        setError('Sign in could not be completed.')
      }
    } catch (err) {
      setError(clerkError(err, 'Sign in failed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp() {
    if (!signUpLoaded) return
    setLoading(true)
    setError(null)
    try {
      await signUp!.create({ emailAddress: email, password })
      await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' })
      setSignUpStep('verify')
    } catch (err) {
      setError(clerkError(err, 'Sign up failed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (!signUpLoaded) return
    setLoading(true)
    setError(null)
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code })
      if (result.status === 'complete') {
        await setActiveSignUp!({ session: result.createdSessionId })
        reset()
        onSuccess()
      } else {
        setError('Verification could not be completed.')
      }
    } catch (err) {
      setError(clerkError(err, 'Verification failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable variant="none" style={styles.backdrop} onPress={handleClose} />
      <View style={[styles.sheetWrapper, { paddingBottom: liftBottom }]}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {tab === 'signin' ? (
            <>
              <Text variant="heading" style={styles.center}>
                Sign in to join the chat
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
                secureTextEntry
              />
              {error && <HelpText tone="err">{error}</HelpText>}
              <Button label="Sign in" onPress={handleSignIn} loading={loading} />
              <Pressable
                variant="default"
                onPress={() => switchTab('signup')}
                accessibilityRole="link"
                accessibilityLabel="Sign up"
                style={styles.switchRow}
              >
                <Text variant="body" color={theme.colors.text.muted}>
                  No account?{' '}
                  <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                    Sign up
                  </Text>
                </Text>
              </Pressable>
            </>
          ) : signUpStep === 'form' ? (
            <>
              <Text variant="heading" style={styles.center}>
                Create an account
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
                secureTextEntry
              />
              {error && <HelpText tone="err">{error}</HelpText>}
              <Button label="Sign up" onPress={handleSignUp} loading={loading} />
              <Pressable
                variant="default"
                onPress={() => switchTab('signin')}
                accessibilityRole="link"
                accessibilityLabel="Sign in"
                style={styles.switchRow}
              >
                <Text variant="body" color={theme.colors.text.muted}>
                  Have an account?{' '}
                  <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
                    Sign in
                  </Text>
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text variant="heading" style={styles.center}>
                Check your email
              </Text>
              <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
                We sent a code to {email}
              </Text>
              <Input
                placeholder="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />
              {error && <HelpText tone="err">{error}</HelpText>}
              <Button label="Verify" onPress={handleVerify} loading={loading} />
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.overlay,
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.bg.elevated,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border.subtle,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
})
