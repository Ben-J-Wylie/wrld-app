import { ActivityIndicator, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
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

const EARTH_ASSET = require('../../assets/images/earth.jpg')
let earthTexture: THREE.Texture | null = null

const MESH_POOL_SIZE = 30
const BADGE_SIZE = 26

type GeoCluster = { streams: Stream[]; centroidLat: number; centroidLng: number }
type BadgeInfo = { x: number; y: number; count: number }

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

// Groups streams by geographic proximity.
// Threshold is zoom-dependent: far zoom = larger radius, close zoom = smaller.
// Runs only when zoom or streams change — NOT every frame.
function buildGeoClusters(streams: Stream[], cameraZ: number): GeoCluster[] {
  if (streams.length === 0) return []
  const t = Math.max(0, Math.min(1, (cameraZ - 1.15) / (8 - 1.15)))
  // 0.01 rad (~64 km) when close, 0.18 rad (~1150 km) when far
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

export default function Globe() {
  const { coords } = useLocation()
  const { data: streams } = useStreamsNear(
    coords?.latitude ?? null,
    coords?.longitude ?? null,
  )
  const insets = useSafeAreaInsets()

  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<GeoCluster | null>(null)

  type BannerData =
    | { kind: 'disconnected'; broadcasterHandle: string | null }
    | { kind: 'ended' }
    | { kind: 'resumed'; stream: Stream; broadcasterHandle: string | null }
  const [banner, setBanner] = useState<BannerData | null>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bannerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const coordsRef = useRef(coords)

  // Badge overlays — plain React state, updated on cluster change and throttled during motion
  const [badges, setBadges] = useState<BadgeInfo[]>([])

  useEffect(() => { coordsRef.current = coords }, [coords])

  useFocusEffect(
    useCallback(() => {
      const signal = consumeStreamSignal()
      if (!signal) return
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      if (bannerPollRef.current) clearInterval(bannerPollRef.current)
      setBanner(signal.kind === 'ended'
        ? { kind: 'ended' }
        : { kind: 'disconnected', broadcasterHandle: signal.broadcasterHandle })
    }, []),
  )

  useEffect(() => {
    if (!banner || banner.kind !== 'ended') return
    bannerTimerRef.current = setTimeout(() => setBanner(null), 8000)
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current) }
  }, [banner?.kind])

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
      if (polls > 30) { clearInterval(bannerPollRef.current!); bannerPollRef.current = null; setBanner(null); return }
      const c = coordsRef.current
      if (!c) return
      try {
        const nearby = await streamsApi.near(c.latitude, c.longitude)
        const resumed = nearby.find(s => s.host?.handle === broadcasterHandle && s.isLive && s.mediasoupRoomId)
        if (resumed?.mediasoupRoomId) {
          clearInterval(bannerPollRef.current!); bannerPollRef.current = null
          setBanner({ kind: 'resumed', stream: resumed, broadcasterHandle })
        }
      } catch {}
    }, 10_000)
    return () => { if (bannerPollRef.current) { clearInterval(bannerPollRef.current); bannerPollRef.current = null } }
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
    router.push({ pathname: `/(app)/stream/${stream.mediasoupRoomId}`, params: { streamId: stream.id, sources: stream.sources.join(',') } })
  }

  useEffect(() => {
    if (!selectedStream || !streams) return
    const updated = streams.find(s => s.id === selectedStream.id)
    if (!updated) setSelectedStream(null)
    else if (updated !== selectedStream) setSelectedStream(updated)
  }, [streams])

  useEffect(() => {
    if (!selectedCluster || !streams) return
    const updated = selectedCluster.streams.map(s => streams.find(x => x.id === s.id)).filter((s): s is Stream => s != null)
    if (updated.length === 0) setSelectedCluster(null)
    else setSelectedCluster(prev => prev ? { ...prev, streams: updated } : null)
  }, [streams])

  // ── Three.js refs ──────────────────────────────────────────────────────────
  const globeGroupRef = useRef<THREE.Group | null>(null)
  const meshPoolRef = useRef<THREE.Mesh[]>([])
  const pinGeoRef = useRef<THREE.SphereGeometry | null>(null)
  // Stable cluster data — only updated on zoom/stream change, not every frame
  const clustersRef = useRef<GeoCluster[]>([])
  // Pre-computed group-local Vector3 per cluster centroid — no per-frame allocation
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
  const savedRotationRef = useRef({ x: 0, y: 0 })
  const hasOrientedRef = useRef(false)
  const hasInteractedRef = useRef(false)
  const velocityRef = useRef({ x: 0, y: 0 })

  const containerSizeRef = useRef({ width: Dimensions.get('window').width, height: Dimensions.get('window').height })
  const lastPanRef = useRef({ dx: 0, dy: 0 })
  const lastPinchDistRef = useRef<number | null>(null)

  streamsRef.current = streams ?? []

  // Force re-cluster on next animate frame when streams data changes
  useEffect(() => { lastStreamCountRef.current = -1 }, [streams])

  useEffect(() => {
    if (!coords || hasOrientedRef.current) return
    const group = globeGroupRef.current
    if (!group) return
    hasOrientedRef.current = true
    const rotY = -(coords.longitude + 90) * (Math.PI / 180)
    const rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, -coords.latitude * (Math.PI / 180)))
    group.rotation.y = rotY; group.rotation.x = rotX
    savedRotationRef.current = { x: rotX, y: rotY }
  }, [coords])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      try { rendererRef.current?.dispose() } catch {}
      rendererRef.current = null
    }
  }, [])

  // ── GL scene bootstrap ─────────────────────────────────────────────────────
  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    try { rendererRef.current?.dispose() } catch {}
    rendererRef.current = null

    const gen = ++setupGenRef.current

    meshPoolRef.current.forEach(m => { try { (m.material as THREE.Material).dispose() } catch {} })
    meshPoolRef.current = []
    if (pinGeoRef.current) { try { pinGeoRef.current.dispose() } catch {}; pinGeoRef.current = null }
    clustersRef.current = []
    clusterLocalPosRef.current = []
    clusterIsMultiRef.current = []
    lastClusteredZRef.current = -1
    lastStreamCountRef.current = -1
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
      earthMat = new THREE.MeshBasicMaterial({ color: 0x1a5588 })
    }

    if (setupGenRef.current !== gen) return
    rendererRef.current = renderer
    group.add(new THREE.Mesh(sphereGeo, earthMat))

    // Pre-allocate mesh pool
    const geo = new THREE.SphereGeometry(0.028, 8, 8)
    pinGeoRef.current = geo
    for (let i = 0; i < MESH_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff3b5c, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      group.add(mesh)
      meshPoolRef.current.push(mesh)
    }

    // Pre-allocated scratch vectors — zero per-frame allocation in steady state
    const _wp = new THREE.Vector3()
    const _proj = new THREE.Vector3()
    const REF_DEPTH = 3 - 1.001

    // Projects current multi-cluster centroids to screen coords and updates badge state.
    // Called from applyClusterUpdate and throttled from animate during globe motion.
    function refreshBadgePositions() {
      const camZ = camera.position.z
      const { width, height } = containerSizeRef.current
      const newBadges: BadgeInfo[] = []
      for (let i = 0; i < clustersRef.current.length; i++) {
        if (!clusterIsMultiRef.current[i]) continue
        const localPos = clusterLocalPosRef.current[i]
        if (!localPos) continue
        _proj.copy(localPos).applyMatrix4(group.matrixWorld)
        if (_proj.z < 1 / camZ) continue
        _proj.project(camera)
        newBadges.push({
          x: ((_proj.x + 1) / 2) * width - BADGE_SIZE / 2,
          y: ((1 - _proj.y) / 2) * height - BADGE_SIZE / 2,
          count: clustersRef.current[i]!.streams.length,
        })
      }
      setBadges(newBadges)
    }

    // Apply a new cluster result to the mesh pool and centroid cache.
    // Only called when clusters change, not every frame.
    function applyClusterUpdate(newClusters: GeoCluster[]) {
      clustersRef.current = newClusters
      clusterLocalPosRef.current = newClusters.map(c => latLngToVec3(c.centroidLat, c.centroidLng))
      clusterIsMultiRef.current = newClusters.map(c => c.streams.length > 1)

      newClusters.forEach((cluster, i) => {
        if (i >= meshPoolRef.current.length) return
        const mesh = meshPoolRef.current[i]!
        mesh.position.copy(clusterLocalPosRef.current[i]!)
        mesh.visible = true
        ;(mesh.material as THREE.MeshBasicMaterial).color.setHex(
          cluster.streams.length > 1 ? 0x5b8cff : 0xff3b5c
        )
      })
      for (let i = newClusters.length; i < meshPoolRef.current.length; i++) {
        meshPoolRef.current[i]!.visible = false
      }

      group.updateWorldMatrix(false, false)
      refreshBadgePositions()
    }

    let badgeRefreshFrame = 0

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)

      const isAutoRotating = !hasInteractedRef.current
      if (isAutoRotating) group.rotation.y += 0.0008

      const vel = velocityRef.current
      const hasVelocity = vel.x !== 0 || vel.y !== 0
      if (hasVelocity) {
        group.rotation.y += vel.y
        group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + vel.x))
        savedRotationRef.current = { x: group.rotation.x, y: group.rotation.y }
        vel.x *= 0.88; vel.y *= 0.88
        if (Math.abs(vel.x) < 0.00005 && Math.abs(vel.y) < 0.00005) velocityRef.current = { x: 0, y: 0 }
      }

      group.updateWorldMatrix(false, false)

      // Refresh badge screen positions during motion (every 3rd frame ≈ 20fps)
      // so they track the pin during inertia and auto-rotate without per-frame React updates.
      if (hasVelocity || isAutoRotating) {
        badgeRefreshFrame = (badgeRefreshFrame + 1) % 3
        if (badgeRefreshFrame === 0) refreshBadgePositions()
      }

      const camZ = camera.position.z
      const streamCount = streamsRef.current.length

      // Re-cluster only when zoom shifts by >0.12 or streams change — not every frame
      if (Math.abs(camZ - lastClusteredZRef.current) > 0.12 || streamCount !== lastStreamCountRef.current) {
        lastClusteredZRef.current = camZ
        lastStreamCountRef.current = streamCount
        applyClusterUpdate(buildGeoClusters(streamsRef.current, camZ))
      }

      // Per-frame: update mesh scales for constant screen size (uses _wp, no alloc)
      const n = clustersRef.current.length
      for (let i = 0; i < n && i < meshPoolRef.current.length; i++) {
        const mesh = meshPoolRef.current[i]!
        mesh.getWorldPosition(_wp)
        const depth = Math.max(0.01, camZ - _wp.z)
        mesh.scale.setScalar((clusterIsMultiRef.current[i] ? 1.55 : 1) * depth / REF_DEPTH)
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
          const c = cameraRef.current
          if (c) {
            c.position.z = Math.max(1.15, Math.min(8, c.position.z * (lastPinchDistRef.current / dist)))
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
      }
    },
  })

  function handleTap(sx: number, sy: number) {
    const camera = cameraRef.current
    if (!camera || meshPoolRef.current.length === 0) return
    const { width, height } = containerSizeRef.current
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2((sx / width) * 2 - 1, -(sy / height) * 2 + 1), camera)
    const hits = raycaster.intersectObjects(meshPoolRef.current.filter(m => m.visible))
    if (hits.length > 0) {
      const poolIdx = meshPoolRef.current.indexOf(hits[0]!.object as THREE.Mesh)
      const cluster = clustersRef.current[poolIdx]
      if (cluster) {
        if (cluster.streams.length === 1) {
          const s = cluster.streams[0]
          if (s) setSelectedStream(s)
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
    router.push({ pathname: `/(app)/stream/${selectedStream.mediasoupRoomId}`, params: { streamId: selectedStream.id, sources: (selectedStream.sources ?? []).join(',') } })
  }

  function joinClusterStream(stream: Stream) {
    if (!stream.mediasoupRoomId) return
    setSelectedCluster(null)
    router.push({ pathname: `/(app)/stream/${stream.mediasoupRoomId}`, params: { streamId: stream.id, sources: (stream.sources ?? []).join(',') } })
  }

  const liveCount = streams?.length ?? 0

  return (
    <View style={styles.container} onLayout={e => { const { width, height } = e.nativeEvent.layout; containerSizeRef.current = { width, height } }}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* Badge overlays — plain React state, only mounted for actual multi-clusters */}
      {badges.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {badges.map((b, i) => (
            <View key={i} style={[styles.badge, { left: b.x, top: b.y }]}>
              <Text style={styles.badgeText}>{b.count}</Text>
            </View>
          ))}
        </View>
      )}

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
            <View style={styles.center}><Text style={styles.hint}>No live streams nearby</Text></View>
          )}
        </SafeAreaView>
      </View>

      {banner && (
        <View style={[styles.bannerWrapper, { top: insets.top + 56 }]} pointerEvents="box-none">
          <Pressable style={[styles.banner, banner.kind === 'resumed' ? styles.bannerResumed : styles.bannerMuted]} onPress={banner.kind === 'resumed' ? handleBannerTap : undefined}>
            <View style={styles.bannerContent}>
              {banner.kind === 'disconnected' && (<><ActivityIndicator size="small" color={theme.colors.textMuted} style={styles.bannerSpinner} /><Text style={styles.bannerText}>Stream disconnected — waiting to reconnect</Text></>)}
              {banner.kind === 'ended' && <Text style={styles.bannerText}>The stream has ended</Text>}
              {banner.kind === 'resumed' && <Text style={[styles.bannerText, styles.bannerTextResumed]}>Stream resumed — tap to rejoin</Text>}
            </View>
            <Pressable onPress={dismissBanner} hitSlop={12} style={styles.bannerClose}>
              <Text style={styles.bannerCloseText}>✕</Text>
            </Pressable>
          </Pressable>
        </View>
      )}

      {selectedStream && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedStream(null)} />
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              {selectedStream.host && <Avatar avatarUrl={selectedStream.host.avatarUrl} displayName={selectedStream.host.displayName} size={44} />}
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={1}>{selectedStream.title}</Text>
                {selectedStream.host && <Text style={styles.cardHandle}>@{selectedStream.host.handle}</Text>}
                <Text style={styles.cardMeta}>{selectedStream.viewerCount} {selectedStream.viewerCount === 1 ? 'viewer' : 'viewers'}</Text>
              </View>
            </View>
            <Pressable style={styles.joinBtn} onPress={joinSelectedStream}>
              <Text style={styles.joinBtnText}>Join</Text>
            </Pressable>
          </View>
        </View>
      )}

      {selectedCluster && (
        <View style={styles.cardWrapper} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedCluster(null)} />
          <View style={styles.card}>
            <Text style={styles.clusterHeader}>{selectedCluster.streams.length} live streams here</Text>
            {selectedCluster.streams.map(stream => (
              <Pressable key={stream.id} style={styles.clusterRow} onPress={() => joinClusterStream(stream)}>
                <View style={styles.cardLeft}>
                  {stream.host && <Avatar avatarUrl={stream.host.avatarUrl} displayName={stream.host.displayName} size={38} />}
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{stream.title}</Text>
                    {stream.host && <Text style={styles.cardHandle}>@{stream.host.handle}</Text>}
                    <Text style={styles.cardMeta}>{stream.viewerCount} {stream.viewerCount === 1 ? 'viewer' : 'viewers'}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  wordmark: { ...theme.typography.title, color: theme.colors.text },
  liveBadge: { backgroundColor: theme.colors.live, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: 3 },
  liveBadgeText: { ...theme.typography.caption, color: '#fff', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { ...theme.typography.body, color: theme.colors.textMuted },

  badge: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: theme.colors.accent, lineHeight: 12 },

  cardWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  card: { backgroundColor: theme.colors.bgElevated, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, gap: theme.spacing.sm },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  cardHandle: { ...theme.typography.caption, color: theme.colors.accent },
  cardMeta: { ...theme.typography.caption, color: theme.colors.textMuted },
  joinBtn: { backgroundColor: theme.colors.live, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, alignSelf: 'center' },
  joinBtnSmall: { backgroundColor: theme.colors.live, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.sm, paddingVertical: 6, alignSelf: 'center' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  clusterHeader: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '600', paddingBottom: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  clusterRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },

  bannerWrapper: { position: 'absolute', left: 0, right: 0, paddingHorizontal: theme.spacing.md },
  banner: { borderRadius: theme.radius.md, borderWidth: 1, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  bannerMuted: { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
  bannerResumed: { backgroundColor: '#0D2B1F', borderColor: theme.colors.success },
  bannerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  bannerSpinner: { flexShrink: 0 },
  bannerText: { ...theme.typography.caption, color: theme.colors.textMuted, flex: 1 },
  bannerTextResumed: { color: theme.colors.success },
  bannerClose: { flexShrink: 0 },
  bannerCloseText: { ...theme.typography.caption, color: theme.colors.textMuted },
})
