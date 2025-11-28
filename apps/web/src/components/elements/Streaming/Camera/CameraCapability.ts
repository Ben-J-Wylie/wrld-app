// apps/web/src/wrld/Elements/Streaming/Camera/CameraCapability.ts

import { StreamingCapability } from "../../../CoreStream/StreamingCapability";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

let stream: MediaStream | null = null;

export function CameraCapability(msc: MediaSoupClient): StreamingCapability {
  return {
    key: "camera",
    label: "Camera",

    onEnable: async () => {
      try {
        console.log("📷 CameraCapability: requesting getUserMedia...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 }, // 🔑 reduce resolution for performance
            height: { ideal: 360 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
        console.log("📷 CameraCapability: getUserMedia OK", stream);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          console.log(
            "📷 CameraCapability: publishing video track",
            videoTrack
          );
          await msc.publishTrack(videoTrack);
          console.log("📷 CameraCapability: publishTrack resolved");
        } else {
          console.warn("📷 CameraCapability: no video track found");
        }
      } catch (err) {
        console.error("📷 CameraCapability: onEnable error", err);
      }
    },

    onDisable: async () => {
      console.log("📷 CameraCapability: disabling camera");

      stream?.getTracks().forEach((t) => t.stop());
      stream = null;

      msc.stopProducerByKind("video");
    },
  };
}
