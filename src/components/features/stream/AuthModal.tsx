import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { useSignIn, useSignUp } from '@clerk/clerk-expo'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { theme } from '@/tokens/theme'
import { clerkError } from '@/lib/clerkError'

type Tab = 'signin' | 'signup'
type SignUpStep = 'form' | 'verify'

type Props = {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AuthModal({ visible, onClose, onSuccess }: Props) {
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {tab === 'signin' ? (
            <>
              <Text style={styles.heading}>Sign in to join the chat</Text>
              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button label="Sign in" onPress={handleSignIn} loading={loading} style={styles.btn} />
              <Pressable onPress={() => switchTab('signup')} style={styles.switchRow}>
                <Text style={styles.switchText}>No account? <Text style={styles.switchLink}>Sign up</Text></Text>
              </Pressable>
            </>
          ) : signUpStep === 'form' ? (
            <>
              <Text style={styles.heading}>Create an account</Text>
              <Input
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button label="Sign up" onPress={handleSignUp} loading={loading} style={styles.btn} />
              <Pressable onPress={() => switchTab('signin')} style={styles.switchRow}>
                <Text style={styles.switchText}>Have an account? <Text style={styles.switchLink}>Sign in</Text></Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.sub}>We sent a code to {email}</Text>
              <Input
                placeholder="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button label="Verify" onPress={handleVerify} loading={loading} style={styles.btn} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  heading: {
    ...theme.typography.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  sub: {
    ...theme.typography.body,
    color: theme.colors.text.muted,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.bg.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    color: theme.colors.text.primary,
    fontSize: 16,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.accent.default,
    textAlign: 'center',
  },
  btn: { width: '100%' },
  switchRow: { alignItems: 'center', paddingVertical: theme.spacing.xs },
  switchText: { ...theme.typography.body, color: theme.colors.text.muted },
  switchLink: { color: theme.colors.accent.default, fontWeight: '600' },
})
