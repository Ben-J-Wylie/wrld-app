import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import * as ImagePicker from 'expo-image-picker'
import { theme } from '@/lib/theme'
import { useCurrentUser, useInvalidateCurrentUser, useSetCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'
import { Avatar } from '@/components/feature/user/Avatar'

type LocationPrecision = 'exact' | 'city' | 'country' | 'off'
type PermStatus = 'idle' | 'granted' | 'denied'

const ACCENT = theme.colors.accent
const STEPS = 8 // steps 0-7, step 8 = done

// ─── Shared layout ────────────────────────────────────────────────────────────

function StepContent({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

function PrimaryBtn({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <Pressable
      style={[styles.primaryBtn, (disabled || loading) && styles.primaryBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </Pressable>
  )
}

function SecondaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryBtn} onPress={onPress}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

// ─── Step 0: Permissions overview ────────────────────────────────────────────

function StepOverview({ onNext }: { onNext: () => void }) {
  return (
    <StepContent>
      <Text style={styles.stepTitle}>Three things to set up</Text>
      <Text style={styles.stepSubtitle}>
        To go live on Wrld, we need a few quick things. You can change any of these later in Settings.
      </Text>

      <View style={styles.overviewList}>
        {[
          { icon: '📍', label: 'Location', desc: 'So people nearby can find your stream on the globe.' },
          { icon: '🔔', label: 'Notifications', desc: 'Hear when followers tune in and tips arrive.' },
          { icon: '📷', label: 'Camera + mic', desc: 'To stream. We\'ll ask iOS/Android on first stream.' },
        ].map(({ icon, label, desc }) => (
          <View key={label} style={styles.overviewRow}>
            <Text style={styles.overviewIcon}>{icon}</Text>
            <View style={styles.overviewText}>
              <Text style={styles.overviewLabel}>{label}</Text>
              <Text style={styles.overviewDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <PrimaryBtn label="Let's go" onPress={onNext} />
    </StepContent>
  )
}

// ─── Step 1: Age verification ─────────────────────────────────────────────────

function StepAge({
  month, day, year,
  setMonth, setDay, setYear,
  error,
  onNext,
}: {
  month: string; day: string; year: string
  setMonth: (v: string) => void; setDay: (v: string) => void; setYear: (v: string) => void
  error: string | null
  onNext: () => void
}) {
  const dayRef = useRef<TextInput>(null)
  const yearRef = useRef<TextInput>(null)

  return (
    <StepContent>
      <Text style={styles.stepTitle}>How old are you?</Text>
      <Text style={styles.stepSubtitle}>
        Wrld is 18+. We don't share your birthday with anyone.
      </Text>

      <View style={styles.dobRow}>
        <View style={styles.dobField}>
          <Text style={styles.dobLabel}>MONTH</Text>
          <TextInput
            style={styles.dobInput}
            value={month}
            onChangeText={v => {
              const n = v.replace(/\D/g, '').slice(0, 2)
              setMonth(n)
              if (n.length === 2) dayRef.current?.focus()
            }}
            keyboardType="number-pad"
            placeholder="MM"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={2}
            returnKeyType="next"
            onSubmitEditing={() => dayRef.current?.focus()}
          />
        </View>

        <Text style={styles.dobSep}>/</Text>

        <View style={styles.dobField}>
          <Text style={styles.dobLabel}>DAY</Text>
          <TextInput
            ref={dayRef}
            style={styles.dobInput}
            value={day}
            onChangeText={v => {
              const n = v.replace(/\D/g, '').slice(0, 2)
              setDay(n)
              if (n.length === 2) yearRef.current?.focus()
            }}
            keyboardType="number-pad"
            placeholder="DD"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={2}
            returnKeyType="next"
            onSubmitEditing={() => yearRef.current?.focus()}
          />
        </View>

        <Text style={styles.dobSep}>/</Text>

        <View style={[styles.dobField, styles.dobFieldYear]}>
          <Text style={styles.dobLabel}>YEAR</Text>
          <TextInput
            ref={yearRef}
            style={styles.dobInput}
            value={year}
            onChangeText={v => setYear(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder="YYYY"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={4}
            returnKeyType="done"
            onSubmitEditing={onNext}
          />
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <PrimaryBtn label="Continue" onPress={onNext} />
    </StepContent>
  )
}

// ─── Step 2: Avatar ───────────────────────────────────────────────────────────

function StepAvatar({
  avatarUrl,
  displayName,
  uploading,
  onCamera,
  onLibrary,
  onSkip,
}: {
  avatarUrl: string | null
  displayName: string
  uploading: boolean
  onCamera: () => void
  onLibrary: () => void
  onSkip: () => void
}) {
  return (
    <StepContent>
      <Text style={styles.stepTitle}>Show your face</Text>
      <Text style={styles.stepSubtitle}>
        Streams with a photo get 3× more viewer taps on the globe.
      </Text>

      <View style={styles.avatarCenter}>
        {uploading ? (
          <ActivityIndicator color={ACCENT} size="large" />
        ) : (
          <Avatar avatarUrl={avatarUrl} displayName={displayName} size={96} />
        )}
      </View>

      <View style={styles.avatarBtns}>
        <Pressable style={styles.avatarBtn} onPress={onCamera} disabled={uploading}>
          <Text style={styles.avatarBtnIcon}>📷</Text>
          <Text style={styles.avatarBtnText}>Take a photo</Text>
        </Pressable>
        <Pressable style={styles.avatarBtn} onPress={onLibrary} disabled={uploading}>
          <Text style={styles.avatarBtnIcon}>🖼️</Text>
          <Text style={styles.avatarBtnText}>Choose from library</Text>
        </Pressable>
      </View>

      {avatarUrl && <PrimaryBtn label="Looks good — continue" onPress={onSkip} />}
      <SecondaryBtn label="Skip — I'll add one later" onPress={onSkip} />
    </StepContent>
  )
}

// ─── Step 3: Location precision ───────────────────────────────────────────────

const PRECISION_OPTIONS: { value: LocationPrecision; icon: string; label: string; desc: string }[] = [
  { value: 'exact', icon: '🔵', label: 'Exact location', desc: 'Street-level blue dot — viewers see precisely where you are.' },
  { value: 'city', icon: '🏙️', label: 'City', desc: 'Your pin appears within a few miles — recommended.' },
  { value: 'country', icon: '🌍', label: 'Country', desc: 'Anywhere within your country. Less discoverable.' },
  { value: 'off', icon: '🔕', label: 'Off the map', desc: 'No pin shown. Only people with your link can find you.' },
]

function StepPrecision({
  value,
  onChange,
  onNext,
}: {
  value: LocationPrecision
  onChange: (v: LocationPrecision) => void
  onNext: () => void
}) {
  return (
    <StepContent>
      <Text style={styles.stepTitle}>How precise should your pin be?</Text>
      <Text style={styles.stepSubtitle}>
        Pick what viewers see on the globe. You can change this anytime in Settings.
      </Text>

      <View style={styles.optionList}>
        {PRECISION_OPTIONS.map(opt => {
          const selected = value === opt.value
          return (
            <Pressable
              key={opt.value}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => onChange(opt.value)}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.optionIcon}>{opt.icon}</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <PrimaryBtn label="Continue" onPress={onNext} />
    </StepContent>
  )
}

// ─── Step 4: Location permission ──────────────────────────────────────────────

function StepLocationPerm({
  status,
  onRequest,
  onContinue,
}: {
  status: PermStatus
  onRequest: () => void
  onContinue: () => void
}) {
  if (status === 'denied') {
    return (
      <StepContent>
        <Text style={styles.stepTitle}>You can still go live</Text>
        <Text style={styles.stepSubtitle}>
          Without location, your stream won't appear on the globe — but you can still share it directly.
        </Text>
        <BulletList items={[
          'Stream via a direct link you share yourself.',
          'No "map you" pin anywhere.',
          'Turn on later in Settings → Privacy.',
        ]} />
        <PrimaryBtn label="Continue" onPress={onContinue} />
      </StepContent>
    )
  }

  return (
    <StepContent>
      <Text style={styles.stepTitle}>Wrld uses your location while you stream</Text>
      <Text style={styles.stepSubtitle}>
        We protect your exact location — here's how.
      </Text>
      <BulletList items={[
        'City-level precision only — we never read your exact location.',
        'Foreground only — only while the stream is live.',
        'Stops the moment you end the stream.',
        'Tap "Allow While Using App" on the next screen.',
      ]} />
      <PrimaryBtn label="Allow location" onPress={onRequest} />
    </StepContent>
  )
}

// ─── Step 5: Notifications permission ────────────────────────────────────────

function StepNotifPerm({
  status,
  onRequest,
  onContinue,
}: {
  status: PermStatus
  onRequest: () => void
  onContinue: () => void
}) {
  if (status === 'denied') {
    return (
      <StepContent>
        <Text style={styles.stepTitle}>That's fine — turn on any time</Text>
        <Text style={styles.stepSubtitle}>
          You can still finish setting up and go live. Turn notifications on later in{' '}
          <Text style={{ color: ACCENT }}>Settings → Notifications</Text>.
        </Text>
        <PrimaryBtn label="Continue" onPress={onContinue} />
      </StepContent>
    )
  }

  return (
    <StepContent>
      <Text style={styles.stepTitle}>Hear from your audience</Text>
      <Text style={styles.stepSubtitle}>
        Ping when something worth knowing happens in the app.
      </Text>
      <BulletList items={[
        'New followers when someone subscribes.',
        'Tips and comments on your streams.',
        'No marketing — never.',
      ]} />
      <PrimaryBtn label="Allow notifications" onPress={onRequest} />
      <SecondaryBtn label="Not now" onPress={onContinue} />
    </StepContent>
  )
}

// ─── Step 6: Camera info ──────────────────────────────────────────────────────

function StepCamera({ onNext }: { onNext: () => void }) {
  return (
    <StepContent>
      <Text style={styles.stepTitle}>Camera and microphone</Text>
      <Text style={styles.stepSubtitle}>
        iOS and Android will ask for these the first time you stream.
      </Text>
      <BulletList items={[
        'Used only while a stream is live.',
        'You can mute or hide your camera mid-stream from Go Live.',
        'We\'ll ask you the first time you stream — not before.',
      ]} />
      <PrimaryBtn label="Got it" onPress={onNext} />
    </StepContent>
  )
}

// ─── Step 7: Terms ────────────────────────────────────────────────────────────

function StepTos({
  tosChecked,
  rulesChecked,
  onToggleTos,
  onToggleRules,
  saving,
  onNext,
}: {
  tosChecked: boolean
  rulesChecked: boolean
  onToggleTos: () => void
  onToggleRules: () => void
  saving: boolean
  onNext: () => void
}) {
  return (
    <StepContent>
      <Text style={styles.stepTitle}>One last thing</Text>
      <Text style={styles.stepSubtitle}>
        Quick read of how Wrld works and how creators keep things safe.
      </Text>

      <View style={styles.tosList}>
        {[
          { label: 'Terms of service', checked: tosChecked, onToggle: onToggleTos, required: true },
          { label: 'Community rules', checked: rulesChecked, onToggle: onToggleRules, required: true },
          { label: 'Creator guidelines', checked: true, onToggle: () => {}, required: false },
          { label: 'Privacy policy', checked: true, onToggle: () => {}, required: false },
        ].map(({ label, checked, onToggle, required }) => (
          <Pressable key={label} style={styles.tosRow} onPress={required ? onToggle : undefined}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.tosLabel}>{label}</Text>
            {required && (
              <View style={styles.requiredPill}>
                <Text style={styles.requiredPillText}>REVIEW</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <PrimaryBtn
        label="Agree & Continue"
        onPress={onNext}
        disabled={!tosChecked || !rulesChecked}
        loading={saving}
      />
    </StepContent>
  )
}

// ─── Step 8: Done ─────────────────────────────────────────────────────────────

function StepDone({
  locationStatus,
  notifStatus,
  precision,
  onGoLive,
  onProfile,
}: {
  locationStatus: PermStatus
  notifStatus: PermStatus
  precision: LocationPrecision
  onGoLive: () => void
  onProfile: () => void
}) {
  const precisionLabel: Record<LocationPrecision, string> = {
    exact: 'exact — blue dot',
    city: 'city precision',
    country: 'country precision',
    off: 'off — share by link',
  }
  const locationLabel =
    locationStatus === 'granted' ? precisionLabel[precision] :
    locationStatus === 'denied' ? 'off — share by link' : 'skipped'

  return (
    <StepContent>
      <Text style={styles.doneEmoji}>🎬</Text>
      <Text style={styles.stepTitle}>You're set up as a creator</Text>

      <View style={styles.checklist}>
        {[
          { icon: '📍', label: 'Location', value: locationLabel },
          { icon: '🔔', label: 'Notifications', value: notifStatus === 'granted' ? 'on' : 'off' },
          { icon: '📷', label: 'Camera + microphone', value: 'ready on first stream' },
        ].map(({ icon, label, value }) => (
          <View key={label} style={styles.checklistRow}>
            <Text style={styles.checklistIcon}>{icon}</Text>
            <Text style={styles.checklistLabel}>{label}</Text>
            <Text style={styles.checklistValue}>{value}</Text>
          </View>
        ))}
      </View>

      <PrimaryBtn label="Go to Go Live" onPress={onGoLive} />
      <SecondaryBtn label="Set up profile first" onPress={onProfile} />
    </StepContent>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreatorOnboarding() {
  const { data: currentUser } = useCurrentUser()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const setCurrentUser = useSetCurrentUser()

  const [step, setStep] = useState(0)

  // Step 1: DOB
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [dobError, setDobError] = useState<string | null>(null)

  // Step 2: Avatar
  const [uploading, setUploading] = useState(false)

  // Step 3: Precision
  const [precision, setPrecision] = useState<LocationPrecision>('city')

  // Step 4 & 5: Permissions
  const [locationStatus, setLocationStatus] = useState<PermStatus>('idle')
  const [notifStatus, setNotifStatus] = useState<PermStatus>('idle')

  // Step 7: ToS
  const [tosChecked, setTosChecked] = useState(false)
  const [rulesChecked, setRulesChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  useFocusEffect(useCallback(() => {
    if (currentUser?.creatorReady) {
      router.replace('/(app)/dashboard')
    }
  }, [currentUser?.creatorReady]))

  const advance = () => setStep(s => s + 1)

  // ── DOB ──
  function handleAgeContinue() {
    const m = parseInt(month, 10)
    const d = parseInt(day, 10)
    const y = parseInt(year, 10)

    if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) {
      setDobError('Please enter a valid date of birth.')
      return
    }
    const dob = new Date(y, m - 1, d)
    if (dob.getMonth() !== m - 1 || dob.getDate() !== d) {
      setDobError('Please enter a valid date of birth.')
      return
    }
    let age = new Date().getFullYear() - y
    const mo = new Date().getMonth() - (m - 1)
    if (mo < 0 || (mo === 0 && new Date().getDate() < d)) age--
    if (age < 18) {
      setDobError('You must be 18 or older to create on Wrld.')
      return
    }
    setDobError(null)
    advance()
  }

  // ── Avatar ──
  async function pickImage(camera: boolean) {
    setUploading(true)
    try {
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]!
      const mime = asset.mimeType ?? 'image/jpeg'
      const updated = await usersApi.uploadAvatar(asset.uri, mime)
      setCurrentUser(updated)
    } catch {
      Alert.alert('Error', 'Could not upload photo. Try again.')
    } finally {
      setUploading(false)
    }
  }

  // ── Location ──
  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    const granted = status === 'granted'
    setLocationStatus(granted ? 'granted' : 'denied')
    if (granted) advance()
  }

  // ── Notifications ──
  async function requestNotifications() {
    const { status } = await Notifications.requestPermissionsAsync()
    const granted = status === 'granted'
    setNotifStatus(granted ? 'granted' : 'denied')
    if (granted) advance()
  }

  // ── Final save (step 7 → 8) ──
  async function handleComplete() {
    const m = parseInt(month, 10)
    const d = parseInt(day, 10)
    const y = parseInt(year, 10)
    const dob = new Date(y, m - 1, d)

    setSaving(true)
    try {
      const updated = await usersApi.saveCreatorOnboarding({
        dateOfBirth: dob.toISOString(),
        locationPrecision: precision,
        complete: true,
      })
      setCurrentUser(updated)
      await invalidateCurrentUser()
      advance()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const progress = step >= STEPS ? 1 : (step + 1) / (STEPS + 1)

  return (
    <SafeAreaView style={styles.container}>
      {step < STEPS && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
        </View>
      )}

      {step === 0 && <StepOverview onNext={advance} />}

      {step === 1 && (
        <StepAge
          month={month} day={day} year={year}
          setMonth={setMonth} setDay={setDay} setYear={setYear}
          error={dobError}
          onNext={handleAgeContinue}
        />
      )}

      {step === 2 && (
        <StepAvatar
          avatarUrl={currentUser?.avatarUrl ?? null}
          displayName={currentUser?.displayName ?? ''}
          uploading={uploading}
          onCamera={() => pickImage(true)}
          onLibrary={() => pickImage(false)}
          onSkip={advance}
        />
      )}

      {step === 3 && (
        <StepPrecision value={precision} onChange={setPrecision} onNext={advance} />
      )}

      {step === 4 && (
        <StepLocationPerm
          status={locationStatus}
          onRequest={requestLocation}
          onContinue={advance}
        />
      )}

      {step === 5 && (
        <StepNotifPerm
          status={notifStatus}
          onRequest={requestNotifications}
          onContinue={advance}
        />
      )}

      {step === 6 && <StepCamera onNext={advance} />}

      {step === 7 && (
        <StepTos
          tosChecked={tosChecked}
          rulesChecked={rulesChecked}
          onToggleTos={() => setTosChecked(v => !v)}
          onToggleRules={() => setRulesChecked(v => !v)}
          saving={saving}
          onNext={handleComplete}
        />
      )}

      {step === 8 && (
        <StepDone
          locationStatus={locationStatus}
          notifStatus={notifStatus}
          precision={precision}
          onGoLive={() => router.replace('/(app)/dashboard')}
          onProfile={() => router.replace('/(app)/me')}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  progressTrack: {
    height: 3,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },

  stepTitle: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  stepSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    lineHeight: 22,
    marginTop: -theme.spacing.sm,
  },

  // Primary / secondary buttons
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { ...theme.typography.body, color: '#fff', fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  secondaryBtnText: { ...theme.typography.body, color: theme.colors.textMuted },

  // Bullet list
  bulletList: { gap: theme.spacing.sm },
  bulletRow: { flexDirection: 'row', gap: theme.spacing.sm },
  bulletDot: { ...theme.typography.body, color: theme.colors.accent, width: 12 },
  bulletText: { ...theme.typography.body, color: theme.colors.textMuted, flex: 1, lineHeight: 22 },

  // Step 0 — overview
  overviewList: { gap: theme.spacing.md },
  overviewRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'flex-start',
  },
  overviewIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  overviewText: { flex: 1, gap: 2 },
  overviewLabel: { ...theme.typography.body, color: theme.colors.text, fontWeight: '700' },
  overviewDesc: { ...theme.typography.caption, color: theme.colors.textMuted, lineHeight: 18 },

  // Step 1 — DOB
  dobRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  dobField: { flex: 1, gap: 6 },
  dobFieldYear: { flex: 1.6 },
  dobLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dobInput: {
    ...theme.typography.heading,
    color: theme.colors.text,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    textAlign: 'center',
  },
  dobSep: {
    ...theme.typography.heading,
    color: theme.colors.textMuted,
    paddingBottom: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger ?? '#FF3B5C',
    lineHeight: 18,
  },

  // Step 2 — Avatar
  avatarCenter: { alignItems: 'center', paddingVertical: theme.spacing.md },
  avatarBtns: { gap: theme.spacing.sm },
  avatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  avatarBtnIcon: { fontSize: 22 },
  avatarBtnText: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },

  // Step 3 — Precision
  optionList: { gap: theme.spacing.sm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  optionRowSelected: { borderColor: ACCENT, backgroundColor: `${ACCENT}11` },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: ACCENT },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT },
  optionIcon: { fontSize: 20 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  optionDesc: { ...theme.typography.caption, color: theme.colors.textMuted, lineHeight: 18 },

  // Step 7 — ToS
  tosList: { gap: theme.spacing.sm },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tosLabel: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
  requiredPill: {
    backgroundColor: `${ACCENT}22`,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  requiredPillText: {
    ...theme.typography.caption,
    color: ACCENT,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // Step 8 — Done
  doneEmoji: { fontSize: 52, textAlign: 'center' },
  checklist: {
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 4,
  },
  checklistIcon: { fontSize: 18, width: 26 },
  checklistLabel: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
  checklistValue: { ...theme.typography.caption, color: theme.colors.textMuted },
})
