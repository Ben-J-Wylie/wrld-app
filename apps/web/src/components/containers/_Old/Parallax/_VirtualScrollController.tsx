// @ts-nocheck

// src/parallax/VirtualScrollController.tsx
import { useEffect, useRef } from "react";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxConfig } from "./ParallaxConfig";

const { baseWheelSpeed, baseTouchSpeed, baseKeySpeed, damping, spring } =
  ParallaxConfig.scroll;

export function VirtualScrollController() {
  const setScroll = useParallaxStore((s) => s.setScroll);
  const worldHeight = useParallaxStore((s) => s.worldHeight);
  const visibleHeight = useParallaxStore((s) => s.visibleHeight);

  const velocity = useRef(0);
  const position = useRef(0);
  const target = useRef(0);
  const touchActive = useRef(false);
  const lastTouchY = useRef(0);
  const lastDeltaY = useRef(0);

  useEffect(() => {
    const wH = worldHeight ?? 10;
    const vH = visibleHeight ?? 10;
    const scrollScale = Math.max(vH / wH, 0.1);

    const wheelSpeed = baseWheelSpeed * scrollScale;
    const touchSpeed = baseTouchSpeed * scrollScale;
    const keySpeed = baseKeySpeed * scrollScale;

    let anim: number;

    /* -------------------- Wheel -------------------- */
    const onWheel = (e: WheelEvent) => {
      target.current += e.deltaY * wheelSpeed;
      target.current = Math.min(1, Math.max(0, target.current));
    };

    /* -------------------- Touch -------------------- */
    const onTouchStart = (e: TouchEvent) => {
      touchActive.current = true;
      lastTouchY.current = e.touches[0].clientY;
      lastDeltaY.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      const deltaY = lastTouchY.current - y;
      lastTouchY.current = y;
      lastDeltaY.current = deltaY;

      // When finger is on screen, we move directly — no lag
      const instantDelta = deltaY * touchSpeed;
      target.current += instantDelta;
      position.current += instantDelta; // direct stick-to-finger
      position.current = Math.min(1, Math.max(0, position.current));
      target.current = position.current; // sync so no post-spring
      setScroll(position.current);
    };

    const onTouchEnd = () => {
      touchActive.current = false;

      // Give a small flick momentum proportional to last movement
      velocity.current = lastDeltaY.current * touchSpeed * 0.5;
    };

    /* -------------------- Keyboard -------------------- */
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

    /* -------------------- Animation -------------------- */
    const loop = () => {
      // If not touching, continue easing motion
      if (!touchActive.current) {
        velocity.current += (target.current - position.current) * spring;
        velocity.current *= damping;
        position.current += velocity.current;
        position.current = Math.min(1, Math.max(0, position.current));
        setScroll(position.current);
      }
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);

    /* -------------------- Cleanup -------------------- */
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setScroll, worldHeight, visibleHeight]);

  return null;
}
