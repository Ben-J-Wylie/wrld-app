import React, { useEffect, useRef, useId } from "react";
import { useParallaxScene } from "./ParallaxScene";
import { useParallaxLight } from "./ParallaxLight";

type Props = {
  depth?: number;
  strength?: number;
  scaleFactor?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

const ParallaxItem: React.FC<Props> = ({
  depth = 0,
  strength = 8,
  scaleFactor = 0.005,
  style,
  children,
}) => {
  const id = useId();
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const { scrollY, vw, vh, register, unregister } = useParallaxScene();
  const { x: lx, y: ly, intensity, color } = useParallaxLight(); // 💡 Light context

  // 🔹 Register this item with the ParallaxScene (for ShadowProjection)
  useEffect(() => {
    if (outerRef.current) {
      console.log("Registering ParallaxItem:", id, "depth =", depth);
      register({ id, ref: outerRef, depth });
    }
    return () => unregister(id);
  }, [id, depth, register, unregister]);

  // 🔹 Update transforms and shadow whenever scene changes
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // --- Movement ---
    const rect = outer.getBoundingClientRect();
    const cx = vw / 2;
    const cy = vh / 2;
    const ex = rect.left + rect.width / 2;
    const ey = rect.top + rect.height / 2;
    const normX = (ex - cx) / cx;
    const normY = (ey - cy) / cy;
    const tx = normX * depth * strength;
    const ty = normY * depth * strength;
    const scale = 1 + depth * scaleFactor;

    // --- Shadow physics ---
    let shadow = "none";
    if (depth > 0) {
      const offset = depth * 10; // distance of shadow
      const blur = 2 + depth * 4; // softness
      const baseOpacity = Math.max(0, 0.6 - depth * 0.1); // fades with depth

      // 💡 Calculate offset using global light direction
      const sx = -lx * offset * intensity;
      const sy = -ly * offset * intensity;

      // 💡 Adjust shadow color alpha based on computed opacity
      const shadowColor = color.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
        const rgb = inner.split(",").slice(0, 3).join(",");
        return `rgba(${rgb}, ${baseOpacity})`;
      });

      shadow = `${sx}px ${sy}px ${blur}px ${shadowColor}`;
    }

    // --- Apply transformations and shadow ---
    inner.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    inner.style.filter = shadow === "none" ? "none" : `drop-shadow(${shadow})`;
  }, [scrollY, vw, vh, depth, strength, scaleFactor, lx, ly, intensity, color]);

  return (
    <div ref={outerRef} style={{ position: "absolute", ...style }}>
      <div
        ref={innerRef}
        style={{
          willChange: "transform, filter",
          transition: "transform 0.15s ease-out, filter 0.3s ease-out",
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ParallaxItem;
