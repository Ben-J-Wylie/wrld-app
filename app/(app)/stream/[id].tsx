import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { theme } from '@/lib/theme'
import { useSignaling } from '@/hooks/useSignaling'
import { useLocation } from '@/hooks/useLocation'
import { useAuth } from '@clerk/clerk-expo'
import type { LayerType } from '@/types'

const LAYER_LABELS: Record<LayerType, string> = {
  camera: 'Camera',
  audio: 'Audio',
}

export default function StreamView() {
  const { id, title: paramTitle, layers: paramLayers } = useLocalSearchParams<{
    id: string
    title?: string
    layers?: string
  }>()
  const isNew = id === 'new'

  const broadcastLayers: LayerType[] = paramLayers
    ? (paramLayers.split(',').filter(Boolean) as LayerType[])
    : []

  const { status, roomId, viewerCount, error, setError, connect, createRoom, joinRoom, disconnect } =
    useSignaling()
  const { isSignedIn } = useAuth()
  const { coords, loading: locationLoading, error: locationError } = useLocation()
  const [activeLayer, setActiveLayer] = useState<LayerType | null>(null)

  async function handleGoLive() {
    const title = (paramTitle ?? '').trim()
    if (!title || !coords || broadcastLayers.length === 0) return
    try {
      await connect()
      await createRoom({
        title,
        lat: coords.latitude,
        lng: coords.longitude,
        layers: broadcastLayers,
      })
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

  function handleBack() {
    if (status === 'in-room') disconnect()
    router.back()
  }

  const canGoLive = !!paramTitle?.trim() && !!coords && !locationLoading && broadcastLayers.length > 0

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{isNew ? 'Go Live' : 'Watch'}</Text>

        {/* ── Idle ─────────────────────────────────────────────── */}
        {status === 'idle' && (
          <View style={styles.actions}>
            {isNew && isSignedIn && (
              <>
                {paramTitle ? (
                  <Text style={styles.streamTitle}>{paramTitle}</Text>
                ) : null}
                {broadcastLayers.length > 0 && (
                  <View style={styles.layerRow}>
                    {broadcastLayers.map((l) => (
                      <View key={l} style={styles.layerBadge}>
                        <Text style={styles.layerBadgeText}>{LAYER_LABELS[l]}</Text>
                      </View>
                    ))}
                  </View>
                )}
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

        {/* ── Connecting ───────────────────────────────────────── */}
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

        {/* ── In room ──────────────────────────────────────────── */}
        {status === 'in-room' && (
          <View style={styles.roomInfo}>
            <View style={styles.liveRow}>
              <Text style={styles.live}>● LIVE</Text>
              <Text style={styles.roomId}>{roomId}</Text>
            </View>

            {/* Broadcaster: armed layers + viewer count */}
            {isNew && broadcastLayers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>BROADCASTING</Text>
                <View style={styles.layerRow}>
                  {broadcastLayers.map((l) => (
                    <View key={l} style={styles.layerActiveBadge}>
                      <Text style={styles.layerActiveBadgeText}>{LAYER_LABELS[l]}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.viewerCount}>
                  {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
                </Text>
              </View>
            )}

            {/* Viewer: layer switcher based on what the broadcaster armed */}
            {!isNew && broadcastLayers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>LAYERS</Text>
                <View style={styles.layerRow}>
                  {broadcastLayers.map((kind) => (
                    <Pressable
                      key={kind}
                      style={[styles.layerSwitchBtn, activeLayer === kind && styles.layerSwitchBtnActive]}
                      onPress={() => setActiveLayer(kind)}
                    >
                      <Text style={[styles.layerSwitchText, activeLayer === kind && styles.layerSwitchTextActive]}>
                        {LAYER_LABELS[kind]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Button label="Leave" onPress={handleLeave} variant="danger" />
          </View>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
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
  streamTitle: { ...theme.typography.heading, color: theme.colors.text, textAlign: 'center' },
  muted: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  errorText: { ...theme.typography.body, color: theme.colors.danger, textAlign: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  live: { ...theme.typography.heading, color: theme.colors.live },
  roomId: { ...theme.typography.caption, color: theme.colors.textMuted, fontFamily: 'monospace' },
  viewerCount: { ...theme.typography.body, color: theme.colors.textMuted },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  backBtn: { alignSelf: 'flex-start' },
  backArrow: { ...theme.typography.heading, color: theme.colors.text },
  actions: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  roomInfo: { width: '100%', alignItems: 'center', gap: theme.spacing.lg },
  wide: { width: '100%' },
  section: { width: '100%', gap: theme.spacing.sm, alignItems: 'center' },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  layerRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  layerBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  layerBadgeText: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '600' },
  layerActiveBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.live,
  },
  layerActiveBadgeText: { ...theme.typography.caption, color: '#fff', fontWeight: '700' },
  layerSwitchBtn: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  layerSwitchBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: '#0D1830',
  },
  layerSwitchText: { ...theme.typography.body, color: theme.colors.textMuted, fontWeight: '600' },
  layerSwitchTextActive: { color: theme.colors.accent },
})
