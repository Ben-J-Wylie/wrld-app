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
// screen/gyro/compass and the v0.3+ sources (speed/torch) is a follow-up on
// `main` (Aaron's lane) — flagged in each row's detail. (Ambient temp was
// removed 2026-06-17 — no instrument on real phones; accel is the 3-axis source.)

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
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
import { ScreenHeader } from '@/components/sections/ScreenHeader'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Toggle } from '@/components/primitives/Toggle'
import { SegmentedToggle } from '@/components/primitives/SegmentedToggle'
import { Divider } from '@/components/primitives/Divider'
import { FeedRow, type SourceAvailability } from '@/components/features/broadcast/FeedRow'
import { type FeedKind } from '@/components/features/broadcast/FeedThumb'
import { GoLiveRecordBar } from '@/components/features/broadcast/GoLiveRecordBar'
import { LiveClockBar } from '@/components/features/discovery/LiveClockBar'
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
  type ChatMode,
  type Visibility,
} from '@/lib/captureConfig'
import { ppvApi } from '@/api/ppvEvents'
import { usePublicConfig, configBool } from '@/hooks/usePublicConfig'
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
  chatRow?: boolean
}

// Grouped by category; groups render with a Divider break between them.
// Every source is `available` (interactive) so the full model shows; the
// detail text carries each source's real capture status.
const SOURCE_GROUPS: SourceDescriptor[][] = [
  [
    { kind: 'profile', label: 'Identity', detail: 'Off = anonymous · a flag, not a track', availability: 'available', identityRow: true },
    { kind: 'loc', label: 'Location', detail: 'Telemetry · gated by precision setting', availability: 'available' },
    { kind: 'chat', label: 'Chat', detail: 'Live message stream · a flag, not a track', availability: 'available', chatRow: true },
  ],
  [
    { kind: 'cam', label: 'Camera', detail: 'Media · rear · 1080p', availability: 'available', broadcastSource: 'camera' },
    { kind: 'audio', label: 'Audio', detail: 'Media · mic · 48 kHz', availability: 'available', broadcastSource: 'audio' },
    { kind: 'screen', label: 'Screen', detail: 'Media · whole-screen · capture pending', availability: 'available' },
  ],
  [
    { kind: 'compass', label: 'Compass', detail: 'Telemetry · heading · true north · capture pending', availability: 'available' },
    { kind: 'gyro', label: 'Gyro', detail: 'Telemetry · orientation · ~60 Hz · capture pending', availability: 'available' },
    { kind: 'accel', label: 'Accelerometer', detail: 'Telemetry · 3-axis (x/y/z) · derived motion', availability: 'available' },
    { kind: 'speed', label: 'Speed', detail: 'Telemetry · derived from GPS · v0.3+', availability: 'available' },
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

const CHAT_OPTIONS: { value: ChatMode; label: string }[] = [
  { value: 'on', label: 'CHAT' },
  { value: 'off', label: 'NO CHAT' },
]

type IconName = ComponentProps<typeof Icon>['name']

// Location row: icon + subtitle reflect the chosen precision (the precision
// multistate is the single source of truth — PRIVATE = off, no separate Air
// toggle). Content adapted from the Settings LocationGranularityPicker.
const LOC_META: Record<LocationPrecision, { icon: IconName; detail: string; muted?: boolean }> = {
  exact: { icon: 'map-pin', detail: 'Your exact spot is shown on the globe' },
  city: { icon: 'map', detail: 'A fuzzy circle around your city' },
  country: { icon: 'globe', detail: 'Only the country you’re in' },
  private: { icon: 'eye-off', detail: 'Location hidden — not shared', muted: true },
}

// Identity row: two icons + subtitles for the public / anon flag.
const IDENTITY_META: Record<IdentityFlag, { icon: IconName; detail: string }> = {
  public: { icon: 'user', detail: 'Shown as your @handle with your avatar' },
  anon: { icon: 'user-x', detail: 'Anonymous — no handle or avatar shown' },
}

// Chat row: a flag (like identity) — include a live message stream or not.
const CHAT_META: Record<ChatMode, { icon: IconName; detail: string; muted?: boolean }> = {
  on: { icon: 'message-circle', detail: 'Viewers can chat — shown as a live overlay' },
  off: { icon: 'message-square', detail: 'Chat off — no message stream', muted: true },
}

// Leading icon tile for the Location / Identity rows (replaces FeedThumb),
// sized to match the thumb so the rows line up.
function StateIcon({ name, muted }: { name: IconName; muted?: boolean }) {
  return (
    <View style={styles.stateIcon}>
      <Icon name={name} size="lg" color={muted ? theme.colors.text.muted : theme.colors.accent.default} />
    </View>
  )
}

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
  const [chat, setChat] = useState<ChatMode>(DEFAULT_CAPTURE_CONFIG.chat)
  const [subscribersOnly, setSubscribersOnly] = useState(DEFAULT_CAPTURE_CONFIG.subscribersOnly)
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_CAPTURE_CONFIG.visibility)
  // The "Public replay" control only shows once the public-buffer feature is on.
  const { config: publicConfig } = usePublicConfig()
  const publicBufferEnabled = configBool(publicConfig, 'PUBLIC_BUFFER_ENABLED', false)

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
        setChat(cfg.chat)
        setSubscribersOnly(cfg.subscribersOnly)
        setVisibility(cfg.visibility)
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
    saveCaptureConfig({ title, air, precision, identity, chat, subscribersOnly, visibility })
  }, [title, air, precision, identity, chat, subscribersOnly, visibility])

  function setAirFor(kind: FeedKind, v: boolean) {
    setAir((prev) => ({ ...prev, [kind]: v }))
  }

  // Every aired source kind (incl. location / telemetry / torch) — any of
  // these counts as a live broadcast even with no camera/audio. Location is
  // governed by its precision (PRIVATE = off), not an Air toggle, so it's
  // included when precision isn't private.
  const airedKinds = useMemo(() => {
    const toggled = SOURCE_GROUPS.flat()
      .filter((s) => !s.identityRow && !s.chatRow && s.kind !== 'loc' && air[s.kind])
      .map((s) => s.kind)
    return precision !== 'private' ? [...toggled, 'loc' as FeedKind] : toggled
  }, [air, precision])

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
    await saveCaptureConfig({ title: title.trim(), air, precision, identity, chat, subscribersOnly, visibility })
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
    // Identity: no Air toggle (it's a flag). Icon + subtitle reflect the
    // public/anon choice; the multistate sits in the footer (full-width,
    // same layout as Location).
    if (src.identityRow) {
      const meta = IDENTITY_META[identity]
      return (
        <FeedRow
          key={src.kind}
          kind={src.kind}
          label={src.label}
          availability={src.availability}
          leading={<StateIcon name={meta.icon} />}
          detail={meta.detail}
          showAir={false}
          showRec={false}
          footer={<SegmentedToggle options={IDENTITY_OPTIONS} value={identity} onChange={setIdentity} />}
        />
      )
    }
    // Chat: no Air toggle (it's a flag, not a track). Icon + subtitle reflect
    // the on/off choice; the CHAT / NO CHAT multistate sits in the footer,
    // same layout as Identity and Location.
    if (src.chatRow) {
      const meta = CHAT_META[chat]
      return (
        <FeedRow
          key={src.kind}
          kind={src.kind}
          label={src.label}
          availability={src.availability}
          leading={<StateIcon name={meta.icon} muted={meta.muted} />}
          detail={meta.detail}
          showAir={false}
          showRec={false}
          footer={<SegmentedToggle options={CHAT_OPTIONS} value={chat} onChange={setChat} />}
        />
      )
    }
    // Location: no Air toggle — the precision multistate (PRIVATE = off) is
    // the single source of truth. Icon + subtitle reflect the chosen precision.
    if (src.kind === 'loc') {
      const meta = LOC_META[precision]
      return (
        <FeedRow
          key={src.kind}
          kind={src.kind}
          label={src.label}
          availability={src.availability}
          leading={<StateIcon name={meta.icon} muted={meta.muted} />}
          detail={meta.detail}
          showAir={false}
          showRec={false}
          footer={<SegmentedToggle options={PRECISION_OPTIONS} value={precision} onChange={setPrecision} />}
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
      />
    )
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <ScreenHeader title="Dashboard" />
        <View style={styles.titleRow}>
          <Input placeholder="What's happening?" value={title} onChangeText={setTitle} autoCorrect={false} />
        </View>
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

        {publicBufferEnabled && (
          <View style={styles.subscribersOnlyRow}>
            <View style={styles.subscribersOnlyText}>
              <Text variant="body">Public replay</Text>
              <Text variant="caption" color={theme.colors.text.muted}>
                On = your buffer is replayable in the time machine. Off keeps it out of the past (still live now).
              </Text>
            </View>
            <Toggle
              value={visibility === 'public'}
              onValueChange={(v) => setVisibility(v ? 'public' : 'private')}
            />
          </View>
        )}

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

      {/* WRLD clock — flush above the app footer, the predictable cross-screen
          pattern (globe / stream / clips). Live readout only here (no surface
          to time-travel); the Go Live bar above is bumped up by its height. */}
      <LiveClockBar />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  header: {
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  // "What's happening" field — sits at header-bottom + sm, matching the globe
  // search row and the stream preview so the field doesn't jump between tabs.
  titleRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
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
  // Leading icon tile for Location / Identity rows — matches FeedThumb md
  // (76×60) so the rows align with the other source rows.
  stateIcon: {
    width: 76,
    height: 60,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
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
