import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { theme } from '@/tokens/theme'

const SPACE_BUCKS_PER_DOLLAR = 100

const PRESETS = [
  { amount: 50,  label: '50 🚀',  sub: '$0.50' },
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
  const amount = selected ?? (custom ? (Number.isFinite(customAmount) && customAmount > 0 ? customAmount : 0) : 0)
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

  const dollarEquiv = amount > 0 ? `$${(amount / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}` : null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.heading}>Send a tip</Text>
          <Text style={styles.balance}>Balance: {balance} 🚀</Text>

          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.amount}
                style={[styles.preset, selected === p.amount && styles.presetActive]}
                onPress={() => { setSelected(p.amount); setCustom('') }}
              >
                <Text style={[styles.presetLabel, selected === p.amount && styles.presetLabelActive]}>
                  {p.label}
                </Text>
                <Text style={[styles.presetSub, selected === p.amount && styles.presetSubActive]}>
                  {p.sub}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.customInput}
            placeholder="Custom amount"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
            value={custom}
            onChangeText={(t) => { setCustom(t); setSelected(null) }}
          />

          {insufficient && (
            <Text style={styles.errorText}>Insufficient balance</Text>
          )}

          <Pressable
            style={[styles.confirmBtn, !canTip && styles.confirmBtnDisabled]}
            onPress={handleTip}
            disabled={!canTip}
          >
            <Text style={styles.confirmText}>
              {canTip && dollarEquiv ? `Send ${amount} 🚀 · ${dollarEquiv}` : 'Send tip'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: theme.colors.bgElevated,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  heading: {
    ...theme.typography.heading,
    color: theme.colors.text,
    textAlign: 'center',
  },
  balance: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    gap: 2,
  },
  presetActive: {
    borderColor: theme.colors.accent,
    backgroundColor: `${theme.colors.accent}22`,
  },
  presetLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  presetLabelActive: { color: theme.colors.accent },
  presetSub: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  presetSubActive: { color: theme.colors.accent },
  customInput: {
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '700',
  },
})
