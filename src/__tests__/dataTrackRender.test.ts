import { describe, it, expect } from 'vitest'
import {
  sampleAt,
  recentUpTo,
  torchStateAt,
  trailUpTo,
  chatUpTo,
  toGraphValues,
  readingAt,
  toTrail,
  trailPositionAt,
  toChatLog,
} from '@/lib/dataTrackRender'

// Structurally identical to useDataTrack's `DataSample` (avoids importing the hook).
type S = { ts: number; [k: string]: unknown }
const s = (ts: number, extra: Record<string, unknown> = {}): S => ({ ts, ...extra })

describe('dataTrackRender — playhead sampling for clip replay', () => {
  describe('sampleAt (held state, binary search)', () => {
    const xs = [s(10, { v: 1 }), s(20, { v: 2 }), s(30, { v: 3 })]
    it('null when empty', () => expect(sampleAt([], 5)).toBeNull())
    it('before the first sample → the first', () => expect(sampleAt(xs, 5)).toEqual(s(10, { v: 1 })))
    it('holds the latest sample ≤ atMs', () => {
      expect(sampleAt(xs, 25)).toEqual(s(20, { v: 2 }))
      expect(sampleAt(xs, 30)).toEqual(s(30, { v: 3 }))
      expect(sampleAt(xs, 1000)).toEqual(s(30, { v: 3 }))
    })
  })

  it('recentUpTo returns the most recent ≤ max samples at/ before atMs', () => {
    const xs = [s(10), s(20), s(30), s(40)]
    expect(recentUpTo(xs, 35, 2)).toEqual([s(20), s(30)])
    expect(recentUpTo(xs, 5, 2)).toEqual([])
  })

  describe('torchStateAt (event track — inverse before the first toggle)', () => {
    const xs = [s(10, { on: true }), s(20, { on: false })]
    it('false when empty', () => expect(torchStateAt([], 5)).toBe(false))
    it('before the first event → the prior (inverse) state', () => expect(torchStateAt(xs, 5)).toBe(false))
    it('holds the latest toggle ≤ atMs', () => {
      expect(torchStateAt(xs, 15)).toBe(true)
      expect(torchStateAt(xs, 25)).toBe(false)
    })
  })

  describe('trailUpTo (held position)', () => {
    const xs = [s(10, { lng: 1, lat: 2 }), s(20, { lng: 3, lat: 4 })]
    it('before the first fix → holds the earliest point', () => expect(trailUpTo(xs, 5)).toEqual([[1, 2]]))
    it('accumulates the path up to atMs', () => {
      expect(trailUpTo(xs, 15)).toEqual([[1, 2]])
      expect(trailUpTo(xs, 25)).toEqual([[1, 2], [3, 4]])
    })
    it('empty when no positioned samples', () => expect(trailUpTo([s(10, { v: 1 })], 100)).toEqual([]))
  })

  it('chatUpTo unfolds messages up to atMs (defaulting handle)', () => {
    const xs = [s(10, { text: 'a', handle: 'ben' }), s(20, { text: 'b' })]
    expect(chatUpTo(xs, 15)).toEqual([{ handle: 'ben', text: 'a' }])
    expect(chatUpTo(xs, 25)).toEqual([{ handle: 'ben', text: 'a' }, { handle: 'unknown', text: 'b' }])
  })

  describe('toGraphValues (0..1 normalisation per kind)', () => {
    it('compass = heading/360, clamped', () => {
      expect(toGraphValues([s(1, { heading: 180 }), s(2, { heading: 360 }), s(3, { heading: 720 })], 'compass')).toEqual([
        0.5, 1, 1,
      ])
    })
    it('speed = mps/30, clamped', () => {
      expect(toGraphValues([s(1, { mps: 15 }), s(2, { mps: 60 })], 'speed')).toEqual([0.5, 1])
    })
    it('unknown kind → 0.5', () => {
      expect(toGraphValues([s(1)], 'nope')).toEqual([0.5])
    })
  })

  describe('readingAt (human reading at progress)', () => {
    it('em-dash when empty', () => expect(readingAt([], 'compass', 0.5)).toBe('—'))
    it('compass degrees at the head', () => expect(readingAt([s(1, { heading: 90 }), s(2, { heading: 270 })], 'compass', 0)).toBe('90°'))
    it('speed converts m/s → km/h', () => expect(readingAt([s(1, { mps: 10 })], 'speed', 0)).toBe('36 km/h'))
  })

  it('toTrail keeps only positioned samples', () => {
    expect(toTrail([s(1, { lng: 1, lat: 2 }), s(2, { v: 9 }), s(3, { lng: 5, lat: 6 })])).toEqual([[1, 2], [5, 6]])
  })

  it('trailPositionAt indexes by progress, undefined when empty', () => {
    const trail: [number, number][] = [[1, 2], [3, 4], [5, 6]]
    expect(trailPositionAt(trail, 0)).toEqual([1, 2])
    expect(trailPositionAt(trail, 1)).toEqual([5, 6])
    expect(trailPositionAt([], 0.5)).toBeUndefined()
  })

  it('toChatLog keeps only text samples', () => {
    expect(toChatLog([s(1, { text: 'hi', handle: 'a' }), s(2, { v: 1 })])).toEqual([{ handle: 'a', text: 'hi' }])
  })
})
