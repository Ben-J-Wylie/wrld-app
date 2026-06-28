import { describe, it, expect } from 'vitest'
import {
  mergeSettings,
  settingsEqual,
  isEmptySettings,
  settingsAt,
  settingsBoundaries,
  coalesce,
  applySetting,
  type SettingsRange,
} from '@/lib/segmentSettings'

describe('segmentSettings — the per-segment manifest math', () => {
  describe('mergeSettings', () => {
    it('patch overrides base per field', () => {
      expect(mergeSettings({ visibility: 'public' }, { visibility: 'private' })).toEqual({ visibility: 'private' })
    })
    it('explicit undefined CLEARS a field (back to inherit)', () => {
      expect(mergeSettings({ visibility: 'public' }, { visibility: undefined })).toEqual({})
    })
    it('merges sources per-key (does not replace wholesale)', () => {
      expect(mergeSettings({ sources: { cam: true } }, { sources: { audio: false } })).toEqual({
        sources: { cam: true, audio: false },
      })
    })
    it('carries the keep axis', () => {
      expect(mergeSettings({}, { keep: 'kept' })).toEqual({ keep: 'kept' })
      expect(mergeSettings({ keep: 'kept' }, { keep: undefined })).toEqual({})
    })
    it('empty title clears', () => {
      expect(mergeSettings({ title: 'x' }, { title: '' })).toEqual({})
    })
  })

  describe('settingsEqual / isEmptySettings', () => {
    it('equal across every axis', () => {
      expect(settingsEqual({ visibility: 'public', keep: 'kept' }, { visibility: 'public', keep: 'kept' })).toBe(true)
      expect(settingsEqual({ keep: 'kept' }, { keep: 'reapable' })).toBe(false)
    })
    it('empty = no axes set; {} / empty sources / empty title all count', () => {
      expect(isEmptySettings({})).toBe(true)
      expect(isEmptySettings({ sources: {} })).toBe(true)
      expect(isEmptySettings({ title: '' })).toBe(true)
      expect(isEmptySettings({ visibility: 'public' })).toBe(false)
    })
  })

  describe('settingsAt / settingsBoundaries', () => {
    const ranges: SettingsRange[] = [{ sessionId: 's', startMs: 100, endMs: 200, settings: { visibility: 'private' } }]
    it('returns the covering range settings, else {}', () => {
      expect(settingsAt(ranges, 's', 150)).toEqual({ visibility: 'private' })
      expect(settingsAt(ranges, 's', 50)).toEqual({})
      expect(settingsAt(ranges, 's', 200)).toEqual({}) // end is exclusive
      expect(settingsAt(ranges, 'other', 150)).toEqual({})
    })
    it('boundaries are the sorted unique edges', () => {
      expect(settingsBoundaries(ranges, 's')).toEqual([100, 200])
    })
  })

  describe('coalesce', () => {
    it('drops empty (inherit) ranges and merges equal adjacent', () => {
      const out = coalesce([
        { sessionId: 's', startMs: 0, endMs: 100, settings: { visibility: 'private' } },
        { sessionId: 's', startMs: 100, endMs: 200, settings: { visibility: 'private' } },
        { sessionId: 's', startMs: 200, endMs: 300, settings: {} }, // empty → dropped
      ])
      expect(out).toEqual([{ sessionId: 's', startMs: 0, endMs: 200, settings: { visibility: 'private' } }])
    })
    it('does not merge adjacent with different settings', () => {
      const out = coalesce([
        { sessionId: 's', startMs: 0, endMs: 100, settings: { visibility: 'private' } },
        { sessionId: 's', startMs: 100, endMs: 200, settings: { visibility: 'public' } },
      ])
      expect(out).toHaveLength(2)
    })
  })

  describe('applySetting', () => {
    it('applies a patch over a span on empty base', () => {
      const out = applySetting([], { sessionId: 's', startMs: 100, endMs: 200 }, { visibility: 'private' })
      expect(out).toEqual([{ sessionId: 's', startMs: 100, endMs: 200, settings: { visibility: 'private' } }])
    })
    it('splits an existing range and clears a field on the inner slice (privacy subtract)', () => {
      const base: SettingsRange[] = [{ sessionId: 's', startMs: 0, endMs: 300, settings: { visibility: 'private' } }]
      const out = applySetting(base, { sessionId: 's', startMs: 100, endMs: 200 }, { visibility: undefined })
      // the middle [100,200) becomes public (empty → dropped); the two ends stay private
      expect(out).toEqual([
        { sessionId: 's', startMs: 0, endMs: 100, settings: { visibility: 'private' } },
        { sessionId: 's', startMs: 200, endMs: 300, settings: { visibility: 'private' } },
      ])
    })
    it('a zero/negative span is a no-op (just coalesces)', () => {
      const base: SettingsRange[] = [{ sessionId: 's', startMs: 0, endMs: 100, settings: { visibility: 'private' } }]
      expect(applySetting(base, { sessionId: 's', startMs: 50, endMs: 50 }, { visibility: 'public' })).toEqual(base)
    })
  })
})
