import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { clipsApi, type ClipPin, type BufferPin, type AvailabilityCell } from '@/api/clips'
import {
  tilesForBounds,
  parseTileKey,
  tileKey,
  tileCenter,
  availabilityCellKey,
  AVAILABILITY_TILE_MS,
  PIN_ZOOM_THRESHOLD,
  COUNT_MIN_ZOOM,
  MAX_TILE_ZOOM,
  type LngLatBounds,
} from '@/lib/tiles'
import type { TileCount } from './useViewportDiscovery'

// PB4 Lane B — the SCALABLE time-machine availability feed. The temporal twin of the live
// viewport-tile protocol (P2): the globe subscribes to the space-time cells `(planet, t, z, x, y)`
// it currently shows (viewport × scrub-time) instead of pulling a ±12h window for the whole world.
//
// Reads: each cell is a cacheable GET (Cache-Control max-age 30 + ETag) held via TanStack
// useQueries — so the set auto-fetches/dedups/GCs as the viewport pans and the clock scrubs
// (a cell that leaves view becomes an inactive query and is collected). At high zoom a cell
// returns individual pins (the globe resolves playhead ∈ interval locally); at low zoom a cell
// returns a per-minute alive-count series, read at the playhead minute → count bubbles.
//
// Writes: a single WS (`/clips/availability`) carries the held cell keys; the server pushes
// `cell_changed` when an edit touches a cell, and we invalidate just that cell's query — no poll.
//
// Replaces useHistoricalAvailability's "±12h window + 60s poll". Same `setView(bounds, zoom)`
// shape as useViewportDiscovery so the globe drives both from one onCameraChanged.

const WS_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.wrld.cam')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://')
const AVAILABILITY_WS = `${WS_BASE}/clips/availability`
const WORLD: LngLatBounds = { west: -180, south: -85, east: 180, north: 85 }

export type HistoricalCellsState = {
  // RAW pins for the in-view cells (the globe applies its inInterval filter + signature memo).
  clips: ClipPin[]
  bufferPins: BufferPin[]
  // Count bubbles already resolved at the playhead minute (low-zoom regime).
  counts: TileCount[]
  mode: 'pins' | 'counts'
  /** Call on map load + region-change-complete with the current viewport. */
  setView: (bounds: LngLatBounds, zoom: number) => void
}

type Cell = { key: string; planet: string; t: number; z: number; x: number; y: number }

export function useHistoricalCells(opts: {
  planet: string
  playheadMs: number
  active: boolean
  pinZoomThreshold?: number
  countMinZoom?: number
}): HistoricalCellsState {
  const { planet, playheadMs, active } = opts
  const pinZoom = opts.pinZoomThreshold ?? PIN_ZOOM_THRESHOLD
  const countMin = opts.countMinZoom ?? COUNT_MIN_ZOOM
  const qc = useQueryClient()

  const [view, setViewState] = useState<{ bounds: LngLatBounds; zoom: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setView = useCallback((bounds: LngLatBounds, zoom: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setViewState({ bounds, zoom }), 200)
  }, [])
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  // The needed cells recompute only when planet / viewport / TIME-TILE changes (not per second —
  // within-hour resolution happens in the combine step). One time-tile = 1h.
  const timeTile = active ? Math.floor(playheadMs / AVAILABILITY_TILE_MS) : 0
  const isPins = !!view && view.zoom >= pinZoom
  const neededCells = useMemo<Cell[]>(() => {
    if (!active || !view) return []
    const baseZ = Math.max(0, Math.min(MAX_TILE_ZOOM, Math.floor(view.zoom)))
    let z: number
    let tiles: string[]
    if (view.zoom >= pinZoom) {
      z = baseZ
      tiles = tilesForBounds(view.bounds, z)
    } else {
      // Count mode = globe overview → the WHOLE WORLD at a low zoom (stable as the globe spins;
      // a bbox set churns frame-to-frame on an auto-rotating globe). 4^5 = 1024 ≤ tile cap.
      z = Math.min(Math.max(baseZ, countMin), 5)
      tiles = tilesForBounds(WORLD, z)
    }
    return tiles.map((tk) => {
      const p = parseTileKey(tk)
      return { key: availabilityCellKey(planet, timeTile, p.z, p.x, p.y), planet, t: timeTile, z: p.z, x: p.x, y: p.y }
    })
  }, [active, view, timeTile, planet, pinZoom, countMin])

  const results = useQueries({
    queries: neededCells.map((c) => ({
      queryKey: ['avail-cell', c.key],
      queryFn: () => clipsApi.discoverCell(c.planet, c.t, c.z, c.x, c.y),
      enabled: active,
      staleTime: 30_000, // matches the cell's Cache-Control max-age
      gcTime: 120_000, // an off-screen cell lingers briefly then is collected
    })),
  })

  // Combine the in-view cells → RAW pins (the globe resolves playhead ∈ interval) + per-minute
  // counts (read counts[floor((T − t·TILE)/bucketMs)] for each count cell).
  const { clips, bufferPins, counts } = useMemo(() => {
    const clipsOut: ClipPin[] = []
    const bufOut: BufferPin[] = []
    const countsOut: TileCount[] = []
    const seenClip = new Set<string>()
    const seenBuf = new Set<string>()
    for (let i = 0; i < neededCells.length; i++) {
      const data = results[i]?.data as AvailabilityCell | undefined
      const cell = neededCells[i]!
      if (!data) continue
      if (data.mode === 'pins') {
        for (const c of data.clips) if (!seenClip.has(c.id)) { seenClip.add(c.id); clipsOut.push(c) }
        for (const b of data.bufferPins) if (!seenBuf.has(b.sessionId)) { seenBuf.add(b.sessionId); bufOut.push(b) }
      } else {
        const idx = Math.floor((playheadMs - cell.t * AVAILABILITY_TILE_MS) / data.bucketMs)
        const n = data.counts[idx] ?? 0
        if (n > 0) {
          const ctr = tileCenter(cell.z, cell.x, cell.y)
          countsOut.push({ tile: tileKey(cell.z, cell.x, cell.y), lng: ctr.lng, lat: ctr.lat, count: n })
        }
      }
    }
    return { clips: clipsOut, bufferPins: bufOut, counts: countsOut }
  }, [results, neededCells, playheadMs])

  // ── Push: subscribe to the held cells; invalidate a cell when the server says it changed ──
  const wsRef = useRef<WebSocket | null>(null)
  const cellKeys = useMemo(() => neededCells.map((c) => c.key), [neededCells])
  const cellKeysSig = cellKeys.join(',')
  const cellKeysRef = useRef<string[]>([])
  cellKeysRef.current = cellKeys
  useEffect(() => {
    if (!active) return
    let unmounted = false
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let delay = 1_000
    const connect = () => {
      if (unmounted) return
      const ws = new WebSocket(AVAILABILITY_WS)
      wsRef.current = ws
      ws.onopen = () => {
        delay = 1_000
        if (cellKeysRef.current.length) ws.send(JSON.stringify({ type: 'subscribe', cells: cellKeysRef.current }))
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { type?: string; cell?: string }
          if (msg?.type === 'cell_changed' && msg.cell) qc.invalidateQueries({ queryKey: ['avail-cell', msg.cell] })
        } catch {}
      }
      ws.onclose = () => {
        if (unmounted) return
        reconnect = setTimeout(() => {
          delay = Math.min(delay * 2, 30_000)
          connect()
        }, delay)
      }
    }
    connect()
    return () => {
      unmounted = true
      if (reconnect) clearTimeout(reconnect)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [active, qc])
  // (Re)subscribe whenever the held cell set changes — authoritative replace of the subscription.
  useEffect(() => {
    const ws = wsRef.current
    if (active && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', cells: cellKeys }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellKeysSig, active])

  return { clips, bufferPins, counts, mode: isPins ? 'pins' : 'counts', setView }
}
