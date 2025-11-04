import { io } from "socket.io-client";

// 👇 Use the same base server as mediaserver, but point to the chat namespace
const MEDIASERVER_URL = import.meta.env.VITE_MEDIASERVER_URL;

// Load user info for auth payload
const wrldUser =
  JSON.parse(localStorage.getItem("wrld_user") || "{}") || { username: "Guest" };

function getOrCreateUserId() {
  let id = localStorage.getItem("wrld_userId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("wrld_userId", id);
  }
  return id;
}

const userId = getOrCreateUserId();

// ✅ Connect specifically to the /chat namespace
export const chatSocket = io(`${MEDIASERVER_URL}/chat`, {
  transports: ["websocket"],
  secure: true,
  rejectUnauthorized: false,
  auth: {
    userId,
    user: wrldUser,
  },
});

if (typeof window !== "undefined") (window as any).chatSocket = chatSocket;

chatSocket.on("connect", () => {
  console.log("💬 Connected to Chat namespace:", chatSocket.id);
});

chatSocket.on("disconnect", (reason) => {
  console.log("💬 Disconnected from Chat:", reason);
});
