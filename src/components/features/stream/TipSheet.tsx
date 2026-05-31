// src/components/features/stream/TipSheet.tsx
//
// 12.6 token cleanup pass. The bespoke Modal + KeyboardAvoidingView
// scaffold stays (they work and handle keyboard avoidance correctly);
// only the inner rendering swaps to design-system primitives:
//   • Text variants + HelpText replace bespoke style.* + raw color
//   • Button (variant=primary, disabled state) replaces the bespoke
//     confirm button — removes the '#fff' hex literal
//   • Pressable primitive for the preset chips so they pick up the
//     standard subtle press feedback. Visual layout (3-up grid with
//     amount + USD sub) stays inline because the existing dual-line
//     chip shape doesn't match PresetGrid's single-label chips today.

import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Button } from '@/components/primitives/Button'
import { Pressable } from '@/components/primitives/Pressable'

const SPACE_BUCKS_PER_DOLLAR = 100

const PRESETS = [
  { amount: 50, label: '50 🚀', sub: '$0.50' },
  { amount: 100, label: '100 🚀', sub: '$1.00' },
  { amount: 500, label: '500 🚀', sub: '$5.00' },
]

type Props = {
  visible: boolean
  balance: number
  onClose: () => void
  onTip: (amount: number) => void
}

export function TipSheet({ visible, balance, onClose, onTip }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')

  const customAmount = parseInt(custom, 10)
  const amount =
    selected ??
    (custom ? (Number.isFinite(customAmount) && customAmount > 0 ? customAmount : 0) : 0)
  const insufficient = amount > 0 && amount > balance
  const canTip = amount >= 10 && !insufficient

  function handleTip() {
    if (!canTip) return
    onTip(amount)
    onClose()
    setSelected(null)
    setCustom('')
  }

  function handleClose() {
    onClose()
    setSelected(null)
    setCustom('')
  }

  const dollarEquiv =
    amount > 0 ? `$${(amount / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}` : null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable variant="none" style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text variant="heading" style={styles.center}>
            Send a tip
          </Text>
          <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
            Balance: {balance} 🚀
          </Text>

          <View style={styles.presetRow}>
            {PRESETS.map((p) => {
              const isSelected = selected === p.amount
              return (
                <Pressable
                  key={p.amount}
                  variant="subtle"
                  onPress={() => {
                    setSelected(p.amount)
                    setCustom('')
                  }}
                  style={[styles.preset, isSelected && styles.presetActive]}
                >
                  <Text
                    variant="bodyEmphasized"
                    color={
                      isSelected
                        ? theme.colors.accent.default
                        : theme.colors.text.primary
                    }
                  >
                    {p.label}
                  </Text>
                  <Text
                    variant="caption"
                    color={
                      isSelected ? theme.colors.accent.default : theme.colors.text.muted
                    }
                  >
                    {p.sub}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <TextInput
            style={styles.customInput}
            placeholder="Custom amount"
            placeholderTextColor={theme.colors.text.muted}
            keyboardType="number-pad"
            value={custom}
            onChangeText={(t) => {
              setCustom(t)
              setSelected(null)
            }}
          />

          {insufficient && <HelpText tone="err">Insufficient balance</HelpText>}

          <Button
            label={canTip && dollarEquiv ? `Send ${amount} 🚀 · ${dollarEquiv}` : 'Send tip'}
            onPress={handleTip}
            disabled={!canTip}
          />
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
  customInput: {
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
})
