import { View, Text, StyleSheet, Pressable } from 'react-native'
import { theme } from '@/lib/theme'
import type { Stream, SourceType } from '@/types'

const SOURCE_ICONS: Record<SourceType, string> = { camera: '📷', audio: '🎙️' }

type Props = {
  stream: Stream
  onPress: () => void
}

export function NearbyStreamRow({ stream, onPress }: Props) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>{stream.title}</Text>
        <View style={styles.meta}>
          {(stream.sources ?? []).map((s) => (
            <View key={s} style={styles.badge}>
              <Text style={styles.badgeText}>{SOURCE_ICONS[s]}</Text>
            </View>
          ))}
          <Text style={styles.viewers}>{stream.viewerCount} watching</Text>
        </View>
      </View>
      {stream.distanceMeters !== undefined && (
        <Text style={styles.distance}>{stream.distanceMeters}m</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  main: { flex: 1, gap: theme.spacing.xs },
  title: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  badge: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 12 },
  viewers: { ...theme.typography.caption, color: theme.colors.textMuted },
  distance: { ...theme.typography.caption, color: theme.colors.textMuted, flexShrink: 0 },
})
