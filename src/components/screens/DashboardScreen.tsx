// src/components/screens/DashboardScreen.tsx
//
// Go Live & Record arming screen — clips-initiative two-affordance
// capture model (DESIGN.md 2026-06-03 decision-log entry).
//   • A pair of ArmButtons (Go Live · Record) summarising each intent.
//   • The full source suite, each a gap-separated FeedRow card with an
//     Air affordance (broadcast) + a Rec affordance (save to device).
//     All four combinations are valid.
//   • Sensitive sources (camera / audio / location / screen) gate their
//     Rec affordance through RecordConsentSheet — nothing recorded
//     silently. Location exposes a precision ceiling.
//   • Identity is its own FeedRow — a flag (Attributed / Anon), not a
//     capturable track, so it swaps an inline segment into the affordance
//     slot via `trailing`.
//   • GoBar docked at the bottom commits the broadcast.
//
// Source suite & honesty (this branch):
//   armable now      camera, audio (Air wired end-to-end), location (Air
//                    shares live; precision ceiling via settings)
//   capture pending  screen, gyro, compass — UI present, `disabled`
//   v0.3+ earmarked  speed, torch, ambient temp, motion intensity —
//                    UI present, `disabled`
//   identity         Attributed / Anon flag (carried forward)
// Rec flags, identity, and precision are carried in the broadcast params
// for the live indicator; backend record-to-disk for the pending/earmarked
// sources is a follow-up on `main` (Aaron's lane).

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

// A capture source = one row in the stacked list. `broadcastSource` maps
// to the backend SourceType enum where the Air path is wired (camera /
// audio today); sources without one carry their Air flag forward but
// don't enter the live `sources` param. `identityRow` marks the Identity
// flag row (no Air/Rec — an inline Attributed/Anon segment instead).
type SourceDescriptor = {
  kind: FeedKind
  label: string
  detail: string
  sensitivity?: SourceSensitivity
  availability: SourceAvailability
  broadcastSource?: SourceType
  identityRow?: boolean
}

// Sources are grouped by category; groups render with a larger break
// between them (identity/place · media · telemetry · device).
const SOURCE_GROUPS: SourceDescriptor[][] = [
  [
    { kind: 'profile', label: 'Identity', detail: 'Off = anonymous · a flag, not a track', availability: 'available', identityRow: true },
    { kind: 'loc', label: 'Location', detail: 'Telemetry · gated by precision setting', sensitivity: 'sensitive', availability: 'available' },
  ],
  [
    { kind: 'cam', label: 'Camera', detail: 'Media · rear · 1080p', sensitivity: 'sensitive', availability: 'available', broadcastSource: 'camera' },
    { kind: 'audio', label: 'Audio', detail: 'Media · mic · 48 kHz', sensitivity: 'sensitive', availability: 'available', broadcastSource: 'audio' },
    { kind: 'screen', label: 'Screen', detail: 'Media · whole-screen · capture pending', sensitivity: 'sensitive', availability: 'disabled' },
  ],
  [
    { kind: 'compass', label: 'Compass', detail: 'Telemetry · heading · true north · capture pending', sensitivity: 'benign', availability: 'disabled' },
    { kind: 'gyro', label: 'Gyro', detail: 'Telemetry · orientation · ~60 Hz · capture pending', sensitivity: 'benign', availability: 'disabled' },
    { kind: 'motion', label: 'Motion intensity', detail: 'Telemetry · derived from accelerometer · v0.3+', sensitivity: 'benign', availability: 'disabled' },
    { kind: 'speed', label: 'Speed', detail: 'Telemetry · derived from GPS · v0.3+', sensitivity: 'benign', availability: 'disabled' },
    { kind: 'temp', label: 'Ambient temp', detail: 'Telemetry · ambient temperature · v0.3+', sensitivity: 'benign', availability: 'disabled' },
  ],
  [
    { kind: 'torch', label: 'Torch', detail: 'Device state · on / off · v0.3+', sensitivity: 'benign', availability: 'disabled' },
  ],
]

const SOURCES: SourceDescriptor[] = SOURCE_GROUPS.flat()
const CAMERA_SOURCE = SOURCES.find((s) => s.kind === 'cam')!

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
  const [rec, setRec] = useState<Partial<Record<FeedKind, boolean>>>({})
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
    () => SOURCES.filter((s) => !s.identityRow && rec[s.kind]).map((s) => s.kind),
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

  function renderSource(src: SourceDescriptor) {
    if (src.identityRow) {
      return (
        <FeedRow
          key={src.kind}
          kind={src.kind}
          label={src.label}
          detail={src.detail}
          availability={src.availability}
          trailing={
            <View style={styles.identityControl}>
              <SegmentedToggle options={IDENTITY_OPTIONS} value={identity} onChange={setIdentity} />
            </View>
          }
        />
      )
    }
    return (
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
        footer={
          src.kind === 'loc' && src.availability === 'available' ? (
            <View style={styles.precision}>
              <SegmentedToggle options={PRECISION_OPTIONS} value={precision} onChange={setPrecision} />
              <HelpText>CAPTURE CEILING · REC CAN'T EXCEED WHAT'S SHARED LIVE</HelpText>
            </View>
          ) : undefined
        }
      />
    )
  }

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
              const next = !anyAir
              setAir((prev) => ({ ...prev, cam: next, audio: next }))
            }}
          />
          <ArmButton
            label="Record"
            state={anyRec ? 'armed' : 'idle'}
            stateLabel={anyRec ? `Armed · ${recordKinds.length} to disk` : 'Off'}
            onPress={() => {
              // Armed → clear all rec. Idle → start recording setup by
              // requesting the camera (routes through consent).
              if (anyRec) setRec({})
              else requestRec(CAMERA_SOURCE, true)
            }}
          />
        </View>

        <View style={styles.section}>
          <HelpText>SOURCES · AIR = BROADCAST · REC = SAVE TO DEVICE</HelpText>
          <View style={styles.sourceGroups}>
            {SOURCE_GROUPS.map((group, gi) => (
              <View key={gi} style={styles.sourceList}>
                {group.map(renderSource)}
              </View>
            ))}
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
  sourceGroups: {
    gap: theme.spacing.lg,
  },
  sourceList: {
    gap: theme.spacing.sm,
  },
  identityControl: {
    width: 172,
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
