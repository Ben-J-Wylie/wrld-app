# Handoff — Aaron: a server-"now" reference for the Clips timeline (2026-06-13)

> **✅ RESOLVED 2026-06-13.** Aaron shipped `serverNowMs` on `GET /buffer/me`
> (`serverNowMs = Date.now()`, epoch ms). The app wired the slew (`nowUI = Date.now() +
> eased(serverNowMs − Date.now())`) in `ClipsScreen`. Both confirmations answered: (1) `latestAt`
> is **not** server-now (it's last `endedAt ?? now`) → `serverNowMs` is the right call; (2) live
> `mediaDurationSec` is **not** monotonic alone, but the end edge `startedAt + mediaStartOffsetMs +
> mediaDurationSec` **is** — and the app already derives the live end from that quantity. Kept below
> for the record.

**TL;DR:** Add a **`serverNowMs`** field to the `GET /buffer/me` response. That's the only ask.
Nothing is blocking — the app already runs a smooth device-clock version; this is the robustness
upgrade that removes device↔server clock skew from the reaper/now edges.

---

## Background — why

The Clips timeline (`ClipsScreen` + `ClipsTimeline`) was rebuilt around a single principle (CONTENT.md
§6): **one continuous monotonic clock is "now," and every position is `timeToX(instant)` off it.** One
clock now drives both the reaper edge, the now edge, and the live (still-recording) clip's realtime
build. That fixed the bouncing/stalling.

The remaining seam is a **clock-domain mismatch**:

- **Clip geometry is server-clock anchored** — a clip's start/length come entirely from the server
  (`startedAt` + `mediaStartOffsetMs` + `mediaDurationSec`), never from front-end `now − start` math.
- **The app's "now" clock is device-clock** (`Date.now()`).

If a device's clock is skewed vs the server, the reaper boundary (`now − window`) and the now edge sit
in the **wrong place relative to the footage**. No amount of front-end smoothing fixes that — it's a
domain mismatch, not a jitter.

The fix is to run the app's "now" clock in the **server domain**:

```
nowUI = deviceFrameClock + (serverNowMs − Date.now())   // measured per fetch, slewed (eased), not snapped
```

That keeps it smooth (device frame-clock rate) and drift-free **and** aligned with the footage
(server offset). For that I need a server "now."

---

## The ask (1 thing)

Add the server's wall-clock at response-build time to the `GET /buffer/me` (`BufferDescriptor`) payload:

```jsonc
// BufferDescriptor
"serverNowMs": 1718900000000   // epoch ms (or ISO "serverNow") when the response was built
```

No other endpoint changes. The app computes `offset = serverNowMs − Date.now()` on each fetch and
slews its UI clock by it.

> Alternative if you'd rather not add a field: the HTTP `Date` response header would work, but an
> explicit field is more robust (proxies can rewrite the header; RN/axios doesn't always surface it
> cleanly). Your call.

## Two confirmations (no work if already true)

1. **What is `latestAt`?** Is it "server now," or the newest *footage/media* time (which lags real
   time by the HLS flush latency)? If it's effectively server-now, I'll use it and we skip the new
   field. If it lags, I need `serverNowMs`.

2. **`mediaDurationSec` on the open (live) session is monotonic** — it only grows across refetches,
   never shrinks. The app's smooth live-build assumes this; a shrink would show as a visible retreat
   of the live clip's end.

---

## What the app already does (no action needed)

- One smooth, **monotonic** UI clock drives the reaper edge + now edge (a backward drift-snap was the
  per-tick bounce; the clock is now clamped forward-only).
- The **open session's segment builds to the UI clock per-frame** (smooth realtime growth) instead of
  stepping on the 15s refetch — keyed off `endedAt == null`.
- The view is **time-anchored** (`scroll = timeToX(P)`), so reaper drops / refetches never slide
  footage under the centre playhead.

When `serverNowMs` lands, I wire the slew and the device/server skew is gone. Ping me.
