// apps/web/src/lib/mediasoupClient.ts
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { socket } from "./socket";

const MEDIASERVER_URL =
  import.meta.env.VITE_MEDIASERVER_URL || "https://10.0.0.84:4002"; // 👈 adjust for your LAN/public IP

export class MediaSoupClient {
  socket: Socket;
  device: mediasoupClient.Device | null = null;

  producers = new Map<string, mediasoupClient.Producer>();
  consumers = new Map<string, mediasoupClient.Consumer>();
  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;

  localStream: MediaStream | null = null;
  remoteStreams = new Map<string, MediaStream>();

  _toggleLock = false;
  currentViewingPeer: string | null = null;

  ready: Promise<void>;
  private _resolveReady!: () => void;

  // ✅ Event hooks for React
  onNewStream?: (stream: MediaStream, id: string) => void;
  onRemoveStream?: (id: string) => void;
  onPeerList?: (peers: { id: string; name: string }[] | string[]) => void;

  // ✅ Buffer for last known peers (handles race conditions)
  private lastPeerList: { id: string; name: string }[] | string[] = [];

  constructor() {
    //this.socket = io(MEDIASERVER_URL, { transports: ["websocket"] });
    //console.log("🔗 Connecting to mediaserver at:", MEDIASERVER_URL);
    this.ready = new Promise<void>((res) => (this._resolveReady = res));

    this.socket = socket;

    this.socket.on("disconnect", () => {
      console.log("❌ Disconnected from mediaserver");
    });

    // 🔹 New producer (another user's published stream)
    this.socket.on("newProducer", async ({ producerId, kind }) => {
      console.log("🆕 New producer:", producerId, kind);
      await this.consume(producerId);
    });

    // 🔹 Peer list updates (buffered replay)
    this.socket.on("peerList", (peers: any[]) => {
      console.log("👥 Active peers:", peers);
      this.lastPeerList = peers;
      this.onPeerList?.(peers);
    });

    this.socket.on("peerProducersUpdated", ({ peerId, producers }) => {
      console.log(`📡 peerProducersUpdated for ${peerId}:`, producers);
      if (this.remoteStreams.has(peerId)) {
        producers.forEach((p: any) => this.consume(p.id));
      }
    });

    
  }

  // ✅ React sets this later — replay last list immediately
  set onPeerListCallback(cb: (peers: any[]) => void) {
    this.onPeerList = cb;
    if (this.lastPeerList.length > 0) {
      console.log("🧠 Replaying last buffered peerList:", this.lastPeerList);
      cb(this.lastPeerList);
    }
  }

  async connectAndInit() {
    // Called once after socket connect
    await this.initDevice();
    if (!this.recvTransport) {
      console.log("🛰️ Pre-creating recvTransport...");
      await this.createRecvTransport();
    }
  }

  // Add this method to your MediaSoupClient class:
  async attachRemoteStream(peerId: string, videoElement: HTMLVideoElement) {
    const producers = await this.request("getPeerProducers", { peerId });

    if (!producers?.length) {
      console.warn(`⚠️ No active producers for peer ${peerId}`);
      return;
    }

    if (!this.recvTransport) await this.createRecvTransport();

    for (const prod of producers) {
      const { id, kind } = prod;
      const consumer = await this.consume(id);

      if (kind === "video") {
        const stream = new MediaStream([consumer.track]);
        videoElement.srcObject = stream;
        await videoElement.play().catch(console.error);
      }
    }
  }


  // --- Core setup ---
  async initDevice() {
    const routerRtpCapabilities: any = await this.request("getRouterRtpCapabilities");
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities });
  }

  // -------------------------------------------------------
// 🧠 NEW: Preload Mediasoup Device (to reduce startup lag)
// -------------------------------------------------------
  private deviceLoading?: Promise<void>; // track ongoing init

async prepareDevice() {
  // 🧩 If a device is already fully loaded, bail early
  if (this.device?.loaded) {
    console.log("ℹ️ [prepareDevice] Device already loaded — skipping");
    return;
  }

  // 🧩 If a device is in the process of loading, wait for it
  if (this.deviceLoading) {
    console.log("⏳ [prepareDevice] Device initialization already in progress — waiting");
    await this.deviceLoading;
    return;
  }

  // 🧩 Define the shared loading promise
  this.deviceLoading = (async () => {
    const startTime = performance.now();
    console.log("⚙️ [prepareDevice] Starting Mediasoup Device initialization...");

    try {
      console.log("⚙️ [prepareDevice] Importing mediasoup-client...");
      const { Device } = await import("mediasoup-client");
      console.log("✅ [prepareDevice] mediasoup-client module imported");

      if (!this.device) {
        console.log("⚙️ [prepareDevice] Creating new Device() instance...");
        this.device = new Device();
      } else {
        console.log("ℹ️ [prepareDevice] Device instance already exists");
      }

      const capsStart = performance.now();
      console.log("📡 [prepareDevice] Requesting router RTP capabilities...");
      const routerCaps = await this.request("getRouterRtpCapabilities");
      console.log(
        `✅ [prepareDevice] Router caps received in ${(
          performance.now() - capsStart
        ).toFixed(1)} ms`
      );

      if (!routerCaps) throw new Error("Failed to get router RTP capabilities");

      const loadStart = performance.now();
      console.log("⚙️ [prepareDevice] Calling device.load()...");
      await this.device.load({ routerRtpCapabilities: routerCaps });
      console.log(
        `✅ [prepareDevice] Device.load() complete in ${(
          performance.now() - loadStart
        ).toFixed(1)} ms`
      );

      console.log(
        `✅ [prepareDevice] Total initialization time: ${(
          performance.now() - startTime
        ).toFixed(1)} ms`
      );
    } catch (err) {
      console.error("❌ [prepareDevice] Failed:", err);
      throw err;
    }
  })();

  // 🧩 Wait for the shared promise to complete
  await this.deviceLoading;
}




  async createSendTransport() {
    const data = await this.request("createTransport", { direction: "send" });
    this.sendTransport = this.device!.createSendTransport(data)

    this.sendTransport.on("connect", ({ dtlsParameters }, callback) => {
      this.socket.emit("connectTransport", { transportId: data.id, dtlsParameters }, callback);
    });

    this.sendTransport.on("produce", async ({ kind, rtpParameters }, callback) => {
      const { id } = await this.request("produce", { kind, rtpParameters });
      callback({ id });
    });

    this.sendTransport.on("connectionstatechange", (state) => {
      console.log("[SendTransport] state =>", state);
    });
  }

async createRecvTransport() {
  // 🧩 Reuse existing one if available
  if (this.recvTransport) {
    console.log("ℹ️ [createRecvTransport] Reusing existing recv transport");
    return this.recvTransport;
  }

  // 🧩 Sanity check — make sure device is initialized
  if (!this.device) {
    throw new Error(
      "[createRecvTransport] Device not initialized — call prepareDevice() first"
    );
  }

  if (!this.device.loaded) {
    throw new Error(
      "[createRecvTransport] Device not loaded — prepareDevice() must finish first"
    );
  }

  // 🧩 Create the recv transport on the server
  console.log("📡 [createRecvTransport] Requesting new recv transport from server...");
  const data = await this.request("createTransport", { direction: "recv" });
  if (!data?.id) {
    console.error(
      "❌ [createRecvTransport] Server did not return a transport id:",
      data
    );
    throw new Error("Invalid transport creation response: missing id");
  }

  console.log("📡 [createRecvTransport] Creating recv transport with id:", data.id);
  this.recvTransport = this.device.createRecvTransport(data);

  // 🧩 Connect handshake
  await new Promise<void>((resolve, reject) => {
    this.recvTransport!.on("connect", ({ dtlsParameters }, callback, errback) => {
      console.log("🔗 [createRecvTransport] Connecting recv transport...");
      this.socket.emit(
        "connectTransport",
        { transportId: data.id, dtlsParameters },
        (res: any) => {
          if (res?.error) {
            console.error(
              "❌ [createRecvTransport] Recv transport connect failed:",
              res.error
            );
            errback?.(new Error(res.error));
            reject(res.error);
          } else {
            console.log("✅ [createRecvTransport] Recv transport connected!");
            callback();
            resolve();
          }
        }
      );
    });
  });

  console.log("🎯 [createRecvTransport] Ready to consume streams");
  return this.recvTransport;
}





  // --- Publishing local camera/mic ---
 async publishLocalStream(stream: MediaStream) {
  if (!this.device) await this.initDevice();
  if (!this.sendTransport) await this.createSendTransport();

  this.localStream = stream;

  for (const track of stream.getTracks()) {
    const producer = await this.sendTransport.produce({ track });
    this.producers.set(producer.id, producer);
    console.log("📡 Published:", track.kind);
  }

  await this.createRecvTransport();
}

async publishTrack(track: MediaStreamTrack) {
  if (!this.device) await this.initDevice();
  if (!this.sendTransport) await this.createSendTransport();

  const producer = await this.sendTransport.produce({ track });
  this.producers.set(producer.id, producer);
  console.log("📡 Published track:", track.kind);
}

  // --- Consuming remote producers ---

  async consume(producerId: string, peerId?: string) {
    if (!this.device) await this.initDevice();

    let tries = 3;
    while (!this.recvTransport && tries > 0) {
      console.log(`⏳ Waiting for recv transport... (${4 - tries}/3)`);
      await new Promise((r) => setTimeout(r, 300));
      tries--;
    }

    if (!this.recvTransport) {
      console.warn("🚫 Cannot consume — recv transport not ready");
      return;
    }

    const { rtpCapabilities } = this.device!;
    console.log("🛰️ consume() request:", producerId);

    const data = await this.request("consume", { producerId, rtpCapabilities });
    console.log("🛰️ consume() response:", data);

    if (data.error) {
      console.warn("⚠️ Consume failed:", data.error);
      return;
    }

    // ✅ Create the consumer
    const consumer = await this.recvTransport.consume({
      id: data.id,
      producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    console.log("🎞️ consumer created:", consumer.id, consumer.kind);
    console.log("🎞️ track:", consumer.track, consumer.track.readyState);

    consumer.track.onunmute = () => {
      console.log("🎬 Track UNMUTED, ready to render:", consumer.track.id);
    };

    // 🧩 Wrap track into a stream
    const stream = new MediaStream([consumer.track]);
    const tagId = peerId || data.peerId || producerId;

    if (consumer.kind === "audio") {
      const audio = document.createElement("audio");
      audio.srcObject = stream;
      audio.autoplay = true;
      audio.muted = false;
      audio.style.display = "none";
      document.body.appendChild(audio);
    }

    // ✅ Store separately for audio/video distinction
    const entry = this.remoteStreams.get(tagId) || {};
    if (consumer.kind === "audio") entry.audioStream = stream;
    if (consumer.kind === "video") entry.videoStream = stream;
    this.remoteStreams.set(tagId, entry);

    // ✅ Notify app with media type
    this.onNewStream?.(stream, tagId, consumer.kind);

    // ✅ Resume playback
    this.request("resume", { consumerId: consumer.id }).catch(() =>
      console.warn("⚠️ resume failed for", consumer.id)
    );

    return consumer;
  }


  stopProducerByKind(kind: "audio" | "video") {
    for (const [id, producer] of this.producers.entries()) {
      if (producer.kind === kind) {
        console.log(`🛑 Stopping ${kind} producer`);
        producer.close();
        this.producers.delete(id);
      }
    }
  }



  // --- View another peer's stream(s)
  request = async (event: string, data: any = {}): Promise<any> => {
    return new Promise((resolve) => {
      this.socket.emit(event, data, (response: any) => resolve(response));
    });
  };

  // --- Toggle peer view (arrow function version) ---
  async togglePeer(peerId: string) {
    if (this._toggleLock) return;
    this._toggleLock = true;
    setTimeout(() => (this._toggleLock = false), 300);

    // 👇 New logic — always show this peer’s feed
    if (this.currentViewingPeer && this.currentViewingPeer !== peerId) {
      console.log("🔄 Switching from", this.currentViewingPeer, "to", peerId);
      this._stopPeer(this.currentViewingPeer);
    }

    this.currentViewingPeer = peerId;

    // If already showing this peer, do nothing (no teardown)
    if (this.remoteStreams.has(peerId)) {
      console.log("✅ Already viewing", peerId);
      return;
    }

    console.log("👁️ Requesting streams for peer:", peerId);
    await this.viewPeer(peerId);
  }


  // Helper to clean up one peer’s consumers
  _stopPeer(peerId: string) {
    const existing = Array.from(this.remoteStreams.keys()).find(id =>
      id.startsWith(peerId)
    );
    if (existing) {
      const stream = this.remoteStreams.get(existing);
      stream?.getTracks().forEach(t => t.stop());
      this.remoteStreams.delete(existing);
      this.onRemoveStream?.(existing);
    }
  }

  // --- Request peer producers ---
  async viewPeer(peerId: string) {
    if (!this.device) await this.initDevice();
    if (!this.recvTransport) {
      console.log("🎯 Creating recv transport on-demand...");
      await this.createRecvTransport();
    }

    const producers = await this.request("getPeerProducers", { peerId });
    if (!producers?.length) {
      console.warn(`⚠️ No active producers for peer: ${peerId}`);
      return;
    }

    await Promise.all(
      producers.map(async (p) => {
        const id = p.id || p.producerId;
        if (!id) return;
        console.log(`🎥 Consuming ${p.kind} producer: ${id}`);
        return this.consume(id);
      })
    );

  }

  // --- Cleanup ---
  close() {
    console.log("🧹 Closing mediasoup client...");

    // stop media tracks first
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.remoteStreams.forEach((s) => s.getTracks().forEach((t) => t.stop()));

    // close transports cleanly
    try {
      this.sendTransport?.close();
      this.recvTransport?.close();
    } catch (e) {
      console.warn("transport close error:", e);
    }

    this.producers.clear();
    this.consumers.clear();
    this.remoteStreams.clear();

    // ensure socket closed
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }
}
