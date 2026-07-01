import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { erasApi } from '@/api/eras'
import type { DiscoverPin } from '@/types/era'
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

// The ONE globe feed (clean-cut) — live + time-machine unified. The globe subscribes to the
// space-time cells `(planet, t, z, x, y)` it currently shows (viewport × scrub-time); `t=0`/now's
// tile is live. High zoom → resolved `DiscoverPin`s (the globe filters playhead ∈ interval locally);
// low zoom → a per-cell count → a bubble. Replaces useViewportDiscovery + useHistoricalClips/Cells/
// Availability. Cell GETs are cacheable (max-age 15); held via useQueries so the set auto-fetches/
// dedups/GCs as the viewport pans + the clock scrubs. No WS in the clean-cut — a modest refetch keeps
// live fresh.

const WORLD: LngLatBounds = { west: -180, south: -85, east: 180, north: 85 }

export type TileCount = { tile: string; lng: number; lat: number; count: number }
export type DiscoverState = {
  pins: DiscoverPin[]
  counts: TileCount[]
  mode: 'pins' | 'counts'
  /** Call on map load + region-change-complete with the current viewport. */
  setView: (bounds: LngLatBounds, zoom: number) => void
}

type Cell = { key: string; planet: string; t: number; z: number; x: number; y: number }

export function useDiscover(opts: {
  planet: string
  playheadMs: number
  active: boolean
  pinZoomThreshold?: number
  countMinZoom?: number
}): DiscoverState {
  const { planet, playheadMs, active } = opts
  const pinZoom = opts.pinZoomThreshold ?? PIN_ZOOM_THRESHOLD
  const countMin = opts.countMinZoom ?? COUNT_MIN_ZOOM

  const [view, setViewState] = useState<{ bounds: LngLatBounds; zoom: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setView = useCallback((bounds: LngLatBounds, zoom: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setViewState({ bounds, zoom }), 200)
  }, [])
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  // Cells recompute only on planet / viewport / TIME-TILE change (1 tile = 1h). Within-hour
  // resolution (playhead ∈ interval) happens in the globe's render off each pin's `intervals`.
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
      // Count mode = globe overview → the WHOLE WORLD at a low zoom (stable while auto-rotating).
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
      queryKey: ['discover-cell', c.key],
      queryFn: () => erasApi.discover(c.planet, c.t, c.z, c.x, c.y),
      enabled: active,
      staleTime: 15_000, // matches the cell's Cache-Control max-age
      refetchInterval: active ? 20_000 : (false as const), // no WS → keep live fresh-ish
      gcTime: 120_000,
    })),
  })

  const { pins, counts } = useMemo(() => {
    const pinsOut: DiscoverPin[] = []
    const countsOut: TileCount[] = []
    const seen = new Set<string>()
    for (let i = 0; i < neededCells.length; i++) {
      const data = results[i]?.data
      const cell = neededCells[i]!
      if (!data) continue
      if (data.pins.length || cell.z >= pinZoom) {
        for (const p of data.pins) if (!seen.has(p.eraId)) { seen.add(p.eraId); pinsOut.push(p) }
      } else if (data.count > 0) {
        const ctr = tileCenter(cell.z, cell.x, cell.y)
        countsOut.push({ tile: tileKey(cell.z, cell.x, cell.y), lng: ctr.lng, lat: ctr.lat, count: data.count })
      }
    }
    return { pins: pinsOut, counts: countsOut }
  }, [results, neededCells, pinZoom])

  return { pins, counts, mode: isPins ? 'pins' : 'counts', setView }
}
