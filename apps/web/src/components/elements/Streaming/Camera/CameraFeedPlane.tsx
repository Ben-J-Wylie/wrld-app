// apps/web/src/wrld/Streaming/CameraFeedPlane.tsx

import React, { useEffect, useRef, useState } from "react";
import { VideoTexture, LinearFilter, SRGBColorSpace } from "three";

import { ImagePlane } from "../../../CoreScene/Geometry/ImagePlane";
import { MediaSoupClient } from "../../../../lib/mediasoupClient";

interface CameraFeedPlaneProps {
  msc: MediaSoupClient;
  peerId?: string; // "self" or another peer id
  name?: string;

  // ImagePlane props
  width: any;
  height: any;
  position: any;
  rotation?: any;
  scale?: any;
  cornerRadius?: any;

  castShadow?: boolean;
  receiveShadow?: boolean;
  z?: number;
  visible?: boolean;
}

export function CameraFeedPlane({
  msc,
  peerId = "self",
  name = "CameraFeedPlane",

  width,
  height,
  position,
  rotation,
  scale,
  cornerRadius,

  castShadow = true,
  receiveShadow = true,
  z = 0,
  visible = true,
}: CameraFeedPlaneProps) {
  // Hidden video element that drives the VideoTexture
  const videoRef = useRef<HTMLVideoElement>(null);

  // THREE.VideoTexture instance
  const [texture, setTexture] = useState<VideoTexture | null>(null);

  // -------------------------------------------------------
  // Create the THREE.VideoTexture from the hidden <video>
  // -------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    // Build VideoTexture
    const tex = new VideoTexture(video);
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.colorSpace = SRGBColorSpace; // ✔ correct modern API

    setTexture(tex);

    // Cleanup
    return () => {
      tex.dispose();
    };
  }, []);

  // -------------------------------------------------------
  // Handle incoming mediasoup streams
  // Attach only streams that match peerId
  // -------------------------------------------------------
  useEffect(() => {
    if (!msc) return;

    const originalHandler = msc.onNewStream;

    msc.onNewStream = (stream, id) => {
      if (id === peerId && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if (originalHandler) {
        originalHandler(stream, id);
      }
    };

    // Restore original handler on unmount
    return () => {
      msc.onNewStream = originalHandler;
    };
  }, [msc, peerId]);

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <>
      {/* Hidden HTML video element (drives the texture) */}
      <video ref={videoRef} style={{ display: "none" }} />

      {/* Your ImagePlane with the live video texture */}
      <ImagePlane
        name={name}
        texture={texture ?? undefined}
        width={width}
        height={height}
        cornerRadius={cornerRadius}
        position={position}
        rotation={rotation}
        scale={scale}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        z={z}
        visible={visible}
      />
    </>
  );
}

{
  /* <CameraFeedPlane
  msc={msc}
  peerId="self"
  width={{ mobile: 300, tablet: 350, desktop: 400 }}
  height={{ mobile: 200, tablet: 230, desktop: 260 }}
  position={{ mobile: [0, -200, 0], tablet: [0, -200, 0], desktop: [0, -200, 0] }}
  cornerRadius={{ mobile: 20, tablet: 30, desktop: 40 }}
/> */
}
