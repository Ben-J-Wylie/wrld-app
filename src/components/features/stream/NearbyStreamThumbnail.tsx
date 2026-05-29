import { View, Text, StyleSheet, Pressable } from 'react-native'
import { theme } from '@/tokens/theme'
import type { Stream, SourceType } from '@/types'

const SOURCE_ICONS: Record<SourceType, string> = { camera: '📷', audio: '🎙️' }

type Props = {
  stream: Stream
  onPress: () => void
}

export function NearbyStreamThumbnail({ stream, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.title} numberOfLines={1}>{stream.title}</Text>
      <View style={styles.badges}>
        {(stream.sources ?? []).map((s) => (
          <View key={s} style={styles.badge}>
            <Text style={styles.badgeText}>{SOURCE_ICONS[s]}</Text>
          </View>
        ))}
      </View>
      {stream.distanceMeters !== undefined && (
        <Text style={styles.distance}>{stream.distanceMeters}m</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  badge: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
  },
  distance: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
})
