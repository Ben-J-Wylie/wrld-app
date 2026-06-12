// src/components/features/stream/MotionVisualizer.tsx
//
// Live motion-intensity visualizer — a vertical segment ladder lit bottom→top in
// proportion to `intensity` (0..1, a smoothed accelerometer magnitude), plus a
// numeric percent. Distinct from the audio waveform (static ladder vs scroll).
// Presentational; data seam is in the source-visualizers handoff.

import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { VisualizerFrame, VIZ_MUTED } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

type Props = {
  /** Motion intensity, 0..1 (smoothed accelerometer magnitude). */
  intensity: number
  active?: boolean
  label?: string
  segments?: number
  style?: StyleProp<ViewStyle>
}

const SAMPLE_MS = 80
const ATTACK = 0.5
const DECAY = 0.16

export function MotionVisualizer({
  intensity,
  active = true,
  label = 'MOTION',
  segments = 16,
  style,
}: Props) {
  const target = useRef(0)
  target.current = active ? Math.max(0, Math.min(1, intensity)) : 0
  const smoothRef = useRef(0)
  const [v, setV] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      const t = target.current
      const cur = smoothRef.current
      smoothRef.current = cur + (t - cur) * (t > cur ? ATTACK : DECAY)
      setV(smoothRef.current)
    }, SAMPLE_MS)
    return () => clearInterval(id)
  }, [])

  const lit = Math.round(v * segments)
  return (
    <VisualizerFrame icon="activity" label={label} dim={!active} style={style}>
      <View style={styles.row}>
        <View style={styles.ladder}>
          {Array.from({ length: segments }).map((_, i) => {
            // index 0 is the bottom segment
            const on = i < lit
            // top of the ladder reads "hotter" (full accent), base softer
            const hot = i / (segments - 1)
            return (
              <View
                key={i}
                style={[
                  styles.seg,
                  {
                    backgroundColor: on ? theme.colors.accent.default : VIZ_MUTED,
                    opacity: on ? 0.55 + 0.45 * hot : 0.25,
                  },
                ]}
              />
            )
          })}
        </View>
        <View style={styles.readout}>
          <Text variant="heading" color={theme.colors.text.inverse}>
            {Math.round(v * 100)}
          </Text>
          <Text variant="monoLabel" color={VIZ_MUTED}>
            %
          </Text>
        </View>
      </View>
    </VisualizerFrame>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xl, height: 180 },
  ladder: {
    flexDirection: 'column-reverse', // first child at the bottom
    justifyContent: 'space-between',
    height: '100%',
    width: 26,
  },
  seg: {
    height: '4.5%',
    borderRadius: theme.radius.full,
  },
  readout: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
})
