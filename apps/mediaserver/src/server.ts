// apps/mediaserver/src/server.ts
import express from "express";
import fs from "fs";
import https from "https";
import { Server as SocketServer } from "socket.io";
import { createMediasoupCore } from "./mediasoup";
import type { WebRtcTransport, Producer, Consumer } from "mediasoup/node/lib/types";
import path from "path";
import { wireChat } from "./chat";

const app = express();

const options = {
  key: fs.readFileSync("../../certs/localhost-key.pem"),
  cert: fs.readFileSync("../../certs/localhost.pem"),
};

const PUBLIC_IP = process.env.PUBLIC_IP || "10.0.0.84";
const DATA_PATH = path.resolve("./src/data/known-users.json");

const server = https.createServer(options, app);
const io = new SocketServer(server, { cors: { origin: "*" } });

const { worker, router } = await createMediasoupCore();

wireChat(io, { namespace: "/chat" });

type Peer = {
  id: string;
  name: string;
  transports: Map<string, WebRtcTransport>;
  sendTransportId?: string;
  recvTransportId?: string;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  settings?: Record<string, any>;
  platform?: string;
  isStreaming?: boolean; // ✅ NEW
};

// Global state
const peers = new Map<string, Peer>();                 // socket.id -> peer
const usernames = new Map<string, string>();           // socket.id -> username
const transports = new Map<string, WebRtcTransport>(); // transport.id -> transport
const producers = new Map<string, Producer>();         // producer.id -> producer
const consumers = new Map<string, Consumer>();         // consumer.id -> consumer
const knownUsers = new Map<string, string>(); 
//loadKnownUsers();
const streamStates = new Map<
  string,
  {
    id: string;
    name: string;
    displayName: string;
    userId: string;
    isStreaming: boolean;
    settings: Record<string, any>;
    platform: string;
  }
>()

app.get("/", (_req, res) => res.send("✅ WRLD Mediaserver is running."));

function getDisplayName(socketId: string): string {
  const name = usernames.get(socketId);
  if (name && name.trim() !== "") return name;
  const peer = peers.get(socketId);
  if (peer?.name && peer.name.trim() !== "") return peer.name;
  const stream = streamStates.get(socketId);
  if (stream?.name && stream.name.trim() !== "") return stream.name;
  return "Anonymous";
}

function broadcastPeerList() {
  const seenUsers = new Set<string>();
  const list: any[] = [];

  for (const [socketId, s] of io.sockets.sockets) {
    const userId = (s as any).userId || socketId;
    if (seenUsers.has(userId)) continue;
    seenUsers.add(userId);

    const state = streamStates.get(socketId);
    const isStreaming = !!state?.isStreaming;
    if (!isStreaming) continue; // 👈 skip offline users

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
  console.log("📡 peersList broadcast:", list.map((p) => p.displayName).join(", "));
}




let broadcastTimer: NodeJS.Timeout | null = null;
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

// --- Incremental Peer Broadcasting Helpers ---
function emitPeerJoin(peerId: string) {
  const stream = streamStates.get(peerId);
  if (!stream) return;

  io.emit("peerDelta", {
    type: "join",
    peer: {
      id: peerId,
      displayName:
        usernames.get(peerId) ||
        stream.name ||
        peers.get(peerId)?.name ||
        "Anonymous",
      platform: stream.platform || "desktop",
      settings: stream.settings || {},
      isStreaming: stream.isStreaming,
    },
  });
  console.log(`🟢 peerDelta: join -> ${stream.name || "Anonymous"}`);
}

function emitPeerUpdate(peerId: string) {
  const stream = streamStates.get(peerId);
  if (!stream) return;

  io.emit("peerDelta", {
    type: "update",
    peer: {
      id: peerId,
      displayName:
        usernames.get(peerId) ||
        stream.name ||
        peers.get(peerId)?.name ||
        "Anonymous",
      platform: stream.platform || "desktop",
      settings: stream.settings || {},
      isStreaming: stream.isStreaming,
    },
  });
  console.log(`🟡 peerDelta: update -> ${stream.name || "Anonymous"}`);
}

function emitPeerLeave(peerId: string) {
  io.emit("peerDelta", {
    type: "leave",
    id: peerId,
  });
  console.log(`🔴 peerDelta: leave -> ${peerId}`);
}


function loadKnownUsers() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        knownUsers.set(k, v as string);
      }
      console.log(`💾 Loaded ${knownUsers.size} known users`);
    } else {
      console.log("💾 known-users.json not found, starting fresh");
    }
  } catch (err) {
    console.error("❌ Failed to load known users:", err);
  }
}

function saveKnownUsers() {
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of knownUsers.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2));
    console.log("💾 known-users.json updated");
  } catch (err) {
    console.error("❌ Failed to save known users:", err);
  }
}


io.on("connection", (socket) => {
  console.log(`🔌 [Socket] connected: ${socket.id}`);

  const userId =
    (socket.handshake.auth?.userId ||
      socket.handshake.query?.userId ||
      null) as string | null;

  if (userId && knownUsers.has(userId)) {
    const restoredName = knownUsers.get(userId)!;
    usernames.set(socket.id, restoredName);
    (socket as any).userId = userId;
    console.log(`♻️ Restored username "${restoredName}" for ${socket.id}`);
  } else {
    usernames.set(socket.id, "Anonymous");
    console.log(`⚠️ No known userId for ${socket.id}, defaulting to Anonymous`);
  }

  // Don’t broadcast yet; wait for register
  setTimeout(() => {
    safeBroadcastPeerList();
  }, 500);

  // --- REGISTER ---

  socket.on("register", ({ name, userId }, cb) => {
    const clean = (name || "").trim() || "Anonymous";
    const stableId = userId || socket.id;
    console.log("📝 REGISTER RECEIVED:", { clean, stableId, socketId: socket.id });

    // 🧹 Find and remove any *previous* socket for this same userId
    for (const [id, s] of io.sockets.sockets.entries()) {
      if ((s as any).userId === stableId && id !== socket.id) {
        console.log(`♻️ Removing old socket for ${clean} (${stableId}): ${id}`);
        try {
          s.disconnect(true);
        } catch {}
        peers.delete(id);
      }
    }

    // 🧹 Remove stale entries in streamStates by userId
    for (const [key, val] of streamStates.entries()) {
      if (val.userId === stableId && val.id !== socket.id) {
        console.log(`🧹 Removing stale streamState for ${clean} (${stableId})`);
        streamStates.delete(key);
      }
    }

    // ✅ Save the new identity and socket reference
    usernames.set(socket.id, clean);
    (socket as any).userId = stableId;

    // ✅ Create peer record
    const peer = {
      id: socket.id,
      name: clean,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      userId: stableId,
      settings: {},
      platform: "desktop",
      isStreaming: false, // ✅ NEW default
    };
    peers.set(socket.id, peer);

    // ✅ Restore old stream state if it existed, else create fresh
    const prev = Array.from(streamStates.values()).find(
      (s) => s.userId === stableId
    );

    const newState = {
      id: socket.id,
      userId: stableId,
      name: clean,
      displayName: clean,
      isStreaming: prev?.isStreaming || false,
      settings: prev?.settings || {},
      platform: prev?.platform || "desktop",
    };

    streamStates.set(socket.id, newState);

    console.log(`👤 Registered ${clean} [socket: ${socket.id}, userId: ${stableId}]`);

    // 🟢 Emit peer join/update
    emitPeerJoin(socket.id);
    cb?.({ ok: true });
    broadcastPeerList();
    socket.emit("resyncStreamState");
  });







  // apps/mediaserver/src/server.ts
  socket.on("createRecvTransport", async (_, cb) => {
    let peer = peers.get(socket.id);
    if (!peer) {
      console.warn("⚠️ createRecvTransport called before register — creating peer entry.");
      peer = {
        id: socket.id,
        name: "Anonymous",
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };
      peers.set(socket.id, peer);
    }

    // 🔒 Avoid creating multiple recv transports
    if (peer.recvTransportId && peer.transports.has(peer.recvTransportId)) {
      const existing = peer.transports.get(peer.recvTransportId)!;
      console.log(`ℹ️ Reusing existing recv transport for ${socket.id}: ${existing.id}`);
      return cb({
        id: existing.id,
        iceParameters: existing.iceParameters,
        iceCandidates: existing.iceCandidates,
        dtlsParameters: existing.dtlsParameters,
      });
    }

    const routerIp = PUBLIC_IP || "127.0.0.1";
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: routerIp }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    peer.transports.set(transport.id, transport);
    peer.recvTransportId = transport.id;

    socket.emit("recvTransportReady", { id: transport.id });

    console.log(`🚚 Created recv transport for ${socket.id}: ${transport.id}`);

    cb({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });



  socket.on("updateStreamState", ({ isStreaming, settings, platform }) => {
    const peer = peers.get(socket.id);
    if (!peer) return;

    peer.isStreaming = !!isStreaming;
    peer.settings = settings;
    peer.platform = platform;

    // ✅ Update streamStates to reflect this peer's current live status
    streamStates.set(socket.id, {
      id: socket.id,
      userId: (socket as any).userId || socket.id,
      name: peer.name,
      displayName: peer.name,
      isStreaming: !!isStreaming,
      settings,
      platform: platform || "desktop",
    });

    console.log(
      `📡 ${peer.name || socket.id} is now ${
        isStreaming ? "LIVE" : "OFFLINE"
      } [${platform}]`
    );

    // ✅ Tell all clients this peer changed
    socket.broadcast.emit("peerUpdated", {
      id: socket.id,
      name: peer.name,
      settings,
      isStreaming,
    });

    // ✅ Rebroadcast full peer list (will now include only live users)
    broadcastPeerList();
  });





  // --- RTP Capabilities ---
  socket.on("getRouterRtpCapabilities", (_: any, cb: any) => {
    // Copy router capabilities
    const caps = JSON.parse(JSON.stringify(router.rtpCapabilities));

    // ✅ Keep only lightweight, mobile-friendly codecs
    caps.codecs = caps.codecs.filter((c) =>
      c.mimeType === "audio/opus" || c.mimeType === "video/VP8"
    );

    // Optional: remove RTX (redundant retransmission) codecs to reduce load
    caps.codecs = caps.codecs.filter((c) => !c.mimeType.includes("rtx"));

    // Optional: trim extensions (optional)
    caps.headerExtensions = caps.headerExtensions.filter((ext) =>
      [
        "urn:3gpp:video-orientation",
        "urn:ietf:params:rtp-hdrext:sdes:mid",
        "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
      ].includes(ext.uri)
    );

    console.log(
      "📦 Sending trimmed router capabilities:",
      caps.codecs.map((c) => c.mimeType)
    );

    cb?.(caps);
  });

  // --- CREATE TRANSPORT (client must send direction: "send" | "recv") ---
  // apps/mediaserver/src/server.ts
  socket.on("createTransport", async ({ direction }, cb) => {
    try {
      // ✅ Ensure peer exists
      let peer = peers.get(socket.id);
      if (!peer) {
        console.warn(`⚠️ [createTransport] No peer found for ${socket.id}, creating one`);
        peer = {
          id: socket.id,
          name: usernames.get(socket.id) || "Anonymous",
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        };
        peers.set(socket.id, peer);
      }

      // ✅ Create WebRTC transport
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: PUBLIC_IP }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1_000_000,
      });

      // ✅ Register the transport on the peer before responding
      peer.transports.set(transport.id, transport);

      if (direction === "send") peer.sendTransportId = transport.id;
      else peer.recvTransportId = transport.id;

      console.log(
        `✅ [createTransport] ${direction} transport created for ${socket.id}: ${transport.id}`
      );
      console.log(
        `📦 Peer ${socket.id} transports now:`,
        [...peer.transports.keys()]
      );

      cb({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err: any) {
      console.error("❌ [createTransport] failed:", err);
      cb({ error: err.message });
    }
  });



  // --- CONNECT TRANSPORT ---
  socket.on("connectTransport", async ({ transportId, dtlsParameters }, cb) => {
    const peer = peers.get(socket.id);
    if (!peer) {
      console.error(`❌ [connectTransport] Peer not found for ${socket.id}`);
      return cb({ error: "Peer not found" });
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      console.error(
        `❌ [connectTransport] Transport not found for ${transportId} (peer ${socket.id})`
      );
      console.log("Known transports:", [...peer.transports.keys()]);
      return cb({ error: "Transport not found" });
    }

    await transport.connect({ dtlsParameters });
    console.log(`🔗 [connectTransport] Transport ${transportId} connected for ${socket.id}`);
    cb({ ok: true });
  });

  socket.on("join", ({ name }, cb) => {
    peers.set(socket.id, {
      id: socket.id,
      name,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    });
    usernames.set(socket.id, name);
    console.log(`👋 ${name} joined as ${socket.id}`);
    cb?.({ ok: true });
  });


  // --- PRODUCE ---
  socket.on("produce", async ({ kind, rtpParameters }, cb) => {
    const peer = peers.get(socket.id);
    if (!peer) {
      console.error(`❌ Cannot produce — no peer found for ${socket.id}`);
      return cb?.({ error: "Peer not registered" });
    }

    const currentPeer = peers.get(socket.id)!;

    if (!currentPeer.sendTransportId) return cb?.({ error: "No send transport" });
    const sendTransport = currentPeer.transports.get(currentPeer.sendTransportId!);
    if (!sendTransport) return cb?.({ error: "Send transport not found" });

    const producer = await sendTransport.produce({
      kind,
      rtpParameters,
      appData: { peerId: socket.id },
    });

    // ✅ Track producers locally and globally
    currentPeer.producers.set(producer.id, producer);
    producers.set(producer.id, producer);
    
    console.log(`📡 New ${kind} producer from ${socket.id}: ${producer.id}`);

    // ✅ Notify others immediately
    socket.broadcast.emit("newProducer", {
      producerId: producer.id,
      kind: producer.kind,
      peerId: socket.id,
    });

    // ✅ Confirm back to client
    cb?.({ id: producer.id });
  });


  // --- LIST PRODUCERS FOR A PEER (payload: { peerId }) ---
  socket.on("getPeerProducers", ({ peerId }, cb) => {
    const targetPeer = peers.get(peerId);
    if (!targetPeer) {
      console.warn(`⚠️ No peer found for getPeerProducers(${peerId})`);
      return cb([]);
    }

    const producers = Array.from(targetPeer.producers.values()).map((p) => ({
      id: p.id,
      kind: p.kind,
    }));

    console.log(`📡 Returning ${producers.length} producers for ${peerId}`);
    cb(producers);
  });

  socket.on("debugListProducers", () => {
    const all = [];
    for (const [id, peer] of peers) {
      all.push({
        id,
        producers: Array.from(peer.producers.keys()),
      });
    }
    console.log("🔍 Producers summary:", all);
  });

  socket.on("debugTransports", () => {
    const peer = peers.get(socket.id);
    if (peer) {
      console.log({
        id: socket.id,
        transports: [...peer.transports.keys()],
        recvTransportId: peer.recvTransportId,
      });
    }
  });



  socket.on("recvTransportReady", ({ id }, ack) => {
    const peer = peers.get(socket.id);
    if (peer && peer.transports.has(id)) {
      peer.recvTransportId = id;
      console.log(`✅ Recv transport ready for ${socket.id}: ${id}`);
    } else {
      console.warn(`⚠️ recvTransportReady: transport not found for ${socket.id}`);
    }
    if (ack) ack(true);
  });

  socket.on("updateSettings", (settings) => {
    const peer = peers.get(socket.id);
    if (!peer) return;
    peer.settings = settings;
    socket.broadcast.emit("peerSettingsUpdated", { peerId: socket.id, settings });
  });

  socket.on("getPeersList", (cb) => {
    const list = Array.from(peers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      settings: p.settings || {},
    }));
    cb(list);
  });

  socket.on("pingRecvTransport", (_, cb) => {
    const peer = peers.get(socket.id);
    if (!peer || !peer.recvTransportId) return cb({ error: "no recv transport" });
    cb({ ok: true });
  });
    
  // --- CONSUME ---
  socket.on("consume", async ({ producerId, rtpCapabilities }, cb) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) throw new Error("Peer not found");

      // 1️⃣ Ensure a recv transport exists
      let recvTransport: WebRtcTransport | undefined;
      if (peer.recvTransportId) {
        recvTransport = peer.transports.get(peer.recvTransportId);
      }
      if (!recvTransport) {
        console.warn(`⚠️ No recv transport found for ${socket.id} — creating fallback one`);
        const newTransport = await router.createWebRtcTransport({
          listenIps: [{ ip: "0.0.0.0", announcedIp: PUBLIC_IP }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
        });
        peer.transports.set(newTransport.id, newTransport);
        peer.recvTransportId = newTransport.id;
        recvTransport = newTransport;
      }

      // 2️⃣ Locate the peer that owns this producer
      const producerPeer = Array.from(peers.values()).find((p) =>
        p.producers.has(producerId)
      );
      if (!producerPeer) throw new Error("Producer peer not found");

      const producer = producerPeer.producers.get(producerId);
      if (!producer) throw new Error("Producer not found");

      const targetPeerId = producerPeer.id; // ✅ define this properly

      // 3️⃣ Check router compatibility
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error("Cannot consume");
      }

      // 4️⃣ Create the consumer
      const consumer = await recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // resume later
      });

      peer.consumers.set(consumer.id, consumer);

      // 5️⃣ Clean the MID for browser compatibility
      if (consumer.rtpParameters.mid) {
        consumer.rtpParameters.mid = String(consumer.rtpParameters.mid).slice(0, 12);
      } else {
        consumer.rtpParameters.mid = `${consumer.kind}-${consumer.id.slice(0, 6)}`;
      }
      if (consumer.rtpParameters.mid.length > 16) {
        consumer.rtpParameters.mid = consumer.rtpParameters.mid.slice(0, 16);
      }

      // 6️⃣ Send parameters back to the client
      cb({
        id: consumer.id,
        producerId,
        kind: producer.kind,
        rtpParameters: consumer.rtpParameters,
        peerId: targetPeerId, // ✅ now valid
      });

      // 7️⃣ Resume consumer shortly after creation
      setTimeout(async () => {
        try {
          await consumer.resume();
          console.log(`▶️ Resumed consumer ${consumer.id}`);
        } catch (err) {
          console.warn("⚠️ Failed to resume consumer:", err);
        }
      }, 200);

      console.log(
        `📦 Consumer ${consumer.kind} created for peer ${socket.id} from producer ${producerPeer.id}`
      );
    } catch (err: any) {
      console.error("❌ consume error:", err);
      cb({ error: err.message });
    }
  });



  // --- RESUME (client may call, but we already resume above) ---
  socket.on("resume", async ({ consumerId }, cb) => {
    try {
      const peer = peers.get(socket.id);
      if (!peer) return cb?.({ error: "Peer not found" });

      const consumer = Array.from(peer.consumers.values()).find(
        (c) => c.id === consumerId
      );

      if (!consumer) return cb?.({ error: "Consumer not found" });

      await consumer.resume();
      console.log(`▶️ Resumed consumer ${consumer.id}`);
      cb?.({ ok: true });
    } catch (err) {
      console.error("❌ Error resuming consumer:", err);
      cb?.({ error: err.message });
    }
  });

  socket.on("resumeConsumer", async ({ consumerId }) => {
    const consumer = Array.from(peers.values())
      .flatMap((p) => Array.from(p.consumers.values()))
      .find((c) => c.id === consumerId);

    if (consumer) {
      await consumer.resume();
      console.log(`▶️ Resumed consumer ${consumerId}`);
    }
  });

  // --- DISCONNECT CLEANUP ---
  socket.on("disconnect", (reason) => {
    const userId = (socket as any).userId || socket.id;
    console.log(`❌ Disconnected: ${socket.id} (userId: ${userId}, reason: ${reason})`);

    // Remove this socket’s live references
    usernames.delete(socket.id);
    peers.delete(socket.id);
    streamStates.delete(socket.id);

    // 🧹 Clean mediasoup resources for this peer
    const peer = peers.get(socket.id);
    if (peer) {
      for (const c of peer.consumers.values()) try { c.close(); } catch {}
      for (const p of peer.producers.values()) try { p.close(); } catch {}
      for (const t of peer.transports.values()) try { t.close(); } catch {}
      peers.delete(socket.id);
    }

  // 🚨 Notify others instantly
  emitPeerLeave(socket.id);
  broadcastPeerList();

  console.log(`🔴 User ${userId} fully disconnected and removed`);
});




  socket.on("connect_error", (err) => {
    console.error("Socket connect_error:", err.message, err);
  });

});

const PORT = process.env.PORT || 4002;
server.listen(PORT, () => console.log(`🚀 WRLD mediaserver running on port ${PORT}`));
