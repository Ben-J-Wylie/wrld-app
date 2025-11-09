import { useEffect, useRef } from "react";
import { useParallaxStore } from "./ParallaxStore";

type Props = {
  /** How smoothly layers interpolate toward their target positions. */
  damping?: number;
};

/**
 * ParallaxController
 * ------------------------------------------------------------
 * Watches window scroll & resize events.
 * Updates normalized scroll (0..1) and viewport dimensions in the global store.
 */
export function ParallaxController({ damping = 0.1 }: Props) {
  const setScroll = useParallaxStore((s) => s.setScroll);
  const setViewport = useParallaxStore((s) => s.setViewport);
  const setDamping = useParallaxStore((s) => s.setDamping);

  const docHeightRef = useRef<number>(1);

  useEffect(() => {
    // Initialize damping value
    setDamping(damping);

    const updateScroll = () => {
      const denom = Math.max(1, docHeightRef.current);
      const scrollNorm = window.scrollY / denom;
      setScroll(scrollNorm);
    };

    const onResize = () => {
      setViewport(window.innerWidth, window.innerHeight);

      const body = document.body;
      const html = document.documentElement;
      const docHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );

      docHeightRef.current = docHeight - window.innerHeight;
      updateScroll();
    };

    // Initialize
    onResize();

    // Attach listeners
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", updateScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", updateScroll);
    };
  }, [damping, setScroll, setViewport, setDamping]);

  return null;
}
