// src/components/features/stream/CompassVisualizer.tsx
//
// Live compass visualizer — a rotating bezel with a fixed top marker showing the
// broadcaster's heading. Driven by `heading` (0..360°, true). Presentational; the
// data seam (sensor → mediasoup → viewer) is in the source-visualizers handoff.

import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { VisualizerFrame, VIZ_MUTED } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

type Props = {
  /** Heading in degrees, 0..360 (0 = North, true heading). */
  heading: number
  active?: boolean
  label?: string
  style?: StyleProp<ViewStyle>
}

const D = 176 // dial diameter

const CARDINALS = ['N', 'E', 'S', 'W'] as const
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

function cardinal(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8
  return POINTS[i]!
}

export function CompassVisualizer({ heading, active = true, label = 'COMPASS', style }: Props) {
  const rot = useRef(new Animated.Value(0)).current
  const cont = useRef(0) // continuous (unwrapped) degrees so 350→10 spins +20, not -340
  useEffect(() => {
    if (!active) return
    const prev = cont.current
    const delta = ((((heading - (prev % 360)) % 360) + 540) % 360) - 180
    cont.current = prev + delta
    Animated.timing(rot, { toValue: cont.current, duration: 140, useNativeDriver: true }).start()
  }, [heading, active, rot])

  const spin = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '-360deg'] })

  return (
    <VisualizerFrame icon="compass" label={label} dim={!active} style={style}>
      <View style={styles.rose}>
        {/* Fixed reference marker at top (points into the dial = device facing). */}
        <View style={styles.marker} />
        <Animated.View style={[styles.dial, { transform: [{ rotate: spin }] }]}>
          <View style={styles.needleN} />
          <View style={styles.needleS} />
          {CARDINALS.map((c, i) => (
            <Text
              key={c}
              variant="monoLabel"
              color={i === 0 ? theme.colors.accent.default : VIZ_MUTED}
              style={[styles.card, cardStyle(i)]}
            >
              {c}
            </Text>
          ))}
        </Animated.View>
        <View style={styles.readout} pointerEvents="none">
          <Text variant="heading" color={theme.colors.text.inverse}>
            {Math.round(((heading % 360) + 360) % 360)}°
          </Text>
          <Text variant="monoLabel" color={VIZ_MUTED}>
            {cardinal(heading)}
          </Text>
        </View>
      </View>
    </VisualizerFrame>
  )
}

function cardStyle(i: number) {
  // 0=N(top) 1=E(right) 2=S(bottom) 3=W(left)
  switch (i) {
    case 0:
      return { top: 6, alignSelf: 'center' as const }
    case 1:
      return { right: 8, top: D / 2 - 8 }
    case 2:
      return { bottom: 6, alignSelf: 'center' as const }
    default:
      return { left: 8, top: D / 2 - 8 }
  }
}

const styles = StyleSheet.create({
  rose: { width: D, height: D, alignItems: 'center', justifyContent: 'center' },
  marker: {
    position: 'absolute',
    top: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: theme.colors.text.inverse,
    zIndex: 2,
  },
  dial: {
    width: D,
    height: D,
    borderRadius: D / 2,
    borderWidth: 1,
    borderColor: VIZ_MUTED,
  },
  needleN: {
    position: 'absolute',
    top: D / 2 - D * 0.34,
    left: D / 2 - 2,
    width: 4,
    height: D * 0.34,
    backgroundColor: theme.colors.accent.default,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  needleS: {
    position: 'absolute',
    top: D / 2,
    left: D / 2 - 2,
    width: 4,
    height: D * 0.34,
    backgroundColor: VIZ_MUTED,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  card: { position: 'absolute' },
  readout: { position: 'absolute', alignItems: 'center' },
})
