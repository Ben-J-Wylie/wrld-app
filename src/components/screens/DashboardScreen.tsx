// src/components/screens/DashboardScreen.tsx
//
// 12.6 migration target — the Go Live arming screen. Composes:
//   • ScreenScroll wrapping the whole screen
//   • Input + HelpText for the title field
//   • FeedRow for each broadcastable layer. Per the re-baseline, the
//     screen now surfaces the full 7-layer sensor model in the UI
//     (cam / audio / screen / loc / gyro / compass / profile); only
//     cam + audio are armable today — the other 5 ship in `disabled`
//     state so users see the design-complete model now and the
//     backend can fill in over time without UI churn.
//   • CoordHUD (viewer-sheet variant) for the live LAT / LON read.
//     Pending state appears while permission/GPS is acquiring.
//   • GoBar docked at the bottom — `disabled` while inputs are
//     incomplete, `armed` once title + ≥1 source + GPS are ready.
//     The bar's tap navigates straight to the stream screen; live
//     state lives on that screen, not here.

import { useState, useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Icon } from '@/components/primitives/Icon'
import { FeedRow, type FeedState } from '@/components/features/broadcast/FeedRow'
import { type FeedKind } from '@/components/features/broadcast/FeedThumb'
import { CoordHUD } from '@/components/features/stream/CoordHUD'
import { GoBar } from '@/components/features/broadcast/GoBar'
import { useAuth } from '@clerk/clerk-expo'
import { useLocation } from '@/hooks/useLocation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { activeBroadcast } from '@/lib/activeBroadcast'
import type { SourceType } from '@/types'

type FeedDescriptor = {
  kind: FeedKind
  label: string
  armedDetail: string
  offDetail: string
  source?: SourceType
}

// Order matches the 7-layer sensor model. `source` maps to the existing
// backend SourceType enum (Phase 7) — only cam + audio have backend
// hooks today; the rest ship in `disabled` state per the spec.
const FEEDS: FeedDescriptor[] = [
  { kind: 'cam', label: 'Camera', armedDetail: '1080P · BACK', offDetail: 'Tap Ready to arm camera', source: 'camera' },
  { kind: 'audio', label: 'Audio', armedDetail: '48 kHz · DEFAULT MIC', offDetail: 'Tap Ready to arm microphone', source: 'audio' },
  { kind: 'screen', label: 'Screen', armedDetail: 'System screen capture', offDetail: 'Coming soon' },
  { kind: 'loc', label: 'Location', armedDetail: 'GPS · SHARE GRANULAR', offDetail: 'Coming soon' },
  { kind: 'gyro', label: 'Gyroscope', armedDetail: 'Device orientation', offDetail: 'Coming soon' },
  { kind: 'compass', label: 'Compass', armedDetail: 'Heading', offDetail: 'Coming soon' },
  { kind: 'profile', label: 'Identity', armedDetail: 'Shown to viewers', offDetail: 'Coming soon' },
]

export function DashboardScreen() {
  const { isSignedIn } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const { coords, loading: locationLoading, error: locationError } = useLocation()

  const [title, setTitle] = useState('')
  const [readySources, setReadySources] = useState<Set<SourceType>>(new Set())

  useFocusEffect(useCallback(() => {
    const active = activeBroadcast.get()
    if (!active) return
    // Defer past the tab-transition commit so the navigate doesn't
    // conflict with the incoming tab switch.
    const t = setTimeout(() => {
      router.navigate({
        pathname: '/(app)/stream/[id]',
        params: { id: 'new', title: active.title, sources: active.sources },
      })
    }, 0)
    return () => clearTimeout(t)
  }, []))

  function toggleSource(type: SourceType) {
    setReadySources((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function handleGoLive() {
    if (!canGoLive) return
    const params = {
      title: title.trim(),
      sources: Array.from(readySources).join(','),
      lat: String(coords!.latitude),
      lng: String(coords!.longitude),
    }
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
      <ScreenScroll contentContainerStyle={styles.center}>
        <Text variant="display">Go Live</Text>
        <Text variant="body" color={theme.colors.text.muted}>
          Sign in to go live
        </Text>
        <Button
          label="Sign In"
          onPress={() => router.push('/(auth)/login')}
          variant="secondary"
        />
      </ScreenScroll>
    )
  }

  if (currentUser && !currentUser.creatorReady) {
    return (
      <ScreenScroll contentContainerStyle={styles.center}>
        <View style={styles.creatorBadge}>
          <Icon name="film" size="lg" color={theme.colors.accent.default} />
        </View>
        <Text variant="display" style={styles.centerText}>
          Become a creator
        </Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.centerText}>
          Complete a quick setup to unlock Go Live on WRLD. It only takes a minute.
        </Text>
        <Button
          label="Get started"
          onPress={() => router.push('/(app)/creator-onboarding')}
        />
      </ScreenScroll>
    )
  }

  const coordItems = [
    {
      label: 'LAT',
      value: coords ? coords.latitude.toFixed(4) : locationError ? '—' : '...',
      pending: !coords && !locationError,
    },
    {
      label: 'LON',
      value: coords ? coords.longitude.toFixed(4) : locationError ? '—' : '...',
      pending: !coords && !locationError,
    },
  ]

  return (
    <ScreenScroll contentContainerStyle={styles.scroll}>
      <Text variant="display">Go Live</Text>

      <View style={styles.section}>
        <HelpText>TITLE</HelpText>
        <Input
          placeholder="What's happening?"
          value={title}
          onChangeText={setTitle}
          autoCorrect={false}
        />
      </View>

      <View style={styles.section}>
        <HelpText>SOURCES</HelpText>
        <HelpText>CHOOSE WHAT YOU'LL BROADCAST · SWITCHABLE ONCE LIVE</HelpText>
        <View style={styles.feeds}>
          {FEEDS.map((feed) => {
            const supported = feed.source !== undefined
            const armed = !!feed.source && readySources.has(feed.source)
            const state: FeedState = !supported ? 'disabled' : armed ? 'armed' : 'off'
            return (
              <FeedRow
                key={feed.kind}
                kind={feed.kind}
                label={feed.label}
                detail={armed ? feed.armedDetail : feed.offDetail}
                state={state}
                on={armed}
                onToggle={() => feed.source && toggleSource(feed.source)}
              />
            )
          })}
        </View>
      </View>

      <View style={styles.section}>
        <HelpText>LOCATION</HelpText>
        {locationError ? (
          <Text variant="body" color={theme.colors.text.muted}>
            {locationError}
          </Text>
        ) : (
          <CoordHUD items={coordItems} />
        )}
      </View>

      <GoBar
        variant={canGoLive ? 'armed' : 'disabled'}
        onPress={handleGoLive}
      />
      {readySources.size === 0 && (
        <HelpText style={styles.hint}>READY AT LEAST ONE SOURCE TO GO LIVE</HelpText>
      )}
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  center: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  centerText: {
    textAlign: 'center',
  },
  creatorBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  section: {
    gap: theme.spacing.sm,
  },
  feeds: {
    gap: theme.spacing.sm,
  },
  hint: {
    textAlign: 'center',
  },
})
