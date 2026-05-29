import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { theme } from '@/tokens/theme'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Avatar } from '@/components/features/user/Avatar'
import { usersApi } from '@/api/users'
import { useCurrentUser, useSetCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'

export function MeScreen() {
  const { isSignedIn } = useAuth()
  const { data: user, isLoading } = useCurrentUser()
  const setCurrentUser = useSetCurrentUser()
  const setWrldUser = useAuthStore((s) => s.setWrldUser)

  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')

  const [editingHandle, setEditingHandle] = useState(false)
  const [handle, setHandle] = useState('')
  const [handleLoading, setHandleLoading] = useState(false)
  const [handleError, setHandleError] = useState('')

  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  function startEditName() {
    setDisplayName(user?.displayName ?? '')
    setNameError('')
    setEditingName(true)
  }

  async function saveName() {
    if (!displayName.trim()) return
    setNameLoading(true)
    setNameError('')
    try {
      const updated = await usersApi.updateProfile({ displayName: displayName.trim() })
      setCurrentUser(updated)
      setWrldUser(updated)
      setEditingName(false)
    } catch {
      setNameError('Failed to update name')
    } finally {
      setNameLoading(false)
    }
  }

  function startEditHandle() {
    setHandle(user?.handle ?? '')
    setHandleError('')
    setEditingHandle(true)
  }

  async function saveHandle() {
    const trimmed = handle.trim().toLowerCase()
    if (!trimmed) return
    setHandleLoading(true)
    setHandleError('')
    try {
      const updated = await usersApi.updateProfile({ handle: trimmed })
      setCurrentUser(updated)
      setWrldUser(updated)
      setEditingHandle(false)
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

  async function changeAvatar(source: 'gallery' | 'camera') {
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
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setAvatarLoading(true)
    setAvatarError('')
    try {
      const updated = await usersApi.uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg')
      setCurrentUser(updated)
      setWrldUser(updated)
    } catch {
      setAvatarError('Upload failed — try again')
    } finally {
      setAvatarLoading(false)
    }
  }

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.muted}>Sign in to access your profile</Text>
          <Button
            label="Sign in"
            onPress={() => router.push('/(auth)/login')}
            style={styles.btn}
          />
        </View>
      </SafeAreaView>
    )
  }

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent.default} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            {avatarLoading ? (
              <ActivityIndicator color={theme.colors.accent.default} size="large" />
            ) : (
              <Avatar avatarUrl={user.avatarUrl} displayName={user.displayName} size={88} />
            )}
            <View style={styles.avatarBtns}>
              <Button
                label="Gallery"
                onPress={() => changeAvatar('gallery')}
                variant="secondary"
                disabled={avatarLoading}
              />
              <Button
                label="Camera"
                onPress={() => changeAvatar('camera')}
                variant="secondary"
                disabled={avatarLoading}
              />
            </View>
            {!!avatarError && <Text style={styles.error}>{avatarError}</Text>}
          </View>

          {/* Display name */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
            {editingName ? (
              <>
                <Input
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoFocus
                  style={styles.fieldInput}
                />
                {!!nameError && <Text style={styles.error}>{nameError}</Text>}
                <View style={styles.fieldBtns}>
                  <Button label="Save" onPress={saveName} loading={nameLoading} />
                  <Button label="Cancel" onPress={() => setEditingName(false)} variant="secondary" />
                </View>
              </>
            ) : (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldValue}>{user.displayName}</Text>
                <Button label="Edit" onPress={startEditName} variant="secondary" />
              </View>
            )}
          </View>

          {/* Handle */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>HANDLE</Text>
            {editingHandle ? (
              <>
                <View style={styles.handleInputRow}>
                  <Text style={styles.at}>@</Text>
                  <Input
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
                <View style={styles.fieldBtns}>
                  <Button label="Save" onPress={saveHandle} loading={handleLoading} />
                  <Button label="Cancel" onPress={() => setEditingHandle(false)} variant="secondary" />
                </View>
              </>
            ) : (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldValue}>@{user.handle}</Text>
                <Button label="Edit" onPress={startEditHandle} variant="secondary" />
              </View>
            )}
            <Text style={styles.hint}>Handle can be changed once every 30 days.</Text>
          </View>

          {/* Space Bucks balance */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SPACE BUCKS</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldValue}>{user.spaceBucks} 🚀</Text>
              <Text style={styles.hint}>spend-only · ${(user.spaceBucks / 100).toFixed(2)}</Text>
            </View>
          </View>

          {/* Stardust balance */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>STARDUST</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldValue}>{user.stardust} ✨</Text>
              <Text style={styles.hint}>earned from tips · ${(user.stardust / 100).toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Settings */}
          <Button
            label="Settings"
            onPress={() => router.push('/(app)/settings')}
            variant="secondary"
            style={styles.wide}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  btn: { width: 160 },
  avatarSection: { alignItems: 'center', gap: theme.spacing.md },
  avatarBtns: { flexDirection: 'row', gap: theme.spacing.sm },
  field: { gap: theme.spacing.sm },
  fieldLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.muted,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { ...theme.typography.body, color: theme.colors.text.primary },
  fieldInput: { width: '100%' },
  fieldBtns: { flexDirection: 'row', gap: theme.spacing.sm },
  handleInputRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, width: '100%' },
  at: { ...theme.typography.heading, color: theme.colors.text.muted },
  handleInput: { flex: 1 },
  error: { ...theme.typography.caption, color: theme.colors.accent.default },
  hint: { ...theme.typography.caption, color: theme.colors.text.muted },
  divider: { height: 1, backgroundColor: theme.colors.border.subtle },
  muted: { ...theme.typography.body, color: theme.colors.text.muted },
  wide: { width: '100%' },
})
