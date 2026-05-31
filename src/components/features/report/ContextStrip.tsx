// src/components/features/report/ContextStrip.tsx
//
// "What you're reporting" header for the Report flow. Thumb (48×48) +
// meta column (title + sub) + LivePill on the right when the target is
// a live broadcast.

import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { LivePill } from '@/components/features/stream/LivePill'
import { Avatar } from '@/components/primitives/Avatar'
import { theme } from '@/tokens/theme'

type TargetKind = 'broadcast' | 'clip' | 'user'

type Props = {
  kind: TargetKind
  title: string
  sub?: string
  thumbnailUrl?: string | null
  displayName?: string
  isLive?: boolean
  style?: StyleProp<ViewStyle>
}

export function ContextStrip({
  kind,
  title,
  sub,
  thumbnailUrl,
  displayName,
  isLive,
  style,
}: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.thumbWrap}>
        {kind === 'user' ? (
          <Avatar avatarUrl={thumbnailUrl} displayName={displayName ?? title} size="md" />
        ) : thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumb as ImageStyle} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Icon
              name={kind === 'clip' ? 'film' : 'video'}
              size="md"
              color={theme.colors.text.subtle}
            />
          </View>
        )}
      </View>
      <View style={styles.col}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {title}
        </Text>
        {sub && (
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={2}>
            {sub}
          </Text>
        )}
      </View>
      {isLive && <LivePill size="sm" />}
    </View>
  )
}

const THUMB = 48

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
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
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
