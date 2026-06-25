// src/lib/captureConfig.ts
//
// Persists the Go Live capture configuration across app launches
// (AsyncStorage, same pattern as deviceId / tokenCache). This is the
// single source of truth for arming + the stream title, shared by the
// dashboard and the stream-view preview — per-source Air arming, the
// location precision ceiling, the identity flag, subscribers-only, and
// the `title` ("what's happening"). Recording is not armed here (a single
// Record button on the stream view records the aired set).
//
// Note: as of 2026-06-04 the title IS persisted/shared (it used to be
// per-session on the dashboard) so you can go live from either the
// dashboard or the stream-view preview with the same title.
//
// No save button — the dashboard auto-saves on every change.

import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = '@wrld_capture_config'

export type LocationPrecision = 'exact' | 'city' | 'country' | 'private'
export type IdentityFlag = 'public' | 'anon'
// Time-machine visibility of this go-live's footage (PB1, public-buffer initiative).
// 'public' (default) → the rolling buffer is replayable in the time machine;
// 'private' → live-viewable in the now, but never in the past (owner-private tier).
// Coarse per-go-live for PB1; per-range comes with DirectiveRange (PB3).
export type Visibility = 'public' | 'private'
// Whether the live chat stream is included on the broadcast. A flag (like
// identity), not a media track — its multistate is CHAT / NO CHAT.
export type ChatMode = 'on' | 'off'
// Which lane the live broadcast prints into (PB4 / unified manifest — U1). 'buffer'
// (default) → the time-windowed rolling buffer (the reaper clears it; no storage);
// 'saved' → retained from the start (kept until deleted; counts against storage quota).
// The now-edge starting choice; per CONTENT.md §5 the lane is one per-range setting.
export type CaptureLane = 'buffer' | 'saved'

// air is keyed by source kind (string) → on/off. Kept as a plain
// string-keyed map so this module stays free of component-tier imports.
export type CaptureConfig = {
  title: string
  air: Partial<Record<string, boolean>>
  precision: LocationPrecision
  identity: IdentityFlag
  chat: ChatMode
  subscribersOnly: boolean
  visibility: Visibility
  lane: CaptureLane
}

// Fresh-install defaults: empty title; camera + audio + location all aired;
// every other source off; identity public; location precision ceiling at exact;
// chat on; record to the buffer lane.
export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  title: '',
  air: { cam: true, audio: true, loc: true },
  precision: 'exact',
  identity: 'public',
  chat: 'on',
  subscribersOnly: false,
  visibility: 'public',
  lane: 'buffer',
}

export async function loadCaptureConfig(): Promise<CaptureConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return DEFAULT_CAPTURE_CONFIG
    const parsed = JSON.parse(raw) as Partial<CaptureConfig>
    // Top-level spread fills any scalar field a previous version didn't persist.
    // `air` is a NESTED map, so it must be merged PER-KEY — a plain top-level spread
    // would let a partial persisted `air` (e.g. one from an older source-model that
    // predates/omits the `cam`/`audio` keys) REPLACE the defaults wholesale, silently
    // disarming camera + audio → a data-only go-live (no preview, no recorded footage).
    // Per-key merge keeps an explicit `cam:false` but restores any ABSENT default to on.
    const merged = { ...DEFAULT_CAPTURE_CONFIG, ...parsed, air: { ...DEFAULT_CAPTURE_CONFIG.air, ...(parsed.air ?? {}) } }
    // Migrate the renamed precision value (bluedot → exact, 2026-06-04).
    if ((merged.precision as string) === 'bluedot') merged.precision = 'exact'
    return merged
  } catch {
    return DEFAULT_CAPTURE_CONFIG
  }
}

export async function saveCaptureConfig(config: CaptureConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    // Persistence is best-effort — a failed write shouldn't break arming.
  }
}
