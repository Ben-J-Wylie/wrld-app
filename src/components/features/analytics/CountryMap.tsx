// src/components/features/analytics/CountryMap.tsx
//
// Audience-by-country choropleth — the app port of wrld-web's CountryMap.tsx.
// Reuses the @rnmapbox/maps dependency the globe already pulls in (no extra map
// lib). Colours the world's countries by viewer count over Mapbox's built-in
// `country-boundaries-v1` vector tileset, keyed on ISO 3166-1 alpha-2
// (`iso_3166_1`) — exactly what ViewerGeo stores. No GeoJSON to ship; the
// boundaries come from Mapbox.
//
// RN vs web GL JS: there is no clean `setFeatureState` in RNMapbox, so instead
// of binding per-feature state we drive `fillColor` with a data-driven `match`
// expression — one (countryCode → ramp colour) pair per country with data,
// falling back to a faint "no data" tint. The expression is rebuilt whenever
// the geo data changes (it's a useMemo over `geo`). Hover popups become a
// tap-to-select overlay (RN has no pointer hover).

import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Mapbox, { MapView, Camera, VectorSource, FillLayer, LineLayer } from '@rnmapbox/maps'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'
import type { AnalyticsGeo } from '@/api/analytics'

// Idempotent — the globe sets this too; calling again with the same token is a
// no-op, and this screen can be reached without the globe ever mounting.
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

// WRLD single-accent ramp: faint warm tint → crimson accent as viewer count
// climbs (the design system is single-accent crimson, not the web's cyan→lime).
const RAMP = ['#f2d9c4', '#e8a07f', '#df6a55', '#d92e3a'] as const
const NO_DATA = 'rgba(26,22,18,0.06)'

let regionNames: Intl.DisplayNames | null = null
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }) } catch { regionNames = null }
function countryName(cc: string): string {
  try { return regionNames?.of(cc) ?? cc } catch { return cc }
}

// Linear hex interpolation across the ramp anchors for t in [0..1].
function rampColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const pos = clamped * (RAMP.length - 1)
  const i = Math.floor(pos)
  const f = pos - i
  const a = hexToRgb(RAMP[i] ?? '#d92e3a')
  const b = hexToRgb(RAMP[Math.min(RAMP.length - 1, i + 1)] ?? '#d92e3a')
  const mix = (x: number, y: number) => Math.round(x + (y - x) * f)
  return `rgb(${mix(a[0], b[0])}, ${mix(a[1], b[1])}, ${mix(a[2], b[2])})`
}
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Single-worldview filter avoids double-drawing disputed boundaries (same as
// web). Cast through unknown — RNMapbox's FilterExpression type is narrower than
// the full Mapbox expression grammar this uses.
const WORLDVIEW = [
  'all',
  ['==', ['get', 'disputed'], 'false'],
  ['any', ['==', 'all', ['get', 'worldview']], ['in', 'US', ['get', 'worldview']]],
] as unknown as object

export function CountryMap({ geo }: { geo: AnalyticsGeo[] }) {
  const [selected, setSelected] = useState<{ code: string; viewers: number } | null>(null)
  const hasToken = !!(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

  // Build the data-driven fill colour: a `match` on iso_3166_1 → ramp colour,
  // scaled to the busiest country, with NO_DATA as the fallback. Rebuilt only
  // when the geo data changes.
  const fillColor = useMemo(() => {
    if (geo.length === 0) return NO_DATA
    const max = Math.max(1, ...geo.map((g) => g.viewers))
    const pairs: (string | string[])[] = []
    for (const g of geo) {
      pairs.push(g.countryCode.toUpperCase(), rampColor(g.viewers / max))
    }
    return ['match', ['get', 'iso_3166_1'], ...pairs, NO_DATA] as unknown as string
  }, [geo])

  const onPress = (e: { features: GeoJSON.Feature[] }) => {
    const f = e.features?.[0]
    const props = (f?.properties ?? {}) as { iso_3166_1?: string }
    const code = String(props.iso_3166_1 ?? '').toUpperCase()
    if (!code) return
    const row = geo.find((g) => g.countryCode.toUpperCase() === code)
    setSelected({ code, viewers: row?.viewers ?? 0 })
  }

  if (!hasToken) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text variant="caption" color={theme.colors.text.subtle}>
          Add EXPO_PUBLIC_MAPBOX_TOKEN to render the map
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      <MapView
        style={styles.fill}
        styleURL={Mapbox.StyleURL.Light}
        projection="mercator"
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Camera defaultSettings={{ centerCoordinate: [10, 25], zoomLevel: 0.4 }} />
        <VectorSource
          id="countries"
          url="mapbox://mapbox.country-boundaries-v1"
          onPress={onPress}
        >
          <FillLayer
            id="country-fills"
            sourceID="countries"
            sourceLayerID="country_boundaries"
            filter={WORLDVIEW as never}
            style={{ fillColor: fillColor as never, fillOpacity: 0.82 }}
          />
          <LineLayer
            id="country-borders"
            sourceID="countries"
            sourceLayerID="country_boundaries"
            filter={WORLDVIEW as never}
            style={{ lineColor: 'rgba(26,22,18,0.14)', lineWidth: 0.4 }}
          />
        </VectorSource>
      </MapView>

      {selected && (
        <View style={styles.popup} pointerEvents="none">
          <Text variant="bodyEmphasized">{countryName(selected.code)}</Text>
          <Text variant="caption" color={theme.colors.text.muted}>
            {selected.viewers > 0
              ? `${selected.viewers.toLocaleString()} viewer${selected.viewers === 1 ? '' : 's'}`
              : 'No viewers yet'}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  popup: {
    position: 'absolute',
    left: theme.spacing.sm,
    bottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.glass,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: 2,
  },
})
