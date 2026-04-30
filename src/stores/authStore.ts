import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from '@/types'

const STORAGE_KEY = 'wrld:auth'

type AuthState = {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setUser: (user: User) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  clearUser: () => Promise<void>
  hydrate: () => Promise<void>
}

type Persisted = Pick<AuthState, 'user' | 'accessToken' | 'refreshToken'>

async function persist(state: Persisted) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Failed to persist auth state', err)
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  setUser: (user) => {
    set({ user })
    persist({ user, accessToken: get().accessToken, refreshToken: get().refreshToken })
  },

  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken })
    persist({ user: get().user, accessToken, refreshToken })
  },

  clearUser: async () => {
    set({ user: null, accessToken: null, refreshToken: null })
    try {
      await AsyncStorage.removeItem(STORAGE_KEY)
    } catch (err) {
      console.warn('Failed to clear auth state', err)
    }
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Persisted
      set({
        user: parsed.user ?? null,
        accessToken: parsed.accessToken ?? null,
        refreshToken: parsed.refreshToken ?? null,
      })
    } catch (err) {
      console.warn('Failed to hydrate auth state', err)
    }
  },
}))
