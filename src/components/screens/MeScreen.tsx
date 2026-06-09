// src/components/screens/MeScreen.tsx
//
// 12.6 migration target. Composes:
//   • ScreenScroll (was the wrapper already; no change)
//   • AvatarPicker — replaces the inline Avatar + Gallery + Camera
//     trio. AvatarPicker is domain-blind; this screen keeps its
//     expo-image-picker wiring and surfaces uploading state via the
//     `uploading` prop.
//   • PursesCard (dual) — replaces the bespoke Space Bucks + Stardust
//     blocks. $/unit conversion lives in the feature.
//   • Input + HelpText — editable display-name + handle fields keep
//     inline edit / save / cancel UX; errors render through HelpText
//     (tone=err) and the hint under handle becomes HelpText (tone=dim).
//
// Behavior unchanged: avatar upload, profile field updates with
// optimistic UI, signed-out fallback, loading state.

import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { theme } from '@/tokens/theme'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { AvatarPicker } from '@/components/features/user/AvatarPicker'
import { PursesCard } from '@/components/features/wallet/PursesCard'
import { usersApi } from '@/api/users'
import { useCurrentUser, useSetCurrentUser } from '@/hooks/useCurrentUser'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useAuthStore } from '@/stores/authStore'

// Mirrors ProfileScreen's compact count formatting (e.g. 12, 1.2k, 12k).
function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function MeScreen() {
  const { isSignedIn } = useAuth()
  const { data: user, isLoading } = useCurrentUser()
  // Gift collection lives on the public profile endpoint (GET /users/:handle),
  // not /auth/me — fetch our own profile to surface "Gifts collected" here.
  const { data: profile } = useUserProfile(user?.handle ?? null)
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
  // (/media/avatars/<userId>.<ext>) so the URL string doesn't change
  // after a re-upload, and RN's Image cache keys by URL. We bump this
  // on every successful upload so the Image fetches the new content.
  const [avatarVersion, setAvatarVersion] = useState(0)

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
    // expo-image-picker doesn't auto-request runtime permissions —
    // the launch* calls throw "Missing camera or camera roll permission"
    // if we skip this step. Permission descriptions live in app.json's
    // ios.infoPlist (NSCameraUsageDescription, NSPhotoLibraryUsageDescription).
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

  if (!isSignedIn) {
    return (
      <ScreenScroll header={<ScreenHeader title="Me" />} contentContainerStyle={styles.center}>
        <Text variant="body" color={theme.colors.text.muted}>
          Sign in to access your profile
        </Text>
        <Button label="Sign in" onPress={() => router.push('/(auth)/login')} style={styles.btn} />
      </ScreenScroll>
    )
  }

  if (isLoading || !user) {
    return (
      <ScreenScroll header={<ScreenHeader title="Me" />} contentContainerStyle={styles.center}>
        <ActivityIndicator color={theme.colors.accent.default} />
      </ScreenScroll>
    )
  }

  const gifts = profile?.giftsReceived ?? []
  const totalGifts = gifts.reduce((sum, g) => sum + g.count, 0)

  return (
    <ScreenScroll header={<ScreenHeader title="Me" />} contentContainerStyle={styles.content}>
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
            <Button label="Edit" onPress={startEditHandle} variant="secondary" />
          </View>
        )}
        <HelpText>Handle can be changed once every 30 days.</HelpText>
      </View>

      <PursesCard spaceBucks={user.spaceBucks} starDust={user.stardust} />

      {gifts.length > 0 && (
        <View style={styles.giftsCard}>
          <View style={styles.giftsHeader}>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              GIFTS COLLECTED
            </Text>
            <Text variant="monoLabel" color={theme.colors.text.subtle}>
              {formatCount(totalGifts)}
            </Text>
          </View>
          <View style={styles.giftsRow}>
            {gifts.map((g) => (
              <View key={g.giftType} style={styles.giftCell}>
                <Text variant="display">{g.emoji}</Text>
                <Text variant="bodyEmphasized">{formatCount(g.count)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Library, Wallet + Events moved off the footer — reached from here now. */}
      <Button
        label="Wallet"
        onPress={() => router.push('/(app)/wallet')}
        variant="secondary"
      />
      <Button
        label="Library"
        onPress={() => router.push('/(app)/library')}
        variant="secondary"
      />
      <Button
        label="Events"
        onPress={() => router.push('/(app)/ppv')}
        variant="secondary"
      />
      <Button
        label="Settings"
        onPress={() => router.push('/(app)/settings')}
        variant="secondary"
      />
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  btn: { width: 160 },
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
  giftsCard: {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  giftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftCell: {
    alignItems: 'center',
    gap: 2,
  },
})
