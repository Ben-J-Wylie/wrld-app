import { StreamingCapability } from "../../../CoreStream/StreamingCapability";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

let displayStream: MediaStream | null = null;

export function ScreenFeedCapability(
  msc: MediaSoupClient
): StreamingCapability {
  return {
    key: "screenShare",
    label: "Screen Share",

    onEnable: async () => {
      try {
        console.log("🖥 ScreenShareCapability: requesting display media…");

        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 30 } },
          audio: false,
        });

        console.log("🖥 ScreenShareCapability: acquired", displayStream);

        // Store local preview
        msc.localScreenStream = displayStream;

        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) {
          console.log("🖥 ScreenShareCapability: publishing SCREEN track");

          // ⭐ IMPORTANT: Explicit mediaTag
          await msc.publishTrack(videoTrack, "screen");
        }
      } catch (err) {
        console.error("🖥 ScreenShareCapability: onEnable error", err);
      }
    },

    onDisable: async () => {
      console.log("🖥 ScreenShareCapability: disabling screenshare");

      displayStream?.getTracks().forEach((t) => t.stop());
      displayStream = null;

      msc.localScreenStream = null;

      // ⭐ Stop only the screenshare producer
      msc.stopProducerByMediaTag("screen");
    },
  };
}
