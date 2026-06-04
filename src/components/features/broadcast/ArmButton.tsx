// src/components/features/broadcast/ArmButton.tsx
//
// One of the two independent arming buttons at the top of the Go Live &
// Record screen (clips initiative, 2026-06-03 decision-log entry). Going
// live and recording are independent intents, so the screen shows a pair:
// Go Live (left) and Record (right). Each ArmButton is a tall card with
// three states:
//   idle   — neutral surface, hollow dot, "Off"
//   armed  — accent surface + accent border, accent state label
//   active — accent fill + cream content (committed: live / recording)
//
// The Record button renders a filled accent dot in place of an icon
// (`iconName` omitted). Composes Pressable + Icon + Text only.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type ArmButtonState = 'idle' | 'armed' | 'active'

type IconName = React.ComponentProps<typeof Icon>['name']

type Props = {
  label: string
  stateLabel: string
  state: ArmButtonState
  iconName?: IconName
  onPress: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export function ArmButton({ label, stateLabel, state, iconName, onPress, disabled, style }: Props) {
  const active = state === 'active'
  const armed = state === 'armed'
  const contentColor = active ? theme.colors.text.inverse : theme.colors.text.primary
  const stateColor = active
    ? theme.colors.text.inverse
    : armed
      ? theme.colors.accent.default
      : theme.colors.text.subtle

  return (
    <Pressable
      variant="subtle"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${stateLabel}`}
      style={[
        styles.btn,
        armed && styles.armed,
        active && styles.active,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.top}>
        <View style={styles.ledge}>
          {iconName ? (
            <Icon name={iconName} size="lg" color={contentColor} />
          ) : (
            <View style={[styles.recDot, active && styles.recDotActive]} />
          )}
          <Text variant="bodyEmphasized" color={contentColor}>
            {label}
          </Text>
        </View>
        <View
          style={[
            styles.dot,
            armed && styles.dotArmed,
            active && styles.dotActive,
          ]}
        />
      </View>
      <Text variant="monoLabel" color={stateColor}>
        {stateLabel}
      </Text>
    </Pressable>
  )
}

const DOT = 10

const styles = StyleSheet.create({
  btn: {
    flex: 1,
    minHeight: 96,
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.elevated,
  },
  armed: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
  active: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.default,
  },
  disabled: {
    opacity: 0.45,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ledge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minWidth: 0,
  },
  recDot: {
    width: 11,
    height: 11,
    borderRadius: 11 / 2,
    backgroundColor: theme.colors.accent.default,
  },
  recDotActive: {
    backgroundColor: theme.colors.text.inverse,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    borderColor: theme.colors.border.strong,
  },
  dotArmed: {
    borderColor: theme.colors.accent.default,
  },
  dotActive: {
    borderColor: theme.colors.text.inverse,
    backgroundColor: theme.colors.text.inverse,
  },
})
