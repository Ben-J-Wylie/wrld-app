import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/lib/env'
import { useAuthStore } from '@/stores/authStore'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token to every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear auth (Phase 3 will add token refresh)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().clearUser()
    }
    return Promise.reject(error)
  },
)
