// src/components/features/stream/TorchVisualizer.tsx
//
// Live torch-status visualizer — a lamp that lights (accent core + glow halo) when
// the broadcaster's torch is `on`, dim otherwise, with an ON/OFF label. Suits the
// on/off "torch channel" (incl. morse) idea. Driven by `on` (+ optional `level`).
// Presentational; data seam is in the source-visualizers handoff.

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { VisualizerFrame, VIZ_MUTED } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

type Props = {
  on: boolean
  /** Brightness 0..1 (affects glow intensity). Defaults to 1 when on. */
  level?: number
  active?: boolean
  label?: string
  /** When set, the lamp becomes a tappable on/off control (the broadcaster's torch toggle —
   *  a signaled on/off channel, not the device LED). Omitted → a read-only lamp (viewers). */
  onToggle?: () => void
  style?: StyleProp<ViewStyle>
}

export function TorchVisualizer({ on, level = 1, active = true, label = 'TORCH', onToggle, style }: Props) {
  const glow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(glow, {
      toValue: active && on ? Math.max(0.2, Math.min(1, level)) : 0,
      duration: 90,
      useNativeDriver: true,
    }).start()
  }, [on, level, active, glow])

  const haloOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })
  const haloScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] })
  const lit = active && on

  const lamp = (
    <View style={styles.body}>
      <View style={styles.lampWrap}>
        <Animated.View
          style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
        />
        <View style={[styles.lamp, { backgroundColor: lit ? theme.colors.accent.default : 'transparent', borderColor: lit ? theme.colors.accent.default : VIZ_MUTED }]}>
          <Icon name="zap" size="lg" color={lit ? theme.colors.text.inverse : VIZ_MUTED} />
        </View>
      </View>
      <Text variant="heading" color={lit ? theme.colors.text.inverse : VIZ_MUTED}>
        {lit ? 'ON' : 'OFF'}
      </Text>
    </View>
  )

  return (
    <VisualizerFrame icon="zap" label={label} dim={!active} style={style}>
      {onToggle ? (
        <Pressable variant="subtle" onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel="Toggle torch">
          {lamp}
        </Pressable>
      ) : (
        lamp
      )}
    </VisualizerFrame>
  )
}

const LAMP = 88

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: theme.spacing.md },
  lampWrap: { width: LAMP * 1.8, height: LAMP * 1.8, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: LAMP,
    height: LAMP,
    borderRadius: LAMP / 2,
    backgroundColor: theme.colors.accent.default,
  },
  lamp: {
    width: LAMP,
    height: LAMP,
    borderRadius: LAMP / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
