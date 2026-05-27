import { Animated, ActivityIndicator, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { consumeStreamSignal } from '@/lib/streamSignals'
import { streamsApi } from '@/api/streams'
import { Asset } from 'expo-asset'
import { GLView } from 'expo-gl'
import type { ExpoWebGLRenderingContext } from 'expo-gl'
import * as THREE from 'three'
import { Renderer, loadAsync } from 'expo-three'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/lib/theme'
import { useLocation } from '@/hooks/useLocation'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import { Avatar } from '@/components/feature/user/Avatar'
import type { Stream } from '@/types'

// Bundled 8192×4096 earth texture (Solar System Scope, free for commercial use)
const EARTH_ASSET = require('../../assets/images/earth.jpg')

// Module-level texture cache — loaded once, reused across GL context recreations.
let earthTexture: THREE.Texture | null = null

// Pool constants
const MESH_POOL_SIZE = 30
const MAX_BADGES = 30
const BADGE_SIZE = 26
// Pixel distance between pin screen centres to be considered overlapping
const CLUSTER_RADIUS_PX = 40

type ClusterGroup = {
  streams: Stream[]
  centroidLat: number
  centroidLng: number
  screenX: number
  screenY: number
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

// Projects all streams to screen space and groups nearby ones into clusters.
// Streams on the back face of the globe are silently excluded.
function computeScreenClusters(
  streams: Stream[],
  camera: THREE.PerspectiveCamera,
  group: THREE.Group,
  width: number,
  height: number,
): ClusterGroup[] {
  if (streams.length === 0) return []

  const thresholdSq = CLUSTER_RADIUS_PX * CLUSTER_RADIUS_PX

  // Project each stream to screen coords; null = back face or no coords
  const screenPts: ({ x: number; y: number } | null)[] = streams.map((s) => {
    if (s.lat == null || s.lng == null) return null
    const v = latLngToVec3(s.lat, s.lng)
    v.applyMatrix4(group.matrixWorld)
    // Cull back face: visible if worldPos.z > 1 / cameraZ
    if (v.z < 1 / camera.position.z) return null
    v.project(camera)
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height }
  })

  const assigned = new Set<number>()
  const clusters: ClusterGroup[] = []

  for (let i = 0; i < streams.length; i++) {
    const si = streams[i]
    const spi = screenPts[i]
    if (assigned.has(i) || !si || !spi) continue
    const cStreams: Stream[] = [si]
    const cPts: { x: number; y: number }[] = [spi]
    assigned.add(i)

    for (let j = i + 1; j < streams.length; j++) {
      const sj = streams[j]
      const spj = screenPts[j]
      if (assigned.has(j) || !sj || !spj) continue
      // Distance from stream j to current cluster centroid
      const cx = cPts.reduce((s, p) => s + p.x, 0) / cPts.length
      const cy = cPts.reduce((s, p) => s + p.y, 0) / cPts.length
      const dx = spj.x - cx
      const dy = spj.y - cy
      if (dx * dx + dy * dy < thresholdSq) {
        cStreams.push(sj)
        cPts.push(spj)
        assigned.add(j)
      }
    }

    const cx = cPts.reduce((s, p) => s + p.x, 0) / cPts.length
    const cy = cPts.reduce((s, p) => s + p.y, 0) / cPts.length
    const centroidLat = cStreams.reduce((s, st) => s + st.lat, 0) / cStreams.length
    const centroidLng = cStreams.reduce((s, st) => s + st.lng, 0) / cStreams.length
    clusters.push({ streams: cStreams, centroidLat, centroidLng, screenX: cx, screenY: cy })
  }

  return clusters
}

export default function Globe() {
  const { coords } = useLocation()
  const { data: streams } = useStreamsNear(
    coords?.latitude ?? null,
    coords?.longitude ?? null,
  )

  const insets = useSafeAreaInsets()

  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<ClusterGroup | null>(null)

  type BannerData =
    | { kind: 'disconnected'; broadcasterHandle: string | null }
    | { kind: 'ended' }
    | { kind: 'resumed'; stream: Stream; broadcasterHandle: string | null }
  const [banner, setBanner] = useState<BannerData | null>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bannerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const coordsRef = useRef(coords)

  // Badge counts drive the text content; positions are updated imperatively via Animated.Value
  const [badgeCounts, setBadgeCounts] = useState<number[]>([])
  const badgeXAnims = useRef(Array.from({ length: MAX_BADGES }, () => new Animated.Value(0))).current
  const badgeYAnims = useRef(Array.from({ length: MAX_BADGES }, () => new Animated.Value(0))).current
  const badgeOpacities = useRef(Array.from({ length: MAX_BADGES }, () => new Animated.Value(0))).current
  const prevBadgeCountsRef = useRef<number[]>([])

  useEffect(() => { coordsRef.current = coords }, [coords])

  useFocusEffect(
    useCallback(() => {
      const signal = consumeStreamSignal()
      if (!signal) return
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      if (bannerPollRef.current) clearInterval(bannerPollRef.current)
      if (signal.kind === 'ended') {
        setBanner({ kind: 'ended' })
      } else {
        setBanner({ kind: 'disconnected', broadcasterHandle: signal.broadcasterHandle })
      }
    }, []),
  )

  // Auto-dismiss 'ended' banner after 8s
  useEffect(() => {
    if (!banner || banner.kind !== 'ended') return
    bannerTimerRef.current = setTimeout(() => setBanner(null), 8000)
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }
  }, [banner?.kind])

  // Poll for broadcaster reconnect when banner is 'disconnected'
  useEffect(() => {
    if (!banner || banner.kind !== 'disconnected') return
    const { broadcasterHandle } = banner

    if (!broadcasterHandle) {
      bannerTimerRef.current = setTimeout(() => setBanner(null), 5 * 60 * 1000)
      return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }
    }

    let polls = 0
    bannerPollRef.current = setInterval(async () => {
      polls++
      if (polls > 30) {
        clearInterval(bannerPollRef.current!)
        bannerPollRef.current = null
        setBanner(null)
        return
      }
      const c = coordsRef.current
      if (!c) return
      try {
        const nearby = await streamsApi.near(c.latitude, c.longitude)
        const resumed = nearby.find(
          (s) => s.host?.handle === broadcasterHandle && s.isLive && s.mediasoupRoomId,
        )
        if (resumed?.mediasoupRoomId) {
          clearInterval(bannerPollRef.current!)
          bannerPollRef.current = null
          setBanner({ kind: 'resumed', stream: resumed, broadcasterHandle })
        }
      } catch {}
    }, 10_000)

    return () => {
      if (bannerPollRef.current) {
        clearInterval(bannerPollRef.current)
        bannerPollRef.current = null
      }
    }
  }, [banner?.kind])

  function dismissBanner() {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    if (bannerPollRef.current) clearInterval(bannerPollRef.current)
    setBanner(null)
  }

  function handleBannerTap() {
    if (!banner || banner.kind !== 'resumed' || !banner.stream.mediasoupRoomId) return
    const { stream } = banner
    dismissBanner()
    router.push({
      pathname: `/(app)/stream/${stream.mediasoupRoomId}`,
      params: { streamId: stream.id, sources: stream.sources.join(',') },
    })
  }

  // Keep selectedStream fresh when streams update
  useEffect(() => {
    if (!selectedStream || !streams) return
    const updated = streams.find((s) => s.id === selectedStream.id)
    if (!updated) {
      setSelectedStream(null)
    } else if (updated !== selectedStream) {
      setSelectedStream(updated)
    }
  }, [streams])

  // Keep selectedCluster fresh when streams update
  useEffect(() => {
    if (!selectedCluster || !streams) return
    const updated = selectedCluster.streams
      .map((s) => streams.find((x) => x.id === s.id))
      .filter((s): s is Stream => s != null)
    if (updated.length === 0) {
      setSelectedCluster(null)
    } else {
      setSelectedCluster((prev) => prev ? { ...prev, streams: updated } : null)
    }
  }, [streams])

  // ── Three.js refs ──────────────────────────────────────────────────────────
  const globeGroupRef = useRef<THREE.Group | null>(null)
  const meshPoolRef = useRef<THREE.Mesh[]>([])
  const pinGeoRef = useRef<THREE.SphereGeometry | null>(null)
  const clustersRef = useRef<ClusterGroup[]>([])
  const streamsRef = useRef<Stream[]>([])
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rafRef = useRef<number | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const setupGenRef = useRef(0)
  const cameraZRef = useRef(3)
  const savedRotationRef = useRef({ x: 0, y: 0 })
  const hasOrientedRef = useRef(false)
  const hasInteractedRef = useRef(false)
  const velocityRef = useRef({ x: 0, y: 0 })

  // ── Gesture refs ───────────────────────────────────────────────────────────
  const containerSizeRef = useRef({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  })
  const lastPanRef = useRef({ dx: 0, dy: 0 })
  const lastPinchDistRef = useRef<number | null>(null)

  streamsRef.current = streams ?? []

  // Orient the globe to the user's GPS location on first fix
  useEffect(() => {
    if (!coords || hasOrientedRef.current) return
    const group = globeGroupRef.current
    if (!group) return
    hasOrientedRef.current = true
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
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      try { rendererRef.current?.dispose() } catch {}
      rendererRef.current = null

      const gen = ++setupGenRef.current

      // Clean up previous pool resources
      meshPoolRef.current.forEach((m) => {
        try { (m.material as THREE.Material).dispose() } catch {}
      })
      meshPoolRef.current = []
      if (pinGeoRef.current) {
        try { pinGeoRef.current.dispose() } catch {}
        pinGeoRef.current = null
      }
      clustersRef.current = []
      prevBadgeCountsRef.current = []
      badgeOpacities.forEach((a) => a.setValue(0))

      globeGroupRef.current = null
      cameraRef.current = null

      const { drawingBufferWidth: w, drawingBufferHeight: h } = gl

      const renderer = new Renderer({ gl })
      renderer.setSize(w, h)
      renderer.setClearColor(0x0a0a0f)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100)
      camera.position.z = cameraZRef.current
      cameraRef.current = camera

      const group = new THREE.Group()
      group.rotation.x = savedRotationRef.current.x
      group.rotation.y = savedRotationRef.current.y
      globeGroupRef.current = group
      scene.add(group)

      // Earth sphere
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
      } catch (err) {
        console.error('[Globe] texture load failed:', err)
        earthMat = new THREE.MeshBasicMaterial({ color: 0x1a5588 })
      }

      if (setupGenRef.current !== gen) return

      rendererRef.current = renderer
      group.add(new THREE.Mesh(sphereGeo, earthMat))

      // Pre-allocate mesh pool — all meshes share one geometry, each has its own material
      const geo = new THREE.SphereGeometry(0.028, 8, 8)
      pinGeoRef.current = geo
      for (let i = 0; i < MESH_POOL_SIZE; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff3b5c,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -4,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.visible = false
        group.add(mesh)
        meshPoolRef.current.push(mesh)
      }

      // Reused scratch vector — allocated once per context, not per frame
      const _wp = new THREE.Vector3()
      const REF_DEPTH = 3 - 1.001

      const animate = () => {
        rafRef.current = requestAnimationFrame(animate)

        if (!hasInteractedRef.current) {
          group.rotation.y += 0.0008
        }

        const vel = velocityRef.current
        if (vel.x !== 0 || vel.y !== 0) {
          group.rotation.y += vel.y
          group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + vel.x))
          savedRotationRef.current = { x: group.rotation.x, y: group.rotation.y }
          vel.x *= 0.88
          vel.y *= 0.88
          if (Math.abs(vel.x) < 0.00005 && Math.abs(vel.y) < 0.00005) {
            velocityRef.current = { x: 0, y: 0 }
          }
        }

        // Ensure matrices are current before we project anything
        group.updateWorldMatrix(false, false)

        // Screen-space cluster computation
        const { width, height } = containerSizeRef.current
        const newClusters = computeScreenClusters(streamsRef.current, camera, group, width, height)
        clustersRef.current = newClusters

        // Update mesh pool: reposition, recolour, resize, show/hide
        const camZ = camera.position.z
        newClusters.forEach((cluster, i) => {
          if (i >= meshPoolRef.current.length) return
          const mesh = meshPoolRef.current[i]
          mesh.position.copy(latLngToVec3(cluster.centroidLat, cluster.centroidLng))
          mesh.visible = true
          const isCluster = cluster.streams.length > 1
          ;(mesh.material as THREE.MeshBasicMaterial).color.setHex(isCluster ? 0x5b8cff : 0xff3b5c)
          // Scale to maintain constant screen size; clusters are 1.55× larger
          mesh.getWorldPosition(_wp)
          const depth = Math.max(0.01, camZ - _wp.z)
          mesh.scale.setScalar((isCluster ? 1.55 : 1) * depth / REF_DEPTH)
        })
        for (let i = newClusters.length; i < meshPoolRef.current.length; i++) {
          meshPoolRef.current[i].visible = false
        }

        try {
          renderer.render(scene, camera)
          gl.endFrameEXP()
        } catch {
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
          rafRef.current = null
          return
        }

        // Update badge overlay positions after render (1-frame lag is imperceptible)
        newClusters.forEach((cluster, i) => {
          if (i >= MAX_BADGES) return
          if (cluster.streams.length <= 1) {
            badgeOpacities[i]!.setValue(0)
            return
          }
          badgeXAnims[i]!.setValue(cluster.screenX - BADGE_SIZE / 2)
          badgeYAnims[i]!.setValue(cluster.screenY - BADGE_SIZE / 2)
          badgeOpacities[i]!.setValue(1)
        })
        for (let i = newClusters.length; i < MAX_BADGES; i++) {
          badgeOpacities[i]!.setValue(0)
        }

        // Update badge count text only when cluster configuration changes
        const newCounts = newClusters.map((c) => c.streams.length)
        const countsKey = newCounts.join(',')
        const prevKey = prevBadgeCountsRef.current.join(',')
        if (countsKey !== prevKey) {
          prevBadgeCountsRef.current = newCounts
          setBadgeCounts(newCounts)
        }
      }
      animate()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ── Touch handling ─────────────────────────────────────────────────────────
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
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
          const camera = cameraRef.current
          if (camera) {
            const newZ = Math.max(1.15, Math.min(8, camera.position.z * (lastPinchDistRef.current / dist)))
            camera.position.z = newZ
            cameraZRef.current = newZ
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
        group.rotation.x = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, group.rotation.x + ddy * panScale),
        )
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
          velocityRef.current = {
            y: gs.vx * scale * 16,
            x: gs.vy * scale * 16,
          }
        }
      }
    },
  })

  function handleTap(sx: number, sy: number) {
    const camera = cameraRef.current
    if (!camera || meshPoolRef.current.length === 0) return
    const { width, height } = containerSizeRef.current
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(
      new THREE.Vector2((sx / width) * 2 - 1, -(sy / height) * 2 + 1),
      camera,
    )
    // Only raycast against visible pool meshes
    const visible = meshPoolRef.current.filter((m) => m.visible)
    const hits = raycaster.intersectObjects(visible)
    if (hits.length > 0) {
      const mesh = hits[0].object as THREE.Mesh
      // Map back to original pool index to find the cluster
      const poolIdx = meshPoolRef.current.indexOf(mesh)
      const cluster = clustersRef.current[poolIdx]
      if (cluster) {
        if (cluster.streams.length === 1) {
          const single = cluster.streams[0]
          if (single) setSelectedStream(single)
          setSelectedCluster(null)
        } else {
          setSelectedCluster(cluster)
          setSelectedStream(null)
        }
      }
    } else {
      setSelectedStream(null)
      setSelectedCluster(null)
    }
  }

  function joinSelectedStream() {
    if (!selectedStream?.mediasoupRoomId) return
    setSelectedStream(null)
    router.push({
      pathname: `/(app)/stream/${selectedStream.mediasoupRoomId}`,
      params: { streamId: selectedStream.id, sources: (selectedStream.sources ?? []).join(',') },
    })
  }

  function joinClusterStream(stream: Stream) {
    if (!stream.mediasoupRoomId) return
    setSelectedCluster(null)
    router.push({
      pathname: `/(app)/stream/${stream.mediasoupRoomId}`,
      params: { streamId: stream.id, sources: (stream.sources ?? []).join(',') },
    })
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

      {/* Cluster count badge overlays — positioned imperatively via Animated.Value each frame */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: MAX_BADGES }, (_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.badge,
              {
                opacity: badgeOpacities[i]!,
                transform: [
                  { translateX: badgeXAnims[i]! },
                  { translateY: badgeYAnims[i]! },
                ],
              },
            ]}
          >
            <Text style={styles.badgeText}>{badgeCounts[i] ?? ''}</Text>
          </Animated.View>
        ))}
      </View>

      {/* UI overlay — pointerEvents="none" so touches fall through to the pan layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>WRLD</Text>
            {liveCount > 0 && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveCount} LIVE</Text>
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

      {/* Stream reconnect banner — interactive, outside the pointerEvents="none" layer */}
      {banner && (
        <View style={[styles.bannerWrapper, { top: insets.top + 56 }]} pointerEvents="box-none">
          <Pressable
            style={[
              styles.banner,
              banner.kind === 'resumed' ? styles.bannerResumed : styles.bannerMuted,
            ]}
            onPress={banner.kind === 'resumed' ? handleBannerTap : undefined}
          >
            <View style={styles.bannerContent}>
              {banner.kind === 'disconnected' && (
                <>
                  <ActivityIndicator size="small" color={theme.colors.textMuted} style={styles.bannerSpinner} />
                  <Text style={styles.bannerText}>Stream disconnected — waiting to reconnect</Text>
                </>
              )}
              {banner.kind === 'ended' && (
                <Text style={styles.bannerText}>The stream has ended</Text>
              )}
              {banner.kind === 'resumed' && (
                <Text style={[styles.bannerText, styles.bannerTextResumed]}>Stream resumed — tap to rejoin</Text>
              )}
            </View>
            <Pressable onPress={dismissBanner} hitSlop={12} style={styles.bannerClose}>
              <Text style={styles.bannerCloseText}>✕</Text>
            </Pressable>
          </Pressable>
        </View>
      )}

      {/* Single stream card */}
      {selectedStream && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStream(null)} />
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              {selectedStream.host && (
                <Avatar
                  avatarUrl={selectedStream.host.avatarUrl}
                  displayName={selectedStream.host.displayName}
                  size={44}
                />
              )}
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={1}>{selectedStream.title}</Text>
                {selectedStream.host && (
                  <Text style={styles.cardHandle}>@{selectedStream.host.handle}</Text>
                )}
                <Text style={styles.cardMeta}>
                  {selectedStream.viewerCount} {selectedStream.viewerCount === 1 ? 'viewer' : 'viewers'}
                </Text>
              </View>
            </View>
            <Pressable style={styles.joinBtn} onPress={joinSelectedStream}>
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Cluster card — multiple streams at the same location */}
      {selectedCluster && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedCluster(null)} />
          <View style={styles.card}>
            <Text style={styles.clusterHeader}>
              {selectedCluster.streams.length} live streams here
            </Text>
            {selectedCluster.streams.map((stream) => (
              <Pressable key={stream.id} style={styles.clusterRow} onPress={() => joinClusterStream(stream)}>
                <View style={styles.cardLeft}>
                  {stream.host && (
                    <Avatar
                      avatarUrl={stream.host.avatarUrl}
                      displayName={stream.host.displayName}
                      size={38}
                    />
                  )}
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{stream.title}</Text>
                    {stream.host && (
                      <Text style={styles.cardHandle}>@{stream.host.handle}</Text>
                    )}
                    <Text style={styles.cardMeta}>
                      {stream.viewerCount} {stream.viewerCount === 1 ? 'viewer' : 'viewers'}
                    </Text>
                  </View>
                </View>
                <View style={styles.joinBtnSmall}>
                  <Text style={styles.joinBtnText}>Join</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
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
  liveBadge: {
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  liveBadgeText: {
    ...theme.typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { ...theme.typography.body, color: theme.colors.textMuted },

  // Cluster count badge (rendered as a React Native overlay above the GL layer)
  badge: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.accent,
    lineHeight: 12,
  },

  cardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  card: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  cardHandle: { ...theme.typography.caption, color: theme.colors.accent },
  cardMeta: { ...theme.typography.caption, color: theme.colors.textMuted },
  joinBtn: {
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignSelf: 'center',
  },
  joinBtnSmall: {
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  clusterHeader: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '600',
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  clusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },

  bannerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.md,
  },
  banner: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  bannerMuted: {
    backgroundColor: theme.colors.bgElevated,
    borderColor: theme.colors.border,
  },
  bannerResumed: {
    backgroundColor: '#0D2B1F',
    borderColor: theme.colors.success,
  },
  bannerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  bannerSpinner: { flexShrink: 0 },
  bannerText: { ...theme.typography.caption, color: theme.colors.textMuted, flex: 1 },
  bannerTextResumed: { color: theme.colors.success },
  bannerClose: { flexShrink: 0 },
  bannerCloseText: { ...theme.typography.caption, color: theme.colors.textMuted },
})
