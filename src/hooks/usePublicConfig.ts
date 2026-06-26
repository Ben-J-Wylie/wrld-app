import { useQuery } from '@tanstack/react-query'
import { configApi, type PublicConfig } from '@/api/config'
import type { CreatorSubTier } from '@/lib/subscriptionTiers'

// Fallbacks so the UI renders correct values before the fetch resolves or when
// offline. Mirrors the backend allowlist (cents). Keep in sync as keys are added.
const FALLBACK: PublicConfig = {
  TIER_PRICE_USD_PLUS: 1000,
  TIER_PRICE_USD_PRO: 3000,
  TIER_PRICE_USD_PLUS_ANNUAL: 9600,
  TIER_PRICE_USD_PRO_ANNUAL: 28800,
}

// App-wide reader for backend client config. Long staleTime — these values
// change rarely (admin edits) and the app doesn't need them fresh-to-the-second.
export function usePublicConfig() {
  const query = useQuery({
    queryKey: ['public-config'],
    queryFn: configApi.getPublic,
    staleTime: 10 * 60_000,
  })
  const config: PublicConfig = { ...FALLBACK, ...(query.data ?? {}) }
  return { config, isLoading: query.isLoading }
}

// Helper: read a numeric config value with a fallback.
export function configNumber(config: PublicConfig, key: string, fallback: number): number {
  const v = config[key]
  return typeof v === 'number' ? v : fallback
}

// Helper: read a boolean flag (accepts bool, number 1/0, or "true"/"1") with a fallback.
export function configBool(config: PublicConfig, key: string, fallback: boolean): boolean {
  const v = config[key]
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v === 'true' || v === '1'
  return fallback
}

// The Space Bucks top-up catalog, mirrored from the backend TOPUP_BUNDLES config
// (the single source of truth the backend validates + credits against). The IAP
// rail matches a store package by iosProductId/androidProductId.
export type TopUpBundleConfig = {
  amount: number
  priceCents: number
  iosProductId?: string | null
  androidProductId?: string | null
}

// Helper: read the TOPUP_BUNDLES catalog, falling back to a local default if the
// key is absent or malformed (so the picker always renders something sane).
export function configBundles(config: PublicConfig, fallback: TopUpBundleConfig[]): TopUpBundleConfig[] {
  const v = config['TOPUP_BUNDLES']
  if (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((b) => b && typeof b.amount === 'number' && typeof b.priceCents === 'number')
  ) {
    return v as TopUpBundleConfig[]
  }
  return fallback
}

// Helper: read the SUBSCRIPTION_TIERS creator-sub ladder from config, falling back
// to the local hardcoded ladder if the key is absent or malformed. The server is
// the charge authority (it resolves the tier → its Stripe Price); this only drives
// the picker labels, so a price change is config-only — no EAS ship.
export function configTiers(config: PublicConfig, fallback: CreatorSubTier[]): CreatorSubTier[] {
  const v = config['SUBSCRIPTION_TIERS']
  if (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((t) => t && typeof t.tier === 'number' && typeof t.priceUsd === 'number')
  ) {
    return v as CreatorSubTier[]
  }
  return fallback
}
