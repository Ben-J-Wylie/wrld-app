// src/lib/privacyRanges.ts
//
// PB4(a) — the per-segment privacy data model (public-buffer initiative). Pure interval
// arithmetic over a session's PRIVATE wall-clock ranges (public = default = the absence of
// a private range). This replaces the scab-in's free-form, exact-range-matched list — which
// couldn't represent "mark one half of an already-private clip public" (it had no way to
// SUBTRACT) and accumulated overlapping ranges across snips.
//
// The authoritative private set per session = the coalesced union of every range the user
// marked private. Marking a segment private ADDs its range; marking it public SUBTRACTs it
// (splitting/trimming any covering range). Snip/mend are display-only — they never touch
// these ranges; they just change which range you're selecting. So all the snip cases fall
// out of set arithmetic, no special-casing.
//
// Pure + dependency-free → unit-testable (H3).

export type PrivRange = { sessionId: string; startMs: number; endMs: number }

// Merge overlapping / touching ranges within each session. Output sorted by start.
export function coalesce(ranges: PrivRange[]): PrivRange[] {
  const bySession = new Map<string, PrivRange[]>()
  for (const r of ranges) {
    if (r.endMs <= r.startMs) continue
    const arr = bySession.get(r.sessionId) ?? []
    arr.push(r)
    bySession.set(r.sessionId, arr)
  }
  const out: PrivRange[] = []
  for (const [sessionId, arr] of bySession) {
    arr.sort((a, b) => a.startMs - b.startMs)
    let cur = { ...arr[0]! }
    for (let i = 1; i < arr.length; i++) {
      const r = arr[i]!
      if (r.startMs <= cur.endMs) {
        cur.endMs = Math.max(cur.endMs, r.endMs) // overlap / touch → merge
      } else {
        out.push(cur)
        cur = { ...r }
      }
    }
    out.push(cur)
  }
  return out
}

// Add [r] to the set, then coalesce.
export function addRange(set: PrivRange[], r: PrivRange): PrivRange[] {
  if (r.endMs <= r.startMs) return coalesce(set)
  return coalesce([...set, r])
}

// Subtract [r] from the set: any same-session range overlapping [r] is trimmed/split so the
// span [r.startMs, r.endMs] becomes public. Other-session ranges pass through untouched.
export function subtractRange(set: PrivRange[], r: PrivRange): PrivRange[] {
  const out: PrivRange[] = []
  for (const seg of set) {
    if (seg.sessionId !== r.sessionId || seg.endMs <= r.startMs || seg.startMs >= r.endMs) {
      out.push(seg) // no overlap
      continue
    }
    if (seg.startMs < r.startMs) out.push({ sessionId: seg.sessionId, startMs: seg.startMs, endMs: r.startMs }) // left remainder
    if (seg.endMs > r.endMs) out.push({ sessionId: seg.sessionId, startMs: r.endMs, endMs: seg.endMs }) // right remainder
    // the [r.startMs, r.endMs] slice is dropped (now public)
  }
  return coalesce(out)
}

// Is [r] effectively private — i.e., (nearly) fully covered by same-session private ranges?
// `tol` absorbs minor boundary drift between a segment's range and the stored directive ms.
export function isCovered(set: PrivRange[], r: PrivRange, tol = 1000): boolean {
  if (r.endMs <= r.startMs) return false
  return coalesce(set).some(
    (seg) =>
      seg.sessionId === r.sessionId && r.startMs >= seg.startMs - tol && r.endMs <= seg.endMs + tol,
  )
}
