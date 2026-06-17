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
// page), so the rails are identical. Matches the DASHBOARD's arming order (identity · location ·
// chat · cam · audio · sensors — accel sits under motion). `screen` is excluded until it has any
// capture/render path (SP6). A source a given frame can't render yet shows an honest idle (the
// camera-parity principle, CONTENT.md §6) — e.g. location idle on the live stream until the relay
// lands (SP5); profile/motion/temp/torch idle on a recorded clip.
export const SOURCE_RAIL_ORDER: FeedKind[] = [
  'profile', 'loc', 'chat', 'cam', 'audio', 'compass', 'gyro', 'motion', 'accel', 'speed', 'temp', 'torch',
]
