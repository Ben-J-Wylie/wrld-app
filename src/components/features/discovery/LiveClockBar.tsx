// src/components/features/discovery/LiveClockBar.tsx
//
// The WRLD clock as persistent chrome — a passive, live-readout variant of
// TimeScrubber pinned just above the footer on screens with no time-travel
// surface (Dashboard, Stream). It shows the live ticking time (NOW) and can't
// be scrubbed; the globe + clip editor render TimeScrubber directly in its
// interactive mode. This keeps "the clock above the footer" a predictable
// pattern across the app. See CLAUDE.md (clock pattern) + DESIGN.md.

import { TimeScrubber, CLOCK_COLLAPSED_H } from './TimeScrubber'

// Collapsed band height — the live-readout clock never expands, so this is its
// fixed height. Hosts use it to offset a docked Go Live / End Stream button up
// over the clock.
export const LIVE_CLOCK_BAR_H = CLOCK_COLLAPSED_H

const noop = () => {}

export function LiveClockBar() {
  // offset 0 → reads NOW and live-ticks; interactive=false → no tap/scrub.
  return <TimeScrubber offsetMs={0} onOffsetChange={noop} interactive={false} />
}
