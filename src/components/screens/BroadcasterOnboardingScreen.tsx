// src/components/screens/BroadcasterOnboardingScreen.tsx
//
// Compatibility shim — historical /(app)/broadcaster-onboarding route
// redirects to /(app)/creator-onboarding. Pre-v0.2 the wizard was
// "broadcaster onboarding"; it became "creator onboarding" in the
// 2026-05-29 re-baseline. The route stays for old deep-links /
// notification payloads that may still reference the old path.
//
// Nothing here needs design-system migration; the screen renders null
// and immediately replaces its history entry with the new route.

import { useEffect } from 'react'
import { router } from 'expo-router'

export function BroadcasterOnboardingScreen() {
  useEffect(() => {
    router.replace('/(app)/creator-onboarding')
  }, [])
  return null
}
