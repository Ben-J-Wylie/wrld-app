// src/components/features/clip/ClipCard.tsx
//
// Grid card in the Profile + My Profile clip grids. 16:11 thumbnail
// with overlay metadata + a meta column below. Two variants:
//
//   public — title / venue / date below, peak viewer count in a pill
//            top-right, duration pill top-left
//   owner  — adds a 5-tile layer-badge row (which of CAM / AUD / LOC
//            / ID / GYR were active in the recording). `anon` flag
//            adds a desaturated + diagonal-stripe overlay + "ONLY
//            VISIBLE TO YOU" caption. `draft` shows a DRAFT pill in
//            the top-right slot instead of viewer count.
//
// Consumer-flat shape; the feature is domain-blind (no `Clip` import).

import type { ComponentProps } from 'react'
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Variant = 'public' | 'owner'
type IconName = ComponentProps<typeof Icon>['name']

export type ClipLayer = 'cam' | 'aud' | 'loc' | 'id' | 'gyr'

type Props = {
  variant?: Variant
  thumbnailUrl?: string | null
  title: string
  venue?: string
  date?: string
  durationSec: number
  peakViewerCount?: number
  layers?: ClipLayer[]
  anon?: boolean
  draft?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

const LAYER_ORDER: ClipLayer[] = ['cam', 'aud', 'loc', 'id', 'gyr']

const LAYER_ICON: Record<ClipLayer, IconName> = {
  cam: 'video',
  aud: 'mic',
  loc: 'map-pin',
  id: 'user',
  gyr: 'navigation',
}

export function ClipCard({
  variant = 'public',
  thumbnailUrl,
  title,
  venue,
  date,
  durationSec,
  peakViewerCount,
  layers,
  anon,
  draft,
  onPress,
  style,
}: Props) {
  const body = (
    <>
      <View style={styles.thumbWrap}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumb as ImageStyle} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Icon name="video" size="lg" color={theme.colors.text.subtle} />
          </View>
        )}
        {anon && variant === 'owner' && <View style={styles.anonOverlay} />}
        <View style={styles.durationPill}>
          <Text variant="monoLabel" color={theme.colors.text.inverse}>
            {formatDuration(durationSec)}
          </Text>
        </View>
        {draft ? (
          <View style={[styles.cornerPill, styles.draftPill]}>
            <Text variant="monoLabel" color={theme.colors.text.inverse}>
              DRAFT
            </Text>
          </View>
        ) : anon && variant === 'owner' ? (
          <View style={[styles.cornerPill, styles.lockPill]}>
            <Icon name="lock" size="sm" color={theme.colors.text.inverse} />
          </View>
        ) : peakViewerCount !== undefined && peakViewerCount > 0 ? (
          <View style={[styles.cornerPill, styles.viewerPill]}>
            <Icon name="eye" size="sm" color={theme.colors.text.inverse} />
            <Text variant="monoCaption" color={theme.colors.text.inverse}>
              {formatCount(peakViewerCount)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {title}
        </Text>
        {(venue || date) && (
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
            {[venue, date].filter(Boolean).join(' · ')}
          </Text>
        )}
        {variant === 'owner' && layers && (
          <View style={styles.layerRow}>
            {LAYER_ORDER.map((l) => {
              const active = layers.includes(l)
              return (
                <View
                  key={l}
                  style={[
                    styles.layerTile,
                    active && styles.layerTileActive,
                  ]}
                >
                  <Icon
                    name={LAYER_ICON[l]}
                    size="sm"
                    color={active ? theme.colors.accent.default : theme.colors.text.subtle}
                  />
                </View>
              )
            })}
          </View>
        )}
        {variant === 'owner' && anon && (
          <Text variant="monoLabel" color={theme.colors.text.subtle}>
            ONLY VISIBLE TO YOU
          </Text>
        )}
      </View>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[styles.card, style]}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={[styles.card, style]}>{body}</View>
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const LAYER_TILE = 22

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  thumbWrap: {
    aspectRatio: 16 / 11,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  durationPill: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cornerPill: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.md,
  },
  viewerPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  draftPill: {
    backgroundColor: theme.colors.accent.default,
  },
  lockPill: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  meta: {
    padding: theme.spacing.sm,
    gap: 4,
  },
  layerRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  layerTile: {
    width: LAYER_TILE,
    height: LAYER_TILE,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerTileActive: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
})
