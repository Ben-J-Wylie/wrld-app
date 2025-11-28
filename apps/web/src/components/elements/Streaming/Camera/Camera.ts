import { StreamingCapability } from "../StreamingTypes";
import { MediaSoupClient } from "../../mediasoup/MediaSoupClient";

let stream: MediaStream | null = null;

export function createCameraCapability(
  msc: MediaSoupClient
): StreamingCapability {
  return {
    key: "camera",
    label: "Camera",

    onEnable: async () => {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      await msc.publishVideo(stream);
    },

    onDisable: async () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;

      msc.unpublishVideo();
    },
  };
}
