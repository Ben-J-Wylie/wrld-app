// src/components/features/stream/TemperatureVisualizer.tsx
//
// Live ambient-temperature visualizer — a vertical thermometer whose fill tracks
// `celsius` over a fixed range, plus a numeric readout. Driven by `celsius`.
// Presentational; data seam is in the source-visualizers handoff.
//
// NOTE: ambient temperature has no reliable cross-platform sensor (iOS exposes
// none; Android TYPE_AMBIENT_TEMPERATURE is rare) — see the handoff. This renders
// whatever value it's given.

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { VisualizerFrame, VIZ_MUTED } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

type Unit = 'c' | 'f'

type Props = {
  /** Temperature in degrees Celsius. */
  celsius: number
  unit?: Unit
  /** Display range in Celsius (clamps the fill). */
  min?: number
  max?: number
  active?: boolean
  label?: string
  style?: StyleProp<ViewStyle>
}

export function TemperatureVisualizer({
  celsius,
  unit = 'c',
  min = -10,
  max = 45,
  active = true,
  label = 'TEMP',
  style,
}: Props) {
  const frac = Math.max(0, Math.min(1, (celsius - min) / (max - min)))
  const fill = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fill, { toValue: active ? frac : 0, duration: 240, useNativeDriver: false }).start()
  }, [frac, active, fill])
  const height = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  const display = unit === 'f' ? celsius * 1.8 + 32 : celsius
  const unitLabel = unit === 'f' ? '°F' : '°C'

  return (
    <VisualizerFrame icon="thermometer" label={label} dim={!active} style={style}>
      <View style={styles.row}>
        <View style={styles.thermo}>
          <View style={styles.tube}>
            <Animated.View style={[styles.mercury, { height }]} />
          </View>
          <View style={styles.bulb} />
        </View>
        <View style={styles.readout}>
          <Text variant="display" color={theme.colors.text.inverse}>
            {Math.round(display)}
          </Text>
          <Text variant="monoLabel" color={VIZ_MUTED}>
            {unitLabel}
          </Text>
        </View>
      </View>
    </VisualizerFrame>
  )
}

const TUBE_H = 150
const TUBE_W = 18
const BULB = 34

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xl },
  thermo: { alignItems: 'center' },
  tube: {
    width: TUBE_W,
    height: TUBE_H,
    borderRadius: TUBE_W / 2,
    backgroundColor: VIZ_MUTED,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: VIZ_MUTED,
  },
  mercury: { width: '100%', backgroundColor: theme.colors.accent.default },
  bulb: {
    width: BULB,
    height: BULB,
    borderRadius: BULB / 2,
    backgroundColor: theme.colors.accent.default,
    marginTop: -BULB / 3,
  },
  readout: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
})
