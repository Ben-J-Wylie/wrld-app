import { useEffect } from 'react'
import { router } from 'expo-router'

export default function BroadcasterOnboardingRedirect() {
  useEffect(() => {
    router.replace('/(app)/creator-onboarding')
  }, [])
  return null
}
