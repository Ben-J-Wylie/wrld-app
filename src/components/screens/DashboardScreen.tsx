// src/components/screens/DashboardScreen.tsx
//
// Go Live & Record arming screen — clips-initiative capture model
// (DESIGN.md 2026-06-03 decision-log entry).
//
// Layout (2026-06-03): the title ("what's happening") is pinned at the
// top and the single Go Live button is pinned at the bottom; the source
// suite scrolls between them.
//
// The source toggles are the single source of truth — set-it-and-forget-it.
// Each source carries an Air affordance (broadcast) + a Rec affordance
// (save to device); while not yet live an on-toggle shows the "armed"
// (cued, outline-not-fill) state. Pressing Go Live commits whatever the
// toggles say; it never flips them. Identity is a flag (Attributed /
// Anon), not a track. (Record consent + sensitivity badges removed for
// now — see DESIGN.md 2026-06-03 decision-log entry.)
//
// Source suite & honesty (this branch): every source is interactive so
// the full model is visible, but only camera/audio Air actually streams
// today. Location shares live + carries a precision ceiling. The rest
// arm visually and carry their flags forward; backend capture for
// screen/gyro/compass and the v0.3+ sources (speed/torch/temp/motion) is
// a follow-up on `main` (Aaron's lane) — flagged in each row's detail.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Filter as ProfanityFilter } from 'bad-words'

const profanityFilter = new ProfanityFilter()
import { router } from 'expo-router'
import { theme } from '@/tokens/theme'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Toggle } from '@/components/primitives/Toggle'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { Divider } from '@/components/primitives/Divider'
import { FeedRow, type SourceAvailability } from '@/components/features/broadcast/FeedRow'
import { type FeedKind } from '@/components/features/broadcast/FeedThumb'
import { GoBar } from '@/components/features/broadcast/GoBar'
import { useAuth } from '@clerk/clerk-expo'
import { useLocation } from '@/hooks/useLocation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useSignaling } from '@/hooks/useSignaling'
import { useMediasoup } from '@/hooks/useMediasoup'
import {
  loadCaptureConfig,
  saveCaptureConfig,
  DEFAULT_CAPTURE_CONFIG,
  type LocationPrecision,
  type IdentityFlag,
} from '@/lib/captureConfig'
import type { SourceType } from '@/types'

type SourceDescriptor = {
  kind: FeedKind
  label: string
  detail: string
  availability: SourceAvailability
  broadcastSource?: SourceType
  identityRow?: boolean
}

// Grouped by category; groups render with a Divider break between them.
// Every source is `available` (interactive) so the full model shows; the
// detail text carries each source's real capture status.
const SOURCE_GROUPS: SourceDescriptor[][] = [
  [
    { kind: 'profile', label: 'Identity', detail: 'Off = anonymous · a flag, not a track', availability: 'available', identityRow: true },
    { kind: 'loc', label: 'Location', detail: 'Telemetry · gated by precision setting', availability: 'available' },
  ],
  [
    { kind: 'cam', label: 'Camera', detail: 'Media · rear · 1080p', availability: 'available', broadcastSource: 'camera' },
    { kind: 'audio', label: 'Audio', detail: 'Media · mic · 48 kHz', availability: 'available', broadcastSource: 'audio' },
    { kind: 'screen', label: 'Screen', detail: 'Media · whole-screen · capture pending', availability: 'available' },
  ],
  [
    { kind: 'compass', label: 'Compass', detail: 'Telemetry · heading · true north · capture pending', availability: 'available' },
    { kind: 'gyro', label: 'Gyro', detail: 'Telemetry · orientation · ~60 Hz · capture pending', availability: 'available' },
    { kind: 'motion', label: 'Motion intensity', detail: 'Telemetry · derived from accelerometer · v0.3+', availability: 'available' },
    { kind: 'speed', label: 'Speed', detail: 'Telemetry · derived from GPS · v0.3+', availability: 'available' },
    { kind: 'temp', label: 'Ambient temp', detail: 'Telemetry · ambient temperature · v0.3+', availability: 'available' },
  ],
  [
    { kind: 'torch', label: 'Torch', detail: 'Device state · on / off · v0.3+', availability: 'available' },
  ],
]

const PRECISION_OPTIONS: { value: LocationPrecision; label: string }[] = [
  { value: 'exact', label: 'EXACT' },
  { value: 'city', label: 'CITY' },
  { value: 'country', label: 'COUNTRY' },
  { value: 'private', label: 'PRIVATE' },
]

const IDENTITY_OPTIONS: { value: IdentityFlag; label: string }[] = [
  { value: 'public', label: 'PUBLIC' },
  { value: 'anon', label: 'ANON' },
]

// Drops the footer shelf (and the Go Live button with it) lower toward the
// screen bottom by trimming the bottom inset gap.
const FOOTER_DROP = 30

export function DashboardScreen() {
  const { isSignedIn } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const { coords, loading: locationLoading } = useLocation()
  const insets = useSafeAreaInsets()

  // Headless broadcast lives on this screen now — Go Live starts the
  // stream in place (no navigation to StreamScreen).
  const { connect, createRoom, disconnect, streamEnded, adminEnded } = useSignaling()
  const { startBroadcasting, cleanup } = useMediasoup()
  const [isLive, setIsLive] = useState(false)
  const [starting, setStarting] = useState(false)

  // Title ("what's happening") is intentionally per-session — it never
  // persists. Everything else hydrates from the saved capture config.
  const [title, setTitle] = useState('')
  const [air, setAir] = useState<Partial<Record<FeedKind, boolean>>>(DEFAULT_CAPTURE_CONFIG.air)
  const [rec, setRec] = useState<Partial<Record<FeedKind, boolean>>>(DEFAULT_CAPTURE_CONFIG.rec)
  const [precision, setPrecision] = useState<LocationPrecision>(DEFAULT_CAPTURE_CONFIG.precision)
  const [identity, setIdentity] = useState<IdentityFlag>(DEFAULT_CAPTURE_CONFIG.identity)
  const [subscribersOnly, setSubscribersOnly] = useState(DEFAULT_CAPTURE_CONFIG.subscribersOnly)

  // Hydrate from AsyncStorage on first mount; `hydrated` gates the
  // auto-save effect so we don't write the defaults back over the saved
  // config before it loads.
  const hydratedRef = useRef(false)
  useEffect(() => {
    let active = true
    loadCaptureConfig().then((cfg) => {
      if (!active) return
      setAir(cfg.air as Partial<Record<FeedKind, boolean>>)
      setRec(cfg.rec as Partial<Record<FeedKind, boolean>>)
      setPrecision(cfg.precision)
      setIdentity(cfg.identity)
      setSubscribersOnly(cfg.subscribersOnly)
      hydratedRef.current = true
    })
    return () => {
      active = false
    }
  }, [])

  // Auto-save on any capture-config change (no save button). Title is
  // excluded by design.
  useEffect(() => {
    if (!hydratedRef.current) return
    saveCaptureConfig({ air, rec, precision, identity, subscribersOnly })
  }, [air, rec, precision, identity, subscribersOnly])

  function handleStop() {
    cleanup()
    disconnect()
    setIsLive(false)
  }

  // Stop the headless broadcast if the app backgrounds (so viewers aren't
  // left on a frozen frame) or the server ends the stream.
  useEffect(() => {
    if (!isLive) return
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') handleStop()
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive])

  useEffect(() => {
    if (isLive && (streamEnded || adminEnded)) handleStop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, streamEnded, adminEnded])

  function setAirFor(kind: FeedKind, v: boolean) {
    setAir((prev) => ({ ...prev, [kind]: v }))
  }

  // Record consent is disabled for now — Rec flips directly for every
  // source (see DESIGN.md 2026-06-03 decision-log entry).
  function setRecFor(kind: FeedKind, v: boolean) {
    setRec((prev) => ({ ...prev, [kind]: v }))
  }

  // The media subset that actually streams today (camera/audio).
  const broadcastSources = useMemo<SourceType[]>(
    () => SOURCE_GROUPS.flat().filter((s) => s.broadcastSource && air[s.kind]).map((s) => s.broadcastSource!),
    [air],
  )
  // Every aired source kind (incl. location / telemetry / torch) — any of
  // these counts as a live broadcast even with no camera/audio.
  const airedKinds = useMemo(
    () => SOURCE_GROUPS.flat().filter((s) => !s.identityRow && air[s.kind]).map((s) => s.kind),
    [air],
  )
  const recordKinds = useMemo(
    () => SOURCE_GROUPS.flat().filter((s) => !s.identityRow && rec[s.kind]).map((s) => s.kind),
    [rec],
  )

  const anyAir = airedKinds.length > 0
  const anyRec = recordKinds.length > 0
  // Any armed source — Air or Rec, any kind — is enough to go live. A
  // location-only share, a telemetry feed, a torch channel, or a private
  // record-only session are all valid broadcasts.
  const canGoLive =
    isSignedIn && !!title.trim() && !!coords && !locationLoading && (anyAir || anyRec)

  // Go live in place: open the signaling WS, create the room (this is what
  // puts the stream on the globe), and start producing the armed AV
  // sources. Stays on the dashboard — no navigation. Record-to-disk, the
  // non-AV layers, viewer count / chat / camera preview are not surfaced
  // here (the headless broadcast control); those remain follow-ups.
  async function handleStart() {
    if (!canGoLive || starting || isLive) return
    if (profanityFilter.isProfane(title.trim())) {
      Alert.alert('Title not allowed', 'Your stream title contains prohibited content. Please choose a different title.')
      return
    }
    setStarting(true)
    try {
      await connect()
      await createRoom({
        title: title.trim(),
        lat: coords!.latitude,
        lng: coords!.longitude,
        sources: broadcastSources,
        subscribersOnly,
      })
      await startBroadcasting(broadcastSources)
      setIsLive(true)
    } catch (err) {
      cleanup()
      disconnect()
      Alert.alert('Could not go live', err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setStarting(false)
    }
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

  // No camera/audio aired → the commit is a record-only / data-only
  // session; the bar reads "START RECORDING" instead of "GO LIVE".
  const recordOnly = !anyAir && anyRec

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
        availability={src.availability}
        live={isLive}
        air={!!air[src.kind]}
        // The armed source set is locked while live — toggling mid-stream
        // isn't wired to add/remove producers yet.
        onAirChange={(v) => !isLive && setAirFor(src.kind, v)}
        rec={!!rec[src.kind]}
        onRecChange={(v) => !isLive && setRecFor(src.kind, v)}
        footer={
          src.kind === 'loc' ? (
            <View style={styles.precision}>
              <SegmentedToggle options={PRECISION_OPTIONS} value={precision} onChange={setPrecision} />
            </View>
          ) : undefined
        }
      />
    )
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text variant="heading">Go Live</Text>
        <Input placeholder="What's happening?" value={title} onChangeText={setTitle} autoCorrect={false} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sourceGroups}>
          {SOURCE_GROUPS.map((group, gi) => (
            <Fragment key={gi}>
              {gi > 0 && <Divider tone="strong" />}
              <View style={styles.sourceList}>{group.map(renderSource)}</View>
            </Fragment>
          ))}
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(theme.spacing.sm, insets.bottom + theme.spacing.md - FOOTER_DROP) }]}>
        <GoBar
          variant={isLive ? 'live' : starting ? 'counting' : canGoLive ? 'armed' : 'disabled'}
          label={isLive ? 'STOP STREAM' : recordOnly ? 'START RECORDING' : undefined}
          knobLabel={!isLive && recordOnly ? 'REC' : undefined}
          onPress={isLive ? handleStop : handleStart}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  scrollArea: {
    flex: 1,
  },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    // Top gap above the button mirrors the header's gap below the input.
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  center: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
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
})
