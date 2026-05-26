import axios from 'axios'
import { env } from '@/lib/env'
import { getClerkToken } from '@/lib/clerkToken'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
})

// Attach Clerk JWT when signed in; send no auth header when anonymous
apiClient.interceptors.request.use(async (config) => {
  const token = await getClerkToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
