// src/hooks/useAnalytics.ts
//
// TanStack query for the Pro-only analytics dashboard. Port of wrld-web's
// `src/hooks/useAnalytics.ts`. `enabled` is the client-side mirror of the
// server's tier === 'pro' gate — the caller passes (signed-in && isPro), so a
// non-Pro user never fires the request (which would 403 anyway).

import { useQuery } from '@tanstack/react-query'
import { analyticsApi, type AnalyticsRange } from '@/api/analytics'

export function useAnalytics(range: AnalyticsRange, enabled: boolean) {
  return useQuery({
    queryKey: ['analytics', range],
    queryFn: () => analyticsApi.get(range),
    enabled,
    staleTime: 60_000,
  })
}
