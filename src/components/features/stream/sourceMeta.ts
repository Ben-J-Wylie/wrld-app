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
