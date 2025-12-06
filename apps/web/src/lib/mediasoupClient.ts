import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { socket } from "./socket";

type MediaTag = "cam" | "mic" | "screen" | string;

type RemotePeerStreams = {
  // Legacy fields (still populated)
  audio?: MediaStream;
  video?: MediaStream;

  // New, more specific fields
  mic?: MediaStream;
  camera?: MediaStream;
  screen?: MediaStream;
};

export class MediaSoupClient {
  socket: Socket;
  device: mediasoupClient.Device | null = null;

  producers = new Map<string, mediasoupClient.types.Producer>();
  consumers = new Map<string, mediasoupClient.types.Consumer>();

  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;

  // Legacy: single local video stream (camera)
  localStream: MediaStream | null = null;

  // More explicit local streams
  localCameraStream: MediaStream | null = null;
  localScreenStream: MediaStream | null = null;
  localMicStream: MediaStream | null = null;

  remoteStreams = new Map<string, RemotePeerStreams>();

  _toggleLock = false;
  currentViewingPeer: string | null = null;

  ready: Promise<void>;
  private _resolveReady!: () => void;

  // React callbacks
  // NOTE: third arg (mediaTag) is optional & backwards compatible
  onNewStream?: (stream: MediaStream, id: string, mediaTag?: MediaTag) => void;
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

    this.socket.on(
      "peerProducersUpdated",
      async ({ peerId, producers }: { peerId: string; producers: any[] }) => {
        if (this.remoteStreams.has(peerId)) {
          for (const p of producers) {
            await this.consume(p.id, peerId);
          }
        }
      }
    );
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

    // IMPORTANT: include appData so server knows camera vs screen vs mic
    this.sendTransport.on(
      "produce",
      async ({ kind, rtpParameters, appData }, cb) => {
        const { id } = await this.request("produce", {
          kind,
          rtpParameters,
          appData,
        });
        cb({ id });
      }
    );
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
  // Publishing full local stream (legacy)
  // -----------------------------------
  async publishLocalStream(stream: MediaStream) {
    if (!this.device) await this.initDevice();
    if (!this.sendTransport) await this.createSendTransport();

    this.localStream = stream;

    for (const track of stream.getTracks()) {
      const mediaTag: MediaTag =
        track.kind === "video" ? "cam" : track.kind === "audio" ? "mic" : "";
      const producer = await this.sendTransport!.produce({
        track,
        // Let server know what this is
        appData: { mediaTag },
      });
      this.producers.set(producer.id, producer);
    }

    await this.createRecvTransport();
  }

  // -----------------------------------
  // Publishing an individual track (cam / mic / screen)
  // -----------------------------------
  async publishTrack(track: MediaStreamTrack, mediaTag?: MediaTag) {
    if (!this.device) await this.initDevice();
    if (!this.sendTransport) await this.createSendTransport();

    // Default mediaTag if not provided
    if (!mediaTag) {
      if (track.kind === "video") {
        mediaTag = "cam";
      } else if (track.kind === "audio") {
        mediaTag = "mic";
      }
    }

    console.log(
      "🛰 MediaSoupClient.publishTrack: producing track",
      track,
      "mediaTag:",
      mediaTag
    );

    const producer = await this.sendTransport!.produce({
      track,
      appData: { mediaTag },
    });
    this.producers.set(producer.id, producer);

    console.log(
      "🛰 MediaSoupClient.publishTrack: producer created",
      producer.id,
      "kind:",
      producer.kind,
      "mediaTag:",
      mediaTag
    );

    // 🔥 LOCAL SELF-VIEW STREAMS — SEPARATE BY TAG
    const selfStream = new MediaStream([track]);

    if (mediaTag === "cam") {
      this.localCameraStream = selfStream;
      this.localStream = selfStream; // legacy alias
    } else if (mediaTag === "screen") {
      this.localScreenStream = selfStream;
    } else if (mediaTag === "mic") {
      this.localMicStream = selfStream;
    }

    console.log(
      "🛰 MediaSoupClient.publishTrack: emitting onNewStream for self",
      selfStream,
      "mediaTag:",
      mediaTag
    );
    this.onNewStream?.(selfStream, "self", mediaTag);

    return producer;
  }

  // Stop by kind (legacy: stops ALL video producers, e.g. cam + screen)
  stopProducerByKind(kind: "audio" | "video") {
    for (const [id, producer] of this.producers.entries()) {
      if (producer.kind === kind) {
        producer.close();
        this.producers.delete(id);
      }
    }
  }

  // NEW: stop by mediaTag (e.g. "cam" vs "screen")
  stopProducerByMediaTag(tag: MediaTag) {
    for (const [id, producer] of this.producers.entries()) {
      const pTag = (producer.appData as any)?.mediaTag as MediaTag | undefined;
      if (pTag === tag) {
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

    const data: any = await this.request("consume", {
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

    // Prefer explicit peerId arg, then server-provided peerId, then fallback to producerId
    const id = peerId || data.peerId || producerId;

    const mediaTag: MediaTag | undefined =
      data.appData?.mediaTag || data.mediaTag;

    const entry: RemotePeerStreams = this.remoteStreams.get(id) || {};

    if (consumer.kind === "audio" || mediaTag === "mic") {
      entry.audio = stream; // legacy
      entry.mic = stream;
    } else if (consumer.kind === "video") {
      if (mediaTag === "screen") {
        entry.screen = stream;
      } else {
        // Default / cam
        entry.camera = stream;
        entry.video = stream; // legacy alias (cam as primary video)
      }
    }

    this.remoteStreams.set(id, entry);

    // Let React side know what this is
    this.onNewStream?.(stream, id, mediaTag);

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
    this.localCameraStream?.getTracks().forEach((t) => t.stop());
    this.localScreenStream?.getTracks().forEach((t) => t.stop());
    this.localMicStream?.getTracks().forEach((t) => t.stop());

    for (const entry of this.remoteStreams.values()) {
      entry.audio?.getTracks().forEach((t) => t.stop());
      entry.video?.getTracks().forEach((t) => t.stop());
      entry.camera?.getTracks().forEach((t) => t.stop());
      entry.screen?.getTracks().forEach((t) => t.stop());
      entry.mic?.getTracks().forEach((t) => t.stop());
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
