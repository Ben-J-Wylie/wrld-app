import { create } from 'zustand'
import type { User } from '@/types'

type AuthState = {
  wrldUser: User | null
  setWrldUser: (user: User) => void
  clearWrldUser: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  wrldUser: null,
  setWrldUser: (wrldUser) => set({ wrldUser }),
  clearWrldUser: () => set({ wrldUser: null }),
}))
