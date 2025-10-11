// apps/mediaserver/src/server.ts
import express from "express";
import fs from "fs";
import https from "https";
import { Server as SocketServer } from "socket.io";
import { createMediasoupCore } from "./mediasoup";
import { PeerManager } from "./mediasoup/peerManager";

const app = express();

const options = {
  key: fs.readFileSync("../../certs/localhost-key.pem"),
  cert: fs.readFileSync("../../certs/localhost.pem"),
};

const server = https.createServer(options, app)
const io = new SocketServer(server, { cors: { origin: "*" } });

// --- Create mediasoup worker + router ---
const { worker, router } = await createMediasoupCore();
const peers = new PeerManager(router);

app.get("/", (req, res) => {
  res.send("✅ WRLD Mediaserver is running.");
});

const activePeers = new Set<string>();

const usernames = new Map<string, string>();

function broadcastPeerList() {
  const list = Array.from(io.sockets.sockets.keys()).map((id) => ({
    id,
    name: usernames.get(id) || "Anonymous",
  }));
  io.emit("peerList", list);
  console.log("📣 Broadcasting peer list:", list);
}

io.on("connection", (socket) => {
  console.log(`🔌 [Socket] connected: ${socket.id}`);

  // --- Default entry
  usernames.set(socket.id, "Anonymous");
  broadcastPeerList();

  // --- Register username
  socket.on("register", ({ name }) => {
    const clean = (name || "").trim() || "Anonymous";
    usernames.set(socket.id, clean);
    console.log(`👤 Registered ${socket.id} as "${clean}"`);
    broadcastPeerList();
  });

  // --- Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log(`❌ Disconnected: ${socket.id} (${reason})`);
    usernames.delete(socket.id);
    broadcastPeerList();
  });

  // --- Helper: Rebuild live list directly from socket.io's state
  function broadcastPeerList() {
    const peers = [];
    for (const [id, socketInstance] of io.sockets.sockets) {
      const name = usernames.get(id) || "Anonymous";
      peers.push({ id, name });
    }
    io.emit("peerList", peers);
    console.log("📡 peerList broadcast:", peers);
  }

  // --- Mediasoup signaling (unchanged)
  socket.on("getRouterRtpCapabilities", async (_: any, cb: any) => {
    if (typeof cb === "function") cb(router.rtpCapabilities);
  });

  socket.on("createTransport", async (_: any, cb: any) => {
    try {
      const transport = await peers.createTransport(socket.id);
      if (typeof cb === "function") cb(transport.params);
    } catch (err) {
      console.error("❌ createTransport error:", err);
    }
  });

  socket.on("connectTransport", async (data: any, cb: any) => {
    try {
      await peers.connectTransport(socket.id, data.transportId, data.dtlsParameters);
      if (typeof cb === "function") cb();
    } catch (err) {
      console.error("❌ connectTransport error:", err);
    }
  });

  socket.on("produce", async (data: any, cb: any) => {
    try {
      const producer = await peers.createProducer(socket.id, data.kind, data.rtpParameters);
      socket.broadcast.emit("newProducer", { producerId: producer.id, kind: data.kind });
      if (typeof cb === "function") cb({ id: producer.id });
    } catch (err) {
      console.error("❌ produce error:", err);
    }
  });

  socket.on("consume", async (data: any, cb: any) => {
    try {
      const consumer = await peers.createConsumer(socket.id, data.producerId, data.rtpCapabilities);
      if (!consumer) return cb?.({ error: "Cannot consume" });
      cb?.({
        id: consumer.id,
        producerId: data.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      console.error("❌ consume error:", err);
    }
  });

  socket.on("resume", async (data: any, cb: any) => {
    try {
      await peers.resumeConsumer(socket.id, data.consumerId);
      cb?.();
    } catch (err) {
      console.error("❌ resume error:", err);
    }
  });
});


const PORT = process.env.PORT || 4002;
server.listen(PORT, () => console.log(`🚀 WRLD mediaserver running on port ${PORT}`));
