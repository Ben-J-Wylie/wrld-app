// src/lib/paywall.ts
//
// RevenueCat's prebuilt native UI (`react-native-purchases-ui`): the Paywall
// and the Customer Center. These render fully native sheets configured from
// the RevenueCat dashboard — no React screens to maintain. Design the paywall
// at RevenueCat → Paywalls (attach it to your offering); design the Customer
// Center at RevenueCat → Customer Center.

import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui'
import { PLUS_ENTITLEMENT } from '@/lib/purchases'

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'not_presented' | 'error'

function mapResult(result: PAYWALL_RESULT): PaywallOutcome {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return 'purchased'
    case PAYWALL_RESULT.RESTORED:
      return 'restored'
    case PAYWALL_RESULT.NOT_PRESENTED:
      return 'not_presented' // already entitled — nothing shown
    case PAYWALL_RESULT.CANCELLED:
    default:
      return 'cancelled'
  }
}

/**
 * Present the WRLD Plus paywall ONLY if the user doesn't already hold the
 * entitlement. Returns the outcome so the caller can refetch /auth/me on a
 * 'purchased' | 'restored' (so the authoritative `tier` updates).
 *
 * NOTE: not currently called — the Subscription screen uses `presentPlusPaywall`
 * (always-present, gated on tier by the screen itself). Retained as a public
 * paywall entry point for "soft gate" call sites (e.g. tapping a Plus-only
 * feature) that should no-op when the user is already entitled.
 */
export async function presentPlusPaywallIfNeeded(): Promise<PaywallOutcome> {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PLUS_ENTITLEMENT,
    })
    return mapResult(result)
  } catch (e) {
    console.warn('[paywall] presentPaywallIfNeeded failed', e)
    return 'error'
  }
}

/** Always present the paywall (e.g. an explicit "Upgrade" tap). */
export async function presentPlusPaywall(): Promise<PaywallOutcome> {
  try {
    const result = await RevenueCatUI.presentPaywall()
    return mapResult(result)
  } catch (e) {
    console.warn('[paywall] presentPaywall failed', e)
    return 'error'
  }
}

/**
 * Present the Customer Center — the native flow where subscribers manage,
 * cancel, request refunds, or get support. Surface this for current Plus
 * subscribers (e.g. a "Manage subscription" row).
 */
export async function presentCustomerCenter(): Promise<void> {
  try {
    await RevenueCatUI.presentCustomerCenter()
  } catch (e) {
    console.warn('[paywall] presentCustomerCenter failed', e)
  }
}
