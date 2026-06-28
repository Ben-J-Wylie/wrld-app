import { describe, it, expect } from 'vitest'
import {
  TIER_CAPS,
  TIER_LADDER,
  maxCaptureHeight,
  maxVideoBitrate,
  applyRemoteCaptureLadder,
} from '@/lib/tierCaps'

describe('tierCaps — the per-tier capture ladder', () => {
  // NOTE: applyRemoteCaptureLadder sets a module-level override, so the baked-in
  // (no-override) assertions run FIRST and the remote-override test runs LAST.
  describe('baked-in defaults', () => {
    it('the ladder is free → plus → pro', () => {
      expect(TIER_LADDER.map((t) => t.tier)).toEqual(['free', 'plus', 'pro'])
      expect(TIER_CAPS.free.windowHours).toBe(24)
      expect(TIER_CAPS.plus.windowHours).toBe(72)
      expect(TIER_CAPS.pro.windowHours).toBe(168)
    })
    it('maxCaptureHeight per tier, with a safe default', () => {
      expect(maxCaptureHeight('free')).toBe(720)
      expect(maxCaptureHeight('plus')).toBe(1080)
      expect(maxCaptureHeight('pro')).toBe(1440)
      expect(maxCaptureHeight(null)).toBe(720) // unknown → free floor
      expect(maxCaptureHeight('garbage')).toBe(720)
    })
    it('maxVideoBitrate per tier', () => {
      expect(maxVideoBitrate('free')).toBe(4_000_000)
      expect(maxVideoBitrate('pro')).toBe(10_000_000)
      expect(maxVideoBitrate(undefined)).toBe(4_000_000)
    })
  })

  describe('remote override (applyRemoteCaptureLadder) — clamps bad admin values', () => {
    it('applies valid values and clamps out-of-range ones', async () => {
      await applyRemoteCaptureLadder({
        free: { resolutionHeight: 1080, maxVideoBitrate: 99_999_999 }, // bitrate over MAX
        plus: { resolutionHeight: 999, maxVideoBitrate: 1 }, // bad height + under MIN bitrate
      })
      // free: height accepted (allowed), bitrate clamped to the 20 Mbps ceiling
      expect(maxCaptureHeight('free')).toBe(1080)
      expect(maxVideoBitrate('free')).toBe(20_000_000)
      // plus: invalid height → falls back to the baked default; bitrate clamped up to the 500 kbps floor
      expect(maxCaptureHeight('plus')).toBe(1080)
      expect(maxVideoBitrate('plus')).toBe(500_000)
      // pro: not in the override → baked default
      expect(maxCaptureHeight('pro')).toBe(1440)
    })
  })
})
