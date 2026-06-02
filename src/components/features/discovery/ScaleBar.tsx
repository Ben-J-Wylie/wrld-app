// src/components/features/discovery/ScaleBar.tsx
//
// Map distance scale — a horizontal hairline with end-ticks and a
// label showing the real-world width of a chosen segment ("20 km",
// "500 m"). Sits below the CategoryChipRow on the Globe page so the
// user can read the map's current scale at a glance.
//
// Inputs (consumer-flat):
//   centerLat — current map center latitude in degrees. The horizontal
//               metres-per-pixel at a given zoom depends on latitude
//               (shorter near the poles); we read it from the live map.
//   zoom      — Mapbox zoom level (0 = whole world, 22 = building).
//   maxWidthPx — the widest the bar can render; we pick the largest
//                "nice" round distance that fits.
//   unit      — 'metric' (km/m) | 'imperial' (mi/ft). Defaults to metric.
//
// The selected distance is the largest of [1,2,5] × 10ⁿ (and 25 for
// metric) that still fits in maxWidthPx, so the bar always lands on
// a human-readable number. Switches units automatically (e.g. "500 m"
// → "1 km" once the segment is ≥ 1000 m).
//
// Visual: monoLabel text above a hairline with two short end-ticks.
// Left-aligned. Static — no animation; recomputes on prop change.

import { useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Unit = 'metric' | 'imperial'

type Props = {
  centerLat: number
  zoom: number
  maxWidthPx: number
  unit?: Unit
  style?: StyleProp<ViewStyle>
}

// Earth circumference at the equator in metres / pixels at zoom 0
// for a 256-px tile. Standard web-mercator constant.
const EARTH_CIRC_M = 40_075_016.686
const TILE_PX = 256

function metresPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRC_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * Math.pow(2, zoom))
}

// "Nice" target distances in metres. We pick the largest one whose
// pixel width is ≤ maxWidthPx.
const NICE_METRES = [
  1, 2, 5, 10, 25, 50, 100, 200, 500,
  1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000, 200_000, 500_000,
  1_000_000, 2_000_000, 5_000_000,
]
const M_PER_MILE = 1609.344
const M_PER_FOOT = 0.3048
const NICE_FEET = [10, 25, 50, 100, 250, 500, 1000, 2000]
const NICE_MILES = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000]

type Pick = { label: string; widthPx: number }

function pickMetric(mpp: number, maxWidthPx: number): Pick {
  let best: Pick = { label: '1 m', widthPx: 1 / mpp }
  for (const m of NICE_METRES) {
    const w = m / mpp
    if (w > maxWidthPx) break
    best = { label: m >= 1000 ? `${m / 1000} km` : `${m} m`, widthPx: w }
  }
  return best
}

function pickImperial(mpp: number, maxWidthPx: number): Pick {
  let best: Pick = { label: '1 ft', widthPx: M_PER_FOOT / mpp }
  for (const ft of NICE_FEET) {
    const w = (ft * M_PER_FOOT) / mpp
    if (w > maxWidthPx) break
    best = { label: `${ft} ft`, widthPx: w }
  }
  for (const mi of NICE_MILES) {
    const w = (mi * M_PER_MILE) / mpp
    if (w > maxWidthPx) break
    best = { label: `${mi} mi`, widthPx: w }
  }
  return best
}

export function ScaleBar({ centerLat, zoom, maxWidthPx, unit = 'metric', style }: Props) {
  const { label, widthPx } = useMemo(() => {
    const mpp = metresPerPixel(centerLat, zoom)
    return unit === 'metric' ? pickMetric(mpp, maxWidthPx) : pickImperial(mpp, maxWidthPx)
  }, [centerLat, zoom, maxWidthPx, unit])

  return (
    <View style={[styles.wrap, style]}>
      <Text variant="monoLabel" color={theme.colors.text.muted}>
        {label}
      </Text>
      <View style={[styles.bar, { width: widthPx }]}>
        <View style={styles.tickLeft} />
        <View style={styles.line} />
        <View style={styles.tickRight} />
      </View>
    </View>
  )
}

const TICK_H = 6
const LINE_H = 1

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
    alignSelf: 'flex-start',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: TICK_H,
  },
  tickLeft: {
    width: 1,
    height: TICK_H,
    backgroundColor: theme.colors.text.muted,
  },
  tickRight: {
    width: 1,
    height: TICK_H,
    backgroundColor: theme.colors.text.muted,
  },
  line: {
    flex: 1,
    height: LINE_H,
    backgroundColor: theme.colors.text.muted,
    marginBottom: 0,
  },
})
