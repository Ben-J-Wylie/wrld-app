import { describe, it, expect } from 'vitest'
import {
  MAX_TILE_ZOOM,
  AVAILABILITY_TILE_MS,
  availabilityCellKey,
  lngLatToTile,
  tileKey,
  parseTileKey,
  tilePath,
  tileCenter,
  tilesForBounds,
} from '@/lib/tiles'

// These MUST match wrld-backend + wrld-web byte-for-byte (the push channel keys by them).
describe('tiles — shared slippy/cell math', () => {
  it('availability cell key is planet/t/z/x/y', () => {
    expect(availabilityCellKey('earth', 5, 3, 1, 2)).toBe('earth/5/3/1/2')
    expect(AVAILABILITY_TILE_MS).toBe(3_600_000)
  })

  it('tileKey ↔ parseTileKey round-trip', () => {
    expect(tileKey(3, 4, 5)).toBe('3/4/5')
    expect(parseTileKey('3/4/5')).toEqual({ z: 3, x: 4, y: 5 })
  })

  it('lngLatToTile: origin at z0 and z1', () => {
    expect(lngLatToTile(0, 0, 0)).toEqual({ z: 0, x: 0, y: 0 })
    expect(lngLatToTile(0, 0, 1)).toEqual({ z: 1, x: 1, y: 1 })
  })

  it('lngLatToTile clamps zoom to MAX_TILE_ZOOM', () => {
    expect(lngLatToTile(0, 0, 99).z).toBe(MAX_TILE_ZOOM)
  })

  it('lngLatToTile clamps extreme latitudes into valid y (no out-of-range tile)', () => {
    const t = lngLatToTile(0, 89, 2) // past the mercator limit → clamps
    expect(t.y).toBeGreaterThanOrEqual(0)
    expect(t.y).toBeLessThan(2 ** 2)
  })

  it('tilePath has one entry per zoom 0..maxZ, each containing the point', () => {
    const path = tilePath(0, 0, 2)
    expect(Object.keys(path)).toHaveLength(3)
    expect(path[0]).toBe('0/0/0')
    expect(path[1]).toBe('1/1/1')
    expect(path[2]).toBe('2/2/2')
  })

  it("a tile's center maps back to that tile (round-trip)", () => {
    for (const [z, x, y] of [
      [3, 4, 2],
      [5, 1, 30],
      [8, 200, 100],
    ] as const) {
      const c = tileCenter(z, x, y)
      expect(lngLatToTile(c.lng, c.lat, z)).toEqual({ z, x, y })
    }
  })

  it('tilesForBounds covers the center tile of a small box', () => {
    const keys = tilesForBounds({ west: -1, south: -1, east: 1, north: 1 }, 2)
    expect(keys).toContain('2/2/2')
  })

  it('tilesForBounds splits an antimeridian-crossing viewport (east < west)', () => {
    const keys = tilesForBounds({ west: 170, south: -10, east: -170, north: 10 }, 2)
    // both spans contribute: a high-x tile (near +180) and a low-x tile (near -180)
    expect(keys.some((k) => k.startsWith('2/3/'))).toBe(true)
    expect(keys.some((k) => k.startsWith('2/0/'))).toBe(true)
  })

  it('tilesForBounds respects the cap', () => {
    const keys = tilesForBounds({ west: -180, south: -85, east: 180, north: 85 }, 14, 50)
    expect(keys.length).toBeLessThanOrEqual(50)
  })
})
