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

// air is keyed by source kind (string) → on/off. Kept as a plain
// string-keyed map so this module stays free of component-tier imports.
export type CaptureConfig = {
  title: string
  air: Partial<Record<string, boolean>>
  precision: LocationPrecision
  identity: IdentityFlag
  subscribersOnly: boolean
}

// Fresh-install defaults: empty title; camera + audio + location all aired;
// every other source off; identity public; location precision ceiling at exact.
export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  title: '',
  air: { cam: true, audio: true, loc: true },
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
