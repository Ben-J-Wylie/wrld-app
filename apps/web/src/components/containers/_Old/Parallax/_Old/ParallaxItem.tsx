// @ts-nocheck

import React, { useEffect, useRef, useCallback } from "react";
import { useParallaxScene } from "./ParallaxScene";
import { useParallaxLight } from "./ParallaxLight";
import { useResponsiveContext } from "../Responsive/ResponsiveContext";
import { parallaxRAFManager } from "./ParallaxRAFManager";

type Props = {
  depth?: number;
  strength?: number;
  scaleFactor?: number;
  fixed?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const ParallaxItem: React.FC<Props> = ({
  depth = 0,
  strength = 30,
  scaleFactor = 0.005,
  fixed = false,
  style,
  children,
  ...rest
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const { scrollY, vw, vh } = useParallaxScene();
  const { x: lx, y: ly, intensity, color } = useParallaxLight();
  const {
    shadowBlur,
    shadowOpacity,
    shadowGrowth,
    shadowOffsetScale,
    shadowFalloff,
  } = useResponsiveContext();

  const computeTransform = useCallback(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const rect = inner.getBoundingClientRect();
    const cx = vw / 2;
    const cy = vh / 2;
    const ex = rect.left + rect.width / 2;
    const ey = rect.top + rect.height / 2;
    const normX = (ex - cx) / cx;
    const normY = (ey - cy) / cy;

    const tx = normX * depth * strength;
    const ty = normY * depth * strength;
    const visualScale = fixed ? 1 : 1 + depth * scaleFactor;

    let shadow = "none";
    if (depth !== 0) {
      const absDepth = Math.abs(depth);
      const offset = absDepth * shadowOffsetScale * 30;
      const blur = shadowBlur + absDepth * shadowGrowth * 1.4;
      const baseOpacity = Math.max(
        0,
        shadowOpacity - absDepth * shadowFalloff * 0.05
      );

      const dir = depth > 0 ? -1 : 1;
      const sx = dir * lx * offset * intensity;
      const sy = dir * ly * offset * intensity;

      const shadowColor = color.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
        const rgb = inner.split(",").slice(0, 3).join(",");
        return `rgba(${rgb}, ${baseOpacity.toFixed(2)})`;
      });

      shadow = `${sx.toFixed(2)}px ${sy.toFixed(2)}px ${blur.toFixed(
        2
      )}px ${shadowColor}`;
    }

    if (!fixed) {
      inner.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${visualScale})`;
    }

    inner.style.filter = shadow === "none" ? "none" : `drop-shadow(${shadow})`;
  }, [
    vw,
    vh,
    depth,
    strength,
    scaleFactor,
    fixed,
    lx,
    ly,
    intensity,
    color,
    shadowBlur,
    shadowOpacity,
    shadowGrowth,
    shadowOffsetScale,
    shadowFalloff,
  ]);

  // --- Subscribe to global RAF manager ---
  useEffect(() => {
    const unsubscribe = parallaxRAFManager.subscribe(computeTransform);
    return () => unsubscribe();
  }, [computeTransform]);

  const innerStyle: React.CSSProperties = {
    transformOrigin: "center center",
    willChange: "transform, filter",
    pointerEvents: "auto",
  };

  const centeredStyle =
    style?.top !== undefined && style?.left !== undefined
      ? { transform: "translate(-50%, -50%)", ...style }
      : style;

  if (fixed) {
    return (
      <div
        ref={innerRef}
        {...rest}
        style={{
          position: "fixed",
          top: style?.top ?? "auto",
          left: style?.left ?? "auto",
          right: style?.right ?? "auto",
          bottom: style?.bottom ?? "auto",
          zIndex: style?.zIndex ?? 10,
          ...innerStyle,
          ...style,
        }}
        data-depth={depth}
        data-fixed
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={outerRef}
      style={{
        position: "relative",
        ...centeredStyle,
      }}
      {...rest}
      data-depth={depth}
    >
      <div ref={innerRef} style={innerStyle}>
        {children}
      </div>
    </div>
  );
};

export default ParallaxItem;
