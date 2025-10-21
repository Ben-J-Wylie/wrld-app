// apps/mediaserver/src/mediasoup/peerManager.ts
import * as mediasoup from "mediasoup";
import { Router } from "mediasoup/node/lib/Router";

export class PeerManager {
  router: Router;
  peers: Map<
    string,
    {
      transports: mediasoup.types.WebRtcTransport[];
      producers: Map<string, mediasoup.types.Producer>;
      consumers: Map<string, mediasoup.types.Consumer>; // ✅ now Map
    }
  > = new Map();

  constructor(router: Router) {
    this.router = router;
  }

  async createTransport(socketId: string) {
    const transport = await this.router.createWebRtcTransport({
      listenIps: [
        { ip: "0.0.0.0", announcedIp: process.env.ANNOUNCED_IP || "127.0.0.1" },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    this._ensurePeer(socketId).transports.push(transport);

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async connectTransport(socketId: string, transportId: string, dtlsParameters: any) {
    const peer = this._ensurePeer(socketId);
    const transport = peer.transports.find((t) => t.id === transportId);
    if (!transport) throw new Error("Transport not found");
    await transport.connect({ dtlsParameters });
  }

  /** ✅ Close existing same-kind producer to avoid MID collision */
  async createProducer(socketId: string, kind: string, rtpParameters: any) {
    const peer = this._ensurePeer(socketId);
    const transport = peer.transports.at(-1);
    if (!transport) throw new Error("No transport for peer");

    const existing = peer.producers.get(kind);
    if (existing) {
      console.log(`🧹 Closing existing ${kind} producer for ${socketId}`);
      try {
        existing.close();
      } catch {}
      peer.producers.delete(kind);
    }

    const producer = await transport.produce({ kind, rtpParameters });
    peer.producers.set(kind, producer);

    console.log(`📡 New ${kind} producer created for ${socketId}: ${producer.id}`);
    console.log(
      `📦 Peer ${socketId} producers now:`,
      Array.from(peer.producers.keys())
    );

    producer.on("transportclose", () => peer.producers.delete(kind));

    return producer;
  }

  async createConsumer(socketId: string, producerId: string, rtpCapabilities: any) {
    const peer = this._ensurePeer(socketId);
    const transport = peer.transports.at(-1); // last transport
    if (!transport) {
      console.warn(`⚠️ No transport found for peer ${socketId} — transports:`, peer.transports.length);
      throw new Error("No transport for peer");
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    peer.consumers.set(consumer.id, consumer); // ✅ Map now works

    consumer.on("transportclose", () => peer.consumers.delete(consumer.id));

    return consumer;
  }

  async resumeConsumer(socketId: string, consumerId: string) {
    const peer = this._ensurePeer(socketId);
    const consumer = peer.consumers.get(consumerId);
    if (consumer) await consumer.resume();
  }

  /** ✅ Cleanly remove peer */
  removePeer(socketId: string) {
    const peer = this.peers.get(socketId);
    if (!peer) return;

    console.log(`🧹 Removing peer ${socketId}`);

    for (const producer of peer.producers.values()) {
      try {
        producer.close();
      } catch {}
    }
    for (const consumer of peer.consumers.values()) {
      try {
        consumer.close();
      } catch {}
    }
    for (const transport of peer.transports) {
      try {
        transport.close();
      } catch {}
    }

    this.peers.delete(socketId);
  }

  _ensurePeer(socketId: string) {
    let peer = this.peers.get(socketId);
    if (!peer) {
      peer = {
        transports: [],
        producers: new Map(),
        consumers: new Map(), // ✅ initialize as Map
      };
      this.peers.set(socketId, peer);
    } else {
      // Safety guard
      if (!(peer.producers instanceof Map)) {
        console.warn(`⚠️ Fixing producers type for ${socketId}`);
        peer.producers = new Map();
      }
      if (!(peer.consumers instanceof Map)) {
        console.warn(`⚠️ Fixing consumers type for ${socketId}`);
        peer.consumers = new Map();
      }
    }
    return peer;
  }
}
