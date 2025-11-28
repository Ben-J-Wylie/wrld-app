import { StreamingCapability } from "../StreamingTypes";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

let stream: MediaStream | null = null;

export function CameraCapability(msc: MediaSoupClient): StreamingCapability {
  return {
    key: "camera",
    label: "Camera",

    onEnable: async () => {
      // Request only video
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      // Publish ONLY the video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await msc.publishTrack(videoTrack);
      }
    },

    onDisable: async () => {
      // Stop local tracks
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;

      // Unpublish from mediasoup
      msc.stopProducerByKind("video");
    },
  };
}
