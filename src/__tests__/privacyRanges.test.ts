import { describe, it, expect } from 'vitest'
import { coalesce, addRange, subtractRange, isCovered, type PrivRange } from '@/lib/privacyRanges'

const r = (startMs: number, endMs: number, sessionId = 's'): PrivRange => ({ sessionId, startMs, endMs })

describe('privacyRanges — interval arithmetic over private spans', () => {
  describe('coalesce', () => {
    it('merges overlapping and touching ranges', () => {
      expect(coalesce([r(0, 100), r(100, 200), r(150, 250)])).toEqual([r(0, 250)])
    })
    it('keeps disjoint ranges separate (sorted)', () => {
      expect(coalesce([r(300, 400), r(0, 100)])).toEqual([r(0, 100), r(300, 400)])
    })
    it('drops zero/negative-width ranges', () => {
      expect(coalesce([r(50, 50), r(0, 100)])).toEqual([r(0, 100)])
    })
    it('does not merge across sessions', () => {
      const out = coalesce([r(0, 100, 'a'), r(50, 150, 'b')])
      expect(out).toHaveLength(2)
    })
  })

  it('addRange unions + coalesces', () => {
    expect(addRange([r(0, 100)], r(80, 200))).toEqual([r(0, 200)])
    expect(addRange([r(0, 100)], r(50, 50))).toEqual([r(0, 100)]) // empty add = no-op
  })

  describe('subtractRange', () => {
    it('splits a covering range, leaving both remainders', () => {
      expect(subtractRange([r(0, 300)], r(100, 200))).toEqual([r(0, 100), r(200, 300)])
    })
    it('trims at an edge', () => {
      expect(subtractRange([r(0, 300)], r(0, 100))).toEqual([r(100, 300)])
    })
    it('leaves other-session ranges untouched', () => {
      expect(subtractRange([r(0, 300, 'a')], r(100, 200, 'b'))).toEqual([r(0, 300, 'a')])
    })
  })

  describe('isCovered', () => {
    it('true when fully covered (within tolerance), false otherwise', () => {
      const set = [r(0, 1000)]
      expect(isCovered(set, r(100, 900))).toBe(true)
      // overshoot must exceed the default 1000ms tolerance (1000+1000=2000) to read uncovered
      expect(isCovered(set, r(100, 2500))).toBe(false)
    })
    it('tolerance absorbs minor boundary drift', () => {
      expect(isCovered([r(100, 900)], r(50, 950), 100)).toBe(true) // within ±100
      expect(isCovered([r(100, 900)], r(50, 950), 10)).toBe(false)
    })
    it('zero-width query is never covered', () => {
      expect(isCovered([r(0, 1000)], r(500, 500))).toBe(false)
    })
  })
})
