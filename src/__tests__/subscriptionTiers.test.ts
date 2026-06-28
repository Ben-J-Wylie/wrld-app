import { describe, it, expect } from 'vitest'
import { tierPriceUsd, formatUsd, CREATOR_SUB_TIERS } from '@/lib/subscriptionTiers'

describe('subscriptionTiers — creator price ladder + USD formatting', () => {
  it('tierPriceUsd maps a tier to its ladder price (cents)', () => {
    expect(tierPriceUsd(1)).toBe(500)
    expect(tierPriceUsd(2)).toBe(1000)
    expect(tierPriceUsd(4)).toBe(2500)
  })
  it('tierPriceUsd is null for missing/unknown tiers', () => {
    expect(tierPriceUsd(null)).toBeNull()
    expect(tierPriceUsd(undefined)).toBeNull()
    expect(tierPriceUsd(0)).toBeNull()
    expect(tierPriceUsd(99)).toBeNull()
  })
  it('ladder is the decided 4-tier set', () => {
    expect(CREATOR_SUB_TIERS.map((t) => t.priceUsd)).toEqual([500, 1000, 1500, 2500])
  })
  it('formatUsd renders cents as $X.XX', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(199)).toBe('$1.99')
    expect(formatUsd(500)).toBe('$5.00')
    expect(formatUsd(2500)).toBe('$25.00')
  })
})
