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

io.on("connection", (socket) => {
  console.log(`🔌 [Socket] connected: ${socket.id}`);
  activePeers.add(socket.id);
  io.emit("peerList", Array.from(activePeers));

  // --- Router capabilities ---
  socket.on("getRouterRtpCapabilities", async (_: any, cb: any) => {
    if (typeof cb === "function") cb(router.rtpCapabilities);
    else socket.emit("routerRtpCapabilities", router.rtpCapabilities);
  });

  // --- Create WebRTC transport ---
  socket.on("createTransport", async (_: any, cb: any) => {
    try {
      const transport = await peers.createTransport(socket.id);
      if (typeof cb === "function") cb(transport.params);
      else socket.emit("transportCreated", transport.params);
    } catch (err) {
      console.error("❌ createTransport error:", err);
    }
  });

  // --- Connect transport ---
  socket.on("connectTransport", async (data: any, cb: any) => {
    try {
      await peers.connectTransport(socket.id, data.transportId, data.dtlsParameters);
      if (typeof cb === "function") cb();
    } catch (err) {
      console.error("❌ connectTransport error:", err);
    }
  });

  // --- Produce (publish) ---
  socket.on("produce", async (data: any, cb: any) => {
    try {
      const producer = await peers.createProducer(socket.id, data.kind, data.rtpParameters);
      socket.broadcast.emit("newProducer", { producerId: producer.id, kind: data.kind });
      if (typeof cb === "function") cb({ id: producer.id });
    } catch (err) {
      console.error("❌ produce error:", err);
    }
  });

  // --- Consume (view) ---
  socket.on("consume", async (data: any, cb: any) => {
    try {
      const consumer = await peers.createConsumer(socket.id, data.producerId, data.rtpCapabilities);
      if (!consumer) {
        if (typeof cb === "function") cb({ error: "Cannot consume" });
        return;
      }
      const payload = {
        id: consumer.id,
        producerId: data.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
      if (typeof cb === "function") cb(payload);
      else socket.emit("consumerCreated", payload);
    } catch (err) {
      console.error("❌ consume error:", err);
    }
  });

  // --- Resume consumer ---
  socket.on("resume", async (data: any, cb: any) => {
    try {
      await peers.resumeConsumer(socket.id, data.consumerId);
      if (typeof cb === "function") cb();
    } catch (err) {
      console.error("❌ resume error:", err);
    }
  });

  // --- Disconnect ---
  socket.on("disconnect", () => {
    console.log(`❌ [Socket] disconnected: ${socket.id}`);
    peers.removePeer(socket.id);
    activePeers.delete(socket.id);
    io.emit("peerList", Array.from(activePeers));
  });
});


const PORT = process.env.PORT || 4002;
server.listen(PORT, () => console.log(`🚀 WRLD mediaserver running on port ${PORT}`));
