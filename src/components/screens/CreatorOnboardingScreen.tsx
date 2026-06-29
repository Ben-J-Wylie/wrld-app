// src/components/screens/CreatorOnboardingScreen.tsx
//
// 12.6 migration target. The 10-step creator wizard now runs inside
// the canonical WizardShell chrome, with each step's body delegating
// to a matched design-system feature:
//
//   • WizardShell (section) — top progress bar, head, body slot,
//     primary CTA + optional skip
//   • Input (prefix '@') + RulesChecklist + HelpText  for the handle
//     step's live client-side rules
//   • DOBWheel for the age step (replaces 3 bespoke MM/DD/YYYY inputs)
//   • AvatarPicker for the avatar step (replaces inline avatar +
//     "take a photo" / "library" Pressables)
//   • LocationGranularityPicker for the precision step (replaces 4
//     bespoke radio cards)
//   • PermissionPrePromptCard for the location + notifications steps,
//     each with their default-bullet copy
//   • LegalLinkList + ConsentRow for the TOS step (replaces inline
//     checkbox rows; the additional non-required docs become link
//     rows)
//
// All inline bullet lists / icon-circle headers retire in favor of
// Icon + Text variants + tokens. Behavior unchanged: focus-effect
// redirect when already creatorReady, handle-collision retry, age
// gate, permission requests + denied fallbacks, optimistic profile
// updates, final POST to /users/me/creator-onboarding.

import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import * as ImagePicker from 'expo-image-picker'
import { theme } from '@/tokens/theme'
import {
  useCurrentUser,
  useInvalidateCurrentUser,
  useSetCurrentUser,
} from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import { usersApi } from '@/api/users'
import { WizardShell } from '@/components/sections/WizardShell'
import { Text } from '@/components/primitives/Text'
import { HelpText } from '@/components/primitives/HelpText'
import { Input } from '@/components/primitives/Input'
import { Icon } from '@/components/primitives/Icon'
import { AvatarPicker } from '@/components/features/user/AvatarPicker'
import { RulesChecklist, type Rule } from '@/components/features/onboarding/RulesChecklist'
import { DOBWheel } from '@/components/features/onboarding/DOBWheel'
import { PermissionPrePromptCard } from '@/components/features/permissions/PermissionPrePromptCard'
import { ConsentRow } from '@/components/features/onboarding/ConsentRow'
import { LegalLinkList } from '@/components/sections/LegalLinkList'

type PermStatus = 'idle' | 'granted' | 'denied'
type StepName =
  | 'overview'
  | 'handle'
  | 'age'
  | 'avatar'
  | 'location'
  | 'notif'
  | 'camera'
  | 'tos'
  | 'done'

const HANDLE_RE = /^[a-z0-9_]+$/

function handleRulesFor(value: string): Rule[] {
  const len = value.length
  return [
    {
      label: '3–20 CHARACTERS',
      status: len === 0 ? 'neutral' : len >= 3 && len <= 20 ? 'met' : 'bad',
    },
    {
      label: 'LETTERS, NUMBERS, AND UNDERSCORES ONLY',
      status: len === 0 ? 'neutral' : HANDLE_RE.test(value) ? 'met' : 'bad',
    },
  ]
}

function handlePasses(value: string): boolean {
  return handleRulesFor(value).every((r) => r.status === 'met')
}

function ageFromDob(dob: Date): number {
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

function defaultDob(): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 25)
  return d
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreatorOnboardingScreen() {
  const { data: currentUser } = useCurrentUser()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const setCurrentUser = useSetCurrentUser()
  const setWrldUser = useAuthStore((s) => s.setWrldUser)

  // Build the step list once when currentUser first loads. Inject a
  // handle-selection step if the user still has the auto-generated
  // user_xxx handle, so creator onboarding is the only flow new
  // creators need.
  const [stepList, setStepList] = useState<StepName[] | null>(null)
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!stepList && currentUser !== undefined) {
      const needsHandle = currentUser?.handle.startsWith('user_') ?? true
      setStepList([
        'overview',
        ...(needsHandle ? ['handle' as StepName] : []),
        'age',
        'avatar',
        'location',
        'notif',
        'camera',
        'tos',
        'done',
      ])
    }
  }, [currentUser, stepList])

  // Handle step
  const [handle, setHandle] = useState('')
  const [handleError, setHandleError] = useState('')
  const [handleLoading, setHandleLoading] = useState(false)

  // Age step (single Date instead of split MM/DD/YYYY)
  const [dob, setDob] = useState<Date>(defaultDob)
  const [dobError, setDobError] = useState<string | null>(null)

  // Avatar step
  const [uploading, setUploading] = useState(false)
  // Cache buster — see MeScreen for the rationale (deterministic
  // /media/avatars/<userId>.<ext> path + RN Image cache by URL).
  const [avatarVersion, setAvatarVersion] = useState(0)

  // Permission steps
  const [locationStatus, setLocationStatus] = useState<PermStatus>('idle')
  const [notifStatus, setNotifStatus] = useState<PermStatus>('idle')
  const [locationLoading, setLocationLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)

  // ToS step
  const [guidelinesChecked, setGuidelinesChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (currentUser?.creatorReady) {
        router.navigate('/(app)/dashboard')
      }
    }, [currentUser?.creatorReady]),
  )

  if (!stepList) return null

  const total = stepList.length
  const currentStep = stepList[stepIndex] ?? 'done'
  const advance = () => setStepIndex((i) => i + 1)

  // ── Handle ──
  async function handleHandleSubmit() {
    const trimmed = handle.trim().toLowerCase()
    if (!handlePasses(trimmed)) return
    setHandleError('')
    setHandleLoading(true)
    try {
      const updated = await usersApi.updateProfile({ handle: trimmed })
      setWrldUser(updated)
      setCurrentUser(updated)
      advance()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null
      setHandleError(msg ?? 'Handle unavailable — try another')
    } finally {
      setHandleLoading(false)
    }
  }

  // ── Age ──
  function handleAgeContinue() {
    if (ageFromDob(dob) < 18) {
      setDobError('You must be 18 or older to create on Wrld.')
      return
    }
    setDobError(null)
    advance()
  }

  // ── Avatar ──
  async function pickImage(camera: boolean) {
    // expo-image-picker doesn't auto-request runtime permissions —
    // the launch* calls throw "Missing camera or camera roll permission"
    // if we skip this step.
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(
        camera ? 'Camera access required' : 'Photo library access required',
        'Enable in Settings to upload an avatar.',
      )
      return
    }
    setUploading(true)
    try {
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]!
      const mime = asset.mimeType ?? 'image/jpeg'
      const updated = await usersApi.uploadAvatar(asset.uri, mime)
      setCurrentUser(updated)
      setAvatarVersion((v) => v + 1)
    } catch {
      Alert.alert('Error', 'Could not upload photo. Try again.')
    } finally {
      setUploading(false)
    }
  }

  // ── Location ──
  async function requestLocation() {
    setLocationLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      const granted = status === 'granted'
      setLocationStatus(granted ? 'granted' : 'denied')
      if (granted) advance()
    } finally {
      setLocationLoading(false)
    }
  }

  // ── Notifications ──
  async function requestNotifications() {
    setNotifLoading(true)
    try {
      const { status } = await Notifications.requestPermissionsAsync()
      const granted = status === 'granted'
      setNotifStatus(granted ? 'granted' : 'denied')
      if (granted) advance()
    } finally {
      setNotifLoading(false)
    }
  }

  // ── Final save ──
  async function handleComplete() {
    setSaving(true)
    try {
      const updated = await usersApi.saveCreatorOnboarding({
        dateOfBirth: dob.toISOString(),
        complete: true,
      })
      setCurrentUser(updated)
      await invalidateCurrentUser()
      advance()
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.error ?? 'Something went wrong. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const currentIndexForProgress = currentStep === 'done' ? total : stepIndex + 1

  // ── Step renderers ──

  if (currentStep === 'overview') {
    return (
      <WizardShell
        total={total}
        current={currentIndexForProgress}
        heading="Three things to set up"
        body="To go live on Wrld, we need a few quick things. You can change any of these later in Settings."
        ctaLabel="Let's go"
        onCta={advance}
      >
        <View style={styles.overviewList}>
          {[
            {
              iconName: 'map-pin' as const,
              label: 'Location',
              desc: 'So people nearby can find your stream on the globe.',
            },
            {
              iconName: 'bell' as const,
              label: 'Notifications',
              desc: 'Hear when followers tune in and tips arrive.',
            },
            {
              iconName: 'video' as const,
              label: 'Camera + mic',
              desc: "To stream. We'll ask iOS/Android on first stream.",
            },
          ].map((row) => (
            <View key={row.label} style={styles.overviewRow}>
              <View style={styles.overviewIcon}>
                <Icon name={row.iconName} size="md" color={theme.colors.accent.default} />
              </View>
              <View style={styles.overviewText}>
                <Text variant="bodyEmphasized">{row.label}</Text>
                <Text variant="caption" color={theme.colors.text.muted}>
                  {row.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </WizardShell>
    )
  }

  if (currentStep === 'handle') {
    return (
      <WizardShell
        total={total}
        current={currentIndexForProgress}
        heading="Choose your handle"
        body="This is how viewers find and mention you. You can change it once every 30 days."
        ctaLabel="Continue"
        onCta={handleHandleSubmit}
        ctaDisabled={!handlePasses(handle.trim().toLowerCase())}
        ctaLoading={handleLoading}
      >
        <Input
          variant="prefix"
          prefix="@"
          placeholder="yourhandle"
          value={handle}
          onChangeText={(v) => {
            setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            setHandleError('')
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {!!handleError && <HelpText tone="err">{handleError}</HelpText>}
        <RulesChecklist rules={handleRulesFor(handle)} />
      </WizardShell>
    )
  }

  if (currentStep === 'age') {
    return (
      <WizardShell
        total={total}
        current={currentIndexForProgress}
        heading="How old are you?"
        body="Wrld is 18+. We don't share your birthday with anyone."
        ctaLabel="Continue"
        onCta={handleAgeContinue}
      >
        <DOBWheel value={dob} onChange={setDob} />
        {dobError && <HelpText tone="err">{dobError}</HelpText>}
      </WizardShell>
    )
  }

  if (currentStep === 'avatar') {
    const rawAvatarUrl = currentUser?.avatarUrl ?? null
    const avatarUrl =
      rawAvatarUrl && avatarVersion > 0 ? `${rawAvatarUrl}?v=${avatarVersion}` : rawAvatarUrl
    const displayName = currentUser?.displayName ?? 'You'
    return (
      <WizardShell
        total={total}
        current={currentIndexForProgress}
        heading="Show your face"
        body="Streams with a photo get 3× more viewer taps on the globe."
        ctaLabel={rawAvatarUrl ? 'Looks good — continue' : 'Continue'}
        onCta={advance}
        onSkip={rawAvatarUrl ? undefined : advance}
        skipLabel="Skip — I'll add one later"
      >
        <AvatarPicker
          avatarUrl={avatarUrl}
          displayName={displayName}
          uploading={uploading}
          onTake={() => pickImage(true)}
          onPick={() => pickImage(false)}
        />
      </WizardShell>
    )
  }

  if (currentStep === 'location') {
    if (locationStatus === 'denied') {
      return (
        <WizardShell
          total={total}
          current={currentIndexForProgress}
          heading="You can still go live"
          body="Without location, your stream won't appear on the globe — but you can still share it directly."
          ctaLabel="Continue"
          onCta={advance}
        >
          <View style={styles.bullets}>
            {[
              'Stream via a direct link you share yourself.',
              'No "map you" pin anywhere.',
              'Turn on later in Settings → Privacy.',
            ].map((b, i) => (
              <BulletLine key={i} body={b} />
            ))}
          </View>
        </WizardShell>
      )
    }
    return (
      <View style={styles.wizardLike}>
        <PermissionPrePromptCard
          kind="location"
          title="Wrld uses your location while you stream"
          bullets={[
            'City-level precision only — we never read your exact location.',
            'Foreground only — only while the stream is live.',
            'Stops the moment you end the stream.',
            'Tap "Allow While Using App" on the next screen.',
          ]}
          loading={locationLoading}
          onAllow={requestLocation}
          onSkip={() => setLocationStatus('denied')}
        />
      </View>
    )
  }

  if (currentStep === 'notif') {
    if (notifStatus === 'denied') {
      return (
        <WizardShell
          total={total}
          current={currentIndexForProgress}
          heading="That's fine — turn on any time"
          body="You can still finish setting up and go live. Turn notifications on later in Settings → Notifications."
          ctaLabel="Continue"
          onCta={advance}
        >
          {null}
        </WizardShell>
      )
    }
    return (
      <View style={styles.wizardLike}>
        <PermissionPrePromptCard
          kind="notifications"
          title="Hear from your audience"
          bullets={[
            'New followers when someone subscribes.',
            'Tips and comments on your streams.',
            'No marketing — never.',
          ]}
          loading={notifLoading}
          onAllow={requestNotifications}
          onSkip={() => setNotifStatus('denied')}
        />
      </View>
    )
  }

  if (currentStep === 'camera') {
    return (
      <WizardShell
        total={total}
        current={currentIndexForProgress}
        heading="Camera and microphone"
        body="iOS and Android will ask for these the first time you stream."
        ctaLabel="Got it"
        onCta={advance}
      >
        <View style={styles.bullets}>
          {[
            'Used only while a stream is live.',
            'You can mute or hide your camera mid-stream from Go Live.',
            "We'll ask you the first time you stream — not before.",
          ].map((b, i) => (
            <BulletLine key={i} body={b} />
          ))}
        </View>
      </WizardShell>
    )
  }

  if (currentStep === 'tos') {
    return (
      <WizardShell
        total={total}
        current={currentIndexForProgress}
        heading="One last thing"
        body="Quick read of how Wrld works and how creators keep things safe."
        ctaLabel="Agree & Continue"
        onCta={handleComplete}
        ctaDisabled={!guidelinesChecked}
        ctaLoading={saving}
      >
        <View style={styles.tosBlock}>
          <ConsentRow
            title="Creator guidelines"
            description="I agree to follow the creator guidelines"
            on={guidelinesChecked}
            onToggle={setGuidelinesChecked}
          />
        </View>
        <LegalLinkList
          docs={[
            { id: 'guidelines', label: 'Read creator guidelines', onPress: () => router.push('/(app)/legal/creator?from=creator') },
          ]}
        />
      </WizardShell>
    )
  }

  // ── Done ──
  const locationSummary =
    locationStatus === 'granted'
      ? 'on'
      : locationStatus === 'denied'
        ? 'off — share by link'
        : 'skipped'

  return (
    <WizardShell
      total={total}
      current={total}
      heading="You're set up as a creator"
      body=""
      ctaLabel="Go to Go Live"
      onCta={() => router.navigate('/(app)/dashboard')}
      onSkip={() => router.navigate('/(app)/me')}
      skipLabel="Set up profile first"
    >
      <View style={styles.doneChecklist}>
        {[
          { iconName: 'map-pin' as const, label: 'Location', value: locationSummary },
          {
            iconName: 'bell' as const,
            label: 'Notifications',
            value: notifStatus === 'granted' ? 'on' : 'off',
          },
          {
            iconName: 'video' as const,
            label: 'Camera + microphone',
            value: 'ready on first stream',
          },
        ].map((row) => (
          <View key={row.label} style={styles.doneRow}>
            <Icon name={row.iconName} size="md" color={theme.colors.accent.default} />
            <Text variant="bodyEmphasized" style={styles.doneLabel}>
              {row.label}
            </Text>
            <Text variant="monoCaption" color={theme.colors.text.muted}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </WizardShell>
  )
}

// ─── Small inline bits ───────────────────────────────────────────────────────

function BulletLine({ body }: { body: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text variant="body" color={theme.colors.text.primary} style={styles.bulletText}>
        {body}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Top-level wrapper used when a step skips WizardShell entirely
  // (the permission pre-prompt cards are full screens themselves).
  wizardLike: {
    flex: 1,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    backgroundColor: theme.colors.bg.primary,
  },
  overviewList: {
    gap: theme.spacing.md,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewText: {
    flex: 1,
    gap: 2,
  },
  bullets: {
    gap: theme.spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent.default,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
  },
  tosBlock: {
    gap: theme.spacing.xs,
  },
  doneChecklist: {
    gap: theme.spacing.sm,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  doneLabel: {
    flex: 1,
  },
})
