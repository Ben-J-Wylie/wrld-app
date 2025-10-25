import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { socket } from "../lib/socket";
import { MediaSoupClient } from "../lib/mediasoupClient";

export type Toggles = {
  camera: boolean;
  frontCamera: boolean;
  backCamera: boolean;
  mic: boolean;
  location: boolean;
  screenShare: boolean;
  gyro: boolean;
  torch: boolean;
  chat?: boolean;
  __live?: boolean;
};

const defaultSettings: Toggles = {
  camera: false,
  frontCamera: false,
  backCamera: false,
  mic: false,
  location: false,
  screenShare: false,
  gyro: false,
  torch: false,
  chat: false,
  __live: false,
};

function getOrCreateUserId() {
  let userId = localStorage.getItem("wrld_userId");
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("wrld_userId", userId);
  }
  return userId;
}

type BroadcastCtx = {
  settings: Toggles;
  setSettings: React.Dispatch<React.SetStateAction<Toggles>>;
  msc: MediaSoupClient;
  localStream: MediaStream | null;
};

const BroadcastContext = createContext<BroadcastCtx>({
  settings: defaultSettings,
  setSettings: () => {},
  msc: new MediaSoupClient(),
  localStream: null,
});

export const BroadcastProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [settings, setSettings] = useState<Toggles>(() => {
    const saved = localStorage.getItem("wrld_stream_settings");
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const mscRef = useRef<MediaSoupClient | null>(null);
  const isRegisteredRef = useRef(false);

  if (!mscRef.current) {
    mscRef.current = new MediaSoupClient();
  }

  // ✅ Reset screenShare on load
  useEffect(() => setSettings((p) => ({ ...p, screenShare: false })), []);

  // ✅ Persist settings locally (except screenShare)
  useEffect(() => {
    const { screenShare, ...rest } = settings;
    localStorage.setItem("wrld_stream_settings", JSON.stringify(rest));
  }, [settings]);

  // ✅ Register with server once
  useEffect(() => {
    const user =
      JSON.parse(localStorage.getItem("wrld_user") || "{}")?.username ||
      "Anonymous";
    const userId = getOrCreateUserId();

    const register = async () => {
      if (isRegisteredRef.current) return;
      isRegisteredRef.current = true;

      console.log("👤 Registering with mediaserver:", user, userId);
      await new Promise((resolve) => {
        socket.emit("register", { name: user, userId }, resolve);
      });

      console.log("✅ Registration acknowledged");

      if (!mscRef.current?.recvTransport) {
        await mscRef.current.initDevice(); // ✅ ensure device ready first
        await mscRef.current.createRecvTransport();

        console.log("📡 Created recv transport");
      }

      // sync initial state
      socket.emit("updateStreamState", {
        isStreaming: false,
        settings,
        platform: /mobile|android|iphone/.test(
          navigator.userAgent.toLowerCase()
        )
          ? "mobile"
          : "desktop",
      });
    };

    if (socket.connected) register();
    socket.once("connect", register);
    socket.once("reconnect", register);

    return () => {
      socket.off("connect", register);
      socket.off("reconnect", register);
    };
  }, []);

  // ✅ Unified streaming effect — handles localStorage + local stream
  useEffect(() => {
    if (!isRegisteredRef.current) return;

    const hasAnySourceSelected =
      settings.camera ||
      settings.frontCamera ||
      settings.backCamera ||
      settings.mic ||
      settings.screenShare ||
      settings.location ||
      settings.chat ||
      settings.gyro ||
      settings.torch;

    const isStreaming = settings.__live && hasAnySourceSelected;

    if (!hasAnySourceSelected && settings.__live) {
      setSettings((prev) => ({ ...prev, __live: false }));
      localStorage.removeItem("wrld_isLive");
    }

    const ua = navigator.userAgent.toLowerCase();
    const platform = /iphone|ipad|android|mobile|samsung|huawei|pixel/.test(ua)
      ? "mobile"
      : "desktop";

    // 🚀 Notify server
    socket.emit("updateStreamState", { isStreaming, settings, platform });

    // 💾 Keep localStorage in sync
    if (isStreaming) {
      localStorage.setItem("wrld_isLive", "true");
    } else {
      localStorage.removeItem("wrld_isLive");
    }

    // 🎥 Manage actual local media stream
    const startLocal = async () => {
      if (localStream || !mscRef.current) return;

      try {
        const constraints = {
          video: settings.camera || settings.frontCamera || settings.backCamera,
          audio: settings.mic,
        };

        if (!constraints.video && !constraints.audio) {
          console.log("⚠️ No active sources, skipping stream init");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        await mscRef.current.publishLocalStream(stream);
        console.log("📡 Published local stream", stream.getTracks());
      } catch (err) {
        console.error("❌ Error starting local stream:", err);
      }
    };

    const stopLocal = async () => {
      if (!localStream) return;
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      console.log("🛑 Stopped local stream");
    };

    if (isStreaming) startLocal();
    else stopLocal();

    console.log(`📡 Stream state → ${isStreaming ? "LIVE" : "OFFLINE"}`);
  }, [
    settings.__live,
    settings.camera,
    settings.frontCamera,
    settings.backCamera,
    settings.mic,
    settings.screenShare,
    settings.location,
    settings.chat,
    settings.gyro,
    settings.torch,
  ]);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      mscRef.current?.close();
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <BroadcastContext.Provider
      value={{
        settings,
        setSettings,
        msc: mscRef.current!,
        localStream,
      }}
    >
      {children}
    </BroadcastContext.Provider>
  );
};

export const useBroadcast = () => useContext(BroadcastContext);
