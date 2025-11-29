// apps/web/src/wrld/Elements/Streaming/Audio/AudioCapability.ts

import { StreamingCapability } from "../../../CoreStream/StreamingCapability";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

let stream: MediaStream | null = null;

export function AudioCapability(msc: MediaSoupClient): StreamingCapability {
  return {
    key: "mic",
    label: "Microphone",

    onEnable: async () => {
      try {
        console.log("🎤 MicCapability: requesting getUserMedia...");

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        console.log("🎤 MicCapability: getUserMedia OK", stream);

        // Expose the raw audio stream so AudioFeedPlane can attach it immediately
        msc.localMicStream = stream;

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          console.log("🎤 MicCapability: publishing audio track", audioTrack);
          await msc.publishTrack(audioTrack);
          console.log("🎤 MicCapability: publishTrack resolved");
        } else {
          console.warn("🎤 MicCapability: no audio track found");
        }
      } catch (err) {
        console.error("🎤 MicCapability: onEnable error", err);
      }
    },

    onDisable: async () => {
      console.log("🎤 MicCapability: disabling mic");

      stream?.getTracks().forEach((t) => t.stop());
      stream = null;

      msc.localMicStream = null;

      msc.stopProducerByKind("audio");
    },
  };
}
