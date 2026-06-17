// src/components/features/stream/sourceMeta.ts
//
// Shared source map — one place that names every broadcast source's glyph + label, so
// the source rail and the SourceStage dispatch never drift apart. Keyed by FeedKind
// (the wide source taxonomy from FeedThumb). Pure data (no component), so both features
// and the section may import it.

import type { ComponentProps } from 'react'
import type { Icon } from '@/components/primitives/Icon'
import type { FeedKind } from '@/components/features/broadcast/FeedThumb'

type IconName = ComponentProps<typeof Icon>['name']

export const SOURCE_META: Record<FeedKind, { icon: IconName; label: string }> = {
  cam: { icon: 'video', label: 'CAMERA' },
  audio: { icon: 'mic', label: 'AUDIO' },
  screen: { icon: 'monitor', label: 'SCREEN' },
  loc: { icon: 'map-pin', label: 'LOCATION' },
  gyro: { icon: 'rotate-cw', label: 'GYRO' },
  compass: { icon: 'compass', label: 'COMPASS' },
  profile: { icon: 'user', label: 'IDENTITY' },
  speed: { icon: 'fast-forward', label: 'SPEED' },
  torch: { icon: 'zap', label: 'TORCH' },
  temp: { icon: 'thermometer', label: 'TEMP' },
  motion: { icon: 'activity', label: 'MOTION' },
  accel: { icon: 'move', label: 'ACCEL' },
  chat: { icon: 'message-circle', label: 'CHAT' },
}

// The canonical source-rail order — the SAME ordered suite on every frame (stream view + clips
// page), so the rails are identical. Matches the DASHBOARD's arming set 1:1 (one button per armable
// instrument). The accelerometer is ONE entry — `accel` (the raw 3-axis readout); `motion` (its
// derived magnitude) is the same instrument, so it's not a separate button. `temp` is REMOVED —
// ambient temperature has no instrument on real phones (deprecated 2026-06-17). `screen` is
// excluded until it has a capture/render path (SP6). A source a frame can't render yet shows an
// honest idle (camera-parity, CONTENT.md §6) — location idle on the live stream until the SP5 relay.
// RAIL ICON ORDER — matches the DASHBOARD's arming order (identity · location · chat · cam · audio
// · sensors), so the rail reads the same as where you armed the sources. (This is the display order;
// the DEFAULT selected view is a SEPARATE importance order — see DEFAULT_VIEW_PRIORITY.)
export const SOURCE_RAIL_ORDER: FeedKind[] = [
  'profile', 'loc', 'chat', 'cam', 'audio', 'compass', 'gyro', 'accel', 'speed', 'torch',
]

// DEFAULT VIEW priority (Ben 2026-06-17) — which source to DEFAULT to when the page opens / the more
// important one isn't armed: camera · audio · compass · gyro · accel · speed · torch · location · id.
// (location is second-last; identity last.) NOT the rail display order. `chat` is the final fallback.
const DEFAULT_VIEW_PRIORITY: FeedKind[] = [
  'cam', 'audio', 'compass', 'gyro', 'accel', 'speed', 'torch', 'loc', 'profile', 'chat',
]

// The default source to show given the armed/captured set — the most important one available.
export function pickDefaultView(available: FeedKind[]): FeedKind {
  return DEFAULT_VIEW_PRIORITY.find((k) => available.includes(k)) ?? available[0] ?? 'cam'
}

// Backend / buffer track-kind name → FeedKind. The rail shows ARMED (live) / CAPTURED (clip)
// sources only; both arrive as these backend names (Stream.sources / BufferSession.kinds), so the
// screens map them to FeedKind to filter SOURCE_RAIL_ORDER. (profile/motion/temp aren't backend
// tracks — profile is the always-present identity flag; motion is a viewer-derived view of accel.)
export const KIND_TO_FEEDKIND: Record<string, FeedKind | undefined> = {
  camera: 'cam',
  audio: 'audio',
  screen: 'screen',
  location: 'loc',
  compass: 'compass',
  gyro: 'gyro',
  accel: 'accel',
  speed: 'speed',
  torch: 'torch',
  chat: 'chat',
}
