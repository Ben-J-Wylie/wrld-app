import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { socket } from "./socket";

type RemotePeerStreams = {
  audio?: MediaStream;
  video?: MediaStream;
};

export class MediaSoupClient {
  socket: Socket;
  device: mediasoupClient.Device | null = null;

  producers = new Map<string, mediasoupClient.types.Producer>();
  consumers = new Map<string, mediasoupClient.types.Consumer>();

  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;

  // Local raw camera stream
  localStream: MediaStream | null = null;

  // 🔥 NEW: raw local microphone audio stream
  localMicStream: MediaStream | null = null;

  remoteStreams = new Map<string, RemotePeerStreams>();

  _toggleLock = false;
  currentViewingPeer: string | null = null;

  ready: Promise<void>;
  private _resolveReady!: () => void;

  // React callbacks
  onNewStream?: (stream: MediaStream, id: string) => void;
  onRemoveStream?: (id: string) => void;
  onPeerList?: (peers: { id: string; name: string }[] | string[]) => void;

  private lastPeerList: { id: string; name: string }[] | string[] = [];

  constructor() {
    this.ready = new Promise<void>((res) => (this._resolveReady = res));

    this.socket = socket;

    this.socket.on("disconnect", () => {
      console.log("❌ Disconnected from mediaserver");
    });

    this.socket.on("newProducer", async ({ producerId }) => {
      await this.consume(producerId);
    });

    this.socket.on("peerList", (peers: any[]) => {
      this.lastPeerList = peers;
      this.onPeerList?.(peers);
    });

    this.socket.on("peerProducersUpdated", async ({ peerId, producers }) => {
      if (this.remoteStreams.has(peerId)) {
        for (const p of producers) {
          await this.consume(p.id);
        }
      }
    });
  }

  // React setter
  set onPeerListCallback(cb: (peers: any[]) => void) {
    this.onPeerList = cb;
    if (this.lastPeerList.length > 0) {
      cb(this.lastPeerList);
    }
  }

  // -----------------------------------
  // Basic device init
  // -----------------------------------
  async initDevice() {
    const routerCaps = await this.request("getRouterRtpCapabilities");
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities: routerCaps });
  }

  // -----------------------------------
  // Transports
  // -----------------------------------
  async createSendTransport() {
    const data = await this.request("createTransport", { direction: "send" });
    this.sendTransport = this.device!.createSendTransport(data);

    this.sendTransport.on("connect", ({ dtlsParameters }, cb) => {
      this.socket.emit(
        "connectTransport",
        { transportId: data.id, dtlsParameters },
        cb
      );
    });

    this.sendTransport.on("produce", async ({ kind, rtpParameters }, cb) => {
      const { id } = await this.request("produce", { kind, rtpParameters });
      cb({ id });
    });
  }

  async createRecvTransport() {
    if (this.recvTransport) return this.recvTransport;

    const data = await this.request("createTransport", { direction: "recv" });
    this.recvTransport = this.device!.createRecvTransport(data);

    await new Promise<void>((resolve, reject) => {
      this.recvTransport!.on(
        "connect",
        ({ dtlsParameters }, callback, errback) => {
          this.socket.emit(
            "connectTransport",
            { transportId: data.id, dtlsParameters },
            (res: any) => {
              if (res?.error) {
                errback?.(new Error(res.error));
                reject(res.error);
              } else {
                callback();
                resolve();
              }
            }
          );
        }
      );
    });

    return this.recvTransport;
  }

  // -----------------------------------
  // Publishing full local stream
  // -----------------------------------
  async publishLocalStream(stream: MediaStream) {
    if (!this.device) await this.initDevice();
    if (!this.sendTransport) await this.createSendTransport();

    this.localStream = stream;

    for (const track of stream.getTracks()) {
      const producer = await this.sendTransport!.produce({ track });
      this.producers.set(producer.id, producer);
    }

    await this.createRecvTransport();
  }

  // -----------------------------------
  // Publishing an individual track
  // -----------------------------------
  async publishTrack(track: MediaStreamTrack) {
    if (!this.device) await this.initDevice();
    if (!this.sendTransport) await this.createSendTransport();

    console.log("🛰 MediaSoupClient.publishTrack: producing track", track);

    const producer = await this.sendTransport!.produce({ track });
    this.producers.set(producer.id, producer);

    console.log(
      "🛰 MediaSoupClient.publishTrack: producer created",
      producer.id,
      "kind:",
      producer.kind
    );

    // 🔥 LOCAL SELF-VIEW STREAMS
    const selfStream = new MediaStream([track]);

    if (track.kind === "video") {
      this.localStream = selfStream;
    }

    if (track.kind === "audio") {
      this.localMicStream = selfStream;
    }

    console.log(
      "🛰 MediaSoupClient.publishTrack: emitting onNewStream for self",
      selfStream
    );
    this.onNewStream?.(selfStream, "self");

    return producer;
  }

  stopProducerByKind(kind: "audio" | "video") {
    for (const [id, producer] of this.producers.entries()) {
      if (producer.kind === kind) {
        producer.close();
        this.producers.delete(id);
      }
    }
  }

  // -----------------------------------
  // Consuming remote streams
  // -----------------------------------
  async consume(producerId: string, peerId?: string) {
    if (!this.device) await this.initDevice();
    if (!this.recvTransport) await this.createRecvTransport();

    const data = await this.request("consume", {
      producerId,
      rtpCapabilities: this.device!.rtpCapabilities,
    });

    if (!data || data.error) {
      console.warn("Consume failed:", data?.error);
      return;
    }

    const consumer = await this.recvTransport!.consume({
      id: data.id,
      producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    if (!consumer) return;

    this.consumers.set(consumer.id, consumer);

    const stream = new MediaStream([consumer.track]);
    const id = peerId || data.peerId || producerId;

    const entry: RemotePeerStreams = this.remoteStreams.get(id) || {};

    if (consumer.kind === "audio") entry.audio = stream;
    if (consumer.kind === "video") entry.video = stream;

    this.remoteStreams.set(id, entry);

    this.onNewStream?.(stream, id);

    this.request("resume", { consumerId: consumer.id }).catch(() => {});

    return consumer;
  }

  // -----------------------------------
  // Requests
  // -----------------------------------
  request(event: string, data: any = {}): Promise<any> {
    return new Promise((resolve) => {
      this.socket.emit(event, data, resolve);
    });
  }

  // -----------------------------------
  // Cleanup
  // -----------------------------------
  close() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localMicStream?.getTracks().forEach((t) => t.stop());

    for (const entry of this.remoteStreams.values()) {
      entry.audio?.getTracks().forEach((t) => t.stop());
      entry.video?.getTracks().forEach((t) => t.stop());
    }

    this.sendTransport?.close();
    this.recvTransport?.close();

    this.producers.clear();
    this.consumers.clear();
    this.remoteStreams.clear();

    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }
}
