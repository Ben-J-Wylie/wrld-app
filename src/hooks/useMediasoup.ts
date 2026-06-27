import { useState, useCallback, useRef } from 'react'
import { Device } from 'mediasoup-client'
import { ReactNative106 } from 'mediasoup-client/handlers/ReactNative106'
import type { Transport } from 'mediasoup-client/types'
import { mediaDevices, MediaStream, RTCPeerConnection, registerGlobals } from 'react-native-webrtc'
import { signalingClient } from '@/lib/mediasoupSignaling'
import { maxCaptureHeight, maxVideoBitrate } from '@/lib/tierCaps'
import { useAuthStore } from '@/stores/authStore'
import type { SourceType } from '@/types'

registerGlobals()

// Camera capture constraints, capped at the user's tier (G4 = cap-produce). We
// pin BOTH `ideal` AND `max` (16:9 from the tier height) plus a fixed frameRate
// so capture is DETERMINISTIC across go-lives. Without `max`, WebRTC was free to
// pick a different resolution per session, which made the encoder emit a
// different H.264 SPS/level each time — and the rolling buffer then stitched
// codec-incompatible sessions into one VOD that wedged the clip-editor player
// ("resource unavailable", backend item 5). A stable capture ⟹ a stable SPS ⟹ a
// single codec-uniform buffer group.
function cameraConstraints() {
  const tier = useAuthStore.getState().wrldUser?.tier
  const height = maxCaptureHeight(tier)
  const width = Math.round((height * 16) / 9)
  return {
    facingMode: 'environment',
    width: { ideal: width, max: width },
    height: { ideal: height, max: height },
    frameRate: { ideal: 30, max: 30 },
  }
}

// Poll a consumer (viewer receive) or producer (broadcaster local mic) for the
// inbound/media-source `audioLevel` (0..1) — the only loudness signal RN-WebRTC
// exposes (no AnalyserNode). Returns the interval id for teardown.
function startAudioLevelPoll(
  stats: { getStats(): Promise<unknown> },
  setLevel: (n: number) => void,
): ReturnType<typeof setInterval> {
  // Confirmed on-device (RN-WebRTC 124, 2026-06-16): `audioLevel` IS populated — on the
  // broadcaster from media-source, on the viewer from inbound-rtp — and tracks the mic in
  // real time. We scan every stat entry for the first numeric audioLevel so both paths work.
  return setInterval(() => {
    stats
      .getStats()
      .then((report) => {
        let level: number | null = null
        ;(report as { forEach?: (cb: (r: Record<string, unknown>) => void) => void }).forEach?.((r) => {
          if (typeof r.audioLevel === 'number') level = r.audioLevel as number
        })
        if (level != null) setLevel(level)
      })
      .catch(() => {})
  }, 120)
}

export function useMediasoup() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [videoIsLandscape, setVideoIsLandscape] = useState(false)
  // Viewer-side received audio loudness, 0..1 (for the audio visualizer). RN-WebRTC
  // has no AnalyserNode, so this is polled from the audio consumer's inbound-rtp
  // `audioLevel` (the only real loudness signal). 0 when there's no audio.
  const [audioLevel, setAudioLevel] = useState(0)

  const sendTransport = useRef<Transport | null>(null)
  const recvTransport = useRef<Transport | null>(null)
  // Viewer device + consumed producer ids — used to consume tracks that appear
  // AFTER we joined (the 'newProducer' push), e.g. joining at go-live / PPV resume.
  const deviceRef = useRef<Device | null>(null)
  const consumedRef = useRef<Set<string>>(new Set())
  const localStreamRef = useRef<MediaStream | null>(null)
  // Retain the audio stats source (consumer for a viewer, producer for the
  // broadcaster's own mic) + its getStats poll; torn down in cleanup().
  const audioStatsRef = useRef<{ getStats(): Promise<unknown> } | null>(null)
  const audioLevelTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // PREVIEW audio meter: a local LOOPBACK (sender PC ↔ receiver PC, both on-device) carrying the
  // mic track, so the audio pipeline actually RUNS and `media-source.audioLevel` reports BEFORE
  // going live (a one-sided PC doesn't process audio → no level). The receiver is muted so the
  // broadcaster doesn't hear themselves. Torn down on go-live (the real producer poll takes over),
  // on a source change, and in cleanup().
  const meterPcsRef = useRef<RTCPeerConnection[]>([])

  // Tear down whatever is currently driving audioLevel (preview loopback PCs and/or the poll).
  const stopAudioMeter = useCallback(() => {
    if (audioLevelTimer.current) {
      clearInterval(audioLevelTimer.current)
      audioLevelTimer.current = null
    }
    audioStatsRef.current = null
    for (const pc of meterPcsRef.current) {
      try {
        pc.close() // closes the PC; the mic track lives on in localStream (reused on go-live)
      } catch {}
    }
    meterPcsRef.current = []
    setAudioLevel(0)
  }, [])

  // Start a preview meter for the mic in `stream`. A one-sided PC isn't enough on RN-WebRTC (the
  // audio isn't processed without a peer, so no `audioLevel`), so we wire a real LOCAL LOOPBACK:
  // pc1 sends the mic to pc2 over host candidates (no STUN/TURN, no server). Once connected the
  // sender's `media-source.audioLevel` reports — the same stat the live producer uses. pc2's
  // received audio is muted (volume 0) so there's no echo. Best-effort: failure → idle.
  const startPreviewMeter = useCallback(async (stream: MediaStream) => {
    stopAudioMeter()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioTrack = (stream as any).getAudioTracks?.()[0]
      if (!audioTrack) return
      const pc1 = new RTCPeerConnection({}) // sender (we poll this one's media-source.audioLevel)
      const pc2 = new RTCPeerConnection({}) // receiver (muted — only there to complete the pipeline)
      meterPcsRef.current = [pc1, pc2]
      // RN-WebRTC's RTCPeerConnection TS type omits addEventListener — cast for the event wiring.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e1 = pc1 as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e2 = pc2 as any
      e1.addEventListener('icecandidate', (e: { candidate?: unknown }) => {
        if (e.candidate) pc2.addIceCandidate(e.candidate as never).catch(() => {})
      })
      e2.addEventListener('icecandidate', (e: { candidate?: unknown }) => {
        if (e.candidate) pc1.addIceCandidate(e.candidate as never).catch(() => {})
      })
      // Mute the looped-back audio so the broadcaster doesn't hear their own mic (the level stat is
      // measured pre-playback, so muting doesn't affect it).
      e2.addEventListener('track', (e: { track?: { _setVolume?: (v: number) => void } }) => {
        try {
          e.track?._setVolume?.(0)
        } catch {}
      })
      pc1.addTrack(audioTrack, stream)
      const offer = await pc1.createOffer({})
      await pc1.setLocalDescription(offer)
      await pc2.setRemoteDescription(offer)
      const answer = await pc2.createAnswer()
      await pc2.setLocalDescription(answer)
      await pc1.setRemoteDescription(answer)
      audioStatsRef.current = pc1 as unknown as { getStats(): Promise<unknown> }
      audioLevelTimer.current = startAudioLevelPoll(audioStatsRef.current, setAudioLevel)
    } catch {
      stopAudioMeter() // metering unavailable → idle, no worse than before
    }
  }, [stopAudioMeter])

  async function buildDevice(): Promise<Device> {
    const device = new Device({ handlerFactory: ReactNative106.createFactory() })
    const rtpCapabilities = await signalingClient.getRtpCapabilities()
    await device.load({ routerRtpCapabilities: rtpCapabilities as never })
    return device
  }

  const switchingCamera = useRef(false)

  const switchCamera = useCallback(() => {
    if (switchingCamera.current) return
    const stream = localStreamRef.current
    if (!stream) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoTrack = (stream as any).getVideoTracks()[0]
    // Only a live, enabled camera track can flip. A track that's ended/disabled —
    // camera released on an Android background→resume, or an audio/data-only
    // broadcast — makes the native switch throw "camera is not running".
    if (!videoTrack || videoTrack.readyState !== 'live' || videoTrack.enabled === false) return
    switchingCamera.current = true
    const release = () => { switchingCamera.current = false }
    // NOTE: react-native-webrtc's `_switchCamera()` is void — it fires the async
    // `applyConstraints()` and DROPS the promise, so a rejection ("camera is not
    // running") surfaces as an uncaught-in-promise error. We replicate it but OWN
    // the promise so the rejection is handled here. Cloning `_settings` preserves
    // the pinned capture resolution (only facingMode flips); the producer track
    // continues uninterrupted (no new stream).
    try {
      const settings = { ...(videoTrack._settings ?? {}) }
      delete settings.deviceId
      const next: 'user' | 'environment' = settings.facingMode === 'user' ? 'environment' : 'user'
      settings.facingMode = next
      Promise.resolve(videoTrack.applyConstraints(settings))
        .then(() => setFacingMode(next))
        .catch(() => { /* camera released / not running — leave facingMode as-is */ })
        // Android takes ~800ms to complete the switch; block re-entry until it settles.
        .finally(() => setTimeout(release, 1_000))
    } catch {
      setTimeout(release, 1_000)
    }
  }, [])

  // Acquire local camera/audio for an on-screen PREVIEW without going live
  // (no transport, no produce). The stream-view center tab uses this so the
  // broadcaster sees their armed camera feed before pressing Go Live; a
  // subsequent startBroadcasting() reuses this same stream (no re-prompt,
  // no flicker). Re-acquires only if the armed AV set changed.
  const previewSourcesRef = useRef<string>('')
  const startPreview = useCallback(async (sources: SourceType[]) => {
    setError(null)
    const wantsCamera = sources.includes('camera')
    const wantsAudio = sources.includes('audio')
    const key = `${wantsCamera ? 'c' : ''}${wantsAudio ? 'a' : ''}`
    // No AV armed → nothing to preview.
    if (!wantsCamera && !wantsAudio) {
      stopAudioMeter()
      if (localStreamRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localStreamRef.current.getTracks().forEach((t: any) => t.stop())
        localStreamRef.current = null
        setLocalStream(null)
      }
      previewSourcesRef.current = ''
      return
    }
    // Already previewing the same AV set → keep the live stream as-is.
    if (localStreamRef.current && previewSourcesRef.current === key) return
    // Different set → stop the old preview tracks (+ meter) first.
    stopAudioMeter()
    if (localStreamRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      localStreamRef.current.getTracks().forEach((t: any) => t.stop())
      localStreamRef.current = null
    }
    setFacingMode('environment')
    try {
      const stream = (await mediaDevices.getUserMedia({
        video: wantsCamera ? cameraConstraints() : false,
        audio: wantsAudio,
      })) as unknown as MediaStream
      localStreamRef.current = stream
      previewSourcesRef.current = key
      setLocalStream(stream)
      if (wantsCamera) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vt = (stream as any).getVideoTracks()[0]
        const s = vt?.getSettings?.() ?? {}
        setVideoIsLandscape(typeof s.width === 'number' && typeof s.height === 'number' && s.width > s.height)
      }
      // Meter the mic in PREVIEW so the audio visualizer is live before go-live (always, not just live).
      if (wantsAudio) startPreviewMeter(stream)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access camera')
    }
  }, [stopAudioMeter, startPreviewMeter])

  const startBroadcasting = useCallback(async (sources: SourceType[]) => {
    setError(null)
    // Drop the preview meter PC (it holds the mic track) before producing — the live producer's
    // own getStats poll (below) becomes the audioLevel source. Closing the PC doesn't stop the track.
    stopAudioMeter()
    try {
      const device = await buildDevice()

      // Data-only broadcasts (location / telemetry / torch — no camera or
      // audio armed) skip getUserMedia entirely: calling it with both
      // video:false + audio:false throws. The room still exists and the
      // stream is live; it just produces no AV tracks. Carrying the
      // non-AV layers as real producers is a backend/media follow-up.
      const wantsCamera = sources.includes('camera')
      const wantsAudio = sources.includes('audio')
      // Reuse the preview stream if one is already acquired (center-tab
      // preview → Go Live) so we don't re-prompt or drop the feed; otherwise
      // acquire now (dashboard Go Live with no preview).
      let stream: MediaStream | null = localStreamRef.current
      if (!stream && (wantsCamera || wantsAudio)) {
        setFacingMode('environment')
        stream = (await mediaDevices.getUserMedia({
          video: wantsCamera ? cameraConstraints() : false,
          audio: wantsAudio,
        })) as unknown as MediaStream
        localStreamRef.current = stream
        setLocalStream(stream)

        if (wantsCamera) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vt = (stream as any).getVideoTracks()[0]
          const s = vt?.getSettings?.() ?? {}
          setVideoIsLandscape(typeof s.width === 'number' && typeof s.height === 'number' && s.width > s.height)
        }
      }

      const params = await signalingClient.createTransport('send')
      const transport = device.createSendTransport(params as never)
      sendTransport.current = transport

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        signalingClient.connectTransport(transport.id, dtlsParameters).then(callback).catch(errback)
      })

      transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        signalingClient
          .produce(kind as 'audio' | 'video', rtpParameters)
          .then((id) => callback({ id }))
          .catch(errback)
      })

      if (stream) {
        const tracks = (stream as unknown as { getTracks(): MediaStreamTrack[] }).getTracks()
        for (const track of tracks) {
          // Per-tier video ceiling (free 4M / plus 6M / pro 10M — see tierCaps).
          // WebRTC's congestion control otherwise self-limits to ~0.5 Mbps (it
          // starts low and only ramps if told it can); an explicit maxBitrate +
          // a higher start bitrate lets it climb to use available bandwidth for a
          // sharp picture. maxBitrate is a ceiling, not a floor — BWE only reaches
          // it if the uplink/path allow, and adapts down otherwise. This single
          // encoding is forwarded verbatim to every viewer, the admin preview, and
          // the on-disk buffer (no server transcode), so it sets quality
          // system-wide for the broadcaster's tier.
          const isVideo = (track as unknown as { kind: string }).kind === 'video'
          const tier = useAuthStore.getState().wrldUser?.tier
          // Pin the SENT video resolution so every go-live emits the SAME SPS.
          // WebRTC otherwise downscales resolution under CPU/bandwidth pressure
          // (degradationPreference defaults to 'balanced'), and the `-c:v copy`
          // buffer recorder mirrors exactly what it sends — so a drifting
          // resolution makes each recording a new codec group, which stalls and
          // stutters when the clip editor concatenates them at playback. With
          // `scaleResolutionDownBy: 1` + `maintain-resolution`, congestion drops
          // FRAMERATE instead of resolution, keeping the SPS stable across go-lives.
          const opts = isVideo
            ? {
                track: track as never,
                encodings: [{ maxBitrate: maxVideoBitrate(tier), scaleResolutionDownBy: 1 }],
                codecOptions: { videoGoogleStartBitrate: 1500 },
                onRtpSender: (sender: {
                  getParameters: () => { degradationPreference?: string }
                  setParameters: (p: unknown) => unknown
                }) => {
                  try {
                    const params = sender.getParameters()
                    params.degradationPreference = 'maintain-resolution'
                    Promise.resolve(sender.setParameters(params)).catch(() => {})
                  } catch {
                    // setParameters/degradationPreference not supported on this
                    // platform — scaleResolutionDownBy still pins the common path.
                  }
                },
              }
            : { track: track as never }
          const producer = await transport.produce(opts as never)

          // Broadcaster's own mic level → audio visualizer when monitoring the
          // audio source (media-source.audioLevel from the producer's getStats).
          if (!isVideo) {
            audioStatsRef.current = producer as unknown as { getStats(): Promise<unknown> }
            if (audioLevelTimer.current) clearInterval(audioLevelTimer.current)
            audioLevelTimer.current = startAudioLevelPoll(audioStatsRef.current, setAudioLevel)
          }

          // DEV: confirm the SENT resolution stays pinned. getUserMedia settings
          // are the capture size; the recorded size is whatever WebRTC actually
          // sends (outbound-rtp), which is what we're trying to keep constant.
          // Logs once on go-live, then only when the sent resolution CHANGES (so
          // it's silent if the pin holds), with WebRTC's reason for any limit.
          if (isVideo && __DEV__) {
            const settings = (track as unknown as { getSettings?: () => Record<string, number> }).getSettings?.()
            console.log(
              `[capture] video capture (getUserMedia): ${settings?.width}x${settings?.height}@${settings?.frameRate}fps`,
            )
            let lastKey = ''
            const p = producer as unknown as {
              closed: boolean
              getStats: () => Promise<{ forEach: (cb: (st: Record<string, unknown>) => void) => void }>
            }
            const poll = setInterval(() => {
              if (!p || p.closed) {
                clearInterval(poll)
                return
              }
              p.getStats()
                .then((report) => {
                  report.forEach((st: Record<string, unknown>) => {
                    if (st.type === 'outbound-rtp' && st.frameWidth) {
                      const key = `${st.frameWidth}x${st.frameHeight}`
                      if (key !== lastKey) {
                        lastKey = key
                        console.log(
                          `[capture] SENT video now ${key}@${Math.round((st.framesPerSecond as number) ?? 0)}fps` +
                            ` — recorded as-is (limit: ${st.qualityLimitationReason ?? 'none'})`,
                        )
                      }
                    }
                  })
                })
                .catch(() => clearInterval(poll))
            }, 5000)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start broadcast')
    }
  }, [stopAudioMeter])

  const startViewing = useCallback(async (producers: Array<{ id: string; kind: string }>) => {
    setError(null)
    try {
      const device = await buildDevice()
      deviceRef.current = device
      consumedRef.current = new Set()

      const params = await signalingClient.createTransport('recv')
      const transport = device.createRecvTransport(params as never)
      recvTransport.current = transport

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        signalingClient.connectTransport(transport.id, dtlsParameters).then(callback).catch(errback)
      })

      const ms = new MediaStream([])
      for (const producer of producers) {
        const consumeParams = await signalingClient.consume(producer.id, device.rtpCapabilities)
        const consumer = await transport.consume(consumeParams as never)
        ms.addTrack(consumer.track as never)
        consumedRef.current.add(producer.id)
        // Keep the audio consumer + start a getStats loudness poll for the audio
        // visualizer (RN-WebRTC has no AnalyserNode; inbound-rtp.audioLevel is it).
        if ((consumer as unknown as { kind: string }).kind === 'audio') {
          audioStatsRef.current = consumer as unknown as { getStats(): Promise<unknown> }
          if (audioLevelTimer.current) clearInterval(audioLevelTimer.current)
          audioLevelTimer.current = startAudioLevelPoll(audioStatsRef.current, setAudioLevel)
        }
      }
      setRemoteStream(ms as unknown as MediaStream)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start viewing')
    }
  }, [])

  // Consume a track that appeared AFTER we joined (server 'newProducer' push) —
  // e.g. we joined an empty room right at go-live or on a PPV resume. Reuses the
  // existing recv transport + device so the video shows up without a black screen.
  const consumeProducer = useCallback(async (producer: { id: string; kind: string }) => {
    const transport = recvTransport.current
    const device = deviceRef.current
    if (!transport || !device || consumedRef.current.has(producer.id)) return
    consumedRef.current.add(producer.id)
    try {
      const consumeParams = await signalingClient.consume(producer.id, device.rtpCapabilities)
      const consumer = await transport.consume(consumeParams as never)
      // New MediaStream (not addTrack on the old one) so RTCView re-binds via a
      // fresh .toURL() and renders the newly-arrived track.
      setRemoteStream((prev) => {
        const existing = prev as unknown as { getTracks(): unknown[] } | null
        const tracks = existing ? [...existing.getTracks(), consumer.track] : [consumer.track]
        return new MediaStream(tracks as never) as unknown as MediaStream
      })
      if ((consumer as unknown as { kind: string }).kind === 'audio') {
        audioStatsRef.current = consumer as unknown as { getStats(): Promise<unknown> }
        if (audioLevelTimer.current) clearInterval(audioLevelTimer.current)
        audioLevelTimer.current = startAudioLevelPoll(audioStatsRef.current, setAudioLevel)
      }
    } catch {
      consumedRef.current.delete(producer.id) // let a later push retry
    }
  }, [])

  // Set the playback volume of the consumed remote audio (viewer side).
  // react-native-webrtc exposes a per-track `_setVolume(gain)` where 1.0 is
  // unity; we drive it from a 0..1 UI value (0 = muted). No-op if there's no
  // remote audio track yet.
  const setRemoteAudioVolume = useCallback((volume: number) => {
    const track = (remoteStream as unknown as {
      getAudioTracks?: () => Array<{ _setVolume?: (v: number) => void }>
    } | null)?.getAudioTracks?.()[0]
    track?._setVolume?.(Math.max(0, Math.min(1, volume)))
  }, [remoteStream])

  const cleanup = useCallback(() => {
    stopAudioMeter() // clears the poll + closes the preview meter PC
    sendTransport.current?.close()
    recvTransport.current?.close()
    sendTransport.current = null
    recvTransport.current = null
    deviceRef.current = null
    consumedRef.current = new Set()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop())
    localStreamRef.current = null
    previewSourcesRef.current = ''
    setLocalStream(null)
    setRemoteStream(null)
    setError(null)
    setFacingMode('environment')
    setVideoIsLandscape(false)
  }, [stopAudioMeter])

  return { localStream, remoteStream, audioLevel, error, facingMode, videoIsLandscape, setRemoteAudioVolume, startPreview, startBroadcasting, startViewing, consumeProducer, switchCamera, cleanup }
}
