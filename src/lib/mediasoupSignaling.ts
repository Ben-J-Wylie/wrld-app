export type ClientMessage =
  | { type: 'authenticate'; token: string }
  | { type: 'getRtpCapabilities' }
  | { type: 'createRoom'; title: string; lat: number; lng: number; sources: string[] }
  | { type: 'joinRoom'; roomId: string }
  | { type: 'createTransport'; direction: 'send' | 'recv' }
  | { type: 'connectTransport'; transportId: string; dtlsParameters: unknown }
  | { type: 'produce'; kind: 'audio' | 'video'; rtpParameters: unknown }
  | { type: 'consume'; producerId: string; rtpCapabilities: unknown }

export type ServerMessage =
  | { type: 'authenticated'; clerkUserId: string }
  | { type: 'rtpCapabilities'; rtpCapabilities: unknown }
  | { type: 'roomCreated'; roomId: string }
  | { type: 'roomJoined'; producers: Array<{ id: string; kind: string }> }
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
  | { type: 'viewerCountUpdated'; viewerCount: number }
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

  async createRoom(meta: { title: string; lat: number; lng: number; sources: string[] }): Promise<string> {
    this.send({ type: 'createRoom', ...meta })
    const reply = await this.waitFor('roomCreated')
    return reply.roomId
  }

  async joinRoom(roomId: string): Promise<Array<{ id: string; kind: string }>> {
    this.send({ type: 'joinRoom', roomId })
    const reply = await this.waitFor('roomJoined')
    return reply.producers
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
}

export const signalingClient = new MediasoupSignalingClient()
