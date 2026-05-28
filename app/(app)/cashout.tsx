import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { theme } from '@/lib/theme'
import { useWallet, useInvalidateWallet } from '@/hooks/useWallet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'

const SPACE_BUCKS_PER_DOLLAR = 100
const CASHOUT_MINIMUM = 1000
const GOLD = '#F59E0B'
const GOLD_BG = '#2A1F00'

const PRESETS = [1000, 5000, 10000] as const

function dollarStr(stardust: number) {
  return `$${(stardust / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}`
}

function Slider({
  value,
  max,
  onChange,
}: {
  value: number
  max: number
  onChange: (v: number) => void
}) {
  const trackRef = useRef<View>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const fill = max > 0 ? Math.min(1, value / max) : 0

  const handleTouch = useCallback(
    (locationX: number) => {
      if (trackWidth === 0 || max === 0) return
      const ratio = Math.max(0, Math.min(1, locationX / trackWidth))
      const snapped = Math.round((ratio * max) / 100) * 100
      onChange(Math.max(0, Math.min(max, snapped)))
    },
    [trackWidth, max, onChange],
  )

  return (
    <View
      ref={trackRef}
      style={styles.sliderTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX)}
      onResponderMove={(e) => handleTouch(e.nativeEvent.locationX)}
    >
      <View style={[styles.sliderFill, { width: `${fill * 100}%` }]} />
      <View style={[styles.sliderThumb, { left: `${fill * 100}%` }]} />
    </View>
  )
}

export default function Cashout() {
  const { data, isLoading } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [amount, setAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={GOLD} />
        </View>
      </SafeAreaView>
    )
  }

  const { stardust, lockedStardust, readyStardust } = data
  const canSubmit = amount >= CASHOUT_MINIMUM && amount <= readyStardust && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await usersApi.requestCashout(amount)
      await Promise.all([invalidateWallet(), invalidateCurrentUser()])
      setSubmitted(true)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null
      Alert.alert('Could not submit', msg ?? 'Something went wrong — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>Cash out</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.successEmoji}>✨</Text>
          <Text style={styles.successHeading}>Request submitted</Text>
          <Text style={styles.successBody}>
            We'll process your {amount.toLocaleString()} Stardust ({dollarStr(amount)}) and
            send payment to your account email within 5–7 business days.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Cash out</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Locked / Ready chips */}
        <View style={styles.statusRow}>
          <View style={styles.statusChip}>
            <Text style={styles.statusLabel}>LOCKED</Text>
            <Text style={styles.statusValue}>{lockedStardust.toLocaleString()} ✨</Text>
            <Text style={styles.statusSub}>releases in up to 7 days</Text>
          </View>
          <View style={[styles.statusChip, styles.statusChipReady]}>
            <Text style={[styles.statusLabel, styles.statusLabelReady]}>READY</Text>
            <Text style={[styles.statusValue, styles.statusValueReady]}>
              {readyStardust.toLocaleString()} ✨
            </Text>
            <Text style={[styles.statusSub, { color: GOLD }]}>{dollarStr(readyStardust)} available</Text>
          </View>
        </View>

        {/* Amount display */}
        <View style={styles.amountSection}>
          <Text style={styles.sectionLabel}>AMOUNT</Text>
          {readyStardust > 0 && (
            <Pressable onPress={() => setAmount(readyStardust)} style={styles.cashOutAll}>
              <Text style={styles.cashOutAllText}>CASH OUT ALL</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.amountDisplay}>
          <Text style={styles.amountNumber}>{amount.toLocaleString()}</Text>
          <View style={styles.amountUnit}>
            <Text style={styles.amountUnitText}>✨</Text>
          </View>
        </View>

        <Text style={styles.netPayout}>
          Net payout:{' '}
          <Text style={styles.netPayoutValue}>{amount > 0 ? dollarStr(amount) : '—'}</Text>
        </Text>

        {/* Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            value={amount}
            max={readyStardust}
            onChange={setAmount}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0</Text>
            <Text style={styles.sliderLabel}>MAX</Text>
          </View>
        </View>

        {/* Preset buttons */}
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Pressable
              key={p}
              style={[
                styles.presetBtn,
                amount === p && styles.presetBtnActive,
                p > readyStardust && styles.presetBtnDisabled,
              ]}
              onPress={() => p <= readyStardust && setAmount(p)}
              disabled={p > readyStardust}
            >
              <Text style={[styles.presetBtnText, amount === p && styles.presetBtnTextActive]}>
                {p >= 1000 ? `${p / 1000}K` : p}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.presetBtn, amount === readyStardust && readyStardust > 0 && styles.presetBtnActive]}
            onPress={() => setAmount(readyStardust)}
            disabled={readyStardust === 0}
          >
            <Text style={[
              styles.presetBtnText,
              amount === readyStardust && readyStardust > 0 && styles.presetBtnTextActive,
            ]}>
              ALL
            </Text>
          </Pressable>
        </View>

        {amount > 0 && amount < CASHOUT_MINIMUM && (
          <Text style={styles.minWarning}>
            Minimum cashout is {CASHOUT_MINIMUM.toLocaleString()} ✨ ({dollarStr(CASHOUT_MINIMUM)})
          </Text>
        )}

        {readyStardust === 0 && stardust > 0 && (
          <Text style={styles.lockedNotice}>
            Your {stardust.toLocaleString()} ✨ is locked for up to 7 days after being earned.
          </Text>
        )}

        {stardust === 0 && (
          <Text style={styles.lockedNotice}>
            You don't have any Stardust yet. Earn it by going live and receiving tips.
          </Text>
        )}
      </ScrollView>

      {/* Submit button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {amount >= CASHOUT_MINIMUM
                ? `Cash out ${amount.toLocaleString()} ✨  ·  ${dollarStr(amount)}`
                : 'Cash out'}
            </Text>
          )}
        </Pressable>
        <Text style={styles.footerNote}>Processed manually · payment sent to your account email</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.lg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  back: { ...theme.typography.heading, color: theme.colors.text, width: 32 },
  title: { ...theme.typography.heading, color: theme.colors.text },

  content: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xl },

  // Locked / Ready chips
  statusRow: { flexDirection: 'row', gap: theme.spacing.sm },
  statusChip: {
    flex: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 2,
  },
  statusChipReady: { borderColor: `${GOLD}55`, backgroundColor: GOLD_BG },
  statusLabel: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  statusLabelReady: { color: GOLD },
  statusValue: { ...theme.typography.heading, color: theme.colors.text },
  statusValueReady: { color: GOLD },
  statusSub: { ...theme.typography.caption, color: theme.colors.textMuted },

  // Amount
  amountSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...theme.typography.caption, color: theme.colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  cashOutAll: { paddingVertical: 2, paddingHorizontal: theme.spacing.sm },
  cashOutAllText: { ...theme.typography.caption, color: GOLD, fontWeight: '700', letterSpacing: 0.5 },

  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  amountNumber: { fontSize: 48, fontWeight: '700', color: theme.colors.text, flex: 1 },
  amountUnit: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  amountUnitText: { ...theme.typography.body, color: theme.colors.textMuted, fontWeight: '600' },

  netPayout: { ...theme.typography.body, color: theme.colors.textMuted },
  netPayoutValue: { color: theme.colors.text, fontWeight: '700' },

  // Slider
  sliderContainer: { gap: theme.spacing.xs },
  sliderTrack: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: GOLD,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GOLD,
    top: -8,
    marginLeft: -10,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { ...theme.typography.caption, color: theme.colors.textMuted },

  // Presets
  presets: { flexDirection: 'row', gap: theme.spacing.sm },
  presetBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
  },
  presetBtnActive: { borderColor: GOLD, backgroundColor: `${GOLD}22` },
  presetBtnDisabled: { opacity: 0.35 },
  presetBtnText: { ...theme.typography.body, color: theme.colors.textMuted, fontWeight: '600' },
  presetBtnTextActive: { color: GOLD },

  minWarning: { ...theme.typography.caption, color: theme.colors.danger, textAlign: 'center' },
  lockedNotice: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 18 },

  // Footer
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  submitBtn: {
    backgroundColor: GOLD,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { ...theme.typography.body, color: '#fff', fontWeight: '700' },
  footerNote: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },

  // Success state
  successEmoji: { fontSize: 56 },
  successHeading: { ...theme.typography.heading, color: theme.colors.text, textAlign: 'center' },
  successBody: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 22 },
  doneBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: GOLD,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  doneBtnText: { ...theme.typography.body, color: '#fff', fontWeight: '700' },
})
