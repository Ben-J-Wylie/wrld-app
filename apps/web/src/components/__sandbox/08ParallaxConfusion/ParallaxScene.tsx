import React, { createContext, useContext, useEffect, useState } from "react";

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
export type SceneItem = {
  id: string;
  // ✅ Allow null because React refs are always created as RefObject<HTMLDivElement | null>
  ref: React.RefObject<HTMLDivElement | null>;
  depth: number;
};

export type ParallaxCtx = {
  scrollY: number;
  vw: number;
  vh: number;
  items: SceneItem[];
  register: (item: SceneItem) => void;
  unregister: (id: string) => void;
};

// -------------------------------------------------------------
// Context
// -------------------------------------------------------------
const Ctx = createContext<ParallaxCtx>({} as ParallaxCtx);

// -------------------------------------------------------------
// Component
// -------------------------------------------------------------
export const ParallaxScene: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // --- existing scroll/viewport tracking ---
  const [scrollY, setScrollY] = useState(0);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  useEffect(() => {
    let raf: number | null = null;
    const update = () => {
      raf = null;
      setScrollY(window.scrollY);
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    const onScroll = () => !raf && (raf = requestAnimationFrame(update));
    const onResize = onScroll;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    update(); // initial run

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // --- registry for parallax items ---
  const [items, setItems] = useState<SceneItem[]>([]);

  const register = (item: SceneItem) =>
    setItems((prev) => [...prev.filter((i) => i.id !== item.id), item]);

  const unregister = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const value: ParallaxCtx = {
    scrollY,
    vw,
    vh,
    items,
    register,
    unregister,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

// -------------------------------------------------------------
// Hook
// -------------------------------------------------------------
export const useParallaxScene = () => useContext(Ctx);
