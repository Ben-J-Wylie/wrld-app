import {
  View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useState } from 'react'
import { theme } from '@/tokens/theme'
import { useAuthStore } from '@/stores/authStore'

type BillingCycle = 'monthly' | 'annual'
type Tier = 'free' | 'plus' | 'pro'

const PRICING = {
  plus: { mo: 5,  yr: 48 },
  pro:  { mo: 20, yr: 192 },
}

const PERKS: Record<Tier, string[]> = {
  free: [
    'Go live & collect tips',
    'Discover local live music',
    'A handful of saved streams',
  ],
  plus: [
    'Everything in Free, ad-free',
    'More saved streams & better analytics',
    'Limited multi-camera',
    'Better discovery & moderation',
  ],
  pro: [
    'Everything in Plus',
    'Pay-per-view & channel subscriptions',
    'Full multi-camera',
    'AI moderation & pro analytics',
  ],
}

const MATRIX = [
  { f: 'Ad-free experience',      free: false,      plus: true,        pro: true },
  { f: 'Go live',                 free: true,        plus: true,        pro: true },
  { f: 'Tips',                    free: true,        plus: true,        pro: true },
  { f: 'Saved streams',           free: 'Small',     plus: 'More',      pro: 'Huge' },
  { f: 'Analytics',               free: 'Basic',     plus: 'Better',    pro: 'Pro' },
  { f: 'Pay-per-view (PPV)',       free: false,       plus: false,       pro: true },
  { f: 'Channel subscriptions',   free: false,       plus: false,       pro: true },
  { f: 'Multi-camera',            free: false,       plus: 'Limited',   pro: true },
  { f: 'Discovery tools',         free: 'Basic',     plus: 'Better',    pro: 'Best' },
  { f: 'Moderation tools',        free: 'Basic',     plus: 'Better',    pro: 'AI' },
]

function CheckIcon() {
  return (
    <View style={styles.checkCircle}>
      <Text style={styles.checkMark}>✓</Text>
    </View>
  )
}

function PerkRow({ text }: { text: string }) {
  return (
    <View style={styles.perkRow}>
      <CheckIcon />
      <Text style={styles.perkText}>{text}</Text>
    </View>
  )
}

function MatrixCell({ v, isPlus }: { v: boolean | string; isPlus?: boolean }) {
  if (v === true) return (
    <View style={[styles.cell, styles.cellCheck]}>
      <View style={styles.matrixCheck}><Text style={styles.matrixCheckMark}>✓</Text></View>
    </View>
  )
  if (v === false) return (
    <View style={styles.cell}>
      <Text style={styles.cellNo}>—</Text>
    </View>
  )
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellText, isPlus && styles.cellTextBest]}>{v as string}</Text>
    </View>
  )
}

export function SubscriptionScreen() {
  const wrldUser = useAuthStore(s => s.wrldUser)
  const currentTier: Tier = (wrldUser?.tier as Tier) ?? 'free'
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const [compareOpen, setCompareOpen] = useState(false)
  const annual = billing === 'annual'

  function price(tier: 'plus' | 'pro') {
    const p = PRICING[tier]
    if (annual) return { amt: `$${p.yr}`, per: '/year', eq: `$${(p.yr / 12).toFixed(0)}/mo billed yearly` }
    return { amt: `$${p.mo}`, per: '/month', eq: '' }
  }

  function handlePaidTierPress(tier: 'plus' | 'pro') {
    if (currentTier === tier) return
    Alert.alert(
      `${tier === 'plus' ? 'Plus' : 'Pro'} coming soon`,
      'Paid plans will be available shortly. Your account will be upgraded automatically when billing launches.',
      [{ text: 'Got it' }],
    )
  }

  const plus = price('plus')
  const pro = price('pro')

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>WELCOME TO WRLD</Text>
            <Text style={styles.heading}>Choose your WRLD</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.skip}>← Back</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>
          Start free and upgrade whenever you want more reach, more cameras, and more ways to earn.
        </Text>

        {/* Billing toggle */}
        <View style={styles.segContainer}>
          <View style={styles.seg}>
            <View style={[styles.pill, annual && styles.pillRight]} />
            <TouchableOpacity style={styles.segBtn} onPress={() => setBilling('monthly')} activeOpacity={0.8}>
              <Text style={[styles.segLabel, !annual && styles.segLabelActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.segBtn} onPress={() => setBilling('annual')} activeOpacity={0.8}>
              <Text style={[styles.segLabel, annual && styles.segLabelActive]}>
                Annual{'  '}
                <Text style={[styles.saveBadge, !annual && styles.saveBadgeInactive]}>SAVE ~20%</Text>
              </Text>
            </TouchableOpacity>
          </View>
          {annual && (
            <Text style={styles.billingNote}>
              <Text style={styles.billingNoteAccent}>Two months free</Text> when you pay yearly
            </Text>
          )}
        </View>

        {/* FREE card */}
        <View style={[styles.card, currentTier === 'free' && styles.cardCurrent]}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.tierName}>Free</Text>
              <Text style={styles.tagline}>START HERE</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.priceFree}>Free</Text>
              <Text style={styles.pricePer}>forever</Text>
            </View>
          </View>
          {PERKS.free.map((p, i) => <PerkRow key={i} text={p} />)}
          <View style={[styles.cta, styles.ctaSubtle, currentTier === 'free' && styles.ctaDisabled]}>
            <Text style={styles.ctaSubtleText}>
              {currentTier === 'free' ? 'Your current plan' : 'Continue with Free'}
            </Text>
          </View>
        </View>

        {/* PLUS card */}
        <View style={[styles.card, styles.cardPlus, currentTier === 'plus' && styles.cardCurrent]}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>★ MOST POPULAR</Text>
          </View>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.tierName}>Plus</Text>
              <Text style={styles.tagline}>FOR REGULARS</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.priceAmt}>{plus.amt}</Text>
              <Text style={styles.pricePer}>{plus.per}</Text>
              {!!plus.eq && <Text style={styles.priceEq}>{plus.eq}</Text>}
            </View>
          </View>
          {PERKS.plus.map((p, i) => <PerkRow key={i} text={p} />)}
          <TouchableOpacity
            style={[styles.cta, styles.ctaFilled]}
            onPress={() => handlePaidTierPress('plus')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaFilledText}>
              {currentTier === 'plus' ? 'Your current plan' : 'Choose Plus'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PRO card */}
        <View style={[styles.card, currentTier === 'pro' && styles.cardCurrent]}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.tierName}>Pro</Text>
              <Text style={styles.tagline}>FOR CREATORS</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.priceAmt}>{pro.amt}</Text>
              <Text style={styles.pricePer}>{pro.per}</Text>
              {!!pro.eq && <Text style={styles.priceEq}>{pro.eq}</Text>}
            </View>
          </View>
          {PERKS.pro.map((p, i) => <PerkRow key={i} text={p} />)}
          <TouchableOpacity
            style={[styles.cta, styles.ctaFilledPro]}
            onPress={() => handlePaidTierPress('pro')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaFilledText}>
              {currentTier === 'pro' ? 'Your current plan' : 'Choose Pro'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Compare toggle */}
        <TouchableOpacity
          style={styles.compareToggle}
          onPress={() => setCompareOpen(o => !o)}
          activeOpacity={0.8}
        >
          <Text style={styles.compareToggleText}>
            {compareOpen ? 'Hide comparison' : 'Compare all features'} {compareOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {compareOpen && (
          <View style={styles.matrix}>
            {/* Header */}
            <View style={[styles.mrow, styles.mhead]}>
              <Text style={[styles.mfeat, styles.mheadLabel]}>FEATURE</Text>
              <Text style={styles.mcol}>Free</Text>
              <Text style={[styles.mcol, styles.mcolPlus]}>Plus{'\n'}{plus.amt}</Text>
              <Text style={styles.mcol}>Pro{'\n'}{pro.amt}</Text>
            </View>
            {MATRIX.map((row, i) => (
              <View key={i} style={[styles.mrow, i > 0 && styles.mrowBorder]}>
                <Text style={styles.mfeat}>{row.f}</Text>
                <MatrixCell v={row.free} />
                <MatrixCell v={row.plus} isPlus />
                <MatrixCell v={row.pro} />
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.foot}>
          <Text style={styles.legal}>
            Plans renew automatically until cancelled. Cancel anytime in your store account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const ACC = '#3ea7ff'
const BG2 = '#0c0e11'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070809' },
  scroll: { paddingBottom: 40 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 16 },
  eyebrow: { fontSize: 10, fontFamily: 'monospace', letterSpacing: 2.4, color: ACC, marginBottom: 8, fontWeight: '500' },
  heading: { fontSize: 28, fontWeight: '600', color: '#ece9e2', letterSpacing: -0.7 },
  skip: { color: 'rgba(236,233,226,0.4)', fontSize: 13, fontWeight: '500', marginTop: 4 },
  sub: { fontSize: 13, lineHeight: 20, color: 'rgba(236,233,226,0.58)', paddingHorizontal: 22, marginTop: 10, marginBottom: 4 },

  segContainer: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 4 },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: BG2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', position: 'relative', height: 50 },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 4, width: '50%', borderRadius: 999, backgroundColor: ACC },
  pillRight: { left: 'auto', right: 4 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  segLabel: { fontSize: 13.5, fontWeight: '600', color: 'rgba(236,233,226,0.58)' },
  segLabelActive: { color: '#0a0c10' },
  saveBadge: { fontSize: 9, fontFamily: 'monospace', letterSpacing: 1.2, backgroundColor: 'rgba(255,255,255,0.18)', color: '#0a0c10', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 999 },
  saveBadgeInactive: { backgroundColor: 'rgba(62,167,255,0.16)', color: '#7fd0ff' },
  billingNote: { textAlign: 'center', marginTop: 10, fontSize: 11, fontFamily: 'monospace', letterSpacing: 0.8, color: 'rgba(236,233,226,0.34)' },
  billingNoteAccent: { color: '#7fd0ff', fontWeight: '500' },

  card: { marginHorizontal: 18, marginTop: 12, borderRadius: 20, backgroundColor: BG2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 18 },
  cardPlus: { borderColor: 'rgba(62,167,255,0.5)', backgroundColor: 'rgba(62,167,255,0.05)' },
  cardCurrent: { borderColor: 'rgba(62,167,255,0.8)' },

  badge: { position: 'absolute', top: -10, left: 18, backgroundColor: ACC, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  badgeText: { fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, color: '#0a0c10', fontWeight: '600' },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  tierName: { fontSize: 18, fontWeight: '600', color: '#ece9e2', letterSpacing: -0.18 },
  tagline: { fontSize: 11, fontFamily: 'monospace', letterSpacing: 0.8, color: 'rgba(236,233,226,0.34)', marginTop: 3 },
  priceBlock: { alignItems: 'flex-end' },
  priceFree: { fontSize: 22, fontWeight: '600', color: '#ece9e2', letterSpacing: -0.22 },
  priceAmt: { fontSize: 26, fontWeight: '600', color: '#ece9e2', letterSpacing: -0.52 },
  pricePer: { fontSize: 10.5, fontFamily: 'monospace', letterSpacing: 0.8, color: 'rgba(236,233,226,0.58)', marginTop: 3 },
  priceEq: { fontSize: 9.5, fontFamily: 'monospace', letterSpacing: 0.6, color: 'rgba(236,233,226,0.34)', marginTop: 3 },

  perkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 10 },
  checkCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(62,167,255,0.14)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkMark: { color: ACC, fontSize: 9, fontWeight: '700' },
  perkText: { flex: 1, fontSize: 13, lineHeight: 18, color: 'rgba(236,233,226,0.58)', fontWeight: '500' },

  cta: { marginTop: 16, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ctaFilled: { backgroundColor: ACC },
  ctaFilledPro: { backgroundColor: '#ece9e2' },
  ctaSubtle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  ctaDisabled: { opacity: 0.5 },
  ctaFilledText: { fontSize: 14.5, fontWeight: '600', color: '#0a0c10', letterSpacing: -0.08 },
  ctaSubtleText: { fontSize: 14.5, fontWeight: '600', color: '#ece9e2', letterSpacing: -0.08 },

  compareToggle: { marginHorizontal: 18, marginTop: 18, height: 52, borderRadius: 15, backgroundColor: BG2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  compareToggleText: { fontSize: 13.5, fontWeight: '600', color: '#ece9e2', letterSpacing: -0.07 },

  matrix: { marginHorizontal: 18, marginTop: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: BG2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  mrow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 },
  mhead: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingVertical: 14 },
  mrowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  mheadLabel: { fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, color: 'rgba(236,233,226,0.34)', fontWeight: '500' },
  mfeat: { flex: 1.4, fontSize: 12, lineHeight: 16, color: '#ece9e2', fontWeight: '500' },
  mcol: { flex: 0.85, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#ece9e2', letterSpacing: -0.07 },
  mcolPlus: { color: '#7fd0ff' },
  cell: { flex: 0.85, alignItems: 'center', justifyContent: 'center' },
  cellCheck: {},
  matrixCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(62,167,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  matrixCheckMark: { color: ACC, fontSize: 10, fontWeight: '700' },
  cellNo: { color: 'rgba(236,233,226,0.25)', fontSize: 13 },
  cellText: { fontSize: 11, fontFamily: 'monospace', letterSpacing: 0.6, color: 'rgba(236,233,226,0.58)', textAlign: 'center' },
  cellTextBest: { color: '#7fd0ff' },

  foot: { paddingHorizontal: 22, paddingTop: 22, alignItems: 'center' },
  legal: { fontSize: 10, lineHeight: 16, fontFamily: 'monospace', letterSpacing: 0.4, color: 'rgba(236,233,226,0.34)', textAlign: 'center', maxWidth: 320 },
})
