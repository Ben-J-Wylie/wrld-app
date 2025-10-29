import React, { useEffect, useRef, useMemo, useState } from "react";
import { useParallaxScene, useParallaxRegistry } from "./ParallaxScene";

type Props = {
  id?: string; // optional manual id, otherwise auto-generated
  depth?: number; // + = near (moves more), - = far (moves less)
  strength?: number; // movement intensity
  scaleFactor?: number; // how much scaling to apply per depth unit
  style?: React.CSSProperties; // e.g. { top, left }
  children: React.ReactNode;
};

let idCounter = 0;

const ParallaxItem: React.FC<Props> = ({
  id,
  depth = 1,
  strength = 20,
  scaleFactor = 0.005,
  style,
  children,
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const { scrollY, vw, vh } = useParallaxScene();
  const { register, unregister } = useParallaxRegistry();

  // Track the current CSS transform so shadows can mirror it
  const [currentTransform, setCurrentTransform] = useState<string>("");

  // Unique ID for registry tracking
  const uniqueId = useMemo(() => id || `parallax-item-${++idCounter}`, [id]);

  /* -------------------------------------------------------
     🔹 Register this item in the ParallaxScene registry
  ------------------------------------------------------- */
  useEffect(() => {
    // Function that returns a shadow-ready positioned clone
    const renderForShadow = () => (
      <div
        style={{
          position: "absolute",
          ...(style || {}),
          transform: currentTransform,
          transformOrigin: "center center",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    );

    register({ id: uniqueId, depth, renderForShadow });
    return () => unregister(uniqueId);
  }, [
    uniqueId,
    depth,
    children,
    style,
    currentTransform,
    register,
    unregister,
  ]);

  /* -------------------------------------------------------
     🔹 Apply parallax transform (translation + scale)
  ------------------------------------------------------- */
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Measure position relative to viewport center
    const rect = outer.getBoundingClientRect();
    const cx = vw / 2;
    const cy = vh / 2;

    const anchorX = style?.left
      ? (parseFloat(String(style.left)) / 100) * vw
      : 0;
    const anchorY = style?.top ? (parseFloat(String(style.top)) / 100) * vh : 0;

    const ex = rect.left + rect.width / 2 - anchorX;
    const ey = rect.top + rect.height / 2 - anchorY;

    const normX = (ex - cx) / cx;
    const normY = (ey - cy) / cy;

    // Translation and scaling
    const tx = normX * depth * strength;
    const ty = normY * depth * strength;
    const scale = 1 + depth * scaleFactor;

    // Apply transform and store for shadows
    const transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    inner.style.transform = transform;
    setCurrentTransform(transform);
  }, [scrollY, vw, vh, depth, strength, scaleFactor]);

  /* -------------------------------------------------------
     🔹 Render component
  ------------------------------------------------------- */
  return (
    <div
      ref={outerRef}
      style={{
        position: "absolute",
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      <div
        ref={innerRef}
        style={{
          willChange: "transform",
          transition: "transform 0.15s ease-out",
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ParallaxItem;
