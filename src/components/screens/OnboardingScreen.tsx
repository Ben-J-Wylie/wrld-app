// src/components/screens/OnboardingScreen.tsx
//
// 12.6 migration target. The three onboarding steps (handle → avatar →
// choice) now run inside the canonical WizardShell chrome.
//
// Composes:
//   • WizardShell for each step (top nav with ProgressBar, head, body,
//     primary CTA footer)
//   • Input (prefix variant '@') + RulesChecklist + HelpText for the
//     handle step's live client-side rules + server error
//   • AvatarPicker for the avatar step (replaces the inline Avatar +
//     two buttons), with `uploading` state when finalising
//   • The choice step models the fork as primary CTA "Watch live
//     streams" + skip "Go live as a creator instead" — both routes
//     are equally valid endings; the primary tracks the default
//     anonymous-viewer flow.

import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Filter as ProfanityFilter } from 'bad-words'
import { foldLeetspeak } from '@/lib/profanity'

const profanityFilter = new ProfanityFilter()
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { WizardShell } from '@/components/sections/WizardShell'
import { Input } from '@/components/primitives/Input'
import { HelpText } from '@/components/primitives/HelpText'
import { AvatarPicker } from '@/components/features/user/AvatarPicker'
import { RulesChecklist, type Rule } from '@/components/features/onboarding/RulesChecklist'
import { ConsentRow } from '@/components/features/onboarding/ConsentRow'
import { LegalLinkList } from '@/components/sections/LegalLinkList'
import { LegalDocSheet } from '@/components/sections/LegalDocSheet'
import { theme } from '@/tokens/theme'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'
import { useSetCurrentUser } from '@/hooks/useCurrentUser'

type Step = 'handle' | 'avatar' | 'legal' | 'choice'

const HANDLE_RE = /^[a-z0-9_]+$/

function computeHandleRules(handle: string): Rule[] {
  const len = handle.length
  const lenStatus: Rule['status'] = len === 0 ? 'neutral' : len >= 3 && len <= 20 ? 'met' : 'bad'
  const charStatus: Rule['status'] = len === 0 ? 'neutral' : HANDLE_RE.test(handle) ? 'met' : 'bad'
  const profanityStatus: Rule['status'] = len === 0 ? 'neutral' : profanityFilter.isProfane(foldLeetspeak(handle)) ? 'bad' : 'met'
  return [
    { label: '3–20 CHARACTERS', status: lenStatus },
    { label: 'LETTERS, NUMBERS, AND UNDERSCORES ONLY', status: charStatus },
    { label: 'NO INAPPROPRIATE WORDS', status: profanityStatus },
  ]
}

function handlePassesClientRules(handle: string): boolean {
  return computeHandleRules(handle).every((r) => r.status === 'met')
}

export function OnboardingScreen() {
  const wrldUser = useAuthStore((s) => s.wrldUser)
  const setWrldUser = useAuthStore((s) => s.setWrldUser)
  const setCurrentUser = useSetCurrentUser()

  const [step, setStep] = useState<Step>('legal')
  const [legalSheet, setLegalSheet] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [handleError, setHandleError] = useState('')
  const [handleLoading, setHandleLoading] = useState(false)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [avatarMime, setAvatarMime] = useState<string>('image/jpeg')
  const [avatarLoading, setAvatarLoading] = useState(false)
  // Legal acceptance step (everyone, at signup).
  const [acceptTos, setAcceptTos] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [acceptRules, setAcceptRules] = useState(false)

  async function submitHandle() {
    const trimmed = handle.trim().toLowerCase()
    if (!handlePassesClientRules(trimmed)) return
    setHandleError('')
    setHandleLoading(true)
    try {
      const updated = await usersApi.updateProfile({ handle: trimmed })
      setWrldUser(updated)
      setCurrentUser(updated)
      setStep('avatar')
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

  async function pickAvatar(source: 'gallery' | 'camera') {
    // expo-image-picker doesn't auto-request runtime permissions —
    // the launch* calls throw "Missing camera or camera roll permission"
    // if we skip this step.
    const perm =
      source === 'gallery'
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(
        source === 'gallery' ? 'Photo library access required' : 'Camera access required',
        'Enable in Settings to upload an avatar.',
      )
      return
    }
    const result =
      source === 'gallery'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setAvatarUri(asset.uri)
      setAvatarMime(asset.mimeType ?? 'image/jpeg')
    }
  }

  async function finishAvatar() {
    if (avatarUri) {
      setAvatarLoading(true)
      try {
        const updated = await usersApi.uploadAvatar(avatarUri, avatarMime)
        setWrldUser(updated)
        setCurrentUser(updated)
      } catch {
        // non-fatal — proceed to the choice step regardless
      } finally {
        setAvatarLoading(false)
      }
    }
    setStep('choice')
  }

  const displayForAvatar = wrldUser?.displayName ?? 'You'

  if (step === 'handle') {
    return (
      <WizardShell
        total={4}
        current={2}
        heading="Choose your handle"
        body="This is how others find and mention you. You can change it once every 30 days."
        ctaLabel="Continue"
        onCta={submitHandle}
        ctaDisabled={!handlePassesClientRules(handle.trim().toLowerCase())}
        ctaLoading={handleLoading}
      >
        <Input
          variant="prefix"
          prefix="@"
          placeholder="yourhandle"
          value={handle}
          onChangeText={(t) => {
            setHandle(t.toLowerCase())
            setHandleError('')
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {!!handleError && <HelpText tone="err">{handleError}</HelpText>}
        <RulesChecklist rules={computeHandleRules(handle)} />
      </WizardShell>
    )
  }

  if (step === 'avatar') {
    const previewName = wrldUser?.displayName ?? displayForAvatar
    return (
      <WizardShell
        total={4}
        current={3}
        heading="Add a photo"
        body="Put a face to the handle. You can always update this later."
        ctaLabel={avatarUri ? 'Done' : 'Skip for now'}
        onCta={finishAvatar}
        ctaLoading={avatarLoading}
      >
        <AvatarPicker
          avatarUrl={avatarUri}
          displayName={previewName}
          uploading={avatarLoading}
          onTake={() => pickAvatar('camera')}
          onPick={() => pickAvatar('gallery')}
        />
      </WizardShell>
    )
  }

  if (step === 'legal') {
    return (
      <>
        <WizardShell
          total={4}
          current={1}
          heading="Agree to the essentials"
          body="Please review and accept these to continue."
          ctaLabel="Agree & continue"
          onCta={() => setStep('handle')}
          ctaDisabled={!(acceptTos && acceptPrivacy && acceptRules)}
        >
          <View style={styles.tosBlock}>
            <ConsentRow
              title="Terms of Service"
              description="I agree to the Terms of Service"
              on={acceptTos}
              onToggle={setAcceptTos}
            />
            <ConsentRow
              title="Privacy Policy"
              description="I have read the Privacy Policy"
              on={acceptPrivacy}
              onToggle={setAcceptPrivacy}
            />
            <ConsentRow
              title="Community Rules"
              description="I agree to follow the Community Rules"
              on={acceptRules}
              onToggle={setAcceptRules}
            />
          </View>
          <LegalLinkList
            docs={[
              { id: 'tos', label: 'Read terms of service', onPress: () => setLegalSheet('terms') },
              { id: 'privacy', label: 'Read privacy policy', onPress: () => setLegalSheet('privacy') },
              { id: 'rules', label: 'Read community rules', onPress: () => setLegalSheet('community') },
            ]}
          />
        </WizardShell>
        {legalSheet && <LegalDocSheet slug={legalSheet} onClose={() => setLegalSheet(null)} />}
      </>
    )
  }

  return (
    <WizardShell
      total={4}
      current={4}
      heading="What brings you to Wrld?"
      body="You can always change this later."
      ctaLabel="Watch live streams"
      onCta={() => router.replace('/(app)/globe')}
      onSkip={() => router.replace('/(app)/creator-onboarding')}
      skipLabel="Go live as a creator instead"
    >
      {null}
    </WizardShell>
  )
}

const styles = StyleSheet.create({
  tosBlock: {
    gap: theme.spacing.xs,
  },
})
