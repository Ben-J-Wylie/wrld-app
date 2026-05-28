import { useState, useCallback } from 'react'
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
import { router, useFocusEffect } from 'expo-router'
import { theme } from '@/lib/theme'
import { useWallet, useInvalidateWallet } from '@/hooks/useWallet'
import { useInvalidateCurrentUser } from '@/hooks/useCurrentUser'
import { usersApi } from '@/api/users'

const SPACE_BUCKS_PER_DOLLAR = 100
const ACCENT = theme.colors.accent
const GREEN = '#10B981'
const GOLD = '#F59E0B'

type Bundle = {
  amount: number
  priceCents: number
  badge: string | null
  badgeColor: string | null
  highlight: boolean
}

const BUNDLES: Bundle[] = [
  { amount: 500,  priceCents: 499,  badge: null,           badgeColor: null,   highlight: false },
  { amount: 1200, priceCents: 999,  badge: 'MOST POPULAR', badgeColor: ACCENT, highlight: true  },
  { amount: 2500, priceCents: 1999, badge: 'BEST VALUE',   badgeColor: GREEN,  highlight: false },
  { amount: 6000, priceCents: 3999, badge: 'VIP',          badgeColor: GOLD,   highlight: false },
]

const BASE_RATE = 0.01 // $0.01 per Space Buck

function savings(b: Bundle) {
  const rate = b.priceCents / 100 / b.amount
  return Math.round((1 - rate / BASE_RATE) * 100)
}

function fmtRate(b: Bundle) {
  return `$${(b.priceCents / 100 / b.amount).toFixed(4)} / 🚀`
}

function fmtPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function TopUp() {
  const { data } = useWallet()
  const invalidateWallet = useInvalidateWallet()
  const invalidateCurrentUser = useInvalidateCurrentUser()
  const [selectedIndex, setSelectedIndex] = useState(1) // MOST POPULAR default
  const [buying, setBuying] = useState(false)
  const [done, setDone] = useState(false)

  useFocusEffect(useCallback(() => {
    setDone(false)
    setSelectedIndex(1)
  }, []))

  const selected = BUNDLES[selectedIndex]!

  async function handleBuy() {
    setBuying(true)
    try {
      await usersApi.topUpSpaceBucks(selected.amount, selected.priceCents)
      await Promise.all([invalidateWallet(), invalidateCurrentUser()])
      setDone(true)
    } catch {
      Alert.alert('Error', 'Top up failed — try again.')
    } finally {
      setBuying(false)
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.navigate('/(app)/wallet')} hitSlop={12}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>Top up</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.successEmoji}>🚀</Text>
          <Text style={styles.successHeading}>Space Bucks added</Text>
          <Text style={styles.successBody}>
            {selected.amount.toLocaleString()} Space Bucks have been added to your wallet.
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
        <Text style={styles.title}>Top up</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Current balance */}
        {data != null && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
            <Text style={styles.balanceAmount}>{data.spaceBucks.toLocaleString()} 🚀</Text>
            <Text style={styles.balanceSub}>${(data.spaceBucks / SPACE_BUCKS_PER_DOLLAR).toFixed(2)} USD</Text>
          </View>
        )}

        {/* Bundle list */}
        <Text style={styles.sectionLabel}>CHOOSE BUNDLE</Text>

        <View style={styles.bundleList}>
          {BUNDLES.map((bundle, i) => {
            const isSelected = i === selectedIndex
            const pct = savings(bundle)
            return (
              <Pressable
                key={bundle.amount}
                style={[
                  styles.bundleRow,
                  isSelected && styles.bundleRowSelected,
                  bundle.highlight && !isSelected && styles.bundleRowHighlight,
                ]}
                onPress={() => setSelectedIndex(i)}
              >
                {/* Radio */}
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>

                {/* Info */}
                <View style={styles.bundleInfo}>
                  <View style={styles.bundleTopRow}>
                    <Text style={styles.bundleAmount}>
                      +{bundle.amount.toLocaleString()} <Text style={styles.bundleEmoji}>🚀</Text>
                    </Text>
                    {bundle.badge && (
                      <View style={[styles.badge, { backgroundColor: bundle.badgeColor! }]}>
                        <Text style={styles.badgeText}>{bundle.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.bundleRate}>
                    {fmtRate(bundle)}{pct > 0 ? `  ·  SAVE ${pct}%` : ''}
                  </Text>
                </View>

                {/* Price */}
                <Text style={[styles.bundlePrice, isSelected && styles.bundlePriceSelected]}>
                  {fmtPrice(bundle.priceCents)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.testNote}>Test mode · no payment required</Text>
      </ScrollView>

      {/* Buy button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.buyBtn, buying && styles.buyBtnDisabled]}
          onPress={handleBuy}
          disabled={buying}
        >
          {buying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buyBtnText}>
              Add {selected.amount.toLocaleString()} 🚀  ·  {fmtPrice(selected.priceCents)}
            </Text>
          )}
        </Pressable>
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

  // Balance card
  balanceCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: `${ACCENT}44`,
    padding: theme.spacing.md,
    gap: 2,
  },
  balanceLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  balanceAmount: { ...theme.typography.heading, color: theme.colors.text, marginTop: 4 },
  balanceSub: { ...theme.typography.caption, color: theme.colors.textMuted },

  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Bundle list
  bundleList: { gap: theme.spacing.sm },
  bundleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  bundleRowSelected: {
    borderColor: ACCENT,
    backgroundColor: `${ACCENT}11`,
  },
  bundleRowHighlight: {
    borderColor: `${ACCENT}44`,
  },

  // Radio button
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: ACCENT },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },

  // Bundle info
  bundleInfo: { flex: 1, gap: 2 },
  bundleTopRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  bundleAmount: { ...theme.typography.body, color: theme.colors.text, fontWeight: '700' },
  bundleEmoji: { fontSize: 14 },
  bundleRate: { ...theme.typography.caption, color: theme.colors.textMuted },

  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  bundlePrice: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  bundlePriceSelected: { color: ACCENT, fontWeight: '700' },

  testNote: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  // Footer
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  buyBtn: {
    backgroundColor: ACCENT,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  buyBtnDisabled: { opacity: 0.5 },
  buyBtnText: { ...theme.typography.body, color: '#fff', fontWeight: '700' },

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
    backgroundColor: ACCENT,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  doneBtnText: { ...theme.typography.body, color: '#fff', fontWeight: '700' },
})
