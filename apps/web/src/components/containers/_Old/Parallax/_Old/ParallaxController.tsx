// @ts-nocheck

// In simple terms:
// - A silent helper that listens for scroll and resize events, then keeps the store up to date.

// Controls:
// - It normalizes scroll (window.scrollY / totalPageHeight).
// - It measures the document height so parallax stays proportional even on long pages.
// - It updates viewport dimensions for responsive scaling.

// Impact:
// - Feeds consistent scroll values (0–1) to the entire parallax system.
// - Without it, nothing would move.

import { useEffect, useRef } from "react";
import { useParallaxStore } from "./ParallaxStore";

/**
 * ParallaxController
 * ------------------------------------------------------------
 * Monitors window scroll and resize.
 * Normalizes scroll (0–1) and updates global viewport size.
 * Optimized for smooth, snappy resizing.
 */
export function ParallaxController() {
  const setScroll = useParallaxStore((s) => s.setScroll);
  const setViewport = useParallaxStore((s) => s.setViewport);
  const docHeightRef = useRef(1);

  useEffect(() => {
    let resizeFrame = 0;
    let scrollFrame = 0;

    const updateScroll = () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const denom = Math.max(1, docHeightRef.current);
        const value = window.scrollY;
        setScroll(Math.min(1, Math.max(0, value / denom)));
      });
    };

    const computeDocHeight = () => {
      const body = document.body;
      const html = document.documentElement;
      return (
        Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        ) - window.innerHeight
      );
    };

    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        docHeightRef.current = computeDocHeight();
        setViewport(window.innerWidth, window.innerHeight);
        updateScroll();
      });
    };

    // Initial sync
    docHeightRef.current = computeDocHeight();
    setViewport(window.innerWidth, window.innerHeight);
    updateScroll();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", updateScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", updateScroll);
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(scrollFrame);
    };
  }, [setScroll, setViewport]);

  return null;
}
