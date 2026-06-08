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

import AsyncStorage from '@react-native-async-storage/async-storage'

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
  // WebRTC encoder ceiling in bits/sec (the `produce` encodings `maxBitrate`).
  // Scales with resolution so higher tiers aren't starved (1080p/1440p need more
  // bits than 720p for the same sharpness). A ceiling, not a floor — BWE only
  // reaches it if the uplink allows. This single encoding is forwarded verbatim
  // to viewers + the admin preview + the on-disk buffer (no server transcode),
  // so it sets quality system-wide for the tier.
  maxVideoBitrate: number
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
    maxVideoBitrate: 4_000_000,
  },
  plus: {
    tier: 'plus',
    label: 'Plus',
    windowHours: 72,
    windowLabel: '3 days',
    windowShort: '72h',
    resolutionHeight: 1080,
    resolutionLabel: '1080p',
    maxVideoBitrate: 6_000_000,
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    windowHours: 168,
    windowLabel: '7 days',
    windowShort: '7d',
    resolutionHeight: 1440,
    resolutionLabel: '1440p',
    maxVideoBitrate: 10_000_000,
  },
}

// Ordered free → pro, for laddered UI.
export const TIER_LADDER: TierCap[] = [TIER_CAPS.free, TIER_CAPS.plus, TIER_CAPS.pro]

// ─── Remote ladder override (admin-tunable via RemoteConfig → /auth/me) ───────
// The backend delivers a per-tier { resolutionHeight, maxVideoBitrate } ladder in
// the /auth/me `captureLadder` field, sourced from RemoteConfig
// (VIDEO_RESOLUTION_CAP_<TIER>, VIDEO_BITRATE_MBPS_<TIER>). The two capture helpers
// below resolve in this order: live (this session's /auth/me) → cached (last known,
// survives an offline launch) → baked-in TIER_CAPS default. The baked-in defaults
// are NEVER removed — they are the permanent floor for a first-ever offline launch.
// (Capture values are only consumed at go-live, which needs connectivity anyway, so
// the offline path is belt-and-suspenders for first launch / flaky-network edges.)

export type CaptureTierValues = { resolutionHeight: number; maxVideoBitrate: number }
export type CaptureLadder = Record<Tier, CaptureTierValues>

const LADDER_CACHE_KEY = 'wrld-capture-ladder'
const ALLOWED_HEIGHTS = [720, 1080, 1440]
const MIN_BITRATE = 500_000
const MAX_BITRATE = 20_000_000

// Synchronous in-memory override read by the helpers at go-live time. null = none yet.
let liveLadder: CaptureLadder | null = null

// Clamp remote values to sane bounds so a fat-fingered admin entry can't brick capture.
function clampTier(v: Partial<CaptureTierValues> | undefined, fallback: CaptureTierValues): CaptureTierValues {
  const h = v?.resolutionHeight
  const b = v?.maxVideoBitrate
  return {
    resolutionHeight: typeof h === 'number' && ALLOWED_HEIGHTS.includes(h) ? h : fallback.resolutionHeight,
    maxVideoBitrate:
      typeof b === 'number' && isFinite(b)
        ? Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, Math.round(b)))
        : fallback.maxVideoBitrate,
  }
}

function sanitize(ladder: Partial<CaptureLadder> | null | undefined): CaptureLadder | null {
  if (!ladder || typeof ladder !== 'object') return null
  return {
    free: clampTier(ladder.free, TIER_CAPS.free),
    plus: clampTier(ladder.plus, TIER_CAPS.plus),
    pro: clampTier(ladder.pro, TIER_CAPS.pro),
  }
}

// Apply a ladder from /auth/me: set the in-memory override + cache it for offline
// launches. Best-effort persistence — a failed write never throws.
export async function applyRemoteCaptureLadder(ladder: Partial<CaptureLadder> | null | undefined): Promise<void> {
  const clean = sanitize(ladder)
  if (!clean) return
  liveLadder = clean
  try {
    await AsyncStorage.setItem(LADDER_CACHE_KEY, JSON.stringify(clean))
  } catch {
    // best-effort
  }
}

// Hydrate the override from the last cached ladder. Call once at app startup so an
// offline launch reflects the most recent admin values. Never overwrites a ladder
// already applied live this session.
export async function hydrateCaptureLadder(): Promise<void> {
  if (liveLadder) return
  try {
    const raw = await AsyncStorage.getItem(LADDER_CACHE_KEY)
    if (raw) liveLadder = sanitize(JSON.parse(raw) as Partial<CaptureLadder>)
  } catch {
    // fall through to baked-in defaults
  }
}

function resolved(tier: Tier | string | null | undefined): CaptureTierValues {
  const base = (TIER_CAPS as Record<string, TierCap>)[tier ?? 'free'] ?? TIER_CAPS.free
  const live = liveLadder?.[(tier ?? 'free') as Tier]
  return live ?? { resolutionHeight: base.resolutionHeight, maxVideoBitrate: base.maxVideoBitrate }
}

// The capture-height cap for a tier. Aaron's `useMediasoup` passes this as the
// `getUserMedia` video `height: { ideal, max }` (G4 decided = cap produce, i.e.
// cap on the phone), which bounds both live quality and the buffer's byte
// budget without a server-side transcode. Remote-aware: live → cache → default.
export function maxCaptureHeight(tier: Tier | string | null | undefined): number {
  return resolved(tier).resolutionHeight
}

// The WebRTC encoder bitrate ceiling for a tier (bits/sec). Aaron's
// `useMediasoup` passes this as the camera `produce` encodings `maxBitrate`.
// Pairs with `maxCaptureHeight` so each tier's resolution gets a matching bit
// budget. Remote-aware: live → cache → default.
export function maxVideoBitrate(tier: Tier | string | null | undefined): number {
  return resolved(tier).maxVideoBitrate
}
