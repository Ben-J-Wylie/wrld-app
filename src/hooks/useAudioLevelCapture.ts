import { useEffect, useRef } from 'react'
import type { TelemetryPayload } from '@/lib/mediasoupSignaling'

// SP6a item 4 — the broadcaster emits its live audio loudness as `audiolevel`
// telemetry (~10 Hz) while live with audio armed. mediasoup records it into the
// audio-amplitude `.jsonl` companion of the audio HLS track, so a saved clip's
// audio waveform can replay/scrub at the playhead instead of a static placeholder
// (the app feeds the recorded track into AudioVisualizer's playback `history` mode).
//
// Sibling of useTelemetryCapture, but the sample source is the WebRTC audio level —
// a getStats-derived value owned by StreamScreen, not a phone sensor. The latest
// level is held in a ref and sampled on a fixed interval so the emit cadence is
// steady and independent of React render timing.
const SAMPLE_MS = 100 // ~10 Hz, matching the telemetry-track cadence

export function useAudioLevelCapture(
  audioLevel: number,
  send: (p: TelemetryPayload) => void,
  enabled: boolean,
) {
  const levelRef = useRef(audioLevel)
  levelRef.current = audioLevel

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      send({ kind: 'audiolevel', ts: Date.now(), level: levelRef.current })
    }, SAMPLE_MS)
    return () => clearInterval(id)
  }, [enabled, send])
}
