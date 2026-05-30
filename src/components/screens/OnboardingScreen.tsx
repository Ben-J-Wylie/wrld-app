import { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { theme } from '@/tokens/theme'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Avatar } from '@/components/primitives/Avatar'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'
import { useSetCurrentUser } from '@/hooks/useCurrentUser'

type Step = 'handle' | 'avatar' | 'choice'

export function OnboardingScreen() {
  const wrldUser = useAuthStore((s) => s.wrldUser)
  const setWrldUser = useAuthStore((s) => s.setWrldUser)
  const setCurrentUser = useSetCurrentUser()

  const [step, setStep] = useState<Step>('handle')
  const [handle, setHandle] = useState('')
  const [handleError, setHandleError] = useState('')
  const [handleLoading, setHandleLoading] = useState(false)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [avatarMime, setAvatarMime] = useState<string>('image/jpeg')
  const [avatarLoading, setAvatarLoading] = useState(false)

  async function submitHandle() {
    const trimmed = handle.trim().toLowerCase()
    if (!trimmed) {
      setHandleError('Handle is required')
      return
    }
    setHandleError('')
    setHandleLoading(true)
    try {
      const updated = await usersApi.updateProfile({ handle: trimmed })
      setWrldUser(updated)
      setCurrentUser(updated)
      setStep('avatar')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null
      setHandleError(msg ?? 'Handle unavailable — try another')
    } finally {
      setHandleLoading(false)
    }
  }

  async function pickAvatar(source: 'gallery' | 'camera') {
    let result
    if (source === 'gallery') {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
    } else {
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
    }
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setAvatarUri(asset.uri)
      setAvatarMime(asset.mimeType ?? 'image/jpeg')
    }
  }

  async function finishAvatar() {
    if (avatarUri) {
      setAvatarLoading(true)
      try {
        const updated = await usersApi.uploadAvatar(avatarUri, avatarMime)
        setWrldUser(updated)
        setCurrentUser(updated)
      } catch {
        // non-fatal
      } finally {
        setAvatarLoading(false)
      }
    }
    setStep('choice')
  }

  const displayForAvatar = wrldUser?.displayName ?? 'You'

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'handle' && (
            <>
              <Text style={styles.title}>Choose your handle</Text>
              <Text style={styles.subtitle}>
                This is how others find and mention you. You can change it once every 30 days.
              </Text>
              <View style={styles.inputRow}>
                <Text style={styles.at}>@</Text>
                <Input
                  placeholder="yourhandle"
                  value={handle}
                  onChangeText={(t) => {
                    setHandle(t.toLowerCase())
                    setHandleError('')
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  style={styles.handleInput}
                />
              </View>
              {!!handleError && <Text style={styles.error}>{handleError}</Text>}
              <Text style={styles.hint}>
                3–20 characters. Letters, numbers, and underscores only.
              </Text>
              <Button
                label="Continue"
                onPress={submitHandle}
                loading={handleLoading}
                disabled={!handle.trim()}
                style={styles.wide}
              />
            </>
          )}

          {step === 'choice' && (
            <>
              <Text style={styles.title}>What brings you to Wrld?</Text>
              <Text style={styles.subtitle}>
                You can always change this later.
              </Text>
              <Button
                label="Watch live streams"
                onPress={() => router.replace('/(app)/globe')}
                style={styles.wide}
              />
              <Button
                label="Go live as a creator"
                onPress={() => router.replace('/(app)/creator-onboarding')}
                variant="secondary"
                style={styles.wide}
              />
            </>
          )}

          {step === 'avatar' && (
            <>
              <Text style={styles.title}>Add a photo</Text>
              <Text style={styles.subtitle}>
                Put a face to the handle. You can always update this later.
              </Text>
              <View style={styles.avatarPreview}>
                <Avatar
                  avatarUrl={avatarUri}
                  displayName={displayForAvatar}
                  size={96}
                />
              </View>
              <Button
                label="Choose from gallery"
                onPress={() => pickAvatar('gallery')}
                variant="secondary"
                style={styles.wide}
              />
              <Button
                label="Take a photo"
                onPress={() => pickAvatar('camera')}
                variant="secondary"
                style={styles.wide}
              />
              <Button
                label={avatarUri ? 'Done' : 'Skip for now'}
                onPress={finishAvatar}
                loading={avatarLoading}
                style={styles.wide}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  flex: { flex: 1 },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    alignItems: 'center',
    paddingTop: theme.spacing.xxl,
  },
  title: { ...theme.typography.display, color: theme.colors.text.primary, textAlign: 'center' },
  subtitle: { ...theme.typography.body, color: theme.colors.text.muted, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: theme.spacing.xs,
  },
  at: { ...theme.typography.heading, color: theme.colors.text.muted },
  handleInput: { flex: 1 },
  error: { ...theme.typography.body, color: theme.colors.accent.default, textAlign: 'center' },
  hint: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
  avatarPreview: { marginVertical: theme.spacing.md },
  wide: { width: '100%' },
})
