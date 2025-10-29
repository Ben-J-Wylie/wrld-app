import React, { useEffect, useLayoutEffect, useRef } from "react";

export type Layer = {
  depth: number; // negative = far, positive = near
  content: React.ReactNode;
  style?: React.CSSProperties;
};

type Props = {
  layers: Layer[];
  strength?: number;
  perspective?: number;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
};

const ParallaxStack: React.FC<Props> = ({
  layers,
  strength = 40,
  perspective = 800,
  width = "auto",
  height = "auto",
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  const update = () => {
    raf.current = null;
    const el = ref.current;
    if (!el) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const rect = el.getBoundingClientRect();
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const elementX = rect.left + rect.width / 2;
    const elementY = rect.top + rect.height / 2;

    // normalized distance from viewport center (-1 → +1)
    const normX = (elementX - centerX) / centerX;
    const normY = (elementY - centerY) / centerY;

    const children = Array.from(el.children) as HTMLElement[];

    children.forEach((child, i) => {
      const layer = layers[i];
      const d = layer.depth;
      const tx = normX * d * strength;
      const ty = normY * d * strength;
      child.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    });
  };

  useEffect(() => {
    const triggerUpdate = () => {
      if (!raf.current) raf.current = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", triggerUpdate, { passive: true });
    window.addEventListener("resize", triggerUpdate);
    update();

    return () => {
      window.removeEventListener("scroll", triggerUpdate);
      window.removeEventListener("resize", triggerUpdate);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    Array.from(el.children).forEach((child) => {
      const c = child as HTMLElement;
      c.style.position = "absolute";
      c.style.top = "0";
      c.style.left = "0";
      c.style.willChange = "transform";
      c.style.transition = "transform 0.15s ease-out";
    });
  }, [layers.length]);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width,
        height,
        transformStyle: "preserve-3d",
        perspective: `${perspective}px`,
        ...style,
      }}
    >
      {layers.map((layer, i) => (
        <div key={i} style={{ zIndex: i, ...layer.style }}>
          {layer.content}
        </div>
      ))}
    </div>
  );
};

export default ParallaxStack;
