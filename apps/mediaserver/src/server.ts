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

  // Send updated peer list to everyone
  io.emit("peerList", Array.from(activePeers));

  // Send router capabilities to client
  socket.on("getRouterRtpCapabilities", (cb) => {
    cb(router.rtpCapabilities);
  });

  // Create a WebRTC transport
  socket.on("createTransport", async (cb) => {
    const transport = await peers.createTransport(socket.id);
    cb(transport.params);
  });

  // Connect the transport
  socket.on("connectTransport", async ({ transportId, dtlsParameters }, cb) => {
    await peers.connectTransport(socket.id, transportId, dtlsParameters);
    cb();
  });

  // Produce (publish) a track
  socket.on("produce", async ({ kind, rtpParameters }, cb) => {
    const producer = await peers.createProducer(socket.id, kind, rtpParameters);
    socket.broadcast.emit("newProducer", { producerId: producer.id, kind });
    cb({ id: producer.id });
  });

  // Consume (view) a producer
  socket.on("consume", async ({ producerId, rtpCapabilities }, cb) => {
    const consumer = await peers.createConsumer(socket.id, producerId, rtpCapabilities);
    if (!consumer) return cb({ error: "Cannot consume" });
    cb({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  });

  socket.on("resume", async ({ consumerId }) => {
    await peers.resumeConsumer(socket.id, consumerId);
  });

  socket.on("disconnect", () => {
    console.log(`❌ [Socket] disconnected: ${socket.id}`);
    peers.removePeer(socket.id);
    activePeers.delete(socket.id);
    io.emit("peerList", Array.from(activePeers));
  });
});

const PORT = process.env.PORT || 4002;
server.listen(PORT, () => console.log(`🚀 WRLD mediaserver running on port ${PORT}`));
