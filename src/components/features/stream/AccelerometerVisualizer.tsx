// src/components/features/stream/AccelerometerVisualizer.tsx
//
// Live accelerometer visualizer — three scrolling per-axis traces (x/y/z, m/s²)
// around a zero line, with a current-value legend. This is the FULL view of the
// accelerometer; `MotionVisualizer` is the SAME sensor collapsed to a single
// magnitude scalar (kept for at-a-glance "how active"). Driven by `{ x, y, z }`.
//
// Dependency-free (pure Views, no SVG / chart lib) like the other Source* views.
// Each axis is a dot trace: dense time columns read as three lines. Presentational;
// data seam (sensor → mediasoup → viewer) is in the source-visualizers handoff.

import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { VisualizerFrame, VIZ_MUTED } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

type Props = {
  /** Acceleration on each axis in m/s² (raw — typically includes gravity). */
  x: number
  y: number
  z: number
  active?: boolean
  label?: string
  /** Full-scale per axis (±range maps to top/bottom). Default 20 ≈ ±2g incl. gravity. */
  range?: number
  /** Number of time columns held in the scroll history. */
  samples?: number
  style?: StyleProp<ViewStyle>
}

// Data-viz series colours (warm-palette: crimson accent · amber · cream) — chosen to
// stay distinct on the ink backdrop. Local to this chart, like the analytics series.
const AXIS = {
  x: { color: theme.colors.accent.default, label: 'X' },
  y: { color: '#E5A33B', label: 'Y' },
  z: { color: theme.colors.text.inverse, label: 'Z' },
} as const

const SAMPLE_MS = 60

type Frame = { x: number; y: number; z: number }

export function AccelerometerVisualizer({
  x,
  y,
  z,
  active = true,
  label = 'ACCEL',
  range = 20,
  samples = 56,
  style,
}: Props) {
  const latest = useRef<Frame>({ x: 0, y: 0, z: 0 })
  latest.current = active ? { x, y, z } : { x: 0, y: 0, z: 0 }
  const [hist, setHist] = useState<Frame[]>(() =>
    new Array(samples).fill(0).map(() => ({ x: 0, y: 0, z: 0 })),
  )

  useEffect(() => {
    const id = setInterval(() => {
      setHist((prev) => {
        const next = prev.slice(1)
        next.push(latest.current)
        return next
      })
    }, SAMPLE_MS)
    return () => clearInterval(id)
  }, [])

  // value (m/s²) → 0..1 top fraction (0 = top, 0.5 = zero line, 1 = bottom)
  const pos = (v: number) => Math.max(0, Math.min(1, 0.5 - v / (2 * range)))
  const n = hist.length

  return (
    <VisualizerFrame icon="move" label={label} dim={!active} style={style}>
      <View style={styles.body}>
        <View style={styles.graph}>
          <View style={styles.zeroLine} pointerEvents="none" />
          {hist.map((f, i) => {
            // fade older (left) columns so the leading edge reads as "now"
            const op = n > 1 ? 0.3 + 0.7 * (i / (n - 1)) : 1
            return (
              <View key={i} style={styles.col}>
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <View
                    key={axis}
                    style={[
                      styles.dot,
                      { top: `${pos(f[axis]) * 100}%`, backgroundColor: AXIS[axis].color, opacity: op },
                    ]}
                  />
                ))}
              </View>
            )
          })}
        </View>
        <View style={styles.legend}>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <View key={axis} style={styles.legendItem}>
              <View style={[styles.chip, { backgroundColor: AXIS[axis].color }]} />
              <Text variant="monoCaption" color={VIZ_MUTED}>
                {AXIS[axis].label} {latest.current[axis].toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </VisualizerFrame>
  )
}

const DOT = 3

const styles = StyleSheet.create({
  body: { width: '100%', height: 180, justifyContent: 'center', gap: theme.spacing.md },
  graph: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '70%',
    width: '100%',
  },
  zeroLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: VIZ_MUTED,
  },
  col: { flex: 1, height: '100%' },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    marginTop: -DOT / 2,
    alignSelf: 'center',
  },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  chip: { width: 8, height: 8, borderRadius: 2 },
})
