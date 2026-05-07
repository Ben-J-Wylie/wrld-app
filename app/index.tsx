import { Redirect } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'

export default function Index() {
  const { isLoaded } = useAuth()
  // Loading state is handled by RootNavigator (renders null until isLoaded).
  // By the time this renders, isLoaded is true. Always go to globe —
  // anonymous users browse freely; signed-in users have full access.
  if (!isLoaded) return null
  return <Redirect href="/(app)/globe" />
}
