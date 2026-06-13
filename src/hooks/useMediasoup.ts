import { useState, useCallback, useRef } from 'react'
import { Device } from 'mediasoup-client'
import { ReactNative106 } from 'mediasoup-client/handlers/ReactNative106'
import type { Transport } from 'mediasoup-client/types'
import { mediaDevices, MediaStream, registerGlobals } from 'react-native-webrtc'
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
  const localStreamRef = useRef<MediaStream | null>(null)
  // Retain the audio stats source (consumer for a viewer, producer for the
  // broadcaster's own mic) + its getStats poll; torn down in cleanup().
  const audioStatsRef = useRef<{ getStats(): Promise<unknown> } | null>(null)
  const audioLevelTimer = useRef<ReturnType<typeof setInterval> | null>(null)

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
    if (!videoTrack) return
    switchingCamera.current = true
    // react-native-webrtc exposes _switchCamera() to flip between front/back
    // without creating a new stream — the existing producer track continues uninterrupted
    videoTrack._switchCamera()
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
    // Android takes ~800ms to complete the switch; block re-entry until it's done
    setTimeout(() => { switchingCamera.current = false }, 1_000)
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
    // Different set → stop the old preview tracks first.
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access camera')
    }
  }, [])

  const startBroadcasting = useCallback(async (sources: SourceType[]) => {
    setError(null)
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
  }, [])

  const startViewing = useCallback(async (producers: Array<{ id: string; kind: string }>) => {
    setError(null)
    try {
      const device = await buildDevice()

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
    if (audioLevelTimer.current) {
      clearInterval(audioLevelTimer.current)
      audioLevelTimer.current = null
    }
    audioStatsRef.current = null
    setAudioLevel(0)
    sendTransport.current?.close()
    recvTransport.current?.close()
    sendTransport.current = null
    recvTransport.current = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop())
    localStreamRef.current = null
    previewSourcesRef.current = ''
    setLocalStream(null)
    setRemoteStream(null)
    setError(null)
    setFacingMode('environment')
    setVideoIsLandscape(false)
  }, [])

  return { localStream, remoteStream, audioLevel, error, facingMode, videoIsLandscape, setRemoteAudioVolume, startPreview, startBroadcasting, startViewing, switchCamera, cleanup }
}
