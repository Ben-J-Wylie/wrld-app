// Display helpers for a stream's broadcast location.
//
// The server gates these fields by the broadcaster's location precision:
// country is sent for every located stream (drives the flag), but city + IANA
// timezone are withheld at 'country'/'off' precision. So the client just renders
// whatever it's given — no precision check needed here.

// One DisplayNames instance, reused. Wrapped in try/catch because not every
// Hermes/JS runtime ships Intl.DisplayNames; we fall back to the raw code.
let regionNames: Intl.DisplayNames | null = null
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
} catch {
  regionNames = null
}

/** Country name from an ISO 3166-1 alpha-2 code ('GB' → 'United Kingdom'). */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null
  try {
    return regionNames?.of(code.toUpperCase()) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

/**
 * "City, Country" / "Country" / null. `city` is already precision-gated by the
 * server (null at country precision), so this needs no precision awareness.
 */
export function placeLabel(
  city: string | null | undefined,
  countryCode: string | null | undefined,
): string | null {
  const country = countryName(countryCode)
  if (city && country) return `${city}, ${country}`
  return city || country || null
}
