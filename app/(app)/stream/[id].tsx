import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { theme } from '@/lib/theme'
import { useSignaling } from '@/hooks/useSignaling'
import { useLocation } from '@/hooks/useLocation'
import { useAuth } from '@clerk/clerk-expo'

export default function StreamView() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew = id === 'new'
  const { status, roomId, producers, error, setError, connect, createRoom, joinRoom, disconnect } =
    useSignaling()
  const { isSignedIn } = useAuth()
  const [title, setTitle] = useState('')
  const { coords, loading: locationLoading, error: locationError } = useLocation()

  async function handleGoLive() {
    if (!title.trim() || !coords) return
    try {
      await connect()
      await createRoom({ title: title.trim(), lat: coords.latitude, lng: coords.longitude })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to go live')
    }
  }

  async function handleJoin() {
    try {
      await connect()
      await joinRoom(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join stream')
    }
  }

  function handleLeave() {
    disconnect()
    router.back()
  }

  const canGoLive = !!title.trim() && !!coords && !locationLoading

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{isNew ? 'Go Live' : 'Watch'}</Text>

        {status === 'idle' && (
          <View style={styles.actions}>
            {isNew && isSignedIn && (
              <>
                <Input
                  placeholder="Stream title"
                  value={title}
                  onChangeText={setTitle}
                  style={styles.wide}
                />
                {locationLoading && (
                  <View style={styles.statusRow}>
                    <ActivityIndicator color={theme.colors.accent} size="small" />
                    <Text style={styles.muted}>Detecting location…</Text>
                  </View>
                )}
                {locationError && <Text style={styles.muted}>{locationError}</Text>}
                {coords && !locationLoading && (
                  <Text style={styles.muted}>
                    {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                  </Text>
                )}
                <Button
                  label="Start stream"
                  onPress={handleGoLive}
                  disabled={!canGoLive}
                  style={styles.wide}
                />
              </>
            )}
            {isNew && !isSignedIn && <Text style={styles.muted}>Sign in to go live</Text>}
            {!isNew && <Button label="Join stream" onPress={handleJoin} style={styles.wide} />}
            <Button label="Back" onPress={() => router.back()} variant="secondary" style={styles.wide} />
          </View>
        )}

        {(status === 'connecting' || status === 'connected' || status === 'authenticated') && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.muted}>
              {status === 'connecting' && 'Connecting…'}
              {status === 'connected' && 'Authenticating…'}
              {status === 'authenticated' && 'Entering room…'}
            </Text>
          </View>
        )}

        {status === 'in-room' && (
          <View style={styles.roomInfo}>
            <Text style={styles.live}>● LIVE</Text>
            <Text style={styles.roomId}>{roomId}</Text>
            {producers.length > 0 && (
              <Text style={styles.muted}>{producers.length} producer(s) active</Text>
            )}
            <Button label="Leave" onPress={handleLeave} variant="danger" />
          </View>
        )}

        {status === 'error' && (
          <View style={styles.actions}>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Retry" onPress={isNew ? handleGoLive : handleJoin} />
            <Button label="Back" onPress={() => router.back()} variant="secondary" />
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: theme.colors.text },
  muted: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  errorText: { ...theme.typography.body, color: theme.colors.danger, textAlign: 'center' },
  live: { ...theme.typography.heading, color: theme.colors.live },
  roomId: { ...theme.typography.caption, color: theme.colors.textMuted, fontFamily: 'monospace' },
  actions: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  roomInfo: { width: '100%', alignItems: 'center', gap: theme.spacing.md },
  wide: { width: '100%' },
})
