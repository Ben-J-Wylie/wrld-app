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
};

const BroadcastContext = createContext<BroadcastCtx>({
  settings: defaultSettings,
  setSettings: () => {},
  msc: new MediaSoupClient(),
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

  // ✅ persistent MediaSoupClient instance
  const mscRef = useRef<MediaSoupClient | null>(null);
  if (!mscRef.current) {
    mscRef.current = new MediaSoupClient();
  }

  // --- reset screenShare on load ---
  useEffect(() => setSettings((p) => ({ ...p, screenShare: false })), []);

  // --- persist locally (omit screenShare) ---
  useEffect(() => {
    const { screenShare, ...rest } = settings;
    localStorage.setItem("wrld_stream_settings", JSON.stringify(rest));
  }, [settings]);

  // --- single registration guard ---
  // ✅ Register once, with debouncing against reconnects
  useEffect(() => {
    const user =
      JSON.parse(localStorage.getItem("wrld_user") || "{}")?.username ||
      "Anonymous";
    const userId = getOrCreateUserId();

    let alreadyRegistered = false;

    const register = async () => {
      if (alreadyRegistered) return;
      alreadyRegistered = true;

      await safeRegister(user, userId); // ✅ wait for acknowledgment

      // ✅ now safe to send streaming state
      socket.emit("updateStreamState", {
        isStreaming: settings.__live && Object.values(settings).some(Boolean),
        settings,
        platform: /mobile|android|iphone/.test(
          navigator.userAgent.toLowerCase()
        )
          ? "mobile"
          : "desktop",
      });

      console.log("✅ Stream state sent after confirmed registration");
    };

    if (socket.connected) register();
    socket.once("connect", register);
    socket.once("reconnect", register);

    return () => {
      socket.off("connect", register);
      socket.off("reconnect", register);
    };
  }, []);

  // --- emit stream state changes ---
  useEffect(() => {
    const isStreaming =
      settings.__live && Object.values(settings).some(Boolean);

    const ua = navigator.userAgent.toLowerCase();
    const platform = /iphone|ipad|android|mobile|samsung|huawei|pixel/.test(ua)
      ? "mobile"
      : "desktop";

    if (socket.connected) {
      const isStreaming =
        settings.__live &&
        (settings.camera ||
          settings.frontCamera ||
          settings.backCamera ||
          settings.mic);

      socket.emit("updateStreamState", {
        isStreaming,
        settings,
        platform,
      });

      if (isStreaming) {
        localStorage.setItem("wrld_isLive", "true");
        localStorage.setItem("wrld_settings", JSON.stringify(settings));
      } else {
        socket.emit("updateStreamState", { isStreaming: false });
        localStorage.removeItem("wrld_isLive");
      }
    }

    console.log(
      `🔸 updateStreamState emitted (${platform})`,
      isStreaming,
      settings
    );
  }, [settings]);

  // --- cleanup ---
  useEffect(() => {
    return () => {
      mscRef.current?.close();
    };
  }, []);

  return (
    <BroadcastContext.Provider
      value={{ settings, setSettings, msc: mscRef.current! }}
    >
      {children}
    </BroadcastContext.Provider>
  );
};

export const useBroadcast = () => useContext(BroadcastContext);
