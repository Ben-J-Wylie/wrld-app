// src/components/features/broadcast/GoBar.tsx
//
// Big docked-bottom CTA on the Go Live arming screen. Five visual
// states keyed off the `variant` prop:
//
//   idle      — neutral, label "READY WHEN YOU ARE"
//   armed     — accent bg + accent label "GO LIVE"
//   counting  — countdown ring overlay + number (consumer drives
//               `countdownSec`)
//   live      — accent bg + accent label "LIVE · TAP TO STOP" with
//               an active knob (subtle pulse)
//   disabled  — opacity 0.45, non-interactive
//
// Knob on the right slides between "READY" / "GO" / "STOP" by variant.
// Animation is opt-in: state transitions render new bg + label
// instantly; consumers add layout transitions externally if needed.

import { useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type GoBarVariant = 'idle' | 'armed' | 'counting' | 'live' | 'disabled'

type Props = {
  variant: GoBarVariant
  countdownSec?: number
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

const LABEL: Record<GoBarVariant, string> = {
  idle: 'READY WHEN YOU ARE',
  armed: 'GO LIVE',
  counting: 'GOING LIVE…',
  live: 'LIVE · TAP TO STOP',
  disabled: 'CHECK YOUR SOURCES',
}

const KNOB_LABEL: Record<GoBarVariant, string> = {
  idle: 'GO',
  armed: 'GO',
  counting: '…',
  live: 'STOP',
  disabled: '—',
}

export function GoBar({ variant, countdownSec, onPress, style }: Props) {
  const tintedBg = variant === 'armed' || variant === 'counting' || variant === 'live'
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (variant !== 'live') return
    const half = theme.motion.patterns.pulse.duration / 2
    const easing = theme.motion.patterns.pulse.easing
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: half, easing, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: half, easing, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [variant])

  const knobOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] })

  return (
    <Pressable
      variant="default"
      onPress={onPress ?? (() => {})}
      disabled={variant === 'disabled' || !onPress}
      accessibilityRole="button"
      accessibilityLabel={LABEL[variant]}
      style={[
        styles.bar,
        tintedBg && styles.tinted,
        variant === 'disabled' && styles.disabled,
        style,
      ]}
    >
      <View style={styles.labelCol}>
        <Text variant="bodyEmphasized" color={tintedBg ? theme.colors.accent.default : theme.colors.text.primary}>
          {LABEL[variant]}
        </Text>
        {variant === 'counting' && countdownSec !== undefined && (
          <Text variant="monoLabel" color={theme.colors.accent.default}>
            STARTING IN {countdownSec}s
          </Text>
        )}
      </View>
      <Animated.View
        style={[
          styles.knob,
          tintedBg && styles.knobTinted,
          variant === 'live' && { opacity: knobOpacity },
        ]}
      >
        {variant === 'live' ? (
          <Icon name="square" size="md" color={theme.colors.text.inverse} />
        ) : (
          <Text variant="monoLabel" color={tintedBg ? theme.colors.text.inverse : theme.colors.text.primary}>
            {KNOB_LABEL[variant]}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  )
}

const KNOB = 48

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 20,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  tinted: {
    backgroundColor: theme.colors.accent.surface,
    borderColor: theme.colors.accent.default,
  },
  disabled: {
    opacity: 0.45,
  },
  labelCol: {
    flex: 1,
    gap: 2,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobTinted: {
    backgroundColor: theme.colors.accent.default,
  },
})
