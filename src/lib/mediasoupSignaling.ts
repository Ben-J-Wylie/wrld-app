import { Platform } from 'react-native'

// Sensor telemetry payload — one discriminated union carries every kind over the
// signaling WS (Option A). `ts` is broadcaster wall-clock ms (viewer drops stale
// samples; the recorder timestamps the .jsonl track). Flat + tiny. `motion` is
// derived viewer-side from `accel`; `temp` has no phone sensor (UI-present only).
export type TelemetryPayload =
  | { kind: 'compass'; ts: number; heading: number; accuracy?: number }
  | { kind: 'gyro'; ts: number; pitch: number; roll: number; yaw?: number }
  | { kind: 'accel'; ts: number; x: number; y: number; z: number }
  | { kind: 'speed'; ts: number; mps: number; accuracy?: number }
  | { kind: 'torch'; ts: number; on: boolean; level?: number }
  // SP5: location is relayed to viewers via the telemetry decode path, but it is
  // NOT emitted as a `telemetry` message — the broadcaster's existing
  // `locationUpdate` is fanned out by mediasoup as `telemetryUpdate{kind:location}`
  // (avoids double-recording; locationUpdate already records the track). So this
  // shape appears on telemetryUpdate (viewer) but the app never sends it.
  | { kind: 'location'; ts: number; lat: number; lng: number; accuracy?: number }

export type ClientMessage =
  | { type: 'identify'; deviceId: string }
  | { type: 'authenticate'; token: string }
  | { type: 'getRtpCapabilities' }
  | { type: 'createRoom'; title: string; lat: number; lng: number; sources: string[]; subscribersOnly: boolean; locationPrecision?: 'exact' | 'city' | 'country' | 'off'; ppvEventId?: string }
  | { type: 'joinRoom'; roomId: string }
  | { type: 'createTransport'; direction: 'send' | 'recv' }
  | { type: 'connectTransport'; transportId: string; dtlsParameters: unknown }
  | { type: 'produce'; kind: 'audio' | 'video'; rtpParameters: unknown }
  | { type: 'consume'; producerId: string; rtpCapabilities: unknown }
  | { type: 'chatMessage'; text: string; handle: string }
  | { type: 'reaction'; kind: string; handle: string }
  | { type: 'broadcasterPaused' }
  | { type: 'broadcasterResumed' }
  | { type: 'broadcasterOrientation'; orientation: 'portrait' | 'landscape'; rotationDeg?: number; hold?: string; platform?: 'ios' | 'android' }
  | { type: 'cameraFacing'; facing: 'user' | 'environment' }
  | { type: 'locationUpdate'; lat: number; lng: number }
  | { type: 'telemetry'; payload: TelemetryPayload }
  | { type: 'tip'; amount: number }
  | { type: 'gift'; giftType: string }

export type ServerMessage =
  | { type: 'authenticated'; clerkUserId: string }
  | { type: 'rtpCapabilities'; rtpCapabilities: unknown }
  | { type: 'roomCreated'; roomId: string }
  | { type: 'roomJoined'; producers: Array<{ id: string; kind: string }>; orientation: 'portrait' | 'landscape' | null }
  | { type: 'broadcasterOrientation'; orientation: 'portrait' | 'landscape' }
  | {
      type: 'transportCreated'
      id: string
      iceParameters: unknown
      iceCandidates: unknown[]
      dtlsParameters: unknown
    }
  | { type: 'transportConnected' }
  | { type: 'produced'; id: string; roomId: string }
  | { type: 'consumed'; id: string; producerId: string; kind: string; rtpParameters: unknown }
  | { type: 'broadcasterLeft' }
  | { type: 'broadcasterPaused' }
  | { type: 'broadcasterResumed' }
  | { type: 'viewerCountUpdated'; viewerCount: number }
  | { type: 'chatMessage'; from: string; text: string; ts: number }
  | { type: 'telemetryUpdate'; payload: TelemetryPayload }
  | { type: 'reaction'; from: string; kind: string; ts: number }
  | { type: 'tipReceived'; handle: string; amount: number }
  | { type: 'tipConfirmed'; newBalance: number }
  | { type: 'giftReceived'; handle: string; giftType: string; emoji: string; amount: number }
  | { type: 'giftConfirmed'; newBalance: number }
  | { type: 'adminEnded' }
  | { type: 'adminWarning'; message: string }
  | { type: 'error'; message: string }

class MediasoupSignalingClient {
  private ws: WebSocket | null = null
  private msgCbs = new Set<(msg: ServerMessage) => void>()
  private closeCbs = new Set<(code: number) => void>()

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.onclose = null
        this.ws.close()
      }

      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('WebSocket connection failed'))
      ws.onclose = (event) => this.closeCbs.forEach((cb) => cb((event as CloseEvent).code ?? 1006))
      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data as string)
          this.msgCbs.forEach((cb) => cb(msg))
        } catch {
          // ignore malformed messages
        }
      }
    })
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  send(msg: ClientMessage) {
    if (!this.isConnected) throw new Error('Not connected')
    this.ws!.send(JSON.stringify(msg))
  }

  // Best-effort push for signals fired automatically from React effects / AppState
  // / timers (orientation, cameraFacing, pause/resume, location). These must NEVER
  // throw on a momentary disconnect (reconnect, hot-reload, go-live race) — an
  // uncaught throw inside an effect red-screens the app. Control-flow senders
  // (createRoom/join/produce/consume/transport) keep using send() so their awaited
  // callers still see failures.
  private trySend(msg: ClientMessage): void {
    if (!this.isConnected) return
    this.ws!.send(JSON.stringify(msg))
  }

  onMessage(cb: (msg: ServerMessage) => void): () => void {
    this.msgCbs.add(cb)
    return () => this.msgCbs.delete(cb)
  }

  onClose(cb: (code: number) => void): () => void {
    this.closeCbs.add(cb)
    return () => this.closeCbs.delete(cb)
  }

  private waitFor<T extends ServerMessage['type']>(
    type: T,
    timeout = 10_000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve, reject) => {
      const cleanups: Array<() => void> = []
      const cleanup = () => cleanups.forEach((fn) => fn())

      cleanups.push(
        (() => {
          const timer = setTimeout(() => {
            cleanup()
            reject(new Error(`Timed out waiting for "${type}"`))
          }, timeout)
          return () => clearTimeout(timer)
        })(),
      )

      const handler = (msg: ServerMessage) => {
        if (msg.type === type) {
          cleanup()
          resolve(msg as Extract<ServerMessage, { type: T }>)
        } else if (msg.type === 'error') {
          cleanup()
          reject(new Error((msg as { type: 'error'; message: string }).message))
        }
      }
      this.msgCbs.add(handler)
      cleanups.push(() => this.msgCbs.delete(handler))

      cleanups.push(
        this.onClose(() => {
          cleanup()
          reject(new Error('Connection closed'))
        }),
      )
    })
  }

  identify(deviceId: string): void {
    this.send({ type: 'identify', deviceId })
  }

  async authenticate(token: string): Promise<string> {
    this.send({ type: 'authenticate', token })
    const reply = await this.waitFor('authenticated')
    return reply.clerkUserId
  }

  async getRtpCapabilities(): Promise<unknown> {
    this.send({ type: 'getRtpCapabilities' })
    const reply = await this.waitFor('rtpCapabilities')
    return reply.rtpCapabilities
  }

  async createRoom(meta: { title: string; lat: number; lng: number; sources: string[]; subscribersOnly: boolean; locationPrecision?: 'exact' | 'city' | 'country' | 'off'; ppvEventId?: string }): Promise<string> {
    this.send({ type: 'createRoom', ...meta })
    const reply = await this.waitFor('roomCreated')
    return reply.roomId
  }

  async joinRoom(roomId: string): Promise<{ producers: Array<{ id: string; kind: string }>; orientation: 'portrait' | 'landscape' | null }> {
    this.send({ type: 'joinRoom', roomId })
    const reply = await this.waitFor('roomJoined')
    return { producers: reply.producers, orientation: reply.orientation }
  }

  async createTransport(direction: 'send' | 'recv'): Promise<{
    id: string
    iceParameters: unknown
    iceCandidates: unknown[]
    dtlsParameters: unknown
  }> {
    this.send({ type: 'createTransport', direction })
    const reply = await this.waitFor('transportCreated')
    return { id: reply.id, iceParameters: reply.iceParameters, iceCandidates: reply.iceCandidates, dtlsParameters: reply.dtlsParameters }
  }

  async connectTransport(transportId: string, dtlsParameters: unknown): Promise<void> {
    this.send({ type: 'connectTransport', transportId, dtlsParameters })
    await this.waitFor('transportConnected')
  }

  async produce(kind: 'audio' | 'video', rtpParameters: unknown): Promise<string> {
    this.send({ type: 'produce', kind, rtpParameters })
    const reply = await this.waitFor('produced')
    return reply.id
  }

  async consume(producerId: string, rtpCapabilities: unknown): Promise<{
    id: string
    producerId: string
    kind: string
    rtpParameters: unknown
  }> {
    this.send({ type: 'consume', producerId, rtpCapabilities })
    const reply = await this.waitFor('consumed')
    return { id: reply.id, producerId: reply.producerId, kind: reply.kind, rtpParameters: reply.rtpParameters }
  }

  sendChatMessage(text: string, handle: string): void {
    this.send({ type: 'chatMessage', text, handle })
  }

  sendReaction(kind: string, handle: string): void {
    this.send({ type: 'reaction', kind, handle })
  }

  sendBroadcasterPaused(): void {
    this.trySend({ type: 'broadcasterPaused' })
  }

  sendBroadcasterResumed(): void {
    this.trySend({ type: 'broadcasterResumed' })
  }

  sendBroadcasterOrientation(
    orientation: 'portrait' | 'landscape',
    rotationDeg?: number,
    hold?: string,
  ): void {
    // platform lets the recorder keep one session across rotations on Android
    // (constant coded frame → footage rotates in-place; no re-bake/restart). iOS
    // still re-bakes (its frame shape changes on rotation). Missing → treated iOS.
    const platform = Platform.OS === 'android' ? 'android' : 'ios'
    this.trySend({ type: 'broadcasterOrientation', orientation, rotationDeg, hold, platform })
  }

  // Tell the server which camera is live (back/front). Sent at go-live and on
  // every flip so the recorder can re-bake rotation per camera — back and front
  // need rotations 180° apart and the bake is fixed per recording session.
  sendCameraFacing(facing: 'user' | 'environment'): void {
    this.trySend({ type: 'cameraFacing', facing })
  }

  sendLocationUpdate(lat: number, lng: number): void {
    this.trySend({ type: 'locationUpdate', lat, lng })
  }

  // Fire-and-forget sensor sample (broadcaster). trySend silently no-ops when the
  // socket isn't open — telemetry is lossy by nature (the next sample supersedes).
  sendTelemetry(payload: TelemetryPayload): void {
    this.trySend({ type: 'telemetry', payload })
  }

  sendTip(amount: number): void {
    this.send({ type: 'tip', amount })
  }

  sendGift(giftType: string): void {
    this.send({ type: 'gift', giftType })
  }

}

export const signalingClient = new MediasoupSignalingClient()
