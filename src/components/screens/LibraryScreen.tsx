import { StyleSheet, View, FlatList, ActivityIndicator } from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { Card } from '@/components/primitives/Card'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { useRecordings } from '@/hooks/useRecordings'
import type { Recording } from '@/types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDuration(sec: number | null): string {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function RecordingRow({ recording }: { recording: Recording }) {
  const isUnedited = recording._count.clips === 0
  const isReady = recording.status === 'ready'
  const isInProgress = recording.status === 'recording'

  return (
    <Card variant="panel" style={styles.row}>
      <View style={styles.rowHeader}>
        <Text variant="bodyEmphasized" color={theme.colors.text.primary}>
          {formatDate(recording.startedAt)}
        </Text>
        <View style={styles.rowBadges}>
          {isInProgress && <Pill size="sm" variant="accent" label="RECORDING" />}
          {isReady && isUnedited && <Pill size="sm" label="UNEDITED" />}
          {recording.status === 'failed' && <Pill size="sm" label="FAILED" />}
        </View>
      </View>
      <Text variant="caption" color={theme.colors.text.muted}>
        {formatTime(recording.startedAt)}
        {isReady && recording.durationSec !== null ? `  ·  ${formatDuration(recording.durationSec)}` : ''}
        {isReady && recording.sizeBytes > 0 ? `  ·  ${formatSize(recording.sizeBytes)}` : ''}
      </Text>
      {recording.expiresAt ? (
        <Text variant="caption" color={theme.colors.text.muted} style={styles.expiry}>
          Expires {formatDate(recording.expiresAt)}
        </Text>
      ) : null}
    </Card>
  )
}

export const LibraryScreen = () => {
  const { isSignedIn } = useAuth()
  const { data: recordings, isLoading, isError } = useRecordings(!!isSignedIn)

  if (!isSignedIn) {
    return (
      <ScreenScroll contentContainerStyle={styles.centeredContent}>
        <Text variant="body" color={theme.colors.text.muted} style={styles.centeredText}>
          Sign in to see your recordings.
        </Text>
      </ScreenScroll>
    )
  }

  if (isLoading) {
    return (
      <ScreenScroll contentContainerStyle={styles.centeredContent}>
        <ActivityIndicator color={theme.colors.accent.default} />
      </ScreenScroll>
    )
  }

  if (isError) {
    return (
      <ScreenScroll contentContainerStyle={styles.centeredContent}>
        <Text variant="body" color={theme.colors.text.muted} style={styles.centeredText}>
          Could not load recordings.
        </Text>
      </ScreenScroll>
    )
  }

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Text variant="heading">Library</Text>
      </View>
      {!recordings?.length ? (
        <View style={styles.centeredContent}>
          <Text variant="body" color={theme.colors.text.muted} style={styles.centeredText}>
            Your recordings will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RecordingRow recording={item} />}
          contentContainerStyle={styles.list}
          scrollEnabled={false}
        />
      )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  row: {
    gap: theme.spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowBadges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  expiry: {
    marginTop: theme.spacing.xs,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  centeredText: {
    textAlign: 'center',
  },
})
