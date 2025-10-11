// apps/web/src/lib/mediasoupClient.ts
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

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

  // ✅ Event hooks for React
  onNewStream?: (stream: MediaStream, id: string) => void;
  onRemoveStream?: (id: string) => void;
  onPeerList?: (peers: { id: string; name: string }[] | string[]) => void;

  // ✅ Buffer for last known peers (handles race conditions)
  private lastPeerList: { id: string; name: string }[] | string[] = [];

  constructor() {
    this.socket = io(MEDIASERVER_URL, { transports: ["websocket"] });

    this.socket.on("connect", () => {
      const name = localStorage.getItem("username") || "Guest";
      console.log("🧠 Registering as:", name);
      this.socket.emit("register", { name });
    });


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
      if (this.onPeerList) {
        console.log("🧩 Calling onPeerList callback immediately");
        this.onPeerList(peers);
      } else {
        console.log("⚠️ onPeerList not set yet — buffering until ready");
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

  // --- Core setup ---
  async initDevice() {
    const routerRtpCapabilities: any = await this.request("getRouterRtpCapabilities");
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities });
  }

  async createSendTransport() {
    const data = await this.request("createTransport");
    this.sendTransport = this.device!.createSendTransport(data);

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
    const data = await this.request("createTransport");
    this.recvTransport = this.device!.createRecvTransport(data);

    this.recvTransport.on("connect", ({ dtlsParameters }, callback) => {
      this.socket.emit("connectTransport", { transportId: data.id, dtlsParameters }, callback);
    });

    this.recvTransport.on("connectionstatechange", (state) => {
      console.log("[RecvTransport] state =>", state);
    });
  }

  // --- Publishing local camera/mic ---
  async publishLocalStream(stream: MediaStream) {
    this.localStream = stream;
    await this.initDevice();
    await this.createSendTransport();

    for (const track of stream.getTracks()) {
      const producer = await this.sendTransport!.produce({ track });
      this.producers.set(producer.id, producer);
      console.log("📡 Published:", track.kind);
    }

    // Create receiving side (for viewing others)
    await this.createRecvTransport();
  }

  // --- Consuming remote producers ---
  async consume(producerId: string) {
    if (!this.device || !this.recvTransport) return;
    const { rtpCapabilities } = this.device;
    const data = await this.request("consume", { producerId, rtpCapabilities });
    if (data.error) return console.warn(data.error);

    const consumer = await this.recvTransport.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    const stream = new MediaStream([consumer.track]);
    this.remoteStreams.set(consumer.id, stream);
    if (this.onNewStream) this.onNewStream(stream, consumer.id);

    consumer.on("transportclose", () => {
      if (this.onRemoveStream) this.onRemoveStream(consumer.id);
      this.remoteStreams.delete(consumer.id);
    });

    await this.request("resume", { consumerId: consumer.id });
  }

  // --- Utility: emit socket requests with promises ---
  async request(event: string, data: any = {}): Promise<any> {
    return new Promise((resolve) => {
      this.socket.emit(event, data, (response: any) => resolve(response));
    });
  }

  // --- Cleanup ---
  close() {
    console.log("🧹 Closing mediasoup client...");
    this.socket.disconnect();

    this.localStream?.getTracks().forEach((t) => t.stop());
    this.remoteStreams.forEach((stream) =>
      stream.getTracks().forEach((t) => t.stop())
    );

    this.remoteStreams.clear();
    this.producers.clear();
    this.consumers.clear();

    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
  }
}
