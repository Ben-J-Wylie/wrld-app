import { useQuery } from '@tanstack/react-query'
import { configApi, type PublicConfig } from '@/api/config'

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
