import { useState, useCallback, useRef } from 'react'
import { Device } from 'mediasoup-client'
import { ReactNative106 } from 'mediasoup-client/handlers/ReactNative106'
import type { Transport } from 'mediasoup-client/types'
import { mediaDevices, MediaStream, registerGlobals } from 'react-native-webrtc'
import { signalingClient } from '@/lib/mediasoupSignaling'
import type { SourceType } from '@/types'

registerGlobals()

export function useMediasoup() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [videoIsLandscape, setVideoIsLandscape] = useState(false)

  const sendTransport = useRef<Transport | null>(null)
  const recvTransport = useRef<Transport | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

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

  const startBroadcasting = useCallback(async (sources: SourceType[]) => {
    setError(null)
    setFacingMode('environment')
    try {
      const device = await buildDevice()

      const stream = (await mediaDevices.getUserMedia({
        video: sources.includes('camera')
          ? { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
        audio: sources.includes('audio'),
      })) as unknown as MediaStream
      localStreamRef.current = stream
      setLocalStream(stream)

      if (sources.includes('camera')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vt = (stream as any).getVideoTracks()[0]
        const s = vt?.getSettings?.() ?? {}
        setVideoIsLandscape(typeof s.width === 'number' && typeof s.height === 'number' && s.width > s.height)
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

      const tracks = (stream as unknown as { getTracks(): MediaStreamTrack[] }).getTracks()
      for (const track of tracks) {
        await transport.produce({ track: track as never })
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
      }
      setRemoteStream(ms as unknown as MediaStream)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start viewing')
    }
  }, [])

  const cleanup = useCallback(() => {
    sendTransport.current?.close()
    recvTransport.current?.close()
    sendTransport.current = null
    recvTransport.current = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setError(null)
    setFacingMode('environment')
    setVideoIsLandscape(false)
  }, [])

  return { localStream, remoteStream, error, facingMode, videoIsLandscape, startBroadcasting, startViewing, switchCamera, cleanup }
}
