export type ClientMessage =
  | { type: 'authenticate'; token: string }
  | { type: 'getRtpCapabilities' }
  | { type: 'createRoom'; title: string; lat: number; lng: number }
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
  | { type: 'error'; message: string }

class MediasoupSignalingClient {
  private ws: WebSocket | null = null
  private msgCbs = new Set<(msg: ServerMessage) => void>()
  private closeCbs = new Set<() => void>()

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws?.close()

      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => resolve()
      ws.onerror = () => reject(new Error('WebSocket connection failed'))
      ws.onclose = () => this.closeCbs.forEach((cb) => cb())
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

  onClose(cb: () => void): () => void {
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

  async createRoom(meta: { title: string; lat: number; lng: number }): Promise<string> {
    this.send({ type: 'createRoom', ...meta })
    const reply = await this.waitFor('roomCreated')
    return reply.roomId
  }

  async joinRoom(roomId: string): Promise<Array<{ id: string; kind: string }>> {
    this.send({ type: 'joinRoom', roomId })
    const reply = await this.waitFor('roomJoined')
    return reply.producers
  }
}

export const signalingClient = new MediasoupSignalingClient()
