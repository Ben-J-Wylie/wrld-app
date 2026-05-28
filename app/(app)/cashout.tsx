import { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  PanResponder,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { theme } from '@/lib/theme'
import { useWallet, useInvalidateWallet } from '@/hooks/useWallet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'

const SPACE_BUCKS_PER_DOLLAR = 100
const CASHOUT_MINIMUM = 1000
const CASHOUT_FEE_RATE = 0.05
const GOLD = '#F59E0B'
const GOLD_BG = '#2A1F00'
const THUMB_SIZE = 22

const PRESETS = [1000, 5000, 10000] as const

function fmt(stardust: number) {
  return `$${(stardust / SPACE_BUCKS_PER_DOLLAR).toFixed(2)}`
}

// ─── Slider ──────────────────────────────────────────────────────────────────
// PanResponder + pixel-based positioning. The refs pattern ensures PanResponder
// callbacks always see current max/onChange without being recreated.

function Slider({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const [trackWidth, setTrackWidth] = useState(0)
  const viewRef = useRef<any>(null)

  // Keep mutable refs so PanResponder (created once) always has fresh values.
  const state = useRef({ trackWidth: 0, pageX: 0, min, max, onChange })
  state.current.min = min
  state.current.max = max
  state.current.onChange = onChange

  // screenX is an absolute screen coordinate (gestureState.moveX / x0).
  // We subtract the track's pageX so the calculation is immune to locationX
  // coordinate-space drift that occurs inside ScrollViews.
  const snap = useCallback((screenX: number) => {
    const { trackWidth, pageX, min, max, onChange } = state.current
    if (!trackWidth || max < min) return
    const x = screenX - pageX
    const ratio = Math.max(0, Math.min(1, x / trackWidth))
    const raw = Math.round(((ratio * (max - min)) + min) / 100) * 100
    onChange(Math.max(min, Math.min(max, raw)))
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => snap(gs.x0),
      onPanResponderMove: (_, gs) => snap(gs.moveX),
    }),
  ).current

  const fill = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0
  const fillPx = fill * Math.max(0, trackWidth - THUMB_SIZE)
  const thumbLeft = fill * Math.max(0, trackWidth - THUMB_SIZE)

  return (
    <View
      ref={viewRef}
      style={styles.sliderTrack}
      onLayout={() => {
        viewRef.current?.measure((_: number, __: number, w: number, ___: number, pageX: number) => {
          state.current.trackWidth = w
          state.current.pageX = pageX
          setTrackWidth(w)
        })
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.sliderFill, { width: fillPx + THUMB_SIZE / 2 }]} />
      <View style={[styles.sliderThumb, { left: thumbLeft }]} pointerEvents="none" />
    </View>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function Cashout() {
  const { data, isLoading } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [amount, setAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useFocusEffect(useCallback(() => {
    setSubmitted(false)
    setAmount(CASHOUT_MINIMUM)
  }, []))

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
      </SafeAreaView>
    )
  }

  const { stardust, lockedStardust, readyStardust } = data

  const fee = Math.floor(amount * CASHOUT_FEE_RATE)
  const net = amount - fee
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
          <Pressable onPress={() => router.navigate('/(app)/wallet')} hitSlop={12}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>Cash out</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.successEmoji}>✨</Text>
          <Text style={styles.successHeading}>Request submitted</Text>
          <Text style={styles.successBody}>
            We'll process your {amount.toLocaleString()} Stardust and send{' '}
            {fmt(net)} to your account email within 5–7 business days.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.navigate('/(app)/wallet')}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.navigate('/(app)/wallet')} hitSlop={12}>
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
            <Text style={[styles.statusSub, { color: GOLD }]}>{fmt(readyStardust)} available</Text>
          </View>
        </View>

        {/* Amount header row */}
        <View style={styles.amountHeader}>
          <Text style={styles.sectionLabel}>AMOUNT</Text>
          <Text style={styles.amountMin}>min. {CASHOUT_MINIMUM.toLocaleString()} ✨ ({fmt(CASHOUT_MINIMUM)})</Text>
        </View>

        {/* Big amount + unit */}
        <View style={styles.amountDisplay}>
          <Text style={styles.amountNumber}>{amount.toLocaleString()}</Text>
          <View style={styles.amountUnit}>
            <Text style={styles.amountUnitText}>✨</Text>
          </View>
        </View>

        {/* Payout breakdown */}
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Gross payout</Text>
            <Text style={styles.breakdownValue}>{amount > 0 ? fmt(amount) : '—'}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Fee (5%)</Text>
            <Text style={styles.breakdownFee}>{amount > 0 ? `−${fmt(fee)}` : '—'}</Text>
          </View>
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownTotalLabel}>You receive</Text>
            <Text style={styles.breakdownTotalValue}>{amount > 0 ? fmt(net) : '—'}</Text>
          </View>
        </View>

        {/* Slider */}
        <View style={styles.sliderContainer}>
          <Slider value={amount} min={CASHOUT_MINIMUM} max={readyStardust} onChange={setAmount} />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>{`${CASHOUT_MINIMUM / 1000}K MIN`}</Text>
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
                {`${p / 1000}K`}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[
              styles.presetBtn,
              amount === readyStardust && readyStardust > 0 && styles.presetBtnActive,
              readyStardust === 0 && styles.presetBtnDisabled,
            ]}
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
          <Text style={styles.warning}>
            Minimum cashout is {CASHOUT_MINIMUM.toLocaleString()} ✨ ({fmt(CASHOUT_MINIMUM)})
          </Text>
        )}

        {readyStardust === 0 && stardust > 0 && (
          <Text style={styles.notice}>
            Your {stardust.toLocaleString()} ✨ is locked for up to 7 days after being earned.
          </Text>
        )}

        {stardust === 0 && (
          <Text style={styles.notice}>
            You don't have any Stardust yet. Earn it by going live and receiving tips.
          </Text>
        )}
      </ScrollView>

      {/* Submit */}
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
              {canSubmit
                ? `Cash out ${amount.toLocaleString()} ✨  ·  ${fmt(net)}`
                : 'Cash out'}
            </Text>
          )}
        </Pressable>
        <Text style={styles.footerNote}>
          Processed manually · payment sent to your account email
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  },

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
  statusLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusLabelReady: { color: GOLD },
  statusValue: { ...theme.typography.heading, color: theme.colors.text },
  statusValueReady: { color: GOLD },
  statusSub: { ...theme.typography.caption, color: theme.colors.textMuted },

  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  amountMin: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },

  amountDisplay: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
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

  // Payout breakdown
  breakdown: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  breakdownLabel: { ...theme.typography.body, color: theme.colors.textMuted },
  breakdownValue: { ...theme.typography.body, color: theme.colors.text, fontWeight: '600' },
  breakdownFee: { ...theme.typography.body, color: theme.colors.danger, fontWeight: '600' },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: `${GOLD}11`,
  },
  breakdownTotalLabel: { ...theme.typography.body, color: GOLD, fontWeight: '700' },
  breakdownTotalValue: { ...theme.typography.heading, color: GOLD },

  // Slider
  sliderContainer: { gap: theme.spacing.xs },
  sliderTrack: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    paddingHorizontal: THUMB_SIZE / 2,
  },
  sliderFill: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    height: 4,
    backgroundColor: GOLD,
    borderRadius: 2,
    top: (THUMB_SIZE - 4) / 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: GOLD,
    top: 0,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
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

  warning: { ...theme.typography.caption, color: theme.colors.danger, textAlign: 'center' },
  notice: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

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
  footerNote: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  // Success
  successEmoji: { fontSize: 56 },
  successHeading: { ...theme.typography.heading, color: theme.colors.text, textAlign: 'center' },
  successBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
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
