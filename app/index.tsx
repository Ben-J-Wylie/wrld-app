import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

export default function Index() {
  const isAuthenticated = useAuthStore((s) => !!s.user)
  return <Redirect href={isAuthenticated ? '/(app)/globe' : '/(auth)/login'} />
}
