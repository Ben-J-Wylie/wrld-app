// src/components/features/user/ProfileTipSheet.tsx
//
// Tip a creator from their profile (the offline/clip tip path — POST
// /users/:handle/tip), distinct from the live in-stream TipSheet which fires
// through mediasoup. Adds an optional creator-readable message (bad-words
// checked client-side; the server is the authority) and owns the API mutation
// + success state. Space Bucks → the creator's Stardust.

import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { Filter as ProfanityFilter } from 'bad-words'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Button } from '@/components/primitives/Button'
import { Pressable } from '@/components/primitives/Pressable'
import { usersApi } from '@/api/users'
import { useCurrentUser, useSetCurrentUser } from '@/hooks/useCurrentUser'

const SPACE_BUCKS_PER_DOLLAR = 100
const MAX_MESSAGE = 140
const profanityFilter = new ProfanityFilter()

const PRESETS = [
  { amount: 50, label: '50 🚀', sub: '$0.50' },
  { amount: 100, label: '100 🚀', sub: '$1.00' },
  { amount: 500, label: '500 🚀', sub: '$5.00' },
]

type Props = {
  visible: boolean
  handle: string
  displayName: string
  onClose: () => void
}

export function ProfileTipSheet({ visible, handle, displayName, onClose }: Props) {
  const { data: me } = useCurrentUser()
  const setCurrentUser = useSetCurrentUser()
  const balance = me?.spaceBucks ?? 0

  const [selected, setSelected] = useState<number | null>(100)
  const [custom, setCustom] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const customAmount = parseInt(custom, 10)
  const amount =
    custom ? (Number.isFinite(customAmount) && customAmount > 0 ? customAmount : 0) : (selected ?? 0)
  const insufficient = amount > 0 && amount > balance
  const messageProfane = message.trim().length > 0 && profanityFilter.isProfane(message)
  const canTip = amount >= 10 && !insufficient && !messageProfane

  const tipMutation = useMutation({
    mutationFn: () => usersApi.tip(handle, { amount, message: message.trim() || undefined }),
    onSuccess: (res) => {
      // Patch the balance immediately; the user_updated WS push will also land.
      if (me) setCurrentUser({ ...me, spaceBucks: res.newBalance })
      setSent(true)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message ?? 'Could not send tip. Try again.')
    },
  })

  function reset() {
    setSelected(100)
    setCustom('')
    setMessage('')
    setError(null)
    setSent(false)
  }

  function handleClose() {
    onClose()
    reset()
  }

  const dollarEquiv = amount > 0 ? `$${(amount / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}` : null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable variant="none" style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {sent ? (
            <View style={styles.sentBox}>
              <Text variant="display" style={styles.center}>💸</Text>
              <Text variant="heading" style={styles.center}>
                Tipped {amount} 🚀 to @{handle}
              </Text>
              <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
                Thanks for supporting creators.
              </Text>
              <Button label="Done" onPress={handleClose} />
            </View>
          ) : (
            <>
              <Text variant="heading" style={styles.center}>
                Tip {displayName}
              </Text>
              <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
                Balance: {balance} 🚀
              </Text>

              <View style={styles.presetRow}>
                {PRESETS.map((p) => {
                  const isSelected = !custom && selected === p.amount
                  return (
                    <Pressable
                      key={p.amount}
                      variant="subtle"
                      onPress={() => {
                        setSelected(p.amount)
                        setCustom('')
                        setError(null)
                      }}
                      style={[styles.preset, isSelected && styles.presetActive]}
                    >
                      <Text
                        variant="bodyEmphasized"
                        color={isSelected ? theme.colors.accent.default : theme.colors.text.primary}
                      >
                        {p.label}
                      </Text>
                      <Text
                        variant="caption"
                        color={isSelected ? theme.colors.accent.default : theme.colors.text.muted}
                      >
                        {p.sub}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Custom amount"
                placeholderTextColor={theme.colors.text.muted}
                keyboardType="number-pad"
                value={custom}
                onChangeText={(t) => {
                  setCustom(t)
                  setSelected(null)
                  setError(null)
                }}
              />

              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Add a message (optional)"
                placeholderTextColor={theme.colors.text.muted}
                value={message}
                onChangeText={setMessage}
                maxLength={MAX_MESSAGE}
                multiline
              />

              {insufficient && <HelpText tone="err">Insufficient balance</HelpText>}
              {messageProfane && <HelpText tone="err">Please remove inappropriate language from your message.</HelpText>}
              {error && <HelpText tone="err">{error}</HelpText>}

              <Button
                label={canTip && dollarEquiv ? `Send ${amount} 🚀 · ${dollarEquiv}` : 'Send tip'}
                onPress={() => { setError(null); tipMutation.mutate() }}
                disabled={!canTip || tipMutation.isPending}
              />
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
    backgroundColor: theme.colors.bg.overlay,
  },
  sheet: {
    backgroundColor: theme.colors.bg.elevated,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border.subtle,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  sentBox: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.primary,
    gap: 2,
  },
  presetActive: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  input: {
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.bg.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: theme.typography.body.fontSize,
  },
  messageInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
})
