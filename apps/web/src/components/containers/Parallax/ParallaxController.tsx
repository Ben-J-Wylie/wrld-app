// In simple terms:
// - A silent helper that listens for scroll and resize events, then keeps the store up to date.

// Controls:
// - It normalizes scroll (window.scrollY / totalPageHeight).
// - It measures the document height so parallax stays proportional even on long pages.
// - It updates viewport dimensions for responsive scaling.

// Impact:
// - Feeds consistent scroll values (0–1) to the entire parallax system.
// - Without it, nothing would move.

// src/parallax/ParallaxController.tsx
import { useEffect, useRef } from "react";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxConfig } from "./ParallaxConfig";

/**
 * ParallaxController
 * ------------------------------------------------------------
 * Monitors window scroll and resize.
 * Normalizes scroll (0–1) and updates global viewport size.
 */
export function ParallaxController() {
  const setScroll = useParallaxStore((s) => s.setScroll);
  const setViewport = useParallaxStore((s) => s.setViewport);
  const docHeightRef = useRef<number>(1);

  useEffect(() => {
    if (!ParallaxConfig.controller.enabled) return;

    const updateScroll = () => {
      const denom = Math.max(1, docHeightRef.current);
      const value = window.scrollY;
      setScroll(
        ParallaxConfig.controller.normalizeScroll ? value / denom : value
      );
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

    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", updateScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", updateScroll);
    };
  }, [setScroll, setViewport]);

  return null;
}
