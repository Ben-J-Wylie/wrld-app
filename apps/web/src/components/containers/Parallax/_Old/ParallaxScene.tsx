import React, { createContext, useContext, useEffect, useState } from "react";

type ParallaxCtx = { scrollY: number; vw: number; vh: number };
const Ctx = createContext<ParallaxCtx>({ scrollY: 0, vw: 0, vh: 0 });

export const ParallaxScene: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<ParallaxCtx>({
    scrollY: window.scrollY,
    vw: window.innerWidth,
    vh: window.innerHeight,
  });

  useEffect(() => {
    let raf: number | null = null;
    const update = () => {
      raf = null;
      setState({
        scrollY: window.scrollY,
        vw: window.innerWidth,
        vh: window.innerHeight,
      });
    };
    const onScroll = () => !raf && (raf = requestAnimationFrame(update));
    const onResize = onScroll;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
};

export const useParallaxScene = () => useContext(Ctx);
