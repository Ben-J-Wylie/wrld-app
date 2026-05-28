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

const POOL_SIZE = 30

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
function makePinTexture(count: number): THREE.DataTexture {
  const S = 96
  const cx = S / 2, cy = S / 2
  const isCluster = count > 1
  const circleR = isCluster ? 26 : 18
  const borderR = circleR + 2
  const glowR   = borderR + 14
  const [fr, fg, fb] = isCluster ? [0x5b, 0x8c, 0xff] : [0xff, 0x3b, 0x5c]
  const data = new Uint8Array(S * S * 4)

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - cx, dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      const i = (y * S + x) * 4
      if (d <= circleR) {
        data[i] = fr; data[i+1] = fg; data[i+2] = fb; data[i+3] = 255
      } else if (d <= borderR) {
        data[i] = 255; data[i+1] = 255; data[i+2] = 255; data[i+3] = 255
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
              data[i] = 255; data[i+1] = 255; data[i+2] = 255; data[i+3] = 255
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
  // Sprite pool — each slot is either a single-stream pin or a cluster pin,
  // texture baked with count + glow. No separate RN badge overlay needed.
  const spritePoolRef = useRef<THREE.Sprite[]>([])
  // Textures keyed by count ("1", "2", …, "9+"). Generated once, reused.
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
  const savedRotationRef = useRef({ x: 0, y: 0 })
  const hasOrientedRef = useRef(false)
  const hasInteractedRef = useRef(false)
  const velocityRef = useRef({ x: 0, y: 0 })

  const containerSizeRef = useRef({ width: Dimensions.get('window').width, height: Dimensions.get('window').height })
  const lastPanRef = useRef({ dx: 0, dy: 0 })
  const lastPinchDistRef = useRef<number | null>(null)

  streamsRef.current = streams ?? []

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
    if (!camera || spritePoolRef.current.length === 0) return
    const { width, height } = containerSizeRef.current
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2((sx / width) * 2 - 1, -(sy / height) * 2 + 1), camera)
    const visible = spritePoolRef.current.filter(s => s.visible)
    const hits = raycaster.intersectObjects(visible)
    if (hits.length > 0) {
      const poolIdx = spritePoolRef.current.indexOf(hits[0]!.object as THREE.Sprite)
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
        </SafeAreaView>
      </View>

      {liveCount === 0 && coords && (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyHeading}>No streams nearby</Text>
            <Text style={styles.emptyBody}>Be the first to go live in your area</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/(app)/dashboard')}>
              <Text style={styles.emptyBtnText}>Go live</Text>
            </Pressable>
          </View>
        </View>
      )}

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
  emptyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    backgroundColor: 'rgba(10, 10, 15, 0.88)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    maxWidth: 280,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyHeading: { ...theme.typography.heading, color: theme.colors.text, textAlign: 'center' },
  emptyBody: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyBtnText: { ...theme.typography.body, color: '#fff', fontWeight: '700' },
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
