// The fixed creator-subscription price ladder (DECIDED — no arbitrary pricing).
// Mirrors wrld-backend SUBSCRIPTION_TIERS_FALLBACK / the SUBSCRIPTION_TIERS config
// and wrld-web's src/lib/subscriptionTiers.ts. The creator picks one tier; the
// actual charge is resolved server-side from the same ladder (the shared per-tier
// Stripe Price), so this is just the UI source for the picker labels — the server
// is the price authority. Keep in sync with the backend ladder if the prices change.

export type CreatorSubTier = { tier: number; priceUsd: number }

export const CREATOR_SUB_TIERS: CreatorSubTier[] = [
  { tier: 1, priceUsd: 499 },
  { tier: 2, priceUsd: 999 },
  { tier: 3, priceUsd: 1499 },
  { tier: 4, priceUsd: 2499 },
]

export function tierPriceUsd(tier: number | null | undefined): number | null {
  if (!tier) return null
  return CREATOR_SUB_TIERS.find((t) => t.tier === tier)?.priceUsd ?? null
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
