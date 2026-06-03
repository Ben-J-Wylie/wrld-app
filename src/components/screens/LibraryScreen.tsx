import { StyleSheet, View, FlatList, ActivityIndicator, Image, Pressable, Alert } from 'react-native'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { Pill } from '@/components/primitives/Pill'
import { Card } from '@/components/primitives/Card'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { useRecordings } from '@/hooks/useRecordings'
import { useAuthStore } from '@/stores/authStore'
import { recordingsApi } from '@/api/recordings'
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

function RecordingRow({ recording, onDelete }: { recording: Recording; onDelete: (id: string) => void }) {
  const isUnedited = recording._count.clips === 0
  const isReady = recording.status === 'ready'
  const isInProgress = recording.status === 'recording'
  const [deleting, setDeleting] = useState(false)

  function handleDelete() {
    Alert.alert(
      'Delete recording',
      'This will permanently delete the recording and any clips from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await recordingsApi.delete(recording.id)
              onDelete(recording.id)
            } catch {
              setDeleting(false)
              Alert.alert('Error', 'Could not delete recording. Please try again.')
            }
          },
        },
      ],
    )
  }

  return (
    <Card variant="panel" style={styles.row}>
      <View style={styles.rowInner}>
        {recording.thumbnailUrl ? (
          <Image
            source={{ uri: recording.thumbnailUrl }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.rowBody}>
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
          {!isInProgress && (
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={styles.deleteBtn}
              hitSlop={8}
            >
              <Text variant="caption" color={deleting ? theme.colors.text.subtle : '#E5534B'}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Card>
  )
}

export const LibraryScreen = () => {
  const { isSignedIn } = useAuth()
  const wrldUser = useAuthStore(s => s.wrldUser)
  const { data: recordings, isLoading, isError, refetch } = useRecordings(!!isSignedIn)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const usedBytes = wrldUser?.usedStorageBytes ?? 0
  const quotaBytes = wrldUser?.storageQuotaBytes ?? 0
  const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0
  const quotaGb = quotaBytes > 0 ? parseFloat((quotaBytes / 1024 ** 3).toFixed(1)).toString() : null

  useFocusEffect(useCallback(() => {
    if (isSignedIn) refetch()
  }, [isSignedIn]))

  function handleDelete(id: string) {
    setDeletedIds(prev => new Set([...prev, id]))
  }

  const visibleRecordings = (recordings ?? []).filter(r => !deletedIds.has(r.id))

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
        <Text variant="body" color={theme.colors.text.primary} style={styles.centeredText}>
          No connection
        </Text>
        <Text variant="caption" color={theme.colors.text.muted} style={styles.centeredText}>
          Check your internet connection and try again.
        </Text>
        <Text variant="caption" color={theme.colors.text.muted} style={styles.centeredText}>
          Your recordings and clips are safely stored online.
        </Text>
        <Pressable onPress={() => refetch()} style={styles.retryBtn}>
          <Text variant="monoLabel" color={theme.colors.accent.default}>
            Try again
          </Text>
        </Pressable>
      </ScreenScroll>
    )
  }

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Text variant="heading">Library</Text>
        {quotaGb !== null && (
          <Text variant="caption" color={pct >= 90 ? '#E5534B' : theme.colors.text.muted}>
            {pct}% of {quotaGb} GB used
          </Text>
        )}
      </View>
      {!visibleRecordings.length ? (
        <View style={styles.centeredContent}>
          <Text variant="body" color={theme.colors.text.muted} style={styles.centeredText}>
            Your recordings will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleRecordings}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RecordingRow recording={item} onDelete={handleDelete} />}
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
    gap: 2,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  row: {
    padding: 0,
    overflow: 'hidden',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: {
    width: 80,
    height: 60,
    borderTopLeftRadius: theme.radius.md,
    borderBottomLeftRadius: theme.radius.md,
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.bg.elevated,
  },
  rowBody: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  rowBadges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  expiry: {
    marginTop: 2,
  },
  deleteBtn: {
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-start',
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
  retryBtn: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.accent.default,
  },
})
