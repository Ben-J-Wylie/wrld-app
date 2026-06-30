// Full-screen gate shown when the signed-in account is soft-deleted and inside its
// recovery grace period. /auth/me 403s a deleted account, so the rest of the
// signed-in UI can't render meaningfully — this overlays everything (rendered last
// in the root layout) and offers the only two sensible actions: reactivate (undo the
// deletion) or sign out. Driven by authStore.deletionPendingUntil, set either right
// after a self-delete or on boot via GET /users/me/account-status.

import { useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useClerk } from '@clerk/clerk-expo'
import { useQueryClient } from '@tanstack/react-query'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { useAuthStore } from '@/stores/authStore'
import { usersApi } from '@/api/users'
import { theme } from '@/tokens/theme'

export function AccountReactivationGate() {
  const until = useAuthStore((s) => s.deletionPendingUntil)
  const setDeletionPending = useAuthStore((s) => s.setDeletionPending)
  const setWrldUser = useAuthStore((s) => s.setWrldUser)
  const clearWrldUser = useAuthStore((s) => s.clearWrldUser)
  const { signOut } = useClerk()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  // This gate is a persistent root overlay — it never unmounts, it just renders
  // null when there's nothing pending. So `busy` survives a sign-out→sign-in
  // cycle (handleSignOut sets it and navigates away without resetting). Reset it
  // every time the gate (re)appears so a freshly-shown gate is always pressable
  // and can never be stuck on "Please wait…".
  useEffect(() => {
    if (until) setBusy(false)
  }, [until])

  if (!until) return null

  const anonymizeDate = (() => {
    const d = new Date(until)
    return isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  })()

  async function handleReactivate() {
    setBusy(true)
    try {
      await usersApi.reactivateAccount()
    } catch {
      Alert.alert('Error', 'Could not reactivate — try again, or contact support@wrld.cam.')
      setBusy(false)
      return
    }
    // Reactivation succeeded — the account is active again. Drop the gate now,
    // regardless of the follow-up profile refresh: if getMe() hangs or fails we
    // must NOT leave the user stuck on "Please wait…" (the account is restored,
    // and RootNavigator's /auth/me poll will refill the store).
    setDeletionPending(null)
    try {
      const user = await usersApi.getMe()
      setWrldUser(user)
    } catch {
      // best-effort — the 30s /auth/me poll refreshes the store
    }
    qc.invalidateQueries()
    setBusy(false)
  }

  async function handleSignOut() {
    setBusy(true)
    setDeletionPending(null)
    clearWrldUser()
    qc.clear()
    router.navigate('/(app)/globe')
    try {
      await signOut()
    } catch {
      // Clerk may throw in RN environments; the session is cleared regardless.
    }
  }

  return (
    <View style={styles.backdrop}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <Text variant="heading" color={theme.colors.text.primary} style={styles.heading}>
            Your account is scheduled for deletion
          </Text>
          <Text variant="body" color={theme.colors.text.muted} style={styles.body}>
            {anonymizeDate
              ? `Your WRLD account will be permanently deleted on ${anonymizeDate}. Until then you can change your mind and bring it back exactly as it was.`
              : 'Your WRLD account is scheduled for deletion. Until the grace period ends you can change your mind and bring it back exactly as it was.'}
          </Text>
          <View style={styles.actions}>
            <Button
              label={busy ? 'Please wait…' : 'Reactivate my account'}
              onPress={handleReactivate}
              variant="primary"
              disabled={busy}
            />
            {/* Never disabled — this is the escape hatch if reactivate stalls.
                handleSignOut clears the gate synchronously before any await. */}
            <Button label="Sign out" onPress={handleSignOut} variant="secondary" />
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.primary,
    zIndex: 1000,
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    gap: theme.spacing.md,
  },
  heading: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
})
