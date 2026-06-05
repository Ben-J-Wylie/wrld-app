// src/components/screens/DashboardScreen.tsx
//
// Go Live arming screen — clips-initiative capture model
// (DESIGN.md 2026-06-04 decision-log entry).
//
// Layout: the title ("what's happening") is pinned at the top and the
// single Go Live button is pinned at the bottom; the source suite scrolls
// between them.
//
// The source toggles are the single source of truth — set-it-and-forget-it.
// Each source carries a single Air affordance (broadcast this source
// live); on-toggles show the "armed" (cued, outline-not-fill) state.
// Recording is NOT armed here anymore (2026-06-04 reversal of the
// dashboard Air/Rec model): a single Record button on the stream view
// records whatever is on air. Identity is a flag (Public / Anon), not a
// track; Location carries a precision ceiling.
//
// Go Live navigates to the stream view (stream/new), which goes live
// immediately on arrival — there is no in-place headless broadcast and no
// intermediate "Start stream" step anymore.
//
// Source suite & honesty (this branch): every source is interactive so
// the full model is visible, but only camera/audio Air actually streams
// today. Location shares live + carries a precision ceiling. The rest
// arm visually and carry their flags forward; backend capture for
// screen/gyro/compass and the v0.3+ sources (speed/torch/temp/motion) is
// a follow-up on `main` (Aaron's lane) — flagged in each row's detail.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Filter as ProfanityFilter } from 'bad-words'

const profanityFilter = new ProfanityFilter()
import { router, useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
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
import { GoLiveRecordBar } from '@/components/features/broadcast/GoLiveRecordBar'
import { useBroadcastStore } from '@/stores/broadcastStore'
import { useAuth } from '@clerk/clerk-expo'
import { useLocation } from '@/hooks/useLocation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { activeBroadcast } from '@/lib/activeBroadcast'
import {
  loadCaptureConfig,
  saveCaptureConfig,
  DEFAULT_CAPTURE_CONFIG,
  type LocationPrecision,
  type IdentityFlag,
} from '@/lib/captureConfig'
import { ppvApi } from '@/api/ppvEvents'
import type { SourceType, PpvEvent } from '@/types'

// The enforcement window is 30 minutes before scheduledAt through the end of the event.
const PPV_ENFORCE_BEFORE_MS = 30 * 60_000

function getEnforcedEvent(events: PpvEvent[]): PpvEvent | null {
  const now = Date.now()
  for (const ev of events) {
    const start = new Date(ev.scheduledAt).getTime()
    const end = ev.durationMinutes ? start + ev.durationMinutes * 60_000 : Infinity
    if (now >= start - PPV_ENFORCE_BEFORE_MS && now < end) return ev
  }
  return null
}

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

function PpvOption({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <View
      style={[ppvOptionStyles.option, selected && ppvOptionStyles.selected]}
    >
      <Text
        variant="caption"
        color={selected ? theme.colors.accent.default : theme.colors.text.muted}
        onPress={onSelect}
      >
        {label}
      </Text>
    </View>
  )
}

const ppvOptionStyles = StyleSheet.create({
  option: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  selected: {
    borderColor: theme.colors.accent.border,
    backgroundColor: theme.colors.accent.surface,
  },
})

export function DashboardScreen() {
  const { isSignedIn } = useAuth()
  const { data: currentUser } = useCurrentUser()
  const { coords, loading: locationLoading } = useLocation()
  const insets = useSafeAreaInsets()

  // Scheduled PPV events — used for the PPV event selector row
  const { data: scheduledEvents } = useQuery({
    queryKey: ['my-scheduled-ppv-events'],
    queryFn: () => ppvApi.listMyScheduledEvents(),
    enabled: isSignedIn,
    staleTime: 60_000,
  })

  // Derived: which event (if any) is in the enforcement window right now
  const enforcedEvent = useMemo(
    () => getEnforcedEvent(scheduledEvents ?? []),
    [scheduledEvents],
  )

  // ppvEventId: enforced event is auto-selected and locked; user can select
  // from other scheduled events when no enforcement is active
  const [manualPpvEventId, setManualPpvEventId] = useState<string | null>(null)
  const ppvEventId: string | null = enforcedEvent ? enforcedEvent.id : manualPpvEventId
  const ppvEventLocked = !!enforcedEvent

  // Title ("what's happening") is persisted/shared via captureConfig now,
  // so the stream-view preview can go live with the same title. It hydrates
  // and auto-saves alongside the rest of the config.
  const [title, setTitle] = useState('')
  const [air, setAir] = useState<Partial<Record<FeedKind, boolean>>>(DEFAULT_CAPTURE_CONFIG.air)
  const [precision, setPrecision] = useState<LocationPrecision>(DEFAULT_CAPTURE_CONFIG.precision)
  const [identity, setIdentity] = useState<IdentityFlag>(DEFAULT_CAPTURE_CONFIG.identity)
  const [subscribersOnly, setSubscribersOnly] = useState(DEFAULT_CAPTURE_CONFIG.subscribersOnly)

  // Hydrate from AsyncStorage on focus (not just mount) so the dashboard
  // reflects title/arming edits made on the stream-view preview — captureConfig
  // is the shared source of truth. `hydrated` gates the auto-save effect so we
  // don't write defaults over the saved config before it loads.
  const hydratedRef = useRef(false)
  useFocusEffect(
    useCallback(() => {
      let active = true
      loadCaptureConfig().then((cfg) => {
        if (!active) return
        setTitle(cfg.title)
        setAir(cfg.air as Partial<Record<FeedKind, boolean>>)
        setPrecision(cfg.precision)
        setIdentity(cfg.identity)
        setSubscribersOnly(cfg.subscribersOnly)
        hydratedRef.current = true
      })
      return () => {
        active = false
      }
    }, []),
  )

  // Auto-save on any capture-config change (no save button) — title included.
  useEffect(() => {
    if (!hydratedRef.current) return
    saveCaptureConfig({ title, air, precision, identity, subscribersOnly })
  }, [title, air, precision, identity, subscribersOnly])

  function setAirFor(kind: FeedKind, v: boolean) {
    setAir((prev) => ({ ...prev, [kind]: v }))
  }

  // Every aired source kind (incl. location / telemetry / torch) — any of
  // these counts as a live broadcast even with no camera/audio.
  const airedKinds = useMemo(
    () => SOURCE_GROUPS.flat().filter((s) => !s.identityRow && air[s.kind]).map((s) => s.kind),
    [air],
  )

  const anyAir = airedKinds.length > 0
  // Any aired source — any kind — is enough to go live. A location-only
  // share, a telemetry feed, or a torch channel are all valid broadcasts;
  // they don't require camera/audio.
  const canGoLive =
    isSignedIn && !!title.trim() && !!coords && !locationLoading && anyAir

  // Shared broadcast state (so the buttons read the same as the stream view).
  const isLive = useBroadcastStore((s) => s.isLive)
  const isRecording = useBroadcastStore((s) => s.isRecording)

  // Starting a broadcast navigates to the stream view (stream/new) with go=1
  // (and rec=1 for Record), which goes live on arrival. The stream view reads
  // the arming (title, sources, precision, identity, subscribers-only) from
  // captureConfig — the shared source of truth — so we persist it first to
  // avoid a read race, then carry only the per-go-live PPV link
  // (activeBroadcast) + coords + the autostart flags.
  async function startBroadcast(record: boolean) {
    if (!canGoLive) return
    if (profanityFilter.isProfane(title.trim())) {
      Alert.alert('Title not allowed', 'Your stream title contains prohibited content. Please choose a different title.')
      return
    }
    await saveCaptureConfig({ title: title.trim(), air, precision, identity, subscribersOnly })
    activeBroadcast.set({ ppvEventId: ppvEventId ?? undefined })
    router.push({
      pathname: '/(app)/stream/[id]',
      params: {
        id: 'new',
        go: '1',
        ...(record ? { rec: '1' } : null),
        lat: String(coords!.latitude),
        lng: String(coords!.longitude),
      },
    })
  }

  // The control surface acts on the running broadcast (which lives in the
  // mounted StreamScreen) via the store command when already live, or starts
  // a new one by navigating when idle. Mirrors the stream view exactly.
  function handleLivePress() {
    if (isLive) useBroadcastStore.getState().sendCommand('endStream')
    else startBroadcast(false)
  }
  function handleRecordPress() {
    if (isRecording) useBroadcastStore.getState().sendCommand('stopRecording')
    else if (isLive) useBroadcastStore.getState().sendCommand('startRecording')
    else startBroadcast(true)
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
        // While live, on-toggles render filled (on) rather than the cued
        // "armed" outline, and the armed set is locked (sources can't change
        // mid-stream). isLive is the shared broadcast state.
        live={isLive}
        air={!!air[src.kind]}
        onAirChange={(v) => !isLive && setAirFor(src.kind, v)}
        // Recording is no longer armed on the dashboard — a single Record
        // button on the stream view records the aired set.
        showRec={false}
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

        {/* PPV event selector — shown when creator has at least one scheduled event */}
        {(scheduledEvents?.length ?? 0) > 0 && (
          <View style={styles.ppvEventSection}>
            <View style={styles.ppvEventHeader}>
              <Icon name="lock" size="sm" color={theme.colors.text.muted} />
              <Text variant="body">PPV event</Text>
              {ppvEventLocked && (
                <View style={styles.ppvLockedBadge}>
                  <Text variant="monoCaption" color={theme.colors.text.inverse}>LOCKED</Text>
                </View>
              )}
            </View>
            <Text variant="caption" color={theme.colors.text.muted}>
              {ppvEventLocked
                ? `Your event "${enforcedEvent!.title}" is starting — this stream will be linked to it`
                : 'Link this stream to a scheduled PPV event (optional)'}
            </Text>
            {!ppvEventLocked && (
              <View style={styles.ppvOptions}>
                <PpvOption
                  label="No event"
                  selected={manualPpvEventId === null}
                  onSelect={() => setManualPpvEventId(null)}
                />
                {scheduledEvents!.map(ev => (
                  <PpvOption
                    key={ev.id}
                    label={ev.title}
                    selected={manualPpvEventId === ev.id}
                    onSelect={() => setManualPpvEventId(ev.id)}
                  />
                ))}
              </View>
            )}
            {ppvEventLocked && (
              <View style={styles.ppvSelectedRow}>
                <Icon name="calendar" size="sm" color={theme.colors.accent.default} />
                <Text variant="caption" color={theme.colors.accent.default}>{enforcedEvent!.title}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(theme.spacing.sm, insets.bottom + theme.spacing.md - FOOTER_DROP) }]}>
        <GoLiveRecordBar
          isLive={isLive}
          isRecording={isRecording}
          liveDisabled={!isLive && !canGoLive}
          recordDisabled={!isRecording && !isLive && !canGoLive}
          onLivePress={handleLivePress}
          onRecordPress={handleRecordPress}
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
  ppvEventSection: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  ppvEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  ppvLockedBadge: {
    backgroundColor: theme.colors.accent.default,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    marginLeft: theme.spacing.xs,
  },
  ppvOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  ppvSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
