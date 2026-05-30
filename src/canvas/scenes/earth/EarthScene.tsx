// src/canvas/scenes/earth/EarthScene.tsx
//
// Earth scene — Level 1 in the canvas tier. Renders the textured globe with
// geographically-clustered stream pins and exposes its seam to React via
// callbacks. See DESIGN.md 0.3 / 0.6 / 0.7.
//
// What lives here (canvas layer):
//   - GLView mount + Three.js scene/camera/renderer lifecycle
//   - Earth sphere mesh + 8K texture
//   - Pin sprite pool (DataTexture-baked colors + count glyphs)
//   - Geographic clustering of streams
//   - PanResponder camera controls (drag-rotate, pinch-zoom, inertia)
//   - Auto-rotation when idle, GPS auto-orient on first fix
//   - Raycaster tap-to-pick
//
// What does NOT live here (React layer, owned by GlobeScreen):
//   - Banner / tap-to-preview card / Mapbox overlay / empty state
//   - Stream data fetch (`useStreamsNear` hook)
//   - Location fetch (`useLocation` hook)
//
// Internal granularity (Globe / Pin / lighting / controls files) is
// deliberately deferred until a second scene exists to extract from —
// per the reuse rule (DESIGN.md 0.5). For now this scene lives as a
// single file.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Dimensions, PanResponder, StyleSheet, View } from 'react-native'
import { Asset } from 'expo-asset'
import { GLView } from 'expo-gl'
import type { ExpoWebGLRenderingContext } from 'expo-gl'
import * as THREE from 'three'
import { Renderer, loadAsync } from 'expo-three'
import type { Stream } from '@/types'

/** Zoom-depth position of this scene. Earth sits at Level 1; a hypothetical
 *  system view above it would be Level 0; a venue inside Earth would be
 *  Level 2. See DESIGN.md 0.3. */
export const LEVEL = 1

const EARTH_ASSET = require('./assets/textures/earth-8k.jpg')
let earthTexture: THREE.Texture | null = null

const POOL_SIZE = 30
const MAPBOX_ACTIVATE_Z = 1.5

type GeoCluster = { streams: Stream[]; centroidLat: number; centroidLng: number }

// 5×7 bitmap glyphs for digits and '+', encoded as row bitmasks (MSB = leftmost pixel)
const GLYPH: Record<string, number[]> = {
  '0': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
  '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  '+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
}

// Builds a DataTexture for a pin entirely in JS — no DOM canvas, works in expo-gl.
// Circle fill + white border ring + soft quadratic glow halo.
// Cluster pins also have the count baked in via a pixel-font rasteriser.
//
// Pin color conflict (#5B8CFF cluster / #FF3B5C single) is flagged in
// DESIGN.md Section 3 → Pin.ts entry; resolution lands in sub-phase 12.2
// once Ben signs off on the principle direction. For now: unchanged
// behavior — same colors as before extraction.
// Light-mode pin treatment per 12.3 references-derived theme:
// - Both cluster + single pins use the single accent (warm crimson red).
//   Cluster vs single differentiated by SIZE + COUNT, never color.
// - Border is cream (matches paper background) — pin "punches through".
// - Glow halo uses the accent at low alpha.
// Pin code lives inline in EarthScene per the within-scene reuse-rule
// (see DESIGN.md Section 3 "Pin" entry); colors will route through
// `src/canvas/stage/tokens.ts` when the canvas-stage bridge wires up
// in 12.5.
function makePinTexture(count: number): THREE.DataTexture {
  const S = 96
  const cx = S / 2, cy = S / 2
  const isCluster = count > 1
  const circleR = isCluster ? 26 : 18
  const borderR = circleR + 2
  const glowR   = borderR + 14
  // Single accent — warm crimson red #d92e3a (theme.colors.accent.default)
  const fr = 0xd9, fg = 0x2e, fb = 0x3a
  // Cream border (matches paper background) — pin "punches through"
  // text.inverse / bg.primary = #ece6d6
  const br = 0xec, bg = 0xe6, bb = 0xd6
  const data = new Uint8Array(S * S * 4)

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - cx, dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      const i = (y * S + x) * 4
      if (d <= circleR) {
        data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = 255
      } else if (d <= borderR) {
        data[i] = br; data[i+1] = bg; data[i+2] = bb; data[i+3] = 255
      } else if (d < glowR) {
        const t = (glowR - d) / (glowR - borderR)
        const a = Math.round(t * t * 120)
        data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = a
      }
    }
  }

  if (isCluster) {
    const label = count >= 10 ? '9+' : String(count)
    const GW = 5, GH = 7, SC = 3
    const totalW = label.length * (GW + 1) * SC - SC
    const ox = Math.floor(cx - totalW / 2)
    const oy = Math.floor(cy - (GH * SC) / 2)
    for (let ci = 0; ci < label.length; ci++) {
      const rows = GLYPH[label[ci]!]
      if (!rows) continue
      for (let row = 0; row < GH; row++) {
        for (let col = 0; col < GW; col++) {
          if (!((rows[row]! >> (GW - 1 - col)) & 1)) continue
          for (let sy = 0; sy < SC; sy++) {
            for (let sx = 0; sx < SC; sx++) {
              const px = ox + ci * (GW + 1) * SC + col * SC + sx
              const py = oy + (GH - 1 - row) * SC + sy
              if (px < 0 || px >= S || py < 0 || py >= S) continue
              const i = (py * S + px) * 4
              // Cream glyph (matches paper background; reads on red fill)
              data[i] = 0xec; data[i+1] = 0xe6; data[i+2] = 0xd6; data[i+3] = 255
            }
          }
        }
      }
    }
  }

  const tex = new THREE.DataTexture(data, S, S)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

function latLngToVec3(lat: number, lng: number, r = 1.001): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

function haversineRad(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * (Math.PI / 180)
  const φ2 = lat2 * (Math.PI / 180)
  const Δφ = (lat2 - lat1) * (Math.PI / 180)
  const Δλ = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildGeoClusters(streams: Stream[], cameraZ: number): GeoCluster[] {
  if (streams.length === 0) return []
  const t = Math.max(0, Math.min(1, (cameraZ - 1.15) / (8 - 1.15)))
  const threshold = 0.01 + t * 0.17
  const assigned = new Set<number>()
  const groups: GeoCluster[] = []
  for (let i = 0; i < streams.length; i++) {
    const si = streams[i]
    if (!si || assigned.has(i) || si.lat == null || si.lng == null) continue
    const group: GeoCluster = { streams: [si], centroidLat: si.lat, centroidLng: si.lng }
    assigned.add(i)
    for (let j = i + 1; j < streams.length; j++) {
      const sj = streams[j]
      if (!sj || assigned.has(j) || sj.lat == null || sj.lng == null) continue
      if (haversineRad(group.centroidLat, group.centroidLng, sj.lat, sj.lng) < threshold) {
        const n = group.streams.length
        group.centroidLat = (group.centroidLat * n + sj.lat) / (n + 1)
        group.centroidLng = (group.centroidLng * n + sj.lng) / (n + 1)
        group.streams.push(sj)
        assigned.add(j)
      }
    }
    groups.push(group)
  }
  return groups
}

// ─── Component ───────────────────────────────────────────────────────────────

export type EarthSceneProps = {
  /** Live streams to render as pins. */
  streams: Stream[]
  /** Last known device coordinates, for auto-orient on first fix. `null` if
   *  permission denied or fix not yet acquired. */
  coords: { latitude: number; longitude: number } | null
  /** Fired when the user taps a single-stream pin. */
  onPinTap: (stream: Stream) => void
  /** Fired when the user taps a multi-stream cluster pin. */
  onClusterTap: (streams: Stream[]) => void
  /** Fired when the user pinch-zooms past the deepest scene zoom. The
   *  `center` is the world lat/lng under the camera at release time, suitable
   *  for handing off to a deeper scene (e.g. street-level map). */
  onDeepZoom: (center: { lat: number; lng: number }) => void
  /** When true (e.g. an overlay scene is active), touch input is ignored.
   *  On true→false transition, the camera resets to just outside the
   *  deep-zoom threshold so it doesn't immediately re-trigger handoff. */
  disabled?: boolean
}

export function EarthScene({
  streams,
  coords,
  onPinTap,
  onClusterTap,
  onDeepZoom,
  disabled = false,
}: EarthSceneProps) {
  // Latest callback refs so the PanResponder closure always sees current props.
  const onPinTapRef = useRef(onPinTap)
  const onClusterTapRef = useRef(onClusterTap)
  const onDeepZoomRef = useRef(onDeepZoom)
  const disabledRef = useRef(disabled)
  useEffect(() => { onPinTapRef.current = onPinTap }, [onPinTap])
  useEffect(() => { onClusterTapRef.current = onClusterTap }, [onClusterTap])
  useEffect(() => { onDeepZoomRef.current = onDeepZoom }, [onDeepZoom])
  useEffect(() => { disabledRef.current = disabled }, [disabled])

  // Three.js refs
  const globeGroupRef = useRef<THREE.Group | null>(null)
  const spritePoolRef = useRef<THREE.Sprite[]>([])
  const textureCacheRef = useRef<Map<string, THREE.DataTexture>>(new Map())
  const clustersRef = useRef<GeoCluster[]>([])
  const clusterLocalPosRef = useRef<THREE.Vector3[]>([])
  const clusterIsMultiRef = useRef<boolean[]>([])
  const lastClusteredZRef = useRef(-1)
  const lastStreamCountRef = useRef(-1)
  const streamsRef = useRef<Stream[]>([])
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rafRef = useRef<number | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const setupGenRef = useRef(0)
  const cameraZRef = useRef(3)
  // Default to central Europe (48°N 10°E) until GPS arrives
  const savedRotationRef = useRef({
    x: 48 * (Math.PI / 180),
    y: -(10 + 90) * (Math.PI / 180),
  })
  const hasOrientedRef = useRef(false)
  const hasInteractedRef = useRef(false)
  const velocityRef = useRef({ x: 0, y: 0 })

  const containerSizeRef = useRef({ width: Dimensions.get('window').width, height: Dimensions.get('window').height })
  const lastPanRef = useRef({ dx: 0, dy: 0 })
  const lastPinchDistRef = useRef<number | null>(null)
  const coordsRef = useRef(coords)
  const prevDisabledRef = useRef(disabled)

  useEffect(() => { coordsRef.current = coords }, [coords])

  // Sync stream data into the animation loop's view of the world.
  streamsRef.current = streams
  useEffect(() => { lastStreamCountRef.current = -1 }, [streams])

  // GPS auto-orient: rotate to user's location on first fix.
  useEffect(() => {
    if (!coords || hasOrientedRef.current) return
    const group = globeGroupRef.current
    if (!group) return
    hasOrientedRef.current = true
    const rotY = -(coords.longitude + 90) * (Math.PI / 180)
    const rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, coords.latitude * (Math.PI / 180)))
    group.rotation.y = rotY; group.rotation.x = rotX
    savedRotationRef.current = { x: rotX, y: rotY }
  }, [coords])

  // When the seam closes (disabled true → false), reset camera just outside
  // the deep-zoom threshold so user pan doesn't immediately re-fire onDeepZoom.
  useEffect(() => {
    if (prevDisabledRef.current && !disabled && cameraRef.current) {
      cameraRef.current.position.z = MAPBOX_ACTIVATE_Z + 0.02
      cameraZRef.current = MAPBOX_ACTIVATE_Z + 0.02
    }
    prevDisabledRef.current = disabled
  }, [disabled])

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      try { rendererRef.current?.dispose() } catch {}
      rendererRef.current = null
      textureCacheRef.current.forEach(t => { try { t.dispose() } catch {} })
      textureCacheRef.current.clear()
    }
  }, [])

  // ── GL scene bootstrap ─────────────────────────────────────────────────────
  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    try { rendererRef.current?.dispose() } catch {}
    rendererRef.current = null

    const gen = ++setupGenRef.current

    spritePoolRef.current.forEach(s => { try { (s.material as THREE.Material).dispose() } catch {} })
    spritePoolRef.current = []
    textureCacheRef.current.forEach(t => { try { t.dispose() } catch {} })
    textureCacheRef.current.clear()
    clustersRef.current = []
    clusterLocalPosRef.current = []
    clusterIsMultiRef.current = []
    lastClusteredZRef.current = -1
    lastStreamCountRef.current = -1
    globeGroupRef.current = null
    cameraRef.current = null

    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl
    let renderer: InstanceType<typeof Renderer>
    try {
      renderer = new Renderer({ gl })
    } catch {
      // GL context not ready (e.g. tab mounted in background). expo-gl will
      // fire onContextCreate again once the context is restored.
      return
    }
    renderer.setSize(w, h)
    // Cream paper background — matches theme.colors.bg.primary (#ece6d6).
    // The scene reads as a printed atlas / cartographic plate.
    renderer.setClearColor(0xece6d6)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100)
    camera.position.z = cameraZRef.current
    cameraRef.current = camera

    const group = new THREE.Group()
    group.rotation.x = savedRotationRef.current.x
    group.rotation.y = savedRotationRef.current.y
    globeGroupRef.current = group
    scene.add(group)

    // GPS may have arrived before GL setup completed — orient now if so
    if (coordsRef.current && !hasOrientedRef.current) {
      hasOrientedRef.current = true
      const c = coordsRef.current
      const rotY = -(c.longitude + 90) * (Math.PI / 180)
      const rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, c.latitude * (Math.PI / 180)))
      group.rotation.x = rotX; group.rotation.y = rotY
      savedRotationRef.current = { x: rotX, y: rotY }
    }

    const sphereGeo = new THREE.SphereGeometry(1, 64, 32)
    let earthMat: THREE.Material
    try {
      if (!earthTexture) {
        const asset = Asset.fromModule(EARTH_ASSET)
        await asset.downloadAsync()
        earthTexture = (await loadAsync(asset)) as THREE.Texture
        earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        earthTexture.minFilter = THREE.LinearFilter
      } else {
        earthTexture.needsUpdate = true
      }
      earthMat = new THREE.MeshBasicMaterial({ map: earthTexture })
    } catch {
      // Fallback color when texture fails to load — warm sepia
      // (cohesive with the cream paper background)
      earthMat = new THREE.MeshBasicMaterial({ color: 0x8c6a3d })
    }

    if (setupGenRef.current !== gen) return
    rendererRef.current = renderer
    group.add(new THREE.Mesh(sphereGeo, earthMat))

    // Pre-allocate sprite pool. SpriteMaterial with depthWrite:false so sprites
    // don't occlude each other; depthTest:true so the globe hides back-face pins.
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: true, depthWrite: false })
      const sprite = new THREE.Sprite(mat)
      sprite.visible = false
      group.add(sprite)
      spritePoolRef.current.push(sprite)
    }

    const _wp = new THREE.Vector3()
    const REF_DEPTH = 3 - 1.001

    function getOrCreateTexture(count: number): THREE.DataTexture {
      const key = count >= 10 ? '10+' : String(count)
      let tex = textureCacheRef.current.get(key)
      if (!tex) {
        tex = makePinTexture(count)
        textureCacheRef.current.set(key, tex)
      }
      return tex
    }

    function applyClusterUpdate(newClusters: GeoCluster[]) {
      clustersRef.current = newClusters
      clusterLocalPosRef.current = newClusters.map(c => latLngToVec3(c.centroidLat, c.centroidLng))
      clusterIsMultiRef.current = newClusters.map(c => c.streams.length > 1)

      newClusters.forEach((cluster, i) => {
        if (i >= spritePoolRef.current.length) return
        const sprite = spritePoolRef.current[i]!
        sprite.position.copy(clusterLocalPosRef.current[i]!)
        sprite.visible = true
        const mat = sprite.material as THREE.SpriteMaterial
        mat.map = getOrCreateTexture(cluster.streams.length)
        mat.needsUpdate = true
      })
      for (let i = newClusters.length; i < spritePoolRef.current.length; i++) {
        spritePoolRef.current[i]!.visible = false
      }
    }

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)

      const isAutoRotating = !hasInteractedRef.current
      if (isAutoRotating) group.rotation.y += 0.0008

      const vel = velocityRef.current
      if (vel.x !== 0 || vel.y !== 0) {
        group.rotation.y += vel.y
        group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + vel.x))
        savedRotationRef.current = { x: group.rotation.x, y: group.rotation.y }
        vel.x *= 0.88; vel.y *= 0.88
        if (Math.abs(vel.x) < 0.00005 && Math.abs(vel.y) < 0.00005) velocityRef.current = { x: 0, y: 0 }
      }

      group.updateWorldMatrix(false, false)

      const camZ = camera.position.z
      const streamCount = streamsRef.current.length

      if (Math.abs(camZ - lastClusteredZRef.current) > 0.12 || streamCount !== lastStreamCountRef.current) {
        lastClusteredZRef.current = camZ
        lastStreamCountRef.current = streamCount
        applyClusterUpdate(buildGeoClusters(streamsRef.current, camZ))
      }

      // Per-frame: scale sprites for constant screen size regardless of zoom.
      // Cluster pins are slightly larger than single-stream pins.
      const n = clustersRef.current.length
      for (let i = 0; i < n && i < spritePoolRef.current.length; i++) {
        const sprite = spritePoolRef.current[i]!
        sprite.getWorldPosition(_wp)
        const depth = Math.max(0.01, camZ - _wp.z)
        const base = clusterIsMultiRef.current[i] ? 0.14 : 0.10
        sprite.scale.setScalar(base * depth / REF_DEPTH)
      }

      try {
        renderer.render(scene, camera)
        gl.endFrameEXP()
      } catch {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    animate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Touch handling ─────────────────────────────────────────────────────────
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabledRef.current,
    onMoveShouldSetPanResponder: () => !disabledRef.current,
    onPanResponderGrant: () => {
      hasInteractedRef.current = true
      velocityRef.current = { x: 0, y: 0 }
      lastPanRef.current = { dx: 0, dy: 0 }
      lastPinchDistRef.current = null
    },
    onPanResponderMove: (evt, gs) => {
      const touches = evt.nativeEvent.touches
      if (touches.length === 2) {
        const dx = touches[0]!.pageX - touches[1]!.pageX
        const dy = touches[0]!.pageY - touches[1]!.pageY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDistRef.current !== null) {
          const c = cameraRef.current
          if (c) {
            c.position.z = Math.max(MAPBOX_ACTIVATE_Z, Math.min(8, c.position.z * (lastPinchDistRef.current / dist)))
            cameraZRef.current = c.position.z
          }
        }
        lastPinchDistRef.current = dist
        lastPanRef.current = { dx: gs.dx, dy: gs.dy }
      } else {
        lastPinchDistRef.current = null
        const group = globeGroupRef.current
        if (!group) return
        const ddx = gs.dx - lastPanRef.current.dx
        const ddy = gs.dy - lastPanRef.current.dy
        lastPanRef.current = { dx: gs.dx, dy: gs.dy }
        const panScale = 0.006 * ((cameraZRef.current - 1) / 5)
        group.rotation.y += ddx * panScale
        group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + ddy * panScale))
        savedRotationRef.current = { x: group.rotation.x, y: group.rotation.y }
      }
    },
    onPanResponderRelease: (_, gs) => {
      const wasPinching = lastPinchDistRef.current !== null
      lastPinchDistRef.current = null
      if (!wasPinching) {
        const moved = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy)
        if (moved < 8) {
          handleTap(gs.x0, gs.y0)
        } else {
          const scale = 0.006 * ((cameraZRef.current - 1) / 5)
          velocityRef.current = { y: gs.vx * scale * 16, x: gs.vy * scale * 16 }
        }
      } else if (cameraZRef.current <= MAPBOX_ACTIVATE_Z) {
        const { x: rotX, y: rotY } = savedRotationRef.current
        const lat = rotX * (180 / Math.PI)
        const lng = -(rotY * (180 / Math.PI)) - 90
        onDeepZoomRef.current({ lat, lng })
      }
    },
  // PanResponder reads everything from refs; safe to memoise to a stable instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  function handleTap(sx: number, sy: number) {
    const camera = cameraRef.current
    if (!camera || spritePoolRef.current.length === 0) return
    const { width, height } = containerSizeRef.current
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2((sx / width) * 2 - 1, -(sy / height) * 2 + 1), camera)
    const visible = spritePoolRef.current.filter(s => s.visible)
    const hits = raycaster.intersectObjects(visible)
    if (hits.length === 0) return
    const poolIdx = spritePoolRef.current.indexOf(hits[0]!.object as THREE.Sprite)
    const cluster = clustersRef.current[poolIdx]
    if (!cluster) return
    if (cluster.streams.length === 1) {
      const s = cluster.streams[0]
      if (s) onPinTapRef.current(s)
    } else {
      onClusterTapRef.current(cluster.streams)
    }
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout
        containerSizeRef.current = { width, height }
      }}
    >
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
    </View>
  )
}
