// src/components/features/broadcast/RecordConsentSheet.tsx
//
// PARKED (Rolling Buffer initiative, June 2026). The record-consent step is
// retired: under the rolling-buffer model capture ⊆ broadcast — nothing is
// ever recorded that wasn't broadcast, so there is no record-without-broadcast
// path to consent to ("nothing you didn't broadcast is ever kept"). This
// component is kept parked (not deleted) for a possible future
// non-friends-and-family return; it is no longer wired into any screen and is
// shown in the gallery as parked. The SENSITIVE/BENIGN tiering it depended on
// is likewise retired. See the Rolling Buffer initiative in CLAUDE.md + DESIGN.md decision log.
//
// Original purpose ↓
// Consent step shown when Record is enabled for a SENSITIVE source on
// the Go Live & Record screen (clips initiative, 2026-06-03 decision-log
// entry). The capture guardrail is "nothing recorded silently" — a
// sensitive source (camera / audio / location; screen pending) routes
// its record affordance through this visible, non-manipulative consent
// before the track is captured to disk.
//
// States plainly what's saved, that record can exceed the live view, and
// offers an easy decline. Composes BottomSheet + Icon + Text + Button.
// Per-source default copy is provided and overridable.

import { StyleSheet, View } from 'react-native'
import { BottomSheet } from '@/components/primitives/BottomSheet'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'
import { theme } from '@/tokens/theme'

export type ConsentBullet = { text: string; caption?: string }

type Props = {
  visible: boolean
  onClose: () => void
  // Lowercase source noun, e.g. "camera" / "audio" / "location".
  sourceLabel: string
  onConfirm: () => void
  title?: string
  lede?: string
  bullets?: ConsentBullet[]
  confirmLabel?: string
  fine?: string
}

const DEFAULT_BULLETS: ConsentBullet[] = [
  { text: 'Saved to your device at full quality', caption: 'Stored locally on this phone' },
  { text: 'Can capture more than viewers see', caption: 'Record runs even when air is off' },
  { text: 'Useful for later multi-angle edits', caption: 'Reveal a record-only source in the editor' },
]

export function RecordConsentSheet({
  visible,
  onClose,
  sourceLabel,
  onConfirm,
  title,
  lede,
  bullets = DEFAULT_BULLETS,
  confirmLabel,
  fine = "You'll see a recording indicator the whole time",
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} variant="peek" peekHeight={CONSENT_HEIGHT}>
      <View style={styles.content}>
        <View style={styles.iconFrame}>
          <Icon name="lock" size="lg" color={theme.colors.accent.default} />
        </View>
        <Text variant="heading">{title ?? `Record the ${sourceLabel} to your device?`}</Text>
        <Text variant="body" color={theme.colors.text.muted} style={styles.lede}>
          {lede ??
            `Turning on record saves this source to your phone, even if you never go live with it. You can edit or delete it afterward.`}
        </Text>

        <View style={styles.what}>
          {bullets.map((b, i) => (
            <View key={i} style={[styles.bulletRow, i > 0 && styles.bulletBorder]}>
              <View style={styles.bulletDot} />
              <View style={styles.bulletCol}>
                <Text variant="body">{b.text}</Text>
                {b.caption && (
                  <Text variant="monoLabel" color={theme.colors.text.subtle}>
                    {b.caption}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.acts}>
          <Button label={confirmLabel ?? 'Turn on recording'} onPress={onConfirm} size="lg" />
          <Button label="Not now" onPress={onClose} variant="secondary" size="lg" />
        </View>
        <Text variant="monoLabel" color={theme.colors.text.subtle} style={styles.fine}>
          {fine}
        </Text>
      </View>
    </BottomSheet>
  )
}

const ICON_FRAME = 46
// Content-sized sheet — tall enough for icon + title + lede + a 3-bullet
// list + two buttons + fine print without the near-fullscreen `expanded`.
const CONSENT_HEIGHT = 500

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  iconFrame: {
    width: ICON_FRAME,
    height: ICON_FRAME,
    borderRadius: ICON_FRAME / 2,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 1,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  lede: {
    marginBottom: theme.spacing.sm,
  },
  what: {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.primary,
    marginBottom: theme.spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  bulletBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent.default,
    marginTop: theme.spacing.xs + 1,
  },
  bulletCol: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  acts: {
    gap: theme.spacing.sm,
  },
  fine: {
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
})
