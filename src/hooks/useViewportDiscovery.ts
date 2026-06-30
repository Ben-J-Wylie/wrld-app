import { useEffect, useRef, useState, useCallback } from 'react'
import type { Stream } from '@/types'
import {
  tilesForBounds, lngLatToTile, tileKey, parseTileKey, tileCenter,
  PIN_ZOOM_THRESHOLD, COUNT_MIN_ZOOM, MAX_TILE_ZOOM, type LngLatBounds,
} from '@/lib/tiles'

const BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.wrld.cam')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://')
// `?viewport=1` opts into the P2 tile-subscription protocol. The server falls
// back to the legacy global snapshot when Redis is off — this hook handles
// either reply, so it's safe whether or not the backend flag is on.
const DISCOVERY_URL = `${BASE}/streams/discovery?viewport=1`

export type TileCount = { tile: string; lng: number; lat: number; count: number }
export type DiscoveryMode = 'pins' | 'count' | 'legacy'

export type DiscoveryState = {
  pins: Stream[]
  counts: TileCount[]
  mode: DiscoveryMode
  /** Call on map load + region-change-complete with the current viewport. */
  setView: (bounds: LngLatBounds, zoom: number) => void
}

const idOf = (s: Stream) => s.id

/**
 * Viewport-aware discovery feed (P2). RN port of wrld-web's useViewportDiscovery.
 * Subscribes to the slippy tiles the map shows; returns individual pins at high
 * zoom and per-tile count bubbles at low zoom. Falls back to the legacy global
 * snapshot if the server replies with one (Redis off). Knobs come from
 * RemoteConfig via opts (fallback = the tiles.ts constants), held in a ref so
 * the long-lived subscribe closure reads current values.
 */
export function useViewportDiscovery(opts?: {
  pinZoomThreshold?: number
  countMinZoom?: number
}): DiscoveryState {
  const [pins, setPins] = useState<Stream[]>([])
  const [counts, setCounts] = useState<TileCount[]>([])
  const [mode, setMode] = useState<DiscoveryMode>('count')

  const knobsRef = useRef({ pinZoom: PIN_ZOOM_THRESHOLD, countMin: COUNT_MIN_ZOOM })
  knobsRef.current = {
    pinZoom: opts?.pinZoomThreshold ?? PIN_ZOOM_THRESHOLD,
    countMin: opts?.countMinZoom ?? COUNT_MIN_ZOOM,
  }

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(1_000)
  const unmountedRef = useRef(false)

  const pinsMap = useRef(new Map<string, Stream>())
  const countsMap = useRef(new Map<string, TileCount>())
  const subRef = useRef<{ z: number; mode: 'pins' | 'count'; tiles: Set<string> }>({
    z: 0, mode: 'count', tiles: new Set(),
  })
  const legacyRef = useRef(false)
  const pendingViewRef = useRef<{ bounds: LngLatBounds; zoom: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Coalesce React state updates to one per animation frame — discovery events
  // arrive in bursts (every live cam heartbeats), and a setState per event would
  // re-render the globe per event and stutter the rotation.
  const flushRafRef = useRef<number | null>(null)
  const pinsDirtyRef = useRef(false)
  const countsDirtyRef = useRef(false)
  const scheduleFlush = () => {
    if (flushRafRef.current != null) return
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null
      if (pinsDirtyRef.current) { pinsDirtyRef.current = false; setPins([...pinsMap.current.values()]) }
      if (countsDirtyRef.current) { countsDirtyRef.current = false; setCounts([...countsMap.current.values()]) }
    })
  }
  const flushPins = () => { pinsDirtyRef.current = true; scheduleFlush() }
  const flushCounts = () => { countsDirtyRef.current = true; scheduleFlush() }

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (flushRafRef.current != null) cancelAnimationFrame(flushRafRef.current)
      wsRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function connect() {
    if (unmountedRef.current) return
    const ws = new WebSocket(DISCOVERY_URL)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectDelayRef.current = 1_000
      const pv = pendingViewRef.current
      if (pv && !legacyRef.current) sendSubscribe(pv.bounds, pv.zoom, true)
    }

    ws.onmessage = (e) => {
      try {
        handleEvent(JSON.parse(e.data as string))
      } catch {}
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30_000)
        connect()
      }, reconnectDelayRef.current)
    }
  }

  // Legacy global-snapshot handlers (Redis off — identical to useDiscoverySocket).
  function legacyApply(event: Record<string, unknown>) {
    legacyRef.current = true
    setMode('legacy')
    const m = pinsMap.current
    switch (event.type) {
      case 'snapshot':
        m.clear()
        for (const s of event.streams as Stream[]) m.set(idOf(s), s)
        break
      case 'stream_started':
        m.set(idOf(event.stream as Stream), event.stream as Stream)
        break
      case 'stream_ended':
        for (const [id, s] of m) if (s.mediasoupRoomId === event.mediasoupRoomId) m.delete(id)
        break
      case 'location_updated':
        for (const s of m.values())
          if (s.mediasoupRoomId === event.mediasoupRoomId) {
            s.lat = event.lat as number; s.lng = event.lng as number
            // countryCode resolves async + arrives here — merge for the flag.
            if (event.countryCode != null) s.countryCode = event.countryCode as string
          }
        break
      case 'viewer_count_updated':
        for (const s of m.values())
          if (s.mediasoupRoomId === event.mediasoupRoomId) s.viewerCount = event.viewerCount as number
        break
      default:
        return
    }
    flushPins()
  }

  function handleEvent(event: Record<string, unknown>) {
    if (event.type === 'snapshot' || legacyRef.current) {
      legacyApply(event)
      return
    }
    switch (event.type) {
      case 'tile_pins': {
        for (const s of event.pins as Stream[]) pinsMap.current.set(idOf(s), s)
        flushPins()
        break
      }
      case 'tile_counts': {
        const c = event.counts as Record<string, { count: number; lat: number; lng: number }>
        for (const [tile, agg] of Object.entries(c)) upsertCount(tile, agg.count, agg.lat, agg.lng)
        flushCounts()
        break
      }
      case 'pin_added': {
        pinsMap.current.set(idOf(event.pin as Stream), event.pin as Stream)
        flushPins()
        break
      }
      case 'pin_removed': {
        for (const [id, s] of pinsMap.current)
          if (s.mediasoupRoomId === event.id || id === event.id) pinsMap.current.delete(id)
        flushPins()
        break
      }
      case 'count_changed': {
        upsertCount(event.tile as string, event.count as number, event.lat as number, event.lng as number)
        flushCounts()
        break
      }
    }
  }

  function upsertCount(tile: string, count: number, lat?: number, lng?: number) {
    if (count <= 0) {
      countsMap.current.delete(tile)
      return
    }
    let plat = lat
    let plng = lng
    if (plat == null || plng == null) {
      const { z, x, y } = parseTileKey(tile)
      const c = tileCenter(z, x, y)
      plat = c.lat
      plng = c.lng
    }
    countsMap.current.set(tile, { tile, lng: plng, lat: plat, count })
  }

  function sendSubscribe(bounds: LngLatBounds, zoom: number, force = false) {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN || legacyRef.current) return
    const { pinZoom, countMin } = knobsRef.current
    const baseZ = Math.max(0, Math.min(MAX_TILE_ZOOM, Math.floor(zoom)))
    const nextMode: 'pins' | 'count' = zoom >= pinZoom ? 'pins' : 'count'
    // Count mode = globe overview. Subscribe to the WHOLE WORLD at the count
    // zoom (clamped so the set fits the tile cap) instead of the viewport bbox:
    // on an auto-rotating globe getVisibleBounds jitters frame-to-frame (worse
    // on Android), so a bbox-derived set churns → markers prune + re-add →
    // flicker. The world set is stable (sent once; rotation is a no-op), so
    // bubbles persist as the globe spins. Pins mode (zoomed in) uses the bbox.
    let z: number
    let tiles: string[]
    if (nextMode === 'count') {
      z = Math.min(Math.max(baseZ, countMin), 5) // 4^5 = 1024 ≤ tilesForBounds cap
      tiles = tilesForBounds({ west: -180, south: -85, east: 180, north: 85 }, z)
    } else {
      z = baseZ
      tiles = tilesForBounds(bounds, z)
    }
    const tileSet = new Set(tiles)
    const prev = subRef.current
    const sameMode = prev.mode === nextMode
    const sameTiles = sameMode && tiles.length === prev.tiles.size && tiles.every((t) => prev.tiles.has(t))
    if (!force && sameTiles) return

    if (!sameMode) {
      if (nextMode === 'pins') { countsMap.current.clear(); flushCounts() }
      else { pinsMap.current.clear(); flushPins() }
      setMode(nextMode)
    }
    subRef.current = { z, mode: nextMode, tiles: tileSet }
    ws.send(JSON.stringify({ type: 'subscribe', tiles, mode: nextMode }))
    pruneToViewport(z, tileSet, nextMode)
  }

  function pruneToViewport(z: number, tiles: Set<string>, m: 'pins' | 'count') {
    if (m === 'pins') {
      let changed = false
      for (const [id, s] of pinsMap.current) {
        if (s.lat == null || s.lng == null) continue
        const t = lngLatToTile(s.lng, s.lat, z)
        if (!tiles.has(tileKey(t.z, t.x, t.y))) { pinsMap.current.delete(id); changed = true }
      }
      if (changed) flushPins()
    } else {
      let changed = false
      for (const tile of countsMap.current.keys())
        if (!tiles.has(tile)) { countsMap.current.delete(tile); changed = true }
      if (changed) flushCounts()
    }
  }

  const setView = useCallback((bounds: LngLatBounds, zoom: number) => {
    pendingViewRef.current = { bounds, zoom }
    if (legacyRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => sendSubscribe(bounds, zoom), 200)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { pins, counts, mode, setView }
}
