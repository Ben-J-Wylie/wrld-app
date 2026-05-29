import { useEffect } from 'react'
import { router } from 'expo-router'

export function BroadcasterOnboardingScreen() {
  useEffect(() => {
    router.replace('/(app)/creator-onboarding')
  }, [])
  return null
}
