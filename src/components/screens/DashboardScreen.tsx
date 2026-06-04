// src/components/screens/DashboardScreen.tsx
//
// Go Live & Record arming screen — rewritten 2026-06-03 for the clips
// initiative (DESIGN.md 2026-06-03 decision-log entry). Going live and
// recording are two independent intents, so the screen exposes:
//   • A pair of ArmButtons (Go Live · Record) summarising each intent.
//   • A grouped source list — each FeedRow carries an Air affordance
//     (broadcast) and a Rec affordance (save to device). All four
//     combinations are valid.
//   • Sensitive sources (camera / audio / location) gate their Rec
//     affordance through RecordConsentSheet — nothing recorded silently.
//   • Location exposes a precision ceiling (capture can't exceed what's
//     shared live). Identity is an Attributed / Anon flag, not a track.
//   • GoBar docked at the bottom commits the broadcast.
//
// Scope (this branch): the broadcast (Air) path for camera + audio works
// end-to-end exactly as before. Rec flags, identity, and precision are
// captured and carried forward in the broadcast params so the live
// on-air-vs-recording indicator can render them; backend record-to-disk,
// anon enforcement, and the extra sensors are follow-ups on `main`
// (Aaron's lane). Screen / gyro / compass ship design-complete but
// `disabled` ("coming soon") until their backend lands.

import { useMemo, useState, useCallback } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Filter as ProfanityFilter } from 'bad-words'

const profanityFilter = new ProfanityFilter()
import { router, useFocusEffect } from 'expo-router'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Icon } from '@/components/primitives/Icon'
import { Toggle } from '@/components/primitives/Toggle'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { FeedRow, type SourceAvailability, type SourceSensitivity } from '@/components/features/broadcast/FeedRow'
import { ArmButton } from '@/components/features/broadcast/ArmButton'
import { RecordConsentSheet } from '@/components/features/broadcast/RecordConsentSheet'
import { type FeedKind } from '@/components/features/broadcast/FeedThumb'
import { CoordHUD } from '@/components/features/stream/CoordHUD'
import { GoBar } from '@/components/features/broadcast/GoBar'
import { useAuth } from '@clerk/clerk-expo'
import { useLocation } from '@/hooks/useLocation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { activeBroadcast } from '@/lib/activeBroadcast'
import type { SourceType } from '@/types'

// A capture source = one row in the grouped list. `broadcastSource` maps
// to the backend SourceType enum where the Air path is wired (camera /
// audio today); sources without one carry their Air flag forward but
// don't enter the live `sources` param.
type SourceDescriptor = {
  kind: FeedKind
  label: string
  detail: string
  sensitivity: SourceSensitivity
  availability: SourceAvailability
  broadcastSource?: SourceType
}

const SOURCES: SourceDescriptor[] = [
  { kind: 'cam', label: 'Camera', detail: 'Rear · 1080p', sensitivity: 'sensitive', availability: 'available', broadcastSource: 'camera' },
  { kind: 'audio', label: 'Audio', detail: 'Mic · 48 kHz', sensitivity: 'sensitive', availability: 'available', broadcastSource: 'audio' },
  { kind: 'loc', label: 'Location', detail: 'GPS', sensitivity: 'sensitive', availability: 'available' },
  { kind: 'screen', label: 'Screen', detail: 'System screen capture', sensitivity: 'sensitive', availability: 'disabled' },
  { kind: 'gyro', label: 'Gyro', detail: 'Orientation', sensitivity: 'benign', availability: 'disabled' },
  { kind: 'compass', label: 'Compass', detail: 'Heading', sensitivity: 'benign', availability: 'disabled' },
]

type PrecisionCeiling = 'bluedot' | 'city' | 'country' | 'private'
const PRECISION_OPTIONS: { value: PrecisionCeiling; label: string }[] = [
  { value: 'bluedot', label: 'BLUEDOT' },
  { value: 'city', label: 'CITY' },
  { value: 'country', label: 'COUNTRY' },
  { value: 'private', label: 'PRIVATE' },
]

type IdentityFlag = 'attributed' | 'anon'
const IDENTITY_OPTIONS: { value: IdentityFlag; label: string }[] = [
  { value: 'attributed', label: 'ATTRIBUTED' },
  { value: 'anon', label: 'ANON' },
]

export function DashboardScreen() {
  const { isSignedIn } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const { coords, loading: locationLoading, error: locationError } = useLocation()

  const [title, setTitle] = useState('')
  const [air, setAir] = useState<Partial<Record<FeedKind, boolean>>>({ cam: true, audio: true })
  const [rec, setRec] = useState<Partial<Record<FeedKind, boolean>>>({ gyro: true, compass: true })
  const [consented, setConsented] = useState<Set<FeedKind>>(new Set())
  const [precision, setPrecision] = useState<PrecisionCeiling>('city')
  const [identity, setIdentity] = useState<IdentityFlag>('attributed')
  const [subscribersOnly, setSubscribersOnly] = useState(false)
  const [consentTarget, setConsentTarget] = useState<SourceDescriptor | null>(null)

  useFocusEffect(useCallback(() => {
    const active = activeBroadcast.get()
    if (!active) return
    const t = setTimeout(() => {
      router.navigate({
        pathname: '/(app)/stream/[id]',
        params: {
          id: 'new',
          title: active.title,
          sources: active.sources,
          subscribersOnly: active.subscribersOnly ?? 'false',
          record: active.record ?? '',
          identity: active.identity ?? 'attributed',
          precision: active.precision ?? 'city',
        },
      })
    }, 0)
    return () => clearTimeout(t)
  }, []))

  function setAirFor(kind: FeedKind, v: boolean) {
    setAir((prev) => ({ ...prev, [kind]: v }))
  }

  // Sensitive sources route Rec-on through the consent sheet; everything
  // else (and any already-consented source) flips immediately.
  function requestRec(src: SourceDescriptor, v: boolean) {
    if (!v) {
      setRec((prev) => ({ ...prev, [src.kind]: false }))
      return
    }
    if (src.sensitivity === 'sensitive' && !consented.has(src.kind)) {
      setConsentTarget(src)
      return
    }
    setRec((prev) => ({ ...prev, [src.kind]: true }))
  }

  function confirmConsent() {
    if (!consentTarget) return
    const kind = consentTarget.kind
    setConsented((prev) => new Set(prev).add(kind))
    setRec((prev) => ({ ...prev, [kind]: true }))
    setConsentTarget(null)
  }

  const broadcastSources = useMemo<SourceType[]>(
    () => SOURCES.filter((s) => s.broadcastSource && air[s.kind]).map((s) => s.broadcastSource!),
    [air],
  )
  const recordKinds = useMemo(
    () => SOURCES.filter((s) => rec[s.kind]).map((s) => s.kind),
    [rec],
  )

  const canGoLive =
    isSignedIn && !!title.trim() && !!coords && !locationLoading && broadcastSources.length > 0

  function handleGoLive() {
    if (!canGoLive) return
    if (profanityFilter.isProfane(title.trim())) {
      Alert.alert('Title not allowed', 'Your stream title contains prohibited content. Please choose a different title.')
      return
    }
    const params = {
      title: title.trim(),
      sources: broadcastSources.join(','),
      lat: String(coords!.latitude),
      lng: String(coords!.longitude),
      subscribersOnly: String(subscribersOnly),
      record: recordKinds.join(','),
      identity,
      precision,
    }
    activeBroadcast.set(params)
    router.push({ pathname: '/(app)/stream/new', params })
  }

  if (!isSignedIn) {
    return (
      <ScreenScroll contentContainerStyle={styles.center}>
        <Text variant="display">Go Live</Text>
        <Text variant="body" color={theme.colors.text.muted}>
          Sign in to go live
        </Text>
        <Button label="Sign In" onPress={() => router.push('/(auth)/login')} variant="secondary" />
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
        <Button label="Get started" onPress={() => router.push('/(app)/creator-onboarding')} />
      </ScreenScroll>
    )
  }

  const coordItems = [
    { label: 'LAT', value: coords ? coords.latitude.toFixed(4) : locationError ? '—' : '...', pending: !coords && !locationError },
    { label: 'LON', value: coords ? coords.longitude.toFixed(4) : locationError ? '—' : '...', pending: !coords && !locationError },
  ]

  const anyAir = broadcastSources.length > 0
  const anyRec = recordKinds.length > 0

  return (
    <>
      <ScreenScroll contentContainerStyle={styles.scroll}>
        <Text variant="display">Go Live</Text>

        <View style={styles.section}>
          <HelpText>TITLE</HelpText>
          <Input placeholder="What's happening?" value={title} onChangeText={setTitle} autoCorrect={false} />
        </View>

        <View style={styles.armPair}>
          <ArmButton
            label="Go Live"
            iconName="radio"
            state={anyAir ? 'armed' : 'idle'}
            stateLabel={anyAir ? `Armed · ${broadcastSources.length} source${broadcastSources.length > 1 ? 's' : ''}` : 'Off'}
            onPress={() => {
              // Master arm/disarm of the broadcastable defaults.
              const next = !anyAir
              setAir((prev) => ({ ...prev, cam: next, audio: next }))
            }}
          />
          <ArmButton
            label="Record"
            state={anyRec ? 'armed' : 'idle'}
            stateLabel={anyRec ? `Armed · ${recordKinds.length} to disk` : 'Off'}
            onPress={() => {
              // Master arm/disarm of the benign (no-consent) record sources.
              const next = !anyRec
              setRec((prev) => ({ ...prev, gyro: next, compass: next }))
            }}
          />
        </View>

        <View style={styles.section}>
          <HelpText>SOURCES · AIR = BROADCAST · REC = SAVE TO DEVICE</HelpText>
          <View style={styles.sourceList}>
            {SOURCES.map((src, i) => (
              <FeedRow
                key={src.kind}
                kind={src.kind}
                label={src.label}
                detail={src.detail}
                sensitivity={src.sensitivity}
                availability={src.availability}
                air={!!air[src.kind]}
                onAirChange={(v) => setAirFor(src.kind, v)}
                rec={!!rec[src.kind]}
                onRecChange={(v) => requestRec(src, v)}
                recNeedsConsent={src.sensitivity === 'sensitive' && !consented.has(src.kind)}
                showBorderTop={i > 0}
                footer={
                  src.kind === 'loc' && src.availability === 'available' ? (
                    <View style={styles.precision}>
                      <SegmentedToggle options={PRECISION_OPTIONS} value={precision} onChange={setPrecision} />
                      <HelpText>CAPTURE CEILING · REC CAN'T EXCEED WHAT'S SHARED LIVE</HelpText>
                    </View>
                  ) : undefined
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <HelpText>IDENTITY · A FLAG, NOT A TRACK</HelpText>
          <SegmentedToggle options={IDENTITY_OPTIONS} value={identity} onChange={setIdentity} />
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

        {currentUser?.subscriptionEnabled && (
          <View style={styles.subscribersOnlyRow}>
            <View style={styles.subscribersOnlyText}>
              <Text variant="body">Subscribers only</Text>
              <Text variant="caption" color={theme.colors.text.muted}>
                Only your subscribers can watch this stream
              </Text>
            </View>
            <Toggle value={subscribersOnly} onValueChange={setSubscribersOnly} />
          </View>
        )}

        <GoBar variant={canGoLive ? 'armed' : 'disabled'} onPress={handleGoLive} />
        {!anyAir && (
          <HelpText style={styles.hint}>ARM A CAMERA OR AUDIO SOURCE TO GO LIVE</HelpText>
        )}
      </ScreenScroll>

      <RecordConsentSheet
        visible={!!consentTarget}
        onClose={() => setConsentTarget(null)}
        sourceLabel={(consentTarget?.label ?? '').toLowerCase()}
        onConfirm={confirmConsent}
      />
    </>
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
  armPair: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  sourceList: {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    overflow: 'hidden',
  },
  precision: {
    gap: theme.spacing.xs,
  },
  subscribersOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  subscribersOnlyText: {
    flex: 1,
    gap: theme.spacing.xs,
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
  hint: {
    textAlign: 'center',
  },
})
