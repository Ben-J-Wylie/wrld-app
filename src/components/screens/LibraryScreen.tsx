import { StyleSheet, View, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native'
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { theme } from '@/tokens/theme'
import { Text } from '@/components/primitives/Text'
import { SavedClipRow } from '@/components/features/clip/SavedClipRow'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { useRecordings } from '@/hooks/useRecordings'
import { useCurrentUser } from '@/hooks/useCurrentUser'
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

// A Recording reskinned as a SavedClipRow. Recordings aren't clips (no name /
// visibility / wired inline playback here), so we map date→title, fold the meta
// into the capturedAt line, surface status via the row's tag override, and route
// delete through the kebab. Collapsed-only (no inline player) + no play glyph,
// since recording playback isn't wired in this surface.
function RecordingRow({ recording, onDelete }: { recording: Recording; onDelete: (id: string) => void }) {
  const isReady = recording.status === 'ready'
  const isInProgress = recording.status === 'recording'
  const isUnedited = recording._count.clips === 0

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
            try {
              await recordingsApi.delete(recording.id)
              onDelete(recording.id)
            } catch {
              Alert.alert('Error', 'Could not delete recording. Please try again.')
            }
          },
        },
      ],
    )
  }

  const tags: { label: string; tone: 'warn' | 'accent' | 'muted' }[] = []
  if (isInProgress) tags.push({ label: 'Recording', tone: 'accent' })
  else if (recording.status === 'failed') tags.push({ label: 'Failed', tone: 'warn' })
  else if (recording.status === 'expired') tags.push({ label: 'Expired', tone: 'muted' })
  else if (isUnedited) tags.push({ label: 'Unedited', tone: 'muted' })
  if (recording.expiresAt) tags.push({ label: `Exp ${formatDate(recording.expiresAt)}`, tone: 'muted' })

  const meta = [
    formatTime(recording.startedAt),
    isReady && recording.durationSec !== null ? formatDuration(recording.durationSec) : null,
    isReady && recording.sizeBytes > 0 ? formatSize(recording.sizeBytes) : null,
  ]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <SavedClipRow
      name={formatDate(recording.startedAt)}
      capturedAt={meta}
      durationSec={recording.durationSec ?? 0}
      thumbnailUrl={recording.thumbnailUrl}
      tags={tags}
      showPlayGlyph={false}
      onKebabPress={isInProgress ? undefined : handleDelete}
    />
  )
}

export const LibraryScreen = () => {
  const { isSignedIn } = useAuth()
  const wrldUser = useAuthStore(s => s.wrldUser)
  const { data: recordings, isLoading, isError, isRefetchError, refetch } = useRecordings(!!isSignedIn)
  // Storage figures come from the live /auth/me query (refetched on focus + 60s, and
  // patched instantly by user_updated WS events) so the bar tracks real usage. Fall
  // back to the store only before the first fetch resolves.
  const { data: me, refetch: refetchMe } = useCurrentUser()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const usedBytes = me?.usedStorageBytes ?? wrldUser?.usedStorageBytes ?? 0
  const quotaBytes = me?.storageQuotaBytes ?? wrldUser?.storageQuotaBytes ?? 0
  const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0
  const quotaGb = quotaBytes > 0 ? parseFloat((quotaBytes / 1024 ** 3).toFixed(1)).toString() : null

  useFocusEffect(useCallback(() => {
    if (isSignedIn) { refetch(); refetchMe() }
  }, [isSignedIn]))

  function handleDelete(id: string) {
    setDeletedIds(prev => new Set([...prev, id]))
  }

  const visibleRecordings = (recordings ?? []).filter(r => !deletedIds.has(r.id))

  if (!isSignedIn) {
    return (
      <ScreenScroll header={<ScreenHeader title="Library" />} contentContainerStyle={styles.centeredContent}>
        <Text variant="body" color={theme.colors.text.muted} style={styles.centeredText}>
          Sign in to see your recordings.
        </Text>
      </ScreenScroll>
    )
  }

  if (isLoading) {
    return (
      <ScreenScroll header={<ScreenHeader title="Library" />} contentContainerStyle={styles.centeredContent}>
        <ActivityIndicator color={theme.colors.accent.default} />
      </ScreenScroll>
    )
  }

  if (isError || isRefetchError) {
    return (
      <ScreenScroll header={<ScreenHeader title="Library" />} contentContainerStyle={styles.centeredContent}>
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
    <ScreenScroll header={<ScreenHeader title="Library" />}>
      {quotaGb !== null && (
        <View style={styles.quotaRow}>
          <Text variant="caption" color={pct >= 90 ? '#E5534B' : theme.colors.text.muted}>
            {pct}% of {quotaGb} GB used
          </Text>
        </View>
      )}
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
  quotaRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
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
