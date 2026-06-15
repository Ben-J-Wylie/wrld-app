import { useEffect, useState } from 'react'
import { serverNow } from '@/lib/serverClock'

// Formats the current time in the given IANA timezone as a 12-hour clock,
// e.g. "9:13pm". Returns null when no timezone is known (or it's invalid),
// so callers can hide the clock entirely. Reads the universal wall clock
// (CONTENT.md §6) so even the time-of-day readout matches the server clock.
function format(timezone: string): string | null {
  try {
    return new Date(serverNow())
      .toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .replace(/\s/g, '')
      .toLowerCase()
  } catch {
    return null
  }
}

// Live broadcaster-local clock. Re-renders every 30s so the displayed minute
// stays accurate without a per-second tick.
export function useBroadcasterClock(timezone: string | null | undefined): string | null {
  const [time, setTime] = useState<string | null>(() => (timezone ? format(timezone) : null))

  useEffect(() => {
    if (!timezone) {
      setTime(null)
      return
    }
    setTime(format(timezone))
    const id = setInterval(() => setTime(format(timezone)), 30_000)
    return () => clearInterval(id)
  }, [timezone])

  return time
}
