// src/lib/tierCaps.ts
//
// Single source of truth for the per-tier rolling-buffer ladder
// (Rolling Buffer / Always-On Rewind initiative — June 2026). Going live
// continuously records into a self-overwriting buffer; each tier promises a
// flat rewind window and is capped at a max capture resolution. Time is the
// user-facing contract; bytes are the enforced backstop (sized server-side).
//
// This module holds ONLY the ladder constants + the resolution helper, so it
// stays free of component-tier imports and can be read from both Ben's
// component lane (the RewindLadder display, the subscription screen copy) and
// Aaron's hook lane. G4 is decided: cap on the phone (cap-produce) — so
// `useMediasoup` reads `maxCaptureHeight(wrldUser.tier)` and passes it as the
// `getUserMedia` video height constraint; the sidecar stays `-c:v copy` (no
// server transcode). Keep the numbers here and nowhere else; the backend mirrors
// them in RemoteConfig (STORAGE_QUOTA_GB_* pattern) for admin tuning.
//
// See the Rolling Buffer initiative in CLAUDE.md for the full cross-repo model.

export type Tier = 'free' | 'plus' | 'pro'

export type TierCap = {
  tier: Tier
  // Marketing label, e.g. 'Free' | 'Plus' | 'Pro'.
  label: string
  // Rewind window the tier promises.
  windowHours: number
  // Human window copy, e.g. '24 hours' | '3 days' | '7 days'.
  windowLabel: string
  // Compact window chip, e.g. '24h' | '72h' | '7d'.
  windowShort: string
  // Max capture height in pixels (the `getUserMedia` cap if G4 = cap-produce).
  resolutionHeight: 720 | 1080 | 1440
  // Display label, e.g. '720p' | '1080p' | '1440p'.
  resolutionLabel: string
}

export const TIER_CAPS: Record<Tier, TierCap> = {
  free: {
    tier: 'free',
    label: 'Free',
    windowHours: 24,
    windowLabel: '24 hours',
    windowShort: '24h',
    resolutionHeight: 720,
    resolutionLabel: '720p',
  },
  plus: {
    tier: 'plus',
    label: 'Plus',
    windowHours: 72,
    windowLabel: '3 days',
    windowShort: '72h',
    resolutionHeight: 1080,
    resolutionLabel: '1080p',
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    windowHours: 168,
    windowLabel: '7 days',
    windowShort: '7d',
    resolutionHeight: 1440,
    resolutionLabel: '1440p',
  },
}

// Ordered free → pro, for laddered UI.
export const TIER_LADDER: TierCap[] = [TIER_CAPS.free, TIER_CAPS.plus, TIER_CAPS.pro]

// The capture-height cap for a tier. Aaron's `useMediasoup` passes this as the
// `getUserMedia` video `height: { ideal, max }` (G4 decided = cap produce, i.e.
// cap on the phone), which bounds both live quality and the buffer's byte
// budget without a server-side transcode.
// Unknown tier strings fall back to the Free cap (safe minimum).
export function maxCaptureHeight(tier: Tier | string | null | undefined): TierCap['resolutionHeight'] {
  return (TIER_CAPS as Record<string, TierCap>)[tier ?? 'free']?.resolutionHeight ?? TIER_CAPS.free.resolutionHeight
}
