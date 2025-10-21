// apps/mediaserver/src/mediasoup/index.ts
import * as mediasoup from "mediasoup";

export async function createMediasoupCore() {
  const worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  worker.on("died", () => {
    console.error("❌ Mediasoup worker died, exiting in 2s...");
    setTimeout(() => process.exit(1), 2000);
  });

  const router = await worker.createRouter({
    mediaCodecs: [
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: { "x-google-start-bitrate": 1000 },
      },
    ],
  });

  return { worker, router };
}
