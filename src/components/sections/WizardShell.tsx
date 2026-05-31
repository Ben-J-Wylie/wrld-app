// src/components/sections/WizardShell.tsx
//
// Universal wizard chrome. Top nav (back IconButton + ProgressBar +
// close IconButton) + optional ContextBanner + Head (h2 + p) + slotted
// body + footer (primary CTA + optional skip). Skip lives directly
// under the primary CTA — never above it, never in the header. Used
// by all v0.2 wizards (Viewer Onboarding, Creator Onboarding, Handle
// Onboarding, Change Handle) and future wizards.

import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { ScreenScroll } from './ScreenScroll'
import { Text } from '@/components/primitives/Text'
import { IconButton } from '@/components/primitives/IconButton'
import { ProgressBar } from '@/components/primitives/ProgressBar'
import { Button } from '@/components/primitives/Button'
import { ContextBanner } from '@/components/features/onboarding/ContextBanner'
import { theme } from '@/tokens/theme'

type ContextBannerProps = {
  variant?: 'accent' | 'warn'
  label: string
  iconName?: React.ComponentProps<typeof ContextBanner>['iconName']
}

type Props = {
  total: number
  current: number
  onBack?: () => void
  onClose?: () => void
  contextBanner?: ContextBannerProps
  heading: string
  body?: string
  children: ReactNode
  ctaLabel: string
  onCta: () => void
  ctaDisabled?: boolean
  ctaLoading?: boolean
  onSkip?: () => void
  skipLabel?: string
  style?: StyleProp<ViewStyle>
}

export function WizardShell({
  total,
  current,
  onBack,
  onClose,
  contextBanner,
  heading,
  body,
  children,
  ctaLabel,
  onCta,
  ctaDisabled,
  ctaLoading,
  onSkip,
  skipLabel = 'Skip',
  style,
}: Props) {
  return (
    <ScreenScroll contentContainerStyle={[styles.scroll, style as ViewStyle]}>
      <View style={styles.topNav}>
        {onBack ? (
          <IconButton
            name="arrow-left"
            variant="ghost"
            onPress={onBack}
            accessibilityLabel="Back"
          />
        ) : (
          <View style={styles.iconSpacer} />
        )}
        <View style={styles.progressWrap}>
          <ProgressBar total={total} current={current} />
        </View>
        {onClose ? (
          <IconButton
            name="x"
            variant="ghost"
            onPress={onClose}
            accessibilityLabel="Close"
          />
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>

      {contextBanner && (
        <ContextBanner
          variant={contextBanner.variant}
          iconName={contextBanner.iconName}
          label={contextBanner.label}
        />
      )}

      <View style={styles.head}>
        <Text variant="display">{heading}</Text>
        {body && (
          <Text variant="body" color={theme.colors.text.muted}>
            {body}
          </Text>
        )}
      </View>

      <View style={styles.body}>{children}</View>

      <View style={styles.footer}>
        <Button
          variant="primary"
          label={ctaLabel}
          onPress={onCta}
          disabled={ctaDisabled}
          loading={ctaLoading}
        />
        {onSkip && <Button variant="skip" label={skipLabel} onPress={onSkip} />}
      </View>
    </ScreenScroll>
  )
}

const ICON_DIM = 36

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconSpacer: {
    width: ICON_DIM,
    height: ICON_DIM,
  },
  progressWrap: {
    flex: 1,
  },
  head: {
    gap: theme.spacing.sm,
  },
  body: {
    gap: theme.spacing.md,
  },
  footer: {
    gap: theme.spacing.sm,
  },
})
