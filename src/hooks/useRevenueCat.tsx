// src/hooks/useRevenueCat.tsx
//
// React binding for RevenueCat. Owns:
//   • one-time SDK configuration
//   • identity sync with Clerk (logIn on sign-in, logOut on sign-out)
//   • a live `customerInfo` via the SDK's update listener
//   • backend reconciliation: when entitlements change, refetch /auth/me so the
//     authoritative `wrldUser.tier` updates (the webhook is the real switch;
//     this just pulls the result through promptly instead of waiting for a poll)
//
// Mount <RevenueCatProvider> inside ClerkProvider (needs Clerk auth) and inside
// QueryClientProvider. Consume with useRevenueCat().

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Purchases, { type CustomerInfo } from 'react-native-purchases'
import { useAuth } from '@clerk/clerk-expo'
import {
  configurePurchases,
  getCustomerInfo,
  hasPlus,
  identify,
  isPurchasesConfigured,
  signOutPurchases,
} from '@/lib/purchases'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'

type RevenueCatValue = {
  /** Latest CustomerInfo, or null before the first load / when unconfigured. */
  customerInfo: CustomerInfo | null
  /** Fast UX hint — true if the WRLD Plus entitlement is currently active. */
  isPlus: boolean
  /** Whether the SDK was configured (false if no key wired for this platform). */
  available: boolean
  /** Force-refresh CustomerInfo from the store + pull the backend tier through. */
  refresh: () => Promise<void>
}

const Ctx = createContext<RevenueCatValue>({
  customerInfo: null,
  isPlus: false,
  available: false,
  refresh: async () => undefined,
})

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const setWrldUser = useAuthStore((s) => s.setWrldUser)

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const lastBoundUser = useRef<string | null>(null)

  // Pull the authoritative WRLD user (with the webhook-updated tier) through.
  // Best-effort: a transient failure just means we keep the cached tier.
  async function syncBackendTier() {
    try {
      const me = await usersApi.getMe()
      setWrldUser(me)
    } catch (e) {
      console.warn('[revenuecat] /auth/me refresh failed', e)
    }
  }

  async function refresh() {
    const info = await getCustomerInfo()
    if (info) setCustomerInfo(info)
    await syncBackendTier()
  }

  // 1) Configure once, as early as possible (anonymous — identity comes next).
  useEffect(() => {
    configurePurchases()
  }, [])

  // 2) Keep CustomerInfo live for the whole session. The listener fires on
  //    every entitlement change (purchase, renewal, expiry, refund) — including
  //    ones initiated outside the app — so we reconcile the backend each time.
  useEffect(() => {
    if (!isPurchasesConfigured()) return
    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info)
      void syncBackendTier()
    }
    Purchases.addCustomerInfoUpdateListener(listener)
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3) Identity sync with Clerk. logIn binds RevenueCat's app-user-id to the
  //    Clerk id (so the webhook can map purchases → WRLD account); logOut resets
  //    to anonymous on sign-out.
  useEffect(() => {
    if (!isLoaded || !isPurchasesConfigured()) return

    async function sync() {
      if (isSignedIn && userId) {
        if (lastBoundUser.current === userId) return
        lastBoundUser.current = userId
        const info = await identify(userId).catch((e) => {
          console.warn('[revenuecat] identify failed', e)
          return null
        })
        if (info) setCustomerInfo(info)
      } else if (!isSignedIn && lastBoundUser.current) {
        lastBoundUser.current = null
        await signOutPurchases()
        setCustomerInfo(null)
      }
    }
    void sync()
  }, [isLoaded, isSignedIn, userId])

  const value: RevenueCatValue = {
    customerInfo,
    isPlus: hasPlus(customerInfo),
    available: isPurchasesConfigured(),
    refresh,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRevenueCat(): RevenueCatValue {
  return useContext(Ctx)
}
