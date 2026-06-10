// src/components/features/clip/SourceLocationTrail.tsx
//
// Location source view for the buffer viewer — a static mini-map of the recorded GPS
// track. If the broadcaster moved, the path renders as a "slug trail" (a line) with the
// playhead position marked; if they were stationary, it's just a pin. Fills the scrub
// field when the LOCATION source is selected. Non-interactive (the field scrubs; the map
// only displays). Uses @rnmapbox/maps, already in the dev client (the globe uses it).
// See DESIGN.md Section 3 (Buffer-trim clip editor).

import { useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Mapbox, { MapView, Camera, ShapeSource, LineLayer, CircleLayer } from '@rnmapbox/maps'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

type LngLat = [number, number]

type Props = {
  // The recorded track, oldest → newest, as [lng, lat]. Up to the playhead is enough;
  // the parent can pass the slice it wants drawn.
  path: LngLat[]
  // Current position at the playhead (defaults to the path's last point).
  position?: LngLat
  style?: StyleProp<ViewStyle>
}

const MOVE_EPS = 1e-4 // ~11m — below this the track is treated as stationary (a pin)

export function SourceLocationTrail({ path, position, style }: Props) {
  const here = position ?? (path.length ? path[path.length - 1]! : null)

  const { moved, bounds, center } = useMemo(() => {
    if (path.length === 0) return { moved: false, bounds: null, center: here }
    const lngs = path.map((p) => p[0])
    const lats = path.map((p) => p[1])
    const ne: LngLat = [Math.max(...lngs), Math.max(...lats)]
    const sw: LngLat = [Math.min(...lngs), Math.min(...lats)]
    const moved = ne[0] - sw[0] > MOVE_EPS || ne[1] - sw[1] > MOVE_EPS
    const center: LngLat = [(ne[0] + sw[0]) / 2, (ne[1] + sw[1]) / 2]
    return { moved, bounds: { ne, sw }, center }
  }, [path, here])

  const trail = useMemo(
    () => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: path } }),
    [path],
  )
  const point = useMemo(
    () =>
      here
        ? { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: here } }
        : null,
    [here],
  )

  if (!here) {
    // No track captured — a neutral placeholder rather than an empty map.
    return (
      <View style={[styles.wrap, styles.empty, style]}>
        <Icon name="map-pin" size="lg" color={theme.colors.text.subtle} />
        <Text variant="caption" color={theme.colors.text.muted}>
          No location track
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.Light}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {moved && bounds ? (
          <Camera
            bounds={{ ...bounds, paddingTop: 36, paddingBottom: 36, paddingLeft: 36, paddingRight: 36 }}
            animationDuration={0}
          />
        ) : (
          <Camera centerCoordinate={center ?? here} zoomLevel={14} animationDuration={0} />
        )}

        {moved && (
          <ShapeSource id="loc-trail" shape={trail}>
            <LineLayer
              id="loc-trail-line"
              style={{ lineColor: theme.colors.accent.default, lineWidth: 3, lineCap: 'round', lineJoin: 'round' }}
            />
          </ShapeSource>
        )}

        {point && (
          <ShapeSource id="loc-pos" shape={point}>
            <CircleLayer
              id="loc-pos-dot"
              style={{
                circleColor: theme.colors.accent.default,
                circleRadius: moved ? 6 : 8,
                circleStrokeWidth: 2,
                circleStrokeColor: theme.colors.text.inverse,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      <View style={styles.tag} pointerEvents="none">
        <Icon name="map-pin" size="sm" color={theme.colors.text.primary} />
        <Text variant="monoLabel" color={theme.colors.text.primary}>
          {moved ? 'TRAIL' : 'LOCATION'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.panelHi,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  tag: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bg.glass,
  },
})
