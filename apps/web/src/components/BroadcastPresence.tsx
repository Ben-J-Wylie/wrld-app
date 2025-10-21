import { useEffect } from "react";
import { useBroadcast } from "../context/BroadcastContext";
import { socket } from "../lib/socket";

export default function BroadcastPresence() {
  const { settings } = useBroadcast();

  const isStreaming =
    settings.__live &&
    (settings.frontCamera ||
      settings.backCamera ||
      settings.mic ||
      settings.screenShare ||
      settings.location ||
      settings.chat ||
      settings.gyro ||
      settings.torch);

  useEffect(() => {
    socket.emit("updateStreamState", {
      isStreaming,
      settings,
      platform: "desktop",
    });
  }, [isStreaming, settings]);

  return null;
}
