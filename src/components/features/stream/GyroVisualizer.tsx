// src/components/features/stream/GyroVisualizer.tsx
//
// Live gyroscope/attitude visualizer — an artificial-horizon: the horizon plane
// rolls (rotate) and pitches (translateY) to mirror the device's orientation, with
// a fixed centre crosshair and numeric pitch/roll. Driven by `pitch`/`roll` in
// degrees. Presentational; data seam is in the source-visualizers handoff.

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { VisualizerFrame, VIZ_MUTED } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

type Props = {
  /** Pitch in degrees (+ nose up). */
  pitch: number
  /** Roll in degrees (+ right wing down). */
  roll: number
  active?: boolean
  label?: string
  style?: StyleProp<ViewStyle>
}

const D = 176 // viewport diameter
const PX_PER_DEG = 1.6 // pitch → vertical offset
const PITCH_CLAMP = 45

export function GyroVisualizer({ pitch, roll, active = true, label = 'GYRO', style }: Props) {
  const rollA = useRef(new Animated.Value(0)).current
  const pitchA = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!active) return
    Animated.timing(rollA, { toValue: roll, duration: 120, useNativeDriver: true }).start()
    const p = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, pitch))
    Animated.timing(pitchA, { toValue: p * PX_PER_DEG, duration: 120, useNativeDriver: true }).start()
  }, [pitch, roll, active, rollA, pitchA])

  const rotate = rollA.interpolate({ inputRange: [-180, 180], outputRange: ['180deg', '-180deg'] })

  return (
    <VisualizerFrame icon="rotate-cw" label={label} dim={!active} style={style}>
      <View style={styles.viewport}>
        <Animated.View
          style={[styles.plane, { transform: [{ rotate }, { translateY: pitchA }] }]}
        >
          <View style={styles.sky} />
          <View style={styles.horizonLine} />
          <View style={styles.ground} />
        </Animated.View>
        {/* Fixed crosshair */}
        <View style={styles.crossH} pointerEvents="none" />
        <View style={styles.crossDot} pointerEvents="none" />
        <View style={styles.readout} pointerEvents="none">
          <Text variant="monoCaption" color={VIZ_MUTED}>
            P {Math.round(pitch)}°  ·  R {Math.round(roll)}°
          </Text>
        </View>
      </View>
    </VisualizerFrame>
  )
}

const PLANE = D * 1.7

const styles = StyleSheet.create({
  viewport: {
    width: D,
    height: D,
    borderRadius: D / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: VIZ_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plane: { position: 'absolute', width: PLANE, height: PLANE },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: PLANE / 2, backgroundColor: 'rgba(236,230,214,0.12)' },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: PLANE / 2, backgroundColor: 'rgba(236,230,214,0.03)' },
  horizonLine: {
    position: 'absolute',
    top: PLANE / 2 - 1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.colors.accent.default,
  },
  crossH: {
    position: 'absolute',
    width: 56,
    height: 2,
    backgroundColor: theme.colors.text.inverse,
    opacity: 0.8,
  },
  crossDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.text.inverse,
  },
  readout: { position: 'absolute', bottom: 10 },
})
