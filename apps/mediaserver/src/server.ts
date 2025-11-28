// apps/mediaserver/src/server.ts
import express from "express";
import fs from "fs";
import https from "https";
import { Server as SocketServer } from "socket.io";
import { createMediasoupCore } from "./mediasoup";
import type { types as mediasoupTypes } from "mediasoup";
import path from "path";
import { fileURLToPath } from "url";

// ---------- Mediasoup Types ----------
type WebRtcTransport = mediasoupTypes.WebRtcTransport;
type Producer = mediasoupTypes.Producer;
type Consumer = mediasoupTypes.Consumer;

// -------------------------------------------------------------
// ESM FIX — define __filename and __dirname
// -------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// -------------------------------------------------------------
// CERT PATH
// -------------------------------------------------------------
const CERT_PATH = path.resolve(__dirname, "../../../certs");

const options = {
  key: fs.readFileSync(path.join(CERT_PATH, "wrld.local-key.pem")),
  cert: fs.readFileSync(path.join(CERT_PATH, "wrld.local.pem")),
};

console.log("🔐 TLS Cert Source:", CERT_PATH);

// -------------------------------------------------------------
// NETWORK IPs
// -------------------------------------------------------------
const LAN_IP = process.env.LAN_IP || "10.0.0.197";
const PUBLIC_IP = process.env.PUBLIC_IP || LAN_IP; // <-- FIXED

// -------------------------------------------------------------
// DATA PATH
// -------------------------------------------------------------
const DATA_PATH = path.resolve("./src/data/known-users.json");

// -------------------------------------------------------------
const server = https.createServer(options, app);
const io = new SocketServer(server, { cors: { origin: "*" } });

const { worker, router } = await createMediasoupCore();

// ---------- Types ----------
interface StreamState {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  isStreaming: boolean;
  settings: Record<string, any>;
  platform: string;
}

type Peer = {
  id: string;
  name: string;
  transports: Map<string, WebRtcTransport>;
  sendTransportId?: string;
  recvTransportId?: string;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  userId?: string;
};

// ---------- State ----------
const peers = new Map<string, Peer>();
const usernames = new Map<string, string>();
const transports = new Map<string, WebRtcTransport>();
const producers = new Map<string, Producer>();
const consumers = new Map<string, Consumer>();
const knownUsers = new Map<string, string>();
const streamStates = new Map<string, StreamState>();

// -------------------------------------------------------------
// ROOT ROUTE
// -------------------------------------------------------------
app.get("/", (_req, res) => res.send("✅ WRLD Mediaserver is running."));

// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------
function getDisplayName(socketId: string): string {
  const name = usernames.get(socketId);
  if (name && name.trim() !== "") return name;

  const peer = peers.get(socketId);
  if (peer?.name && peer.name.trim() !== "") return peer.name;

  const stream = streamStates.get(socketId);
  if (stream?.name && stream.name.trim() !== "") return stream.name;

  return "Anonymous";
}

// -------------------------------------------------------------
// BROADCAST PEER LIST
// -------------------------------------------------------------
function broadcastPeerList() {
  const seenUsers = new Set<string>();
  const list: Array<any> = [];

  for (const [socketId, s] of io.sockets.sockets) {
    const userId = (s as any).userId || socketId;
    if (seenUsers.has(userId)) continue;
    seenUsers.add(userId);

    const state = streamStates.get(socketId);
    const isStreaming = !!state?.isStreaming;
    if (!isStreaming) continue;

    const name =
      knownUsers.get(userId) ||
      usernames.get(socketId) ||
      peers.get(socketId)?.name ||
      "Anonymous";

    list.push({
      id: socketId,
      userId,
      displayName: name,
      platform: state?.platform || "desktop",
      settings: state?.settings || {},
      isStreaming,
    });
  }

  io.emit("peersList", list);
  console.log(
    "📡 peersList broadcast:",
    list.map((p) => p.displayName).join(", ")
  );
}

// Safe Broadcast
function safeBroadcastPeerList() {
  const list = Array.from(streamStates.values())
    .filter((v) => v.isStreaming)
    .map((v) => ({
      id: v.id,
      userId: v.userId,
      displayName: v.displayName || v.name || "Anonymous",
      platform: v.platform || "desktop",
      settings: v.settings || {},
    }));

  io.emit("peersList", list);
  console.log("📡 peersList broadcast:", list.length, "live users");
}

// -------------------------------------------------------------
// PEER DELTA EVENTS
// -------------------------------------------------------------
function emitPeerJoin(peerId: string) {
  const stream = streamStates.get(peerId);
  if (!stream) return;

  io.emit("peerDelta", {
    type: "join",
    peer: {
      id: peerId,
      displayName: stream.displayName || "Anonymous",
      platform: stream.platform,
      settings: stream.settings,
      isStreaming: stream.isStreaming,
    },
  });

  console.log(`🟢 peerDelta: join -> ${stream.name}`);
}

function emitPeerUpdate(peerId: string) {
  const stream = streamStates.get(peerId);
  if (!stream) return;

  io.emit("peerDelta", {
    type: "update",
    peer: {
      id: peerId,
      displayName: stream.displayName,
      platform: stream.platform,
      settings: stream.settings,
      isStreaming: stream.isStreaming,
    },
  });

  console.log(`🟡 peerDelta: update -> ${stream.name}`);
}

function emitPeerLeave(peerId: string) {
  io.emit("peerDelta", {
    type: "leave",
    id: peerId,
  });
  console.log(`🔴 peerDelta: leave -> ${peerId}`);
}

// -------------------------------------------------------------
// SOCKET CONNECTION
// -------------------------------------------------------------
io.on("connection", (socket) => {
  console.log(`🔌 [Socket] connected: ${socket.id}`);

  const incomingUserId = (socket.handshake.auth?.userId ||
    socket.handshake.query?.userId) as string | undefined;

  // Restore name if known
  if (incomingUserId && knownUsers.has(incomingUserId)) {
    const restored = knownUsers.get(incomingUserId)!;
    usernames.set(socket.id, restored);
    (socket as any).userId = incomingUserId;
  } else {
    usernames.set(socket.id, "Anonymous");
  }

  setTimeout(() => safeBroadcastPeerList(), 500);

  // -------------------------------------------------------------
  // REGISTER
  // -------------------------------------------------------------
  socket.on(
    "register",
    (
      { name, userId }: { name: string; userId: string | undefined },
      cb?: (v: { ok: true }) => void
    ) => {
      const clean = (name || "").trim() || "Anonymous";
      const stableId = userId || socket.id;

      // Remove old sockets with same userId
      for (const [id, s] of io.sockets.sockets.entries()) {
        if ((s as any).userId === stableId && id !== socket.id) {
          try {
            s.disconnect(true);
          } catch {}
          peers.delete(id);
        }
      }

      // Remove stale streamStates
      for (const [key, val] of streamStates.entries()) {
        if (val.userId === stableId && key !== socket.id) {
          streamStates.delete(key);
        }
      }

      usernames.set(socket.id, clean);
      (socket as any).userId = stableId;

      const peer: Peer = {
        id: socket.id,
        name: clean,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        userId: stableId,
      };
      peers.set(socket.id, peer);

      // Restore previous stream state
      const prev = Array.from(streamStates.values()).find(
        (s) => s.userId === stableId
      );

      const newState: StreamState = {
        id: socket.id,
        userId: stableId,
        name: clean,
        displayName: clean,
        isStreaming: prev?.isStreaming || false,
        settings: prev?.settings || {},
        platform: prev?.platform || "desktop",
      };

      streamStates.set(socket.id, newState);

      emitPeerJoin(socket.id);
      cb?.({ ok: true });
      broadcastPeerList();
      socket.emit("resyncStreamState");
    }
  );

  // -------------------------------------------------------------
  // CREATE RECV TRANSPORT
  // -------------------------------------------------------------
  socket.on("createRecvTransport", async (_: any, cb: Function) => {
    let peer = peers.get(socket.id);
    if (!peer) {
      peer = {
        id: socket.id,
        name: "Anonymous",
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };
      peers.set(socket.id, peer);
    }

    const routerIp = PUBLIC_IP;

    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: routerIp }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    peer.transports.set(transport.id, transport);
    peer.recvTransportId = transport.id;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  // -------------------------------------------------------------
  // CREATE SEND TRANSPORT
  // -------------------------------------------------------------
  socket.on("createSendTransport", async (_: any, cb: Function) => {
    let peer = peers.get(socket.id);
    if (!peer) {
      peer = {
        id: socket.id,
        name: usernames.get(socket.id) || "Anonymous",
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };
      peers.set(socket.id, peer);
    }

    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: PUBLIC_IP }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    peer.transports.set(transport.id, transport);
    peer.sendTransportId = transport.id;

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  // -------------------------------------------------------------
  // UPDATE STREAM STATE
  // -------------------------------------------------------------
  socket.on(
    "updateStreamState",
    ({
      isStreaming,
      settings,
      platform,
    }: {
      isStreaming: boolean;
      settings?: Record<string, any>;
      platform?: string;
    }) => {
      const userId = (socket as any).userId;
      const username = usernames.get(socket.id);

      if (!userId || !username) return;

      const updated: StreamState = {
        id: socket.id,
        userId,
        name: username,
        displayName: username,
        isStreaming,
        settings: settings || {},
        platform: platform || "desktop",
      };

      streamStates.set(socket.id, updated);
      broadcastPeerList();
    }
  );

  // -------------------------------------------------------------
  // TRIMMED RTP CAPABILITIES
  // -------------------------------------------------------------
  socket.on("getRouterRtpCapabilities", (_: any, cb: Function) => {
    const caps = JSON.parse(JSON.stringify(router.rtpCapabilities));

    caps.codecs = caps.codecs.filter(
      (c: mediasoupTypes.RtpCodecCapability) =>
        c.mimeType === "audio/opus" || c.mimeType === "video/VP8"
    );

    caps.codecs = caps.codecs.filter(
      (c: mediasoupTypes.RtpCodecCapability) => !c.mimeType.includes("rtx")
    );

    caps.headerExtensions = caps.headerExtensions.filter(
      (ext: mediasoupTypes.RtpHeaderExtension) =>
        [
          "urn:3gpp:video-orientation",
          "urn:ietf:params:rtp-hdrext:sdes:mid",
          "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
        ].includes(ext.uri)
    );

    cb?.(caps);
  });

  // -------------------------------------------------------------
  // CREATE GENERIC TRANSPORT
  // -------------------------------------------------------------
  socket.on(
    "createTransport",
    async ({ direction }: { direction: "send" | "recv" }, cb: Function) => {
      try {
        const peer = peers.get(socket.id);
        if (!peer) return cb?.({ error: "Peer not ready yet" });

        const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: "0.0.0.0", announcedIp: PUBLIC_IP }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          initialAvailableOutgoingBitrate: 1_000_000,
          appData: { direction },
        });

        peer.transports.set(transport.id, transport);
        transports.set(transport.id, transport);

        if (direction === "send") peer.sendTransportId = transport.id;
        else peer.recvTransportId = transport.id;

        cb?.({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          sctpParameters: transport.sctpParameters ?? null,
          appData: transport.appData,
        });
      } catch (err) {
        const e = err as Error;
        cb?.({ error: e.message });
      }
    }
  );

  // -------------------------------------------------------------
  // CONNECT TRANSPORT
  // -------------------------------------------------------------
  socket.on(
    "connectTransport",
    async (
      {
        transportId,
        dtlsParameters,
      }: { transportId: string; dtlsParameters: any },
      cb: Function
    ) => {
      const peer = peers.get(socket.id);
      if (!peer) return cb?.({ error: "Peer not found" });

      const transport = peer.transports.get(transportId);
      if (!transport) return cb?.({ error: "Transport not found" });

      await transport.connect({ dtlsParameters });
      cb?.({ ok: true });
    }
  );

  // -------------------------------------------------------------
  // PRODUCE
  // -------------------------------------------------------------
  socket.on(
    "produce",
    async (
      { kind, rtpParameters }: { kind: any; rtpParameters: any },
      cb: Function
    ) => {
      let peer = peers.get(socket.id);
      if (!peer) {
        peer = {
          id: socket.id,
          name: usernames.get(socket.id) || "Anonymous",
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        };
        peers.set(socket.id, peer);
      }

      if (!peer.sendTransportId) return cb?.({ error: "No send transport" });

      const transport = peer.transports.get(peer.sendTransportId);
      if (!transport) return cb?.({ error: "Send transport not found" });

      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: { peerId: socket.id },
      });

      peer.producers.set(producer.id, producer);
      producers.set(producer.id, producer);

      socket.broadcast.emit("newProducer", {
        producerId: producer.id,
        kind: producer.kind,
        peerId: socket.id,
      });

      cb?.({ id: producer.id });
    }
  );

  // -------------------------------------------------------------
  // GET PRODUCERS FOR PEER
  // -------------------------------------------------------------
  socket.on(
    "getPeerProducers",
    ({ peerId }: { peerId: string }, callback: Function) => {
      const peer = peers.get(peerId);
      if (!peer) return callback([]);

      const list = Array.from(peer.producers.values()).map((p) => ({
        id: p.id,
        kind: p.kind,
      }));

      callback(list);
    }
  );

  // -------------------------------------------------------------
  // UPDATE STREAM STATE (duplicate handler fixed)
  // -------------------------------------------------------------
  socket.on(
    "updateStreamState",
    (data: {
      isStreaming?: boolean;
      settings?: Record<string, any>;
      platform?: string;
    }) => {
      const prev = streamStates.get(socket.id);
      if (!prev) return;

      const updated: StreamState = {
        id: socket.id,
        userId: prev.userId,
        name: prev.name,
        displayName: prev.displayName,
        platform: data.platform || prev.platform,
        settings: { ...prev.settings, ...data.settings },
        isStreaming:
          data.isStreaming !== undefined ? data.isStreaming : prev.isStreaming,
      };

      streamStates.set(socket.id, updated);

      socket.broadcast.emit("peerUpdated", updated);
      safeBroadcastPeerList();
    }
  );

  // -------------------------------------------------------------
  // RECV TRANSPORT READY
  // -------------------------------------------------------------
  socket.on(
    "recvTransportReady",
    ({ id }: { id: string }, ack?: (ok: boolean) => void) => {
      const peer = peers.get(socket.id);
      if (peer && peer.transports.has(id)) {
        peer.recvTransportId = id;
      }
      ack?.(true);
    }
  );

  // -------------------------------------------------------------
  // GET PEERS LIST
  // -------------------------------------------------------------
  socket.on("getPeersList", (cb: Function) => {
    const list = Array.from(peers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      settings: (p as any).settings || {},
    }));
    cb(list);
  });

  // -------------------------------------------------------------
  // CONSUME
  // -------------------------------------------------------------
  socket.on(
    "consume",
    async (
      {
        producerId,
        rtpCapabilities,
      }: { producerId: string; rtpCapabilities: any },
      cb: Function
    ) => {
      try {
        const peer = peers.get(socket.id);
        if (!peer) throw new Error("Peer not found");

        if (!peer.recvTransportId) throw new Error("No recv transport");

        const recvTransport = peer.transports.get(peer.recvTransportId);
        if (!recvTransport) throw new Error("Recv transport missing");

        const producerPeer = Array.from(peers.values()).find((p) =>
          p.producers.has(producerId)
        );
        if (!producerPeer) throw new Error("Producer peer not found");

        const producer = producerPeer.producers.get(producerId);
        if (!producer) throw new Error("Producer missing");

        if (!router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error("cannot consume");
        }

        const consumer = await recvTransport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });

        peer.consumers.set(consumer.id, consumer);

        cb({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          peerId: producerPeer.id,
        });

        setTimeout(() => consumer.resume(), 200);
      } catch (err) {
        const e = err as Error;
        cb({ error: e.message });
      }
    }
  );

  // -------------------------------------------------------------
  // RESUME
  // -------------------------------------------------------------
  socket.on(
    "resume",
    ({ consumerId }: { consumerId: string }, cb: Function) => {
      const peer = peers.get(socket.id);
      if (!peer) return cb?.({ error: "Peer not found" });

      const consumer = Array.from(peer.consumers.values()).find(
        (c) => c.id === consumerId
      );

      if (!consumer) return cb?.({ error: "Consumer not found" });

      consumer.resume();
      cb?.({ ok: true });
    }
  );

  // -------------------------------------------------------------
  // DISCONNECT
  // -------------------------------------------------------------
  socket.on("disconnect", (reason: string) => {
    const userId = (socket as any).userId || socket.id;

    usernames.delete(socket.id);
    streamStates.delete(socket.id);

    const peer = peers.get(socket.id);
    if (peer) {
      for (const c of peer.consumers.values()) c.close();
      for (const p of peer.producers.values()) p.close();
      for (const t of peer.transports.values()) t.close();
      peers.delete(socket.id);
    }

    emitPeerLeave(socket.id);
    broadcastPeerList();
  });
});

// -------------------------------------------------------------
const PORT = process.env.PORT || 4002;
server.listen(PORT, () =>
  console.log(`🚀 WRLD mediaserver running on port ${PORT}`)
);
