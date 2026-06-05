// src/components/features/broadcast/SaveClipButton.tsx
//
// Rolling Buffer (Always-On Rewind) initiative — June 2026. There is no
// Record verb anymore: going live IS recording (into the rolling buffer).
// The only durable capture verb is "Save a clip" — retroactive, it lifts a
// span out of the buffer (the actual span-picking happens in the clip editor;
// this is the entry control). Replaces the retired Record button / RecordCircle.
//
// Styled as a sibling of GoLiveRecordBar's idle button (accent-tint fill +
// accent label) built from Pressable + Text so it can carry an accent label on
// an accent-tint fill — which the Button primitive doesn't expose. Optional
// `hint` reads under the label (e.g. "from the last 24h").
//
// See the Rolling Buffer initiative in CLAUDE.md + DESIGN.md decision log.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  onPress: () => void
  disabled?: boolean
  label?: string
  // Optional second line under the label, e.g. the reachable window.
  hint?: string
  style?: StyleProp<ViewStyle>
}

export function SaveClipButton({ onPress, disabled, label = 'Save a clip', hint, style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        variant="default"
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.btn, disabled && styles.btnDisabled]}
      >
        <View style={styles.content}>
          <Icon name="scissors" size="sm" color={theme.colors.accent.default} />
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            {label}
          </Text>
        </View>
        {hint != null && (
          <Text variant="caption" color={theme.colors.text.muted} style={styles.hint}>
            {hint}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  btn: {
    minHeight: 54,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.accent.surface,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    gap: 2,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  hint: {
    marginTop: 2,
  },
})
