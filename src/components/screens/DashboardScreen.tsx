import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { theme } from '@/tokens/theme'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { useAuth } from '@clerk/clerk-expo'
import { useLocation } from '@/hooks/useLocation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { activeBroadcast } from '@/lib/activeBroadcast'
import type { SourceType } from '@/types'

const SOURCES: { type: SourceType; label: string; icon: string }[] = [
  { type: 'camera', label: 'Camera', icon: '📷' },
  { type: 'audio', label: 'Audio', icon: '🎙️' },
]

export function DashboardScreen() {
  const { isSignedIn } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const { coords, loading: locationLoading, error: locationError } = useLocation()

  const [title, setTitle] = useState('')
  const [readySources, setReadySources] = useState<Set<SourceType>>(new Set())

  // If the user is currently live and tabs back to dashboard, send them straight
  // to their stream instead of the setup page.
  useFocusEffect(useCallback(() => {
    const active = activeBroadcast.get()
    if (active) {
      router.navigate({
        pathname: '/(app)/stream/[id]',
        params: { id: 'new', title: active.title, sources: active.sources },
      })
    }
  }, []))

  function toggleSource(type: SourceType) {
    setReadySources((prev: Set<SourceType>) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function handleGoLive() {
    if (!title.trim() || !coords || readySources.size === 0) return
    const params = { title: title.trim(), sources: Array.from(readySources).join(',') }
    activeBroadcast.set(params)
    router.push({
      pathname: '/(app)/stream/new',
      params,
    })
  }

  const canGoLive =
    isSignedIn &&
    !!title.trim() &&
    !!coords &&
    !locationLoading &&
    readySources.size > 0

  if (!isSignedIn) {
    return (
      <ScreenScroll contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Go Live</Text>
        <Text style={styles.muted}>Sign in to go live</Text>
        <Button
          label="Sign In"
          onPress={() => router.push('/(auth)/login')}
          variant="secondary"
          style={styles.wide}
        />
      </ScreenScroll>
    )
  }

  if (isSignedIn && currentUser && !currentUser.creatorReady) {
    return (
      <ScreenScroll contentContainerStyle={styles.locked}>
        <Text style={styles.lockedEmoji}>🎬</Text>
        <Text style={styles.lockedTitle}>Become a creator</Text>
        <Text style={styles.lockedBody}>
          Complete a quick setup to unlock Go Live on WRLD. It only takes a minute.
        </Text>
        <Button
          label="Get started"
          onPress={() => router.push('/(app)/creator-onboarding')}
          style={styles.wide}
        />
      </ScreenScroll>
    )
  }

  return (
    <ScreenScroll contentContainerStyle={styles.scroll}>
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

        {/* Source cards */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SOURCES</Text>
          <Text style={styles.sectionHint}>Choose what you'll broadcast. You can switch sources once live.</Text>
          <View style={styles.sourceGrid}>
            {SOURCES.map(({ type, label, icon }) => {
              const ready = readySources.has(type)
              return (
                <Pressable
                  key={type}
                  style={[styles.sourceCard, ready && styles.sourceCardReady]}
                  onPress={() => toggleSource(type)}
                >
                  <Text style={styles.sourceIcon}>{icon}</Text>
                  <Text style={[styles.sourceLabel, ready && styles.sourceLabelReady]}>{label}</Text>
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
              <ActivityIndicator color={theme.colors.accent.default} size="small" />
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
        {readySources.size === 0 && (
          <Text style={styles.hint}>Ready at least one source to go live</Text>
        )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  title: { ...theme.typography.display, color: theme.colors.text.primary, marginBottom: theme.spacing.sm },
  section: { gap: theme.spacing.sm },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.text.muted,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sectionHint: { ...theme.typography.caption, color: theme.colors.text.muted },
  sourceGrid: { flexDirection: 'row', gap: theme.spacing.sm },
  sourceCard: {
    flex: 1,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  sourceCardReady: {
    borderColor: theme.colors.accent.default,
    backgroundColor: '#1A0A10',
  },
  sourceIcon: { fontSize: 28 },
  sourceLabel: { ...theme.typography.body, color: theme.colors.text.muted, fontWeight: '600' },
  sourceLabelReady: { color: theme.colors.text.primary },
  readyPill: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    backgroundColor: theme.colors.border.subtle,
    marginTop: theme.spacing.xs,
  },
  readyPillActive: { backgroundColor: theme.colors.accent.default },
  readyPillText: { ...theme.typography.caption, color: theme.colors.text.muted, fontWeight: '700' },
  readyPillTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  muted: { ...theme.typography.body, color: theme.colors.text.muted },
  errorText: { ...theme.typography.body, color: theme.colors.accent.default },
  hint: { ...theme.typography.caption, color: theme.colors.text.muted, textAlign: 'center' },
  wide: { width: '100%' },
  locked: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  lockedEmoji: { fontSize: 52, textAlign: 'center', marginBottom: theme.spacing.sm },
  lockedTitle: { ...theme.typography.display, color: theme.colors.text.primary, textAlign: 'center' },
  lockedBody: {
    ...theme.typography.body,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
})
