// apps/mediaserver/src/mediasoup/peerManager.ts
import * as mediasoup from "mediasoup";
import { Router } from "mediasoup/node/lib/Router";

export class PeerManager {
  router: Router;
  peers: Map<
    string,
    {
      transports: mediasoup.types.WebRtcTransport[];
      producers: mediasoup.types.Producer[];
      consumers: mediasoup.types.Consumer[];
    }
  > = new Map();

  constructor(router: Router) {
    this.router = router;
  }

  async createTransport(socketId: string) {
    const transport = await this.router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: process.env.ANNOUNCED_IP || "127.0.0.1" }],
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

  async createProducer(socketId: string, kind: string, rtpParameters: any) {
    const peer = this._ensurePeer(socketId);
    const transport = peer.transports[peer.transports.length - 1];
    const producer = await transport.produce({ kind, rtpParameters });
    peer.producers.push(producer);
    return producer;
  }

  async createConsumer(socketId: string, producerId: string, rtpCapabilities: any) {
    const peer = this._ensurePeer(socketId);
    const canConsume = this.router.canConsume({ producerId, rtpCapabilities });
    if (!canConsume) return null;

    const transport = peer.transports[peer.transports.length - 1];
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });
    peer.consumers.push(consumer);
    return consumer;
  }

  async resumeConsumer(socketId: string, consumerId: string) {
    const peer = this._ensurePeer(socketId);
    const consumer = peer.consumers.find((c) => c.id === consumerId);
    if (consumer) await consumer.resume();
  }

  removePeer(socketId: string) {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    peer.transports.forEach((t) => t.close());
    peer.producers.forEach((p) => p.close());
    peer.consumers.forEach((c) => c.close());
    this.peers.delete(socketId);
  }

  _ensurePeer(socketId: string) {
    if (!this.peers.has(socketId)) {
      this.peers.set(socketId, { transports: [], producers: [], consumers: [] });
    }
    return this.peers.get(socketId)!;
  }
}
