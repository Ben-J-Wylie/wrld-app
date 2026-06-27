// src/components/features/clip/SaveClipSheet.tsx
//
// Name-this-clip modal for the buffer editor — a keyboard-aware bottom sheet shown when
// the clip tool rail's Save is pressed (instead of a persistent name field below the
// editor). Auto-focuses the name input so the keyboard rises and the sheet floats above
// it (the AuthModal Modal + KeyboardAvoidingView pattern). Confirm saves the clip;
// Cancel / backdrop dismisses. See DESIGN.md Section 3 (Buffer-trim clip editor).

import { useEffect, useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
// react-native-keyboard-controller's KeyboardAvoidingView (+ a KeyboardProvider inside
// the Modal) — RN's is unreliable in a Modal/absolute sheet and lets the keyboard cover
// the field. No native change; the module's already in the client.
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller'
import { Pressable } from '@/components/primitives/Pressable'
import { Input } from '@/components/primitives/Input'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  visible: boolean
  defaultName?: string
  // Optional context line under the title (e.g. the clip duration).
  durationLabel?: string
  onSave: (name: string) => void
  onCancel: () => void
}

export function SaveClipSheet({ visible, defaultName = '', durationLabel, onSave, onCancel }: Props) {
  const [name, setName] = useState(defaultName)
  // Reset to the default each time it opens.
  useEffect(() => {
    if (visible) setName(defaultName)
  }, [visible, defaultName])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardProvider>
        <Pressable variant="none" style={styles.backdrop} onPress={onCancel} />
        <KeyboardAvoidingView behavior="padding" style={styles.sheetWrapper}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text variant="heading" style={styles.center}>
            Name this clip
          </Text>
          {durationLabel != null && (
            <Text variant="caption" color={theme.colors.text.muted} style={styles.center}>
              {durationLabel}
            </Text>
          )}
          <Input
            placeholder="Clip name"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => onSave(name)}
          />
          <Button label="Save clip" onPress={() => onSave(name)} />
          <Pressable
            variant="default"
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={styles.cancel}
          >
            <Text variant="body" color={theme.colors.text.muted}>
              Cancel
            </Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </KeyboardProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.overlay,
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
  center: {
    textAlign: 'center',
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
})
