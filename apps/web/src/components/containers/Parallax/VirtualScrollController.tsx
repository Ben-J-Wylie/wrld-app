// src/parallax/VirtualScrollController.tsx
// ------------------------------------------------------------
// VirtualScrollController
// ------------------------------------------------------------
// Replaces ParallaxController when you want camera motion
// independent of real DOM scroll. Works with wheel, touch,
// and arrow/WASD keys. Produces a normalized 0–1 scroll value
// in the ParallaxStore.

import { useEffect, useRef } from "react";
import { useParallaxStore } from "./ParallaxStore";

export function VirtualScrollController() {
  const setScroll = useParallaxStore((s) => s.setScroll);

  // Smoothed motion state
  const velocity = useRef(0);
  const position = useRef(0); // live scroll position (0–1)
  const target = useRef(0); // user’s desired scroll position

  // Configurable sensitivities
  const wheelSpeed = 0.0012; // deltaY multiplier
  const touchSpeed = 0.002; // finger drag multiplier
  const keySpeed = 0.03; // keyboard step amount
  const damping = 0.1; // velocity decay
  const spring = 1; // catch-up rate

  useEffect(() => {
    let touchStartY = 0;
    let anim: number;

    // --- WHEEL ---
    const onWheel = (e: WheelEvent) => {
      target.current += e.deltaY * wheelSpeed;
      target.current = Math.min(1, Math.max(0, target.current));
    };

    // --- TOUCH (mobile / trackpad) ---
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      target.current += deltaY * touchSpeed;
      target.current = Math.min(1, Math.max(0, target.current));
    };

    // --- KEYBOARD ---
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
        case "s":
        case "S":
          target.current = Math.min(1, target.current + keySpeed);
          break;
        case "ArrowUp":
        case "w":
        case "W":
          target.current = Math.max(0, target.current - keySpeed);
          break;
        case "PageDown":
          target.current = 1;
          break;
        case "PageUp":
          target.current = 0;
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    // --- ANIMATION LOOP ---
    const loop = () => {
      // spring toward target with easing
      velocity.current += (target.current - position.current) * spring;
      velocity.current *= damping;
      position.current += velocity.current;

      // clamp to [0,1]
      if (position.current < 0) position.current = 0;
      if (position.current > 1) position.current = 1;

      // push to store
      setScroll(position.current);

      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);

    // attach events
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    // cleanup
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setScroll]);

  return null;
}
