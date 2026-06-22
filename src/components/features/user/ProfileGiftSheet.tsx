// src/components/features/user/ProfileGiftSheet.tsx
//
// Send a creator a gift from their profile (the offline gift path — POST
// /users/:handle/gift), the gift equivalent of ProfileTipSheet. A gift is a pure
// Space Bucks sink: the sender pays, the creator "collects" it (no Stardust). The
// catalog (emoji + value) is server-driven; the client sends only the gift id.

import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable as RNPressable, StyleSheet, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Button } from '@/components/primitives/Button'
import { Pressable } from '@/components/primitives/Pressable'
import { giftsApi } from '@/api/gifts'
import { useGiftCatalog } from '@/hooks/useGiftCatalog'
import { useCurrentUser, useSetCurrentUser } from '@/hooks/useCurrentUser'
import { newIdempotencyKey } from '@/lib/idempotency'
import type { GiftCatalogItem } from '@/types'

type Props = {
  visible: boolean
  handle: string
  displayName: string
  onClose: () => void
}

export function ProfileGiftSheet({ visible, handle, displayName, onClose }: Props) {
  const { data: me } = useCurrentUser()
  const setCurrentUser = useSetCurrentUser()
  const qc = useQueryClient()
  const { data: gifts } = useGiftCatalog()
  const balance = me?.spaceBucks ?? 0

  const [error, setError] = useState<string | null>(null)
  const [sentGift, setSentGift] = useState<{ emoji: string; amount: number } | null>(null)
  const keyRef = useRef<string | null>(null)

  const giftMutation = useMutation({
    mutationFn: (gift: GiftCatalogItem) => {
      const idempotencyKey = (keyRef.current ??= newIdempotencyKey())
      return giftsApi.send(handle, { giftType: gift.id, idempotencyKey })
    },
    onSuccess: (res) => {
      if (me) setCurrentUser({ ...me, spaceBucks: res.newBalance })
      // Refresh the recipient's profile so "gifts received" updates immediately
      // (the refetch lands while the "Sent" screen shows).
      qc.invalidateQueries({ queryKey: ['user', handle] })
      keyRef.current = null
      setSentGift({ emoji: res.emoji, amount: res.amount })
    },
    onError: (err: unknown) => {
      keyRef.current = null
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message ?? 'Could not send gift. Try again.')
    },
  })

  function handleClose() {
    onClose()
    setError(null)
    setSentGift(null)
    keyRef.current = null
  }

  function handleSend(gift: GiftCatalogItem) {
    if (giftMutation.isPending) return
    if (balance < gift.value) { setError(`Not enough Space Bucks for ${gift.label} (${gift.value} 🚀).`); return }
    setError(null)
    giftMutation.mutate(gift)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable variant="none" style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {sentGift ? (
            <View style={styles.sentBox}>
              <Text variant="display" style={styles.center}>{sentGift.emoji}</Text>
              <Text variant="heading" style={styles.center}>Sent to @{handle}</Text>
              <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
                Thanks for supporting creators.
              </Text>
              <Button label="Done" onPress={handleClose} />
            </View>
          ) : (
            <>
              <Text variant="heading" style={styles.center}>Send {displayName} a gift</Text>
              <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
                Balance: {balance} 🚀
              </Text>

              <View style={styles.grid}>
                {(gifts ?? []).map((g) => {
                  const affordable = balance >= g.value
                  const disabled = !affordable || giftMutation.isPending
                  return (
                    <RNPressable
                      key={g.id}
                      onPress={() => handleSend(g)}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={`Send ${g.label} gift for ${g.value} Space Bucks`}
                      style={({ pressed }) => [styles.gift, disabled && styles.giftDisabled, pressed && !disabled && styles.giftPressed]}
                    >
                      <Text variant="display" style={styles.giftEmoji}>{g.emoji}</Text>
                      <Text variant="caption" color={theme.colors.text.primary}>{g.label}</Text>
                      <Text variant="monoCaption" color={theme.colors.text.muted}>{g.value} 🚀</Text>
                    </RNPressable>
                  )
                })}
              </View>

              {error && <HelpText tone="err">{error}</HelpText>}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.bg.overlay },
  sheet: {
    backgroundColor: theme.colors.bg.elevated,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border.subtle, alignSelf: 'center', marginBottom: theme.spacing.sm,
  },
  center: { textAlign: 'center' },
  sentBox: { alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm },
  gift: {
    width: 88,
    alignItems: 'center',
    gap: 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.primary,
  },
  giftDisabled: { opacity: 0.4 },
  giftPressed: { borderColor: theme.colors.accent.default, backgroundColor: theme.colors.accent.surface },
  giftEmoji: { fontSize: 30 },
})
