import React, { useState } from "react";
import { useResponsiveContext } from "../Responsive/ResponsiveContext";
import ParallaxItem from "../Parallax/ParallaxItem";
import { WebGLStage } from "../Parallax/WebGLStage";
import { GLPlaneLayer } from "../Parallax/GLPlaneLayer";
import type { FeatureLayer } from "../FeatureLayer/FeatureLayer";

type Props = {
  top: string | number;
  left: string | number;
  size?: number;
  layers: FeatureLayer[];
  style?: React.CSSProperties;
  onClick?: () => void;
};

export default function FeatureStack({
  top,
  left,
  size = 300,
  layers,
  style = {},
  onClick,
}: Props) {
  const { scale, parallaxStrength } = useResponsiveContext();
  const [hovered, setHovered] = useState(false);
  const responsiveSize = size * scale;

  const domLayers = layers.filter((l) => l.renderMode !== "gl");
  const glLayers = layers.filter((l) => l.renderMode === "gl");

  return (
    <>
      {/* Render a GL stage only when needed (kept pointerEvents: none) */}
      {glLayers.length > 0 && (
        <WebGLStage>
          {glLayers.map((l) => (
            <GLPlaneLayer
              key={l.id}
              id={l.id}
              textureSrc={l.textureSrc!}
              width={l.width ?? responsiveSize}
              height={l.height ?? responsiveSize}
              depth={l.depth ?? 0}
              hoverDepthShift={l.hoverDepthShift ?? 0.12}
              hovered={hovered}
              offsetX={l.offsetX ?? 0}
              offsetY={l.offsetY ?? 0}
              rotation={l.rotation ?? 0}
              opacity={l.opacity ?? 1}
              scale={l.scale ?? 1}
              fit={l.fit ?? "contain"}
              shader={l.shader ?? "basic"}
            />
          ))}
        </WebGLStage>
      )}

      {/* DOM container (keeps interaction + semantics) */}
      <div
        style={{
          position: "absolute",
          top,
          left,
          width: `${responsiveSize}px`,
          height: `${responsiveSize}px`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
          ...style,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
      >
        {domLayers.map((l) => {
          const depth = l.depth ?? 0;
          const adjusted = hovered
            ? depth + (l.hoverDepthShift ?? 0.12)
            : depth * parallaxStrength;

          return (
            <ParallaxItem
              key={l.id}
              depth={adjusted}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: l.width ?? responsiveSize,
                height: l.height ?? responsiveSize,
                transform: `translate(calc(-50% + ${
                  l.offsetX ?? 0
                }px), calc(-50% + ${l.offsetY ?? 0}px)) rotate(${
                  l.rotation ?? 0
                }deg)`,
                opacity: l.opacity ?? 1,
                ...(l.style || {}),
              }}
              onClick={l.onClick}
            >
              {l.Component ? (
                <l.Component
                  width="100%"
                  height="100%"
                  fill={l.color ?? "currentColor"}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: l.color ?? "transparent",
                  }}
                />
              )}
            </ParallaxItem>
          );
        })}
      </div>
    </>
  );
}
