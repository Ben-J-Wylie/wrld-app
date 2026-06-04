// src/lib/captureConfig.ts
//
// Persists the Go Live & Record dashboard's capture configuration across
// app launches (AsyncStorage, same pattern as deviceId / tokenCache).
// Everything the user sets on the dashboard persists — per-source Air/Rec,
// the location precision ceiling, the identity flag, and subscribers-only.
// The one thing that does NOT persist is the title ("what's happening")
// field, which stays per-session in the screen's local state.
//
// No save button — the dashboard auto-saves on every change.

import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = '@wrld_capture_config'

export type LocationPrecision = 'exact' | 'city' | 'country' | 'private'
export type IdentityFlag = 'public' | 'anon'

// air / rec are keyed by source kind (string) → on/off. Kept as plain
// string-keyed maps so this module stays free of component-tier imports.
export type CaptureConfig = {
  air: Partial<Record<string, boolean>>
  rec: Partial<Record<string, boolean>>
  precision: LocationPrecision
  identity: IdentityFlag
  subscribersOnly: boolean
}

// Fresh-install defaults: camera + audio + location all Air and Rec on;
// every other source off; identity public; location precision ceiling at
// exact.
export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  air: { cam: true, audio: true, loc: true },
  rec: { cam: true, audio: true, loc: true },
  precision: 'exact',
  identity: 'public',
  subscribersOnly: false,
}

export async function loadCaptureConfig(): Promise<CaptureConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return DEFAULT_CAPTURE_CONFIG
    const parsed = JSON.parse(raw) as Partial<CaptureConfig>
    // Top-level spread fills any field a previous version didn't persist.
    const merged = { ...DEFAULT_CAPTURE_CONFIG, ...parsed }
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
