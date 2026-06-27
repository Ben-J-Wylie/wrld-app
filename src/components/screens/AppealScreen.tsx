// The standalone appeals surface. Two modes, one screen:
//  • token mode (?t=…) — the emailed appeal link, deep-linked via wrld://appeal?t=….
//    Unauthenticated; the signed token identifies the appellant, so it works even
//    for a hard-banned account that can't otherwise reach the form.
//  • session mode (no token) — a logged-in suspended user arriving from the
//    suspension banner / ban gate; uses their session + cached WRLD user.
// Same look either way; only the data source + submit endpoint differ. Mirrors
// wrld-web's AppealPage.

import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { useAuthStore } from '@/stores/authStore'
import { usersApi, type AppealContext } from '@/api/users'
import { theme } from '@/tokens/theme'

export function AppealScreen() {
  const { t } = useLocalSearchParams<{ t?: string }>()
  const token = typeof t === 'string' && t.length > 0 ? t : null
  const wrldUser = useAuthStore((s) => s.wrldUser)
  const setWrldUser = useAuthStore((s) => s.setWrldUser)

  // Token mode: fetch context from the signed link (no session).
  const { data: tokenCtx, isLoading: ctxLoading, isError: ctxError } = useQuery({
    queryKey: ['appeal-context', token],
    queryFn: () => usersApi.appealContext(token!),
    enabled: !!token,
    retry: false,
  })

  // Session-mode context derived from the cached user (permanent = year ≥ 2090,
  // the app-wide convention for a permanent suspension sentinel).
  const sessionCtx: AppealContext | null = (() => {
    if (token || !wrldUser?.suspendedUntil) return null
    const until = new Date(wrldUser.suspendedUntil)
    if (until.getTime() <= Date.now()) return null
    return {
      handle: wrldUser.handle,
      displayName: wrldUser.displayName ?? null,
      suspended: true,
      permanent: until.getFullYear() >= 2090,
      suspendedUntil: wrldUser.suspendedUntil,
      suspendedReason: wrldUser.suspendedReason ?? null,
      alreadyAppealed: wrldUser.appealState === 'pending',
    }
  })()

  const ctx = token ? tokenCtx ?? null : sessionCtx
  // A prior appeal was reviewed + denied within the cooldown — show that instead
  // of a form that would just 429 on submit. (Session mode only; the token feed
  // signals an existing appeal via alreadyAppealed.)
  const deniedCooldown = !token && wrldUser?.appealState === 'denied'

  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ctx?.alreadyAppealed) setDone(true)
  }, [ctx?.alreadyAppealed])

  const submit = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      if (token) await usersApi.appealWithToken(token, message.trim())
      else await usersApi.appeal(message.trim())
      setDone(true)
      // Optimistically mark the cached user's appeal pending so the ban gate /
      // banner immediately read "under review" instead of re-inviting an appeal
      // when Done returns there (server reflects it on the next /auth/me).
      if (!token && wrldUser) setWrldUser({ ...wrldUser, appealState: 'pending' })
    } catch (e: unknown) {
      // Surface the server's specific reason (e.g. the appeal cooldown after a
      // denial, or "no active suspension") rather than a generic retry message —
      // most of these are not transient, so "try again" is misleading.
      const serverMsg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(serverMsg || 'Could not submit your appeal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // replace (not navigate) so the appeal screen leaves the stack — Done / Back
  // land on the globe rather than risk a no-op back to an already-mounted route.
  // (For a permanently banned account the globe is then covered by the BanGate,
  // by design — a ban walls off the app; the only ways off the gate are appeal or
  // sign out.)
  const close = () => router.replace('/(app)/globe')

  return (
    <ScreenScroll
      header={
        <Pressable onPress={close} style={styles.backRow} accessibilityRole="button" accessibilityLabel="Back to globe">
          <Icon name="chevron-left" size="md" color={theme.colors.text.muted} />
          <Text variant="body" color={theme.colors.text.muted}>Back to globe</Text>
        </Pressable>
      }
      contentContainerStyle={styles.scroll}
      bottomOffset={theme.spacing.xl}
    >
        <View style={styles.card}>
          {token && ctxLoading ? (
            <Text variant="body" color={theme.colors.text.muted}>
              Loading…
            </Text>
          ) : token && (ctxError || !tokenCtx) ? (
            <Invalid onClose={close} />
          ) : !ctx ? (
            <NoSuspension signedIn={!!wrldUser} onClose={close} />
          ) : deniedCooldown && !done ? (
            <Denied onClose={close} />
          ) : done ? (
            <Submitted onClose={close} />
          ) : (
            <>
              <View style={styles.tagRow}>
                <Icon name="slash" size="sm" color={theme.colors.warn} />
                <Text variant="monoCaption" color={theme.colors.warn}>
                  ACCOUNT SUSPENDED
                </Text>
              </View>
              <Text variant="heading" color={theme.colors.text.primary} style={styles.heading}>
                Appeal your suspension
              </Text>
              <Text variant="body" color={theme.colors.text.muted}>
                {ctx.permanent
                  ? `@${ctx.handle} has been permanently suspended.`
                  : `@${ctx.handle} is suspended until ${new Date(ctx.suspendedUntil!).toLocaleDateString(
                      undefined,
                      { year: 'numeric', month: 'long', day: 'numeric' },
                    )}.`}
              </Text>
              {ctx.suspendedReason ? (
                <Text variant="body" color={theme.colors.text.muted} style={styles.reason}>
                  Reason: {ctx.suspendedReason}
                </Text>
              ) : null}

              <Text variant="body" color={theme.colors.text.primary} style={styles.label}>
                Tell us why this should be reviewed
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={1000}
                placeholder="Explain your side. A moderator will review it."
                placeholderTextColor={theme.colors.text.subtle}
                style={styles.input}
              />
              <Text variant="monoCaption" color={theme.colors.text.subtle} style={styles.counter}>
                {message.length}/1000
              </Text>

              {error ? (
                <Text variant="caption" color={theme.colors.warn} style={styles.reason}>
                  {error}
                </Text>
              ) : null}

              <Button
                label={submitting ? 'Submitting…' : 'Submit appeal'}
                onPress={submit}
                variant="primary"
                disabled={!message.trim() || submitting}
              />
              <Text variant="caption" color={theme.colors.text.subtle} style={styles.footnote}>
                You'll be notified by email when a moderator reviews your appeal.
              </Text>
            </>
          )}
        </View>
    </ScreenScroll>
  )
}

function Submitted({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.centered}>
      <Icon name="check-circle" size={40} color={theme.colors.accent.default} />
      <Text variant="heading" color={theme.colors.text.primary} style={styles.heading}>
        Appeal submitted
      </Text>
      <Text variant="body" color={theme.colors.text.muted} style={styles.centeredBody}>
        A moderator will review it. We'll email you the decision.
      </Text>
      <Button label="Done" onPress={onClose} variant="secondary" />
    </View>
  )
}

function Denied({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.centered}>
      <Icon name="slash" size={40} color={theme.colors.text.subtle} />
      <Text variant="heading" color={theme.colors.text.primary} style={styles.heading}>
        Appeal reviewed
      </Text>
      <Text variant="body" color={theme.colors.text.muted} style={styles.centeredBody}>
        A moderator reviewed your appeal and the suspension stands. If anything changes you'll be notified by email.
      </Text>
      <Button label="Back to globe" onPress={onClose} variant="secondary" />
    </View>
  )
}

function Invalid({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.centered}>
      <Icon name="slash" size={40} color={theme.colors.text.subtle} />
      <Text variant="heading" color={theme.colors.text.primary} style={styles.heading}>
        This appeal link is invalid or expired
      </Text>
      <Text variant="body" color={theme.colors.text.muted} style={styles.centeredBody}>
        If you're signed in, open the appeal from the banner at the top of the app instead.
      </Text>
      <Button label="Back to globe" onPress={onClose} variant="secondary" />
    </View>
  )
}

function NoSuspension({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  return (
    <View style={styles.centered}>
      <Icon name="check-circle" size={40} color={theme.colors.accent.default} />
      <Text variant="heading" color={theme.colors.text.primary} style={styles.heading}>
        No active suspension
      </Text>
      <Text variant="body" color={theme.colors.text.muted} style={styles.centeredBody}>
        {signedIn
          ? 'Your account is in good standing — nothing to appeal.'
          : 'Open the appeal link from your suspension email to continue.'}
      </Text>
      <Button label="Back to globe" onPress={onClose} variant="secondary" />
    </View>
  )
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    alignSelf: 'flex-start',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  heading: {
    marginTop: theme.spacing.xs,
  },
  reason: {
    marginTop: theme.spacing.xs,
  },
  label: {
    marginTop: theme.spacing.md,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text.primary,
    textAlignVertical: 'top',
    marginTop: theme.spacing.xs,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing.xs,
  },
  footnote: {
    marginTop: theme.spacing.sm,
  },
  centered: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  centeredBody: {
    textAlign: 'center',
    lineHeight: 22,
  },
})
