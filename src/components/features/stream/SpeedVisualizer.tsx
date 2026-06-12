// src/components/features/stream/SpeedVisualizer.tsx
//
// Live speed visualizer — a large numeric readout (converted from m/s) + unit and a
// horizontal gauge bar filling toward `max`. Driven by `mps` (metres/second, e.g.
// from GPS `coords.speed`). Presentational; data seam is in the source-visualizers
// handoff.

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { VisualizerFrame, VIZ_MUTED } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

type Unit = 'kmh' | 'mph'

type Props = {
  /** Speed in metres per second (e.g. GPS coords.speed; <0 means unknown → 0). */
  mps: number
  unit?: Unit
  /** Gauge full-scale in the display unit. Defaults: 120 km/h or 75 mph. */
  max?: number
  active?: boolean
  label?: string
  style?: StyleProp<ViewStyle>
}

const FACTOR: Record<Unit, number> = { kmh: 3.6, mph: 2.23694 }
const UNIT_LABEL: Record<Unit, string> = { kmh: 'KM/H', mph: 'MPH' }

export function SpeedVisualizer({
  mps,
  unit = 'kmh',
  max,
  active = true,
  label = 'SPEED',
  style,
}: Props) {
  const full = max ?? (unit === 'kmh' ? 120 : 75)
  const value = Math.max(0, mps) * FACTOR[unit]
  const frac = Math.max(0, Math.min(1, value / full))

  const fill = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fill, { toValue: active ? frac : 0, duration: 200, useNativeDriver: false }).start()
  }, [frac, active, fill])
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <VisualizerFrame icon="fast-forward" label={label} dim={!active} style={style}>
      <View style={styles.body}>
        <View style={styles.numberRow}>
          <Text variant="display" color={theme.colors.text.inverse}>
            {value < 10 ? value.toFixed(1) : Math.round(value).toString()}
          </Text>
          <Text variant="monoLabel" color={VIZ_MUTED} style={styles.unit}>
            {UNIT_LABEL[unit]}
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width }]} />
        </View>
        <View style={styles.scaleRow}>
          <Text variant="monoCaption" color={VIZ_MUTED}>
            0
          </Text>
          <Text variant="monoCaption" color={VIZ_MUTED}>
            {full}
          </Text>
        </View>
      </View>
    </VisualizerFrame>
  )
}

const styles = StyleSheet.create({
  body: { width: '100%', maxWidth: 240, gap: theme.spacing.sm },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: theme.spacing.xs },
  unit: { marginBottom: 8 },
  track: {
    height: 10,
    borderRadius: theme.radius.full,
    backgroundColor: VIZ_MUTED,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: theme.radius.full, backgroundColor: theme.colors.accent.default },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
})
