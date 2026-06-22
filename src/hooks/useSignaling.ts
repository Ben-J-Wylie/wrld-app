import { useState, useEffect, useCallback, useRef } from 'react'
import { signalingClient, type TelemetryPayload } from '@/lib/mediasoupSignaling'
import { getClerkToken } from '@/lib/clerkToken'
import { getDeviceId } from '@/lib/deviceId'
import { env } from '@/lib/env'

export type SignalingStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'in-room'
  | 'error'
  | 'dropped'

type Producer = { id: string; kind: string }

export type ChatMessage = { from: string; text: string; ts: number }
export type Reaction = { from: string; kind: string; ts: number; id: number }
export type TipEvent = { handle: string; amount: number; id: number }
export type GiftEvent = { handle: string; giftType: string; emoji: string; amount: number; id: number }

export function useSignaling() {
  const [status, setStatus] = useState<SignalingStatus>('idle')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [producers, setProducers] = useState<Producer[]>([])
  const [viewerCount, setViewerCount] = useState(0)
  const [streamEnded, setStreamEnded] = useState(false)
  const [adminEnded, setAdminEnded] = useState(false)
  const [kicked, setKicked] = useState(false)
  const [adminWarning, setAdminWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [broadcasterPaused, setBroadcasterPaused] = useState(false)
  const [tipEvents, setTipEvents] = useState<TipEvent[]>([])
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([])
  const [confirmedBalance, setConfirmedBalance] = useState<number | null>(null)
  const [suspensionError, setSuspensionError] = useState<string | null>(null)
  // Set when the server rejects a live tip (insufficient balance, below the
  // minimum, …). The tip sheet has already closed on send, so StreamScreen
  // surfaces this so the failure isn't silent.
  const [tipError, setTipError] = useState<string | null>(null)
  // Same, for a rejected gift (the gift rail fires-and-forgets).
  const [giftError, setGiftError] = useState<string | null>(null)
  // Server-sent error during go-live (e.g. backend rejected streamStarted: PPV
  // event in progress, banned title). Arrives as a {type:'error'} message just
  // before the 4001 close; StreamScreen surfaces it so the broadcaster sees the
  // reason instead of a blank screen.
  const [goLiveError, setGoLiveError] = useState<string | null>(null)
  const reactionCounterRef = useRef(0)
  const tipCounterRef = useRef(0)
  const giftCounterRef = useRef(0)
  // Distinguishes intentional disconnect() calls from unexpected network drops.
  const intentionalRef = useRef(false)

  useEffect(() => {
    const unsub = signalingClient.onMessage((msg) => {
      if (msg.type === 'viewerCountUpdated') setViewerCount(msg.viewerCount)
      if (msg.type === 'broadcasterLeft') setStreamEnded(true)
      if (msg.type === 'adminEnded') setAdminEnded(true)
      if (msg.type === 'adminWarning') setAdminWarning(msg.message)
      if (msg.type === 'broadcasterPaused') setBroadcasterPaused(true)
      if (msg.type === 'broadcasterResumed') setBroadcasterPaused(false)
      if (msg.type === 'chatMessage') {
        setChatMessages((prev) => [...prev, { from: msg.from, text: msg.text, ts: msg.ts }])
      }
      if (msg.type === 'reaction') {
        const id = ++reactionCounterRef.current
        setReactions((prev) => [...prev, { from: msg.from, kind: msg.kind, ts: msg.ts, id }])
      }
      if (msg.type === 'tipReceived') {
        const id = ++tipCounterRef.current
        setTipEvents((prev) => [...prev, { handle: msg.handle, amount: msg.amount, id }])
      }
      if (msg.type === 'tipConfirmed') {
        setConfirmedBalance(msg.newBalance)
      }
      if (msg.type === 'tipFailed') {
        setTipError(msg.message)
      }
      if (msg.type === 'giftReceived') {
        const id = ++giftCounterRef.current
        setGiftEvents((prev) => [...prev, { handle: msg.handle, giftType: msg.giftType, emoji: msg.emoji, amount: msg.amount, id }])
      }
      if (msg.type === 'giftConfirmed') {
        setConfirmedBalance(msg.newBalance)
      }
      if (msg.type === 'giftFailed') {
        setGiftError(msg.message)
      }
      if (msg.type === 'error' && msg.message) {
        if (msg.message.toLowerCase().includes('suspended')) setSuspensionError(msg.message)
        else setGoLiveError(msg.message)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    return signalingClient.onClose((code) => {
      if (intentionalRef.current) {
        setStatus('idle')
      } else if (code === 4001) {
        // Server explicitly closed our socket because the broadcaster left.
        // Treat identically to receiving a broadcasterLeft WS message.
        setStreamEnded(true)
      } else if (code === 4003) {
        setKicked(true)
      } else {
        setStatus('dropped')
      }
      intentionalRef.current = false
      setRoomId(null)
      setProducers([])
      setViewerCount(0)
    })
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    setStreamEnded(false)
    setKicked(false)
    setAdminEnded(false)
    setGoLiveError(null)
    setTipError(null)
    setGiftError(null)
    try {
      await signalingClient.connect(env.mediasoupWssUrl)
      setStatus('connected')
      const deviceId = await getDeviceId()
      signalingClient.identify(deviceId)
      const token = await getClerkToken()
      if (token) {
        await signalingClient.authenticate(token)
        setStatus('authenticated')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
      throw err
    }
  }, [])

  const createRoom = useCallback(async (meta: { title: string; lat: number; lng: number; sources: string[]; subscribersOnly: boolean; locationPrecision?: 'exact' | 'city' | 'country' | 'off'; ppvEventId?: string; visibility?: 'public' | 'private' }) => {
    try {
      const id = await signalingClient.createRoom(meta)
      setRoomId(id)
      setStatus('in-room')
      return id
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to create room')
      throw err
    }
  }, [])

  const joinRoom = useCallback(async (id: string) => {
    try {
      const { producers: prods } = await signalingClient.joinRoom(id)
      setRoomId(id)
      setProducers(prods)
      setStatus('in-room')
      return prods
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to join stream')
      throw err
    }
  }, [])

  const disconnect = useCallback(() => {
    intentionalRef.current = true
    signalingClient.disconnect()
    setStatus('idle')
    setRoomId(null)
    setProducers([])
    setError(null)
    setChatMessages([])
    setReactions([])
    setBroadcasterPaused(false)
    setTipEvents([])
    setGiftEvents([])
    setConfirmedBalance(null)
  }, [])

  const sendChatMessage = useCallback((text: string, handle: string) => {
    signalingClient.sendChatMessage(text, handle)
    setChatMessages((prev) => [...prev, { from: handle, text, ts: Date.now() }])
  }, [])

  const sendReaction = useCallback((kind: string, handle: string) => {
    signalingClient.sendReaction(kind, handle)
    const id = ++reactionCounterRef.current
    setReactions((prev) => [...prev, { from: handle, kind, ts: Date.now(), id }])
  }, [])

  const sendBroadcasterPaused = useCallback(() => signalingClient.sendBroadcasterPaused(), [])
  const sendBroadcasterResumed = useCallback(() => signalingClient.sendBroadcasterResumed(), [])
  const sendBroadcasterOrientation = useCallback((orientation: 'portrait' | 'landscape', rotationDeg?: number, hold?: string) => signalingClient.sendBroadcasterOrientation(orientation, rotationDeg, hold), [])
  const sendCameraFacing = useCallback((facing: 'user' | 'environment') => signalingClient.sendCameraFacing(facing), [])
  const sendLocationUpdate = useCallback((lat: number, lng: number) => signalingClient.sendLocationUpdate(lat, lng), [])
  const sendTelemetry = useCallback((payload: TelemetryPayload) => signalingClient.sendTelemetry(payload), [])
  const sendTip = useCallback(
    (amount: number, opts?: { message?: string; idempotencyKey?: string }) => signalingClient.sendTip(amount, opts),
    [],
  )
  const sendGift = useCallback((giftType: string) => signalingClient.sendGift(giftType), [])

  const dismissReaction = useCallback((id: number) => {
    setReactions((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const dismissTip = useCallback((id: number) => {
    setTipEvents((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissGift = useCallback((id: number) => {
    setGiftEvents((prev) => prev.filter((g) => g.id !== id))
  }, [])

  return {
    status, setStatus,
    roomId,
    producers,
    viewerCount,
    streamEnded,
    adminEnded, setAdminEnded,
    kicked,
    adminWarning, setAdminWarning,
    error, setError,
    chatMessages,
    reactions,
    broadcasterPaused,
    tipEvents,
    giftEvents,
    confirmedBalance,
    sendBroadcasterPaused,
    sendBroadcasterResumed,
    sendBroadcasterOrientation,
    sendCameraFacing,
    sendTip,
    sendGift,
    sendLocationUpdate,
    sendTelemetry,
    connect,
    createRoom,
    joinRoom,
    disconnect,
    sendChatMessage,
    sendReaction,
    dismissReaction,
    dismissTip,
    dismissGift,
    suspensionError,
    clearSuspensionError: () => setSuspensionError(null),
    goLiveError,
    clearGoLiveError: () => setGoLiveError(null),
    tipError,
    clearTipError: () => setTipError(null),
    giftError,
    clearGiftError: () => setGiftError(null),
  }
}
