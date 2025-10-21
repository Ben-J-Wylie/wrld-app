import "dotenv/config";
import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import cors from "cors";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import { authRouter } from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import profileRouter from "./routes/profile.js";
import uploadRouter from "./routes/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

// 🧩 Environment
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://10.0.0.84:5173";
const SSL_KEY = process.env.SSL_KEY || "10.0.0.84-key.pem";
const SSL_CERT = process.env.SSL_CERT || "10.0.0.84.pem";

// ======================================================
//  Shared presence state
// ======================================================
const usernames = new Map<string, string>(); // socket.id → username

interface StreamState {
  isStreaming: boolean;
  settings?: any;
  platform?: string;
  username?: string;
}

const streamStates = new Map<string, StreamState>(); // socket.id → stream info

// ======================================================
//  Presence tracking
// ======================================================
interface Presence {
  userId: string;
  username: string;
  online: boolean;
  isStreaming: boolean;
  lastSeen: number;
  platform?: string;
}

const presence = new Map<string, Presence>(); // userId -> presence
const socketUser = new Map<string, string>(); // socket.id -> userId

// ✅ CORS before routes
app.use(
  cors({
    origin: [FRONTEND_ORIGIN],
    credentials: true,
  })
);

// ✅ Body parser
app.use(express.json());

// ✅ Serve static uploads
app.use("/uploads", express.static(path.resolve("./uploads")));

// ✅ Routes
app.use("/api/users", usersRouter);
app.use("/api", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/upload", uploadRouter);

// ✅ Root endpoint
app.get("/", (req, res) => {
  res.json({ message: "Welcome to WRLD API" });
});

// ======================================================
//  HTTPS + Socket.IO Setup
// ======================================================
let options: any = {};
try {
  const certPath = path.resolve(__dirname, "../../../certs");
  options = {
    key: fs.readFileSync(`${certPath}/${SSL_KEY}`),
    cert: fs.readFileSync(`${certPath}/${SSL_CERT}`),
  };
} catch (err) {
  console.warn("⚠️  HTTPS certs not found, will use HTTP fallback");
}

// ======================================================
//  Broadcast helper
// ======================================================
function broadcastPeerList(io: Server) {
  const list = Array.from(presence.values())
    .filter((p) => p.isStreaming)
    .map((p) => ({
      id: p.userId,
      displayName: p.username,
      platform: p.platform || "web",
    }));
  io.emit("peersList", list);
  console.log("📡 peersList broadcast:", list.length, "live users");
}

function getOnlineUsers() {
  return Array.from(presence.entries()).map(([id, p]) => ({
    id,
    username: p.username,
    online: p.online,
    isStreaming: p.isStreaming,
    platform: p.platform || "desktop",
  }));
}

function broadcastPresence(io: Server) {
  const list = Array.from(presence.entries()).map(([id, p]) => ({
    id,
    username: p.username,
    online: p.online,
    isStreaming: !!streamStates.get(id)?.isStreaming,
  }));
  io.emit("onlineUsers", list);
}


// ======================================================
//  HTTPS server (preferred)
// ======================================================
if (options.key && options.cert) {
  const httpsServer = https.createServer(options, app);

  const io = new Server(httpsServer, {
    cors: {
      origin: [FRONTEND_ORIGIN],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [Socket.IO] Connected: ${socket.id}`);

    // Default username
    usernames.set(socket.id, "Anonymous");

    // 👤 Allow client to register username
    socket.on("register", ({ id, name, platform }) => {
      const userId = id;
      const username = name || "Anonymous";
      socketUser.set(socket.id, userId);

      // Check if user had previous presence (from before refresh)
      const prev = presence.get(userId);
      const wasStreaming = prev?.isStreaming || false;

      // Restore previous streaming state if applicable
      if (wasStreaming) {
        console.log(`🔁 Restoring stream for ${username}`);
        streamStates.set(socket.id, {
          isStreaming: true,
          settings: prev?.settings,
          platform: platform || prev?.platform || "web",
          username,
        });
      }

      // Update presence
      presence.set(userId, {
        userId,
        username,
        online: true,
        isStreaming: wasStreaming,
        lastSeen: Date.now(),
        platform: platform || "web",
      });

      console.log(`👤 Registered ${username} (${userId}) [wasStreaming=${wasStreaming}]`);

      broadcastPresence(io);
      broadcastPeerList(io);
    });


    // 🔴 Stream state updates
    socket.on("updateStreamState", ({ isStreaming, settings, platform }) => {
      const userId = socketUser.get(socket.id);
      if (!userId) return;

      const username = presence.get(userId)?.username || "Anonymous";

      // Update stream state
      streamStates.set(socket.id, {
        isStreaming,
        settings,
        platform,
        username,
      });

      // Update presence record
      const pres = presence.get(userId);
      if (pres) {
        pres.isStreaming = !!isStreaming;
        pres.platform = platform || pres.platform;
        pres.lastSeen = Date.now();
        presence.set(userId, pres);
      }

      console.log(`📶 ${username} (${userId}) streaming=${isStreaming}`);
      broadcastPeerList(io);
      broadcastPresence(io);
    });

    // 🔸 Manual request for peers
    socket.on("getPeersList", (cb) => {
      const list = Array.from(streamStates.entries())
        .filter(([_, v]) => v.isStreaming)
        .map(([id, v]) => ({
          id,
          displayName: v.username || usernames.get(id) || "Anonymous",
          platform: v.platform || "desktop",
        }));
      cb?.(list);
    });

    // 🧹 Disconnect cleanup
    socket.on("disconnect", () => {
      const userId = socketUser.get(socket.id);
      if (!userId) return;

      const pres = presence.get(userId);
      if (pres) {
        pres.online = false;
        pres.isStreaming = false;
        pres.lastSeen = Date.now();
        presence.set(userId, pres);
      }

      socketUser.delete(socket.id);
      streamStates.delete(socket.id);

      broadcastPresence(io);
      broadcastPeerList(io);
    });

  });

  httpsServer.listen(PORT, () => {
    console.log(`✅ Secure API + Socket.IO running on https://10.0.0.84:${PORT}`);
    console.log(`   Allowed Origin: ${FRONTEND_ORIGIN}`);
  });
} else {
  // ======================================================
  //  HTTP fallback (no SSL)
  // ======================================================
  const http = await import("http");
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: [FRONTEND_ORIGIN],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [Socket.IO] Connected (HTTP): ${socket.id}`);
    usernames.set(socket.id, "Anonymous");

    socket.on("register", ({ id, name, platform }) => {
      const userId = id;
      const username = name || "Anonymous";
      socketUser.set(socket.id, userId);

      // Check if user had previous presence (from before refresh)
      const prev = presence.get(userId);
      const wasStreaming = prev?.isStreaming || false;

      // Restore previous streaming state if applicable
      if (wasStreaming) {
        console.log(`🔁 Restoring stream for ${username}`);
        streamStates.set(socket.id, {
          isStreaming: true,
          settings: prev?.settings,
          platform: platform || prev?.platform || "web",
          username,
        });
      }

      // Update presence
      presence.set(userId, {
        userId,
        username,
        online: true,
        isStreaming: wasStreaming,
        lastSeen: Date.now(),
        platform: platform || "web",
      });

      console.log(`👤 Registered ${username} (${userId}) [wasStreaming=${wasStreaming}]`);

      broadcastPresence(io);
      broadcastPeerList(io);
    });



    socket.on("updateStreamState", ({ isStreaming, settings, platform }) => {
      const userId = socketUser.get(socket.id);
      if (!userId) return;

      const username = presence.get(userId)?.username || "Anonymous";

      // Update stream state
      streamStates.set(socket.id, {
        isStreaming,
        settings,
        platform,
        username,
      });

      // Update presence record
      const pres = presence.get(userId);
      if (pres) {
        pres.isStreaming = !!isStreaming;
        pres.platform = platform || pres.platform;
        pres.lastSeen = Date.now();
        presence.set(userId, pres);
      }

      console.log(`📶 ${username} (${userId}) streaming=${isStreaming}`);
      broadcastPeerList(io);
      broadcastPresence(io);
    });

    socket.on("getPeersList", (cb) => {
      const list = Array.from(streamStates.entries())
        .filter(([_, v]) => v.isStreaming)
        .map(([id, v]) => ({
          id,
          displayName: v.username || usernames.get(id) || "Anonymous",
          platform: v.platform || "desktop",
        }));
      cb?.(list);
    });

    socket.on("disconnect", () => {
      const userId = socketUser.get(socket.id);
      if (!userId) return;

      const pres = presence.get(userId);
      if (pres) {
        pres.online = false;
        pres.isStreaming = false;
        pres.lastSeen = Date.now();
        presence.set(userId, pres);
      }

      socketUser.delete(socket.id);
      streamStates.delete(socket.id);

      broadcastPresence(io);
      broadcastPeerList(io);
    });

  });

  httpServer.listen(PORT, () => {
    console.log(`✅ API + Socket.IO running on http://10.0.0.84:${PORT}`);
    console.log(`   Allowed Origin: ${FRONTEND_ORIGIN}`);
  });
}
