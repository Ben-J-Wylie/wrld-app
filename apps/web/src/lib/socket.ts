import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

//const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const MEDIASERVER_URL = import.meta.env.VITE_MEDIASERVER_URL;

function getOrCreateUserId() {
  let id = localStorage.getItem("wrld_userId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("wrld_userId", id);
  }
  return id;
}

const userId = getOrCreateUserId();

export const socket = io(MEDIASERVER_URL, {
  transports: ["websocket"],
  secure: true,
  rejectUnauthorized: false,
  auth: { userId }, // ✅ MUST be here before connection starts
});

if (typeof window !== "undefined") (window as any).socket = socket;

socket.on("connect", () => {
  const user = JSON.parse(localStorage.getItem("wrld_user") || "{}");
  const settings = JSON.parse(localStorage.getItem("wrld_settings") || "{}");
  const wasLive = localStorage.getItem("wrld_isLive") === "true";

  console.log("👤 Sending register with stable userId:", {
    username: user.username,
    userId,
  });
  socket.emit("register", { name: user.username, userId });

  if (wasLive) {
    console.log("♻️ Restoring live state after reconnect");
    socket.emit("updateStreamState", {
      isStreaming: true,
      settings,
      platform: "desktop",
    });
  }
});

socket.on("resyncStreamState", () => {
  console.log("🔁 Server requested stream state re-sync");
  const settings = JSON.parse(localStorage.getItem("wrld_settings") || "{}");
  const isStreaming = localStorage.getItem("wrld_isLive") === "true";

  socket.emit("updateStreamState", {
    isStreaming,
    settings,
    platform: /mobile|android|iphone/.test(navigator.userAgent.toLowerCase())
      ? "mobile"
      : "desktop",
  });
});

socket.on("peerDelta", (data) => {
  switch (data.type) {
    case "join":
      console.log("🟢 New peer joined:", data.peer);
      // add to state
      break;
    case "update":
      console.log("🟡 Peer updated:", data.peer);
      // merge update into existing state
      break;
    case "leave":
      console.log("🔴 Peer left:", data.id);
      // remove from state
      break;
  }
});

export async function registerAndWait(
  socket: Socket,
  username: string,
  userId: string
) {
  return new Promise<void>((resolve) => {
    console.log("👤 Sending register with stable userId:", {
      username,
      userId,
    });

    socket.emit("register", { name: username, userId }, (res: any) => {
      if (res?.ok) {
        console.log("✅ Registration acknowledged by server");
      } else {
        console.warn("⚠️ Registration not acknowledged:", res);
      }
      resolve();
    });

    setTimeout(() => {
      console.warn("⏳ Registration timed out, continuing anyway");
      resolve();
    }, 2000);
  });
}

export async function safeRegister(username: string, userId: string) {
  return new Promise<void>((resolve) => {
    console.log("👤 Sending register with stable userId:", {
      username,
      userId,
    });
    socket.emit("register", { name: username, userId }, (res: any) => {
      if (res?.ok) {
        console.log("✅ Registration acknowledged by server");
      } else {
        console.warn("⚠️ Registration not acknowledged:", res);
      }
      resolve();
    });
  });
}
