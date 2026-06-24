import { create } from 'zustand'
import type { User } from '@/types'

type AuthState = {
  wrldUser: User | null
  setWrldUser: (user: User) => void
  clearWrldUser: () => void
  // Set when the signed-in account is soft-deleted and inside its recovery grace
  // period (the ISO date it will be anonymised). Drives the full-screen reactivation
  // gate. Null = not pending. /auth/me 403s a deleted account, so this is sourced
  // from GET /users/me/account-status (and set directly right after a self-delete).
  deletionPendingUntil: string | null
  setDeletionPending: (until: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  wrldUser: null,
  setWrldUser: (wrldUser) => set({ wrldUser }),
  clearWrldUser: () => set({ wrldUser: null }),
  deletionPendingUntil: null,
  setDeletionPending: (deletionPendingUntil) => set({ deletionPendingUntil }),
}))
