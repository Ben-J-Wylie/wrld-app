import axios from 'axios'
import { env } from '@/lib/env'
import { getClerkToken } from '@/lib/clerkToken'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
})

// Clerk's getToken() normally resolves in well under a second, but if it ever
// stalls (session-refresh wedge, native-bridge hiccup) the request never even
// starts — and axios's `timeout` only covers the in-flight request, not this
// pre-request await — so the whole call hangs forever (this is what trapped the
// account-reactivation screen). Cap the token fetch: if it isn't ready in time,
// send the request without auth. An auth-required route then 401s (which the app
// handles) instead of hanging indefinitely.
const TOKEN_TIMEOUT_MS = 5000

function tokenWithTimeout(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS)
  })
  return Promise.race([getClerkToken().catch(() => null), timeout]).finally(() => clearTimeout(timer))
}

// Attach Clerk JWT when signed in; send no auth header when anonymous
apiClient.interceptors.request.use(async (config) => {
  const token = await tokenWithTimeout()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
