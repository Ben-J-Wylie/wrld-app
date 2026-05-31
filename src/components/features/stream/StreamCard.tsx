// src/components/features/stream/StreamCard.tsx
//
// Unified card for stream surfaces. Three variants:
//
//   trending  — vertical 158-wide card for horizontal scrolls
//               (future TrendingRail). 16:9-ish thumb on top with
//               LivePill + viewer count overlays; title + city·channel
//               meta underneath.
//   preview   — 16:10 hero used by the Viewer Sheet preview. LivePill
//               top-left, eye+count top-right, channel label bottom-
//               left, optional play button center.
//   compact   — full-width row with a small thumbnail + title + meta
//               on the right. Replaces NearbyStreamRow's pattern.
//
// Composes: Pressable (wrapper, scale press feedback), Image (thumb),
// Text, Icon, LivePill.
//
// The data shape is consumer-flat — not a `Stream` object — so the
// feature stays domain-blind. The consumer screen (e.g. GlobeScreen,
// SearchScreen) reads from its query / store and passes the fields.

import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { LivePill } from './LivePill'
import { VideoPreviewTile } from './VideoPreviewTile'
import { theme } from '@/tokens/theme'

type Variant = 'trending' | 'preview' | 'compact'

type Props = {
  variant?: Variant
  thumbnailUrl?: string | null
  title: string
  viewerCount: number
  channel?: string
  city?: string
  isLive?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function StreamCard(props: Props) {
  const { variant = 'trending' } = props
  if (variant === 'preview') return <PreviewCard {...props} />
  if (variant === 'compact') return <CompactCard {...props} />
  return <TrendingCard {...props} />
}

// ─── Trending ────────────────────────────────────────────────────────────────

function TrendingCard({
  thumbnailUrl,
  title,
  viewerCount,
  channel,
  city,
  isLive = true,
  onPress,
  style,
}: Props) {
  return (
    <Pressable
      variant="subtle"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[trendingStyles.card, style]}
    >
      <View style={trendingStyles.thumbWrap}>
        <Thumbnail uri={thumbnailUrl ?? null} style={trendingStyles.thumb} />
        {isLive && (
          <View style={trendingStyles.liveOverlay}>
            <LivePill size="sm" />
          </View>
        )}
        <View style={trendingStyles.viewerOverlay}>
          <Icon name="eye" size="sm" color={theme.colors.text.inverse} />
          <Text variant="monoCaption" color={theme.colors.text.inverse}>
            {formatCount(viewerCount)}
          </Text>
        </View>
      </View>
      <View style={trendingStyles.meta}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {title}
        </Text>
        {(city || channel) && (
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
            {[city, channel].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

const TRENDING_W = 158
const TRENDING_THUMB_H = 88

const trendingStyles = StyleSheet.create({
  card: {
    width: TRENDING_W,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  thumbWrap: {
    width: TRENDING_W,
    height: TRENDING_THUMB_H,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  liveOverlay: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
  },
  viewerOverlay: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  meta: {
    padding: theme.spacing.sm,
    gap: 2,
  },
})

// ─── Preview ─────────────────────────────────────────────────────────────────
// Thin wrapper around VideoPreviewTile so the Viewer Sheet preview shares
// overlay/sizing logic with clip heros and replay thumbnails.

function PreviewCard({
  thumbnailUrl,
  title,
  viewerCount,
  channel,
  isLive = true,
  onPress,
  style,
}: Props) {
  return (
    <VideoPreviewTile
      variant={isLive ? 'live' : 'play'}
      thumbnailUrl={thumbnailUrl}
      viewerCount={viewerCount}
      channel={channel}
      onPress={onPress}
      accessibilityLabel={title}
      style={style}
    />
  )
}

// ─── Compact ─────────────────────────────────────────────────────────────────

function CompactCard({
  thumbnailUrl,
  title,
  viewerCount,
  channel,
  city,
  isLive = true,
  onPress,
  style,
}: Props) {
  return (
    <Pressable
      variant="subtle"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[compactStyles.row, style]}
    >
      <View style={compactStyles.thumbWrap}>
        <Thumbnail uri={thumbnailUrl ?? null} style={compactStyles.thumb} />
        {isLive && (
          <View style={compactStyles.liveOverlay}>
            <LivePill size="sm" />
          </View>
        )}
      </View>
      <View style={compactStyles.meta}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {title}
        </Text>
        <View style={compactStyles.metaRow}>
          {(city || channel) && (
            <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
              {[city, channel].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {formatCount(viewerCount)} watching
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

const COMPACT_THUMB_W = 72
const COMPACT_THUMB_H = 48

const compactStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.sm,
  },
  thumbWrap: {
    width: COMPACT_THUMB_W,
    height: COMPACT_THUMB_H,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  liveOverlay: {
    position: 'absolute',
    top: 4,
    left: 4,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
})

// ─── Shared bits ─────────────────────────────────────────────────────────────

function Thumbnail({ uri, style }: { uri: string | null; style: StyleProp<ImageStyle & ViewStyle> }) {
  if (uri) {
    return <Image source={{ uri }} style={style as StyleProp<ImageStyle>} resizeMode="cover" />
  }
  return (
    <View style={[style as StyleProp<ViewStyle>, thumbStyles.placeholder]}>
      <Icon name="video" size="md" color={theme.colors.text.subtle} />
    </View>
  )
}

const thumbStyles = StyleSheet.create({
  placeholder: {
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
