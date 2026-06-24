// src/components/screens/ProfileEditCard.tsx
//
// Self-contained identity editor: avatar (pick/take), display name, and
// handle. Extracted from MeScreen when the Me page was reorganised into
// tabs (Public Profile / Wallet / Settings) — the Public Profile tab is
// read-only, so all editing lives here in the Settings catch-all.
//
// Domain-aware (fetches its own user + owns the expo-image-picker wiring
// and optimistic updates) so any host can drop it in without plumbing.

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { theme } from '@/tokens/theme'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { AvatarPicker } from '@/components/features/user/AvatarPicker'
import { usersApi } from '@/api/users'
import { useCurrentUser, useSetCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'

// Proactive handle-change cooldown copy from /auth/me's `handleChangeAvailableAt`
// (server-authoritative — no client-side cooldown config to drift). Returns null
// when the handle can be changed now.
function handleCooldownLabel(availableAt: string | null | undefined): string | null {
  if (!availableAt) return null
  const ms = new Date(availableAt).getTime() - Date.now()
  if (!(ms > 0)) return null
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  const dateStr = new Date(availableAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `You can change your handle again in ${days} day${days === 1 ? '' : 's'} (${dateStr}).`
}

export function ProfileEditCard() {
  const { data: user } = useCurrentUser()
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
  // Cache buster — the backend serves avatars at a deterministic path
  // (/media/avatars/<userId>.<ext>) so the URL string doesn't change after a
  // re-upload, and RN's Image cache keys by URL. We bump this on every
  // successful upload so the Image fetches the new content.
  const [avatarVersion, setAvatarVersion] = useState(0)

  if (!user) return null

  const handleCooldown = handleCooldownLabel(user.handleChangeAvailableAt)

  function startEditName() {
    setDisplayName(user!.displayName)
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
    setHandle(user!.handle)
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
    // expo-image-picker doesn't auto-request runtime permissions — the launch*
    // calls throw "Missing camera or camera roll permission" if we skip this
    // step. Permission descriptions live in app.json's ios.infoPlist.
    const perm =
      source === 'gallery'
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      setAvatarError(
        source === 'gallery'
          ? 'Photo library access required — enable in Settings.'
          : 'Camera access required — enable in Settings.',
      )
      return
    }
    const result =
      source === 'gallery'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setAvatarLoading(true)
    setAvatarError('')
    try {
      const updated = await usersApi.uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg')
      setCurrentUser(updated)
      setWrldUser(updated)
      setAvatarVersion((v) => v + 1)
    } catch {
      setAvatarError('Upload failed — try again')
    } finally {
      setAvatarLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      <AvatarPicker
        avatarUrl={
          user.avatarUrl && avatarVersion > 0
            ? `${user.avatarUrl}?v=${avatarVersion}`
            : user.avatarUrl
        }
        displayName={user.displayName}
        uploading={avatarLoading}
        onTake={() => changeAvatar('camera')}
        onPick={() => changeAvatar('gallery')}
      />
      {!!avatarError && <HelpText tone="err">{avatarError}</HelpText>}

      <View style={styles.field}>
        <HelpText>DISPLAY NAME</HelpText>
        {editingName ? (
          <>
            <Input value={displayName} onChangeText={setDisplayName} autoFocus />
            {!!nameError && <HelpText tone="err">{nameError}</HelpText>}
            <View style={styles.fieldBtns}>
              <Button label="Save" onPress={saveName} loading={nameLoading} />
              <Button label="Cancel" onPress={() => setEditingName(false)} variant="secondary" />
            </View>
          </>
        ) : (
          <View style={styles.fieldRow}>
            <Text variant="body">{user.displayName}</Text>
            <Button label="Edit" onPress={startEditName} variant="secondary" />
          </View>
        )}
      </View>

      <View style={styles.field}>
        <HelpText>HANDLE</HelpText>
        {editingHandle ? (
          <>
            <Input
              variant="prefix"
              prefix="@"
              value={handle}
              onChangeText={(t) => {
                setHandle(t.toLowerCase())
                setHandleError('')
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {!!handleError && <HelpText tone="err">{handleError}</HelpText>}
            <View style={styles.fieldBtns}>
              <Button label="Save" onPress={saveHandle} loading={handleLoading} />
              <Button label="Cancel" onPress={() => setEditingHandle(false)} variant="secondary" />
            </View>
          </>
        ) : (
          <View style={styles.fieldRow}>
            <Text variant="body">@{user.handle}</Text>
            <Button label="Edit" onPress={startEditHandle} variant="secondary" disabled={!!handleCooldown} />
          </View>
        )}
        <HelpText>{handleCooldown ?? 'Handle can be changed once every 30 days.'}</HelpText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: theme.spacing.lg },
  field: { gap: theme.spacing.sm },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  fieldBtns: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
})
