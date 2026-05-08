import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { theme } from '@/lib/theme'
import { useLocation } from '@/hooks/useLocation'
import { useStreamsNear } from '@/hooks/useStreamsNear'
import type { Stream } from '@/types'

function StreamCard({ stream }: { stream: Stream }) {
  const roomId = stream.mediasoupRoomId
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => roomId && router.push(`/(app)/stream/${roomId}`)}
      disabled={!roomId}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{stream.title}</Text>
        <Text style={styles.live}>● LIVE</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardMeta}>{stream.host?.displayName ?? stream.hostDisplayName}</Text>
        <Text style={styles.cardMeta}>
          {stream.distanceKm != null ? `${stream.distanceKm.toFixed(1)} km` : ''}
          {stream.viewerCount > 0 ? `  ·  ${stream.viewerCount} watching` : ''}
        </Text>
      </View>
    </Pressable>
  )
}

export default function Globe() {
  const { coords, loading: locationLoading, error: locationError } = useLocation()
  const {
    data: streams,
    isLoading: streamsLoading,
    error: streamsError,
    refetch,
  } = useStreamsNear(coords?.latitude ?? null, coords?.longitude ?? null)

  const loading = locationLoading || streamsLoading

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WRLD</Text>
        <Text style={styles.subtitle}>Phase 5: 3D globe renders here</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.muted}>
            {locationLoading ? 'Getting location…' : 'Finding streams…'}
          </Text>
        </View>
      )}

      {!loading && locationError && (
        <View style={styles.center}>
          <Text style={styles.muted}>{locationError}</Text>
        </View>
      )}

      {!loading && streamsError && (
        <View style={styles.center}>
          <Text style={styles.muted}>Could not load streams</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!loading && streams && streams.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.muted}>No live streams nearby</Text>
        </View>
      )}

      {!loading && streams && streams.length > 0 && (
        <FlatList
          data={streams}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <StreamCard stream={item} />}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { padding: theme.spacing.lg, alignItems: 'center' },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.sm },
  muted: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  link: { ...theme.typography.body, color: theme.colors.accent },
  list: { padding: theme.spacing.md, gap: theme.spacing.sm },
  card: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  cardPressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600', flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: { ...theme.typography.caption, color: theme.colors.textMuted },
  live: { ...theme.typography.caption, color: theme.colors.live, fontWeight: '600' },
})
