// src/components/screens/_dev/ComponentGallery.tsx
//
// Dev-only gallery exercising every primitive variant. Mechanical
// criterion #4 (DESIGN.md): "renders without errors and covers every
// primitive variant (default, pressed, disabled, loading where
// applicable)." Each primitive shipped in 12.4 adds a section below.
//
// Reachable in dev via expo-router push to `/(app)/gallery`. The route
// is registered with `href: null` so it does not appear in the tab bar.

import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Pressable } from '@/components/primitives/Pressable'
import { Button } from '@/components/primitives/Button'
import { IconButton } from '@/components/primitives/IconButton'
import { Card } from '@/components/primitives/Card'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { HelpText } from '@/components/primitives/HelpText'
import { Pill } from '@/components/primitives/Pill'
import { Chip } from '@/components/primitives/Chip'
import { Avatar } from '@/components/primitives/Avatar'
import { theme } from '@/tokens/theme'

export function ComponentGallery() {
  const [pressCounts, setPressCounts] = useState({ default: 0, subtle: 0, none: 0 })
  const [cardTaps, setCardTaps] = useState(0)
  const [inputDefault, setInputDefault] = useState('')
  const [inputHandle, setInputHandle] = useState('benwy')
  const [inputValid, setInputValid] = useState('ben@wrld.cam')
  const [inputError, setInputError] = useState('taken')
  const [textareaValue, setTextareaValue] = useState('')
  const [chipCategory, setChipCategory] = useState<'all' | 'cities'>('all')
  const [chipMulti, setChipMulti] = useState<Set<string>>(new Set(['cam']))
  const toggleMulti = (k: string) => {
    setChipMulti((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }
  const bump = (k: 'default' | 'subtle' | 'none') =>
    setPressCounts((c) => ({ ...c, [k]: c[k] + 1 }))

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={theme.spacing.lg}
      >
        <Text variant="display">Component gallery</Text>
        <Text variant="caption" color={theme.colors.text.muted}>
          Sub-phase 12.4 build progress. Each primitive ships with its variants exercised here.
        </Text>

        <Section title="Text">
          <Row label="display"><Text variant="display">A live planet</Text></Row>
          <Row label="heading"><Text variant="heading">Nearby streams</Text></Row>
          <Row label="body"><Text variant="body">The drumline forms up at the corner.</Text></Row>
          <Row label="bodyEmphasized"><Text variant="bodyEmphasized">Open broadcast</Text></Row>
          <Row label="caption"><Text variant="caption">1.4K watching · 0.4 mi</Text></Row>
          <Row label="monoLabel"><Text variant="monoLabel">streams</Text></Row>
          <Row label="monoCaption"><Text variant="monoCaption">BROOKLYN, NY</Text></Row>
          <Row label="monoValue"><Text variant="monoValue">40.6829° N</Text></Row>
        </Section>

        <Section title="Icon">
          <Row label="sm (12)">
            <View style={styles.iconRow}>
              <Icon name="search" size="sm" />
              <Icon name="map-pin" size="sm" />
              <Icon name="eye" size="sm" />
              <Icon name="camera" size="sm" />
              <Icon name="mic" size="sm" />
            </View>
          </Row>
          <Row label="md (16)">
            <View style={styles.iconRow}>
              <Icon name="search" />
              <Icon name="map-pin" />
              <Icon name="eye" />
              <Icon name="camera" />
              <Icon name="mic" />
              <Icon name="bookmark" />
              <Icon name="share-2" />
              <Icon name="x" />
            </View>
          </Row>
          <Row label="lg (24)">
            <View style={styles.iconRow}>
              <Icon name="search" size="lg" />
              <Icon name="map-pin" size="lg" />
              <Icon name="eye" size="lg" />
              <Icon name="play" size="lg" />
              <Icon name="maximize-2" size="lg" />
            </View>
          </Row>
          <Row label="muted color">
            <View style={styles.iconRow}>
              <Icon name="search" color={theme.colors.text.muted} />
              <Icon name="map-pin" color={theme.colors.text.muted} />
              <Icon name="eye" color={theme.colors.text.muted} />
            </View>
          </Row>
          <Row label="accent color">
            <View style={styles.iconRow}>
              <Icon name="zap" color={theme.colors.accent.default} />
              <Icon name="heart" color={theme.colors.accent.default} />
              <Icon name="bell" color={theme.colors.accent.default} />
            </View>
          </Row>
          <Row label="raw number (20)">
            <View style={styles.iconRow}>
              <Icon name="chevron-right" size={20} />
              <Icon name="check" size={20} />
              <Icon name="plus" size={20} />
              <Icon name="minus" size={20} />
            </View>
          </Row>
        </Section>

        <Section title="Pressable">
          <Row label="default (0.96)">
            <Pressable style={styles.pressTile} onPress={() => bump('default')}>
              <Text variant="bodyEmphasized">Tap me</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>{pressCounts.default} taps</Text>
            </Pressable>
          </Row>
          <Row label="subtle (0.98)">
            <Pressable variant="subtle" style={styles.pressTileWide} onPress={() => bump('subtle')}>
              <Text variant="bodyEmphasized">Larger surface — softer press</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>{pressCounts.subtle} taps</Text>
            </Pressable>
          </Row>
          <Row label="none">
            <Pressable variant="none" style={styles.pressTile} onPress={() => bump('none')}>
              <Text variant="bodyEmphasized">No scale feedback</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>{pressCounts.none} taps</Text>
            </Pressable>
          </Row>
          <Row label="disabled">
            <Pressable style={styles.pressTile} disabled onPress={() => bump('default')}>
              <Text variant="bodyEmphasized">Can't tap</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>opacity 0.5</Text>
            </Pressable>
          </Row>
        </Section>

        <Section title="Button">
          <Row label="primary md">
            <View style={styles.buttonRow}>
              <Button label="Go live" onPress={() => {}} />
              <Button label="With icon" onPress={() => {}} icon="zap" />
            </View>
          </Row>
          <Row label="primary lg">
            <Button label="Open broadcast" onPress={() => {}} size="lg" />
          </Row>
          <Row label="primary glow">
            <Button label="Go live" onPress={() => {}} size="lg" glow />
          </Row>
          <Row label="secondary">
            <View style={styles.buttonRow}>
              <Button label="Cancel" onPress={() => {}} variant="secondary" />
              <Button label="Back" onPress={() => {}} variant="secondary" icon="chevron-left" />
            </View>
          </Row>
          <Row label="skip">
            <Button label="Skip for now" onPress={() => {}} variant="skip" />
          </Row>
          <Row label="social apple">
            <Button label="Continue with Apple" onPress={() => {}} variant="social" social="apple" />
          </Row>
          <Row label="social google">
            <Button label="Continue with Google" onPress={() => {}} variant="social" social="google" />
          </Row>
          <Row label="social email">
            <Button label="Continue with email" onPress={() => {}} variant="social" social="email" />
          </Row>
          <Row label="loading">
            <Button label="Saving…" onPress={() => {}} loading />
          </Row>
          <Row label="disabled">
            <Button label="Not yet" onPress={() => {}} disabled />
          </Row>
        </Section>

        <Section title="IconButton">
          <Row label="sm/md/lg/xl">
            <View style={styles.iconRow}>
              <IconButton name="x" onPress={() => {}} size="sm" accessibilityLabel="Close" variant="surface" />
              <IconButton name="x" onPress={() => {}} accessibilityLabel="Close" variant="surface" />
              <IconButton name="x" onPress={() => {}} size="lg" accessibilityLabel="Close" variant="surface" />
              <IconButton name="x" onPress={() => {}} size="xl" accessibilityLabel="Close" variant="surface" />
            </View>
          </Row>
          <Row label="ghost">
            <View style={styles.iconRow}>
              <IconButton name="chevron-left" onPress={() => {}} accessibilityLabel="Back" />
              <IconButton name="more-horizontal" onPress={() => {}} accessibilityLabel="More" />
              <IconButton name="settings" onPress={() => {}} accessibilityLabel="Settings" />
            </View>
          </Row>
          <Row label="surface">
            <View style={styles.iconRow}>
              <IconButton name="bookmark" onPress={() => {}} accessibilityLabel="Save" variant="surface" size="xl" />
              <IconButton name="share-2" onPress={() => {}} accessibilityLabel="Share" variant="surface" size="xl" />
            </View>
          </Row>
          <Row label="accent">
            <View style={styles.iconRow}>
              <IconButton name="plus" onPress={() => {}} accessibilityLabel="Add" variant="accent" size="lg" />
              <IconButton name="check" onPress={() => {}} accessibilityLabel="Confirm" variant="accent" size="lg" />
            </View>
          </Row>
          <Row label="on state">
            <View style={styles.iconRow}>
              <IconButton name="heart" onPress={() => {}} accessibilityLabel="Favorite" variant="surface" size="lg" on />
              <IconButton name="bookmark" onPress={() => {}} accessibilityLabel="Saved" variant="surface" size="lg" on />
            </View>
          </Row>
          <Row label="disabled">
            <IconButton name="trash-2" onPress={() => {}} accessibilityLabel="Delete" variant="surface" disabled />
          </Row>
        </Section>

        <Section title="Card">
          <Row label="panel">
            <Card>
              <Text variant="bodyEmphasized">Atlantic Ave · drumline</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>1.4K watching · 0.4 mi</Text>
            </Card>
          </Row>
          <Row label="solid">
            <Card variant="solid">
              <Text variant="bodyEmphasized">Lightest surface</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>cards floating over canvas</Text>
            </Card>
          </Row>
          <Row label="elevated">
            <Card variant="elevated">
              <Text variant="bodyEmphasized">Stronger contrast</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>panel-hi + strong border</Text>
            </Card>
          </Row>
          <Row label="accent">
            <Card variant="accent">
              <Text variant="bodyEmphasized" color={theme.colors.accent.default}>Brand-tinted highlight</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>accent.surface + accent.border</Text>
            </Card>
          </Row>
          <Row label="pressable">
            <Card pressable onPress={() => setCardTaps((n) => n + 1)}>
              <Text variant="bodyEmphasized">Tap the whole card</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>{cardTaps} taps · subtle scale 0.98</Text>
            </Card>
          </Row>
        </Section>

        <Section title="Input">
          <Row label="default md">
            <Input placeholder="Email" value={inputDefault} onChangeText={setInputDefault} keyboardType="email-address" autoCapitalize="none" />
          </Row>
          <Row label="default lg">
            <Input placeholder="What's happening?" value="" onChangeText={() => {}} size="lg" />
          </Row>
          <Row label="prefix (handle)">
            <Input variant="prefix" prefix="@" value={inputHandle} onChangeText={setInputHandle} autoCapitalize="none" />
          </Row>
          <Row label="valid state">
            <Input value={inputValid} onChangeText={setInputValid} state="valid" autoCapitalize="none" />
          </Row>
          <Row label="error state">
            <Input value={inputError} onChangeText={setInputError} state="error" autoCapitalize="none" />
          </Row>
          <Row label="loading state">
            <Input value="checking…" onChangeText={() => {}} state="loading" />
          </Row>
          <Row label="disabled">
            <Input placeholder="Can't edit" value="" onChangeText={() => {}} disabled />
          </Row>
          <Row label="secure">
            <Input placeholder="Password" value="••••••••" onChangeText={() => {}} secureTextEntry />
          </Row>
        </Section>

        <Section title="Textarea">
          <Row label="default">
            <Textarea placeholder="Describe what's happening…" value={textareaValue} onChangeText={setTextareaValue} />
          </Row>
          <Row label="disabled">
            <Textarea placeholder="Read-only" value="This content cannot be edited right now." onChangeText={() => {}} disabled />
          </Row>
        </Section>

        <Section title="Pill">
          <Row label="default">
            <View style={styles.pillRow}>
              <Pill label="CH 12" />
              <Pill label="STREET" />
              <Pill label="DRAFT" />
            </View>
          </Row>
          <Row label="live">
            <View style={styles.pillRow}>
              <Pill label="LIVE" variant="live" />
              <Pill label="LIVE" variant="live" leadingIcon="radio" />
            </View>
          </Row>
          <Row label="accent">
            <View style={styles.pillRow}>
              <Pill label="RECOMMENDED" variant="accent" />
              <Pill label="NEW" variant="accent" size="sm" />
            </View>
          </Row>
          <Row label="jurisdiction">
            <View style={styles.pillRow}>
              <Pill label="EU · GDPR" variant="jurisdiction" />
              <Pill label="US · CCPA" variant="jurisdiction" />
            </View>
          </Row>
          <Row label="countBadge">
            <View style={styles.pillRow}>
              <Pill label="3" variant="countBadge" />
              <Pill label="12" variant="countBadge" />
              <Pill label="99+" variant="countBadge" />
            </View>
          </Row>
          <Row label="sizes sm/md/lg">
            <View style={styles.pillRow}>
              <Pill label="SM" size="sm" />
              <Pill label="MD" size="md" />
              <Pill label="LG" size="lg" />
            </View>
          </Row>
        </Section>

        <Section title="Chip">
          <Row label="single-select">
            <View style={styles.pillRow}>
              <Chip label="All" selected={chipCategory === 'all'} onPress={() => setChipCategory('all')} />
              <Chip label="Cities" selected={chipCategory === 'cities'} onPress={() => setChipCategory('cities')} />
            </View>
          </Row>
          <Row label="multi-select">
            <View style={styles.pillRow}>
              <Chip label="Cam" selected={chipMulti.has('cam')} onPress={() => toggleMulti('cam')} />
              <Chip label="Audio" selected={chipMulti.has('audio')} onPress={() => toggleMulti('audio')} />
              <Chip label="Location" selected={chipMulti.has('loc')} onPress={() => toggleMulti('loc')} />
            </View>
          </Row>
          <Row label="with icon">
            <View style={styles.pillRow}>
              <Chip label="Nearby" leadingIcon="map-pin" onPress={() => {}} />
              <Chip label="Live now" leadingIcon="radio" onPress={() => {}} selected />
            </View>
          </Row>
          <Row label="suggestion">
            <View style={styles.pillRow}>
              <Chip label="benwy" variant="suggestion" onPress={() => {}} />
              <Chip label="ben.wylie" variant="suggestion" onPress={() => {}} />
              <Chip label="bjw" variant="suggestion" onPress={() => {}} />
            </View>
          </Row>
          <Row label="sizes sm/md/lg">
            <View style={styles.pillRow}>
              <Chip label="Small" size="sm" onPress={() => {}} />
              <Chip label="Medium" size="md" onPress={() => {}} />
              <Chip label="Large" size="lg" onPress={() => {}} />
            </View>
          </Row>
          <Row label="disabled">
            <Chip label="Coming soon" disabled onPress={() => {}} />
          </Row>
        </Section>

        <Section title="Avatar">
          <Row label="sizes (initials)">
            <View style={styles.avatarRow}>
              <Avatar displayName="Ben Wylie" size="xs" />
              <Avatar displayName="Ben Wylie" size="sm" />
              <Avatar displayName="Ben Wylie" size="md" />
              <Avatar displayName="Ben Wylie" size="lg" />
              <Avatar displayName="Ben Wylie" size="xl" />
            </View>
          </Row>
          <Row label="image variant">
            <View style={styles.avatarRow}>
              <Avatar displayName="Sample" avatarUrl="https://i.pravatar.cc/100?u=ben" size="sm" />
              <Avatar displayName="Sample" avatarUrl="https://i.pravatar.cc/100?u=aaron" size="md" />
              <Avatar displayName="Sample" avatarUrl="https://i.pravatar.cc/100?u=kai" size="lg" />
            </View>
          </Row>
          <Row label="live ring">
            <View style={styles.avatarRow}>
              <Avatar displayName="Ben Wylie" size="md" live />
              <Avatar displayName="Sample" avatarUrl="https://i.pravatar.cc/100?u=kai" size="lg" live />
            </View>
          </Row>
          <Row label="initials fallback">
            <View style={styles.avatarRow}>
              <Avatar displayName="Aaron" size="md" />
              <Avatar displayName="Kai DC" size="md" />
              <Avatar displayName="Mira B" size="md" />
              <Avatar displayName="Jules" size="md" />
              <Avatar displayName="" size="md" />
            </View>
          </Row>
          <Row label="raw number size">
            <View style={styles.avatarRow}>
              <Avatar displayName="Ben Wylie" size={38} />
              <Avatar displayName="Ben Wylie" size={44} />
              <Avatar displayName="Ben Wylie" size={56} />
            </View>
          </Row>
        </Section>

        <Section title="HelpText">
          <Row label="dim (default)">
            <HelpText>3–20 CHARACTERS</HelpText>
          </Row>
          <Row label="ok">
            <HelpText tone="ok">EMAIL LOOKS GOOD</HelpText>
          </Row>
          <Row label="err">
            <HelpText tone="err">TOO SHORT — 8 CHARACTERS MINIMUM</HelpText>
          </Row>
          <Row label="warn">
            <HelpText tone="warn">ADD A NUMBER OR SYMBOL</HelpText>
          </Row>
          <Row label="paired with Input">
            <View style={styles.helpPair}>
              <Input placeholder="email@wrld.cam" value="ben@wrld" onChangeText={() => {}} state="error" autoCapitalize="none" />
              <HelpText tone="err">CHECK THAT EMAIL DOMAIN</HelpText>
            </View>
          </Row>
        </Section>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="monoLabel" color={theme.colors.text.subtle}>{title}</Text>
      <View>{children}</View>
    </View>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color={theme.colors.text.subtle} style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowContent}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg.primary },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.xxxl },
  section: { gap: theme.spacing.sm, marginTop: theme.spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  rowLabel: { width: 110, paddingTop: 2 },
  rowContent: { flex: 1 },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  pressTile: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: 2,
  },
  pressTileWide: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  helpPair: {
    gap: theme.spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
})
