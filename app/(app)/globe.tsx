import { useCallback, useEffect, useRef } from 'react'
import { Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Asset } from 'expo-asset'
import { GLView } from 'expo-gl'
import type { ExpoWebGLRenderingContext } from 'expo-gl'
import * as THREE from 'three'
import { Renderer, loadAsync } from 'expo-three'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '@/lib/theme'
import { useLocation } from '@/hooks/useLocation'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import type { Stream } from '@/types'

// NASA Blue Marble Next Generation (December 2004) — 8192×4096, cloudless, ~6 MB first download
const EARTH_TEXTURE_URL =
  'https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74092/world.200412.3x8192x4096.jpg'

// Module-level texture cache — ONE download for the app lifetime.
// THREE.Texture stores image data; the actual WebGL texture is created per-renderer,
// so this is safe to reuse across GL context recreations.
let earthTexture: THREE.Texture | null = null

function latLngToVec3(lat: number, lng: number, r = 1.02): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

export default function Globe() {
  const { coords } = useLocation()
  const { data: streams } = useStreamsNear(
    coords?.latitude ?? null,
    coords?.longitude ?? null,
  )

  // ── Three.js refs ──────────────────────────────────────────────────────────
  const globeGroupRef = useRef<THREE.Group | null>(null)
  const pinMeshesRef = useRef<THREE.Mesh[]>([])
  const pinGeoRef = useRef<THREE.SphereGeometry | null>(null)
  const streamsRef = useRef<Stream[]>([])
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rafRef = useRef<number | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  // Generation counter: incremented on each onContextCreate call.
  // Async setup checks its captured gen before starting the loop; if a newer
  // call has started, this one exits without launching a second loop.
  const setupGenRef = useRef(0)
  // Persist camera zoom and globe orientation across GL context recreations
  const cameraZRef = useRef(3)
  const savedRotationRef = useRef({ x: 0, y: 0 })
  // Auto-orient to GPS once; stop idle auto-rotation after first user touch
  const hasOrientedRef = useRef(false)
  const hasInteractedRef = useRef(false)

  // ── Gesture refs ───────────────────────────────────────────────────────────
  const containerSizeRef = useRef({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  })
  const lastPanRef = useRef({ dx: 0, dy: 0 })
  const lastPinchDistRef = useRef<number | null>(null)

  // Mirror streams into a ref so callbacks always see the latest list
  streamsRef.current = streams ?? []

  // ── Pin management ─────────────────────────────────────────────────────────
  const updatePins = useCallback(() => {
    const group = globeGroupRef.current
    if (!group) return

    pinMeshesRef.current.forEach((m) => {
      group.remove(m)
      ;(m.material as THREE.Material).dispose()
      // Don't dispose geometry per-mesh — it's shared; pinGeoRef owns it
    })
    pinMeshesRef.current = []

    // Dispose the shared geometry exactly once
    if (pinGeoRef.current) {
      pinGeoRef.current.dispose()
      pinGeoRef.current = null
    }

    if (streamsRef.current.length === 0) return

    const geo = new THREE.SphereGeometry(0.028, 8, 8)
    pinGeoRef.current = geo
    streamsRef.current.forEach((s) => {
      if (s.lat == null || s.lng == null) return
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3b5c })
      const pin = new THREE.Mesh(geo, mat)
      pin.position.copy(latLngToVec3(s.lat, s.lng))
      group.add(pin)
      pinMeshesRef.current.push(pin)
    })
  }, [])

  // Sync pins whenever the streams query result changes
  useEffect(() => {
    updatePins()
  }, [streams, updatePins])

  // Orient the globe to the user's GPS location on first fix.
  // The default unrotated view shows ~90°W (Americas), so we rotate to wherever
  // the user actually is. savedRotationRef persists this across context recreations.
  useEffect(() => {
    if (!coords || hasOrientedRef.current) return
    const group = globeGroupRef.current
    if (!group) return
    hasOrientedRef.current = true
    // Longitude: shift from the default 90°W view to the user's longitude
    const rotY = -(coords.longitude + 90) * (Math.PI / 180)
    const rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, -coords.latitude * (Math.PI / 180)))
    group.rotation.y = rotY
    group.rotation.x = rotX
    savedRotationRef.current = { x: rotX, y: rotY }
  }, [coords])

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      try { rendererRef.current?.dispose() } catch {}
      rendererRef.current = null
    }
  }, [])

  // ── GL scene bootstrap ─────────────────────────────────────────────────────
  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      // Stop any running loop and dispose the old renderer before creating a
      // new one. Android recreates the GL surface (and calls onContextCreate
      // again) when the screen is covered, without unmounting the component.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      try { rendererRef.current?.dispose() } catch {}
      rendererRef.current = null

      // Capture this setup's generation. If onContextCreate fires again while
      // we're still inside an await, the newer call increments setupGenRef and
      // this call bails before launching a loop.
      const gen = ++setupGenRef.current

      globeGroupRef.current = null
      pinMeshesRef.current = []
      cameraRef.current = null

      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl

      const renderer = new Renderer({ gl })
      renderer.setSize(w, h)
      renderer.setClearColor(0x0a0a0f)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
      camera.position.z = cameraZRef.current
      cameraRef.current = camera

      const group = new THREE.Group()
      group.rotation.x = savedRotationRef.current.x
      group.rotation.y = savedRotationRef.current.y
      globeGroupRef.current = group
      scene.add(group)

      // Earth sphere — MeshBasicMaterial avoids PBR shader compilation issues
      // on Expo GL remount. NASA textures have baked-in lighting so it looks identical.
      const sphereGeo = new THREE.SphereGeometry(1, 64, 32)
      let earthMat: THREE.Material
      try {
        if (!earthTexture) {
          const asset = Asset.fromURI(EARTH_TEXTURE_URL)
          await asset.downloadAsync()
          earthTexture = (await loadAsync(asset)) as THREE.Texture
        } else {
          // Force the new renderer to re-upload the image to the new GL context
          earthTexture.needsUpdate = true
        }
        earthMat = new THREE.MeshBasicMaterial({ map: earthTexture })
      } catch (err) {
        console.error('[Globe] texture load failed:', err)
        earthMat = new THREE.MeshBasicMaterial({ color: 0x1a5588 })
      }

      // A newer context setup has started — don't launch a stale loop
      if (setupGenRef.current !== gen) return

      rendererRef.current = renderer
      group.add(new THREE.Mesh(sphereGeo, earthMat))

      // Add any pins that arrived before the scene was ready
      updatePins()

      const animate = () => {
        rafRef.current = requestAnimationFrame(animate)
        if (!hasInteractedRef.current) {
          group.rotation.y += 0.0008
        }
        try {
          renderer.render(scene, camera)
          gl.endFrameEXP()
        } catch {
          // GL surface was destroyed; stop looping until onContextCreate fires again
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      }
      animate()
    },
    [updatePins],
  )

  // ── Touch handling ─────────────────────────────────────────────────────────
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      hasInteractedRef.current = true
      lastPanRef.current = { dx: 0, dy: 0 }
      lastPinchDistRef.current = null
    },
    onPanResponderMove: (evt, gs) => {
      const touches = evt.nativeEvent.touches
      if (touches.length === 2) {
        // ── Pinch-to-zoom ──────────────────────────────────────────────────
        const dx = touches[0].pageX - touches[1].pageX
        const dy = touches[0].pageY - touches[1].pageY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDistRef.current !== null) {
          const camera = cameraRef.current
          if (camera) {
            const newZ = Math.max(1.1, Math.min(8, camera.position.z * (lastPinchDistRef.current / dist)))
            camera.position.z = newZ
            cameraZRef.current = newZ
          }
        }
        lastPinchDistRef.current = dist
        // Reset drag origin so single-finger pan doesn't jump when pinch ends
        lastPanRef.current = { dx: gs.dx, dy: gs.dy }
      } else {
        // ── Single-finger rotate ───────────────────────────────────────────
        lastPinchDistRef.current = null
        const group = globeGroupRef.current
        if (!group) return
        const ddx = gs.dx - lastPanRef.current.dx
        const ddy = gs.dy - lastPanRef.current.dy
        lastPanRef.current = { dx: gs.dx, dy: gs.dy }
        group.rotation.y += ddx * 0.006
        group.rotation.x = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, group.rotation.x + ddy * 0.006),
        )
        savedRotationRef.current = { x: group.rotation.x, y: group.rotation.y }
      }
    },
    onPanResponderRelease: (_, gs) => {
      const wasPinching = lastPinchDistRef.current !== null
      lastPinchDistRef.current = null
      if (!wasPinching) {
        const moved = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy)
        if (moved < 8) handleTap(gs.x0, gs.y0)
      }
    },
  })

  function handleTap(sx: number, sy: number) {
    const camera = cameraRef.current
    if (!camera || pinMeshesRef.current.length === 0) return
    const { width, height } = containerSizeRef.current
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(
      new THREE.Vector2((sx / width) * 2 - 1, -(sy / height) * 2 + 1),
      camera,
    )
    const hits = raycaster.intersectObjects(pinMeshesRef.current)
    if (hits.length > 0) {
      const idx = pinMeshesRef.current.indexOf(hits[0].object as THREE.Mesh)
      const stream = streamsRef.current[idx]
      if (stream?.mediasoupRoomId) {
        router.push(`/(app)/stream/${stream.mediasoupRoomId}`)
      }
    }
  }

  const liveCount = streams?.length ?? 0

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        containerSizeRef.current = { width, height }
      }}
    >
      {/* GL layer */}
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />

      {/* Transparent touch-capture layer */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* UI overlay — pointerEvents="none" so touches fall through to the pan layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>WRLD</Text>
            {liveCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{liveCount} LIVE</Text>
              </View>
            )}
          </View>
          {liveCount === 0 && coords && (
            <View style={styles.center}>
              <Text style={styles.hint}>No live streams nearby</Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  wordmark: { ...theme.typography.title, color: theme.colors.text },
  badge: {
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...theme.typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { ...theme.typography.body, color: theme.colors.textMuted },
})
