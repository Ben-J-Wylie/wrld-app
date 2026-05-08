import { useCallback, useEffect, useRef } from 'react'
import { Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { GLView } from 'expo-gl'
import type { ExpoWebGLRenderingContext } from 'expo-gl'
import * as THREE from 'three'
import { Renderer, loadAsync } from 'expo-three'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from '@/lib/theme'
import { useLocation } from '@/hooks/useLocation'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import type { Stream } from '@/types'

// NASA Blue Marble cloudless — same source, no cloud layer
const EARTH_TEXTURE_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/land_ocean_ice_2048.jpg'

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

  // ── Three.js refs (survive re-renders without triggering them) ─────────────
  const globeGroupRef = useRef<THREE.Group | null>(null)
  const pinMeshesRef = useRef<THREE.Mesh[]>([])
  const streamsRef = useRef<Stream[]>([])
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rafRef = useRef<number | null>(null)

  // ── Gesture refs ───────────────────────────────────────────────────────────
  const containerSizeRef = useRef({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  })
  const isDraggingRef = useRef(false)
  const lastPanRef = useRef({ dx: 0, dy: 0 })

  // Mirror streams into a ref so callbacks always see the latest list
  streamsRef.current = streams ?? []

  // ── Pin management ─────────────────────────────────────────────────────────
  const updatePins = useCallback(() => {
    const group = globeGroupRef.current
    if (!group) return

    pinMeshesRef.current.forEach((m) => {
      group.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    })
    pinMeshesRef.current = []

    const geo = new THREE.SphereGeometry(0.028, 8, 8)
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

  // Cancel the render loop on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── GL scene bootstrap ─────────────────────────────────────────────────────
  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl

      const renderer = new Renderer({ gl })
      renderer.setSize(w, h)
      renderer.setClearColor(0x0a0a0f)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
      camera.position.z = 3
      cameraRef.current = camera

      scene.add(new THREE.AmbientLight(0xffffff, 0.55))
      const sun = new THREE.DirectionalLight(0xffffff, 0.9)
      sun.position.set(5, 3, 5)
      scene.add(sun)

      const group = new THREE.Group()
      globeGroupRef.current = group
      scene.add(group)

      // Earth sphere — load remote texture, fall back to a flat blue if it fails
      const sphereGeo = new THREE.SphereGeometry(1, 64, 32)
      let earthMat: THREE.Material
      try {
        const texture = (await loadAsync(EARTH_TEXTURE_URL)) as THREE.Texture
        earthMat = new THREE.MeshStandardMaterial({ map: texture })
      } catch {
        earthMat = new THREE.MeshStandardMaterial({ color: 0x1a5588 })
      }
      group.add(new THREE.Mesh(sphereGeo, earthMat))

      // Add any pins that arrived before the scene was ready
      updatePins()

      const animate = () => {
        rafRef.current = requestAnimationFrame(animate)
        if (!isDraggingRef.current) {
          group.rotation.y += 0.0008
        }
        renderer.render(scene, camera)
        gl.endFrameEXP()
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
      isDraggingRef.current = false
      lastPanRef.current = { dx: 0, dy: 0 }
    },
    onPanResponderMove: (_, gs) => {
      const group = globeGroupRef.current
      if (!group) return
      isDraggingRef.current = true
      const ddx = gs.dx - lastPanRef.current.dx
      const ddy = gs.dy - lastPanRef.current.dy
      lastPanRef.current = { dx: gs.dx, dy: gs.dy }
      group.rotation.y += ddx * 0.006
      group.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, group.rotation.x + ddy * 0.006),
      )
    },
    onPanResponderRelease: (_, gs) => {
      const wasDrag = isDraggingRef.current
      isDraggingRef.current = false
      if (!wasDrag) handleTap(gs.x0, gs.y0)
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
