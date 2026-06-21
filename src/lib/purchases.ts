// src/lib/purchases.ts
//
// Thin, typed wrapper around the RevenueCat SDK (`react-native-purchases`).
// This module owns *configuration, identity, and the raw purchase/restore
// calls*. React state lives in `useRevenueCat` (the provider); the paywall +
// Customer Center native UI lives in `paywall.ts`.
//
// ── Source-of-truth contract ────────────────────────────────────────────────
// RevenueCat is the BILLING layer, not the authorization layer. The WRLD
// backend remains the single source of truth for `wrldUser.tier`:
//   purchase → RevenueCat → webhook → wrld-backend sets tier='plus'
// The client entitlement (`CustomerInfo.entitlements.active[PLUS_ENTITLEMENT]`)
// is only a fast UX hint. After any purchase/restore we refetch /auth/me so the
// app gates on the authoritative `tier`. Never grant a paid feature on the
// client entitlement alone.

import { Platform } from 'react-native'
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases'
import { env } from '@/lib/env'

// Entitlement identifier EXACTLY as configured in the RevenueCat dashboard
// (Entitlements tab). Case-sensitive. Maps to the WRLD `plus` tier.
export const PLUS_ENTITLEMENT = 'WRLD Plus'

let configured = false

/** Platform-specific public SDK key. Empty string if unset (then we no-op). */
function apiKey(): string {
  return (
    Platform.select({
      ios: env.revenueCatAppleKey,
      android: env.revenueCatGoogleKey,
      default: '',
    }) ?? ''
  )
}

/** True once `configurePurchases` has run with a real key. */
export function isPurchasesConfigured(): boolean {
  return configured
}

/**
 * Configure the SDK exactly once, as early as possible. Safe to call again —
 * subsequent calls no-op. Pass the Clerk user id if known at call time;
 * otherwise we start anonymous and `identify()` later when auth resolves.
 */
export function configurePurchases(appUserId?: string | null): void {
  if (configured) return
  const key = apiKey()
  if (!key || key === 'appl_' || key === 'goog_') {
    // No key wired yet (e.g. store accounts not set up). Don't crash startup —
    // the rest of the app must keep working. Paywall calls will surface this.
    console.warn(
      '[purchases] No RevenueCat key for this platform — skipping configure. ' +
        'Set EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.',
    )
    return
  }
  if (env.enableDevTools) Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  Purchases.configure({ apiKey: key, appUserID: appUserId ?? null })
  configured = true
}

/**
 * Bind the RevenueCat app-user-id to the Clerk/WRLD user id. This is REQUIRED
 * for the backend webhook to map a purchase back to a WRLD account — without
 * it RevenueCat uses a random anonymous id and the webhook can't reconcile.
 */
export async function identify(clerkUserId: string): Promise<CustomerInfo | null> {
  if (!configured) return null
  const { customerInfo } = await Purchases.logIn(clerkUserId)
  return customerInfo
}

/** Reset to an anonymous id on sign-out so the next user starts clean. */
export async function signOutPurchases(): Promise<void> {
  if (!configured) return
  // logOut throws if already anonymous — harmless, swallow it.
  await Purchases.logOut().catch(() => undefined)
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null
  return Purchases.getCustomerInfo()
}

/** The current offering (Monthly / Yearly packages live here). */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null
  const offerings = await Purchases.getOfferings()
  return offerings.current ?? null
}

// Offering identifier for the Space Bucks consumable catalog, EXACTLY as named
// in the RevenueCat dashboard (Offerings tab). Distinct from the `current`
// offering, which holds the WRLD Plus subscription packages.
export const SPACE_BUCKS_OFFERING = 'spacebucks'

/**
 * The Space Bucks consumable packages (one per top-up bundle), or [] if the SDK
 * isn't configured or the offering doesn't exist yet. Each package's
 * `product.identifier` is the store product id the backend TOPUP_BUNDLES catalog
 * maps to a bucks amount; `product.priceString` is the localized store price.
 */
export async function getSpaceBucksPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return []
  try {
    const offerings = await Purchases.getOfferings()
    return offerings.all[SPACE_BUCKS_OFFERING]?.availablePackages ?? []
  } catch (e) {
    console.warn('[purchases] getSpaceBucksPackages failed', e)
    return []
  }
}

/** True if the customer currently holds the WRLD Plus entitlement. */
export function hasPlus(info: CustomerInfo | null | undefined): boolean {
  return !!info?.entitlements.active[PLUS_ENTITLEMENT]
}

export type PurchaseOutcome =
  | { status: 'purchased'; customerInfo: CustomerInfo }
  | { status: 'cancelled' }
  | { status: 'error'; message: string; code?: PURCHASES_ERROR_CODE }

/**
 * Purchase a package. User-cancellation is a normal flow, not an error — it
 * returns `{ status: 'cancelled' }` so callers don't show a scary alert.
 */
export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!configured) return { status: 'error', message: 'Billing is not available right now.' }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg)
    return { status: 'purchased', customerInfo }
  } catch (e: any) {
    if (e?.userCancelled) return { status: 'cancelled' }
    return { status: 'error', message: friendlyError(e), code: e?.code }
  }
}

/** Restore previous purchases (App Store / Play requires a visible entry point). */
export async function restore(): Promise<PurchaseOutcome> {
  if (!configured) return { status: 'error', message: 'Billing is not available right now.' }
  try {
    const customerInfo = await Purchases.restorePurchases()
    return { status: 'purchased', customerInfo }
  } catch (e: any) {
    return { status: 'error', message: friendlyError(e), code: e?.code }
  }
}

/** Map RevenueCat error codes to a short, user-facing sentence. */
export function friendlyError(e: any): string {
  switch (e?.code as PURCHASES_ERROR_CODE | undefined) {
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      return 'Purchases are not allowed on this device. Check Screen Time / restrictions.'
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return 'Your payment is pending approval. WRLD Plus will unlock once it clears.'
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
      return 'You already own this — try "Restore purchases".'
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
      return 'Network problem reaching the store. Check your connection and try again.'
    case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
      return 'The app store had a problem. Please try again in a moment.'
    default:
      return e?.message ?? 'Something went wrong with the purchase. Please try again.'
  }
}
