import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useState } from 'react'
import { theme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@clerk/clerk-expo'
import { useLocation } from '@/hooks/useLocation'
import type { LayerType } from '@/types'

const LAYERS: { type: LayerType; label: string; icon: string }[] = [
  { type: 'camera', label: 'Camera', icon: '📷' },
  { type: 'audio', label: 'Audio', icon: '🎙️' },
]

export default function Dashboard() {
  const { isSignedIn } = useAuth()
  const { coords, loading: locationLoading, error: locationError } = useLocation()

  const [title, setTitle] = useState('')
  const [readyLayers, setReadyLayers] = useState<Set<LayerType>>(new Set())

  function toggleLayer(type: LayerType) {
    setReadyLayers((prev: Set<LayerType>) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function handleGoLive() {
    if (!title.trim() || !coords || readyLayers.size === 0) return
    router.push({
      pathname: '/(app)/stream/new',
      params: {
        title: title.trim(),
        layers: Array.from(readyLayers).join(','),
      },
    })
  }

  const canGoLive =
    isSignedIn &&
    !!title.trim() &&
    !!coords &&
    !locationLoading &&
    readyLayers.size > 0

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scroll}>
          <Text style={styles.title}>Go Live</Text>
          <Text style={styles.muted}>Sign in to broadcast</Text>
          <Button
            label="Sign In"
            onPress={() => router.push('/(auth)/login')}
            variant="secondary"
            style={styles.wide}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scroll}>
        <Text style={styles.title}>Go Live</Text>

        {/* Stream title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TITLE</Text>
          <Input
            placeholder="What's happening?"
            value={title}
            onChangeText={setTitle}
            autoCorrect={false}
            style={styles.wide}
          />
        </View>

        {/* Layer cards */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LAYERS</Text>
          <Text style={styles.sectionHint}>Choose what you'll broadcast. You can switch layers once live.</Text>
          <View style={styles.layerGrid}>
            {LAYERS.map(({ type, label, icon }) => {
              const ready = readyLayers.has(type)
              return (
                <Pressable
                  key={type}
                  style={[styles.layerCard, ready && styles.layerCardReady]}
                  onPress={() => toggleLayer(type)}
                >
                  <Text style={styles.layerIcon}>{icon}</Text>
                  <Text style={[styles.layerLabel, ready && styles.layerLabelReady]}>{label}</Text>
                  <View style={[styles.readyPill, ready && styles.readyPillActive]}>
                    <Text style={[styles.readyPillText, ready && styles.readyPillTextActive]}>
                      {ready ? 'READY' : 'OFF'}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          {locationLoading && (
            <View style={styles.row}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <Text style={styles.muted}>Detecting…</Text>
            </View>
          )}
          {locationError && <Text style={styles.muted}>{locationError}</Text>}
          {coords && !locationLoading && (
            <Text style={styles.muted}>
              {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
            </Text>
          )}
        </View>

        {/* Go Live */}
        <Button
          label="Go Live"
          onPress={handleGoLive}
          disabled={!canGoLive}
          style={styles.wide}
        />

        {readyLayers.size === 0 && (
          <Text style={styles.hint}>Ready at least one layer to go live</Text>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: {
    flex: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.sm },
  section: { gap: theme.spacing.sm },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sectionHint: { ...theme.typography.caption, color: theme.colors.textMuted },
  layerGrid: { flexDirection: 'row', gap: theme.spacing.sm },
  layerCard: {
    flex: 1,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  layerCardReady: {
    borderColor: theme.colors.live,
    backgroundColor: '#1A0A10',
  },
  layerIcon: { fontSize: 28 },
  layerLabel: { ...theme.typography.body, color: theme.colors.textMuted, fontWeight: '600' },
  layerLabelReady: { color: theme.colors.text },
  readyPill: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.xs,
  },
  readyPillActive: { backgroundColor: theme.colors.live },
  readyPillText: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '700' },
  readyPillTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  muted: { ...theme.typography.body, color: theme.colors.textMuted },
  errorText: { ...theme.typography.body, color: theme.colors.danger },
  hint: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  wide: { width: '100%' },
})
